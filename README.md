# Skill Bundle Check

**Your skill works in the repo. Does it still work after installation?**

[Compare Skill folders online](https://lydiatools.github.io/skill-bundle-check/web/diff.html) · [Review Markdown tables](https://lydiatools.github.io/skill-bundle-check/web/) · [中文说明](README.zh-CN.md)

Using a Skill inside a plugin? [Check the surrounding plugin files](#plugin-tree).

Not sure where a Skill was installed or whether its copy changed? [Follow the practical checklist](docs/where-is-my-skill.md).

Skill Bundle Check provides read-only checks. `check` verifies that local references from a source Agent Skill are present and resolve in the folder produced by your installer or release build. It does not compare file contents or attest package integrity. `check-agent` looks for `SKILL.md` in a supported agent's documented install directory and reports when the file exists only in a different shared root. `snapshot` and `compare` show presence changes across explicitly selected installation roots. `diff` compares two Skill folders; `diff-tree` compares larger selected directory trees, including plugin files outside a Skill folder. `review-pipes` points out certain Markdown table escapes; `review-shell` highlights selected script paths in shell examples. Both provide hints for human review.

It does not run the skill, start the agent, or claim that the agent loaded it at runtime.

## Why this exists

People have reported Agent Skills whose `SKILL.md` points to files that are missing or unreachable after installation. This shows up in different forms:

- [Agent-Reach](https://github.com/Panniantong/Agent-Reach/issues/622), [Hallmark](https://github.com/Nutlope/hallmark/issues/76), and [Tastemaker](https://github.com/codeswithroh/tastemaker/issues/86) report installations or conversions that leave referenced resources unavailable.
- [Addy Osmani's agent-skills #468](https://github.com/addyosmani/agent-skills/issues/468) reported shared references that did not resolve even in a full plugin install; [#469](https://github.com/addyosmani/agent-skills/pull/469) fixed those links. [#597](https://github.com/addyosmani/agent-skills/issues/597) reports a separate single-skill installation case.
- [OpenAI Codex #8364](https://github.com/openai/codex/issues/8364) reports an agent sometimes failing to find a referenced script; the maintainer linked it to a separate issue. The report does not establish that the installed script itself was missing.
- [CLI-Anything #331](https://github.com/HKUDS/CLI-Anything/issues/331) reports an installer that copies the skill but leaves its referenced methodology files behind.
- [Vercel Skills #1851](https://github.com/vercel-labs/skills/issues/1851) reports a successful global install that places a Skill in a shared directory instead of Antigravity CLI's documented global directory.

Format validation alone may not catch these failures. A [reproduction report](https://tinkerhood.com/learn/skill-references-and-assets/) shows a skill-reference check passing while the referenced file is missing. This tool checks the actual source and installed folders instead.

Related but outside this check: [Microsoft APM #2966](https://github.com/microsoft/apm/issues/2966) reports a resource that **was installed**, while a generated Codex agent TOML file retained a link relative to its old location. `check` reads Markdown in Skill folders; it does not inspect generated agent TOML or prove how an agent resolves it.

Existing structure and security checks are useful before publishing. This tool adds one narrow check: compare the skill folder you intend to ship with the copy users will actually install.

## Quick start

Try the [folder comparison](https://lydiatools.github.io/skill-bundle-check/web/diff.html) or [table-escape review](https://lydiatools.github.io/skill-bundle-check/web/) in your browser without installing Node.

Use Node.js 20 or later. Cloning the repository requires network access; once the files are on your machine, the checks need no dependencies, account, or network access.

```bash
git clone https://github.com/LydiaTools/skill-bundle-check.git
cd skill-bundle-check
node src/cli.js check ./examples/source ./examples/installed
```

To see the multi-agent update comparison, run `node examples/update-demo.js`. To try a changed installed copy, run `node examples/diff-demo.js`. It uses fictional files in a temporary directory.

The included broken installation shows what a missing reference looks like. Run this command; exit code `1` is expected:

```bash
node src/cli.js check ./examples/source ./examples/installed-missing
```

```text
REFERENCE_MISSING_FROM_INSTALL  installed/SKILL.md:8  Referenced file is missing: references/setup.md

FAIL  2 local references checked
source: 2 Markdown files · installed: 1 Markdown files
```

Run it against a real installation or build output:

```bash
node src/cli.js check ./skills/my-skill ~/.agents/skills/my-skill
```

The first path is the source skill folder containing `SKILL.md`. The second is the exact installed or packaged folder to verify. The command only reads files; it does not run install scripts or skill code.

The source or installed folder may be a symbolic link to a separate directory. The checker resolves the folder before comparing; references inside the bundle are still checked for escaping its resolved root. In an isolated test, `skills@1.7.4` created a Claude Code symlink when installing the same synthetic Skill for Claude Code and Cursor; v0.3.0 rejected that installed path, while v0.4.0 checks it. This does not establish that every installer or platform uses symlinks.

Check whether an agent has a Skill at its documented global path:

```bash
node src/cli.js check-agent --agent claude-code --skill my-skill --scope global
node src/cli.js check-agent --agent codex-cli --skill my-skill --scope global
node src/cli.js check-agent --agent antigravity-cli --skill my-skill --scope global
node src/cli.js check-agent --agent antigravity-ide --skill my-skill --scope global
```

For a repository-local Skill, use `--scope project`:

```bash
node src/cli.js check-agent --agent claude-code --skill my-skill --scope project
node src/cli.js check-agent --agent codex-cli --skill my-skill --scope project
```

For another agent, pass its documented Skills root directly:

```bash
node src/cli.js check-agent --root ./custom-agent/skills --skill my-skill --scope global
```

Built-in profiles cover `claude-code`, `codex-cli`, `antigravity-cli`, `antigravity-ide`, and `antigravity-app`. Profile paths link to the platform documentation used for the mapping: [Claude Code Skills](https://code.claude.com/docs/en/skills), [Codex Skills](https://developers.openai.com/codex/skills/), and [Antigravity Skills](https://www.antigravity.google/docs/skills). Project scope checks the project directory represented by the current working directory. A missing Skill returns exit code 1. If the Skill is found in `~/.agents/skills` but not in the selected global root, the report shows both paths. A documented legacy Antigravity IDE path is also recognized. This checks file placement; it does not confirm runtime discovery or execution.

If an expected path contains a broken symbolic link, `check-agent` also shows the broken link. A [Codex report](https://github.com/openai/codex/issues/11314) was traced to a relative link pointing at the wrong location; this check diagnoses file paths, not agent loading.

From v0.4.0, Codex global checks look in both `~/.agents/skills` and `$CODEX_HOME/skills` (default `~/.codex/skills`) and report every matching root. Set `CODEX_HOME` for the process, or use `--codex-home /path/to/codex-home`; when using `--home` for a fixture, the default Codex home is `.codex` under that home. An isolated native Codex app-server `skills/list` test found separate synthetic Skills in both user roots. File presence alone still does not prove that your running agent loaded a particular Skill; versions and configuration may differ.

Reproduce an install-path mismatch with the included synthetic fixture:

```bash
node src/cli.js check-agent --agent antigravity-cli --skill probe-skill --scope global --home ./examples/agent-paths
```

The command intentionally exits with code 1 and reports that `probe-skill` exists under the shared `.agents/skills` root, not Antigravity CLI's documented global root. No agent is launched.

## Try a fictional update

See the before/after check without installing an Agent Skill:

```bash
node examples/update-demo.js
```

The demo creates two fictional Skill folders in a new temporary directory, removes one to simulate an update, and runs the real CLI. It prints `claude: found -> found` and `codex: found -> missing`; the comparison returns exit 1, while the successfully completed demo itself returns exit 0. The demo then removes its temporary directory. It does not touch your installed Skills.

## Review a command hidden inside a table

[Try table escape review online](https://lydiatools.github.io/skill-bundle-check/web/) · [中文](https://lydiatools.github.io/skill-bundle-check/web/?lang=zh)

![Actual online table review with fictional Markdown and two review hints](docs/assets/pipe-review-web.png)

The page checks pasted or selected Markdown in your browser, without executing it. The web page only covers this table-escape review; installation and bundle checks remain in the CLI.

A table can show a pipe while the raw Skill file contains a backslash before it. Is the backslash part of the intended command? That depends on the shell and regex syntax. [GitHub documents table escaping](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-tables); [leanrea #1](https://github.com/aicodeking/leanrea/issues/1) reports one real case where copied commands behaved differently.

```bash
node src/cli.js review-pipes examples/table-pipes.md
node src/cli.js review-pipes /path/to/SKILL.md --format json
```

The fictional example gives two **review hints**, including a deliberately literal extended-regex pipe. Results name the file and 1-based line and UTF-16 column of the backslash. Hints exit 0; unreadable files or invalid input exit 2. This approximate scan covers inline code on ordinary single-line pipe-table rows; it is not a full Markdown or shell parser and can miss or over-report cases. Output stops at 1,000 hints and explicitly reports truncation when more exist. An escape can be correct (for example GNU basic-regex alternation), and a clean scan does not prove commands work. It never runs, interprets or changes a command. Check each result in context; a fenced code block outside a table can make commands easier to inspect in raw and rendered views.

## Review script paths in shell examples

An audit can look in the wrong directory and report a missing script that is actually present. A [HashiCorp issue](https://github.com/hashicorp/agent-skills/issues/56) was later identified in its comments as such a false positive. In the repository snapshot we checked, the referenced script existed relative to the skill folder. The current `main` may differ.

The regular `check` deliberately skips fenced code. Use this separate, non-blocking review to compare selected `./scripts/` command paths in the **source root SKILL.md** against both folder roots:

```bash
node src/cli.js review-shell ./examples/shell-source ./examples/shell-installed
node src/cli.js review-shell ./skills/my-skill ~/.agents/skills/my-skill --format json
```

The included fictional example reports `source-root=file` and `installed-root=missing`. These are root-relative file observations, **not a verdict that the command is broken**: the instructions may intend a different working directory. The scan recognizes direct commands and `sh`, `bash`, `zsh`, `python`, `python3` or `node` invocations on simple `./scripts/` paths in labeled shell fences only. It does not parse shell, inspect other Markdown files, run the command, establish file integrity, or prove agent execution. It can miss or over-report candidates; at most 1,000 hints are returned, with truncation flagged. Hints exit 0; invalid or unreadable input exits 2. Verify the intended working directory and command before drawing a conclusion.

## Compare installations before and after an update

An update can leave a Skill present for one agent and missing for another. The open [Spec Kit report #5002](https://github.com/github/spec-kit/issues/5002) describes this in one Claude/Codex configuration; [a proposed fix](https://github.com/github/spec-kit/pull/5005) is under review. The check below observes files, not whether an agent actually loads them.

From this repository, choose the same skill and explicitly named roots each time:

```bash
node src/cli.js snapshot speckit-git-feature \
  claude=/path/to/project/.claude/skills codex=/path/to/project/.agents/skills > before.json
# Perform your normal update in the project, then run the same check:
node src/cli.js snapshot speckit-git-feature \
  claude=/path/to/project/.claude/skills codex=/path/to/project/.agents/skills > after.json
node src/cli.js compare before.json after.json
```

JSON reports `found`, `missing`, `broken-link`, `not-file`, or `unavailable`. Snapshot exits 1 when a target is missing, broken or not a file; compare exits 1 when any target is missing, broken or not a file in the after snapshot. An unavailable target in either comparison snapshot, invalid input, or mismatched target sets exits 2. A snapshot containing any missing target still writes JSON and exits 1, so do not chain it with `&&` if you need the comparison. In one isolated macOS reproduction, Spec Kit v0.12.4 installed `speckit-git-feature` for Claude and Codex. After upgrading both integrations with v1.2.1 and updating the git extension from 1.0.0 to 1.0.1, the comparison showed Claude `found → found` and Codex `found → missing` (exit 1). This is one version-specific observation, not a claim about current versions or agent runtime.

Root paths in the JSON are absolute and may contain personal information; review them before sharing. Two names may point to the same physical directory; they are not proof of independent copies. The tool reads presence at the time of each check and does not back up, restore, prevent deletion, compare contents or establish agent discovery.

## Compare two copies after an update

[Compare browser-provided folder files](https://lydiatools.github.io/skill-bundle-check/web/diff.html) without installing Node. Files stay in the tab. Folder selection support depends on the browser; hidden files, empty folders and symbolic links may be omitted, so a match does not verify full filesystem contents or Agent loading. The page cannot establish whether two selections refer to distinct filesystem directories.

![Browser comparison of two explicitly fictional Skill folders, showing one changed file](docs/assets/skill-diff-web.png)

*The built-in example uses fictional files.*

You update a skill in its source folder. Is the copy your agent can access still the same? Compare the two folders you select:

```bash
node src/cli.js diff ./skills/my-skill ~/.agents/skills/my-skill
```

For example, in an isolated test with `skills@1.7.4`, a local skill installed with `--copy` stayed at v1 after its source changed to v2. The installer reported that local sources could not be checked automatically and suggested re-adding it. `diff` identified the changed `SKILL.md`. This is one tested setup; behavior depends on installer version and mode. [Original local-update report](https://github.com/vercel-labs/skills/issues/1440).

This read-only command lists differing relative paths and whether each was added, removed or changed. Add `--format json` to include SHA-256 values for CI. Exit 0 means the compared file bytes matched; 1 means differences; 2 means the check could not complete. It does not output file contents, select the authoritative copy, determine what the agent loaded, or update either folder. This is a snapshot: do not edit the trees during comparison. Empty directory-only changes are not compared.

Both roots must be separate, non-overlapping existing directories with a regular `SKILL.md` at each root. Inner symbolic links and special files are refused; a root itself may resolve through a symlink. The scan stops rather than report a partial match above 2,000 entries, 8 MiB per file or 64 MiB total per directory. This is not an atomic security boundary against concurrent hostile filesystem changes. Check actual installed paths and output before sharing.

<a id="plugin-tree"></a>
## When a Skill is part of a plugin

The Skill file can match while the plugin around it is missing. In [Vercel Skills #2609](https://github.com/vercel-labs/skills/issues/2609), a user reports an installation that copies a nested Skill without the enclosing Claude Code plugin metadata and hooks. In our isolated macOS test with `skills@1.7.4` and a fictional plugin, comparing just the nested Skill returned a match; comparing the selected plugin source with the installed Skill revealed the missing relative paths.

Try a fictional version of that comparison:

```bash
node src/cli.js diff-tree ./examples/plugin-source ./examples/plugin-installed
```

The example reports `.claude-plugin/plugin.json` and `hooks/hooks.json` as source-only, along with paths that differ because the Skill was moved; exit 1 is expected. For your own package, select the actual source plugin root and the actual installed folder you want to compare. Both directories must exist; the source must contain at least one regular file. Relative paths must have the same layout for a byte-for-byte match; an intentional reorganization also appears as differences. `diff-tree` uses the same read limits and exit codes as `diff`, but does not require `SKILL.md` at either root. It compares files, not empty directories, and does not prove plugin loading, hook execution or that a chosen path is correct.

## GitHub Actions

Run your normal packaging/install step first, then check its output:

```yaml
steps:
  - uses: actions/checkout@v4
  - name: Build skill bundle
    run: ./scripts/build-skill.sh
  - uses: LydiaTools/skill-bundle-check@v0.9.0
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

`check-agent` checks for the selected Skill's `SKILL.md` at the chosen documented root. Built-in paths link to the platform documentation used for that mapping; custom roots are checked exactly as supplied.

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
