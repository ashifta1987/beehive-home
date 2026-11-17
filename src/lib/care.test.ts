import { describe, expect, it } from "vitest";
import { careNextDue, careStatus, compareCare, shouldMoveLastDone } from "./care";

const today = "2026-11-18";

describe("careNextDue", () => {
  it("adds every_days to the last done date", () => {
    expect(careNextDue("2026-11-01", 30)).toBe("2026-12-01");
  });
  it("crosses a year end", () => {
    expect(careNextDue("2026-12-20", 30)).toBe("2027-01-19");
  });
  it("returns null without a last done date", () => {
    expect(careNextDue(null, 30)).toBeNull();
    expect(careNextDue("", 30)).toBeNull();
  });
  it("treats an interval below 1 as 1 day", () => {
    expect(careNextDue("2026-11-18", 0)).toBe("2026-11-19");
  });
});

describe("careStatus", () => {
  it("never done → set last done date", () => {
    expect(careStatus({ last_done: null, every_days: 7 }, today)).toEqual({ state: "never", next: null, days: null });
  });
  it("overdue", () => {
    const s = careStatus({ last_done: "2026-11-01", every_days: 7 }, today);
    expect(s.state).toBe("overdue");
    expect(s.next).toBe("2026-11-08");
    expect(s.days).toBe(-10);
  });
  it("overdue by exactly one day", () => {
    expect(careStatus({ last_done: "2026-11-10", every_days: 7 }, today).state).toBe("overdue");
  });
  it("due today", () => {
    const s = careStatus({ last_done: "2026-11-11", every_days: 7 }, today);
    expect(s).toEqual({ state: "today", next: today, days: 0 });
  });
  it("due soon (tomorrow and the 7th day)", () => {
    expect(careStatus({ last_done: "2026-11-12", every_days: 7 }, today).state).toBe("soon");
    const s = careStatus({ last_done: "2026-10-26", every_days: 30 }, today);
    expect(s.next).toBe("2026-11-25");
    expect(s.state).toBe("soon");
    expect(s.days).toBe(7);
  });
  it("later than 7 days", () => {
    const s = careStatus({ last_done: "2026-10-27", every_days: 30 }, today);
    expect(s.next).toBe("2026-11-26");
    expect(s.state).toBe("later");
    expect(s.days).toBe(8);
  });
});

describe("compareCare", () => {
  it("puts overdue before due today before never before soon before later", () => {
    const mk = (name: string, last_done: string | null, every_days: number) => ({
      name,
      status: careStatus({ last_done, every_days }, today),
    });
    const rows = [
      mk("later", "2026-11-17", 30),
      mk("soon", "2026-11-15", 7),
      mk("never", null, 7),
      mk("today", "2026-11-11", 7),
      mk("overdue", "2026-10-01", 7),
    ];
    expect(rows.sort(compareCare).map((r) => r.name)).toEqual(["overdue", "today", "never", "soon", "later"]);
  });
});

describe("shouldMoveLastDone", () => {
  it("moves when there is no date yet", () => expect(shouldMoveLastDone(null, today)).toBe(true));
  it("moves forward", () => expect(shouldMoveLastDone("2026-11-01", today)).toBe(true));
  it("keeps a later date when an older visit is logged", () => expect(shouldMoveLastDone("2026-11-20", today)).toBe(false));
});
