import { describe, expect, it } from "vitest";
import {
  buildGuestIndex,
  extraShortfalls,
  extraUsed,
  filterBookings,
  guestKey,
  matchesSearch,
  parseCommission,
  toCSV,
  type ExtraUse,
  type StayLite,
} from "./bookings";
import type { Booking } from "./types";

describe("guestKey", () => {
  it("uses the last 10 digits of the phone when it has 8 or more digits", () => {
    expect(guestKey({ phone: "+91 98470 12345", email: "a@b.com", guest_name: "Anu" })).toBe("p9847012345");
    expect(guestKey({ phone: "098470-12345", email: null, guest_name: "Anu" })).toBe("p9847012345");
    expect(guestKey({ phone: "12345678", email: null, guest_name: "Anu" })).toBe("p12345678");
  });
  it("treats the same number typed differently as the same guest", () => {
    const a = guestKey({ phone: "+919847012345", email: null, guest_name: "Anu" });
    const b = guestKey({ phone: "98470 12345", email: null, guest_name: "Anu M" });
    expect(a).toBe(b);
  });
  it("falls back to lower-case email when the phone is short or missing", () => {
    expect(guestKey({ phone: "1234", email: " Guest@Mail.COM ", guest_name: "Anu" })).toBe("eguest@mail.com");
    expect(guestKey({ phone: null, email: "x@y.in", guest_name: "Anu" })).toBe("ex@y.in");
  });
  it("falls back to the lower-case name", () => {
    expect(guestKey({ phone: null, email: null, guest_name: "  Rahul Nair " })).toBe("nrahul nair");
    expect(guestKey({ phone: "", email: "", guest_name: "RAHUL" })).toBe("nrahul");
  });
});

describe("extras availability", () => {
  const stays: StayLite[] = [
    { id: "a", apartment_id: "apt-1bhk", check_in: "2026-11-10", check_out: "2026-11-13", status: "confirmed" },
    { id: "b", apartment_id: "apt-2bhk", check_in: "2026-11-12", check_out: "2026-11-14", status: "checked_in" },
    { id: "c", apartment_id: "apt-2bhk", check_in: "2026-11-14", check_out: "2026-11-16", status: "confirmed" },
    { id: "x", apartment_id: "apt-1bhk", check_in: "2026-11-11", check_out: "2026-11-12", status: "cancelled" },
  ];
  const uses: ExtraUse[] = [
    { booking_id: "a", extra_id: "fryer", qty: 1, status: "confirmed" },
    { booking_id: "b", extra_id: "fryer", qty: 1, status: "requested" },
    { booking_id: "b", extra_id: "bbq", qty: 1, status: "cancelled" },
    { booking_id: "c", extra_id: "fryer", qty: 1, status: "confirmed" },
    { booking_id: "x", extra_id: "fryer", qty: 5, status: "confirmed" },
  ];
  const catalog = [
    { id: "fryer", name: "Air fryer", qty: 2 },
    { id: "bbq", name: "BBQ maker", qty: 1 },
    { id: "hall", name: "Party hall", qty: null },
  ];

  it("counts only other, overlapping, non-cancelled bookings and extras", () => {
    // 12 → 13 overlaps a and b; c starts on b's check-out; x is cancelled.
    expect(extraUsed("fryer", { id: null, check_in: "2026-11-12", check_out: "2026-11-13" }, stays, uses)).toBe(2);
    // back-to-back stays do not overlap
    expect(extraUsed("fryer", { id: null, check_in: "2026-11-16", check_out: "2026-11-18" }, stays, uses)).toBe(0);
    // the booking being edited is never counted against itself
    expect(extraUsed("fryer", { id: "a", check_in: "2026-11-10", check_out: "2026-11-13" }, stays, uses)).toBe(1);
    // cancelled extras free the item
    expect(extraUsed("bbq", { id: null, check_in: "2026-11-12", check_out: "2026-11-13" }, stays, uses)).toBe(0);
  });

  it("warns when stock would be exceeded", () => {
    const s = extraShortfalls(
      [{ extra_id: "fryer", qty: 1, status: "confirmed" }],
      { id: null, check_in: "2026-11-12", check_out: "2026-11-13" },
      catalog, stays, uses,
    );
    expect(s).toEqual([{ extraId: "fryer", name: "Air fryer", stock: 2, used: 2, wanted: 1 }]);
  });

  it("does not warn when there is enough stock", () => {
    expect(
      extraShortfalls([{ extra_id: "fryer", qty: 1, status: "confirmed" }], { id: null, check_in: "2026-11-14", check_out: "2026-11-15" }, catalog, stays, uses),
    ).toEqual([]);
  });

  it("adds up several lines of the same extra on this booking and ignores cancelled lines", () => {
    const draft = [
      { extra_id: "bbq", qty: 1, status: "confirmed" as const },
      { extra_id: "bbq", qty: 1, status: "requested" as const },
      { extra_id: "fryer", qty: 3, status: "cancelled" as const },
    ];
    const s = extraShortfalls(draft, { id: null, check_in: "2026-11-20", check_out: "2026-11-21" }, catalog, stays, uses);
    expect(s).toEqual([{ extraId: "bbq", name: "BBQ maker", stock: 1, used: 0, wanted: 2 }]);
  });

  it("never warns for extras without a stock number, one-off charges or bad dates", () => {
    expect(
      extraShortfalls(
        [{ extra_id: "hall", qty: 9, status: "confirmed" }, { extra_id: null, qty: 1, status: "confirmed" }],
        { id: null, check_in: "2026-11-12", check_out: "2026-11-13" }, catalog, stays, uses,
      ),
    ).toEqual([]);
    expect(
      extraShortfalls([{ extra_id: "fryer", qty: 5, status: "confirmed" }], { id: null, check_in: "2026-11-13", check_out: "2026-11-12" }, catalog, stays, uses),
    ).toEqual([]);
  });
});

describe("parseCommission", () => {
  it("turns a percentage into rupees", () => {
    expect(parseCommission("15%", 10000)).toEqual({ amount: 1500, pct: 15 });
    expect(parseCommission(" 15.5 % ", 999)).toEqual({ amount: 155, pct: 15.5 });
  });
  it("reads plain rupees", () => {
    expect(parseCommission("₹1,200", 10000)).toEqual({ amount: 1200, pct: null });
    expect(parseCommission("", 10000)).toEqual({ amount: 0, pct: null });
  });
  it("rejects nonsense", () => {
    expect(parseCommission("abc", 100)).toBeNull();
    expect(parseCommission("150%", 100)).toBeNull();
    expect(parseCommission("-5", 100)).toBeNull();
  });
});

const bk = (o: Partial<Booking>): Booking => ({
  id: "id", apartment_id: "apt-1bhk", channel: "airbnb", channel_ref: null, guest_name: "Guest", phone: null, email: null,
  adults: 2, children: 0, check_in: "2026-11-10", check_out: "2026-11-12", check_in_time: null, check_out_time: null,
  total: 0, commission: 0, payment_status: "channel", deposit: 0, deposit_status: "none", status: "confirmed",
  id_verified: false, foreign_national: false, share_phone: true, hk_note: null, notes: null, review_asked: false,
  ical_uid: null, created_at: "", updated_at: null, ...o,
});

describe("filters and search", () => {
  const rows = [
    bk({ id: "past", check_in: "2026-11-01", check_out: "2026-11-03" }),
    bk({ id: "now", check_in: "2026-11-17", check_out: "2026-11-18", channel_ref: "HMXK42" }),
    bk({ id: "soon", check_in: "2026-11-25", check_out: "2026-11-27", phone: "+91 98470 12345" }),
    bk({ id: "gone", check_in: "2026-11-20", check_out: "2026-11-22", status: "cancelled" }),
  ];
  it("splits by tab with checkout day still current", () => {
    expect(filterBookings(rows, "current", "", "2026-11-18").map((b) => b.id)).toEqual(["now", "soon"]);
    expect(filterBookings(rows, "past", "", "2026-11-18").map((b) => b.id)).toEqual(["past"]);
    expect(filterBookings(rows, "cancelled", "", "2026-11-18").map((b) => b.id)).toEqual(["gone"]);
    expect(filterBookings(rows, "all", "", "2026-11-18").map((b) => b.id)).toEqual(["soon", "gone", "now", "past"]);
  });
  it("searches reference and phone digits", () => {
    expect(matchesSearch(rows[1], "hmxk")).toBe(true);
    expect(matchesSearch(rows[2], "9847012345")).toBe(true);
    expect(matchesSearch(rows[2], "nobody")).toBe(false);
  });
});

describe("buildGuestIndex", () => {
  it("groups by guest key and sums non-cancelled stays at net", () => {
    const rows = [
      bk({ id: "1", guest_name: "Anu", phone: "9847012345", check_in: "2026-10-01", check_out: "2026-10-03", total: 6000, commission: 900 }),
      bk({ id: "2", guest_name: "Anu Mathew", phone: "+91 98470 12345", check_in: "2026-11-01", check_out: "2026-11-02", total: 3000, commission: 0, channel: "direct" }),
      bk({ id: "3", guest_name: "Anu", phone: "9847012345", check_in: "2026-12-01", check_out: "2026-12-02", total: 9999, status: "cancelled" }),
      bk({ id: "4", guest_name: "Ravi", check_in: "2026-09-01", check_out: "2026-09-02" }),
    ];
    const g = buildGuestIndex(rows, [{ category: "missing", booking_id: "1" }, { category: "mess", booking_id: "2" }], [
      { key: "p9847012345", tag: "vip", rating: 5, nationality: null, city: null, notes: null },
    ]);
    expect(g.map((x) => x.key)).toEqual(["p9847012345", "nravi"]);
    const anu = g[0];
    expect(anu.stays).toBe(2);
    expect(anu.nights).toBe(3);
    expect(anu.spend).toBe(8100);
    expect(anu.channels.sort()).toEqual(["airbnb", "direct"]);
    expect(anu.missing).toBe(1);
    expect(anu.profile?.tag).toBe("vip");
    expect(anu.name).toBe("Anu"); // latest booking (even if cancelled) names the guest
  });
});

describe("toCSV", () => {
  it("quotes and neutralises formulas", () => {
    expect(toCSV([["a,b", 'say "hi"', 5, null], ["=SUM(A1)", "ok"]])).toBe('"a,b","say ""hi""",5,\r\n\'=SUM(A1),ok');
  });
});
