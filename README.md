# Skill Bundle Check

**Your skill works in the repo. Does it still work after installation?**

Skill Bundle Check compares a source Agent Skill with the exact folder produced by your installer or release build. It checks that Markdown references still resolve inside the installed bundle and that referenced files were not left behind.

This focuses on the handoff between source and installed files. It does not run the skill or judge what an agent does with it.

## Why this exists

People have reported Agent Skills whose `SKILL.md` works in the repository but breaks after installation: supporting files are omitted, relative links point outside the copied folder, or conversion changes the path base. See reports in [Agent-Reach](https://github.com/Panniantong/Agent-Reach/issues/622), [Hallmark](https://github.com/Nutlope/hallmark/issues/76), [Tastemaker](https://github.com/codeswithroh/tastemaker/issues/86), and [Microsoft APM](https://github.com/microsoft/apm/issues/2966).

Existing structure and security checks are useful before publishing. This tool adds one narrow check: compare the skill folder you intend to ship with the copy users will actually install.

## Quick start

Use Node.js 20 or later. No dependencies, account, or network access are needed.

```bash
git clone https://github.com/LydiaTools/skill-bundle-check.git
cd skill-bundle-check
node src/cli.js check ./examples/source ./examples/installed
```

Run it against a real installation or build output:

```bash
node src/cli.js check ./skills/my-skill ~/.agents/skills/my-skill
```

The first path is the source skill folder containing `SKILL.md`. The second is the exact installed or packaged folder to verify. The command only reads files; it does not run install scripts or skill code.

The repository includes both a preserved bundle and a deliberately broken installation. The failing fixture demonstrates the exact check:

```text
$ node src/cli.js check ./examples/source ./examples/installed-missing
REFERENCE_MISSING_FROM_INSTALL  installed/SKILL.md:8  Referenced file is missing: references/setup.md

FAIL  2 local references checked
source: 2 Markdown files · installed: 1 Markdown files
```

## GitHub Actions

Run your normal packaging/install step first, then check its output:

```yaml
steps:
  - uses: actions/checkout@v4
  - name: Build skill bundle
    run: ./scripts/build-skill.sh
  - uses: LydiaTools/skill-bundle-check@v0.1.1
    with:
      source: ./skills/my-skill
      installed: ./dist/my-skill
```

Findings become inline GitHub annotations. For a local JSON report:

```bash
node src/cli.js check ./skills/my-skill ./dist/my-skill --format json
```

## What it checks

- `SKILL.md` exists in both folders.
- Local links in Markdown and HTML references point to files or directories that exist in the source.
- Referenced files remain present at the same relative paths in the installed bundle.
- Relative links in the installed copy resolve inside that bundle.
- Absolute paths, missing files, broken symlinks, and links that escape the bundle root are reported with file and line.

It reads Markdown links, reference-style link definitions, HTML `href`/`src`, and conventional `assets/`, `references/`, or `scripts/` paths written in inline code. It does not parse every Markdown extension or execute examples.

## Examples

The fixture models a package with a supporting file preserved:

```text
examples/
├── source/
│   ├── SKILL.md
│   └── references/setup.md
├── installed/
│   ├── SKILL.md
│   └── references/setup.md
└── installed-missing/
    └── SKILL.md
```

If `references/setup.md` is omitted from `installed/`, the check fails and reports the source line that still points to it.

## Development

```bash
npm test
```

## License

MIT. Source code is original to this repository; the cited issues are examples of reported problems, not endorsements.
