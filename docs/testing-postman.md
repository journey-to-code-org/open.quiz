# Postman Backend Testing

Use the included Postman files to test the backend against a local instance or a deployment you
control.

## Files

- Admin collection: `docs/postman/admin-backend-api.postman-collection.json`
- Public collection: `docs/postman/public-backend-api.postman-collection.json`
- User collection: `docs/postman/user-backend-api.postman-collection.json`
- Environment (local): `docs/postman/local-backend-api.postman_environment.json`
- Environment (remote development): `docs/postman/remote-dev-backend-api.postman_environment.json`
- Environment (remote production): `docs/postman/remote-backend-api.postman_environment.json`

## Import And Run

1. Import the collection and all environment files into Postman.
2. Select one environment based on where you want to test:

- Local Backend API (`http://localhost:8080`)
- Remote development and production environments must be configured with your own backend URLs.

3. If testing local, start the backend first (`npm run dev` from root or backend).
4. Run the full collection in its listed order for end-to-end coverage. The Users folder
   creates and authenticates a unique test user, exercises logout and password reset, and
   restores an authenticated session before protected requests run.
5. Dashboard, Quizzes, Lessons, and Profile requests then reuse the captured session and
   CSRF token. The final account lifecycle request submits account deletion for admin review.
   Reactivation requires an administrator to approve that request first.
6. Run in this order for end-to-end auth coverage: Register, Verify Email, Login.
7. Then run Dashboard, Quizzes, and Lessons requests.

Collection tests and scripts automatically capture and reuse these values:

- `verificationToken`
- `csrfToken`
- `sessionCookie`
- `resetToken`
- `quizAttemptId`

After a full run, the generated account is active but logged out, and `testUserPassword`
contains its latest password.
