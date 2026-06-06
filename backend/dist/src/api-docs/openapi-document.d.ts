export declare function buildOpenApiDocument(): {
    openapi: string;
    info: {
        title: string;
        version: string;
        description: string;
    };
    servers: {
        url: string;
        description: string;
    }[];
    components: {
        securitySchemes: {
            ApiKeyAuth: {
                type: string;
                in: string;
                name: string;
            };
        };
        schemas: {
            ClientCreate: {
                type: string;
                required: string[];
                properties: {
                    name: {
                        type: string;
                        example: string;
                    };
                    email: {
                        type: string;
                        example: string;
                    };
                    company_name: {
                        type: string;
                        example: string;
                    };
                    phone: {
                        type: string;
                        example: string;
                    };
                    branch_id: {
                        type: string;
                        nullable: boolean;
                    };
                };
            };
            SiteCreate: {
                type: string;
                required: string[];
                properties: {
                    name: {
                        type: string;
                        example: string;
                    };
                    address: {
                        type: string;
                        example: string;
                    };
                    client_id: {
                        type: string;
                    };
                    instructions: {
                        type: string;
                    };
                    branch_id: {
                        type: string;
                        nullable: boolean;
                    };
                };
            };
            GuardCreate: {
                type: string;
                required: string[];
                properties: {
                    name: {
                        type: string;
                        example: string;
                    };
                    email: {
                        type: string;
                        example: string;
                    };
                    phone: {
                        type: string;
                        example: string;
                    };
                    branch_id: {
                        type: string;
                        nullable: boolean;
                    };
                };
            };
            ShiftCreate: {
                type: string;
                required: string[];
                properties: {
                    site_id: {
                        type: string;
                    };
                    start_time: {
                        type: string;
                        format: string;
                    };
                    end_time: {
                        type: string;
                        format: string;
                    };
                    required_guards: {
                        type: string;
                        example: number;
                    };
                };
            };
            IncidentCreate: {
                type: string;
                required: string[];
                properties: {
                    shift_id: {
                        type: string;
                    };
                    guard_id: {
                        type: string;
                    };
                    title: {
                        type: string;
                        example: string;
                    };
                    description: {
                        type: string;
                    };
                    severity: {
                        type: string;
                        enum: string[];
                    };
                    occurred_at: {
                        type: string;
                        format: string;
                    };
                    attachment_url: {
                        type: string;
                    };
                    notes: {
                        type: string;
                    };
                };
            };
        };
    };
    security: {
        ApiKeyAuth: never[];
    }[];
    paths: {
        '/public/clients': {
            get: {
                responses: {
                    '200': {
                        description: string;
                    };
                    '201': {
                        description: string;
                    };
                    '401': {
                        description: string;
                    };
                    '403': {
                        description: string;
                    };
                    '429': {
                        description: string;
                    };
                };
                requestBody?: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: Record<string, unknown>;
                        };
                    };
                } | undefined;
                summary: string;
                description: string;
                security: {
                    ApiKeyAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        minimum: number;
                        maximum: number;
                        default: number;
                    };
                }[];
            };
            post: {
                responses: {
                    '200': {
                        description: string;
                    };
                    '201': {
                        description: string;
                    };
                    '401': {
                        description: string;
                    };
                    '403': {
                        description: string;
                    };
                    '429': {
                        description: string;
                    };
                };
                requestBody?: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: Record<string, unknown>;
                        };
                    };
                } | undefined;
                summary: string;
                description: string;
                security: {
                    ApiKeyAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        minimum: number;
                        maximum: number;
                        default: number;
                    };
                }[];
            };
        };
        '/public/sites': {
            get: {
                responses: {
                    '200': {
                        description: string;
                    };
                    '201': {
                        description: string;
                    };
                    '401': {
                        description: string;
                    };
                    '403': {
                        description: string;
                    };
                    '429': {
                        description: string;
                    };
                };
                requestBody?: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: Record<string, unknown>;
                        };
                    };
                } | undefined;
                summary: string;
                description: string;
                security: {
                    ApiKeyAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        minimum: number;
                        maximum: number;
                        default: number;
                    };
                }[];
            };
            post: {
                responses: {
                    '200': {
                        description: string;
                    };
                    '201': {
                        description: string;
                    };
                    '401': {
                        description: string;
                    };
                    '403': {
                        description: string;
                    };
                    '429': {
                        description: string;
                    };
                };
                requestBody?: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: Record<string, unknown>;
                        };
                    };
                } | undefined;
                summary: string;
                description: string;
                security: {
                    ApiKeyAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        minimum: number;
                        maximum: number;
                        default: number;
                    };
                }[];
            };
        };
        '/public/guards': {
            get: {
                responses: {
                    '200': {
                        description: string;
                    };
                    '201': {
                        description: string;
                    };
                    '401': {
                        description: string;
                    };
                    '403': {
                        description: string;
                    };
                    '429': {
                        description: string;
                    };
                };
                requestBody?: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: Record<string, unknown>;
                        };
                    };
                } | undefined;
                summary: string;
                description: string;
                security: {
                    ApiKeyAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        minimum: number;
                        maximum: number;
                        default: number;
                    };
                }[];
            };
            post: {
                responses: {
                    '200': {
                        description: string;
                    };
                    '201': {
                        description: string;
                    };
                    '401': {
                        description: string;
                    };
                    '403': {
                        description: string;
                    };
                    '429': {
                        description: string;
                    };
                };
                requestBody?: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: Record<string, unknown>;
                        };
                    };
                } | undefined;
                summary: string;
                description: string;
                security: {
                    ApiKeyAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        minimum: number;
                        maximum: number;
                        default: number;
                    };
                }[];
            };
        };
        '/public/shifts': {
            get: {
                responses: {
                    '200': {
                        description: string;
                    };
                    '201': {
                        description: string;
                    };
                    '401': {
                        description: string;
                    };
                    '403': {
                        description: string;
                    };
                    '429': {
                        description: string;
                    };
                };
                requestBody?: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: Record<string, unknown>;
                        };
                    };
                } | undefined;
                summary: string;
                description: string;
                security: {
                    ApiKeyAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        minimum: number;
                        maximum: number;
                        default: number;
                    };
                }[];
            };
            post: {
                responses: {
                    '200': {
                        description: string;
                    };
                    '201': {
                        description: string;
                    };
                    '401': {
                        description: string;
                    };
                    '403': {
                        description: string;
                    };
                    '429': {
                        description: string;
                    };
                };
                requestBody?: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: Record<string, unknown>;
                        };
                    };
                } | undefined;
                summary: string;
                description: string;
                security: {
                    ApiKeyAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        minimum: number;
                        maximum: number;
                        default: number;
                    };
                }[];
            };
        };
        '/public/shifts/{id}/assign': {
            post: {
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: Record<string, unknown>;
                        };
                    };
                };
                responses: {
                    '200': {
                        description: string;
                    };
                    '201': {
                        description: string;
                    };
                    '401': {
                        description: string;
                    };
                    '403': {
                        description: string;
                    };
                    '429': {
                        description: string;
                    };
                };
                summary: string;
                description: string;
                security: {
                    ApiKeyAuth: never[];
                }[];
            };
        };
        '/public/incidents': {
            get: {
                responses: {
                    '200': {
                        description: string;
                    };
                    '201': {
                        description: string;
                    };
                    '401': {
                        description: string;
                    };
                    '403': {
                        description: string;
                    };
                    '429': {
                        description: string;
                    };
                };
                requestBody?: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: Record<string, unknown>;
                        };
                    };
                } | undefined;
                summary: string;
                description: string;
                security: {
                    ApiKeyAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        minimum: number;
                        maximum: number;
                        default: number;
                    };
                }[];
            };
            post: {
                responses: {
                    '200': {
                        description: string;
                    };
                    '201': {
                        description: string;
                    };
                    '401': {
                        description: string;
                    };
                    '403': {
                        description: string;
                    };
                    '429': {
                        description: string;
                    };
                };
                requestBody?: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: Record<string, unknown>;
                        };
                    };
                } | undefined;
                summary: string;
                description: string;
                security: {
                    ApiKeyAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        minimum: number;
                        maximum: number;
                        default: number;
                    };
                }[];
            };
        };
        '/public/invoices': {
            get: {
                responses: {
                    '200': {
                        description: string;
                    };
                    '201': {
                        description: string;
                    };
                    '401': {
                        description: string;
                    };
                    '403': {
                        description: string;
                    };
                    '429': {
                        description: string;
                    };
                };
                requestBody?: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: Record<string, unknown>;
                        };
                    };
                } | undefined;
                summary: string;
                description: string;
                security: {
                    ApiKeyAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        minimum: number;
                        maximum: number;
                        default: number;
                    };
                }[];
            };
        };
        '/public/reports': {
            get: {
                responses: {
                    '200': {
                        description: string;
                    };
                    '201': {
                        description: string;
                    };
                    '401': {
                        description: string;
                    };
                    '403': {
                        description: string;
                    };
                    '429': {
                        description: string;
                    };
                };
                requestBody?: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: Record<string, unknown>;
                        };
                    };
                } | undefined;
                summary: string;
                description: string;
                security: {
                    ApiKeyAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        minimum: number;
                        maximum: number;
                        default: number;
                    };
                }[];
            };
        };
    };
    webhooks: {
        'client.created': {
            post: {
                requestBody: {
                    content: {
                        'application/json': {
                            example: {
                                id: string;
                                type: string;
                                tenant_id: string;
                                created_at: string;
                                data: {};
                            };
                        };
                    };
                };
                responses: {
                    '2XX': {
                        description: string;
                    };
                };
            };
        };
        'guard.created': {
            post: {
                requestBody: {
                    content: {
                        'application/json': {
                            example: {
                                id: string;
                                type: string;
                                tenant_id: string;
                                created_at: string;
                                data: {};
                            };
                        };
                    };
                };
                responses: {
                    '2XX': {
                        description: string;
                    };
                };
            };
        };
        'shift.created': {
            post: {
                requestBody: {
                    content: {
                        'application/json': {
                            example: {
                                id: string;
                                type: string;
                                tenant_id: string;
                                created_at: string;
                                data: {};
                            };
                        };
                    };
                };
                responses: {
                    '2XX': {
                        description: string;
                    };
                };
            };
        };
        'shift.assigned': {
            post: {
                requestBody: {
                    content: {
                        'application/json': {
                            example: {
                                id: string;
                                type: string;
                                tenant_id: string;
                                created_at: string;
                                data: {};
                            };
                        };
                    };
                };
                responses: {
                    '2XX': {
                        description: string;
                    };
                };
            };
        };
        'incident.created': {
            post: {
                requestBody: {
                    content: {
                        'application/json': {
                            example: {
                                id: string;
                                type: string;
                                tenant_id: string;
                                created_at: string;
                                data: {};
                            };
                        };
                    };
                };
                responses: {
                    '2XX': {
                        description: string;
                    };
                };
            };
        };
        'incident.approved': {
            post: {
                requestBody: {
                    content: {
                        'application/json': {
                            example: {
                                id: string;
                                type: string;
                                tenant_id: string;
                                created_at: string;
                                data: {};
                            };
                        };
                    };
                };
                responses: {
                    '2XX': {
                        description: string;
                    };
                };
            };
        };
        'invoice.generated': {
            post: {
                requestBody: {
                    content: {
                        'application/json': {
                            example: {
                                id: string;
                                type: string;
                                tenant_id: string;
                                created_at: string;
                                data: {};
                            };
                        };
                    };
                };
                responses: {
                    '2XX': {
                        description: string;
                    };
                };
            };
        };
        'invoice.paid': {
            post: {
                requestBody: {
                    content: {
                        'application/json': {
                            example: {
                                id: string;
                                type: string;
                                tenant_id: string;
                                created_at: string;
                                data: {};
                            };
                        };
                    };
                };
                responses: {
                    '2XX': {
                        description: string;
                    };
                };
            };
        };
    };
    'x-webhook-signature': {
        header: string;
        algorithm: string;
        signedPayload: string;
        timestampHeader: string;
    };
};
