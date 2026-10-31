# 更新 Skill 前，先留住自己添加的文件

安装一个 Skill 后，你在 `SKILL.md` 旁边加了笔记。后来更新 Skill，这份笔记还在吗？

[GitHub CLI 的 Issue #14647](https://github.com/cli/cli/issues/14647) 报告了 `gh skill update` 可能替换整个安装目录，也包括用户自己加的文件。一次隔离的 macOS 测试中，我们使用 `gh` **2.95.0**，把 `cli/cli` 的 `gh` Skill **v2.103.3** 安装到临时目录，加入一份虚构的 `LOCAL-NOTES.md`，再执行 `gh skill update gh --force --all`，这份文件被移除了。测试版本的帮助文字则说额外文件会保留。这只是特定版本下的观察；当前情况请查看 Issue 和你使用的版本。

## 在安装目录之外留一份副本

更新前，把 Skill 文件夹复制到一个新的位置。以下第一行请换成你实际安装的 Skill 路径：

```sh
skill_dir="$HOME/.agents/skills/my-skill"
backup_dir="$(mktemp -d)"
cp -R "$skill_dir" "$backup_dir/before"
printf '备份位置：%s\n' "$backup_dir/before"
```

检查副本里是否包含需要的文件，并根据内容妥善保管。副本在 Skill 安装目录之外，更新该安装目录时不会以它为目标。这不是加密备份，也不会自动筛选适合分享的内容。

正常更新后，在 Skill Bundle Check 源码目录运行比较：

```sh
node src/cli.js diff "$backup_dir/before" "$skill_dir"
```

我们那次隔离测试的结果包括：

```text
SOURCE-ONLY  "LOCAL-NOTES.md"
1 file(s) differ; source 2, installed 1.
```

`SOURCE-ONLY` 表示比较时文件存在于第一个文件夹、第二个文件夹里没有。工具不会阻止更新、恢复文件、替你决定保留哪个版本，也不能证明 Agent 已加载 Skill。复制回去之前，请先检查差异。两个根目录都需要有 `SKILL.md`；内部符号链接和特殊文件会被拒绝，其他[比较限制](../README.zh-CN.md)同样适用。

也可以在[浏览器中选择两个文件夹比较](https://lydiatools.github.io/skill-bundle-check/web/diff.html?lang=zh)，文件留在本地。浏览器选择文件夹可能遗漏隐藏文件、空文件夹和符号链接，不能把它当完整备份或文件系统检查。
