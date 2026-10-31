# 单个 Skill 安装成功，引用文件却没有带上

安装器显示成功，不代表 Skill 依赖的文件都在安装目录里。[addyosmani/agent-skills 的 Issue #597](https://github.com/addyosmani/agent-skills/issues/597) 中，一位用户单独安装 `code-review-and-quality` 后遇到了这个问题。维护者确认了这一限制；[PR #621](https://github.com/addyosmani/agent-skills/pull/621) 正在讨论相关修改。

2026-11-01，我们在新建项目目录里，用源码提交 [`8bfcc1f`](https://github.com/addyosmani/agent-skills/tree/8bfcc1f9916f2eea55494d8c1fa7f4bde867dd9e) 和 `skills@1.7.4` 复现了文件布局：安装范围为当前项目，目标为 Codex，采用 `--copy`。安装器显示成功。源仓库中存在 `references/security-checklist.md` 和 `references/performance-checklist.md`，但安装后的 Skill 中 `../../references/` 所指向的位置没有这两个文件。

Skill Bundle Check v0.14.3 在源目录和安装目录的 `SKILL.md` 第 353–354 行分别报告了两个 `LINK_ESCAPES_ROOT`。它提示的是引用越过 Skill 包边界；文件是否存在由另一次文件检查确认。此时退出码为非零是预期结果。这是特定日期和版本的观察，不代表当前版本一定如此，也不代表 Agent 已运行该 Skill。

## 用其他检查器看同一份样本

2026-11-01，我们也让另外两款工具检查同一个安装目录：

- [skill-validator v1.8.0](https://github.com/agent-ecosystem/skill-validator/releases/tag/v1.8.0) 的 `validate structure` 对这份 Skill 返回通过，没有报告这两个路径。在另一个原创虚构对照中，它报告了缺失的标准 Markdown 链接，但没有报告写在反引号中的相同路径。
- [drskill-core v0.8.2](https://github.com/dbreunig/drskill/releases/tag/v0.8.2) 的 `lint` 对这份 Skill 未报告问题。两个虚构对照中的缺失路径也未被报告；它对两个对照都给出了另一条描述文字警告。
- Skill Bundle Check v0.14.3 分别比较两个虚构对照的源目录和安装目录，对 Markdown 链接和反引号路径都报告了 `REFERENCE_MISSING_FROM_INSTALL`。上面的真实样本则报告的是 `LINK_ESCAPES_ROOT`，不能把它说成缺失文件诊断。

这些命令的范围不同：前两者检查单个目录，`check` 比较源码与安装结果。这只是针对特定版本和少量样本的实测，不能代表其他命令或所有输入的表现。

## 在空的临时目录中复现

以下命令下载两个公开仓库，并从本地源码安装。Skill 只安装到临时项目的 `.agents/skills/`，不会使用全局安装。需要 Git、Node.js 20+ 和 npm；运行前请自行审阅第三方代码。

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

也可以直接核对文件：

```sh
ls "$CASE_ROOT/source/references/security-checklist.md" "$CASE_ROOT/source/references/performance-checklist.md"
ls "$CASE_ROOT/project/.agents/references/security-checklist.md" "$CASE_ROOT/project/.agents/references/performance-checklist.md"
```

第二条 `ls` 预计会提示文件不存在。临时目录保留在 `$CASE_ROOT`，方便继续检查；示例不会修改上游项目或安装全局 Skill。
