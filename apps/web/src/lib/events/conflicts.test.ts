import { test, expect } from "vitest";

import { findConflictingUserIds, intervalsOverlap } from "./conflicts";

test("edge intervals do not overlap when end equals start", () => {
  const start = new Date("2025-04-01T10:00:00Z");
  const end = new Date("2025-04-01T11:00:00Z");
  const nextStart = new Date("2025-04-01T11:00:00Z");
  const nextEnd = new Date("2025-04-01T12:00:00Z");

  expect(intervalsOverlap(start, end, nextStart, nextEnd)).toBe(false);
  expect(intervalsOverlap(nextStart, nextEnd, start, end)).toBe(false);
});

test("contained intervals overlap", () => {
  const outerStart = new Date("2025-05-01T09:00:00Z");
  const outerEnd = new Date("2025-05-01T11:00:00Z");
  const innerStart = new Date("2025-05-01T09:30:00Z");
  const innerEnd = new Date("2025-05-01T10:30:00Z");

  expect(intervalsOverlap(outerStart, outerEnd, innerStart, innerEnd)).toBe(true);
});

test("finds conflicting users across multiple intervals", () => {
  const intervalStart = new Date("2025-06-01T10:00:00Z");
  const intervalEnd = new Date("2025-06-01T11:00:00Z");

  const entries = [
    { userId: "alice", start: new Date("2025-06-01T09:30:00Z"), end: new Date("2025-06-01T10:15:00Z") },
    { userId: "bob", start: new Date("2025-06-01T10:30:00Z"), end: new Date("2025-06-01T11:30:00Z") },
    { userId: "alice", start: new Date("2025-06-01T09:45:00Z"), end: new Date("2025-06-01T10:05:00Z") },
    { userId: "charlie", start: new Date("2025-06-01T11:00:00Z"), end: new Date("2025-06-01T12:00:00Z") },
  ];

  const conflicts = findConflictingUserIds({ intervalStart, intervalEnd, intervals: entries });
  expect(conflicts).toEqual(["alice", "bob"]);
});
