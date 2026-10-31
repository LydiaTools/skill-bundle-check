# The ZIP looks clean. Why might an upload still fail?

A ZIP can have one `SKILL.md` and no flagged directory entries while its contents still need attention. The browser ZIP check only reads directory metadata; it does not read the Skill's text or check YAML.

One example: [Prompt Master issue #19](https://github.com/nidhinjs/prompt-master/issues/19) reports a plugin-validation error. We inspected a GitHub source ZIP at commit [`4b39961`](https://github.com/nidhinjs/prompt-master/tree/4b3996117966a3837d9e22ce24cfa744daad3f8b), the latest commit before the report. Our ZIP check found one `SKILL.md` and no structural findings. We then copied that file into a separate `prompt-master` folder and ran the [Agent Skills reference validator](https://github.com/agentskills/agentskills/tree/69ef37e9424c0a7ea9dd2293b559e43ec8176379/skills-ref): it reported an unexpected top-level `version` field. Removing that field in a second test copy passed that reference validator.

**This does not establish the cause of the original report.** We do not know which exact ZIP was uploaded and did not test either copy in the reported application. The example shows why checking ZIP metadata and checking Skill content are separate steps; different platforms may apply different rules.

## What to check next

1. Read the exact error and confirm whether the destination asks for a **Skill** or a **plugin**; their packaging rules can differ.
   Claude's [web and desktop packaging guide](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills) asks for a top-level Skill folder inside the ZIP. For example, `my-skill/SKILL.md` is different from a loose `SKILL.md` at the ZIP root. Claude Code instead uses Skill folders on disk; see its [location guide](https://code.claude.com/docs/en/skills#choose-where-skills-load). These are different workflows.
2. For a Skill folder you trust and control, check the `SKILL.md` frontmatter against the [Agent Skills specification](https://agentskills.io/specification) and the destination's own instructions. The specification lists `name` and `description` as required fields and shows how to put additional metadata inside `metadata`.
3. The [reference validator](https://github.com/agentskills/agentskills/tree/69ef37e9424c0a7ea9dd2293b559e43ec8176379/skills-ref#usage) can check a local folder after installation: `skills-ref validate path/to/skill`. Its maintainers describe it as a demonstration, not a production validator. Its result is not a platform upload test.
4. Make any correction in your own copy, inspect the contents, rebuild the package, and try the destination's upload again. Keep your original files until you are happy with the result.

Skill Bundle Check does not modify ZIPs or Skill content. A clean metadata result is not a security, YAML, content-integrity, or platform-acceptance verdict.

The ZIP checker offers a Claude-specific hint when the sole entrypoint is exactly `SKILL.md` at the ZIP root. It does not validate the rest of the folder layout or upload the file. The v0.14.2 package includes the hint; the fixed v0.14.1 package does not.
