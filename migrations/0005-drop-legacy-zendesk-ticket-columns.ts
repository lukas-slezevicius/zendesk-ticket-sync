import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Leftovers from the old importer; nothing in this service reads them anymore.
  await sql`ALTER TABLE zendesk_tickets DROP COLUMN raw_payload, DROP COLUMN legacy_ref`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('zendesk_tickets')
    .addColumn('raw_payload', 'text')
    .addColumn('legacy_ref', 'text')
    .execute();
}
