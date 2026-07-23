# Zendesk Ticket Sync — code review exercise

## The world this code lives in

A **help desk** is the tool a company uses to handle customer support:
customer emails and chats land there as **tickets**, and support agents work
through them. Zendesk is the biggest one; Gorgias, Freshdesk, and Intercom are
others. Each has its own API and its own vocabulary — some say "tickets",
some say "conversations".

Our product is an AI agent that plugs into whatever help desk a customer
already uses and handles their support tickets for them. To do that, we keep a
copy of the help-desk data in our own system under one **unified
representation**: every external ticket becomes a local **conversation**, and
every ticket comment becomes a **message** on it. The AI reads and writes
conversations and messages; it never talks to the help desk's API directly.

This repo is the **Zendesk module** of that picture: a proof-of-concept
service that syncs Zendesk tickets into our conversations. The entry point is
`src/main.ts`: a job runner fires on a fixed interval and calls
`syncZendeskTickets(tenant)` for every **tenant** — one organization's
Zendesk account plus its API credentials (see `ZendeskTenant` in
`src/zendesk/types.ts`). Each run asks the Zendesk API for tickets updated
since the last run (tracked as a per-tenant **watermark**), pulls their
comments, and writes conversations and messages into our database.

The job library is stubbed in `src/jobs.ts` — **read its contract comment**;
those are the only guarantees the scheduler gives you, and you may rely on
them when reasoning about the rest of the code.

The sync has to be **robust and secure**: it runs unattended against millions
of rows, tickets must never be silently lost or duplicated, and one
organization's data must never be visible to another.

## Terminology

- **Zendesk ticket** — Zendesk's unit of support work. It lives in Zendesk
  and belongs to them; we only read it over their API. Each ticket has an id,
  a status, and a thread of **comments**. Ticket ids are plain integers that
  count up from 1 **separately in every Zendesk account** — so ticket `812`
  exists in more or less every tenant we sync.
- **Conversation** — *our* internal unit: one thread between a customer and
  our AI agent, the same shape regardless of which help desk it came from.
  This is what the rest of our product reads and writes. Each synced ticket
  should map to exactly one conversation.
- **Message** — our copy of one ticket comment, attached to a conversation.
- The local `zendesk_tickets` table is sync bookkeeping: a small mirror of
  each external ticket (status, `updated_at`, comment count) so a run can
  tell what changed since it last looked. `conversations` / `messages` are
  the real working data.
- **Tenant** — one organization's Zendesk account plus API credentials.
- **Watermark** — the per-tenant timestamp of how far the sync has gotten;
  each run asks Zendesk only for tickets updated after it.

## Your task

The interview has two parts; your interviewer will tell you when to switch.

**Part 1 — the code.** Review `src/` as if it were a teammate's PR. For each
file, talk through:

- **What does it do?**
- **Is anything buggy, unsafe, or surprising?**
- **What happens when things go wrong** — a crash mid-run, a run that takes
  longer than expected, a flaky network, a restart? How long an outage — ours
  or Zendesk's — can this design survive without permanently losing tickets?
- **Would you ship it as-is?** If not, what has to change first?
- **How would you design it better?**

**Part 2 — the migrations.** Treat the `migrations/` folder as if those five
migrations were in the PR too, about to run for the first time. Given that
they run **sequentially inside a transaction on service startup**, against
the hot production tables described below: which are safe, which would you
push back on, and why? You don't need to replay them to work out the schema;
the end state is below.

## Context you can assume

- The service is **multi-tenant**: many organizations each connect their own
  Zendesk account, and their data lives in the same database.
- `zendesk_tickets`, `conversations`, and `messages` are **hot production
  tables with millions of rows** and constant write traffic.
- Volume is high: a busy tenant produces **5-10 pages of freshly-updated
  tickets per minute** (every reply and status change bumps `updated_at`).
- Zendesk's updated-tickets endpoint serves **only the first 100 pages** of a
  query — tickets further behind the `updated_after` cursor than that are
  unreachable until the cursor advances. Do the math against the velocity
  above: for a busy tenant that window is only **~10-20 minutes deep**.
- An individual ticket can always be fetched by id, at any time
  (`fetchTicketDetail`) — but the updated-tickets feed is the *only* way to
  learn **which** tickets changed. For us, handling a ticket hours late is
  always better than never learning it changed at all.
- Missing a ticket is a **critical failure**, not a slow path. Our AI can only
  respond to a customer once their ticket exists as a conversation in our
  system. If a ticket slips past the 100-page window before we capture it —
  for any reason, on any run — we will never see it again unless the customer
  happens to update it. That is a customer who never got answered: lost
  revenue, and a client who relied on us to respond. So the system must
  reliably capture **every** ticket it can, on **every** run.
- Migrations run **sequentially inside a transaction on service startup**.
- Queries go through **Kysely**, a type-safe SQL query builder. The `db`
  instance in `src/db.ts` is built with a stub driver so this PoC type-checks
  without a database — treat every query as if it executes for real against
  the Postgres schema below.
- The job library in `src/jobs.ts` is also stubbed — its contract comment
  tells you exactly how the scheduler behaves, and you can rely on it.
- This is a **read-only review** — you don't need to install or run anything.

## Database schema (end state, after all migrations)

```
zendesk_tenants                      conversations
  id               uuid PK            id               uuid PK
  organization_id  uuid NOT NULL      organization_id  uuid NOT NULL
  subdomain        text NOT NULL      external_id      text NOT NULL
  agent_email      text NOT NULL      subject          text NOT NULL
  api_token        text NOT NULL      status           text NOT NULL DEFAULT 'open'
  active           bool NOT NULL      created_at       timestamptz NOT NULL
  created_at       timestamptz
                                     indexes:
zendesk_tickets                        external_id (non-unique)
  id               uuid PK             status
  organization_id  uuid NOT NULL
  external_id      text NOT NULL
  subject          text NOT NULL     messages
  status           text NOT NULL       id               uuid PK
  requester_email  text NOT NULL       conversation_id  uuid NOT NULL FK → conversations
  comment_count    int  NOT NULL       external_id      text NOT NULL
  created_at       timestamptz         sender_email     text NOT NULL
  updated_at       timestamptz         body             text NOT NULL
                                       created_at       timestamptz NOT NULL
  constraints:
    UNIQUE (organization_id,         indexes:
            external_id)               conversation_id
  indexes:                             external_id (non-unique)
    organization_id

sync_state
  tenant_id        uuid PK FK → zendesk_tenants
  last_synced_at   timestamptz NOT NULL
```

## Layout

```
migrations/            schema migrations, in order
src/
  main.ts              entry point: each module registers its jobs
  jobs.ts              stub of our job library — its contract comment is authoritative
  db.ts                Kysely instance + table types for the schema
  conversations/       the unified conversation store (core, integration-agnostic)
    index.ts           create/read/update conversations + insert messages
    types.ts           domain types
  zendesk/             the Zendesk integration module
    index.ts           public surface: registers the recurring sync job
    types.ts           Zendesk API types + tenant
    api.ts             HTTP client for the Zendesk API
    tenants.ts         loads the tenants to sync
    tickets.ts         queries on zendesk_tickets
    sync.ts            the sync orchestrator (watermark, dedup, processing)
```
