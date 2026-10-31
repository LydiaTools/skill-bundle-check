# 我的 Skill 装到哪里了？

装好了 Skill，也改了源文件，Agent 却似乎还在用旧版？先找到实际要检查的副本。文件存在、Agent 加载了它、Agent 选择使用它，是三件不同的事。

[English](where-is-my-skill.md) · [在线对比文件夹](https://lydiatools.github.io/skill-bundle-check/web/diff.html?lang=zh)

## 1. 找出安装器能看到的副本

如果你用第三方 `skills` CLI 安装，请在安装时使用的项目目录打开终端：

```sh
npx skills@1.7.4 list --agent codex --json
npx skills@1.7.4 list --global --agent codex --json
```

第一条列项目级条目，第二条列全局条目；重点看 `path` 和 `scope`。换个项目，看到的项目级安装可能不同。检查 Claude Code 时，把 `--agent codex` 换成 `--agent claude-code`。按 Agent 筛选的结果也可能包含共享条目；我们的隔离测试出现过 `agents: []` 的条目，所以应核对路径，不要据此推断 Agent 已启用。`npx` 首次可能需要下载安装 CLI；1.7.4 需要 Node.js 22.20 或更高版本。列表只覆盖该安装器能发现的内容，不代表 Agent 已加载。参见[安装器命令说明](https://github.com/vercel-labs/skills/blob/v1.7.4/docs/commands.md)。

Claude Code 官方列出的常见位置包括项目中的 `.claude/skills/` 和个人目录 `~/.claude/skills/`；插件、云端会话、组织设置或其他安装方式可能不同。请按[官方位置说明](https://code.claude.com/docs/en/skills#choose-where-skills-load)核对自己的环境。

## 2. 对比源文件夹和已安装副本

如果已经找到两个目录，打开[在线对比](https://lydiatools.github.io/skill-bundle-check/web/diff.html?lang=zh)，分别选择源 Skill 和安装后的 Skill 文件夹。两者根目录都需要 `SKILL.md`。浏览器可能不提供隐藏文件、空目录和符号链接，因此结果只覆盖它实际提供的文件。

也可以在终端克隆本仓库并使用只读对比（Node.js 20+）：

```sh
git clone https://github.com/LydiaTools/skill-bundle-check.git
cd skill-bundle-check
node src/cli.js diff "/path/to/source-skill" "/path/to/installed-skill"
```

把两个路径换成自己的实际文件夹。`CHANGED` 表示文件字节不同；`SOURCE-ONLY` 和 `INSTALLED-ONLY` 表示该相对路径只存在于其中一侧。退出码 0 表示已比较文件一致，1 表示有差异，2 表示检查未完成。工具读取但不修改或运行文件，也不能判断哪个版本正确或 Agent 实际加载了哪个。

想先看结果？在克隆的仓库里运行 `node examples/diff-demo.js`。它只在临时目录创建两个虚构文件，完成比较后清理。

Skill 如果嵌在插件里，只对比 Skill 可能漏掉外层文件；参见[插件目录对比](../README.zh-CN.md#plugin-tree)。

## 3. 决定是否更新

如果发现差异，先确认哪个文件夹才是你要保留的版本，再检查变化。安装器提供[更新命令](https://github.com/vercel-labs/skills/blob/v1.7.4/docs/commands.md)，更新可能改变已安装文件；本地路径来源和 GitHub 来源的处理方式也可能不同。

我们在 macOS 的隔离项目里用 `skills@1.7.4` 实测：通过 `--copy` 安装 v1 后，将本地源文件改为 v2，安装副本仍是 v1；对比工具报告 `SKILL.md` 不同。在这组条件下，`skills update --project --yes` 显示没有可更新的项目 Skill。这只是一个版本和来源类型的测试，不代表所有安装器或更新方式，也没有验证 Agent 的运行时行为。

[Hacker News](https://news.ycombinator.com/item?id=46697908) 和 [Reddit](https://www.reddit.com/r/ClaudeAI/comments/1pvrvgg/how_i_manage_and_sync_skills_across_my_claude/) 上也有人讨论安装位置和多处副本同步；这些讨论只是背景，不代表本项目已有用户。
