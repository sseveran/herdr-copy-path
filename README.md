# herdr-copy-path

A [Herdr](https://herdr.dev) desktop app mod: right-click a file name or link
in a terminal to copy its path, file name, contents, or URL.

Agents print files they made all the time (`Wrote src/report.md`), but
getting from that line to the file's path or contents means retyping it or
selecting it by hand. This replaces Herdr's terminal right-click menu with
the same menu plus:

| Under the pointer | Items |
| --- | --- |
| a file (plain path, `path:line:col`, or OSC 8 `file://` link) | Copy path · Copy file name · Copy contents |
| a URL | Copy link · Copy as Markdown (when an OSC 8 link shows a label) |

## Status

Needs `target.link` in the terminal menu's props, proposed in
[herdrdev/herdr-app#1214](https://github.com/herdrdev/herdr-app/issues/1214).
Until a herdr-app release has it, the menu shows only Herdr's own items.

## Install

Ask your agent to add this mod. It follows the steps in Herdr's guide
(`~/.config/herdr-app/AGENTS.md`, "Layouts and mods other people made"):

1. Copy `mods/copy-path/` to `~/.config/herdr-app/mods/copy-path/`.
2. In your layout (clone a shipped one first), set the root's
   `"terminal_menu": "copy-path"`.
3. `herdr-app check ~/.config/herdr-app/mods/copy-path`.

**What it runs:** Copy contents runs `cat -- <path>` (PowerShell
`Get-Content` on local Windows) on the machine the terminal is on. It makes
no network requests.

See [RECIPE.md](RECIPE.md) for the full behavior.

## License

MIT
