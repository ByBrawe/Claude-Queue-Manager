# QM 0.4.0: reliability and automation guide

QM works in the **local Code tab** of Claude Desktop and in Claude Code CLI. It is **not** available in regular Claude Chat. Commands are English; task instructions can be in any language.

## Quick start (safe defaults)

```text
/qm pause
/qm verify marker
/qm retry 2 5s
/qm timeout 10m
/qm context 85
/qm onfail pause
/qm batch Fix the tests || Run the build || Summarize the results
/qm
/qm resume
```

- **Verification:** `/qm verify off` is the default: a normal answered turn counts as successful, which is NOT proof that tests passed. `/qm verify marker` adds a request for `QM_PASS` or `QM_FAIL` at the end of a task's answer; absence becomes `unknown` and **pauses**. `/qm verify ai haiku` asks a separate small model to classify the task and the *final answer*. It is opt-in, consumes additional model usage, and **cannot independently inspect code or prove tests passed**. Uncertain model verdicts pause; do not automatically retry potentially successful work.
- **Retries:** `/qm retry 2 5s` makes up to two additional attempts after a final `failure` or soft `timeout`. Default is zero retries. The 5s delay is optional and retains FIFO; max five retries and max 10-minute delay. `/qm retry last` manually requeues the most recent failed/unknown task and pauses for review. Avoid retries for side-effectful tasks such as deployments or payments.
- **Soft timeout:** `/qm timeout 10m` marks a turn lasting longer than ten minutes as `timeout` **when that turn ends**. It does not interrupt or terminate a running operation. Set `/qm timeout off` to disable (default).
- **Context:** `/qm context 85` samples `$.session.usage().context` and pauses before the next task at 85% of the actual reported context window. `/qm context` shows the reading, `/qm context off` disables the guard (default). If Claude Code does not provide usage data, QM says **unavailable**; it never estimates token counts from text. Context does not reset between queue turns. Use `/compact` or a new session manually if needed.
- **Conditions:** `/qm if success <task>` and `/qm if failure <task>` schedule tasks only when the **last executed task** (ignoring skipped branches) has the matching verified outcome. A condition without an earlier outcome is skipped. Set `/qm onfail continue` to allow a failure branch to run after all retries are exhausted. The default `/qm onfail pause` stops the queue on final failure. `unknown` always pauses.
- **Recovery:** The queue is saved in Claude Code's per-session `$.store`. A reloaded in-flight task is **not auto-replayed**: inspect it, then `/qm recover` to put it back at the front with the queue paused. `/qm sessions` lists saved queues. `/qm restore SESSION_ID` **transfers** a paused, non-running source queue to an empty target session and retires the source to prevent duplicate starts. For a possibly in-flight source, `/qm restore SESSION_ID recover` acknowledges that replay may duplicate work. Transfers across independently running processes are best-effort, not a distributed transaction; close the old session first.
- **History / analytics:** `/qm history 20` shows recent finished, failed, unknown and skipped tasks and their durations; `/qm stats` shows cumulative counts and mean duration. Up to 250 detailed records are saved per session, and aggregate counters remain available beyond that. The `/qm` native panel and `/qm web` dashboard show status and context information. `/qm settings` displays active settings.

## Conditional workflow example

```text
/qm pause
/qm verify marker
/qm retry 1 10s
/qm onfail continue
/qm add Run all tests and fix obvious failures
/qm if success Write the release notes
/qm if failure Investigate the test failure and propose a fix
/qm resume
```

If the first task passes, the success branch runs and the failure branch is skipped. If it fails after retries, the success branch is skipped and the failure branch starts. A subsequent turn's result becomes the new condition reference.

## Safety and limitations

- Default settings preserve v0.3's behavior. Enabling AI verification adds cost; its verdict is an **assessment of the answer**, not an independently verified build/test report.
- A message marked `QM_PASS` is still **self-reported**. Use actual repository CI or test tools if you need independent evidence.
- Soft timeouts do not abort active work, and aborted turns stop for manual review rather than retry automatically.
- Retrying potentially non-idempotent tasks can produce duplicate changes. Recovery/restore always requires explicit human action.
- No secret, token, or queue text is sent to QM's developers. The optional local browser runs on loopback; AI verification sends the task and a bounded answer excerpt to the selected Claude model.
- The old `/qm` panel and `/qm web` drag-and-drop remain. Do not enable another queue mod alongside QM.
- Local Node tests run without a Claude binary; **run `claude plugin validate ./plugins/qm` and a two-task live test** in your Claude Code version before long batches.

[English guide](README.md) · [Türkçe rehber](../tr/FEATURES-0.4.md) · [20-language index](../languages/README.md) · [Repository](https://github.com/ByBrawe/Claude-Queue-Manager)

### Claude Desktop: `/qm` is not recognized (v0.4.1)

Some Desktop releases do not recognize slash commands registered by mods ([Anthropic #99691](https://github.com/anthropics/claude-code/issues/99691)). QM v0.4.1 registers `/qm` before any queue I/O, surfaces startup errors, and draws a persistent **QM** button above the prompt even with an empty queue. That button opens the native panel without a model turn. If neither command nor button is available, the mod may not have loaded or the host may not render the surface. Use a new local **Code** session, not regular Chat; confirm the plugin is enabled and reload it.

