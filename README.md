# قُدرة Qudra

تطبيق iPhone يساعد المستخدم على تقدير قدرته الشرائية والتمويلية في **التمويل الشخصي** و**التمويل العقاري**.

> ⚠️ جميع قواعد الحساب الحالية **تجريبية** (`is_demo = true`) وليست نسبًا أو قواعد تمويل حقيقية. القواعد تُدار من الـ Cloud (جدول `calculation_rules`) ولا تُكتب داخل التطبيق.

## التقنيات

- Swift + SwiftUI (iOS 17+)، عربي بالكامل مع RTL
- Supabase Cloud: PostgreSQL + Auth + Edge Functions
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) لتوليد مشروع Xcode من `project.yml`

## هيكل المشروع

```
project.yml                       ← مواصفات مشروع Xcode (XcodeGen)
Packages/QudraEngine/             ← محرك الحساب (حزمة Swift مستقلة، بلا واجهة)
  Sources/QudraEngine/
    CalculationEngine.swift       ← منطق الحساب (دالة نقية)
    CalculationModels.swift       ← المدخلات والنتيجة والملاحظات
    FinancingRules.swift          ← شكل القواعد + RuleSet.demo (قيم تجريبية)
    FinancingProduct.swift
    ScenarioComparison.swift      ← مقارنة السيناريوهات وإبراز الأفضل
    RulesValidator.swift          ← التحقق من القواعد (نفس رموز الخادم)
  Tests/QudraEngineTests/
Qudra/
  App/                            ← نقطة الدخول، الجذر، التبويبات
  Config/                         ← AppConfig + ملفات xcconfig للمفاتيح
  DesignSystem/                   ← الألوان والخطوط والمكونات المشتركة
  Core/
    Models/                       ← Profile, SavedCalculation, CalculationRuleRow
    Services/                     ← طبقة الاتصال مع Supabase
      SupabaseService.swift       ← العميل + الأخطاء العربية
      AuthService.swift           ← AppSession (تسجيل الدخول/الخروج/ضيف)
      RulesService.swift          ← RulesStore (Cloud ← نسخة محفوظة ← تجريبي)
      CalculationsRepository.swift← السجل + استدعاء Edge Function
      ProfileService.swift
    Utilities/                    ← تحويل الأرقام العربية والتنسيق
  Features/
    Home/                         ← الصفحة الرئيسية
    PersonalFinance/              ← حاسبة التمويل الشخصي (+ النموذج المشترك)
    MortgageFinance/              ← حاسبة التمويل العقاري
    Result/                       ← صفحة نتيجة الحساب
    Comparison/                   ← مقارنة السيناريوهات
    Admin/                        ← لوحة إدارة القواعد (للمدراء فقط)
    History/                      ← النتائج السابقة
    Profile/                      ← الحساب الشخصي
    Auth/                         ← تسجيل الدخول وإنشاء الحساب
  Resources/Assets.xcassets
QudraTests/                       ← اختبارات التطبيق
supabase/
  config.toml
  migrations/
    20261004000000_initial_schema.sql   ← الجداول + RLS + trigger الملف الشخصي
    20261004000100_demo_rules.sql       ← قواعد تجريبية
    20261004000200_rules_admin.sql      ← المدراء، التحقق، النشر والرجوع، سجل التدقيق
  tests/rules_admin_test.sql            ← اختبارات SQL لإدارة القواعد
  functions/
    _shared/engine.ts             ← نسخة الخادم من محرك الحساب (مطابقة لـ Swift)
    _shared/engine.test.ts        ← اختبارات الحالات المشتركة
    calculate-capacity/index.ts   ← حساب على الخادم + حفظ في السجل
    delete-account/index.ts       ← حذف الحساب نهائيًا (مطلب App Store)
```

## آلية العمل

1. عند فتح التطبيق يجلب `RulesStore` القواعد النشطة من `calculation_rules`. إن فشل، يستخدم آخر نسخة محفوظة، ثم `RuleSet.demo`.
2. الحاسبة تمرر المدخلات إلى `CalculationEngine` محليًا وتعرض النتيجة فورًا.
3. عند «حفظ النتيجة» يُرسل التطبيق المدخلات إلى Edge Function `calculate-capacity` التي تعيد الحساب بالقواعد المعتمدة على الخادم وتحفظه في `calculations`. نتيجة الخادم هي المرجع.
4. سياسات RLS: المستخدم يقرأ/يحذف نتائجه فقط، والقواعد قابلة للقراءة فقط (التعديل من لوحة Supabase).

## خطوات التشغيل

### 1) Supabase

```bash
brew install supabase/tap/supabase
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push                                  # ينشئ الجداول والقواعد التجريبية
supabase functions deploy calculate-capacity
supabase functions deploy delete-account
```

ثم من لوحة Supabase → **Authentication → URL Configuration → Redirect URLs** أضف:

```
qudra://auth-callback
```

هذا الرابط تستخدمه رسائل تأكيد الحساب واستعادة كلمة المرور لإعادة المستخدم إلى التطبيق.

### 2) iOS

```bash
brew install xcodegen
cp Qudra/Config/Secrets.example.xcconfig Qudra/Config/Secrets.xcconfig
# ضع SUPABASE_URL و SUPABASE_ANON_KEY من: Project Settings → API
xcodegen generate
open Qudra.xcodeproj
```

بدون مفاتيح Supabase يعمل التطبيق في وضع الضيف بالقيم التجريبية المدمجة.

### 3) الاختبارات

```bash
cd Packages/QudraEngine && swift test                              # محرك Swift
deno test --allow-read supabase/functions/_shared/engine.test.ts   # محرك الخادم
```

المحركان يُختبران على **نفس الحالات** في
`Packages/QudraEngine/Tests/QudraEngineTests/Fixtures/engine_cases.json`.
عند تعديل منطق الحساب أضف حالة هناك، ويجب أن ينجح الاختباران معًا.

## إدارة القواعد من داخل التطبيق

1. أنشئ حسابًا في التطبيق، ثم انسخ معرّف المستخدم من Supabase → Authentication → Users.
2. من SQL Editor نفّذ:
   ```sql
   insert into public.app_admins (user_id) values ('<USER_ID>');
   ```
3. سيظهر في صفحة «حسابي» خيار **إدارة قواعد الحساب**، ويتيح:
   - إنشاء إصدار جديد مع تحقق فوري من القيم، وقائمة بالتغييرات، ومعاينة أثرها على عميل افتراضي قبل النشر.
   - الرجوع إلى أي إصدار سابق بضغطة واحدة.
   - سجل تدقيق بكل عملية نشر أو رجوع، مع اسم من نفّذها ووقتها.

الصلاحية تُفرض على الخادم: النشر والرجوع يتمّان عبر دوال `publish_calculation_rules` و`activate_calculation_rules_version`، وهي ترفض أي مستخدم غير مسجّل في `app_admins`. وقيد `parameters_valid` على الجدول يمنع حفظ قيم غير صالحة حتى عند التعديل اليدوي من لوحة Supabase.

اختبارات SQL (على قاعدة محلية فقط، فهي تضيف مستخدمين تجريبيين داخل transaction يُلغى في النهاية):

```bash
supabase start && supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/rules_admin_test.sql
```

## تعديل قواعد الحساب يدويًا

من لوحة Supabase → Table Editor → `calculation_rules`:

1. أضف صفًا بإصدار أعلى (`version`) ومعاملات جديدة (`parameters`) و`is_demo = false`.
2. اجعل `is_active = false` للصف القديم، ثم `is_active = true` للجديد (يُسمح بقاعدة نشطة واحدة لكل منتج).

| المفتاح | المعنى |
|---|---|
| `max_debt_ratio` | أقصى نسبة من الدخل للأقساط (شاملة الالتزامات) |
| `annual_profit_rate` | نسبة الربح السنوية |
| `rate_method` | `reducing` أو `flat` |
| `min_term_months` / `max_term_months` | حدود مدة التمويل |
| `min_monthly_income` | الحد الأدنى للدخل |
| `max_financing_amount` | الحد الأقصى لمبلغ التمويل |
| `max_age_at_maturity` | أقصى عمر عند نهاية التمويل |
| `min_down_payment_ratio` | الدفعة الأولى الدنيا (عقاري فقط) |

> عند تغيير منطق الحساب، عدّل `CalculationEngine.swift` و`engine.ts` معًا.

## الميزات الحالية

- حاسبتا التمويل الشخصي والعقاري، مع تلميحات تُبنى من القواعد الحالية في الـ Cloud.
- صفحة نتيجة فيها توزيع المبلغ بين الأصل والربح، ونسبة الأقساط من الدخل، والمتبقي من الدخل، ومشاركة النتيجة.
- سجل نتائج مع تصفية حسب المنتج، ويتحدّث تلقائيًا بعد الحفظ.
- تسجيل دخول وإنشاء حساب واستعادة كلمة المرور عبر رابط البريد، ووضع ضيف.
- حذف الحساب نهائيًا من صفحة «حسابي».
- تحديث القواعد عند العودة للتطبيق إذا مرّ على آخر جلب أكثر من 15 دقيقة.
- **مقارنة السيناريوهات**: حتى 3 سيناريوهات بنفس البيانات الأساسية، تختلف في المدة (والدفعة الأولى للعقاري). تُقترح المدد من القواعد الحالية، ويُبرز الأفضل في كل مقياس.
- **مقارنة النتائج المحفوظة**: من «النتائج السابقة» ← «مقارنة» ← اختيار 2–3 نتائج من نفس النوع.
