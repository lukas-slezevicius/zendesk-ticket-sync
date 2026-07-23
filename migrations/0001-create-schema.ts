import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('zendesk_tenants')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('organization_id', 'uuid', (col) => col.notNull())
    .addColumn('subdomain', 'text', (col) => col.notNull())
    .addColumn('agent_email', 'text', (col) => col.notNull())
    .addColumn('api_token', 'text', (col) => col.notNull())
    .addColumn('active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('zendesk_tickets')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('organization_id', 'uuid', (col) => col.notNull())
    .addColumn('external_id', 'text', (col) => col.notNull())
    .addColumn('subject', 'text', (col) => col.notNull())
    .addColumn('requester_email', 'text', (col) => col.notNull())
    .addColumn('comment_count', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('raw_payload', 'text')
    .addColumn('legacy_ref', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('zendesk_tickets_org_external_id_unique', [
      'organization_id',
      'external_id',
    ])
    .execute();

  await db.schema
    .createTable('conversations')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('organization_id', 'uuid', (col) => col.notNull())
    .addColumn('external_id', 'text', (col) => col.notNull())
    .addColumn('subject', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('open'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('messages')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('conversation_id', 'uuid', (col) =>
      col.notNull().references('conversations.id').onDelete('cascade'),
    )
    .addColumn('external_id', 'text', (col) => col.notNull())
    .addColumn('sender_email', 'text', (col) => col.notNull())
    .addColumn('body', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('sync_state')
    .addColumn('tenant_id', 'uuid', (col) =>
      col.primaryKey().references('zendesk_tenants.id').onDelete('cascade'),
    )
    .addColumn('last_synced_at', 'timestamptz', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('idx_zendesk_tickets_organization_id')
    .on('zendesk_tickets')
    .column('organization_id')
    .execute();

  await db.schema
    .createIndex('idx_conversations_external_id')
    .on('conversations')
    .column('external_id')
    .execute();

  await db.schema
    .createIndex('idx_messages_conversation_id')
    .on('messages')
    .column('conversation_id')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('sync_state').execute();
  await db.schema.dropTable('messages').execute();
  await db.schema.dropTable('conversations').execute();
  await db.schema.dropTable('zendesk_tickets').execute();
  await db.schema.dropTable('zendesk_tenants').execute();
}
