const jwt = require("jsonwebtoken");
const request = require("supertest");
const { useTestDb } = require("./setup");
const app = require("../src/app");
const User = require("../src/models/User.model");
const WeeklyLeaderboard = require("../src/models/WeeklyLeaderboard.model");
const { getLeaderboardWeek } = require("../src/utils/leaderboardTime");

useTestDb();

async function createUser(index, overrides = {}) {
  return User.create({
    name: `Learner ${index}`,
    email: `learner-${index}@example.com`,
    password_hash: "not-a-real-hash",
    tos_agreement: true,
    leaderboard_opt_in: true,
    ...overrides,
  });
}

function authHeader(user) {
  const token = jwt.sign(
    { id: user._id.toString(), role: user.role, csrfToken: "test-csrf" },
    process.env.JWT_SECRET,
  );
  return `Bearer ${token}`;
}

describe("leaderboard API", () => {
  it("requires authentication", async () => {
    const response = await request(app).get("/api/v1/leaderboard");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("SESSION_INVALIDATED");
  });

  it("returns no rankings to an opted-out learner", async () => {
    const user = await createUser("private", { leaderboard_opt_in: false });

    const response = await request(app)
      .get("/api/v1/leaderboard")
      .set("Authorization", authHeader(user));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      optedIn: false,
      entries: [],
      currentUser: null,
    });
  });

  it("returns the top 20 plus the current learner without exposing email", async () => {
    const { weekStart, weekEnd } = getLeaderboardWeek();
    const currentUser = await createUser("current", {
      name: "Current Learner",
      avatar_url: "https://example.com/current.png",
    });
    const leaders = await Promise.all(
      Array.from({ length: 21 }, (_, index) => createUser(index + 1)),
    );
    await WeeklyLeaderboard.insertMany([
      {
        user_id: currentUser._id,
        week_start: weekStart,
        week_end: weekEnd,
        xp_total: 1,
      },
      ...leaders.map((user, index) => ({
        user_id: user._id,
        week_start: weekStart,
        week_end: weekEnd,
        xp_total: 500 - index,
      })),
    ]);

    const response = await request(app)
      .get("/api/v1/leaderboard")
      .set("Authorization", authHeader(currentUser));

    expect(response.status).toBe(200);
    expect(response.body.optedIn).toBe(true);
    expect(response.body.entries).toHaveLength(20);
    expect(response.body.entries[0]).toMatchObject({
      isCurrentUser: false,
      displayName: "Learner 1",
      weeklyXp: 500,
      rank: 1,
    });
    expect(response.body.currentUser).toMatchObject({
      isCurrentUser: true,
      displayName: "Current Learner",
      avatarUrl: "https://example.com/current.png",
      weeklyXp: 1,
      rank: 22,
    });
    expect(JSON.stringify(response.body)).not.toContain(currentUser._id.toString());
    expect(JSON.stringify(response.body)).not.toContain("@example.com");
    expect(JSON.stringify(response.body)).not.toContain("email");
  });
});
