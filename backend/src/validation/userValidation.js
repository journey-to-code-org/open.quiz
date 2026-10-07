const Joi = require("joi");

const LONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
const SHORT_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9\s]).+$/;

const passwordSchema = Joi.alternatives()
  .try(
    Joi.string().trim().min(15).pattern(LONG_PASSWORD_PATTERN),
    Joi.string().trim().min(8).pattern(SHORT_PASSWORD_PATTERN),
  )
  .required()
  .messages({
    "string.empty": "Password is required.",
    "alternatives.match":
      "Password must be at least 15 characters long and include upper and lower case letters and a number, or at least 8 characters long and include upper and lower case letters, a number, and a special character.",
    "any.required": "Password is required.",
  });

const emailSchema = Joi.string().trim().lowercase().email().messages({
  "string.empty": "Email is required.",
  "string.email": "Please provide a valid email address.",
  "any.required": "Email is required.",
});

//Register Schema (requires name)
const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(30).required().messages({
    "string.empty": "Name is required.",
    "string.min": "Name must be at least 2 characters long.",
    "string.max": "Name cannot be longer than 30 characters.",
    "any.required": "Name is required.",
  }),
  email: emailSchema.required(),
  password: passwordSchema,
  confirmPassword: Joi.string().trim().valid(Joi.ref("password")).required().messages({
    "string.empty": "Please confirm password.",
    "any.only": "Passwords do not match.",
    "any.required": "Please confirm password.",
  }),
  tos: Joi.boolean().valid(true).required().messages({
    "any.only": "Please accept the terms of service.",
    "any.required": "Please accept the terms of service.",
  }),
  timezone: Joi.string().trim().optional(),
});
const loginSchema = Joi.object({
  email: emailSchema.required(),
  password: Joi.string().required().messages({
    "string.empty": "Password is required.",
    "any.required": "Password is required.",
  }),
  // new for front end requirement of remember me
  remember: Joi.boolean().optional().default(false),
});

//Schema for PATCH /api/v1/onboarding/step
const TOUR_KEYS = ["dashboardPage", "learningPath", "lessonPage", "profilePage"];
const updateOnboardingProgressSchema = Joi.object({
  tourKey: Joi.string()
    .valid(...TOUR_KEYS)
    .optional()
    .messages({
      "any.only": `tourKey must be one of: ${TOUR_KEYS.join(",")}.`,
    }),
  step: Joi.number().integer().min(0).optional().messages({
    "number.base": "Step must be a number.",
    "number.integer": "Step must be an integer.",
    "number.min": "Step cannot be a negative number.",
  }),
  status: Joi.string()
    .valid("pending", "completed", "skipped")
    .optional()
    .messages({ "any.only": "Status must be pending, completed, or skipped." }),

  dismissed: Joi.boolean().strict().optional().messages({
    "boolean.base": "Dismissed must be a boolean value.",
  }),
  markAllComplete: Joi.boolean()
    .strict()
    .optional()
    .messages({ "boolean.base": "markAllComplete must be a boolean value." }),
});

const moduleIdSchema = Joi.string().trim().min(1).required();
const microLessonIdSchema = Joi.string().trim().min(1);

const lessonProgressSchema = Joi.object({
  moduleId: Joi.string().trim().min(1).strict(),
  lessonId: Joi.string().trim().min(1),
  microLessonId: microLessonIdSchema,
  currentChunkIndex: Joi.number().integer().min(0),
}).or("lessonId", "microLessonId");

const lessonCompletionSchema = Joi.object({
  moduleId: moduleIdSchema,
  lessonId: Joi.string().trim().min(1).required(),
});

const quizStartSchema = Joi.object({
  moduleId: moduleIdSchema,
  microLessonId: microLessonIdSchema.required(),
});

const quizSubmissionParamsSchema = Joi.object({
  id: microLessonIdSchema.required(),
});

const quizCheckSchema = Joi.object({
  moduleId: moduleIdSchema,
  microLessonId: microLessonIdSchema.required(),
  questionId: Joi.string().trim().min(1).required(),
  choiceIds: Joi.alternatives()
    .try(Joi.string().trim(), Joi.array().items(Joi.string().trim()))
    .required(),
});

const quizSubmissionSchema = Joi.object({
  attemptId: Joi.string().trim().hex().length(24),
  moduleId: moduleIdSchema,
  started_at: Joi.date().iso(),
  answers: Joi.object()
    .pattern(
      Joi.string().trim().min(1),
      Joi.alternatives().try(Joi.string().trim(), Joi.array().items(Joi.string().trim())),
    )
    .default({}),
});

const forgotPasswordSchema = Joi.object({
  email: emailSchema.required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().trim().hex().length(64).required().messages({
    "string.empty": "Reset token is required.",
    "string.hex": "Reset token must be valid.",
    "string.length": "Reset token must be valid.",
    "any.required": "Reset token is required.",
  }),
  newPassword: passwordSchema,
});

const dashboardEventSchema = Joi.object({
  type: Joi.string().trim().valid("lesson_complete", "quiz_submit").required(),
}).unknown(true);

const lessonImportSchema = Joi.object({
  id: Joi.string().trim().min(1).required(),
  title: Joi.string().trim().min(1).required(),
  lessons: Joi.array().required(),
}).unknown(true);

const adminUserQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
  role: Joi.string().valid("learner", "admin"),
  emailVerified: Joi.boolean(),
  search: Joi.string().trim().max(100),
});

const adminUserSeedSchema = Joi.object({
  count: Joi.number().integer().min(1).max(100).default(10),
});

const adminRoleSchema = Joi.object({
  role: Joi.string().valid("learner", "admin").required(),
  confirmation: Joi.string().valid("CONFIRM").required(),
});

const adminActionSchema = Joi.object({
  confirmation: Joi.string().valid("CONFIRM").required(),
});

const adminDisableSchema = adminActionSchema.keys({
  disabled: Joi.boolean().required(),
});

const adminDeleteSchema = adminActionSchema.keys({
  email: Joi.string()
    .trim()
    .email({ tlds: { allow: false } })
    .required(),
});

const adminSoftDeleteSchema = adminActionSchema.keys({
  deleted: Joi.boolean().required(),
});

const adminModuleSchema = Joi.object({
  id: Joi.string().trim().min(1).required(),
  title: Joi.string().trim().min(1).required(),
  lessons: Joi.array().required(),
}).unknown(true);

const adminModuleUpdateSchema = Joi.object({
  title: Joi.string().trim().min(1),
  lessons: Joi.array(),
})
  .min(1)
  .unknown(true);

const adminLessonSchema = Joi.object({
  id: Joi.string().trim().min(1).required(),
}).unknown(true);

function validateRequest(res, schema, payload) {
  const { error, value } = schema.validate(payload ?? {}, { abortEarly: false });
  if (error) {
    res.status(400).json({
      message: "Validation error",
      errors: error.details.map((detail) => detail.message),
    });
    return null;
  }
  return value;
}

module.exports = {
  registerSchema,
  loginSchema,
  passwordSchema,
  lessonProgressSchema,
  lessonCompletionSchema,
  quizStartSchema,
  quizSubmissionParamsSchema,
  quizCheckSchema,
  quizSubmissionSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  dashboardEventSchema,
  lessonImportSchema,
  adminUserQuerySchema,
  adminUserSeedSchema,
  adminRoleSchema,
  adminActionSchema,
  adminDisableSchema,
  adminDeleteSchema,
  adminSoftDeleteSchema,
  adminModuleSchema,
  adminModuleUpdateSchema,
  adminLessonSchema,
  validateRequest,
  updateOnboardingProgressSchema,
};
