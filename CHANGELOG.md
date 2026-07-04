# Changelog

## [0.1.5] — 2026-07-03

### Fixed
- `addNote`: added required `outcome: "Note"` field to `POST /api/Actions` payload.
  HaloPSA rejects action creation without an outcome value; observed during live testing.

---

## [0.1.4]

- Initial public release: Ticket (Create, Get, Search, Update), Action / Note (Add Note, Get Many), Attachment (Get Many, Get with signed URL).
- Live dropdowns for ticket type, client, priority, status, agent, team, site, user.
- Per-credential OAuth2 token cache.
