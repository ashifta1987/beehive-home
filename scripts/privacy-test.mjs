// Beehive privacy test. Reads keys from env (never prints them). Cleans up after itself.
// Run: node --env-file=.env.local scripts/privacy-test.mjs
import { createRequire } from "node:module";
import crypto from "node:crypto";
const require = createRequire(process.cwd() + "/package.json");
const { createClient } = require("@supabase/supabase-js");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL, SERVICE, opts);
const anon = createClient(URL, ANON, opts);

const TABLES = [
  "beehive_staff", "beehive_apartments", "beehive_bookings", "beehive_guest_profiles", "beehive_foreign_records",
  "beehive_tasks", "beehive_issues", "beehive_schedules", "beehive_schedule_log", "beehive_assets", "beehive_laundry",
  "beehive_petty", "beehive_expenses", "beehive_extras", "beehive_booking_extras", "beehive_licences",
  "beehive_listings", "beehive_campaigns", "beehive_digests", "beehive_door_keys", "beehive_checkins",
  "beehive_checkin_files",
];
const results = [];
const rec = (section, name, pass, detail) => results.push({ section, name, pass, detail });
const keyCol = (t) => (t === "beehive_staff" ? "user_id" : t === "beehive_foreign_records" ? "booking_id" : t === "beehive_door_keys" ? "apartment" : t === "beehive_guest_profiles" ? "key" : t === "beehive_digests" ? "day" : "id");

async function count(client, t) {
  const { data, error } = await client.from(t).select(keyCol(t)).limit(1000);
  return { n: data ? data.length : 0, error: error ? `${error.code ?? ""} ${error.message}`.trim() : null };
}

const ids = {};
let hkUserId = null;
try {
  // ---------- test data (service role) ----------
  const ins = async (t, row, col = "id") => {
    const { data, error } = await admin.from(t).insert(row).select(col).single();
    if (error) throw new Error(`insert ${t}: ${error.message}`);
    return data[col];
  };
  ids.booking = await ins("beehive_bookings", {
    apartment_id: "apt-2bhk", channel: "direct", guest_name: "Privacy Test Guest", phone: "9000000000",
    check_in: "2030-01-10", check_out: "2030-01-12", total: 1000, foreign_national: true, share_phone: false,
  });
  await ins("beehive_foreign_records", { booking_id: ids.booking, nationality: "Testland", passport_no: "X0000000" }, "booking_id");
  ids.checkin = await ins("beehive_checkins", { apartment: "apt-2bhk", full_name: "Privacy Test Guest", adults: 1 });
  ids.expense = await ins("beehive_expenses", { date: "2030-01-10", amount: 1, category: "other", note: "privacy test" });
  ids.issue = await ins("beehive_issues", { apartment_id: "apt-2bhk", text: "privacy test issue", reported_by: null });

  // Control: the rows exist (service role sees them) and the trigger made the jobs
  for (const t of ["beehive_bookings", "beehive_foreign_records", "beehive_checkins", "beehive_expenses", "beehive_tasks", "beehive_apartments", "beehive_door_keys"]) {
    const c = await count(admin, t);
    rec("0 control (service role)", t, c.n > 0, `${c.n} row(s)`);
  }
  const { data: autoTasks } = await admin.from("beehive_tasks").select("id, kind").eq("booking_id", ids.booking);
  rec("0 control (service role)", "auto jobs from test booking", (autoTasks ?? []).length === 2, (autoTasks ?? []).map((x) => x.kind).join(", "));

  // ---------- 1. anon ----------
  for (const t of TABLES) {
    const c = await count(anon, t);
    rec("1 anon (not signed in)", t, c.n === 0, c.error ? `blocked: ${c.error}` : `${c.n} rows`);
  }
  const { data: anonFiles, error: anonFilesErr } = await anon.storage.from("beehive-ids").list("apt-2bhk");
  rec("1 anon (not signed in)", "storage beehive-ids list", !anonFiles || anonFiles.length === 0, anonFilesErr ? `blocked: ${anonFilesErr.message}` : `${(anonFiles ?? []).length} objects`);
  for (const fn of [["beehive_is_owner", {}], ["beehive_sync_all_tasks", {}]]) {
    const { error } = await anon.rpc(fn[0], fn[1]);
    rec("1 anon (not signed in)", `rpc ${fn[0]} refused`, !!error, error ? `blocked: ${error.code ?? ""} ${error.message}` : "ALLOWED");
  }

  // ---------- 2. housekeeper ----------
  const email = `bh-privacy-test-${Date.now()}@example.com`;
  const password = crypto.randomBytes(18).toString("base64url");
  const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (cErr) throw new Error(`create user: ${cErr.message}`);
  hkUserId = created.user.id;
  const { error: sErr } = await admin.from("beehive_staff").insert({ user_id: hkUserId, role: "housekeeper", email, name: "Privacy Test HK", lang: "ml" });
  if (sErr) throw new Error(`staff row: ${sErr.message}`);
  const hk = createClient(URL, ANON, opts);
  const { error: signErr } = await hk.auth.signInWithPassword({ email, password });
  if (signErr) throw new Error(`sign in: ${signErr.message}`);

  const mustBeEmpty = ["beehive_bookings", "beehive_foreign_records", "beehive_checkins", "beehive_expenses",
    "beehive_guest_profiles", "beehive_booking_extras", "beehive_door_keys", "beehive_checkin_files",
    "beehive_licences", "beehive_listings", "beehive_campaigns", "beehive_digests"];
  for (const t of mustBeEmpty) {
    const c = await count(hk, t);
    rec("2 housekeeper — must see nothing", t, c.n === 0, c.error ? `blocked: ${c.error}` : `${c.n} rows`);
  }
  const { data: hkTasks, error: tErr } = await hk.from("beehive_tasks").select("id, kind, guest_first_name, guest_phone").eq("booking_id", ids.booking);
  rec("2 housekeeper — allowed", "beehive_tasks (read jobs of test booking)", !tErr && (hkTasks ?? []).length === 2,
    tErr ? tErr.message : `${hkTasks.length} jobs; first name "${hkTasks[0]?.guest_first_name}", phone ${hkTasks.every((x) => x.guest_phone == null) ? "hidden (share_phone=false)" : "VISIBLE"}`);
  for (const t of ["beehive_apartments", "beehive_schedules", "beehive_extras"]) {
    const c = await count(hk, t);
    rec("2 housekeeper — allowed", `${t} (read)`, c.n > 0, `${c.n} rows`);
  }
  const turnover = (hkTasks ?? []).find((x) => x.kind === "turnover");
  if (turnover) {
    const { error: uErr } = await hk.from("beehive_tasks").update({ status: "in_progress", checks: { 0: true }, guest_first_name: "HACKED", note: "HACKED" }).eq("id", turnover.id);
    const { data: after } = await admin.from("beehive_tasks").select("status, checks, guest_first_name, note").eq("id", turnover.id).single();
    rec("2 housekeeper — allowed", "update own job status/checks", !uErr && after.status === "in_progress" && after.checks["0"] === true, uErr ? uErr.message : `status=${after.status}`);
    rec("2 housekeeper — guard", "cannot change owner fields on a job", after.guest_first_name !== "HACKED" && after.note !== "HACKED", `guest_first_name="${after.guest_first_name}", note=${after.note === null ? "null" : `"${after.note}"`}`);
  }
  const { error: delErr, count: delCount } = await hk.from("beehive_tasks").delete({ count: "exact" }).eq("booking_id", ids.booking);
  rec("2 housekeeper — guard", "cannot delete jobs", (delCount ?? 0) === 0, delErr ? `blocked: ${delErr.message}` : `${delCount ?? 0} deleted`);
  const { error: bInsErr } = await hk.from("beehive_bookings").insert({ apartment_id: "apt-1bhk", guest_name: "x", check_in: "2031-01-01", check_out: "2031-01-02" });
  rec("2 housekeeper — guard", "cannot create bookings", !!bInsErr, bInsErr ? `blocked: ${bInsErr.code} ${bInsErr.message}` : "ALLOWED");
  const { error: resErr } = await hk.from("beehive_issues").update({ status: "resolved" }).eq("id", ids.issue);
  const { data: issueAfter } = await admin.from("beehive_issues").select("status").eq("id", ids.issue).single();
  rec("2 housekeeper — guard", "cannot resolve someone else's issue", issueAfter.status === "open", resErr ? `blocked: ${resErr.message}` : `status still ${issueAfter.status}`);
  const { data: hkFiles } = await hk.storage.from("beehive-ids").list("apt-2bhk");
  rec("2 housekeeper — must see nothing", "storage beehive-ids list", !hkFiles || hkFiles.length === 0, `${(hkFiles ?? []).length} objects`);
  await hk.auth.signOut();

  // ---------- 3. guest functions ----------
  const { data: dk } = await admin.from("beehive_door_keys").select("door_key").eq("apartment", "apt-2bhk").single();
  const wrong = crypto.randomBytes(12).toString("hex");
  const r1 = await anon.rpc("beehive_guest_apartment", { p_apartment: "apt-2bhk", p_key: wrong });
  rec("3 guest functions", "guest_apartment with WRONG key → nothing", !r1.error && r1.data === null, r1.error ? r1.error.message : `returned ${JSON.stringify(r1.data)}`);
  const r1b = await anon.rpc("beehive_guest_apartment", { p_apartment: "apt-2bhk", p_key: "" });
  rec("3 guest functions", "guest_apartment with EMPTY key → nothing", !r1b.error && r1b.data === null, r1b.error ? r1b.error.message : `returned ${JSON.stringify(r1b.data)}`);
  const r2 = await anon.rpc("beehive_guest_apartment", { p_apartment: "apt-2bhk", p_key: dk.door_key });
  rec("3 guest functions", "guest_apartment with RIGHT key → apartment (control)", !!r2.data && r2.data.code === "2BHK" && !("wifi_password" in r2.data), r2.data ? `code ${r2.data.code}, ${r2.data.house_rules?.length} rules, no Wi-Fi in response` : r2.error?.message);
  const r3 = await anon.rpc("beehive_guest_submit", { p: { apartment: "apt-2bhk", key: wrong, full_name: "Wrong Key", adults: 1, rules_accepted: true } });
  rec("3 guest functions", "guest_submit with WRONG key → rejected", !!r3.error && /invalid_key/.test(r3.error.message), r3.error ? `rejected: ${r3.error.message}` : "ACCEPTED");
  const { data: hkRpc } = { data: null };
  void hkRpc;
} catch (e) {
  rec("ERROR", "script", false, e.message);
} finally {
  // ---------- cleanup ----------
  const cleanup = [];
  if (ids.checkin) cleanup.push(admin.from("beehive_checkins").delete().eq("id", ids.checkin));
  if (ids.expense) cleanup.push(admin.from("beehive_expenses").delete().eq("id", ids.expense));
  if (ids.issue) cleanup.push(admin.from("beehive_issues").delete().eq("id", ids.issue));
  await Promise.all(cleanup);
  if (ids.booking) await admin.from("beehive_bookings").delete().eq("id", ids.booking); // cascades jobs + Form C record
  await admin.from("beehive_checkins").delete().eq("full_name", "Wrong Key");
  if (hkUserId) {
    await admin.from("beehive_staff").delete().eq("user_id", hkUserId);
    const { error } = await admin.auth.admin.deleteUser(hkUserId);
    rec("4 cleanup", "test housekeeper user deleted", !error, error ? error.message : "deleted");
  }
  const left = await Promise.all(["beehive_bookings", "beehive_tasks", "beehive_foreign_records", "beehive_checkins", "beehive_expenses", "beehive_issues", "beehive_staff"].map(async (t) => [t, (await count(admin, t)).n]));
  rec("4 cleanup", "test rows removed", left.every(([t, n]) => n === 0 || t === "beehive_staff"), left.map(([t, n]) => `${t.replace("beehive_", "")}=${n}`).join(" "));
  const { data: users } = await admin.auth.admin.listUsers();
  rec("4 cleanup", "no test users left in Auth", !(users?.users ?? []).some((u) => u.email?.startsWith("bh-privacy-test-")), `${users?.users?.length ?? 0} auth user(s) total`);

  let last = "";
  for (const r of results) {
    if (r.section !== last) { console.log(`\n## ${r.section}`); last = r.section; }
    console.log(`${r.pass ? "PASS" : "FAIL"} | ${r.name} | ${r.detail}`);
  }
  console.log(`\nTOTAL: ${results.filter((r) => r.pass).length}/${results.length} passed`);
}
