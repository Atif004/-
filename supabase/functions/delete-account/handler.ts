// Edge Function: delete-account
// يحذف حساب المستخدم الحالي نهائيًا (مطلب App Store للتطبيقات التي تتيح إنشاء حساب).
// حذف المستخدم من auth.users يحذف تلقائيًا profiles و calculations (on delete cascade).
//
// Request:  POST بدون body، مع Authorization: Bearer <user JWT>
// Response: { "deleted": true }
//
// المنطق هنا مفصول عن Deno.serve ليمكن اختباره مباشرة (supabase/tests/e2e).

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http.ts";

export async function handleDeleteAccount(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // 1) التحقق من هوية المستخدم من التوكن الخاص به.
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "unauthorized" }, 401);

  // 2) الحذف بصلاحيات service_role (متاحة فقط داخل الخادم).
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id);
  if (deleteError) return json({ error: "delete_failed", message: deleteError.message }, 500);

  return json({ deleted: true });
}
