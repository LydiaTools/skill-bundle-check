# When a compiled Skill guide moves its links

A rule can link to a sibling file correctly and still break when a build combines it into a guide in another folder.

In the public [Vercel React Best Practices Skill](https://github.com/vercel-labs/agent-skills/tree/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills/react-best-practices), a [reported issue](https://github.com/vercel-labs/agent-skills/issues/319) describes this exact situation. At commit `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62`, three relative links in the compiled `AGENTS.md` point beside that file; the rule files are in `rules/` instead. The placeholder `area-description.md` in the README describes a naming pattern, so it should not automatically be treated as an existing file.

## What we checked

On macOS, we extracted the Skill at that commit into **two separate local directories** and ran Skill Bundle Check v0.14.4 against them. It returned exit 1 and reported three `LINK_MISSING` entries in each copy, at `AGENTS.md` lines 116, 219 and 892. We then changed only those three link destinations in both temporary copies to point into `rules/`. The same command returned exit 0 with 12 local references checked.

These are two copies of the same repository snapshot, **not a real installation test**. The tool does not establish whether an agent read a particular file or whether every link works. The upstream issue remains subject to the maintainer's decision; [an existing proposed generator fix](https://github.com/vercel-labs/agent-skills/pull/312) is open at the time of this check.

## Reproduce the initial check

Requires Git and Node.js 20+. This creates an isolated temporary directory and does not run the Skill. Repository content is downloaded from its original author.

```sh
CASE_DIR=$(mktemp -d)
git clone https://github.com/vercel-labs/agent-skills.git "$CASE_DIR/upstream"
git -C "$CASE_DIR/upstream" checkout --detach 1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62
git clone https://github.com/LydiaTools/skill-bundle-check.git "$CASE_DIR/checker"
git -C "$CASE_DIR/checker" checkout --detach v0.14.4
cp -R "$CASE_DIR/upstream/skills/react-best-practices" "$CASE_DIR/first"
cp -R "$CASE_DIR/upstream/skills/react-best-practices" "$CASE_DIR/second"
node "$CASE_DIR/checker/src/cli.js" check "$CASE_DIR/first" "$CASE_DIR/second"
```

Exit 1 is expected for this particular snapshot. Inspect the reported paths and their context; not every file-like example is necessarily a real reference. The temporary path is printed by `echo "$CASE_DIR"` if you want to inspect it afterwards.

[中文](case-generated-rule-links.zh-CN.md) · [Back to Skill Bundle Check](../README.md)
