const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GAFA AML Platform API',
      version: '2.0.0',
      description: `
**Global Association of Forensic Accountants — Anti-Money Laundering Tool**

RESTful API powering the GAFA AML platform. Provides endpoints for:
- **Authentication** — JWT-based login with role-based access  
- **Customer Management** — CRUD + AML Watcher screening  
- **Transaction Monitoring** — Ingestion, flagging, rule engine  
- **Alert System** — Auto-generated alerts from rule violations  
- **Investigations** — Case management and SAR drafting  
- **Admin** — User management, system health, audit logs

All protected endpoints require a Bearer JWT token in the Authorization header.
      `,
      contact: {
        name: 'GAFA Development Team',
      },
    },
    servers: [
      { url: '/api', description: 'API Base Path' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/auth/login',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Something went wrong' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'analyst@gafa.org' },
            password: { type: 'string', minLength: 6, example: 'securePassword123' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            user: { $ref: '#/components/schemas/User' },
            role: { type: 'string', enum: ['admin', 'investigator', 'student', 'exam'] },
            token: { type: 'string' },
          },
        },
        Customer: {
          type: 'object',
          properties: {
            customer_id: { type: 'string', example: 'CUST-001' },
            name: { type: 'string', example: 'John Doe' },
            account_number: { type: 'string' },
            country: { type: 'string', example: 'India' },
            occupation: { type: 'string' },
            income: { type: 'number' },
            pep_flag: { type: 'boolean' },
            date_of_birth: { type: 'string', format: 'date' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            transaction_id: { type: 'string', example: 'TXN-20240101-001' },
            customer_id: { type: 'string' },
            amount: { type: 'number', example: 95000 },
            transaction_date: { type: 'string', format: 'date-time' },
            transaction_type: { type: 'string', example: 'wire_transfer' },
            country: { type: 'string', example: 'Iran' },
            country_risk_level: { type: 'string', enum: ['Low', 'Medium', 'High'] },
            flagged: { type: 'boolean' },
            flag_reason: { type: 'string' },
            rule_triggered: { type: 'string' },
            risk_score: { type: 'integer', minimum: 0, maximum: 100 },
          },
        },
        Alert: {
          type: 'object',
          properties: {
            alert_id: { type: 'string' },
            customer_id: { type: 'string' },
            customer_name: { type: 'string' },
            risk_level: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
            rule_triggered: { type: 'string' },
            status: { type: 'string', enum: ['open', 'investigating', 'escalated', 'closed_false_positive'] },
            amount: { type: 'number' },
            country: { type: 'string' },
          },
        },
        Rule: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string', example: 'Geographic Risk' },
            description: { type: 'string' },
            threshold: { type: 'string' },
            status: { type: 'string', enum: ['active', 'inactive'] },
          },
        },
        Investigation: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            case_id: { type: 'string', example: 'CASE-1713100000000' },
            customer_id: { type: 'string' },
            alert_type: { type: 'string' },
            status: { type: 'string', enum: ['open', 'investigating', 'escalated', 'draft_sar', 'closed_false_positive'] },
            investigation_notes: { type: 'string' },
          },
        },
        HealthCheck: {
          type: 'object',
          properties: {
            api: { type: 'string', enum: ['online', 'offline'] },
            db: { type: 'string', enum: ['online', 'offline'] },
            ml: { type: 'string', enum: ['online', 'offline'] },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        AdminCreateUser: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
            role: { type: 'string', enum: ['student', 'investigator', 'admin', 'exam'], default: 'student' },
          },
        },
        ScreeningRequest: {
          type: 'object',
          required: ['full_name'],
          properties: {
            full_name: { type: 'string', example: 'Narendra Modi' },
            dob: { type: 'string', format: 'date' },
            country: { type: 'string', example: 'IN' },
            entity_type: { type: 'string', enum: ['person', 'entity'], default: 'person' },
            filters: {
              type: 'object',
              properties: {
                types: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
