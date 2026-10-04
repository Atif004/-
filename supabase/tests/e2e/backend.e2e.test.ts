// اختبارات تكامل للخادم: الـ Edge Functions + PostgREST + PostgreSQL (الـ migrations الفعلية وRLS).
// تُشغَّل عبر scripts/test_backend.sh الذي يجهّز قاعدة البيانات وPostgREST والبوابة المحلية.
//
// الاستعلامات هنا مطابقة لما يرسله تطبيق iOS (نفس الجداول والأعمدة والفلاتر)،
// لضمان أن عقد البيانات بين التطبيق والخادم سليم.
// القيم المستخدمة للاختبار فقط وليست قواعد تمويل حقيقية.

import { assert, assertEquals, assertExists } from "jsr:@std/assert@1";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.5";
import { signJwt } from "../local/jwt.ts";
import { handleCalculateCapacity } from "../../functions/calculate-capacity/handler.ts";
import { handleDeleteAccount } from "../../functions/delete-account/handler.ts";
import { calculate, type FinancingRules } from "../../functions/_shared/engine.ts";

const GATEWAY_URL = Deno.env.get("GATEWAY_URL") ?? "http://127.0.0.1:54321";
const JWT_SECRET = Deno.env.get("JWT_SECRET")!;
const sql = postgres(Deno.env.get("DATABASE_URL")!, { max: 2, onnotice: () => {} });

const ADMIN_ID = "00000000-0000-4000-8000-0000000000a1";
const USER_ID = "00000000-0000-4000-8000-0000000000b2";
const OTHER_ID = "00000000-0000-4000-8000-0000000000c3";

// أعمدة مطابقة لاستعلامات التطبيق (RulesStore / CalculationsRepository / AdminService).
const APP_RULES_COLUMNS = "product_type, version, is_demo, parameters";
const APP_HISTORY_COLUMNS = "id, product_type, input, result, rules_version, created_at";
const APP_VERSION_COLUMNS = "id, product_type, version, parameters, is_active, is_demo, notes, created_at";

const RULE_KEYS = [
  "max_debt_ratio", "annual_profit_rate", "rate_method", "min_term_months", "max_term_months",
  "min_monthly_income", "max_financing_amount", "max_age_at_maturity",
];
const INPUT_KEYS = [
  "product_type", "monthly_income", "monthly_obligations", "age", "requested_term_months", "down_payment_savings",
];
const RESULT_KEYS = [
  "product_type", "is_eligible", "max_monthly_installment", "max_financing_amount", "term_months",
  "total_repayment", "total_profit", "max_property_value", "down_payment", "rules_version", "is_demo_rules", "notes",
];

const anonKey = await signJwt({ role: "anon" }, JWT_SECRET);
const serviceKey = await signJwt({ role: "service_role" }, JWT_SECRET);
const tokenFor = (id: string, email: string) => signJwt({ role: "authenticated", sub: id, email, aud: "authenticated" }, JWT_SECRET);

Deno.env.set("SUPABASE_URL", GATEWAY_URL);
Deno.env.set("SUPABASE_ANON_KEY", anonKey);
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", serviceKey);

function clientFor(token?: string): SupabaseClient {
  return createClient(GATEWAY_URL, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  });
}

function calculateRequest(token: string | null, body: unknown, method = "POST"): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request("http://localhost/calculate-capacity", {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

const personalInput = {
  product_type: "personal",
  monthly_income: 10000,
  monthly_obligations: 1000,
  age: 30,
  requested_term_months: 0,
  down_payment_savings: 0,
};

const opts = { sanitizeOps: false, sanitizeResources: false };

// -----------------------------------------------------------------------------

Deno.test({ name: "setup: users, profile trigger, admin", ...opts, fn: async () => {
  await sql`delete from auth.users where id in (${ADMIN_ID}, ${USER_ID}, ${OTHER_ID})`;
  await sql`
    insert into auth.users (id, email, raw_user_meta_data) values
      (${ADMIN_ID}, 'admin@qudra.test', ${sql.json({ full_name: "مدير" })}),
      (${USER_ID},  'user@qudra.test',  ${sql.json({ full_name: "مستخدم" })}),
      (${OTHER_ID}, 'other@qudra.test', ${sql.json({})})`;
  await sql`insert into public.app_admins (user_id) values (${ADMIN_ID})`;
  // trigger التسجيل أنشأ الملفات الشخصية بالاسم من بيانات التسجيل.
  const profiles = await sql`select id, full_name from public.profiles order by id`;
  assertEquals(profiles.length, 3);
  assertEquals(profiles.find((p) => p.id === USER_ID)?.full_name, "مستخدم");
  // نبدأ من القواعد التجريبية كما في الـ migrations.
  const active = await sql`select product_type, version, is_demo from public.calculation_rules where is_active order by product_type`;
  assertEquals(active.map((r) => [r.product_type, r.version, r.is_demo]), [["mortgage", 1, true], ["personal", 1, true]]);
}});

Deno.test({ name: "guest (anon): reads active rules exactly as RulesStore does; nothing else", ...opts, fn: async () => {
  const anon = clientFor();
  const { data, error } = await anon.from("calculation_rules").select(APP_RULES_COLUMNS).eq("is_active", true);
  assertEquals(error, null);
  assertEquals(data!.length, 2);
  for (const row of data!) {
    assert(row.is_demo, "demo rules flagged");
    for (const key of RULE_KEYS) assert(key in row.parameters, `parameters.${key}`);
  }
  const history = await anon.from("calculations").select(APP_HISTORY_COLUMNS);
  assertEquals(history.data, []);
  const publish = await anon.rpc("publish_calculation_rules", {
    p_product_type: "personal", p_parameters: data![0].parameters, p_is_demo: true, p_notes: null,
  });
  assertExists(publish.error, "anon cannot publish");
}});

Deno.test({ name: "calculate-capacity: method, input and auth checks", ...opts, fn: async () => {
  assertEquals((await handleCalculateCapacity(calculateRequest(null, null, "OPTIONS"))).status, 200);
  assertEquals((await handleCalculateCapacity(calculateRequest(null, null, "GET"))).status, 405);
  const badJson = new Request("http://localhost", { method: "POST", body: "{" });
  assertEquals((await handleCalculateCapacity(badJson)).status, 400);
  const badInput = await handleCalculateCapacity(calculateRequest(null, { input: { product_type: "car" } }));
  assertEquals(badInput.status, 400);
  assertEquals((await badInput.json()).error, "invalid_input");
  // الحفظ يتطلب مستخدمًا مسجلًا.
  const anonSave = await handleCalculateCapacity(calculateRequest(anonKey, { input: personalInput, save: true }));
  assertEquals(anonSave.status, 401);
}});

Deno.test({ name: "calculate-capacity: computes with active cloud rules, without saving", ...opts, fn: async () => {
  const res = await handleCalculateCapacity(calculateRequest(anonKey, { input: personalInput, save: false }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.saved_id, null);
  const [rules] = await sql`select parameters, version, is_demo from public.calculation_rules where product_type = 'personal' and is_active`;
  const expected = calculate(personalInput as never, { rules: rules.parameters as FinancingRules, version: rules.version, isDemo: rules.is_demo });
  assertEquals(body.result, expected);
  assertEquals(Object.keys(body.result).sort(), [...RESULT_KEYS].sort());
}});

let savedId = "";

Deno.test({ name: "calculate-capacity: saves to the signed-in user's history", ...opts, fn: async () => {
  const userToken = await tokenFor(USER_ID, "user@qudra.test");
  const res = await handleCalculateCapacity(calculateRequest(userToken, { input: personalInput, save: true }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertExists(body.saved_id);
  savedId = body.saved_id;

  // نفس استعلام صفحة «النتائج السابقة» في التطبيق.
  const user = clientFor(userToken);
  const { data, error } = await user.from("calculations").select(APP_HISTORY_COLUMNS)
    .order("created_at", { ascending: false }).limit(100);
  assertEquals(error, null);
  assertEquals(data!.length, 1);
  const row = data![0];
  assertEquals(row.id, savedId);
  assertEquals(row.product_type, "personal");
  assertEquals(Object.keys(row.input).sort(), [...INPUT_KEYS].sort());
  assertEquals(row.result, body.result);
  assertEquals(row.rules_version, 1);
}});

Deno.test({ name: "RLS: other users cannot see, insert or delete someone else's results", ...opts, fn: async () => {
  const other = clientFor(await tokenFor(OTHER_ID, "other@qudra.test"));
  assertEquals((await other.from("calculations").select("id")).data, []);
  const forged = await other.from("calculations").insert({
    user_id: USER_ID, product_type: "personal", input: {}, result: {}, rules_version: 1,
  });
  assertExists(forged.error, "cannot insert for another user");
  await other.from("calculations").delete().eq("id", savedId);
  const [{ count }] = await sql`select count(*)::int as count from public.calculations where id = ${savedId}`;
  assertEquals(count, 1, "row survived another user's delete");
}});

Deno.test({ name: "profile: upsert own (incl. clearing a field), cannot touch others", ...opts, fn: async () => {
  const user = clientFor(await tokenFor(USER_ID, "user@qudra.test"));
  // نفس ما يرسله ProfileService: upsert مع null صريح.
  let r = await user.from("profiles").upsert({ id: USER_ID, full_name: "اسم جديد", phone: "0500000000" }, { onConflict: "id" });
  assertEquals(r.error, null);
  r = await user.from("profiles").upsert({ id: USER_ID, full_name: "اسم جديد", phone: null }, { onConflict: "id" });
  assertEquals(r.error, null);
  const { data } = await user.from("profiles").select("id, full_name, phone").eq("id", USER_ID).limit(1);
  assertEquals(data, [{ id: USER_ID, full_name: "اسم جديد", phone: null }]);

  // صف مفقود (حساب سبق الـ trigger): upsert يُنشئه.
  await sql`delete from public.profiles where id = ${OTHER_ID}`;
  const other = clientFor(await tokenFor(OTHER_ID, "other@qudra.test"));
  assertEquals((await other.from("profiles").upsert({ id: OTHER_ID, full_name: "جديد", phone: null }, { onConflict: "id" })).error, null);
  assertEquals((await sql`select full_name from public.profiles where id = ${OTHER_ID}`)[0].full_name, "جديد");

  const forged = await other.from("profiles").upsert({ id: USER_ID, full_name: "اختراق", phone: null }, { onConflict: "id" });
  assertExists(forged.error, "cannot upsert another user's profile");
  assertEquals((await sql`select full_name from public.profiles where id = ${USER_ID}`)[0].full_name, "اسم جديد");
}});

Deno.test({ name: "admin: publish approved rules → app and server switch from demo values", ...opts, fn: async () => {
  const admin = clientFor(await tokenFor(ADMIN_ID, "admin@qudra.test"));
  const user = clientFor(await tokenFor(USER_ID, "user@qudra.test"));

  // AdminService.isAdmin: يرى المدير صفه فقط، والمستخدم العادي لا يرى شيئًا.
  assertEquals((await admin.from("app_admins").select("user_id").eq("user_id", ADMIN_ID).limit(1)).data!.length, 1);
  assertEquals((await user.from("app_admins").select("user_id").eq("user_id", USER_ID).limit(1)).data, []);

  const approved = {
    max_debt_ratio: 0.3, annual_profit_rate: 0.02, rate_method: "flat",
    min_term_months: 12, max_term_months: 48, min_monthly_income: 500,
    max_financing_amount: 80000, max_age_at_maturity: 65,
  };

  // مستخدم عادي لا يستطيع النشر.
  const denied = await user.rpc("publish_calculation_rules", {
    p_product_type: "personal", p_parameters: approved, p_is_demo: false, p_notes: null,
  }).select(APP_VERSION_COLUMNS).single();
  assertExists(denied.error);
  assert(denied.error!.message.includes("not_authorized"), denied.error!.message);

  // قيم غير صالحة تُرفض برموز يفهمها التطبيق (RuleValidationIssue.parseServerMessage).
  const invalid = await admin.rpc("publish_calculation_rules", {
    p_product_type: "personal", p_parameters: { ...approved, max_debt_ratio: 2 }, p_is_demo: false, p_notes: null,
  }).select(APP_VERSION_COLUMNS).single();
  assertExists(invalid.error);
  assert(invalid.error!.message.startsWith("invalid_parameters:max_debt_ratio_range"), invalid.error!.message);

  // النشر كما يرسله AdminService.publish.
  const published = await admin.rpc("publish_calculation_rules", {
    p_product_type: "personal", p_parameters: approved, p_is_demo: false, p_notes: "قواعد معتمدة",
  }).select(APP_VERSION_COLUMNS).single();
  assertEquals(published.error, null);
  assertEquals(published.data!.version, 2);
  assertEquals(published.data!.is_active, true);
  assertEquals(published.data!.is_demo, false);

  // ما يجلبه التطبيق الآن (RulesStore): الإصدار المعتمد، غير تجريبي.
  const rules = await clientFor().from("calculation_rules").select(APP_RULES_COLUMNS).eq("is_active", true);
  const personal = rules.data!.find((r) => r.product_type === "personal")!;
  assertEquals(personal.version, 2);
  assertEquals(personal.is_demo, false);
  assertEquals(personal.parameters, approved);

  // والخادم يحسب بها أيضًا.
  const res = await handleCalculateCapacity(calculateRequest(anonKey, { input: personalInput, save: false }));
  const { result } = await res.json();
  assertEquals(result.rules_version, 2);
  assertEquals(result.is_demo_rules, false);
  assertEquals(result, calculate(personalInput as never, { rules: approved as FinancingRules, version: 2, isDemo: false }));

  // لوحة الإدارة: كل الإصدارات وسجل التدقيق، للمدير فقط.
  const versions = await admin.from("calculation_rules").select(APP_VERSION_COLUMNS)
    .eq("product_type", "personal").order("version", { ascending: false });
  assertEquals(versions.data!.map((v) => [v.version, v.is_active]), [[2, true], [1, false]]);
  assertEquals((await user.from("calculation_rules").select("version").eq("product_type", "personal")).data!.length, 1);
  const audit = await admin.from("rules_audit_log")
    .select("id, product_type, action, version, previous_version, is_demo, notes, created_at")
    .order("created_at", { ascending: false }).limit(30);
  assertEquals(audit.data!.map((a) => [a.action, a.version, a.previous_version]), [["publish", 2, 1]]);
  assertEquals((await user.from("rules_audit_log").select("id")).data, []);
}});

Deno.test({ name: "admin: rollback to the demo version restores demo rules everywhere", ...opts, fn: async () => {
  const admin = clientFor(await tokenFor(ADMIN_ID, "admin@qudra.test"));
  const rolledBack = await admin.rpc("activate_calculation_rules_version", { p_product_type: "personal", p_version: 1 })
    .select(APP_VERSION_COLUMNS).single();
  assertEquals(rolledBack.error, null);
  assertEquals([rolledBack.data!.version, rolledBack.data!.is_active, rolledBack.data!.is_demo], [1, true, true]);

  const rules = await clientFor().from("calculation_rules").select(APP_RULES_COLUMNS).eq("is_active", true);
  assert(rules.data!.every((r) => r.is_demo && r.version === 1));

  const res = await handleCalculateCapacity(calculateRequest(anonKey, { input: personalInput, save: false }));
  const { result } = await res.json();
  assertEquals([result.rules_version, result.is_demo_rules], [1, true]);

  const missing = await admin.rpc("activate_calculation_rules_version", { p_product_type: "personal", p_version: 99 })
    .select(APP_VERSION_COLUMNS).single();
  assert(missing.error!.message.includes("version_not_found"), missing.error!.message);
}});

Deno.test({ name: "delete-account: removes the user and all their data; token stops working", ...opts, fn: async () => {
  const userToken = await tokenFor(USER_ID, "user@qudra.test");
  const del = (token: string | null, method = "POST") =>
    handleDeleteAccount(new Request("http://localhost/delete-account", {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }));

  assertEquals((await del(userToken, "GET")).status, 405);
  assertEquals((await del(null)).status, 401);
  assertEquals((await del(anonKey)).status, 401, "anon key is not a user");

  const res = await del(userToken);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { deleted: true });

  const [{ users, profiles, calcs }] = await sql`
    select (select count(*) from auth.users where id = ${USER_ID})::int as users,
           (select count(*) from public.profiles where id = ${USER_ID})::int as profiles,
           (select count(*) from public.calculations where user_id = ${USER_ID})::int as calcs`;
  assertEquals([users, profiles, calcs], [0, 0, 0]);

  // التوكن القديم لم يعد يمثّل مستخدمًا.
  assertEquals((await del(userToken)).status, 401);
  // بقية المستخدمين لم يتأثروا.
  const [{ remaining }] = await sql`select count(*)::int as remaining from auth.users where id in (${ADMIN_ID}, ${OTHER_ID})`;
  assertEquals(remaining, 2);
}});

Deno.test({ name: "teardown", ...opts, fn: async () => {
  await sql.end();
}});
