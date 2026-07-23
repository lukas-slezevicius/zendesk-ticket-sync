import {
  createConversation,
  getConversationByExternalId,
  insertMessage,
  updateConversationStatus,
  type ConversationStatus,
  type NewMessage,
} from '../conversations';
import { db } from '../db';
import { ZendeskApiClient, type DetailedZendeskTicket } from './api';
import { getTicketByExternalId, updateTicketCommentCount, upsertTicket } from './tickets';
import type { ZendeskComment, ZendeskTenant, ZendeskTicket, ZendeskTicketStatus } from './types';

// Closed tickets that haven't moved in two weeks are archive-only.
const STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

const EPOCH = '1970-01-01T00:00:00.000Z';

// Cursor for incremental sync: each run asks Zendesk only for tickets
// updated after the stored watermark.
async function getLastSyncedAt(tenantId: string): Promise<string> {
  const row = await db
    .selectFrom('sync_state')
    .select('last_synced_at')
    .where('tenant_id', '=', tenantId)
    .executeTakeFirst();
  return row?.last_synced_at ?? EPOCH;
}

// Move the cursor forward so the next poll only picks up newer updates.
async function advanceWatermark(tenantId: string): Promise<void> {
  const now = new Date().toISOString();
  await db
    .insertInto('sync_state')
    .values({ tenant_id: tenantId, last_synced_at: now })
    .onConflict((oc) => oc.column('tenant_id').doUpdateSet({ last_synced_at: now }))
    .execute();
}

function mapStatus(status: ZendeskTicketStatus): ConversationStatus {
  if (status === 'solved' || status === 'closed') return 'closed';
  if (status === 'pending') return 'pending';
  return 'open';
}

function toNewMessage(comment: ZendeskComment): NewMessage {
  return {
    externalId: String(comment.id),
    senderEmail: comment.authorEmail,
    body: comment.body,
    createdAt: comment.createdAt,
  };
}

// Zendesk's incremental endpoint can return the same ticket more than once
// when it gets updated while we're paginating, so drop repeats before doing
// any work for them.
const seen = new Set<string>();

function dedupeTickets(tickets: ZendeskTicket[]): ZendeskTicket[] {
  const unique: ZendeskTicket[] = [];
  for (const ticket of tickets) {
    if (seen.has(ticket.externalId)) {
      continue;
    }
    seen.add(ticket.externalId);
    unique.push(ticket);
  }
  return unique;
}

export async function syncZendeskTickets(tenant: ZendeskTenant): Promise<void> {
  const client = new ZendeskApiClient(tenant);
  const since = await getLastSyncedAt(tenant.id);
  console.log(`[zendesk-sync] ${tenant.subdomain}: starting sync since=${since}`);

  let processed = 0;
  try {
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const batch = await client.listUpdatedTickets(since, page);
      const fresh = dedupeTickets(batch.tickets);

      const detailed = await client.fetchTicketsWithComments(fresh.map((t) => t.id));

      const stale: DetailedZendeskTicket[] = [];
      const active: DetailedZendeskTicket[] = [];
      for (const ticket of detailed) {
        const ageMs = Date.now() - new Date(ticket.updatedAt).getTime();
        if (ticket.status === 'closed' && ageMs > STALE_AFTER_MS) {
          stale.push(ticket);
        } else {
          active.push(ticket);
        }
      }

      // Stale closed tickets are archive-only; no reason to block the page on them.
      for (const ticket of stale) {
        processTicket(tenant, ticket);
      }

      await Promise.all(active.map((ticket) => processTicket(tenant, ticket)));
      processed += detailed.length;

      // Kick off per-ticket metrics; low priority, shouldn't slow the loop down.
      detailed.forEach(async (ticket) => {
        await updateTicketCommentCount(ticket.externalId, ticket.comments.length);
      });

      hasMore = batch.hasMore;
      page += 1;
    }
    console.log(`[zendesk-sync] ${tenant.subdomain}: processed ${processed} tickets`);
  } finally {
    // Always move the cursor forward so one bad page can't wedge the poller.
    await advanceWatermark(tenant.id);
  }
}

async function processTicket(tenant: ZendeskTenant, ticket: DetailedZendeskTicket): Promise<void> {
  const known = await getTicketByExternalId(ticket.externalId);
  if (known && known.updated_at === ticket.updatedAt) {
    return; // nothing changed since the last sync
  }

  const conversation = await getConversationByExternalId(ticket.externalId);
  if (conversation) {
    for (const comment of ticket.comments) {
      await insertMessage(conversation.id, toNewMessage(comment));
    }
    await updateConversationStatus(conversation.id, mapStatus(ticket.status));
  } else {
    const conversationId = await createConversation(
      tenant.organizationId,
      ticket.externalId,
      ticket.subject,
    );
    for (const comment of ticket.comments) {
      await insertMessage(conversationId, toNewMessage(comment));
    }
  }

  await upsertTicket(tenant.organizationId, ticket);
}
