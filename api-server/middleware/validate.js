const Joi = require('joi');

/**
 * Middleware factory — validates req.body against a Joi schema.
 * Usage: router.post('/endpoint', validate(mySchema), handler)
 */
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,     // Report all errors, not just the first
      stripUnknown: true,    // Remove fields not in the schema
      allowUnknown: false,   // Reject unknown fields
    });

    if (error) {
      const details = error.details.map(d => d.message).join('; ');
      return res.status(400).json({
        error: 'Validation failed',
        details,
        fields: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
    }

    req.body = value; // Use the sanitized value
    next();
  };
}

/**
 * Middleware factory — validates req.query against a Joi schema.
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: true,
    });

    if (error) {
      const details = error.details.map(d => d.message).join('; ');
      return res.status(400).json({ error: 'Invalid query parameters', details });
    }

    req.query = value;
    next();
  };
}

// ============================================================
// Validation Schemas
// ============================================================

const schemas = {
  // --- Auth ---
  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': 'Password must be at least 6 characters',
      'any.required': 'Password is required',
    }),
  }),

  signup: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('student', 'investigator', 'exam').default('student'),
  }),

  // --- Admin ---
  adminCreateUser: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8)
      .pattern(/[A-Z]/, 'uppercase letter')
      .pattern(/[a-z]/, 'lowercase letter')
      .pattern(/[0-9]/, 'number')
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters',
        'string.pattern.name': 'Password must contain at least one {#name}',
      }),
    role: Joi.string().valid('student', 'investigator', 'admin', 'exam').default('student'),
  }),

  adminUpdateRole: Joi.object({
    role: Joi.string().valid('student', 'investigator', 'admin', 'exam').required(),
  }),

  // --- Alert ---
  updateAlertStatus: Joi.object({
    status: Joi.string().valid('open', 'investigating', 'escalated', 'closed_false_positive').required(),
    case_id: Joi.string().allow(null, '').optional(),
  }),

  // --- Rule ---
  toggleRuleStatus: Joi.object({
    status: Joi.string().valid('active', 'inactive').required(),
  }),

  // --- Investigation ---
  createInvestigation: Joi.object({
    case_id: Joi.string().required(),
    customer_id: Joi.string().required(),
    alert_id: Joi.string().allow(null, '').optional(),
    alert_type: Joi.string().allow(null, '').optional(),
    status: Joi.string().valid('open', 'investigating', 'escalated', 'draft_sar', 'closed_false_positive').default('open'),
    investigation_notes: Joi.string().allow(null, '').optional(),
  }),

  updateInvestigation: Joi.object({
    status: Joi.string().valid('open', 'investigating', 'escalated', 'draft_sar', 'closed_false_positive').optional(),
    investigation_notes: Joi.string().allow(null, '').optional(),
    decision: Joi.string().allow(null, '').optional(),
  }),

  // --- Screening ---
  manualScreen: Joi.object({
    full_name: Joi.string().min(2).required().messages({
      'any.required': 'Name is required for screening',
      'string.min': 'Name must be at least 2 characters',
    }),
    dob: Joi.string().allow(null, '').optional(),
    country: Joi.string().allow(null, '').optional(),
    entity_type: Joi.string().valid('person', 'entity').default('person'),
    filters: Joi.object().optional(),
    search_type: Joi.string().optional(),
    category: Joi.string().optional(),
  }).unknown(true), // Allow extra AML Watcher fields
};

module.exports = { validate, validateQuery, schemas };
