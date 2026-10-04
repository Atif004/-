// Edge Function: delete-account
// يحذف حساب المستخدم الحالي نهائيًا (مطلب App Store للتطبيقات التي تتيح إنشاء حساب).
// حذف المستخدم من auth.users يحذف تلقائيًا profiles و calculations (on delete cascade).
//
// Request:  POST بدون body، مع Authorization: Bearer <user JWT>
// Response: { "deleted": true }

import { handleDeleteAccount } from "./handler.ts";

Deno.serve(handleDeleteAccount);
