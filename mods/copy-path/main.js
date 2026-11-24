// Copy path: Herdr's terminal right-click menu, plus copy actions for the
// file or link under the pointer. Set the layout root's
// `"terminal_menu": "copy-path"` to use it.
//
// props() = { tab: "pane", target: { pane, terminal, link }, overlay }.
// `target.link` (herdr-app with herdrdev/herdr-app#1214) is the URL or file
// under the pointer, or null: { kind: "url", raw, url, text } or
// { kind: "file", raw, path, line?, column?, text }. Without it this is
// Herdr's own menu.
//
// ↑/↓ move, Enter runs, Esc closes.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, props, closeOverlay, theme, keys, terminals, panes, exec, notify, window } from "herdr";

// Bigger than this isn't something to paste.
const MAX_CONTENTS = 1024 * 1024;

const icon = (name) => `mods/workspace-chrome/${name}.svg`;

// A remote terminal's address is `<machine>/<id>`.
function machineOf(address) {
  const slash = address?.lastIndexOf("/") ?? -1;
  return slash > 0 ? address.slice(0, slash) : null;
}

// The file's absolute path. A remote terminal's file isn't on this computer,
// so Herdr gives no `path`: join what was printed onto the terminal's folder.
function fullPath(link, term) {
  if (link.path) return link.path;
  // A `file:` URL naming a file that isn't here: its path, as written.
  if (/^file:/i.test(link.raw)) {
    try {
      return decodeURIComponent(new URL(link.raw).pathname);
    } catch {
      return link.raw;
    }
  }
  const spelled = link.line ? link.raw.replace(/:\d+(:\d+)?\.?$/, "") : link.raw;
  if (spelled.startsWith("/") || !term?.cwd) return spelled;
  return `${term.cwd.replace(/\/$/, "")}/${spelled.replace(/^\.\//, "")}`;
}

function copied(title, body) {
  notify({ title, body, level: "success", timeout: 2500 });
}

async function copyContents(path, machine, cx) {
  const local = !machine;
  const res =
    local && window()?.platform === "windows"
      ? await exec("powershell", ["-NoProfile", "-Command", "Get-Content -Raw -LiteralPath $args[0]", path])
      : await exec("cat", ["--", path], { on: machine, timeout: 10000 });
  if (res.code !== 0) {
    notify({ title: "Couldn't read the file", body: res.stderr.trim() || path, level: "error" });
    return;
  }
  if (res.stdout.includes("\u0000")) {
    notify({ title: "Not copied", body: `${path} isn't text.`, level: "warning" });
    return;
  }
  if (res.stdout.length > MAX_CONTENTS) {
    notify({ title: "Not copied", body: `${path} is over 1 MiB.`, level: "warning" });
    return;
  }
  cx.write_to_clipboard(res.stdout);
  copied("Copied file contents", path);
}

// Items for the link under the pointer: { label, icon, act(cx) }.
function linkItems(link, term) {
  if (!link) return [];
  if (link.kind === "url") {
    const items = [
      { label: "Copy link", icon: icon("files"), act: (cx) => { cx.write_to_clipboard(link.url); copied("Copied link", link.url); } },
    ];
    if (link.text && link.text !== link.url)
      items.push({
        label: "Copy as Markdown",
        icon: icon("file-text"),
        act: (cx) => { const md = `[${link.text}](${link.url})`; cx.write_to_clipboard(md); copied("Copied Markdown link", md); },
      });
    return items;
  }
  const machine = machineOf(term?.address);
  const path = fullPath(link, term);
  const name = path.split(/[\\/]/).pop();
  return [
    { label: "Copy path", icon: icon("files"), act: (cx) => { cx.write_to_clipboard(path); copied("Copied path", path); } },
    { label: "Copy file name", icon: icon("files"), act: (cx) => { cx.write_to_clipboard(name); copied("Copied file name", name); } },
    { label: "Copy contents", icon: icon("file-text"), act: (cx) => copyContents(path, machine, cx) },
  ];
}

// Herdr's own pane items (as in the shipped `menu` mod), as { label, icon, command, args }.
function paneItems(tg) {
  const all = terminals();
  const term = all.find((t) => t.address === tg.terminal);
  const parent = term?.parent && all.find((t) => t.address === term.parent);
  const toProgram = term?.labels?.["herdr.right-click"] === "program";
  // A terminal shown outside a tab has no pane to split, zoom or close.
  const inTab = panes().some((pane) => pane.pane === tg.pane);
  const item = (label, name, command, args) => ({ label, icon: icon(name), command, args });
  return [
    ...(inTab
      ? [
          item("Rename", "square-pen", "pane.rename", { pane: tg.pane }),
          item("Split right", "panel-right", "pane.split", { direction: "right", pane: tg.pane }),
          item("Split down", "panel-bottom", "pane.split", { direction: "down", pane: tg.pane }),
          item("Zoom", "square", "pane.zoom", { pane: tg.pane }),
        ]
      : []),
    ...(term
      ? [
          toProgram
            ? item("Use Herdr right-click menu", "terminal", "terminal.right_click", { terminal: term.address, to: "menu" })
            : item("Send right-clicks to pane", "terminal", "terminal.right_click", { terminal: term.address, to: "program" }),
        ]
      : []),
    ...(parent ? [item(`Send back to ${parent.name || parent.address}`, "terminal", "terminal.park", { terminal: term.address })] : []),
    ...(inTab ? [item("Close pane", "x", "pane.close", { pane: tg.pane })] : []),
  ];
}

function items() {
  const tg = props()?.target ?? {};
  const term = terminals().find((t) => t.address === tg.terminal);
  const copy = linkItems(tg.link, term);
  const pane = paneItems(tg);
  // A line between the link's items and the pane's.
  if (copy.length && pane.length) pane[0] = { ...pane[0], rule: true };
  return [...copy, ...pane];
}

// The key bound to a command, for the hint on the right.
function shortcut(it) {
  if (!it.command) return "";
  const value = it.args && Object.values(it.args)[0];
  const k = keys().find((b) => b.section === "global" && (b.action === it.command || b.action === `${it.command}:${value}`));
  return k ? k.keys : "";
}

export default class CopyPathMenu extends View {
  init(_props, cx) {
    this.at = 0;
    this.handle = cx.focus_handle();
    this.handle.focus();
  }

  choose(i, cx) {
    const it = items()[i];
    if (!it) return;
    const overlay = props()?.overlay;
    if (!it.act) {
      closeOverlay(overlay);
      run(it.command, it.args);
      return;
    }
    // Close once the copy is done: closing first would end this view's task.
    cx.spawn(async (cx) => {
      try {
        await it.act(cx);
      } catch (e) {
        notify({ title: "Couldn't copy", body: String(e?.message ?? e), level: "error" });
      } finally {
        closeOverlay(overlay);
      }
    });
  }

  render(cx) {
    const t = theme();
    const list = items();
    return v_flex()
      .id("copy-path-menu")
      .track_focus(this.handle)
      .w_full()
      .min_h(0)
      .p(5)
      .bg(t.popover)
      .text_size(12.8)
      .on_key_down((e, cx) => {
        if (e.key === "down") this.at = (this.at + 1) % list.length;
        else if (e.key === "up") this.at = (this.at + list.length - 1) % list.length;
        else if (e.key === "enter") this.choose(this.at, cx);
        else if (e.key === "escape") closeOverlay(props().overlay);
        else return;
        cx.notify();
      })
      .children(
        list.map((it, i) =>
          v_flex()
            .when(i > 0 && (it.rule || it.command === "pane.close"), (el) => el.child(div().mx(7).my(4).h(1).bg(t.border)))
            .child(
              h_flex()
                .id(`cp-${i}`)
                .h(31)
                .px(8)
                .gap(9)
                .rounded(7)
                .items_center()
                .justify_between()
                .text_color(t.foreground)
                .when(i === this.at, (el) => el.bg(t.selected))
                .hover((s) => s.bg(t.hover))
                .on_click((_e, cx) => this.choose(i, cx))
                .child(svg(it.icon).size(14).flex_none().text_color(t.muted))
                .child(div().flex_1().child(it.label))
                .child(div().text_size(11).text_color(t.dim).child(shortcut(it))),
            ),
        ),
      );
  }
}
