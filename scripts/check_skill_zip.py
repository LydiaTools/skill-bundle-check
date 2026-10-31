#!/usr/bin/env python3
"""Read ZIP directory metadata for common single-Skill upload problems.

This is a narrow, read-only structural review, not platform validation or a
security scan. It never extracts files or executes archive contents.
"""
import argparse
import json
import re
import stat
import struct
import sys
import zipfile
from pathlib import Path, PurePosixPath

MAX_ARCHIVE = 64 * 1024 * 1024
MAX_DIRECTORY = 4 * 1024 * 1024
MAX_ENTRIES = 5000
MAX_FINDINGS = 25
EOCD = struct.Struct('<4s4H2LH')


class CannotInspect(ValueError):
    pass


def directory_preflight(handle):
    """Bound directory parsing before ZipFile allocates one object per entry."""
    handle.seek(0, 2)
    size = handle.tell()
    if size > MAX_ARCHIVE:
        raise CannotInspect('Archive exceeds the 64 MiB inspection limit.')
    handle.seek(max(0, size - (65535 + EOCD.size)))
    tail = handle.read()
    # Find an EOCD whose declared comment ends exactly at EOF. Do not mistake a
    # signature inside the ZIP comment for the directory record.
    pos = len(tail)
    candidates = []
    while True:
        pos = tail.rfind(b'PK\x05\x06', 0, pos)
        if pos < 0:
            break
        if pos + EOCD.size <= len(tail):
            fields = EOCD.unpack_from(tail, pos)
            if pos + EOCD.size + fields[-1] == len(tail):
                candidates.append((pos, fields))
    if len(candidates) != 1:
        raise CannotInspect('ZIP end record missing or ambiguous, or has trailing data.')
    pos, fields = candidates[0]
    _, disk, directory_disk, disk_entries, entries, directory_size, directory_offset, _ = fields
    # Python's zipfile uses the last signature, even when it is in a comment.
    # Reject that unusual case explicitly instead of misreading its directory.
    if b'PK\x05\x06' in tail[pos + EOCD.size:]:
        raise CannotInspect('ZIP comments containing an end-record signature are not supported.')
    if disk or directory_disk or disk_entries != entries:
        raise CannotInspect('Multi-disk ZIP files are not supported.')
    if entries == 0xffff or directory_size == 0xffffffff or directory_offset == 0xffffffff:
        raise CannotInspect('ZIP64 archives are not supported.')
    if entries > MAX_ENTRIES or directory_size > MAX_DIRECTORY:
        raise CannotInspect('ZIP directory exceeds the inspection limits.')
    handle.seek(0)
    return entries


def inspect_zip(path):
    findings = []
    entrypoints = []
    wrong_case = []
    seen = set()
    with open(path, 'rb') as handle:
        expected_entries = directory_preflight(handle)
        with zipfile.ZipFile(handle) as archive:
            entries = archive.infolist()
            if len(entries) != expected_entries:
                raise CannotInspect('ZIP directory entry count did not match its end record.')
            for item in entries:
                name = item.filename
                if '\x00' in item.orig_filename:
                    findings.append({'code': 'NUL_IN_PATH', 'path': item.orig_filename})
                parts = PurePosixPath(name).parts
                unsafe = (not name or '\\' in name or name.startswith('/') or
                          re.match(r'^[A-Za-z]:', name) or '..' in parts)
                if unsafe:
                    findings.append({'code': 'UNSAFE_PATH', 'path': name})
                if name in seen:
                    findings.append({'code': 'DUPLICATE_PATH', 'path': name})
                seen.add(name)
                if item.create_system == 3 and stat.S_ISLNK(item.external_attr >> 16):
                    findings.append({'code': 'SYMLINK', 'path': name})
                if item.flag_bits & 1:
                    findings.append({'code': 'ENCRYPTED_ENTRY', 'path': name})
                if not item.is_dir() and parts:
                    if parts[-1] == 'SKILL.md':
                        entrypoints.append(name)
                    elif parts[-1].lower() == 'skill.md':
                        wrong_case.append(name)
            if len(entrypoints) != 1:
                findings.append({'code': 'ENTRYPOINT_COUNT', 'count': len(entrypoints)})
            if wrong_case:
                for name in wrong_case:
                    findings.append({'code': 'ENTRYPOINT_CASE', 'path': name})
    return {'status': 'REVIEW' if findings else 'OK', 'entries': expected_entries,
            'skill_files': entrypoints[:MAX_FINDINGS], 'skill_file_count': len(entrypoints),
            'findings': findings[:MAX_FINDINGS], 'finding_count': len(findings),
            'scope': 'ZIP directory metadata only; no extraction, content validation, or upload.'}


def main():
    parser = argparse.ArgumentParser(description='Review ZIP structure for a single Skill upload.')
    parser.add_argument('archive', type=Path)
    parser.add_argument('--json', action='store_true', help='Print a JSON report')
    args = parser.parse_args()
    try:
        report = inspect_zip(args.archive)
    except (OSError, zipfile.BadZipFile, CannotInspect, UnicodeError, struct.error) as exc:
        report = {'status': 'UNAVAILABLE', 'reason': str(exc)}
        code = 2
    else:
        code = 1 if report['finding_count'] else 0
    if args.json:
        print(json.dumps(report, ensure_ascii=True, indent=2))
    else:
        print(report['status'])
        if code == 2:
            print(json.dumps(report['reason'], ensure_ascii=True))
        else:
            print(f"ZIP entries: {report['entries']}; SKILL.md files: {report['skill_file_count']}")
            for name in report['skill_files']:
                print('  SKILL.md:', json.dumps(name, ensure_ascii=True))
            for finding in report['findings']:
                print('  REVIEW:', json.dumps(finding, ensure_ascii=True))
            if report['finding_count'] > len(report['findings']):
                print(f"  ... {report['finding_count'] - len(report['findings'])} more findings")
            print(report['scope'])
            print('A clean result does not guarantee a platform will accept or load this Skill.')
    return code


if __name__ == '__main__':
    sys.exit(main())
