export function buildOpenApiDocument() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Ai Saas Public API',
      version: '6.3.0',
      description:
        'V6 Phase 3 public API, webhook, and integration endpoints. Public API requests use tenant-scoped API keys sent as X-API-Key.',
    },
    servers: [
      { url: '/api', description: 'Current backend API prefix' },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
      schemas: {
        ClientCreate: {
          type: 'object',
          required: ['name', 'email'],
          properties: {
            name: { type: 'string', example: 'Acme Logistics' },
            email: { type: 'string', example: 'ops@acme.example' },
            company_name: { type: 'string', example: 'Acme Logistics LLC' },
            phone: { type: 'string', example: '+1 555 0100' },
            branch_id: { type: 'string', nullable: true },
          },
        },
        SiteCreate: {
          type: 'object',
          required: ['name', 'address'],
          properties: {
            name: { type: 'string', example: 'North Warehouse' },
            address: { type: 'string', example: '125 Market St, Austin, TX' },
            client_id: { type: 'string' },
            instructions: { type: 'string' },
            branch_id: { type: 'string', nullable: true },
          },
        },
        GuardCreate: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', example: 'Jordan Lee' },
            email: { type: 'string', example: 'jordan@example.com' },
            phone: { type: 'string', example: '+1 555 0199' },
            branch_id: { type: 'string', nullable: true },
          },
        },
        ShiftCreate: {
          type: 'object',
          required: ['site_id', 'start_time', 'end_time'],
          properties: {
            site_id: { type: 'string' },
            start_time: { type: 'string', format: 'date-time' },
            end_time: { type: 'string', format: 'date-time' },
            required_guards: { type: 'integer', example: 1 },
          },
        },
        IncidentCreate: {
          type: 'object',
          required: ['shift_id', 'guard_id', 'title', 'description', 'severity', 'occurred_at'],
          properties: {
            shift_id: { type: 'string' },
            guard_id: { type: 'string' },
            title: { type: 'string', example: 'Unauthorized access attempt' },
            description: { type: 'string' },
            severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            occurred_at: { type: 'string', format: 'date-time' },
            attachment_url: { type: 'string' },
            notes: { type: 'string' },
          },
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
    paths: {
      '/public/clients': {
        get: publicOperation('clients.read', 'List clients'),
        post: publicOperation('clients.write', 'Create client', 'ClientCreate'),
      },
      '/public/sites': {
        get: publicOperation('sites.read', 'List sites'),
        post: publicOperation('sites.write', 'Create site', 'SiteCreate'),
      },
      '/public/guards': {
        get: publicOperation('guards.read', 'List guards'),
        post: publicOperation('guards.write', 'Create guard', 'GuardCreate'),
      },
      '/public/shifts': {
        get: publicOperation('shifts.read', 'List shifts'),
        post: publicOperation('shifts.write', 'Create shift', 'ShiftCreate'),
      },
      '/public/shifts/{id}/assign': {
        post: {
          ...publicOperation('shifts.write', 'Assign guard to shift'),
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: jsonBody({
            type: 'object',
            required: ['guard_id'],
            properties: { guard_id: { type: 'string' } },
          }),
        },
      },
      '/public/incidents': {
        get: publicOperation('incidents.read', 'List incidents'),
        post: publicOperation('incidents.write', 'Create incident', 'IncidentCreate'),
      },
      '/public/invoices': {
        get: publicOperation('invoices.read', 'List invoices'),
      },
      '/public/reports': {
        get: publicOperation('reports.read', 'List daily service reports'),
      },
    },
    webhooks: {
      'client.created': webhookOperation(),
      'guard.created': webhookOperation(),
      'shift.created': webhookOperation(),
      'shift.assigned': webhookOperation(),
      'incident.created': webhookOperation(),
      'incident.approved': webhookOperation(),
      'invoice.generated': webhookOperation(),
      'invoice.paid': webhookOperation(),
    },
    'x-webhook-signature': {
      header: 'X-Ai-Saas-Signature',
      algorithm: 'HMAC-SHA256',
      signedPayload: 'timestamp + "." + raw JSON body',
      timestampHeader: 'X-Ai-Saas-Timestamp',
    },
  };
}

function publicOperation(permission: string, summary: string, schemaName?: string) {
  return {
    summary,
    description: `Requires public API permission: ${permission}`,
    security: [{ ApiKeyAuth: [] }],
    parameters: [
      {
        name: 'limit',
        in: 'query',
        required: false,
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      },
    ],
    ...(schemaName
      ? {
          requestBody: jsonBody({
            $ref: `#/components/schemas/${schemaName}`,
          }),
        }
      : {}),
    responses: {
      '200': { description: 'Successful response' },
      '201': { description: 'Created' },
      '401': { description: 'Missing or invalid API key' },
      '403': { description: 'API key lacks required permission, is revoked, or expired' },
      '429': { description: 'API key rate limit exceeded' },
    },
  };
}

function jsonBody(schema: Record<string, unknown>) {
  return {
    required: true,
    content: {
      'application/json': {
        schema,
      },
    },
  };
}

function webhookOperation() {
  return {
    post: {
      requestBody: {
        content: {
          'application/json': {
            example: {
              id: 'evt_123',
              type: 'client.created',
              tenant_id: 'tenant_123',
              created_at: '2026-06-05T00:00:00.000Z',
              data: {},
            },
          },
        },
      },
      responses: {
        '2XX': { description: 'Webhook receiver acknowledged delivery' },
      },
    },
  };
}
