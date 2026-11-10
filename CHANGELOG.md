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

