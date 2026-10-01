# API Overview

## Routes Covered By Postman Collection

```text
GET    /api/v1/health

POST   /api/v1/users/register
GET    /api/v1/users/verify?token=...
POST   /api/v1/users/login
POST   /api/v1/users/reactivate
POST   /api/v1/users/logout
POST   /api/v1/users/forgot-password
POST   /api/v1/users/reset-password

GET    /api/v1/dashboard
POST   /api/v1/dashboard/events

GET    /api/v1/leaderboard

GET    /api/v1/quizzes/progress
GET    /api/v1/quizzes/attempts
POST   /api/v1/quizzes/check
POST   /api/v1/quizzes/start
POST   /api/v1/quizzes/1.1.2/submit

GET    /api/v1/profile
PATCH  /api/v1/profile
POST   /api/v1/profile/avatar
POST   /api/v1/profile/progress/reset
POST   /api/v1/profile/password
POST   /api/v1/profile/request-deletion

GET    /api/v1/lessons/:moduleId/:lessonId
GET    /api/v1/lessons/progress?moduleId=:moduleId
PATCH  /api/v1/lessons/progress
PATCH  /api/v1/lessons/progress/restart
```

## OAuth Browser Routes

```text
GET    /api/v1/auth/providers
GET    /api/v1/auth/google
GET    /api/v1/auth/google/callback
GET    /api/v1/auth/github
GET    /api/v1/auth/github/callback
```

`/providers` returns the configured provider availability, for example
`{ "google": true, "github": false }`. The frontend only renders enabled provider buttons;
direct requests for a disabled provider redirect safely to the login page.

Start OAuth through a browser by visiting a provider route from the login or registration page.
Each start request creates a short-lived, HTTP-only OAuth state cookie and sends its random value
to the provider. The matching callback must return that state value; missing, mismatched, or
replayed state is rejected before provider authentication runs. The state cookie is secure in
production, uses `SameSite=Lax`, and is cleared after a callback attempt.

New OAuth-backed accounts require a verified provider email address and an explicit Terms of
Service and Privacy Policy acknowledgement from the social sign-in UI. On success, the backend
creates the normal HTTP-only session cookie and redirects to `/oauth/callback`. OAuth failures
redirect to safe login error codes such as `oauth_failed`, `oauth_email_required`,
`oauth_terms_required`, or `oauth_unavailable`; these routes rely on external provider redirects
and are not intended for Postman requests.

## Deployment Health Check

`GET /health` is a public, unrate-limited process health endpoint for Render. It returns
`status`, `service`, `uptime`, and `timestamp` without authentication or a database query.

## Immediate Quiz Feedback

`POST /api/v1/quizzes/check` is intentionally public so signed-out lesson previews and
authenticated learners receive immediate feedback. After the caller submits a choice, the
response includes `isCorrect`, `correctChoiceIds`, and `explanation`. Lesson-content APIs
continue to omit correct answers and explanations from their initial payloads.

## Authentication State

Protected-route session failures use HTTP `401` with one of these stable codes:
`SESSION_INVALIDATED`, `ACCOUNT_DISABLED`, or `ACCOUNT_DELETED`. Clients clear local
authentication only for those codes. Ordinary `403` CSRF and authorization responses do not
invalidate a session.

## Profile Avatars

`POST /api/v1/profile/avatar` supports a JSON `avatar_url` only. The URL must use HTTP or HTTPS;
send `null` or an empty string to return to the initials-based avatar. File uploads are not part
of this endpoint.

## Weekly Leaderboard

`GET /api/v1/leaderboard` requires authentication and returns the current UTC leaderboard week,
the top 20 opted-in learners, and the current learner's entry separately. An opted-out learner
receives empty rankings. Public entries contain only an internal user ID, display name, avatar URL,
weekly XP, and rank; email addresses are never included.

## Lesson Content

Lesson modules are loaded from the instance database. An empty database has no implicit curriculum;
an administrator must create or import a module before learners can access lessons. Example
curricula are kept under `shared/content/examples` and are not loaded automatically.
