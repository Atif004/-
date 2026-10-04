// Edge Function: calculate-capacity
// يعيد حساب القدرة التمويلية على الخادم بالقواعد النشطة في calculation_rules،
// ويحفظ النتيجة في سجل المستخدم عند طلب ذلك (save: true).
//
// Request:  { "input": CalculationInput, "save": boolean }
// Response: { "result": CalculationResult, "saved_id": string | null }

import { handleCalculateCapacity } from "./handler.ts";

Deno.serve(handleCalculateCapacity);
