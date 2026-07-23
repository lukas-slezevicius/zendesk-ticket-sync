// Service entry point: each integration module registers its own background
// jobs against the shared job runner (see src/jobs.ts for its contract).
import { registerZendeskJobs } from './zendesk';

registerZendeskJobs();
