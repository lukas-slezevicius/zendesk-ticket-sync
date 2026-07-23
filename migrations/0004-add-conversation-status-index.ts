import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // This index was built CONCURRENTLY against prod out-of-band before this
  // migration shipped; IF NOT EXISTS makes this a no-op there, and it still
  // builds normally on fresh/CI databases where the table is empty.
  await sql`CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations (status)`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_conversations_status`.execute(db);
}
