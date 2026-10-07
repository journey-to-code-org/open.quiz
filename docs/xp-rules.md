# XP, Streak, Learning Day, and Progression Rules

## Purpose

This document serves as the source of truth for learner XP, streaks, learning-day statistics, onboarding rewards, and lesson progression rules.

---

# XP Rules

## Daily XP Cap

Learners may earn a maximum of **500 XP per day**.

- XP rewards cannot exceed the daily cap.
- Partial rewards may be granted if only part of an XP award fits within the remaining daily allowance.

### Example

Current XP Earned Today:

```text
490 XP
```

Incoming Award:

```text
+20 XP
```

Result:

```text
Awarded XP = 10
Daily Total = 500
Remaining XP = 0
```

---

## Onboarding Completion XP

**Event:** `onboarding_complete`

**Reward:** +50 XP

### Conditions

- Awarded when a learner completes all onboarding tours.
- Intended to be awarded only on onboarding completion.
- Individual page tours do not award XP.

### Example

Completed Tours:

```text
Dashboard
Learning Path
Lesson Page
Profile Page
```

Result:

```text
+50 XP
```

---

## Lesson Completion XP

**Event:** `lesson_complete`

**Reward:** +20 XP

### Conditions

- Awarded only the first time a lesson is completed.
- Repeating a lesson does not grant additional XP.

### Example

First completion:

```text
+20 XP
```

Repeat completion:

```text
+0 XP
```

---

## Quiz Pass XP

**Event:** `quiz_pass`

**Reward:** +10 XP

### Conditions

- Quiz score must be at least 70%.
- XP is awarded only on the first successful pass.

### Example

First passing score:

```text
85%
```

Result:

```text
+10 XP
```

Retaking and passing again:

```text
+0 XP
```

---

## Perfect Quiz XP

**Event:** `quiz_perfect`

**Reward:** +5 XP

### Conditions

- Quiz score must equal 100%.
- XP is awarded only the first time a learner achieves a perfect score on that quiz.

### Example

First perfect score:

```text
100%
```

Result:

```text
+5 XP
```

Second perfect score on the same quiz:

```text
+0 XP
```

---

# Learning Day Rules

## Learning Days

A learning day is a unique calendar day on which a learner performs one or more learning activities.

Multiple activities completed on the same day count as a single learning day.

Learning Days are calculated using the learner's configured timezone.

### Example

Activity Timestamps:

```text
2026-08-20 09:00
2026-08-20 18:30
2026-08-21 14:00
```

Result:

```text
Learning Days = 2
```

because activity occurred on:

```text
2026-08-20
2026-08-21
```

### Purpose

Learning Days provide a lifetime measure of engagement independent of streaks.

---

# Streak Rules

## Streak Definition

A streak represents consecutive calendar days on which a learner was active.

Streak calculations use the learner's configured timezone.

---

## Current Streak

The current streak is the number of consecutive active days ending:

- Today, or
- Yesterday

If the learner misses a complete day, the current streak resets to zero.

### Example

Activity Dates:

```text
Aug 22
Aug 23
Aug 24
```

Current Date:

```text
Aug 24
```

Result:

```text
Current Streak = 3
```

---

### Example: Missed Day

Activity Dates:

```text
Aug 22
Aug 23
Aug 24
```

Current Date:

```text
Aug 27
```

Result:

```text
Current Streak = 0
```

because one or more active days were missed.

---

## Longest Streak

The longest streak is the largest run of consecutive active days in learner history.

### Example

Activity Dates:

```text
Aug 1
Aug 2
Aug 3
Aug 7
Aug 8
```

Result:

```text
Current Streak = 2
Longest Streak = 3
```

---

# Timezone Handling

Learning Days and Streaks use the learner's configured timezone.

Activity timestamps are normalized into local calendar-day keys using:

```text
YYYY-MM-DD
```

### Example

Timestamp:

```text
2026-08-25T03:00:00Z
```

Timezone:

```text
America/New_York
```

Result:

```text
2026-08-24
```

---

# Lesson Progression Rules

## Lesson Unlocking

Lessons unlock sequentially.

A lesson is accessible when:

1. It is the first lesson in a sequence, or
2. The immediately preceding lesson has been completed.

### Example

Sequence:

```text
1.1 → 1.2 → 1.3
```

Completed Lessons:

```text
1.1
```

Result:

```text
1.2 = Unlocked
1.3 = Locked
```

---

## First Lesson Rule

The first lesson in a sequence is always
