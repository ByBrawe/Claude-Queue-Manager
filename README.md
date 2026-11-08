# Claude Queue Manager (QM)

A free, MIT-licensed **Claude Code mod** for **Claude Desktop > Code** and Claude Code CLI.
Open a queue panel with `/qm`, add up to 200 tasks at once, and run them as **separate turns, one after another**. Unlike sending a bunch of native `Ctrl+Enter` messages, QM intentionally submits only the next pending task after the current main turn completes.

**Requires:** Claude Code 2.1.287+ (Desktop Code tab 2.1.286+). Not for the regular Claude Chat tab, remote cloud sessions or Desktop WSL sessions.

## Documentation · 20 languages / 20 dil

[Choose language / Dil seç](docs/languages/README.md) — [English](https://github.com/ByBrawe/Claude-Queue-Manager/blob/main/docs/en/README.md) · [Türkçe](https://github.com/ByBrawe/Claude-Queue-Manager/blob/main/docs/tr/README.md). Commands such as `/qm repeat` stay in English; task text can be in any language.

## Install from GitHub (recommended)

Run in a Claude Code terminal or in the local Code tab's slash-command prompt:

```text
/plugin marketplace add ByBrawe/Claude-Queue-Manager
/plugin install qm@claude-queue-manager
```

Restart the Code session or run `/reload-plugins`, then type `/qm`.
If you already use a different queue mod, disable it to avoid competing queue managers.

## Install from the downloadable ZIP

1. Extract `Claude-Queue-Manager.zip` to a stable folder (do not rename/move it after installation).
2. From a terminal, run:

```sh
claude plugin marketplace add /absolute/path/to/Claude-Queue-Manager
claude plugin install qm@claude-queue-manager
```

3. Restart the local Claude Desktop **Code** session. The archive contains the marketplace manifest and plugin sources, not a standalone app. No API key or npm install is needed.

## Interactive UI / TUI (v0.3.0)

Type `/qm` in Claude Desktop **Code** or Claude Code CLI for the native queue panel. No Node.js is needed for the native panel. It includes a live queue, search, batching, repeat entry, language selection, a small task history and pause/resume.

**New in v0.3.0: native multi-select.** Use the `[ ]` selection control beside each pending task; choose a whole page, move the group to the front/back, or remove selected tasks after confirmation. Only pending tasks may change. The native pane does not support drag-and-drop.

### Optional local browser dashboard with drag-and-drop

From a **local Desktop Code / CLI** session, run:

```text
/qm pause
/qm batch Fix tests || Run build || Update README
/qm web
```

`/qm web` starts a **local-only Node.js server**, opens the browser where possible and copies a private dashboard URL to the clipboard. Requires **Node.js 20+ on your PATH** for the optional web mode. The normal `/qm` panel works without Node.js. The dashboard runs at `127.0.0.1` and does not contact an outside service.

- Drag the handle `⠿` to reorder pending tasks. If several are selected, drag any selected row to move them together, preserving their relative order.
- Check multiple tasks to **Move to top**, **Move to bottom** or **Delete selected** (with confirmation).
- Search the pending queue; clear the search filter before drag-and-drop to avoid ambiguous ordering.
- Add several tasks in the right-hand composer. Queue state updates about once per second.
- Browser and native panel share **the same current Claude Code session queue**. They are **not** independent queues; the mod validates every browser edit before applying it.
- Switch browser labels between **English / Türkçe**. All 20-language usage guides remain available on GitHub.
- Run `/qm web stop` to close the local dashboard; the server also stops after approximately 5 minutes without contact from its Claude Code session.

**Privacy and conflicts:** The browser API requires a random per-session token carried in the URL fragment and is bound to loopback only; do not share this private URL. No queued prompt is injected into Claude's active turn. An edit racing with a state change is rejected instead of silently changing the wrong task. Browser mode is an **optional beta feature** and has not been verified inside a real Claude Desktop installation. Test with two short harmless tasks first.

## Commands

| Command | What it does |
| --- | --- |
| `/qm` or `/qm list` | Opens the queue manager panel |
| `/qm add Run tests` | Adds one task |
| `/qm repeat 100 devam et` | Adds 100 separate identical tasks (max 200 per call) |
| `/qm batch Run lint || Fix tests || Update README` | Adds tasks in specified order (max 200) |
| `/qm pause` / `/qm resume` | Pauses after the current task / resumes |
| `/qm lang tr` / `/qm lang en` | Switches the panel between Turkish and English |
| `/qm web` | Opens the optional local drag-and-drop browser dashboard |
| `/qm web stop` | Shuts down the current local browser dashboard |
| `/qm front Run tests first` | Places a task at the front |
| `/qm mv 3 1` | Moves pending task #3 to position #1 |
| `/qm edit 2 New wording` | Edits task #2 before execution |
| `/qm rm 2` | Removes pending task #2 |
| `/qm undo` | Undo the last edit to pending queue |
| `/qm clear` | Clears pending tasks, not the running one |
| `/qm recover` | Puts an in-flight item back at the front after a host crash (then pauses) |
| `/qm help` | Command reference |

The native panel includes a multi-line input: paste one task per line or separate tasks with `||`. It shows 12 tasks per page. Multi-select is native; drag-and-drop is in `/qm web`.

## Example: create a batch safely

```text
/qm pause
/qm batch Fix test errors || Run all tests || Summarize results
/qm
/qm resume
```

On every successfully completed main turn, QM submits exactly **one** next prompt as a new user message. No queued prompt is injected into the active turn. On `Esc` or an API failure, the active task is returned to pending and the queue pauses. An item already started cannot be edited or removed via the pending list.

## Design and safety

- Authoritative queue state is stored in Claude Code's local `$.store`, keyed by session ID. The optional Node.js dashboard mirrors snapshots over `http://127.0.0.1` only; it does not create another queue or contact the internet.
- Pending tasks are not sent to the model until dispatched as a new user turn. Command arguments are stripped from the model-readable slash-command transcript. The browser dashboard link is not echoed with its secret token in the command result.
- The pending queue is capped at 500 items, with 200 per add/batch. Each actual task can consume model usage and context. Repeated prompts are **not** free.
- QM does not replace or change Claude's built-in `Ctrl+Enter` queue. Use `/qm` commands for strict serial execution.
- Host errors or interruption pause the queue. `/qm recover` is for an orphaned in-flight task after a host crash; confirm the task has not already been completed before replaying it.
- A normal Claude answer that describes a blocker still counts as a completed turn. QM cannot automatically judge semantic success.
- Optional web mode requires local Node.js 20+ and uses mod `$.process.run` and `$.http.fetch`; review the source before installing. The browser can edit only pending tasks and sends changes through the mod for validation. Mod support and UI may change in new Claude Code releases; test with two small tasks before large batches.
- Built from scratch using Anthropic's public Claude Code Mods API, inspired by the idea of OpenCode Queue Manager and After by midudev. No code from either project is required at runtime.

## Development

```sh
npm run verify
claude plugin validate ./plugins/qm
claude plugin validate .
claude --plugin-dir ./plugins/qm
```

Tests cover parser, FIFO dispatch, interruption, transcript redaction, multi-select, stable-ID reorder, local web API security, and browser-to-mod queue synchronization. Unit tests do **not** replace a real Desktop integration test.

## License

[MIT](LICENSE) - Copyright (c) 2026 ByBrawe.
