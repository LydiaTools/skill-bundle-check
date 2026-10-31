# ZIP 看起来正常，为什么还是上传失败？

一个 ZIP 即使只有一个 `SKILL.md`，目录结构也没有被标记，里面的内容仍可能需要检查。浏览器 ZIP 检查只读取目录信息，不读取 Skill 正文，也不检查 YAML。

例如，[Prompt Master 的 Issue #19](https://github.com/nidhinjs/prompt-master/issues/19) 报告了插件校验失败。我们检查了报告前最近一次提交 [`4b39961`](https://github.com/nidhinjs/prompt-master/tree/4b3996117966a3837d9e22ce24cfa744daad3f8b) 对应的 GitHub 源码 ZIP：结构检查显示一个 `SKILL.md`，没有结构提示。随后，我们把该文件复制到独立的 `prompt-master` 文件夹，用 [Agent Skills 参考校验器](https://github.com/agentskills/agentskills/tree/69ef37e9424c0a7ea9dd2293b559e43ec8176379/skills-ref) 检查，发现它提示顶层 `version` 字段不在允许列表内。在另一份测试副本中去掉该字段后，参考校验器通过。

**这不能证明原帖上传失败的原因。** 我们不知道对方当时上传的 ZIP 是否就是这份，也没有把测试副本上传到对方使用的平台。这个例子说明：检查 ZIP 结构和检查 Skill 内容是两步，不同平台的规则也可能不同。

## 接下来可以检查什么

1. 先看完整错误信息，确认目标要求上传的是 **Skill** 还是**插件**，两者的打包规则可能不同。
   Claude 的[网页和桌面版打包说明](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills)要求 ZIP 内有一个顶层 Skill 文件夹。例如 `my-skill/SKILL.md` 与压缩包根目录直接放 `SKILL.md` 是两种结构。Claude Code 则使用磁盘上的 Skill 文件夹，见其[位置说明](https://code.claude.com/docs/en/skills#choose-where-skills-load)。两者的安装流程不同。
2. 对于你信任并能自行修改的 Skill 文件夹，按照 [Agent Skills 规范](https://agentskills.io/specification)和目标平台的说明检查 `SKILL.md` 的 YAML 前置字段。规范要求 `name` 和 `description`，也展示了如何把额外信息放在 `metadata` 中。
3. 安装 [参考校验器](https://github.com/agentskills/agentskills/tree/69ef37e9424c0a7ea9dd2293b559e43ec8176379/skills-ref#usage) 后，可运行 `skills-ref validate path/to/skill` 检查本地文件夹。维护者将它定位为演示用途，不是生产校验器；结果也不能代替实际上传。
4. 在自己的副本中修改、检查内容并重新打包，再到目标平台尝试。确认满意之前保留原文件。

Skill Bundle Check 不会修改 ZIP 或 Skill 内容。结构检查没有提示，不代表安全、YAML 正确、内容完整或平台一定接受。

ZIP 检查在唯一入口恰好是压缩包根目录的 `SKILL.md` 时，会显示 Claude 专用提示；它不验证其余文件夹结构，也不会上传文件。v0.14.2 下载包已包含此提示，固定的 v0.14.1 包不包含。
