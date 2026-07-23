import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Sync lookups by external id were showing up as sequential scans.
  await db.schema
    .createIndex('idx_messages_external_id')
    .on('messages')
    .column('external_id')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_messages_external_id').execute();
}
