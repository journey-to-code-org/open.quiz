const Joi = require("joi");

//Updated Profile Schema (requires name)
const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(30).optional().messages({
    "string.min": "Name must be at least 2 characters long.",
    "string.max": "Name cannot be longer than 30 characters.",
    "string.empty": "Name cannot be empty.",
  }),
  email: Joi.string().trim().lowercase().email().optional().messages({
    "string.empty": "Email cannot be empty.",
    "string.email": "Please provide a valid email address.",
  }),
  goals: Joi.string().trim().max(500).allow("").optional().messages({
    "string.max": "Goals must be within 500 characters.",
  }),
  notifications: Joi.boolean().optional().messages({
    "boolean.base": "Notifications setting must be true or false.",
  }),
  leaderboard_opt_in: Joi.boolean().optional().messages({
    "boolean.base": "Leaderboard opt-in must be true or false.",
  }),

  timezone: Joi.string().trim().optional(),
})
  .min(1) // request body must have at least one field to update
  .messages({
    "object.min": "Please provide at least one field to update.",
  });

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    "string.empty": "Current password is required.",
    "any.required": "Current password is required.",
  }),
  newPassword: Joi.string()
    .trim()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).+$/)
    .required()
    .messages({
      "string.empty": "New Password is required.",
      "string.min": "New Password must be at least 8 characters long.",
      "string.pattern.base":
        "New Password must be at least 8 characters long and include upper and lower case letters, a number, and a special character.",
      "any.required": "New Password is required.",
    }),
});

const deleteAccountSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required().messages({
    "string.empty": "Please enter your email if you want to delete your account.",
    "string.email": "Please provide email that is valid.",
    "any.required": "You need to provide a valid email in order to delete your account.",
  }),
});

const avatarUrlSchema = Joi.object({
  avatar_url: Joi.string()
    .trim()
    .uri({ scheme: ["http", "https"] })
    .allow(null, "")
    .required()
    .messages({
      "any.required": "Avatar URL is required.",
      "string.uri": "Avatar URL must use HTTP or HTTPS.",
      "string.uriCustomScheme": "Avatar URL must use HTTP or HTTPS.",
    }),
});

const resetProgressSchema = Joi.object({
  confirmation: Joi.string().valid("CONFIRM").required(),
});

module.exports = {
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
  avatarUrlSchema,
  resetProgressSchema,
};
