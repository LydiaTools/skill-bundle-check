# Skill Bundle Check｜Agent Skill 安装包检查器

**仓库里能用，装进 Agent 之后还好吗？**

Skill Bundle Check 对比 Skill 源目录与安装器或发行流程生成的实际目录，检查 Markdown 引用的文件是否仍在包内、路径是否有效。

它检查源文件到安装文件的交接，不会运行 Skill，也不会判断 Agent 实际执行效果。

## 为什么做这个工具

社区里有人遇到过这样的情况：仓库里的 `SKILL.md` 看起来正常，安装后却丢了 `references/`、`scripts/` 或图片；相对链接仍指向仓库外部；转换到另一个 Agent 后链接基准目录变了。可查看 [Agent-Reach](https://github.com/Panniantong/Agent-Reach/issues/622)、[Hallmark](https://github.com/Nutlope/hallmark/issues/76)、[Tastemaker](https://github.com/codeswithroh/tastemaker/issues/86) 和 [Microsoft APM](https://github.com/microsoft/apm/issues/2966) 的问题记录。

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
  - uses: LydiaTools/skill-bundle-check@v0.1.1
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
