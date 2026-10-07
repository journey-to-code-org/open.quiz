const request = require("supertest");
const app = require("../src/app");

describe("health endpoint", () => {
  test("allows HTTPS avatars without loosening script security", async () => {
    const response = await request(app).get("/health");
    const policy = response.headers["content-security-policy"];
    expect(policy).toContain("img-src 'self' data: https:");
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("object-src 'none'");
  });
  test("returns process health without authentication, session, or CSRF credentials", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        status: "healthy",
        service: "openquiz-api",
        uptime: expect.any(Number),
        timestamp: expect.any(String),
      }),
    );
    expect(Number.isInteger(response.body.uptime)).toBe(true);
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
    expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
  });
});
