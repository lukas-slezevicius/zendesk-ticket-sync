import { db } from '../db';
import type { ConversationStatus, NewMessage } from './types';

export type { Conversation, ConversationStatus, Message, NewMessage } from './types';

// The unified conversation store. Help-desk integrations write the tickets
// they sync through these functions; the rest of the product reads and
// writes conversations through here too.

export async function getConversationByExternalId(externalId: string) {
  const row = await db
    .selectFrom('conversations')
    .select(['id', 'status'])
    .where('external_id', '=', externalId)
    .limit(1)
    .executeTakeFirst();
  return row ?? null;
}

export async function createConversation(
  organizationId: string,
  externalId: string,
  subject: string,
): Promise<string> {
  const row = await db
    .insertInto('conversations')
    .values({
      organization_id: organizationId,
      external_id: externalId,
      subject,
      status: 'open',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

export async function updateConversationStatus(
  conversationId: string,
  status: ConversationStatus,
): Promise<void> {
  await db
    .updateTable('conversations')
    .set({ status })
    .where('id', '=', conversationId)
    .execute();
}

export async function insertMessage(
  conversationId: string,
  message: NewMessage,
): Promise<void> {
  await db
    .insertInto('messages')
    .values({
      conversation_id: conversationId,
      external_id: message.externalId,
      sender_email: message.senderEmail,
      body: message.body,
      created_at: message.createdAt,
    })
    .execute();
}
