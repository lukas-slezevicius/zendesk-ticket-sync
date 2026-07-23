import { every } from '../jobs';
import { syncZendeskTickets } from './sync';
import { listActiveTenants } from './tenants';

const SYNC_INTERVAL_MINUTES = 1;

// Register this module's background jobs. Called once from main.ts at boot.
export function registerZendeskJobs(): void {
  every('zendesk-sync', SYNC_INTERVAL_MINUTES, async () => {
    const tenants = await listActiveTenants();
    for (const tenant of tenants) {
      await syncZendeskTickets(tenant);
    }
  });
}
