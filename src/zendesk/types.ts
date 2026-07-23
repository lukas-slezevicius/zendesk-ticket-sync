export type ZendeskTicketStatus = 'new' | 'open' | 'pending' | 'solved' | 'closed';

export interface ZendeskTenant {
  id: string;
  organizationId: string;
  subdomain: string;
  agentEmail: string;
  apiToken: string;
}

export interface ZendeskTicket {
  // Zendesk assigns ticket ids per tenant: every tenant's tickets are
  // numbered 1, 2, 3, ... from their own counter, so the same id exists in
  // (nearly) every tenant.
  id: number;
  // The same per-tenant id, as the string we store on our side.
  externalId: string;
  subject: string;
  status: ZendeskTicketStatus;
  requesterEmail: string;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

export interface ZendeskComment {
  // Comment ids come from a per-tenant counter too.
  id: number;
  authorEmail: string;
  body: string;
  isPublic: boolean;
  createdAt: string; // ISO-8601
}
