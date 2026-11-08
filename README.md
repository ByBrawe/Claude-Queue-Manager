# Claude Queue Manager (QM)

A free, MIT-licensed **Claude Code mod** for **Claude Desktop > Code** and Claude Code CLI.
Open a queue panel with `/qm`, add up to 200 tasks at once, and run them as **separate turns, one after another**. Unlike sending a bunch of native `Ctrl+Enter` messages, QM intentionally submits only the next pending task after the current main turn completes.

**Requires:** Claude Code 2.1.287+ (Desktop Code tab 2.1.286+). Not for the regular Claude Chat tab, remote cloud sessions or Desktop WSL sessions.

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

## Commands

| Command | What it does |
| --- | --- |
| `/qm` or `/qm list` | Opens the queue manager panel |
| `/qm add Run tests` | Adds one task |
| `/qm repeat 100 devam et` | Adds 100 separate identical tasks (max 200 per call) |
| `/qm batch Run lint || Fix tests || Update README` | Adds tasks in specified order (max 200) |
| `/qm pause` / `/qm resume` | Pauses after the current task / resumes |
| `/qm front Run tests first` | Places a task at the front |
| `/qm mv 3 1` | Moves pending task #3 to position #1 |
| `/qm edit 2 New wording` | Edits task #2 before execution |
| `/qm rm 2` | Removes pending task #2 |
| `/qm undo` | Undo the last edit to pending queue |
| `/qm clear` | Clears pending tasks, not the running one |
| `/qm recover` | Puts an in-flight item back at the front after a host crash (then pauses) |
| `/qm help` | Command reference |

The panel includes a multi-line input: paste one task per line, or separate tasks with `||`. You can also use the pane's up/down/remove buttons for the visible tasks. It shows 20 tasks per page. Drag-and-drop is not currently supported.

## Example: create a batch safely

```text
/qm pause
/qm batch Fix test errors || Run all tests || Summarize results
/qm
/qm resume
```

On every successfully completed main turn, QM submits exactly **one** next prompt as a new user message. No queued prompt is injected into the active turn. On `Esc` or an API failure, the active task is returned to pending and the queue pauses. An item already started cannot be edited or removed via the pending list.

## Design and safety

- All queue state is stored in Claude Code's local `$.store`, keyed by session ID. No external server, tracking, model calls, or file modification by QM.
- The UI never sends the unexecuted queue to the model. Command arguments are stripped from the model-readable slash-command transcript.
- The pending queue is capped at 500 items, with 200 per add/batch. Each actual task can consume model usage and context. Repeated prompts are **not** free.
- QM does not replace or change Claude's built-in `Ctrl+Enter` queue. Use `/qm` commands for strict serial execution.
- Host errors or interruption pause the queue. `/qm recover` is for an orphaned in-flight task after a host crash; confirm the task has not already been completed before replaying it.
- A normal Claude answer that describes a blocker still counts as a completed turn. QM cannot automatically judge semantic success.
- Mod support and UI may change in new Claude Code releases; test with two small tasks before running large batches.
- Built from scratch using Anthropic's public Claude Code Mods API, inspired by the idea of OpenCode Queue Manager and After by midudev. No code from either project is required at runtime.

## Development

```sh
npm run verify
claude plugin validate ./plugins/qm
claude plugin validate .
claude --plugin-dir ./plugins/qm
```

Unit tests cover parser, FIFO dispatch, interruption, transcript redaction, ordering, and batch limits. Unit tests do **not** replace a real Desktop integration test.

## License

[MIT](LICENSE) - Copyright (c) 2026 ByBrawe.
