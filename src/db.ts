import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type Generated,
} from 'kysely';

// Table types for the schema in migrations/ (end state).

interface ZendeskTenantsTable {
  id: Generated<string>;
  organization_id: string;
  subdomain: string;
  agent_email: string;
  api_token: string;
  active: Generated<boolean>;
  created_at: Generated<string>;
}

interface ZendeskTicketsTable {
  id: Generated<string>;
  organization_id: string;
  external_id: string;
  subject: string;
  status: string;
  requester_email: string;
  comment_count: number;
  created_at: Generated<string>;
  updated_at: string;
}

interface ConversationsTable {
  id: Generated<string>;
  organization_id: string;
  external_id: string;
  subject: string;
  status: string;
  created_at: Generated<string>;
}

interface MessagesTable {
  id: Generated<string>;
  conversation_id: string;
  external_id: string;
  sender_email: string;
  body: string;
  created_at: string;
}

interface SyncStateTable {
  tenant_id: string;
  last_synced_at: string;
}

export interface Database {
  zendesk_tenants: ZendeskTenantsTable;
  zendesk_tickets: ZendeskTicketsTable;
  conversations: ConversationsTable;
  messages: MessagesTable;
  sync_state: SyncStateTable;
}

// In the real service this is constructed with the shared pg pool. The stub
// driver here only exists so this PoC type-checks without a database — treat
// every query as if it executes for real.
export const db = new Kysely<Database>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (kysely) => new PostgresIntrospector(kysely),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
});
