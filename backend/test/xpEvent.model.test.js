const mongoose = require("mongoose");
const { describe, expect, it } = require("@jest/globals");
const XpEvent = require("../src/models/XpEvent.model");

const validEvent = (overrides = {}) =>
  new XpEvent({
    user_id: new mongoose.Types.ObjectId(),
    event_type: "lesson_complete",
    source_key: "lesson:cashFlow:1.1",
    requested_xp: 20,
    awarded_xp: 20,
    occurred_at: new Date("2026-09-13T23:30:00.000Z"),
    ...overrides,
  });

describe("XP event model", () => {
  it("derives UTC day and leaderboard week buckets", async () => {
    const event = validEvent();

    await event.validate();

    expect(event.day_start.toISOString()).toBe("2026-09-13T00:00:00.000Z");
    expect(event.week_start.toISOString()).toBe("2026-09-07T00:00:00.000Z");
  });

  it("rejects unsupported event types and invalid awarded XP", async () => {
    const event = validEvent({ event_type: "mystery_bonus", awarded_xp: 501 });

    await expect(event.validate()).rejects.toMatchObject({
      errors: {
        event_type: expect.anything(),
        awarded_xp: expect.anything(),
      },
    });
  });

  it("defines indexes for idempotency, daily caps, and weekly aggregation", () => {
    expect(XpEvent.schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ user_id: 1, source_key: 1 }, { unique: true }],
        [{ user_id: 1, day_start: 1 }, {}],
        [{ week_start: 1, user_id: 1 }, {}],
      ]),
    );
  });
});
