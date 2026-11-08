# Claude Queue Manager (QM) — User guide

[🌐 English / English](../languages/README.md) · [GitHub](https://github.com/ByBrawe/Claude-Queue-Manager) · [MIT](../../LICENSE)

QM queues prompts in Claude Desktop's **Code** tab or Claude Code CLI and starts each prompt as a separate turn after the previous main turn finishes. It does not steer a task that is already running.

## What does “continue” mean?

The word `continue` is **ordinary task text**, not a special QM keyword. You can write the task in any language. `/qm repeat 5 continue` queues five separate messages containing `continue`; it does not translate them.

```text
/qm repeat 5 continue
```

## Installation

Install the GitHub marketplace and plugin in Claude Code. Open a **new local Code session** afterward, or run `/reload-plugins` if supported. The ordinary Claude Chat tab does not load this mod.

```text
/plugin marketplace add ByBrawe/Claude-Queue-Manager
/plugin install qm@claude-queue-manager
```

## Safe quick start

Pause the queue, add several tasks in one batch, inspect the panel, then resume. Only one new task is submitted after each completed main turn.

```text
/qm pause
/qm batch Fix failing tests || Run the build || Summarize the changes
/qm
/qm resume
```

## Command reference

| Command | Command reference |
| --- | --- |
| `/qm` | Open the queue panel |
| `/qm add continue` | Add one task |
| `/qm repeat 5 continue` | Add identical tasks (1–200 per call) |
| `/qm batch A \|\| B \|\| C` | Add different tasks, in order |
| `/qm front continue` | Put a task first |
| `/qm pause  /qm resume` | Pause / resume automatic processing |
| `/qm mv 3 1` | Move pending task 3 to position 1 |
| `/qm edit 2 continue` | Edit pending task 2 |
| `/qm rm 2` | Remove pending task 2 |
| `/qm undo` | Undo the last queue edit |
| `/qm clear` | Clear pending tasks only |
| `/qm recover` | Recover an orphaned running task after a crash, then pause |
| `/qm help` | Display help |

## Limits and important notes

Maximum **200 tasks per addition**, **500 pending tasks** in total. Each task may consume model usage and context; even with a 200K context window, turns do not automatically start with a fresh context. Do not repeat `continue` hundreds of times unless the underlying task has a clear stopping condition. Finished turns are not proof that the requested work succeeded.

## Troubleshooting

If `/qm` is missing, check the plugin is enabled and reopen a local **Code** session. Avoid running another queue mod simultaneously. The panel is experimental; start with two small tasks. ZIP installation is described below.

### ZIP

Unzip the archive, keep the extracted `Claude-Queue-Manager` directory in a stable location, and run:

```sh
claude plugin marketplace add /absolute/path/to/Claude-Queue-Manager
claude plugin install qm@claude-queue-manager
```

> Note: This is a translated guide; it does not localize the QM panel itself.
