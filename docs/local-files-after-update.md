# Check the files you added before updating a Skill

You install a Skill, add a note beside `SKILL.md`, and update it later. Is the note still there?

[GitHub CLI issue #14647](https://github.com/cli/cli/issues/14647) reports that `gh skill update` can replace an installed Skill directory, including files added locally. In one isolated macOS test, `gh` **2.95.0** installed `cli/cli`'s `gh` Skill at release **v2.103.3** in a temporary directory. After we added a fictional `LOCAL-NOTES.md`, `gh skill update gh --force --all` removed that file. The help in that tested CLI said extra local files would remain. This is a version-specific observation; check the issue and your own version for current behavior.

## Keep a copy outside the installed directory

Before updating, copy the Skill folder to a new location you control. Replace the first path with your actual installed Skill folder:

```sh
skill_dir="$HOME/.agents/skills/my-skill"
backup_dir="$(mktemp -d)"
cp -R "$skill_dir" "$backup_dir/before"
printf 'Backup: %s\n' "$backup_dir/before"
```

Check that the copy contains the files you need, and keep it somewhere appropriate for their contents. It is separate from the Skill's installation directory, so an update to that installation does not target the copy. This is not an encrypted backup and does not select which files are safe to share.

After your normal update, compare the backup with the installed folder from a checkout of Skill Bundle Check:

```sh
node src/cli.js diff "$backup_dir/before" "$skill_dir"
```

In our isolated test, the result included:

```text
SOURCE-ONLY  "LOCAL-NOTES.md"
1 file(s) differ; source 2, installed 1.
```

`SOURCE-ONLY` means the file was present in the first folder and absent from the second when compared. The command does not prevent an update, recover files, decide which version to keep, or prove that the agent loaded a Skill. Inspect differences before copying anything back. Both roots must have `SKILL.md`; internal symlinks or special files are refused, and other [comparison limits](../README.md#compare-two-copies-after-an-update) apply.

Prefer a browser? [Compare two selected folders](https://lydiatools.github.io/skill-bundle-check/web/diff.html) locally. Browser folder selection may omit hidden files, empty folders and symbolic links, so it is not a complete backup or filesystem audit.
