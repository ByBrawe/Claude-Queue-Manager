## 0.6.0 — 20 interface languages / 20 arayüz dili

The 20 documentation languages are now available in the native panel, CLI language command and web dashboard: en, tr, de, fr, es, it, pt-BR, ru, uk, pl, nl, sv, ja, ko, zh-CN, ar, hi, id, vi, fa. Use the header selector or `/qm lang de`, `/qm lang pt-BR`, `/qm lang zh-CN`. Native preferences survive a restart; browser preferences are saved per dashboard origin. Web Arabic and Persian use right-to-left layout. Command names, task content and host-provided diagnostic text are not translated.

README’deki 20 dil artık gerçek arayüz seçeneğidir. Üstteki dil seçicisini veya `/qm lang <kod>` komutunu kullan. Ek diller kısa, yerelleştirilmiş arayüz metinleri kullanır; İngilizceye sessizce dönmez. Önceki 0.5.1 dil görünürlüğü düzeltmesi bu sürüme dahildir.

## 0.5.0 — Native, CLI and web workspace

The queue engine and gateway configuration are preserved. The native manager now adapts to the available width, separates repeat count/message, confirms individual deletion, and provides keyboard focus and p/q shortcuts. The inline view stays compact; Details expands pending operations and advanced telemetry. Task fields use supported Box/Input components at full width.

The dark web workspace has a compact header with the bound session ID, explicit pause/add behavior, responsive queue/composer layout, separate repeat count/message, and collapsed history/analytics. Both languages cover controls, status, help and accessibility labels. Connection failures disable dispatch controls, retain drafts and retry automatically; changes are announced only after the mod acknowledges them.

### Let Claude build and arrange the queue

QM registers the official Mods tool **mcp__qm__queue** at session startup. Ask Claude: "Create a queue for this project: inspect the code, fix the failures, run tests, then summarize. Keep it paused for my review." Claude can call:

- {"action":"pause"} and {"action":"list"}
- {"action":"add","tasks":["Inspect code","Run tests"]}
- {"action":"reorder","ids":[2,1]} (include every pending ID exactly once)
- {"action":"remove","ids":[2]}
- {"action":"resume"}

This is the same session queue used by Desktop, CLI and web. Mutations use stable IDs and the existing queue mutex; running tasks cannot be edited or removed. Adding while a turn is active only queues work for later. Claude must not recursively queue queue-management prompts. Tool access intentionally lets Claude read pending text when you ask it to manage the queue. This differs from the /qm transcript redaction that keeps ordinary queued arguments out of the active model turn. Host tool permission policy still applies.

### Context readings

Earlier UI versions only sampled usage during dispatch or explicit /qm context calls, leaving a newly opened panel uninitialized. The native view and web snapshot now also query official $.session.usage().context. No gateway settings are changed and no token values are fabricated. If the host has not reported numeric tokens/window, the UI explains that a model response may be needed; host call failures go to Claude's debug log. A last saved reading can remain available. This does not prove that every custom gateway exposes usage.

### Verification and packaging

Run npm run verify, npm run validate:mod, npm run test:host. Optional Playwright QA: install Playwright in your QA environment, then node scripts/ui-smoke.mjs (or set QM_PLAYWRIGHT_MODULE to its index.mjs file URL). It captures 1440/900/390 px × 0/3/20/200 tasks × English/Turkish and checks selection, drag reorder, repeat, delete confirmation and reconnect. Artifacts are local under artifacts/. Official host tests validate terminal/Desktop elements, not the final pixels of the installed Desktop app.

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

## Interactive UI / TUI

Use **`/qm`** in Claude Desktop **Code** or Claude Code CLI to open the interactive pane: paste tasks, repeat using `5 | continue`, search pending tasks, paginate 12 at a time, edit/reorder rows, and clear pending tasks with two-step confirmation.

Switch UI language via the **English / Türkçe** dropdown or `/qm lang en` and `/qm lang tr`. Guides are available in 20 languages, but the interactive panel currently supports only English and Turkish. Test with two small tasks in your actual Desktop version.

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

0.5.0 validation: 55 Node tests and 7 official Claude host tests passed. Playwright captured 24 responsive/language/task-count states and passed six interaction checks. Real installed Desktop pixel testing was not performed for this release; host tests validate its element protocol. Keyboard hotkeys apply while the mod surface holds focus, not while typing a normal prompt.

