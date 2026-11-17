import { describe, expect, it } from "vitest";
import { todayIST } from "./dates";
import {
  aptStatus,
  computeAlerts,
  formatEn,
  formCGroup,
  licenceStatus,
  type AlertBooking,
  type AlertData,
  type AlertTask,
  type StatusBooking,
  type StatusTask,
} from "./alerts";

// 23:30 IST on 17 Nov 2026 is 18:00 UTC; 00:30 IST on 18 Nov is 19:00 UTC on 17 Nov.
const AT_2330_IST = new Date("2026-11-17T18:00:00Z");
const AT_0030_IST = new Date("2026-11-17T19:00:00Z");

const apartments = [
  { id: "apt-1bhk", code: "1BHK", name: "1 Bedroom Apartment", tag_colour: "tag1" },
  { id: "apt-2bhk", code: "2BHK", name: "2 Bedroom Apartment", tag_colour: "tag2" },
];

function booking(p: Partial<AlertBooking>): AlertBooking {
  return {
    id: "b1",
    apartment_id: "apt-1bhk",
    guest_name: "Sarah Klein",
    phone: "+49 151 2345 6789",
    email: null,
    check_in: "2026-11-25",
    check_out: "2026-11-28",
    check_in_time: null,
    check_out_time: null,
    payment_status: "channel",
    deposit_status: "none",
    status: "confirmed",
    id_verified: true,
    foreign_national: false,
    ...p,
  };
}

function task(p: Partial<AlertTask>): AlertTask {
  return {
    id: "t1",
    kind: "turnover",
    apartment_id: "apt-2bhk",
    booking_id: null,
    date: "2026-11-17",
    status: "pending",
    next_arrival: null,
    next_arrival_time: null,
    ...p,
  };
}

function data(p: Partial<AlertData> = {}): AlertData {
  return {
    apartments,
    bookings: [],
    formCSubmitted: [],
    blockedKeys: [],
    tasks: [],
    issues: [],
    schedules: [],
    licences: [],
    laundry: [],
    pettyBalance: null,
    extras: [],
    ...p,
  };
}

const labels = (d: AlertData, today: string) => computeAlerts(d, today).map((a) => `${a.level}:${a.label}`);

describe("day boundary is Kochi time", () => {
  it("todayIST flips at midnight IST, not UTC", () => {
    expect(todayIST(AT_2330_IST)).toBe("2026-11-17");
    expect(todayIST(AT_0030_IST)).toBe("2026-11-18");
    // The UTC date at 00:30 IST is still the 17th, so a UTC-based "today" would be wrong.
    expect(AT_0030_IST.toISOString().slice(0, 10)).toBe("2026-11-17");
  });

  it("Form C turns red when a foreign guest arrives tomorrow (00:30 IST) but not the evening before", () => {
    const d = data({ bookings: [booking({ id: "f1", foreign_national: true, check_in: "2026-11-19", check_out: "2026-11-22" })] });
    expect(labels(d, todayIST(AT_2330_IST))).not.toContain("bad:FORM C");
    const after = computeAlerts(d, todayIST(AT_0030_IST));
    expect(after[0]).toMatchObject({ level: "bad", label: "FORM C", href: "/foreign?open=f1", apartment_id: "apt-1bhk" });
    expect(after[0].text).toContain("Sarah Klein");
  });

  it("Form C stays red until it is submitted", () => {
    const b = booking({ id: "f1", foreign_national: true, check_in: "2026-11-19", check_out: "2026-11-22" });
    for (const today of ["2026-11-18", "2026-11-19", "2026-11-22", "2026-11-23"]) {
      expect(labels(data({ bookings: [b] }), today)).toContain("bad:FORM C");
      expect(labels(data({ bookings: [b], formCSubmitted: ["f1"] }), today)).not.toContain("bad:FORM C");
    }
    // Two days after check-out the stay no longer touches yesterday … tomorrow.
    expect(labels(data({ bookings: [b] }), "2026-11-24")).not.toContain("bad:FORM C");
  });

  it("an unfinished turnover becomes overdue only after midnight IST", () => {
    const d = data({ tasks: [task({ date: "2026-11-17" })] });
    expect(labels(d, todayIST(AT_2330_IST))).not.toContain("bad:CLEANING");
    expect(labels(d, todayIST(AT_0030_IST))).toContain("bad:CLEANING");
    expect(labels(data({ tasks: [task({ date: "2026-11-17", status: "done" })] }), "2026-11-18")).toEqual([]);
  });
});

describe("computeAlerts", () => {
  const T = "2026-11-18";

  it("returns nothing when all is well", () => {
    expect(computeAlerts(data({ bookings: [booking({})] }), T)).toEqual([]);
  });

  it("ignores cancelled bookings", () => {
    const d = data({ bookings: [booking({ status: "cancelled", foreign_national: true, check_in: T, payment_status: "pending" })] });
    expect(computeAlerts(d, T)).toEqual([]);
  });

  it("puts every red alert before every amber alert", () => {
    const d = data({
      bookings: [booking({ id: "a", check_in: T, check_out: "2026-11-20", id_verified: false, payment_status: "pending" })],
      tasks: [task({ date: "2026-11-16" })],
      licences: [{ id: "l1", name: "Trade licence", apartment_id: null, expires: "2026-11-01", remind_days: 60 }],
      pettyBalance: -300,
    });
    const out = computeAlerts(d, T);
    const firstWarn = out.findIndex((a) => a.level === "warn");
    expect(out.slice(0, firstWarn).every((a) => a.level === "bad")).toBe(true);
    expect(out.slice(firstWarn).every((a) => a.level === "warn")).toBe(true);
    expect(out.map((a) => a.label)).toEqual(["CLEANING", "LICENCE", "ID", "PAYMENT", "PETTY CASH"]);
  });

  it("flags a blocked guest with a current or future booking", () => {
    const b = booking({ phone: "98470 12345", guest_name: "Ravi" });
    expect(labels(data({ bookings: [b], blockedKeys: ["p9847012345"] }), T)).toEqual(["bad:BLOCKED"]);
    expect(labels(data({ bookings: [booking({ ...b, check_in: "2026-11-01", check_out: "2026-11-05" })], blockedKeys: ["p9847012345"] }), T)).toEqual([]);
  });

  it("flags open urgent and missing issues, and mess/damage to charge", () => {
    const d = data({
      bookings: [booking({ id: "b9", check_in: "2026-11-10", check_out: "2026-11-15", guest_name: "Arjun" })],
      issues: [
        { id: "i1", apartment_id: "apt-1bhk", category: "plumbing", priority: "urgent", status: "open", booking_id: null, text: "Leak under sink" },
        { id: "i2", apartment_id: "apt-2bhk", category: "missing", priority: "normal", status: "open", booking_id: "b9", text: "Missing: 2 towels" },
        { id: "i3", apartment_id: "apt-2bhk", category: "mess", priority: "normal", status: "open", booking_id: "b9", text: "Very messy" },
        { id: "i4", apartment_id: "apt-2bhk", category: "damage", priority: "urgent", status: "resolved", booking_id: "b9", text: "Old" },
        { id: "i5", apartment_id: null, category: "maintenance", priority: "normal", status: "open", booking_id: null, text: "Paint" },
      ],
    });
    const out = computeAlerts(d, T);
    expect(out.map((a) => `${a.level}:${a.label}`)).toEqual(["bad:URGENT", "bad:MISSING", "warn:CHARGE"]);
    expect(out[2].text).toContain("Arjun");
  });

  it("licence status: expired red, expiring within remind_days amber, valid silent", () => {
    expect(licenceStatus({ expires: "2026-11-17", remind_days: 60 }, T).state).toBe("expired");
    expect(licenceStatus({ expires: T, remind_days: 60 }, T).state).toBe("expiring");
    expect(licenceStatus({ expires: "2027-01-17", remind_days: 60 }, T)).toEqual({ state: "expiring", days: 60 });
    expect(licenceStatus({ expires: "2027-01-18", remind_days: 60 }, T).state).toBe("valid");
    expect(licenceStatus({ expires: null, remind_days: 60 }, T).state).toBe("none");
    const d = data({ licences: [{ id: "l", name: "GST registration", apartment_id: null, expires: "2026-12-01", remind_days: 30 }] });
    const [a] = computeAlerts(d, T);
    expect(a).toMatchObject({ level: "warn", label: "LICENCE", href: "/licences" });
    expect(a.text).toContain("13 days left");
  });

  it("ID not verified only for stays starting by tomorrow that have not ended", () => {
    const mk = (check_in: string, check_out: string, extra: Partial<AlertBooking> = {}) =>
      labels(data({ bookings: [booking({ id_verified: false, check_in, check_out, ...extra })] }), T);
    expect(mk("2026-11-19", "2026-11-21")).toEqual(["warn:ID"]);
    expect(mk("2026-11-20", "2026-11-21")).toEqual([]);
    expect(mk("2026-11-15", T)).toEqual(["warn:ID"]);
    expect(mk("2026-11-15", T, { status: "checked_out" })).toEqual([]);
    expect(mk("2026-11-10", "2026-11-17")).toEqual([]);
  });

  it("payment pending or partial within 3 days of check-in", () => {
    expect(labels(data({ bookings: [booking({ payment_status: "partial", check_in: "2026-11-21" })] }), T)).toEqual(["warn:PAYMENT"]);
    expect(labels(data({ bookings: [booking({ payment_status: "pending", check_in: "2026-11-22" })] }), T)).toEqual([]);
    expect(labels(data({ bookings: [booking({ payment_status: "paid", check_in: T })] }), T)).toEqual([]);
  });

  it("deposit held more than 2 days after check-out", () => {
    const b = (check_out: string) => booking({ deposit_status: "held", check_in: "2026-11-10", check_out });
    expect(labels(data({ bookings: [b("2026-11-16")] }), T)).toEqual([]);
    expect(labels(data({ bookings: [b("2026-11-15")] }), T)).toEqual(["warn:DEPOSIT"]);
  });

  it("same-day turnover today", () => {
    const d = data({ tasks: [task({ date: T, next_arrival: T, next_arrival_time: "14:00:00" })] });
    const [a] = computeAlerts(d, T);
    expect(a).toMatchObject({ level: "warn", label: "TURNOVER", href: "/jobs" });
    expect(a.text).toContain("2 PM");
  });

  it("periodic care overdue, laundry late and petty cash negative are one row each", () => {
    const d = data({
      schedules: [
        { id: "s1", name: "Clean AC filters", apartment_id: "apt-1bhk", last_done: "2026-10-01", every_days: 30 },
        { id: "s2", name: "Pest control", apartment_id: null, last_done: "2026-08-01", every_days: 90 },
        { id: "s3", name: "Deep clean", apartment_id: null, last_done: "2026-11-01", every_days: 90 },
        { id: "s4", name: "Safety check", apartment_id: null, last_done: null, every_days: 180 },
      ],
      laundry: [
        { id: "w1", apartment_id: null, sent_date: "2026-11-13", returned_date: null },
        { id: "w2", apartment_id: null, sent_date: "2026-11-14", returned_date: null },
        { id: "w3", apartment_id: null, sent_date: "2026-11-01", returned_date: "2026-11-03" },
      ],
      pettyBalance: 0,
    });
    const out = computeAlerts(d, T);
    expect(out.map((a) => a.label)).toEqual(["CARE", "LAUNDRY"]);
    expect(out[0].text).toBe("2 periodic care items overdue: Clean AC filters (1BHK), Pest control.");
    expect(out[1].text).toBe("1 laundry batch out for more than 4 days.");
  });

  it("extras requested within 2 days of check-in, and unpaid extras after check-out", () => {
    const d = data({
      bookings: [
        booking({ id: "x1", check_in: "2026-11-20", check_out: "2026-11-22", guest_name: "Meera" }),
        booking({ id: "x2", check_in: "2026-11-12", check_out: "2026-11-16", guest_name: "Tom", apartment_id: "apt-2bhk" }),
      ],
      extras: [
        { booking_id: "x1", name: "Air fryer", status: "requested", paid: false, total: 0 },
        { booking_id: "x2", name: "Extra cleaning charge", status: "delivered", paid: false, total: 1500 },
        { booking_id: "x2", name: "BBQ maker", status: "cancelled", paid: false, total: 900 },
      ],
    });
    const out = computeAlerts(d, T);
    expect(out.map((a) => a.label)).toEqual(["EXTRAS", "EXTRAS"]);
    expect(out[0].text).toContain("Air fryer");
    expect(out[1].text).toContain("Tom");
    expect(out[1].text).toContain("1,500");
  });

  it("uses the translator when given", () => {
    const d = data({ pettyBalance: -50 });
    const out = computeAlerts(d, T, (k) => `#${k}`);
    expect(out).toEqual([{ level: "warn", label: "#label.petty", text: "#pettyNegative", href: "/petty", apartment_id: null }]);
  });
});

describe("formatEn", () => {
  it("fills values and plurals", () => {
    expect(formatEn("laundryLate", { count: 3 })).toBe("3 laundry batches out for more than 4 days.");
    expect(formatEn("pettyNegative", { amount: "₹-200" })).toBe("Petty cash is ₹-200. Top it up.");
  });
});

describe("formCGroup", () => {
  it("is due from the day before arrival until submitted", () => {
    expect(formCGroup({ check_in: "2026-11-20" }, false, "2026-11-18")).toBe("soon");
    expect(formCGroup({ check_in: "2026-11-19" }, false, "2026-11-18")).toBe("due");
    expect(formCGroup({ check_in: "2026-10-01" }, false, "2026-11-18")).toBe("due");
    expect(formCGroup({ check_in: "2026-10-01" }, true, "2026-11-18")).toBe("submitted");
  });
});

describe("aptStatus", () => {
  const T = "2026-11-18";
  function sb(p: Partial<StatusBooking>): StatusBooking {
    return {
      id: "b",
      apartment_id: "apt-1bhk",
      guest_name: "Guest",
      check_in: "2026-11-15",
      check_out: "2026-11-20",
      check_in_time: null,
      check_out_time: null,
      status: "confirmed",
      channel: "airbnb",
      adults: 2,
      children: 0,
      ...p,
    };
  }
  function st(p: Partial<StatusTask>): StatusTask {
    return { id: "t", kind: "turnover", apartment_id: "apt-1bhk", booking_id: "b", date: T, status: "pending", checks: {}, ...p };
  }

  it("turnover when one leaves and one arrives today", () => {
    const s = aptStatus("apt-1bhk", [sb({ id: "a", check_out: T }), sb({ id: "b2", check_in: T, check_out: "2026-11-21" })], [], T);
    expect(s.state).toBe("turnover");
    expect(s.leaving?.id).toBe("a");
    expect(s.arriving?.id).toBe("b2");
  });
  it("arriving / checking out / occupied", () => {
    expect(aptStatus("apt-1bhk", [sb({ check_in: T, check_out: "2026-11-21" })], [], T).state).toBe("arriving");
    expect(aptStatus("apt-1bhk", [sb({ check_out: T })], [], T).state).toBe("checking_out");
    expect(aptStatus("apt-1bhk", [sb({})], [], T).state).toBe("occupied");
  });
  it("checking out becomes ready once its turnover job is done", () => {
    expect(aptStatus("apt-1bhk", [sb({ id: "b", check_out: T })], [st({ booking_id: "b", status: "done" })], T).state).toBe("ready");
  });
  it("needs cleaning when an older turnover job is open and nobody is in", () => {
    const s = aptStatus("apt-1bhk", [], [st({ date: "2026-11-16" })], T);
    expect(s.state).toBe("needs_cleaning");
    expect(s.cleaning?.date).toBe("2026-11-16");
  });
  it("ready with the next booking, ignoring cancelled ones and other apartments", () => {
    const s = aptStatus(
      "apt-1bhk",
      [
        sb({ id: "c", status: "cancelled", check_in: T, check_out: "2026-11-19" }),
        sb({ id: "o", apartment_id: "apt-2bhk", check_in: T }),
        sb({ id: "n2", check_in: "2026-11-25", check_out: "2026-11-27" }),
        sb({ id: "n1", check_in: "2026-11-22", check_out: "2026-11-24" }),
      ],
      [st({ apartment_id: "apt-2bhk", date: "2026-11-10" })],
      T,
    );
    expect(s.state).toBe("ready");
    expect(s.next?.id).toBe("n1");
  });
});
