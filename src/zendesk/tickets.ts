import { db } from '../db';
import type { DetailedZendeskTicket } from './api';

// Queries on zendesk_tickets, our bookkeeping mirror of each external ticket.

export async function getTicketByExternalId(externalId: string) {
  const row = await db
    .selectFrom('zendesk_tickets')
    .select(['id', 'organization_id', 'external_id', 'status', 'updated_at'])
    .where('external_id', '=', externalId)
    .limit(1)
    .executeTakeFirst();
  return row ?? null;
}

export async function upsertTicket(
  organizationId: string,
  ticket: DetailedZendeskTicket,
): Promise<void> {
  await db
    .insertInto('zendesk_tickets')
    .values({
      organization_id: organizationId,
      external_id: ticket.externalId,
      subject: ticket.subject,
      status: ticket.status,
      requester_email: ticket.requesterEmail,
      comment_count: ticket.comments.length,
      updated_at: ticket.updatedAt,
    })
    .onConflict((oc) =>
      oc.columns(['organization_id', 'external_id']).doUpdateSet({
        subject: ticket.subject,
        status: ticket.status,
        comment_count: ticket.comments.length,
        updated_at: ticket.updatedAt,
      }),
    )
    .execute();
}

export async function updateTicketCommentCount(
  externalId: string,
  commentCount: number,
): Promise<void> {
  await db
    .updateTable('zendesk_tickets')
    .set({ comment_count: commentCount })
    .where('external_id', '=', externalId)
    .execute();
}
