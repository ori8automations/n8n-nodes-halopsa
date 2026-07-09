# n8n-nodes-halopsa

n8n community node for HaloPSA — tickets, notes, and attachments with live dropdowns.

> **Early / community package.** This node is functional and in active use, but the API surface may change before a 1.0 release. Pin your version if you need stability.

## Why this exists

n8n ships a built-in HaloPSA node (`n8n-nodes-base.halopsa`) that covers standard CRUD across four entities: Client, Site, Ticket, and User. It's a reasonable general-purpose integration, but it leaves three gaps that matter for MSP automation workflows:

**No live dropdowns.** The stock node requires you to know the numeric IDs for ticket types, priorities, statuses, agents, teams, and sites before you can use them. In practice this means looking up IDs manually, hardcoding them, or adding a lookup step to every workflow. `BetterHaloPSA` loads all of those values directly from your HaloPSA instance at design time — the dropdowns populate with the actual names from your tenant, so you pick "Service Request" instead of `42`.

**No notes or actions.** Ticket notes are the primary operational record in HaloPSA — they're how technicians communicate, how SLA events are logged, and how AI layers route context. The stock node has no way to read or write them. This node adds an Action / Note resource with `addNote` (internal or client-visible) and `getMany` to pull full action history for a ticket.

**No attachments.** Files on tickets are invisible to the stock node. The Attachment resource here adds list and fetch operations that return signed download URLs, making it possible to pull attached documents into downstream processing (summarization, classification, storage sync).

Beyond the missing resources, the stock node's credential requires a full base URL, which creates friction in multi-tenant or subdomain-per-client setups. This node uses the HaloPSA subdomain as the credential field and handles the OAuth2 client credentials flow with a per-credential token cache, so repeated executions within a workflow don't re-authenticate on every node call.

The scope is deliberately narrower than the stock node — no client or user management. The goal is automation pipelines that interact with the ticket lifecycle: read tickets and their context, write notes, trigger on new or updated tickets. Deleting tickets or managing users from n8n workflows is out of scope by design and explicitly called out in the write-operations warning, since these nodes are frequently the backend for AI agent and MCP tool workflows where unguarded write access is a liability.

## npm status / package positioning

This package is **not currently published on npm** under `n8n-nodes-halopsa`. Until a publish is explicitly approved, install from a reviewed local tarball or directly from the GitHub repository.

This is also not the only HaloPSA-related n8n community package. Other public npm packages include:

- `n8n-nodes-halopsacomplete` — a broader HaloPSA API community node.
- `@avantguardllc/n8n-nodes-halopsa` — a scoped HaloPSA community node.

The intended positioning for this package is narrower: ticket-lifecycle workflows with live HaloPSA dropdowns, ticket notes/actions, attachment access, and clear warnings around AI/MCP exposure. Use whichever package best matches your workflow and safety model.

## Install

**Recommended: tarball install (avoids peer-dep issues)**

```bash
npm pack
# copy the .tgz to your n8n nodes directory, then:
npm install /path/to/n8n-nodes-halopsa-0.1.6.tgz --legacy-peer-deps --ignore-scripts
```

Restart n8n after install.

## Credential setup

Add a **HaloPSA API** credential in n8n:

| Field | Value |
|---|---|
| Subdomain | Your HaloPSA subdomain (e.g. `yourcompany` for `yourcompany.halopsa.com`) — lowercase letters, numbers, hyphens only |
| Client ID | OAuth2 Client ID from HaloPSA → Configuration → Integrations → HaloPSA API |
| Client Secret | OAuth2 Client Secret for the above Client ID |
| OAuth Scope | Leave as `all` unless your Halo API app enforces narrower permissions |

The credential test button calls the HaloPSA token endpoint to verify connectivity.

## Operations

| Resource | Operations |
|---|---|
| Ticket | Create, Get, Search, Update |
| Action / Note | Add Note, Get Many |
| Attachment | Get Many (list), Get (fetch + signed download URL) |

All dropdowns (ticket type, client, priority, status, agent, team, site, user) load live from your HaloPSA instance.

## ⚠️ Write operations warning

This node includes **write operations**: Ticket Create, Ticket Update, and Action Add Note.

- **Do not expose this node directly to AI agents or MCP tools.** Use narrow read-only wrapper workflows instead.
- `addNote` with `Private / Internal Only` set to **false** will post a customer-visible note.
- Ticket Create and Update call the live HaloPSA API immediately.

For AI agent / MCP use, build dedicated wrapper workflows that expose only the read operations you need (search tickets, get ticket, get notes).

## Known limitations

- List/search operations return **page 1 only** (up to 500 results). There is no automatic pagination across large result sets.
- Search limit is clamped to 1–500.
- OAuth scope is configurable in the credential but must match what your Halo API app permits.

## Credits

Built by [Claude](https://claude.ai) (Anthropic) under the direction of **Ori8**, the Hermes-based AI agent at the core of [Ori8 Automations](https://github.com/ori8automations). A human provided requirements, review, and final approval.
