# Copy path

Herdr's terminal right-click menu, plus copy actions for the file or link
under the pointer. Right-click a file name an agent printed and choose
**Copy path**, **Copy file name** or **Copy contents**. On a URL, choose
**Copy link**, or **Copy as Markdown** for an OSC 8 link with a label
(`[label](url)`).

<!-- ![Copy path](preview.png) -->

**Needs:** a herdr-app with `target.link` in the terminal menu's props
(herdrdev/herdr-app#1214, proposed in herdrdev/herdr-app#1393). On an older app the menu has only Herdr's own
items.

**What you see:** a pointer popup, 240 px wide, styled like Herdr's shipped
`menu`: `popover` background, 31 px rows with an icon, label and key hint,
`selected` on the keyboard row and `hover` under the pointer. When the
pointer was over a file, three rows come first (Copy path, Copy file name,
Copy contents); over a URL, Copy link and, if it shows a label, Copy as
Markdown. A line separates them from Herdr's own pane items: Rename, Split
right, Split down, Zoom, the right-click routing toggle, Send back to the
parent (kept sub-agents), and Close pane after another line.

**How it behaves:**

- It is a `terminal_menu` mod: the layout root's
  `"terminal_menu": "copy-path"` makes it open on every terminal
  right-click (Shift+right-click too) in place of the shipped `menu`.
- Items come from `props().target`: `pane`, `terminal` and `link`. Every
  action uses those, never the focused terminal.
- Copy path writes `link.path`. A remote terminal's file has no `path`: the
  printed name (without a `:line:column` suffix) is joined onto that
  terminal's `cwd`.
- Copy contents reads the file with `exec("cat", ["--", path])`, `on` the
  terminal's machine for a remote one, or PowerShell `Get-Content -Raw` on
  local Windows. It refuses files over 1 MiB or with NUL bytes and says so in
  a notification.
- Each copy shows a short success notification; failures show an error one.
- ↑/↓ move, Enter runs, Esc closes. The menu closes after the copy is done.
- Pane items mirror the shipped `menu` mod's pane case; refresh them when
  Herdr's change.

**Reaches:** runs `cat` (or PowerShell) to read the file you chose, on the
machine the terminal runs on. No network, no other files.
