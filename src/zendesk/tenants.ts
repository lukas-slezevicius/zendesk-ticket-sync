import { db } from '../db';
import type { ZendeskTenant } from './types';

export async function listActiveTenants(): Promise<ZendeskTenant[]> {
  return db
    .selectFrom('zendesk_tenants')
    .select([
      'id',
      'organization_id as organizationId',
      'subdomain',
      'agent_email as agentEmail',
      'api_token as apiToken',
    ])
    .where('active', '=', true)
    .execute();
}
