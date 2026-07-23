export type ConversationStatus = 'open' | 'pending' | 'closed';

export interface Conversation {
  id: string;
  organizationId: string;
  externalId: string;
  subject: string;
  status: ConversationStatus;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  externalId: string;
  senderEmail: string;
  body: string;
  createdAt: string;
}

// A message as an integration hands it to the store, before it has an id.
export interface NewMessage {
  externalId: string;
  senderEmail: string;
  body: string;
  createdAt: string;
}
