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
