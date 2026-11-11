# Claude Queue Manager (QM)

Queue tasks in **Claude Desktop → Code** or **Claude Code CLI** and run them as separate turns, one at a time. Manage the same session queue from the native panel, terminal or local web dashboard.

[MIT license](LICENSE) · [Changelog](CHANGELOG.md) · [Türkçe rehber](docs/tr/README.md)

## Choose your language

Documentation and interface controls are available in 20 languages. Select a guide below; change the interface language from the panel header or with `/qm lang <code>`.

| | | | |
| --- | --- | --- | --- |
| [English](docs/en/README.md) | [Türkçe](docs/tr/README.md) | [Deutsch](docs/de/README.md) | [Français](docs/fr/README.md) |
| [Español](docs/es/README.md) | [Italiano](docs/it/README.md) | [Português (Brasil)](docs/pt-BR/README.md) | [Русский](docs/ru/README.md) |
| [Українська](docs/uk/README.md) | [Polski](docs/pl/README.md) | [Nederlands](docs/nl/README.md) | [Svenska](docs/sv/README.md) |
| [日本語](docs/ja/README.md) | [한국어](docs/ko/README.md) | [简体中文](docs/zh-CN/README.md) | [العربية](docs/ar/README.md) |
| [हिन्दी](docs/hi/README.md) | [Bahasa Indonesia](docs/id/README.md) | [Tiếng Việt](docs/vi/README.md) | [فارسی](docs/fa/README.md) |

[Language codes and settings](docs/languages/README.md). Commands remain in English; task text can be in any language. Changing the interface language does not translate tasks. Community-language guides may describe an earlier UI; this README describes the current behavior.

## Features

- **One task per turn:** pending prompts wait for the current main turn to finish.
- **Native panel above the prompt:** task entry, repeat count/message, pause/resume, undo and pending-task controls appear together. An optional side panel is also available.
- **Queue editing:** search, edit, move, select multiple tasks and confirm deletion. Running tasks are separate from pending work.
- **Local web dashboard:** drag pending tasks by their handles, move selected groups and add batches or repetitions. Native and browser views use the same session queue.
- **Claude queue tool:** ask Claude to create a task list, inspect it, reorder pending items or pause/resume processing.
- **Optional automation:** completion checks, bounded retries, soft timeouts, context thresholds and conditional tasks.
- **Recovery and history:** inspect saved sessions, recover orphaned tasks, transfer paused queues and view outcomes.
- **20 interface languages:** native/CLI language selection and a separate browser preference; Arabic and Persian use RTL layout on the web.

## Requirements

Use a local Claude Code host with **Mods API support**. The plugin targets the Desktop **Code** tab and Claude Code CLI, not the ordinary Chat tab. Remote/cloud and Desktop WSL sessions are not supported.

The native queue does not require Node.js. The optional web dashboard and cross-session restore require **Node.js 20+** on PATH. QM uses the host's existing model connection and does not change Gateway/API configuration.

## Install

Run in Claude Code:

```text
/plugin marketplace add ByBrawe/Claude-Queue-Manager
/plugin install qm@claude-queue-manager
```

Start a new local Code session or run `/reload-plugins`, then `/qm`. Disable other queue mods to avoid competing dispatchers.

To update an existing installation, run these commands in a terminal:

```sh
claude plugin marketplace update claude-queue-manager
claude plugin update qm@claude-queue-manager
```

Reload plugins in each open session or restart the host after the current task finishes.

### Install from a ZIP

Extract the repository ZIP to a stable folder and register its root directory:

```sh
claude plugin marketplace add /absolute/path/to/Claude-Queue-Manager
claude plugin install qm@claude-queue-manager
```

The root must contain `.claude-plugin/marketplace.json` and `plugins/qm`. The archive is plugin source, not a standalone application. No additional API key or npm install is needed to use the native queue.

## Quick start

Pause first to review the queue before starting:

```text
/qm pause
/qm batch Inspect the project || Fix failing tests || Run the build || Summarize changes
/qm
/qm resume
```

Adding while Claude is idle and the queue is not paused can start the first task immediately. **Pause** stops the next dispatch; it lets the current turn finish. On interruption or a host/API error, in-flight work is returned to pending and the queue pauses.

### Repeat a message 5 or 20 times

In the native panel, enter **Count**, enter the message, then choose **Repeat**. The equivalent commands are:

```text
/qm repeat 5 Continue with the next unfinished item
/qm repeat 20 Run the next step of the agreed plan
```

Each repetition is a separate task. `continue` is ordinary message text, not a special command. Repeated tasks consume model usage and share the session context.

## Native panel and CLI

`/qm`, `/qm inline` or the summary bar's **Expand** opens the full workspace above the prompt. Task entry, repeat fields, pending rows and primary controls stay visible; **Details** opens editable advanced settings, context, history and session information.

- **Side panel** opens the separate native pane; the host controls its placement and dimensions.
- **Web** opens the browser dashboard. It does not expand the native panel.
- **Close** hides the manager. A summary bar remains while there is pending or running work; an empty queue has no permanent strip.
- Pending rows paginate **4 per page above the prompt** and **12 per page in the side panel**.
- Green indicates running work; yellow indicates a paused queue. Text labels also identify the state.
- Use Tab/Shift+Tab and Enter for controls. The `p` pause/resume and `q` close shortcuts apply while the mod surface has focus, not while typing a regular prompt.

## Local web dashboard

```text
/qm web
```

QM starts a loopback-only server at `127.0.0.1`, attempts to open the browser and copies a private URL when clipboard access is available. Calling `/qm web` again reopens the existing dashboard, or restarts a stale server. `/qm web stop` shuts it down.

Drag handles reorder **pending tasks only**. Multi-select supports group movement and confirmed deletion. Clear the search filter before drag-and-drop. Connection errors preserve drafts and trigger reconnection; success is shown only after the mod acknowledges a change. Concurrent stale edits are rejected rather than applied to the wrong task.

The URL contains a per-session access token. Keep it private. The dashboard mirrors the current Claude session; it does not create an independent queue or contact an external dashboard service.

## Advanced settings

Open **Details** in the native/CLI panel or **Advanced settings** in the web dashboard. All existing queue settings can be edited without typing commands:

| Setting | Accepted values |
| --- | --- |
| Verification | Off, Marker or AI |
| AI verifier model | Existing model alias/name, used only for AI verification |
| Retries | 0–5 additional attempts |
| Retry delay | 0–600 seconds |
| Soft timeout | 0–86,400 seconds; 0 disables it |
| Context threshold | 0–99%; 0 disables it |
| On failure | Pause or continue |

Choose **Save settings** to validate and persist the entire form together. **Reload saved settings** discards the draft and loads the current saved values. Errors keep the draft; concurrent native/web/CLI changes are rejected rather than overwritten. Saving does not resume the queue. Pause and wait for a running queue task to finish before saving; the UI refuses changes while that task is active.

**Requeue last failed task** adds the latest failed, timed-out or unknown task at the front and leaves the queue paused for review. Retries apply to failed verification or soft timeout; API errors and interruptions pause the queue. AI verification adds a model call, and soft timeouts are evaluated after a turn ends. These settings do not change Gateway/API configuration.

## Let Claude manage its own task list

The mod registers **`mcp__qm__queue`**. For example, ask Claude:

> Create a queue to inspect this project, fix the failures, run tests and summarize. Pause it so I can review the list before it starts.

The tool supports `list`, `add`, `reorder`, `remove`, `pause` and `resume`. It uses the same queue as the native and web interfaces. Reordering requires every pending ID exactly once; running tasks cannot be removed or reordered. Host tool permissions still apply.

Ordinary `/qm` command arguments are stripped from the model-readable command transcript. When you ask Claude to manage the queue through its tool, it can read the pending task text. Avoid recursively queuing queue-management prompts.

## Command reference

| Command | Purpose |
| --- | --- |
| `/qm`, `/qm inline`, `/qm list` | Open the manager above the prompt |
| `/qm side`, `/qm close` | Open the side panel / close the manager |
| `/qm add <task>` | Add one pending task |
| `/qm batch A \|\| B \|\| C` | Add different tasks in order |
| `/qm repeat 5 <message>` | Add 5 identical tasks; 1–200 per call |
| `/qm pause`, `/qm resume` | Hold the next dispatch / resume processing |
| `/qm front <task>` | Add a task at the front |
| `/qm edit 2 <text>`, `/qm rm 2`, `/qm mv 3 1` | Edit, remove or move pending positions |
| `/qm clear`, `/qm undo` | Clear pending tasks / undo a pending-queue edit |
| `/qm lang de` | Select one of the 20 interface languages |
| `/qm web`, `/qm web stop` | Open/reopen or stop the browser dashboard |
| `/qm verify off\|marker\|ai [haiku]` | Select completion verification; AI uses an extra model call |
| `/qm retry 2 5s`, `/qm retry last` | Configure bounded retries / requeue the last failed or unknown task |
| `/qm timeout 10m\|off` | Classify elapsed time after a turn ends; does not abort it |
| `/qm context`, `/qm context 85\|off` | Read host usage / configure a dispatch threshold |
| `/qm if success <task>`, `/qm if failure <task>` | Add a conditional task |
| `/qm onfail pause\|continue` | Choose terminal-failure behavior |
| `/qm history [1-50]`, `/qm stats`, `/qm settings` | View outcomes, analytics and settings |
| `/qm sessions`, `/qm restore SESSION_ID [recover]` | List sessions / transfer a paused queue into an empty session |
| `/qm recover` | Return an orphaned in-flight task to pending and pause |
| `/qm help` | Show command help |

## Behavior and limits

- Maximum **200 tasks per addition**, **500 pending**, **20,000 characters per task**. The serialized queue budget is **2,800 KiB**, within the host's shared **4 MiB plugin store**. An addition that cannot fit is rejected without discarding pending/running work.
- A completed turn does not prove that the task succeeded. Marker verification is model self-report; AI verification examines the last answer and may return `unknown`. Unknown outcomes pause without automatically replaying potentially successful work. Retries can repeat side effects.
- Context values come from official host usage data. If unavailable, QM explains this rather than inventing measurements. A saved reading may remain visible. Context thresholds do not compact or clear the session.
- Recovery is explicit. Review whether an orphaned task already finished before replaying it. Cross-session restore requires a paused source and an empty target; close the source session first. The `recover` option acknowledges possible duplicate execution.
- QM does not replace Claude's built-in Ctrl+Enter queue. Use QM controls for its serial queue.

See the detailed automation guides in [English](docs/en/FEATURES-0.4.md) or [Türkçe](docs/tr/FEATURES-0.4.md), and [CHANGELOG](CHANGELOG.md) for release history.

## Troubleshooting

If `/qm` is missing, check that the plugin is enabled in a compatible local Code session. Reload plugins or restart after the active task finishes. A startup warning can expose a mod-loading failure; a missing slash-menu entry alone does not identify the cause.

If the web page was closed, run `/qm web` again. If it cannot reconnect, use `/qm web stop`, then `/qm web` in the same session. Browser launching and clipboard access depend on the host environment.

## Development and validation

```sh
npm run verify
npm run validate:mod
npm run test:host
```

Tests cover serial dispatch, interruption, stable-ID edits, retries, verification, context guards, session recovery, language selection and browser synchronization. Official host tests exercise native terminal/Desktop element protocols at narrow and wide widths; they do not verify final pixels in the installed Desktop application.

Optional browser visual QA: install Playwright in a separate QA environment and run `node scripts/ui-smoke.mjs`. Set `QM_PLAYWRIGHT_MODULE` to its module URL if needed. The script covers 1440/900/390 px, 0/3/20/200 tasks, language changes and queue interactions; output goes under `artifacts/`.

## License and inspiration

[MIT](LICENSE) · Copyright © 2026 ByBrawe.

Inspired by queue workflows in After by midudev and OpenCode Queue Manager. QM has no runtime dependency on either project.

