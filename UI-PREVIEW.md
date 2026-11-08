# QM v0.3.0 — local dashboard preview

Open `/qm` for the native desktop/terminal pane, including multiple selection and group move/remove.

Open `/qm web` for a real synchronized browser UI, not a static mockup. Use **drag and drop** via the `⠿` handle and multi-select via checkboxes. The native Claude queue remains the only source of truth.

## Safety and requirements

- Browser dashboard uses local Node.js 20+, `127.0.0.1`, and a per-session authentication token.
- A local browser is optional; no need to install Node.js for the native `/qm` UI.
- Changes apply to pending queue entries only. Concurrent stale changes are rejected.
- Stop with `/qm web stop` or close the Code session. Orphaned dashboards stop after 5 minutes without Mod contact.
- Test in Claude Desktop: native Mods UI / browser launch require host API compatibility. Unit/integration tests are not a substitute for this.
