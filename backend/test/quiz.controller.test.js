const { describe, it, expect, beforeEach } = require("@jest/globals");
const QuizAttempt = require("../src/models/QuizAttempt.model");
const UserProgress = require("../src/models/UserProgress.model");
const { awardXp } = require("../src/services/xpAward.service");
const { submitQuiz } = require("../src/controllers/quiz.controller");

jest.mock("../src/models/QuizAttempt.model");
jest.mock("../src/models/UserProgress.model");
jest.mock("../src/services/xpAward.service", () => ({ awardXp: jest.fn() }));
jest.mock("../src/utils/content", () => ({
  getModule: jest.fn().mockResolvedValue(require("./fixtures/budgetingModule.json")),
}));
jest.mock("../src/services/badge.service", () => ({
  awardEligibleBadges: jest.fn().mockResolvedValue([]),
}));
jest.mock("../src/services/streak.service", () => ({
  updateUserStreak: jest.fn().mockResolvedValue(),
}));

describe("quiz XP awards", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: {
        id: "user123",
      },
      params: {
        id: "1.2.3",
      },
      body: {
        attemptId: "507f1f77bcf86cd799439011",
        moduleId: "cashFlow",
        //Question 4 should be answer b, so this would be a 75% score
        answers: {
          "1.2.3-q1": "b",
          "1.2.3-q2": "b",
          "1.2.3-q3": "a",
          "1.2.3-q4": "c",
        },
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    next = jest.fn();
  });

  it("awards lesson completion XP when final micro lesson completes the lesson", async () => {
    const attempt = {
      attempt_number: 1,
      submitted_at: null,
      save: jest.fn(),
    };

    QuizAttempt.findOne
      .mockResolvedValueOnce(attempt) //current attempt
      .mockResolvedValueOnce(null) //previousPass
      .mockResolvedValueOnce(null); //previousPerfect

    UserProgress.findOne.mockResolvedValue({
      completed_micro_lessons: [],
    });
    awardXp
      .mockResolvedValueOnce({ duplicate: false, event: { awarded_xp: 10 } })
      .mockResolvedValueOnce({ duplicate: false, event: { awarded_xp: 20 } });

    UserProgress.findOneAndUpdate.mockResolvedValue({
      completed_micro_lessons: ["1.2.1", "1.2.2", "1.2.3"],
      completed_lessons: [],
    });

    await submitQuiz(req, res, next);

    expect(UserProgress.findOneAndUpdate).toHaveBeenCalledTimes(2);

    const lessonUpdateCall = UserProgress.findOneAndUpdate.mock.calls[1][1];

    expect(lessonUpdateCall.$inc.xp).toBe(20);

    expect(lessonUpdateCall.$addToSet.completed_lessons).toBe("1.2");

    expect(awardXp).toHaveBeenLastCalledWith({
      userId: "user123",
      eventType: "lesson_complete",
      sourceKey: "lesson_complete:cashFlow:1.2",
      requestedXp: 20,
    });
  });

  it("marks the lesson complete when only its final quiz micro-lesson is passed", async () => {
    const attempt = {
      attempt_number: 1,
      submitted_at: null,
      save: jest.fn(),
    };

    QuizAttempt.findOne
      .mockResolvedValueOnce(attempt)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    UserProgress.findOne.mockResolvedValue({ completed_micro_lessons: [] });
    awardXp
      .mockResolvedValueOnce({ duplicate: false, event: { awarded_xp: 10 } })
      .mockResolvedValueOnce({ duplicate: false, event: { awarded_xp: 20 } });
    UserProgress.findOneAndUpdate.mockResolvedValue({
      completed_micro_lessons: ["1.2.3"],
      completed_lessons: [],
    });

    await submitQuiz(req, res, next);

    expect(UserProgress.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(UserProgress.findOneAndUpdate.mock.calls[1][1].$addToSet.completed_lessons).toBe("1.2");
  });

  it("awards quiz pass XP on first successful pass", async () => {
    const attempt = {
      attempt_number: 1,
      submitted_at: null,
      save: jest.fn(),
    };

    QuizAttempt.findOne
      .mockResolvedValueOnce(attempt) //current attempt
      .mockResolvedValueOnce(null) //previousPass
      .mockResolvedValueOnce(null); //previousPerfect

    UserProgress.findOneAndUpdate.mockResolvedValue({
      completed_micro_lessons: [],
      completed_lessons: [],
    });
    awardXp.mockResolvedValueOnce({ duplicate: false, event: { awarded_xp: 10 } });

    await submitQuiz(req, res, next);

    const updateCall = UserProgress.findOneAndUpdate.mock.calls[0][1];

    expect(updateCall.$inc.xp).toBe(10);

    expect(awardXp).toHaveBeenCalledWith({
      userId: "user123",
      eventType: "quiz_pass",
      sourceKey: "quiz_pass:1.2.3",
      requestedXp: 10,
    });
  });

  it("does not award XP on second successful pass", async () => {
    const attempt = {
      attempt_number: 2,
      submitted_at: null,
      save: jest.fn(),
    };

    QuizAttempt.findOne
      .mockResolvedValueOnce(attempt) //current attempt
      .mockResolvedValueOnce({ passed: true }) //previousPass
      .mockResolvedValueOnce(null); //previousPerfect

    UserProgress.findOneAndUpdate.mockResolvedValue({
      completed_micro_lessons: [],
      completed_lessons: [],
    });

    await submitQuiz(req, res, next);

    const updateCall = UserProgress.findOneAndUpdate.mock.calls[0][1];

    expect(updateCall.$inc?.xp ?? 0).toBe(0);

    expect(awardXp).not.toHaveBeenCalled();
  });

  it("awards only perfect score XP when the user previously passed but has never earned a perfect score", async () => {
    //Perfect score answers for quiz 1.2.3
    req.body.answers = {
      "1.2.3-q1": "b",
      "1.2.3-q2": "b",
      "1.2.3-q3": "a",
      "1.2.3-q4": "b",
    };

    const attempt = {
      attempt_number: 3,
      submitted_at: null,
      save: jest.fn(),
    };

    QuizAttempt.findOne
      .mockResolvedValueOnce(attempt) //current attempt
      .mockResolvedValueOnce({ passed: true }) //previousPass
      .mockResolvedValueOnce(null); //previousPerfect

    UserProgress.findOneAndUpdate.mockResolvedValue({
      completed_micro_lessons: [],
      completed_lessons: [],
    });
    awardXp.mockResolvedValueOnce({ duplicate: false, event: { awarded_xp: 5 } });

    await submitQuiz(req, res, next);

    const updateCall = UserProgress.findOneAndUpdate.mock.calls[0][1];

    expect(updateCall.$inc?.xp).toBe(5);

    expect(awardXp).toHaveBeenCalledWith({
      userId: "user123",
      eventType: "quiz_perfect",
      sourceKey: "quiz_perfect:1.2.3",
      requestedXp: 5,
    });
  });

  it("does not award perfect score xp twice", async () => {
    //Perfect score answers for quiz 1.2.3
    req.body.answers = {
      "1.2.3-q1": "b",
      "1.2.3-q2": "b",
      "1.2.3-q3": "a",
      "1.2.3-q4": "b",
    };

    const attempt = {
      attempt_number: 4,
      submitted_at: null,
      save: jest.fn(),
    };

    QuizAttempt.findOne
      .mockResolvedValueOnce(attempt) //current attempt
      .mockResolvedValueOnce({ passed: true }) //previousPass
      .mockResolvedValueOnce({ score: 100 }); //previousPerfect

    UserProgress.findOneAndUpdate.mockResolvedValue({
      completed_micro_lessons: [],
      completed_lessons: [],
    });

    await submitQuiz(req, res, next);

    const updateCall = UserProgress.findOneAndUpdate.mock.calls[0][1];

    expect(updateCall.$inc?.xp ?? 0).toBe(0);

    expect(awardXp).not.toHaveBeenCalled();
  });
});
