# 合并后的 Skill 文档，为什么链接会失效？

一条规则指向同目录文件的链接，在原位置没有问题；当构建工具把规则合并到上一级目录的说明文档中，同样的相对路径就可能找不到目标。

在公开的 [Vercel React Best Practices Skill](https://github.com/vercel-labs/agent-skills/tree/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills/react-best-practices) 中，[已有报告](https://github.com/vercel-labs/agent-skills/issues/319)描述了这个情况。固定提交 `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62` 的汇总 `AGENTS.md` 中，三处链接指向同级目录，而规则文件实际在 `rules/` 目录。README 里的 `area-description.md` 则是命名示意，不应直接当成仓库中应该存在的文件。

## 我们怎么检查的

在 macOS 上，我们将该固定版本的 Skill 提取成**两个独立本地目录**，用 Skill Bundle Check v0.14.4 检查。结果退出码为 1：两份副本各有三条 `LINK_MISSING`，位置均在 `AGENTS.md` 的第 116、219 和 892 行。随后只在两份临时副本中把这三处地址改为指向 `rules/`，再次检查退出码为 0，共检查了 12 处本地引用。

这只是同一仓库快照的两份副本，**不是实际安装测试**；工具也不能证明 Agent 读过哪个文件，或所有链接都正确。上游已有[生成器修复提案](https://github.com/vercel-labs/agent-skills/pull/312)，检查时仍在等待维护者处理。

## 自己复现

需要 Git 和 Node.js 20+。以下命令创建临时目录，从原作者仓库下载内容，不运行该 Skill：

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

此固定版本出现退出码 1 是预期结果。请结合上下文检查路径：像文件名的示例不一定是真实引用。需要查看临时目录时运行 `echo "$CASE_DIR"`。

[English](case-generated-rule-links.md) · [返回项目](../README.zh-CN.md)
