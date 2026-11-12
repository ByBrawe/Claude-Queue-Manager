## 0.8.0 — Run one selected task

- Add Run selected task only to native/CLI and web multi-selection controls when exactly one pending task is selected. Add `/qm run <position>` and `/qm run cancel`.
- Reserve the selected stable ID, wait for existing work and its configured retries, then run only that task. Pause the remaining queue after it finishes, fails or is conditionally skipped.
- Preserve conditional checks, context limits, retry delays, interruption/recovery and revision-checked web operations. Invalid or removed targets never fall through to a different task.
- Show a localized queued/running notice and cancellation for a pending single-task request in all 20 interface languages. Cancellation leaves tasks intact and the queue paused.
- Add state-machine, actual mod/web bridge and official host coverage for one-task execution, live-turn waiting, cancellation, failed writes, dropped submissions and duplicate clicks. Extend Playwright captures and interactions.

## 0.7.4 — Recovery always remains available

- Keep Recover task visible for every orphan, including zero pending tasks and a tracked live Claude turn. Recovery returns the task to the front, pauses the queue and preserves live-turn busy state; it never interrupts or dispatches that turn.
- Clear live-turn tracking when a main completion omits its turn ID. Do not settle an orphan using an unrelated turn's completion.
- Hide Undo during recovery and when there is no undo history. Rename it Undo last queue edit, preview the pending-count change, require confirmation and reject stale confirmations. Native UI undo leaves the queue paused.
- Keep recovery yellow even if an earlier undo restored an unpaused snapshot. Update 20-language guidance and test the exact live-turn/zero-pending regression.

## 0.7.3 — Visible restart recovery

- Show orphaned work as Recovery needed rather than an actively running task, with a prominent native/CLI notice and Return task to queue action near the top.
- Replace Resume with recovery until the orphan is returned to pending. Keep the queue paused for review; warn that previously completed work may repeat.
- Add the same recovery state/action to the web dashboard, with revision-checked persistence. Reject browser Resume while recovery is required and block UI recovery during a tracked live Claude turn.
- Translate recovery controls and guidance in all 20 languages. Cover restart, live-turn protection, failed writes, native host controls and browser recovery captures.

## 0.7.2 — Multiline editing and clear pending order

- Use a full-width multiline editor near the top of the native workspace: 10 rows in the side pane, 6 above the prompt. Save explicitly; submitting the input alone keeps the draft.
- Show the globally next pending task even when a later page or search filter is active. Add Show first task to clear search and return to page one.
- Explain top-to-bottom pending positions and conditional skipping in all 20 languages. Highlight the first pending row; remove duplicate numeric checkbox shortcut badges and running-task IDs from the primary preview.
- Preserve existing FIFO dispatch and stable-ID mutations. Cover long multiline round-trips, paging/search/reorder previews and official narrow/wide terminal/Desktop controls.

## 0.7.1 — Reset advanced settings to defaults

- Add a localized Reset to defaults action in native/CLI Details and web Advanced settings, separate from Reload saved settings.
- Persist the engine defaults through the existing atomic, stale-checked save flow. Web defaults come from the server's engine constant rather than a second browser definition.
- Preserve queue items, history, language and pause state; do not resume tasks. Running-task and storage-error protections apply to resetting as well.
- Cover native reset/preservation/storage failures, browser acknowledgement and official host reset controls; add a Playwright reset interaction.

## 0.7.0 — Editable advanced settings

- Add native/CLI Details and web Advanced settings forms for all seven existing queue settings: verification, AI verifier model, retry count/delay, soft timeout, context threshold and failure policy.
- Validate and save the form atomically through the existing queue mutex and persistence layer. Keep drafts on rejection; provide explicit reload of saved values and reject stale config edits.
- Block settings writes during a running queue task. Saving never resumes the queue or changes Gateway/API configuration.
- Add a manual requeue-last-failed action that leaves the queue paused for review.
- Translate new labels, validation states and behavior hints in all 20 interface languages. Explain that API errors/interruption pause rather than automatically retry.
- Extend official host tests, browser acknowledgement tests, native persistence/storage-failure checks, server bounds and concurrent native/web edit coverage. Add open-settings visual captures and save/conflict checks to Playwright QA.

## 0.6.3 — Restore the full workspace above the prompt

- Open the complete native queue workspace directly above the prompt, including pause/resume, undo, clear, web, task entry, repeat count/message and pending task operations.
- Keep core controls visible regardless of Details; Details toggles advanced context/history/session information only.
- Remove the separate reduced composer view. Preserve green running and yellow paused states, the collapsed summary band and separate side/expand/web actions.
- Verify full AbovePrompt controls with official terminal/desktop host tests at 48 and 110 columns and 5/20 repeated additions.

## 0.6.2 — Visible repeat controls

- Keep count/message/repeat controls visible in the side panel without opening Details.
- Add a localized count field to the compact composer: 1 keeps batch entry; 2–200 repeats the entered message through the existing bounded repeat command.
- Match the compact title to the running state with green; paused remains yellow.
- Cover 5/20 repeated additions while paused and update native host visibility assertions.

## 0.6.1 — Compact pending rows and accurate empty state

- Separate summary-band actions into Side panel, Expand and Web; Web never opens the inline manager.
- Reopen the browser and refresh clipboard access when the dashboard server already runs; restart a stale server on demand.
- Narrow native panels group selection/text and actions into two rows instead of stacking every control vertically. Action groups wrap only when needed.
- Do not show an empty-queue hint when pending tasks exist; show the working hint during a non-queue turn.
- Translate disabled verification mode through the selected locale.
- Add official host regressions for narrow row grouping and false empty-state text.

## 0.6.0 — Shared 20-language UI catalog

- Connect all 20 documented languages to native/CLI/web selectors and canonical language codes.
- Share translated control/state text between native and browser views; preserve native locale preferences.
- Localize CLI help labels and add Arabic/Persian RTL web layouts.
- Add completeness, persistence and browser selection/layout checks for all 20 locales.
- Include the unreleased 0.5.1 language-control improvements.

## 0.5.1 — Visible language controls

- Default first-time native/CLI/web UI to Turkish; preserve explicitly saved English preferences.
- Show language selection at the top of native side and compact inline views, rather than hiding it in Details.
- Translate native pause reasons, including interruption and recovery states.

## 0.5.0 — Consistent native / CLI / web UX

- Responsive native form layout, compact inline view, full-width input wrappers, separate repeat fields, keyboard actions and per-row delete confirmation.
- Complete Turkish/English controls and localized CLI help.
- Compact dark web workspace, session identity, repeat form, acknowledged draft preservation, reconnect state, keyboard focus and stable delete selection.
- Read official host context data during native rendering and web snapshots, rather than only during queue dispatch.
- Add Claude-facing mcp__qm__queue tool: list, add, reorder, remove, pause and resume using the existing queue state and synchronization.
- Preserve slash commands, queue engine, recovery and gateway settings.
- Add official host tool integration coverage and optional Playwright visual/interaction QA script.

## 0.4.4 — Native form layout

- Put task and repeat captions above their inputs instead of beside them so narrow Desktop panes retain a usable editor width.
- Use taller task entry, shorter headers and consistent section spacing.
- Hide empty-queue statistics and inactive actions; move repeat/language/advanced controls into Details on both surfaces.
- Claude Mods does not expose the Desktop top-right toolbar as a render site; keep the supported inline and side-pane entry points.

## 0.4.3 — Inline manager and queue safety

- Open /qm above the composer by default; /qm side is an explicit native side-pane option and /qm close hides management. Empty queues occupy no prompt band. Advanced information is collapsible.
- Fix the missing search Input callback that made Claude reject the entire panel. Add real terminal/Desktop rendering tests at narrow and wide widths to CI.
- Resolve row actions by stable task ID under the queue mutex.
- Retire started/skipped tasks from every undo snapshot; migrate old snapshots without replaying completed work.
- Preserve explicit pause decisions through success, failure, timeout, verification and retries. Recover refuses tasks still live in the current process.
- Keep cached state unchanged until storage succeeds; bound retained undo/history by bytes and reject oversized additions atomically.
- Preserve the queue paused after /clear; cancel old dispatch/verification work across session changes.
- Serialize cross-process restores with an exclusive filesystem lock (Node.js 20+ for restore), retaining a frozen source copy until the transfer succeeds.
- Carry analytics/context/history through the dashboard server; retain browser drafts until a successful mod acknowledgement.

## 0.4.2 — Fix mod loading

- Remove Mods API namespace/method capability probes rejected by Claude Code's static module validator.
- Keep direct API calls and conservative error handling for unavailable context usage, AI verification, and saved-session listing.
- Preserve plugin-root metadata access for the optional web dashboard.
- Validate the actual hooks module in CI, in addition to the mocked-host tests.
- Validated with Claude Code 2.1.322; all 42 existing tests pass.

## 0.4.1 — Desktop command discovery workaround

- Register `/qm` before reading session identity, queue store, or preferences.
- Surface registration/session initialization errors to the user via toast and normal log.
- Show a permanent, small `QM` button above the composer, even when the queue is empty.
- Use the same `openManager()` path for button and `/qm` command and report panel placement failure.
- Document the upstream Desktop composer bug and limitations; keep all v0.4.0 functionality.

# Changelog

## 0.4.0

- Added optional `verify off|marker|ai [model]` completion classification, conservatively handling unknown results.
- Added bounded retries (`retry 0..5 [delay]`), manual retry of last failure, and soft post-turn timeouts.
- Added context telemetry from the host's real `$.session.usage()` and an opt-in pre-dispatch threshold guard.
- Added `if success|failure` conditional tasks, with an explicit `onfail continue` policy for failure branches.
- Added safe, opt-in transfer of paused queues between saved sessions (`sessions`, `restore`), explicit orphan recovery, and transferred-source retirement.
- Added bounded task history and lifetime analytics counters, visible through commands and the native/browser panels.
- Preserved v0.3 queue data through state migration. Defaults keep prior simple FIFO semantics.
- Extended mocked-host and pure-function test suite. Real Claude Desktop integration must still be tested on the user's host.

## 0.3.0

- Native multi-selection and optional localhost drag-and-drop queue dashboard.

## 0.2.0

- Interactive native queue panel with English/Turkish UI and batch/repeat controls.

## 0.1.0

- Durable one-turn-at-a-time `/qm` queue and MIT-licensed standalone Claude Code mod.

