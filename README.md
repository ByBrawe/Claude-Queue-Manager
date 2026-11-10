# Claude Queue Manager (QM)

A free, MIT-licensed **Claude Code mod** for **Claude Desktop > Code** and Claude Code CLI.
Open a queue panel with `/qm`, add up to 200 tasks at once, and run them as **separate turns, one after another**. Unlike sending a bunch of native `Ctrl+Enter` messages, QM intentionally submits only the next pending task after the current main turn completes.

**Recommended:** Claude Code 2.1.290+ with Mods support (verify compatibility on your installed host). Not for the regular Claude Chat tab, remote cloud sessions or Desktop WSL sessions.

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

## Desktop slash-command workaround (v0.4.1)

Claude Desktop has a [known issue with commands dynamically registered by mods](https://github.com/anthropics/claude-code/issues/99691): `/qm` may show **"isn't a command here"** even when the plugin is installed. **QM v0.4.1 registers `/qm` at the very start of `session.start`**, exposes registration failures via a visible toast and log, and **always renders a small `QM` button above the Code prompt**, including when the queue is empty. Click this button to open the real queue panel **without asking Claude/the model**. The button requires the mod to load and the host to render the `AbovePrompt` surface; it cannot fix a mod that the Desktop app never loaded.

**Quick check:** In a new **local Code** session, look just above the composer for the `QM` button. If visible, click it. If the button appears but `/qm` still warns, that is probably Desktop's command-discovery bug, not a missing queue. If **neither** appears, check that the plugin is enabled and run `claude plugin test` / `claude plugin validate ./plugins/qm` in a compatible Claude Code CLI. Try a new session or `/reload-plugins` after updating. Normal Chat tabs and remote sessions are not supported. There is no way for QM to force the Desktop composer to recognize a dynamic slash command.

Source comparisons: [After](https://github.com/midudev/better-claude/blob/main/plugins/after/hooks/register.tsx) and [Porthole](https://github.com/modmyclaude/claude-code-mods/blob/main/mods/porthole/hooks/register.tsx) register commands immediately, while [Kit](https://github.com/effectustasi/kit/blob/main/hooks/register.tsx) offers a persistent above-prompt surface. Static markdown skills with the same name do **not** route to a mod's `command.run` hook, as reported in the linked Desktop issue.

## Reliability & automation (v0.4.0)

**New:** optional completion verification, bounded retries and soft timeouts, live context guard, conditional tasks, explicit session recovery, and local outcome analytics. **Existing /qm UI/TUI and drag-and-drop /qm web are preserved.** Default settings leave the old simple FIFO behavior unchanged.

**Detailed guides:** [English v0.4 features](docs/en/FEATURES-0.4.md) · [Türkçe v0.4 özellikler](docs/tr/FEATURES-0.4.md) · [All languages](docs/languages/README.md)

```text
/qm pause
/qm verify marker       # off (default), marker, or ai haiku (extra model call)
/qm retry 2 5s          # up to 2 extra attempts after failed verification
/qm timeout 10m         # soft timeout; only evaluated after a turn ends
/qm context 85          # pause before the next dispatch at 85% real context usage
/qm onfail continue     # opt-in to failure branch automation
/qm add Run all tests and fix failures
/qm if success Write release notes
/qm if failure Investigate the test failure
/qm resume
/qm history 20
/qm stats
```

**Verification is not independent testing.** Marker verification is model self-report; AI verification evaluates the assistant's last answer with an additional model call (extra usage), and may return `unknown`. It cannot prove code changes or test results. An `unknown` outcome pauses without re-running potentially successful work. Retries can duplicate side effects; use care with deploys and transactions.

**Recovery:** `/qm sessions` lists saved queues; `/qm restore SESSION_ID` transfers only a paused queue into an empty session. `/qm restore SESSION_ID recover` is an explicit acknowledgement that the old in-flight task might execute twice. Source and target should not be active simultaneously. `/qm recover` restores an in-flight task to the same session without auto-starting it.

**Context:** `/qm context` reads the host's `$.session.usage()` context field. If unavailable it is reported as unknown; QM does not manufacture token measurements. An automatic context guard does not compact or clear your session. `/qm timeout` never force-aborts an active task; it classifies a completed turn by elapsed time.

### v0.4 commands

| Command | Meaning |
| --- | --- |
| `/qm verify off\|marker\|ai [haiku]` | Choose completion check (AI is opt-in, extra tokens) |
| `/qm retry 2 5s` | At most two additional attempts, with 5 second delay |
| `/qm retry last` | Manually requeue the most recent failed/unknown task |
| `/qm timeout 10m\|off` | Soft limit applied after the turn ends |
| `/qm context 85\|off` | Read usage, optionally pause next task at threshold |
| `/qm if success <task>` | Execute only after the last executed task succeeded |
| `/qm if failure <task>` | Execute only after the last executed task failed |
| `/qm onfail pause\|continue` | Stop on failure by default or permit recovery branches |
| `/qm sessions` | List local saved queues |
| `/qm restore SESSION_ID [recover]` | Transfer paused queue; explicit in-flight acknowledgement |
| `/qm history [1-50]` | Recent task results and durations |
| `/qm stats` | Aggregate counts, average duration and last context reading |
| `/qm settings` | Show current automation settings |

## Interactive UI / TUI (v0.3.0, enhanced in v0.4.0)

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
| `/qm batch Run lint \|\| Fix tests \|\| Update README` | Adds tasks in specified order (max 200) |
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

Tests cover parser, FIFO dispatch, interruption, transcript redaction, multi-select, stable-ID reorder, local web API security, browser-to-mod synchronization, v0.3 state migration, conditional branches, retries, soft timeouts, context guards, AI/marker verification, session restore, and history analytics. Unit tests do **not** replace a real Desktop integration test.

## License

[MIT](LICENSE) - Copyright (c) 2026 ByBrawe.
