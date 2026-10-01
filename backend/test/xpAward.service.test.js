const mongoose = require("mongoose");
const { afterEach, describe, expect, it } = require("@jest/globals");
const DailyXpTotal = require("../src/models/DailyXpTotal.model");
const XpEvent = require("../src/models/XpEvent.model");
const { awardXp, getUtcDayStart } = require("../src/services/xpAward.service");

describe("XP award service", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses UTC calendar days", () => {
    expect(getUtcDayStart(new Date("2026-09-14T23:59:59.999Z")).toISOString()).toBe(
      "2026-09-14T00:00:00.000Z",
    );
  });

  it("awards only the XP remaining under the daily cap", async () => {
    const session = {
      withTransaction: jest.fn(async (operation) => operation()),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, "startSession").mockResolvedValue(session);
    jest.spyOn(XpEvent, "findOne").mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
    const updateDailyTotal = jest
      .spyOn(DailyXpTotal, "findOneAndUpdate")
      .mockResolvedValue({ xp_total: 500, last_awarded_xp: 10 });
    jest.spyOn(XpEvent, "create").mockImplementation(async ([event]) => [{ ...event }]);

    const result = await awardXp({
      userId: new mongoose.Types.ObjectId(),
      eventType: "onboarding_complete",
      sourceKey: " onboarding:v1 ",
      requestedXp: 50,
      occurredAt: new Date("2026-09-14T18:00:00.000Z"),
    });

    expect(result).toMatchObject({
      duplicate: false,
      capped: true,
      remainingToday: 0,
      event: { source_key: "onboarding:v1", requested_xp: 50, awarded_xp: 10 },
    });
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
    expect(updateDailyTotal).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: expect.any(mongoose.Types.ObjectId) }),
      expect.any(Array),
      expect.objectContaining({ upsert: true, session }),
    );
  });

  it("returns an existing event without awarding the same source twice", async () => {
    const existingEvent = { requested_xp: 20, awarded_xp: 20 };
    const session = {
      withTransaction: jest.fn(async (operation) => operation()),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, "startSession").mockResolvedValue(session);
    jest
      .spyOn(XpEvent, "findOne")
      .mockReturnValue({ session: jest.fn().mockResolvedValue(existingEvent) });
    const updateDailyTotal = jest.spyOn(DailyXpTotal, "findOneAndUpdate");
    const create = jest.spyOn(XpEvent, "create");

    const result = await awardXp({
      userId: new mongoose.Types.ObjectId(),
      eventType: "lesson_complete",
      sourceKey: "lesson:cashFlow:1.1",
      requestedXp: 20,
    });

    expect(result).toEqual({ event: existingEvent, duplicate: true, capped: false });
    expect(updateDailyTotal).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid awards before opening a database session", async () => {
    const startSession = jest.spyOn(mongoose, "startSession");

    await expect(
      awardXp({
        userId: new mongoose.Types.ObjectId(),
        eventType: "lesson_complete",
        sourceKey: "lesson:cashFlow:1.1",
        requestedXp: -1,
      }),
    ).rejects.toThrow("Requested XP must be a positive number.");
    expect(startSession).not.toHaveBeenCalled();
  });
});
