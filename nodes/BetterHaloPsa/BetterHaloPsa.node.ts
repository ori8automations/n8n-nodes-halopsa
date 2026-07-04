import {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

import { getToken, haloRequest, toOptions, normalizeTags } from './halo.utils';

export class BetterHaloPsa implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Better HaloPSA',
    name: 'betterHaloPsa',
    group: ['output'],
    version: 1,
    subtitle: '={{$parameter["operation"] + " " + $parameter["resource"]}}',
    description: 'Manage HaloPSA tickets, notes, and attachments with live dropdowns',
    defaults: { name: 'Better HaloPSA' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [{ name: 'haloPsaApi', required: true }],

    properties: [

      // ══════════════════════════════════════════════════════════════════════
      // Resource selector
      // ══════════════════════════════════════════════════════════════════════
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Ticket',          value: 'ticket' },
          { name: 'Action / Note',   value: 'action' },
          { name: 'Attachment',      value: 'attachment' },
        ],
        default: 'ticket',
      },

      // ══════════════════════════════════════════════════════════════════════
      // Operation selectors (one per resource)
      // ══════════════════════════════════════════════════════════════════════
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['ticket'] } },
        options: [
          { name: 'Create', value: 'create', action: 'Create a ticket',         description: 'Create a new ticket' },
          { name: 'Get',    value: 'get',    action: 'Get a ticket by ID',      description: 'Fetch a ticket by its ID' },
          { name: 'Search', value: 'search', action: 'Search tickets',          description: 'Search and filter the ticket list' },
          { name: 'Update', value: 'update', action: 'Update a ticket',         description: 'Update fields on an existing ticket' },
        ],
        default: 'create',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['action'] } },
        options: [
          { name: 'Add Note',  value: 'addNote',  action: 'Add a note to a ticket',        description: 'Post an internal or client-visible note' },
          { name: 'Get Many',  value: 'getMany',  action: 'Get all notes for a ticket',    description: 'Retrieve action history for a ticket' },
        ],
        default: 'addNote',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['attachment'] } },
        options: [
          { name: 'Get Many', value: 'getMany', action: 'List attachments on a ticket',           description: 'List all files attached to a ticket' },
          { name: 'Get',      value: 'get',     action: 'Get an attachment with download link',   description: 'Fetch a specific attachment and its signed download URL' },
        ],
        default: 'getMany',
      },

      // ══════════════════════════════════════════════════════════════════════
      // TICKET — CREATE
      // ══════════════════════════════════════════════════════════════════════
      {
        displayName: 'Summary',
        name: 'summary',
        type: 'string',
        required: true,
        default: '',
        description: 'Short subject line for the ticket',
        displayOptions: { show: { resource: ['ticket'], operation: ['create'] } },
      },
      {
        displayName: 'Ticket Type',
        name: 'ticketTypeId',
        type: 'options',
        typeOptions: { loadOptionsMethod: 'getTicketTypes' },
        required: true,
        default: '',
        description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
        displayOptions: { show: { resource: ['ticket'], operation: ['create'] } },
      },
      {
        displayName: 'Client',
        name: 'clientId',
        type: 'options',
        typeOptions: { loadOptionsMethod: 'getClients' },
        default: '',
        description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
        displayOptions: { show: { resource: ['ticket'], operation: ['create'] } },
      },
      {
        displayName: 'Priority',
        name: 'priorityId',
        type: 'options',
        typeOptions: { loadOptionsMethod: 'getPriorities' },
        default: '',
        description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
        displayOptions: { show: { resource: ['ticket'], operation: ['create'] } },
      },
      {
        displayName: 'Details',
        name: 'details',
        type: 'string',
        typeOptions: { rows: 5 },
        default: '',
        description: 'Full ticket description. HTML is supported.',
        displayOptions: { show: { resource: ['ticket'], operation: ['create'] } },
      },
      {
        displayName: 'Additional Fields',
        name: 'additionalFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: { show: { resource: ['ticket'], operation: ['create'] } },
        options: [
          {
            displayName: 'Assigned Agent',
            name: 'agentId',
            type: 'options',
            typeOptions: { loadOptionsMethod: 'getAgents' },
            default: '',
          },
          {
            displayName: 'Assigned Team',
            name: 'teamId',
            type: 'options',
            typeOptions: { loadOptionsMethod: 'getTeams' },
            default: '',
          },
          {
            displayName: 'Date Occurred',
            name: 'dateOccurred',
            type: 'dateTime',
            default: '',
            description: 'When the issue occurred (defaults to now if blank)',
          },
          {
            displayName: "Don't Run Automation Rules",
            name: 'dontDoRules',
            type: 'boolean',
            default: false,
          },
          {
            displayName: 'Due Date',
            name: 'dueBy',
            type: 'dateTime',
            default: '',
          },
          {
            displayName: 'Parent Ticket ID',
            name: 'parentId',
            type: 'number',
            default: 0,
            description: 'ID of the parent ticket — use when creating a child/task ticket',
          },
          {
            displayName: 'Site',
            name: 'siteId',
            type: 'options',
            typeOptions: { loadOptionsMethod: 'getSites' },
            default: '',
          },
          {
            displayName: 'Status',
            name: 'statusId',
            type: 'options',
            typeOptions: { loadOptionsMethod: 'getStatuses' },
            default: '',
            description: 'Override the default starting status',
          },
          {
            displayName: 'Tags',
            name: 'tags',
            type: 'string',
            default: '',
            placeholder: 'networking, firewall, urgent',
            description: 'Comma-separated list of tags',
          },
          {
            displayName: 'User / Contact',
            name: 'userId',
            type: 'options',
            typeOptions: { loadOptionsMethod: 'getUsers' },
            default: '',
            description: 'End-user who reported the issue',
          },
        ],
      },

      // ══════════════════════════════════════════════════════════════════════
      // TICKET — GET
      // ══════════════════════════════════════════════════════════════════════
      {
        displayName: 'Ticket ID',
        name: 'ticketId',
        type: 'number',
        required: true,
        default: 0,
        displayOptions: { show: { resource: ['ticket'], operation: ['get', 'update'] } },
      },

      // ══════════════════════════════════════════════════════════════════════
      // TICKET — SEARCH
      // ══════════════════════════════════════════════════════════════════════
      {
        displayName: 'Search Query',
        name: 'searchQuery',
        type: 'string',
        default: '',
        placeholder: 'firewall offline',
        description: 'Text to search across ticket summaries and details',
        displayOptions: { show: { resource: ['ticket'], operation: ['search'] } },
      },
      {
        displayName: 'Filters',
        name: 'filters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        displayOptions: { show: { resource: ['ticket'], operation: ['search'] } },
        options: [
          {
            displayName: 'Client',
            name: 'clientId',
            type: 'options',
            typeOptions: { loadOptionsMethod: 'getClients' },
            default: '',
          },
          {
            displayName: 'Date From',
            name: 'dateFrom',
            type: 'dateTime',
            default: '',
          },
          {
            displayName: 'Date To',
            name: 'dateTo',
            type: 'dateTime',
            default: '',
          },
          {
            displayName: 'Results Limit',
            name: 'limit',
            type: 'number',
            default: 50,
            description: 'Max number of tickets to return (1–500)',
            typeOptions: { minValue: 1, maxValue: 500 },
          },
          {
            displayName: 'Status',
            name: 'statusId',
            type: 'options',
            typeOptions: { loadOptionsMethod: 'getStatuses' },
            default: '',
          },
          {
            displayName: 'Team',
            name: 'teamId',
            type: 'options',
            typeOptions: { loadOptionsMethod: 'getTeams' },
            default: '',
          },
          {
            displayName: 'Ticket Type',
            name: 'ticketTypeId',
            type: 'options',
            typeOptions: { loadOptionsMethod: 'getTicketTypes' },
            default: '',
          },
          {
            displayName: 'Agent',
            name: 'agentId',
            type: 'options',
            typeOptions: { loadOptionsMethod: 'getAgents' },
            default: '',
          },
        ],
      },

      // ══════════════════════════════════════════════════════════════════════
      // TICKET — UPDATE
      // ══════════════════════════════════════════════════════════════════════
      {
        displayName: 'Fields to Update',
        name: 'fieldsToUpdate',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        description: 'Only fields added here will be changed — everything else is left as-is',
        displayOptions: { show: { resource: ['ticket'], operation: ['update'] } },
        options: [
          {
            displayName: 'Assigned Agent',
            name: 'agentId',
            type: 'options',
            typeOptions: { loadOptionsMethod: 'getAgents' },
            default: '',
          },
          {
            displayName: 'Assigned Team',
            name: 'teamId',
            type: 'options',
            typeOptions: { loadOptionsMethod: 'getTeams' },
            default: '',
          },
          {
            displayName: 'Details',
            name: 'details',
            type: 'string',
            typeOptions: { rows: 4 },
            default: '',
          },
          {
            displayName: 'Due Date',
            name: 'dueBy',
            type: 'dateTime',
            default: '',
          },
          {
            displayName: 'Priority',
            name: 'priorityId',
            type: 'options',
            typeOptions: { loadOptionsMethod: 'getPriorities' },
            default: '',
          },
          {
            displayName: 'Status',
            name: 'statusId',
            type: 'options',
            typeOptions: { loadOptionsMethod: 'getStatuses' },
            default: '',
          },
          {
            displayName: 'Summary',
            name: 'summary',
            type: 'string',
            default: '',
          },
          {
            displayName: 'Tags',
            name: 'tags',
            type: 'string',
            default: '',
            placeholder: 'networking, resolved',
            description: 'Comma-separated — replaces all existing tags',
          },
        ],
      },

      // ══════════════════════════════════════════════════════════════════════
      // ACTION — TICKET ID (shared by addNote + getMany)
      // ══════════════════════════════════════════════════════════════════════
      {
        displayName: 'Ticket ID',
        name: 'ticketId',
        type: 'number',
        required: true,
        default: 0,
        displayOptions: { show: { resource: ['action'] } },
      },

      // ══════════════════════════════════════════════════════════════════════
      // ACTION — ADD NOTE
      // ══════════════════════════════════════════════════════════════════════
      {
        displayName: 'Note',
        name: 'note',
        type: 'string',
        typeOptions: { rows: 5 },
        required: true,
        default: '',
        description: 'Note content. HTML is supported.',
        displayOptions: { show: { resource: ['action'], operation: ['addNote'] } },
      },
      {
        displayName: 'Private / Internal Only',
        name: 'privateNote',
        type: 'boolean',
        default: true,
        description: 'Whether to hide this note from the client — turn off to make it customer-visible',
        displayOptions: { show: { resource: ['action'], operation: ['addNote'] } },
      },
      {
        displayName: 'Agent',
        name: 'agentId',
        type: 'options',
        typeOptions: { loadOptionsMethod: 'getAgents' },
        default: '',
        description: 'Agent posting the note — defaults to the API credential owner if blank',
        displayOptions: { show: { resource: ['action'], operation: ['addNote'] } },
      },

      // ══════════════════════════════════════════════════════════════════════
      // ACTION — GET MANY
      // ══════════════════════════════════════════════════════════════════════
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: { show: { resource: ['action'], operation: ['getMany'] } },
        options: [
          {
            displayName: 'Results Limit',
            name: 'limit',
            type: 'number',
            default: 50,
          },
        ],
      },

      // ══════════════════════════════════════════════════════════════════════
      // ATTACHMENT — TICKET ID (for getMany)
      // ══════════════════════════════════════════════════════════════════════
      {
        displayName: 'Ticket ID',
        name: 'ticketId',
        type: 'number',
        required: true,
        default: 0,
        displayOptions: { show: { resource: ['attachment'], operation: ['getMany'] } },
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: { show: { resource: ['attachment'], operation: ['getMany'] } },
        options: [
          {
            displayName: 'Include Details',
            name: 'includeDetails',
            type: 'boolean',
            default: true,
            description: 'Whether to include metadata like filename, size, and description',
          },
        ],
      },

      // ══════════════════════════════════════════════════════════════════════
      // ATTACHMENT — GET
      // ══════════════════════════════════════════════════════════════════════
      {
        displayName: 'Attachment ID',
        name: 'attachmentId',
        type: 'number',
        required: true,
        default: 0,
        description: 'The ID of the attachment to fetch — returns the file metadata and signed download link',
        displayOptions: { show: { resource: ['attachment'], operation: ['get'] } },
      },
    ],
  };

  // ── Dynamic dropdowns ──────────────────────────────────────────────────────
  methods = {
    loadOptions: {
      async getTicketTypes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const c = await this.getCredentials('haloPsaApi');
        const token = await getToken(this.helpers, c.subdomain as string, c.clientId as string, c.clientSecret as string, (c.scope as string) || 'all');
        const data = await haloRequest(this.helpers, c.subdomain as string, token, 'GET', '/api/TicketType', undefined, { page_size: 500 });
        return toOptions(data.tickettypes ?? data, (t) => t.name);
      },

      async getClients(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const c = await this.getCredentials('haloPsaApi');
        const token = await getToken(this.helpers, c.subdomain as string, c.clientId as string, c.clientSecret as string, (c.scope as string) || 'all');
        const data = await haloRequest(this.helpers, c.subdomain as string, token, 'GET', '/api/Client', undefined, { page_size: 500 });
        return toOptions(data.clients ?? data, (c) => c.name);
      },

      async getPriorities(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const c = await this.getCredentials('haloPsaApi');
        const token = await getToken(this.helpers, c.subdomain as string, c.clientId as string, c.clientSecret as string, (c.scope as string) || 'all');
        const data = await haloRequest(this.helpers, c.subdomain as string, token, 'GET', '/api/Priority', undefined, { page_size: 500 });
        return toOptions(data.priorities ?? data, (p) => p.name);
      },

      async getStatuses(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const c = await this.getCredentials('haloPsaApi');
        const token = await getToken(this.helpers, c.subdomain as string, c.clientId as string, c.clientSecret as string, (c.scope as string) || 'all');
        const data = await haloRequest(this.helpers, c.subdomain as string, token, 'GET', '/api/Status', undefined, { page_size: 500 });
        return toOptions(data.statuses ?? data, (s) => s.name);
      },

      async getAgents(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const c = await this.getCredentials('haloPsaApi');
        const token = await getToken(this.helpers, c.subdomain as string, c.clientId as string, c.clientSecret as string, (c.scope as string) || 'all');
        const data = await haloRequest(this.helpers, c.subdomain as string, token, 'GET', '/api/Agent', undefined, { page_size: 500 });
        return toOptions(data.agents ?? data, (a) => a.name);
      },

      async getTeams(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const c = await this.getCredentials('haloPsaApi');
        const token = await getToken(this.helpers, c.subdomain as string, c.clientId as string, c.clientSecret as string, (c.scope as string) || 'all');
        const data = await haloRequest(this.helpers, c.subdomain as string, token, 'GET', '/api/Team', undefined, { page_size: 500 });
        return toOptions(data.teams ?? data, (t) => t.name);
      },

      async getSites(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const c = await this.getCredentials('haloPsaApi');
        const token = await getToken(this.helpers, c.subdomain as string, c.clientId as string, c.clientSecret as string, (c.scope as string) || 'all');
        const data = await haloRequest(this.helpers, c.subdomain as string, token, 'GET', '/api/Site', undefined, { page_size: 500 });
        return toOptions(data.sites ?? data, (s) => s.clientsite_name || s.name);
      },

      async getUsers(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const c = await this.getCredentials('haloPsaApi');
        const token = await getToken(this.helpers, c.subdomain as string, c.clientId as string, c.clientSecret as string, (c.scope as string) || 'all');
        const data = await haloRequest(this.helpers, c.subdomain as string, token, 'GET', '/api/Users', undefined, { page_size: 500 });
        return toOptions(data.users ?? data, (u) =>
          u.name || [u.firstname, u.surname].filter(Boolean).join(' ') || `User ${u.id}`,
        );
      },
    },
  };

  // ── Execute ────────────────────────────────────────────────────────────────
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const creds    = await this.getCredentials('haloPsaApi');
    const subdomain = creds.subdomain as string;
    const token    = await getToken(this.helpers, subdomain, creds.clientId as string, creds.clientSecret as string, (creds.scope as string) || 'all');

    for (let i = 0; i < items.length; i++) {
      try {
        const resource  = this.getNodeParameter('resource', i)  as string;
        const operation = this.getNodeParameter('operation', i) as string;

        let responseData: any;

        // ── Ticket ────────────────────────────────────────────────────────
        if (resource === 'ticket') {

          if (operation === 'create') {
            const summary      = this.getNodeParameter('summary', i) as string;
            const ticketTypeId = this.getNodeParameter('ticketTypeId', i) as number;
            const clientId     = this.getNodeParameter('clientId', i, '') as number | '';
            const priorityId   = this.getNodeParameter('priorityId', i, '') as number | '';
            const details      = this.getNodeParameter('details', i, '') as string;
            const af           = this.getNodeParameter('additionalFields', i, {}) as Record<string, any>;

            const body: Record<string, any> = {
              summary,
              tickettype_id: ticketTypeId,
              dont_do_rules: af.dontDoRules ?? false,
            };
            if (clientId)       body.client_id    = clientId;
            if (priorityId)     body.priority_id  = priorityId;
            if (details)        body.details      = details;
            if (af.statusId)    body.status_id    = af.statusId;
            if (af.agentId)     body.agent_id     = af.agentId;
            if (af.teamId)      body.team_id      = af.teamId;
            if (af.siteId)      body.site_id      = af.siteId;
            if (af.userId)      body.user_id      = af.userId;
            if (af.parentId)    body.parent_id    = af.parentId;
            if (af.dueBy)       body.dueby        = af.dueBy;
            if (af.dateOccurred) body.dateoccurred = af.dateOccurred;
            if (af.tags)        body.tags         = normalizeTags(af.tags);

            responseData = await haloRequest(this.helpers, subdomain, token, 'POST', '/api/Tickets', [body]);

          } else if (operation === 'get') {
            const ticketId = this.getNodeParameter('ticketId', i) as number;
            responseData = await haloRequest(this.helpers, subdomain, token, 'GET', `/api/Tickets/${ticketId}`);

          } else if (operation === 'search') {
            const searchQuery = this.getNodeParameter('searchQuery', i, '') as string;
            const filters     = this.getNodeParameter('filters', i, {}) as Record<string, any>;

            const rawLimit = (filters.limit as number) ?? 50;
            const qs: Record<string, any> = { page_size: Math.min(Math.max(rawLimit, 1), 500), page_no: 1 };
            if (searchQuery)       qs.search         = searchQuery;
            if (filters.clientId)  qs.client_id      = filters.clientId;
            if (filters.statusId)  qs.status_id      = filters.statusId;
            if (filters.ticketTypeId) qs.tickettype_id = filters.ticketTypeId;
            if (filters.agentId)   qs.agent_id       = filters.agentId;
            if (filters.teamId)    qs.team_id        = filters.teamId;
            if (filters.dateFrom)  qs.startdate      = filters.dateFrom;
            if (filters.dateTo)    qs.enddate        = filters.dateTo;

            const resp = await haloRequest(this.helpers, subdomain, token, 'GET', '/api/Tickets', undefined, qs);
            responseData = resp.tickets ?? (Array.isArray(resp) ? resp : [resp]);

          } else if (operation === 'update') {
            const ticketId = this.getNodeParameter('ticketId', i) as number;
            const fu       = this.getNodeParameter('fieldsToUpdate', i, {}) as Record<string, any>;

            const body: Record<string, any> = { id: ticketId };
            if (fu.summary)    body.summary     = fu.summary;
            if (fu.details)    body.details     = fu.details;
            if (fu.statusId)   body.status_id   = fu.statusId;
            if (fu.priorityId) body.priority_id = fu.priorityId;
            if (fu.agentId)    body.agent_id    = fu.agentId;
            if (fu.teamId)     body.team_id     = fu.teamId;
            if (fu.dueBy)      body.dueby       = fu.dueBy;
            if (fu.tags)       body.tags        = normalizeTags(fu.tags);

            responseData = await haloRequest(this.helpers, subdomain, token, 'PUT', '/api/Tickets', [body]);
          }

        // ── Action ────────────────────────────────────────────────────────
        } else if (resource === 'action') {
          const ticketId = this.getNodeParameter('ticketId', i) as number;

          if (operation === 'addNote') {
            const note        = this.getNodeParameter('note', i) as string;
            const privateNote = this.getNodeParameter('privateNote', i, true) as boolean;
            const agentId     = this.getNodeParameter('agentId', i, '') as number | '';

            const body: Record<string, any> = {
              ticket_id: ticketId,
              outcome: 'Note',
              note,
              hiddenfromclient: privateNote,
            };
            if (agentId) body.agent_id = agentId;

            responseData = await haloRequest(this.helpers, subdomain, token, 'POST', '/api/Actions', [body]);

          } else if (operation === 'getMany') {
            const options = this.getNodeParameter('options', i, {}) as Record<string, any>;
            const qs = { ticket_id: ticketId, page_size: options.limit ?? 50, page_no: 1 };

            const resp = await haloRequest(this.helpers, subdomain, token, 'GET', '/api/Actions', undefined, qs);
            responseData = resp.actions ?? (Array.isArray(resp) ? resp : [resp]);
          }

        // ── Attachment ────────────────────────────────────────────────────
        } else if (resource === 'attachment') {

          if (operation === 'getMany') {
            const ticketId = this.getNodeParameter('ticketId', i) as number;
            const options  = this.getNodeParameter('options', i, {}) as Record<string, any>;

            const qs = { ticket_id: ticketId, includedetails: options.includeDetails !== false };
            const resp = await haloRequest(this.helpers, subdomain, token, 'GET', '/api/Attachment', undefined, qs);
            responseData = resp.attachments ?? (Array.isArray(resp) ? resp : [resp]);

          } else if (operation === 'get') {
            const attachmentId = this.getNodeParameter('attachmentId', i) as number;
            responseData = await haloRequest(this.helpers, subdomain, token, 'GET', `/api/Attachment/${attachmentId}`);
          }
        }

        // ── Normalise and push ─────────────────────────────────────────────
        const results: any[] = Array.isArray(responseData) ? responseData : [responseData];
        for (const result of results) {
          returnData.push({ json: result ?? {}, pairedItem: { item: i } });
        }

      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
          continue;
        }
        throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
      }
    }

    return [returnData];
  }
}
