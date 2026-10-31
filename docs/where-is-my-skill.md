# Where did my Skill go?

You installed a Skill, changed its source, and your agent still seems to use the old version. Start by finding the copy you want to inspect. A file on disk, an agent loading that file, and the agent choosing to use it are three different things.

[中文](where-is-my-skill.zh-CN.md) · [Try folder comparison](https://lydiatools.github.io/skill-bundle-check/web/diff.html)

## 1. List the copies the installer can see

If you installed with the third-party `skills` CLI, open a terminal in the project where you installed it:

```sh
npx skills@1.7.4 list --agent codex --json
npx skills@1.7.4 list --global --agent codex --json
```

The first command lists project-scope entries; the second lists global entries. Inspect the `path` and `scope` fields. Run these from the relevant project; another project can have a different installation. For Claude Code, use `--agent claude-code` instead. An agent-filtered list can include shared entries; in our isolated test an entry appeared with `agents: []`, so check its path rather than inferring agent activation. The CLI may need to be downloaded by `npx`; version 1.7.4 requires Node.js 22.20 or newer. Listing only covers what this installer discovers and does not establish what the agent loaded. See the [installer's command reference](https://github.com/vercel-labs/skills/blob/v1.7.4/docs/commands.md).

Claude Code's own documented locations include a project `.claude/skills/` folder and the personal `~/.claude/skills/` folder; plugins, cloud sessions, organization settings and other install methods can differ. Check [Claude Code's location guide](https://code.claude.com/docs/en/skills#choose-where-skills-load) for your actual environment.

## 2. Compare the source with the installed copy

If you have two folders, use the [browser comparison](https://lydiatools.github.io/skill-bundle-check/web/diff.html): select the source Skill folder and the installed Skill folder, then compare. Each needs `SKILL.md` at its root. The browser may omit hidden files, empty folders and symbolic links, so a match covers only supplied files.

Or, in a terminal, clone this repository and run its read-only comparison (Node.js 20+):

```sh
git clone https://github.com/LydiaTools/skill-bundle-check.git
cd skill-bundle-check
node src/cli.js diff "/path/to/source-skill" "/path/to/installed-skill"
```

Replace both paths with the actual folders. A `CHANGED` file means their bytes differ; `SOURCE-ONLY` and `INSTALLED-ONLY` mean the relative path was found on one side only. Exit 0 means compared files match, 1 means they differ, and 2 means the comparison could not complete. The tool reads both trees but does not modify or run them. It does not determine which copy is correct or which one an agent loaded.

Want to see the result before selecting your own files? Run `node examples/diff-demo.js` from the cloned repository. It creates two fictional files in a temporary directory, compares them and cleans them up.

If a Skill is nested in a plugin, a Skill-only comparison can miss the files around it. See [plugin tree comparison](../README.md#plugin-tree).

## 3. Decide what to update

If the copies differ, first decide which folder is meant to be authoritative and inspect the changes. The installer has [update commands](https://github.com/vercel-labs/skills/blob/v1.7.4/docs/commands.md); updating can change installed files. A source installed from a local path may need different handling from a GitHub source.

We tested this flow on macOS with `skills@1.7.4` in an isolated project: a Skill installed with `--copy` remained at v1 after its local source changed to v2, and the comparison reported the changed `SKILL.md`. In that setup, `skills update --project --yes` reported no project skills to update. This is one version and source type, not a claim about all installers or updates. The example does not verify an agent's runtime behavior.

Questions about where Skills are installed and how to keep copies in sync have also appeared in [Hacker News](https://news.ycombinator.com/item?id=46697908) and [Reddit](https://www.reddit.com/r/ClaudeAI/comments/1pvrvgg/how_i_manage_and_sync_skills_across_my_claude/). Those discussions are context, not a measure of this project's usage.
