/**
 * Joi validation schemas for user (therapist) create and update operations.
 *
 * Phone number rules:
 *   - Strip all non-numeric characters except a leading '+' (e.g. spaces, dashes, parentheses).
 *   - After cleaning, the numeric portion must be 9–15 digits long (ITU-T E.164 range).
 *
 * Email rules:
 *   - Must be a syntactically valid email address.
 *   - Automatically converted to lowercase before storage.
 *   - Optional — existing records without an email are unaffected.
 */

const Joi = require('joi');

// Removes non-numeric characters except a single leading '+'.
const sanitizePhone = (raw) => {
    if (!raw) return raw;
    const leading = raw.startsWith('+') ? '+' : '';
    const digits  = raw.replace(/\D/g, '');
    return leading + digits;
};

// Reusable Joi extension for phone numbers.
const phoneSchema = Joi.string()
    .custom((value, helpers) => {
        const cleaned = sanitizePhone(value);
        const digitCount = cleaned.replace(/^\+/, '').length;
        if (digitCount < 9 || digitCount > 15) {
            return helpers.error('phone.length');
        }
        return cleaned; // Return the sanitized value so callers receive the clean string
    })
    .optional()
    .allow('', null)
    .messages({
        'phone.length': 'Phone number must contain 9–15 digits (a leading + is allowed)',
    });

// Reusable Joi extension for email.
const emailSchema = Joi.string()
    .email({ tlds: { allow: false } }) // Skip TLD validation — avoids rejecting .local / internal domains
    .lowercase()
    .max(255)
    .optional()
    .allow('', null);

// Schema used by POST /api/owner/create-therapist
const createTherapistSchema = Joi.object({
    username:    Joi.string().alphanum().min(3).max(50).required()
                    .messages({ 'string.alphanum': 'Username may only contain letters and numbers' }),
    firstName:   Joi.string().trim().min(1).max(100).required(),
    lastName:    Joi.string().trim().min(1).max(100).required(),
    email:       emailSchema,
    phoneNumber: phoneSchema,
});

// Schema used by PUT /api/owner/therapists/:username
const updateTherapistSchema = Joi.object({
    firstName:   Joi.string().trim().min(1).max(100).required(),
    lastName:    Joi.string().trim().min(1).max(100).required(),
    email:       emailSchema,
    phoneNumber: phoneSchema,
    // Legacy snake_case aliases sent by some older client versions
    first_name:  Joi.string().trim().min(1).max(100).optional(),
    last_name:   Joi.string().trim().min(1).max(100).optional(),
});

/**
 * Express middleware factory.
 * Usage: router.post('/route', validate(createTherapistSchema), handler)
 *
 * On failure returns HTTP 422 with a structured error list so the frontend
 * can map each message back to its field.
 *
 * @param {Joi.ObjectSchema} schema
 */
const validate = (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
        abortEarly:   false,  // Collect all errors, not just the first
        stripUnknown: true,   // Remove unrecognised keys from the parsed body
        convert:      true,   // Apply Joi conversions (lowercase email, etc.)
    });

    if (error) {
        const errors = error.details.map((d) => ({
            field:   d.path.join('.'),
            message: d.message,
        }));
        return res.status(422).json({ success: false, errors });
    }

    // Replace req.body with the validated + sanitized value
    req.body = value;
    next();
};

module.exports = { createTherapistSchema, updateTherapistSchema, validate };
