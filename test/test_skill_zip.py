import contextlib
import io
import json
import stat
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from check_skill_zip import CannotInspect, inspect_zip


class ZipInspectionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'sample.zip'

    def tearDown(self):
        self.temp.cleanup()

    def archive(self, entries):
        with zipfile.ZipFile(self.path, 'w') as z:
            with contextlib.redirect_stderr(io.StringIO()):
                for name, data in entries:
                    z.writestr(name, data)

    def codes(self):
        return [item['code'] for item in inspect_zip(self.path)['findings']]

    def test_single_skill_inside_folder(self):
        self.archive([('example/SKILL.md', '---\nname: example\n---\n'), ('example/notes.md', 'x')])
        report = inspect_zip(self.path)
        self.assertEqual(report['status'], 'OK')
        self.assertEqual(report['skill_files'], ['example/SKILL.md'])

    def test_duplicate_skill_entries_and_wrong_case(self):
        self.archive([('a/SKILL.md', 'a'), ('b/SKILL.md', 'b'), ('c/skill.md', 'c')])
        report = inspect_zip(self.path)
        self.assertEqual(report['skill_file_count'], 2)
        self.assertIn('ENTRYPOINT_COUNT', self.codes())
        self.assertIn('ENTRYPOINT_CASE', self.codes())

    def test_symlink_and_duplicate_file_are_reported_without_extracting(self):
        link = zipfile.ZipInfo('other/SKILL.md')
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        self.archive([('SKILL.md', 'first'), ('SKILL.md', 'second'), (link, '../SKILL.md')])
        self.assertIn('SYMLINK', self.codes())
        self.assertIn('DUPLICATE_PATH', self.codes())
        self.assertFalse((Path(self.temp.name) / 'SKILL.md').exists())

    def test_unsafe_paths_and_control_characters(self):
        self.archive([('SKILL.md', 'x'), ('../escape', 'x'), ('C:/temp', 'x'), ('\\evil', 'x'), ('line\nname', 'x')])
        report = inspect_zip(self.path)
        self.assertEqual(sum(item['code'] == 'UNSAFE_PATH' for item in report['findings']), 3)
        output = subprocess.run([sys.executable, str(ROOT / 'scripts/check_skill_zip.py'), str(self.path), '--json'],
                                text=True, capture_output=True, check=False)
        self.assertEqual(output.returncode, 1)
        self.assertEqual(json.loads(output.stdout)['status'], 'REVIEW')

    def test_nul_and_encrypted_flags_are_visible(self):
        self.archive([('SKILL.md', 'x'), ('dangerZname', 'x')])
        raw = bytearray(self.path.read_bytes())
        # Keep filename lengths unchanged while putting NUL into both copies.
        raw = raw.replace(b'dangerZname', b'danger\x00name')
        central = raw.index(b'PK\x01\x02')
        local = raw.index(b'PK\x03\x04')
        raw[central + 8] |= 1
        raw[local + 6] |= 1
        self.path.write_bytes(raw)
        self.assertIn('NUL_IN_PATH', self.codes())
        self.assertIn('ENCRYPTED_ENTRY', self.codes())

    def test_corrupted_and_trailing_data_are_unavailable(self):
        self.path.write_bytes(b'not a zip')
        with self.assertRaises(CannotInspect):
            inspect_zip(self.path)
        self.archive([('SKILL.md', 'x')])
        with self.path.open('ab') as stream:
            stream.write(b'unexpected trailing data')
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/check_skill_zip.py'), str(self.path)],
                                text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 2)
        self.assertIn('UNAVAILABLE', result.stdout)

    def test_archive_over_entry_limit_rejected_before_zipfile_parse(self):
        # An EOCD advertising too many records is rejected before directory read.
        import struct
        self.path.write_bytes(struct.pack('<4s4H2LH', b'PK\x05\x06', 0, 0, 5001, 5001, 0, 0, 0))
        with self.assertRaises(CannotInspect):
            inspect_zip(self.path)

    def test_no_skill_and_ordinary_zip_comment(self):
        self.archive([('README.md', 'x')])
        with zipfile.ZipFile(self.path, 'a') as z:
            z.comment = b'ordinary comment'
        self.assertIn('ENTRYPOINT_COUNT', self.codes())

    def test_signature_in_comment_is_explicitly_unsupported(self):
        self.archive([('SKILL.md', 'x')])
        with zipfile.ZipFile(self.path, 'a') as z:
            z.comment = b'comment with PK\x05\x06 inside'
        with self.assertRaisesRegex(CannotInspect, 'comments'):
            inspect_zip(self.path)


if __name__ == '__main__':
    unittest.main()
