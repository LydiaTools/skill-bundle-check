# Skill Bundle Check｜Agent Skill 安装包检查器

**仓库里能用，装进 Agent 之后还好吗？**

Skill Bundle Check 提供只读检查。`check` 核对源 Skill 引用的本地文件，在安装器或发行流程生成的目录中是否存在且能够解析；它不逐字节比较文件内容，也不证明安装包完整性。`check-agent` 检查目标 Agent 的官方安装目录里有没有对应的 `SKILL.md`，并报告它是否只出现在另一个共享目录。`snapshot` 和 `compare` 对比指定安装目录中的文件存在状态。

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

需要 Node.js 20 或更高版本。克隆仓库需要联网；文件下载到本机后，运行检查无需额外依赖、账号或网络。

```bash
git clone https://github.com/LydiaTools/skill-bundle-check.git
cd skill-bundle-check
node src/cli.js check ./examples/source ./examples/installed
```

体验多 Agent 更新前后检查：运行 `node examples/update-demo.js`。它只使用临时目录里的虚构文件。

再运行故意漏文件的安装样例，看看工具如何提示。该命令按预期返回退出码 `1`：

```bash
node src/cli.js check ./examples/source ./examples/installed-missing
```

```text
REFERENCE_MISSING_FROM_INSTALL  installed/SKILL.md:8  Referenced file is missing: references/setup.md

FAIL  2 local references checked
source: 2 Markdown files · installed: 1 Markdown files
```

检查真实安装目录或构建产物：

```bash
node src/cli.js check ./skills/my-skill ~/.agents/skills/my-skill
```

第一个路径是包含 `SKILL.md` 的源目录；第二个路径是安装器或发行流程实际生成的目录。命令仅读取文件，不执行安装脚本或 Skill 代码。

源目录或安装目录可以是指向独立目录的符号链接。检查器会先解析实际目录，再检查包内引用是否越出该目录。在隔离测试中，`skills@1.7.4` 把同一个合成 Skill 同时安装给 Claude Code 和 Cursor 时，为 Claude Code 创建了符号链接；v0.3.0 拒绝这个路径，v0.4.0 能检查它。这不代表所有安装器或平台都会使用符号链接。

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

从 v0.4.0 起，Codex 全局检查同时查看 `~/.agents/skills` 和 `$CODEX_HOME/skills`（默认 `~/.codex/skills`），并列出找到的目录。可设置进程的 `CODEX_HOME`，也可用 `--codex-home /路径/到/codex-home` 指定；使用 `--home` 检查隔离样例时，默认 Codex 目录是该 home 下的 `.codex`。隔离环境中的原生 Codex app-server `skills/list` 测试在两个用户目录各发现了一个合成 Skill。文件存在仍不证明你正在使用的 Agent 已加载该 Skill；不同版本或配置可能不同。

使用仓库内的合成样例复现安装目录不匹配：

```bash
node src/cli.js check-agent --agent antigravity-cli --skill probe-skill --scope global --home ./examples/agent-paths
```

此命令会按预期以退出码 1 结束，并报告 `probe-skill` 只在共享 `.agents/skills` 目录，没有出现在 Antigravity CLI 文档中的全局目录。不会启动 Agent。

## 试一次虚构的更新

无需安装 Agent Skill，即可体验更新前后检查：

```bash
node examples/update-demo.js
```

示例在新建临时目录中创建两份虚构 Skill，移除其中一份来模拟更新，再调用真实命令。它输出 `claude: found -> found` 和 `codex: found -> missing`；比较命令返回退出码 1；示例正常完成时自身返回 0。运行结束后会清理该临时目录，不会改动你已安装的 Skill。

## 更新前后检查多个 Agent 的 Skill

同一个 Skill 在更新后可能仍在一个 Agent 的目录，却从另一个目录消失。[Spec Kit #5002](https://github.com/github/spec-kit/issues/5002) 报告了一种 Claude/Codex 配置，已有[修复提案](https://github.com/github/spec-kit/pull/5005)。下面只检查文件，不证明 Agent 已加载 Skill。

在本仓库中运行，更新前后使用相同的 Skill 名和目录：

```bash
node src/cli.js snapshot speckit-git-feature \
  claude=/path/to/project/.claude/skills codex=/path/to/project/.agents/skills > before.json
# 正常更新你的项目后，再运行相同检查：
node src/cli.js snapshot speckit-git-feature \
  claude=/path/to/project/.claude/skills codex=/path/to/project/.agents/skills > after.json
node src/cli.js compare before.json after.json
```

结果区分存在、缺失、断链、不是文件及无法访问。快照中存在缺失、断链或非文件时退出码为 1；比较以更新后的快照为准。任一快照中的无法访问、输入无效或目标不一致时为 2。缺失时仍输出 JSON；需要继续比较时不要用 `&&` 串接。一次隔离的 macOS 复现中，Spec Kit v0.12.4 为 Claude 和 Codex 安装 `speckit-git-feature`；用 v1.2.1 升级两套集成后，将 git 扩展从 1.0.0 更新至 1.0.1，比较结果为 Claude `found → found`、Codex `found → missing`（退出码 1）。这只是指定版本和场景的观察，不代表当前版本或运行时表现。

JSON 内含绝对路径，分享前请检查。多个名称可能指向同一物理目录，不能据此认定存在独立副本。检查不会备份、恢复或阻止删除，也不比较文件内容或证明运行时发现。

## GitHub Actions

先运行你自己的打包或安装步骤，再检查产物：

```yaml
steps:
  - uses: actions/checkout@v4
  - name: Build skill bundle
    run: ./scripts/build-skill.sh
  - uses: LydiaTools/skill-bundle-check@v0.5.1
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
