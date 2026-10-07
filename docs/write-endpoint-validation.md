# Write Endpoint Validation

Backend write endpoints validate request input with Joi before business logic,
database queries, grading, cache invalidation, or persistence.

Invalid input returns HTTP `400` with this response shape:

```json
{
  "message": "Validation error",
  "errors": ["... validation message ..."]
}
```

## Lesson Progress

`PATCH /api/v1/lessons/progress`

Request body:

- `moduleId`: optional; when omitted, uses the first installed module
- `lessonId`: optional non-empty string
- `microLessonId`: optional non-empty string

At least one of `lessonId` or `microLessonId` is required. Unknown fields and
incorrectly typed values are rejected. If no module is installed, the request returns `404`.

## Start Quiz

`POST /api/v1/quizzes/start`

Request body:

- `microLessonId`: required non-empty string
- `moduleId`: required non-empty string

The micro-lesson ID is validated before the lesson ID is derived, so an empty
request cannot reach ID parsing or cause a server error.

## Submit Quiz

`POST /api/v1/quizzes/:id/submit`

The `id` route parameter must be a non-empty micro-lesson ID. The request body
supports:

- `attemptId`: optional 24-character hexadecimal MongoDB ID
- `moduleId`: optional non-empty string
- `started_at`: optional ISO date
- `answers`: optional object containing string or string-array answers

Both the route parameter and body are validated before grading or database
access.

## Immediate Quiz Feedback

`POST /api/v1/quizzes/check` accepts a required `moduleId`, `microLessonId`, `questionId`, and
`choiceIds`. This is an intentional immediate-feedback endpoint: once a caller submits an answer,
its response includes `isCorrect`, `correctChoiceIds`, and `explanation`.

## Password Recovery

`POST /api/v1/users/forgot-password`

- `email`: required valid email address

`POST /api/v1/users/reset-password`

- `token`: required 64-character hexadecimal reset token
- `newPassword`: must satisfy the shared password requirements

Registration and login retain their existing validation behavior. Password
recovery uses Joi's sanitized values for database queries and password hashing.

`POST /api/v1/users/reactivate` uses the same normalized email and password validation as login,
and is protected by the login credential rate limiter.

## Dashboard Events

`POST /api/v1/dashboard/events`

- `type`: required
- Allowed values: `lesson_complete` or `quiz_submit`

The dashboard cache is invalidated only after the event passes validation.

## Password Requirements

Passwords must satisfy one of these rules:

- At least 15 characters with uppercase, lowercase, and numeric characters; or
- At least 8 characters with uppercase, lowercase, numeric, and special
  characters.

## Test Coverage

Validation behavior is covered by `backend/test/writeValidation.test.js`, which
asserts the `400` status, `Validation error` message, and populated `errors`
array for invalid write requests.
