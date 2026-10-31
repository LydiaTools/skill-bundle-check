# A single-Skill installation with missing references

An installer can report success while a Skill's supporting files remain in the source repository. In [addyosmani/agent-skills issue #597](https://github.com/addyosmani/agent-skills/issues/597), a user reported this after installing `code-review-and-quality` by itself. The maintainer confirmed the limitation; a proposed change is being discussed in [PR #621](https://github.com/addyosmani/agent-skills/pull/621).

On 2026-11-01 we reproduced the file layout in a new project directory using source commit [`8bfcc1f`](https://github.com/addyosmani/agent-skills/tree/8bfcc1f9916f2eea55494d8c1fa7f4bde867dd9e) and `skills@1.7.4`, with project scope, the Codex target and `--copy`. The installer reported success. The source repository contained `references/security-checklist.md` and `references/performance-checklist.md`, but neither file existed where the installed Skill's `../../references/` paths resolved.

Skill Bundle Check v0.14.3 reported `LINK_ESCAPES_ROOT` for both references in the source and installed `SKILL.md` files, at lines 353–354. It flags the bundle boundary; the separate file-existence check established the missing installed targets. A nonzero exit is expected. This is a dated, version-specific observation, not a claim about current releases or whether any agent ran the Skill.

## The same sample in other checkers

We also ran two other tools against the installed directory on 2026-11-01:

- [skill-validator v1.8.0](https://github.com/agent-ecosystem/skill-validator/releases/tag/v1.8.0), `validate structure`: passed this installed Skill without reporting the two paths. In a separate fictional control, it reported a missing standard Markdown link but did not report the same path written in backticks.
- [drskill-core v0.8.2](https://github.com/dbreunig/drskill/releases/tag/v0.8.2), `lint`: returned no findings for this installed Skill. This command also did not report the missing path in either fictional control; it did report an unrelated description warning in both.
- Skill Bundle Check v0.14.3 compared each fictional control's source and installed directories, reporting `REFERENCE_MISSING_FROM_INSTALL` for both the Markdown link and the backticked path. In the real sample above, its finding was `LINK_ESCAPES_ROOT`, not a missing-file diagnosis.

These commands serve different scopes: the first two inspect one directory, while `check` compares a source and an installation. This is a small, version-specific experiment, not a general ranking or a claim about other commands and inputs.

## Reproduce in an empty temporary directory

The following downloads the two public repositories and runs the installer against a local source checkout. It installs one Skill into the temporary project's `.agents/skills/`; it does not use global installation. Requires Git, Node.js 20+ and npm. Review third-party code before running it.

```sh
CASE_ROOT=$(mktemp -d)
git clone https://github.com/addyosmani/agent-skills.git "$CASE_ROOT/source"
git -C "$CASE_ROOT/source" checkout --detach 8bfcc1f9916f2eea55494d8c1fa7f4bde867dd9e
git clone https://github.com/LydiaTools/skill-bundle-check.git "$CASE_ROOT/checker"
git -C "$CASE_ROOT/checker" checkout --detach v0.14.3
mkdir "$CASE_ROOT/project"
cd "$CASE_ROOT/project"
npx --yes skills@1.7.4 add "$CASE_ROOT/source" --skill code-review-and-quality --agent codex --yes --copy
node "$CASE_ROOT/checker/src/cli.js" check "$CASE_ROOT/source/skills/code-review-and-quality" "$CASE_ROOT/project/.agents/skills/code-review-and-quality"
```

Inspect the two targets yourself:

```sh
ls "$CASE_ROOT/source/references/security-checklist.md" "$CASE_ROOT/source/references/performance-checklist.md"
ls "$CASE_ROOT/project/.agents/references/security-checklist.md" "$CASE_ROOT/project/.agents/references/performance-checklist.md"
```

The second `ls` is expected to report missing files. The temporary directory remains available at `$CASE_ROOT` for inspection. This example does not modify the upstream project or install a global Skill.
