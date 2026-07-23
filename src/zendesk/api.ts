import type { ZendeskComment, ZendeskTenant, ZendeskTicket } from './types';

interface ListTicketsResponse {
  tickets: ZendeskTicket[];
  meta: { hasMore: boolean };
}

interface TicketDetailResponse {
  ticket: ZendeskTicket;
  comments: ZendeskComment[];
}

export interface DetailedZendeskTicket extends ZendeskTicket {
  comments: ZendeskComment[];
}

const PAGE_SIZE = 100;

// Zendesk's updated-tickets endpoint only serves the first 100 pages of a
// query — deeper requests fail. Tickets that have fallen further behind the
// updated_after cursor than that are unreachable until the cursor advances,
// so anything skipped past page 100 is effectively gone.
const MAX_PAGE = 100;

export class ZendeskApiClient {
  constructor(private readonly tenant: ZendeskTenant) {}

  private get baseUrl(): string {
    return `https://${this.tenant.subdomain}.zendesk.com/api/v2`;
  }

  private buildHeaders(): Record<string, string> {
    const credentials = Buffer.from(
      `${this.tenant.agentEmail}/token:${this.tenant.apiToken}`,
    ).toString('base64');
    return {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = this.buildHeaders();
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`zendesk responded with status ${response.status}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      console.error('zendesk request failed', { url, headers, error });
      throw error;
    }
  }

  async listUpdatedTickets(
    since: string,
    page: number,
  ): Promise<{ tickets: ZendeskTicket[]; hasMore: boolean }> {
    if (page > MAX_PAGE) {
      throw new Error(`zendesk refuses pages beyond ${MAX_PAGE}`);
    }
    const query = `?updated_after=${encodeURIComponent(since)}&page=${page}&per_page=${PAGE_SIZE}`;
    const body = await this.request<ListTicketsResponse>(`/tickets/updated${query}`);
    return { tickets: body.tickets, hasMore: body.meta.hasMore };
  }

  async fetchTicketDetail(ticketId: number): Promise<DetailedZendeskTicket> {
    const body = await this.request<TicketDetailResponse>(`/tickets/${ticketId}?include=comments`);
    return { ...body.ticket, comments: body.comments };
  }

  // Pull full detail (including the comment thread) for every ticket on the page.
  async fetchTicketsWithComments(ticketIds: number[]): Promise<DetailedZendeskTicket[]> {
    return Promise.all(ticketIds.map((id) => this.fetchTicketDetail(id)));
  }
}
