import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('zendesk_tickets').addColumn('status', 'text').execute();

  // Backfill existing rows so the NOT NULL constraint below holds.
  await sql`UPDATE zendesk_tickets SET status = 'open' WHERE status IS NULL`.execute(db);

  await db.schema
    .alterTable('zendesk_tickets')
    .alterColumn('status', (col) => col.setNotNull())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('zendesk_tickets').dropColumn('status').execute();
}
