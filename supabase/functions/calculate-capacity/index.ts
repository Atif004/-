// Edge Function: calculate-capacity
// يعيد حساب القدرة التمويلية على الخادم بالقواعد النشطة في calculation_rules،
// ويحفظ النتيجة في سجل المستخدم عند طلب ذلك (save: true).
//
// Request:  { "input": CalculationInput, "save": boolean }
// Response: { "result": CalculationResult, "saved_id": string | null }

import { createClient } from "jsr:@supabase/supabase-js@2";
import { calculate, type FinancingRules, parseInput } from "../_shared/engine.ts";
import { corsHeaders, json } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { input?: unknown; save?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const input = parseInput(body.input);
  if (typeof input === "string") return json({ error: "invalid_input", message: input }, 400);

  // عميل بصلاحيات المستخدم نفسه حتى تُطبّق سياسات RLS.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );

  const { data: ruleRow, error: rulesError } = await supabase
    .from("calculation_rules")
    .select("version, is_demo, parameters")
    .eq("product_type", input.product_type)
    .eq("is_active", true)
    .maybeSingle();

  if (rulesError) return json({ error: "rules_unavailable", message: rulesError.message }, 500);
  if (!ruleRow) return json({ error: "no_active_rules" }, 404);

  const result = calculate(input, {
    rules: ruleRow.parameters as FinancingRules,
    version: ruleRow.version,
    isDemo: ruleRow.is_demo,
  });

  let savedId: string | null = null;
  if (body.save === true) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ error: "unauthorized" }, 401);

    const { data: saved, error: insertError } = await supabase
      .from("calculations")
      .insert({
        user_id: userData.user.id,
        product_type: input.product_type,
        input,
        result,
        rules_version: ruleRow.version,
      })
      .select("id")
      .single();

    if (insertError) return json({ error: "save_failed", message: insertError.message }, 500);
    savedId = saved.id;
  }

  return json({ result, saved_id: savedId });
});
