import { describe, expect, it } from "vitest";
import {
  financeSeries,
  monthFinance,
  monthSummary,
  monthsBetween,
  nightParts,
  splitEven,
  type FinBooking,
  type FinanceData,
} from "./finance";

const apartments = [{ id: "apt-1bhk" }, { id: "apt-2bhk" }];

function booking(p: Partial<FinBooking>): FinBooking {
  return {
    id: "b1",
    apartment_id: "apt-1bhk",
    channel: "airbnb",
    check_in: "2026-11-30",
    check_out: "2026-12-03",
    total: 9000,
    commission: 1500,
    status: "confirmed",
    ...p,
  };
}

const data = (p: Partial<FinanceData>): FinanceData => ({ apartments, bookings: [], extras: [], expenses: [], ...p });

describe("splitEven", () => {
  it("adds up exactly and puts the remainder first", () => {
    expect(splitEven(1001, 3)).toEqual([334, 334, 333]);
    expect(splitEven(1001, 2)).toEqual([501, 500]);
    expect(splitEven(0, 3)).toEqual([0, 0, 0]);
    expect(splitEven(5, 0)).toEqual([]);
    for (const [a, n] of [[9999, 7], [1, 4], [12345, 31]] as const) {
      expect(splitEven(a, n).reduce((s, x) => s + x, 0)).toBe(a);
    }
  });
});

describe("night-by-night income split", () => {
  it("a 3-night stay from 30 Nov to 3 Dec counts 1 night in November and 2 in December", () => {
    const d = data({ bookings: [booking({})] });
    const nov = monthFinance("2026-11", d);
    const dec = monthFinance("2026-12", d);
    expect(nov.nights).toBe(1);
    expect(dec.nights).toBe(2);
    expect(nov.gross).toBe(3000);
    expect(dec.gross).toBe(6000);
    expect(nov.commission).toBe(500);
    expect(dec.commission).toBe(1000);
    expect(nov.net).toBe(2500);
    expect(dec.net).toBe(5000);
    expect(nov.byApartment.find((a) => a.apartment_id === "apt-1bhk")?.nights).toBe(1);
    expect(dec.byChannel).toEqual([{ channel: "airbnb", bookings: 1, nights: 2, gross: 6000, commission: 1000, net: 5000 }]);
  });

  it("odd totals still add up exactly across the months", () => {
    const d = data({ bookings: [booking({ total: 10000, commission: 1001 })] });
    const nov = monthFinance("2026-11", d);
    const dec = monthFinance("2026-12", d);
    expect(nov.gross + dec.gross).toBe(10000);
    expect(nov.commission + dec.commission).toBe(1001);
    expect(nov.gross).toBe(3334); // remainder rupee on the first night
    expect(nov.net + dec.net).toBe(10000 - 1001);
  });

  it("excludes cancelled bookings", () => {
    const d = data({
      bookings: [booking({}), booking({ id: "b2", apartment_id: "apt-2bhk", status: "cancelled", total: 50000 })],
    });
    const dec = monthFinance("2026-12", d);
    expect(dec.nights).toBe(2);
    expect(dec.gross).toBe(6000);
    expect(dec.byApartment.find((a) => a.apartment_id === "apt-2bhk")?.nights).toBe(0);
    expect(nightParts(d.bookings)).toHaveLength(3);
  });

  it("computes occupancy and average rate", () => {
    const d = data({ bookings: [booking({})] });
    const dec = monthFinance("2026-12", d);
    expect(dec.occupancy).toBeCloseTo(2 / (31 * 2));
    expect(dec.avgRate).toBe(3000);
    expect(dec.byApartment[0].occupancy).toBeCloseTo(2 / 31);
    expect(monthFinance("2027-01", d).avgRate).toBe(0);
  });
});

describe("extras income", () => {
  it("counts each extra on its own date and skips cancelled ones", () => {
    const d = data({
      bookings: [booking({})],
      extras: [
        { apartment_id: "apt-1bhk", date: "2026-11-30", total: 800, status: "confirmed" },
        { apartment_id: "apt-1bhk", date: "2026-12-01", total: 1200, status: "delivered" },
        { apartment_id: "apt-1bhk", date: "2026-12-02", total: 999, status: "cancelled" },
        { apartment_id: "apt-2bhk", date: "2026-12-02", total: 700, status: "confirmed", booking_status: "cancelled" },
      ],
    });
    const nov = monthFinance("2026-11", d);
    const dec = monthFinance("2026-12", d);
    expect(nov.extras).toBe(800);
    expect(dec.extras).toBe(1200);
    expect(nov.income).toBe(2500 + 800);
    expect(dec.income).toBe(5000 + 1200);
    expect(dec.byApartment.find((a) => a.apartment_id === "apt-1bhk")?.extras).toBe(1200);
  });
});

describe("expenses", () => {
  it("splits shared expenses evenly across 2 apartments, odd amounts included", () => {
    const d = data({
      expenses: [
        { date: "2026-12-05", amount: 1001, apartment_id: null, category: "electricity", source: "expense" },
        { date: "2026-12-06", amount: 500, apartment_id: "apt-2bhk", category: "repairs", source: "expense" },
        { date: "2026-12-07", amount: 75, apartment_id: null, category: "supplies", source: "petty" },
        { date: "2026-11-30", amount: 9999, apartment_id: null, category: "wages", source: "expense" },
      ],
    });
    const dec = monthFinance("2026-12", d);
    const a1 = dec.byApartment.find((a) => a.apartment_id === "apt-1bhk")!;
    const a2 = dec.byApartment.find((a) => a.apartment_id === "apt-2bhk")!;
    expect(dec.expenses).toBe(1001 + 500 + 75);
    expect(dec.expenseLedger).toBe(1501);
    expect(dec.pettyOut).toBe(75);
    expect(a1.expenses).toBe(501 + 38);
    expect(a2.expenses).toBe(500 + 500 + 37);
    expect(a1.expenses + a2.expenses).toBe(dec.expenses);
    expect(dec.byCategory[0]).toEqual({ source: "expense", category: "electricity", amount: 1001 });
    expect(dec.profit).toBe(-1576);
  });
});

describe("summary and series", () => {
  it("monthSummary gives the headline numbers", () => {
    const d = data({
      bookings: [booking({})],
      expenses: [{ date: "2026-12-05", amount: 1000, apartment_id: null, category: "water", source: "expense" }],
    });
    expect(monthSummary("2026-12", d)).toEqual({
      month: "2026-12",
      nights: 2,
      occupancy: 2 / 62,
      gross: 6000,
      commission: 1000,
      net: 5000,
      extras: 0,
      income: 5000,
      expenses: 1000,
      profit: 4000,
    });
  });

  it("financeSeries returns 12 months oldest first", () => {
    const s = financeSeries("2026-12", 12, data({ bookings: [booking({})] }));
    expect(s).toHaveLength(12);
    expect(s[0].month).toBe("2026-01");
    expect(s[11]).toEqual({ month: "2026-12", income: 5000, expenses: 0, profit: 5000 });
    expect(s[10].income).toBe(2500);
    expect(monthsBetween("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });
});
