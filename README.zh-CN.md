# Skill Bundle Check｜Agent Skill 安装包检查器

**仓库里能用，装进 Agent 之后还好吗？**

Skill Bundle Check 提供两种只读检查。`check` 对比 Skill 源目录和安装器或发行流程生成的实际目录，检查引用文件是否完整；`check-agent` 检查目标 Agent 的官方安装目录里有没有对应的 `SKILL.md`，并报告它是否只出现在另一个共享目录。

它不会运行 Skill、启动 Agent，也不会声称 Agent 已在运行时加载了 Skill。

## 为什么做这个工具

社区里已经出现多种 Skill 安装后引用失效的问题：

- [Agent-Reach](https://github.com/Panniantong/Agent-Reach/issues/622)、[Hallmark](https://github.com/Nutlope/hallmark/issues/76)、[Tastemaker](https://github.com/codeswithroh/tastemaker/issues/86) 和 [Microsoft APM](https://github.com/microsoft/apm/issues/2966) 都报告过安装包漏掉 Skill 引用的文件。
- [Addy Osmani 的 agent-skills #468](https://github.com/addyosmani/agent-skills/issues/468) 报告：即使完整安装插件，共享文件也可能因路径相对目录不对而无法读取；[#597](https://github.com/addyosmani/agent-skills/issues/597) 记录了只安装单个 Skill 时缺少共享文件的问题。
- [OpenAI Codex #8364](https://github.com/openai/codex/issues/8364) 记录了安装后的 Skill 找不到它引用的脚本；维护者将其关联到另一个正在修复的问题。
- [CLI-Anything #331](https://github.com/HKUDS/CLI-Anything/issues/331) 报告安装器只复制 Skill 目录，没有复制它引用的方法文档。
- [Vercel Skills #1851](https://github.com/vercel-labs/skills/issues/1851) 报告全局安装显示成功，但 Skill 被写入共享目录，没有进入 Antigravity CLI 文档所列的全局目录。

格式校验本身未必能发现这类问题。[一份复现记录](https://tinkerhood.com/learn/skill-references-and-assets/) 显示，格式校验通过时，Skill 引用的文件仍可能缺失。本工具直接检查源目录和实际安装目录。

结构检查与安全扫描仍然有用。这个工具只补一个检查环节：对比你准备发布的源 Skill 和用户实际安装到的目录。

## 快速开始

需要 Node.js 20 或更高版本。无额外依赖、无需账号，也不需要联网。

```bash
git clone https://github.com/LydiaTools/skill-bundle-check.git
cd skill-bundle-check
node src/cli.js check ./examples/source ./examples/installed
```

检查真实安装目录或构建产物：

```bash
node src/cli.js check ./skills/my-skill ~/.agents/skills/my-skill
```

第一个路径是包含 `SKILL.md` 的源目录；第二个路径是安装器或发行流程实际生成的目录。命令仅读取文件，不执行安装脚本或 Skill 代码。

检查 Agent 的全局安装目录里是否有某个 Skill：

```bash
node src/cli.js check-agent --agent claude-code --skill my-skill --scope global
node src/cli.js check-agent --agent codex-cli --skill my-skill --scope global
node src/cli.js check-agent --agent antigravity-cli --skill my-skill --scope global
node src/cli.js check-agent --agent antigravity-ide --skill my-skill --scope global
```

检查仓库里的项目级 Skill 时，把 `--scope` 设为 `project`：

```bash
node src/cli.js check-agent --agent claude-code --skill my-skill --scope project
node src/cli.js check-agent --agent codex-cli --skill my-skill --scope project
```

检查其他 Agent 时，直接传入它文档中的 Skills 根目录：

```bash
node src/cli.js check-agent --root ./custom-agent/skills --skill my-skill --scope global
```

目前内置了 `claude-code`、`codex-cli`、`antigravity-cli`、`antigravity-ide` 和 `antigravity-app` 路径，映射依据分别链接到 [Claude Code Skills 文档](https://code.claude.com/docs/en/skills)、[Codex Skills 文档](https://developers.openai.com/codex/skills/) 和 [Antigravity Skills 文档](https://www.antigravity.google/docs/skills)。项目级检查以当前工作目录代表的项目目录为准。目标目录缺少 Skill 时返回退出码 1；如果 Skill 只在 `~/.agents/skills`，报告会同时显示预期路径与实际找到的路径。Antigravity IDE 文档支持的旧路径也会识别。检查文件落点不等于确认 Agent 已在运行时加载或执行 Skill。

使用仓库内的合成样例复现安装目录不匹配：

```bash
node src/cli.js check-agent --agent antigravity-cli --skill probe-skill --scope global --home ./examples/agent-paths
```

此命令会按预期以退出码 1 结束，并报告 `probe-skill` 只在共享 `.agents/skills` 目录，没有出现在 Antigravity CLI 文档中的全局目录。不会启动 Agent。

仓库同时提供完整安装样例和故意漏文件的安装样例：

```text
$ node src/cli.js check ./examples/source ./examples/installed-missing
REFERENCE_MISSING_FROM_INSTALL  installed/SKILL.md:8  Referenced file is missing: references/setup.md

FAIL  2 local references checked
source: 2 Markdown files · installed: 1 Markdown files
```

## GitHub Actions

先运行你自己的打包或安装步骤，再检查产物：

```yaml
steps:
  - uses: actions/checkout@v4
  - name: Build skill bundle
    run: ./scripts/build-skill.sh
  - uses: LydiaTools/skill-bundle-check@v0.3.0
    with:
      source: ./skills/my-skill
      installed: ./dist/my-skill
```

发现的问题会显示为 GitHub 行内注释。也可以生成本地 JSON 报告：

```bash
node src/cli.js check ./skills/my-skill ./dist/my-skill --format json
```

## 检查内容

- 源目录和安装目录都包含 `SKILL.md`。
- Markdown 和 HTML 中的本地链接在源目录内能找到目标。
- 被引用的文件在安装包的相同相对路径中保留。
- 安装目录中的相对链接仍在包内且可访问。
- 报告绝对路径、缺失文件、失效符号链接和越出包目录的链接，并标出文件与行号。

支持 Markdown 行内链接、引用式链接定义、HTML `href`/`src`，以及行内代码中常见的 `assets/`、`references/`、`scripts/` 路径。它不会解析所有 Markdown 扩展，也不会执行示例代码。

`check-agent` 检查选定 Skill 的 `SKILL.md` 是否在所选 Agent 的文档路径中。内置路径会附带对应平台文档；自定义根目录按传入路径原样检查。

## 示例

示例目录展示了一个引用文件随 Skill 一起安装的情况：

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

`installed-missing/` 演示安装包漏掉 `references/setup.md` 时的真实失败输出。

## 开发

```bash
npm test
```

## 许可

MIT。代码为本仓库原创；引用的问题记录只是公开问题示例，不代表相关项目维护者背书。
