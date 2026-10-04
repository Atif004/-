# تجهيز النشر على App Store

دليل لتعبئة App Store Connect. كل النصوص ضمن حدود Apple (الطول محسوب).

## 1) بيانات التطبيق

| الحقل | القيمة | الحد |
|---|---|---|
| الاسم | قُدرة: حاسبة القدرة التمويلية | 29 / 30 |
| العنوان الفرعي | قدّر تمويلك الشخصي والعقاري | 27 / 30 |
| الفئة الأساسية | Finance (المالية) | |
| الفئة الثانوية | Utilities (اختياري) | |
| اللغة الأساسية | العربية | |
| رابط سياسة الخصوصية | `https://<HOST>/privacy.html` (انظر القسم 4) | مطلوب |
| رابط الدعم | `https://<HOST>/index.html` أو صفحة تواصل | مطلوب |

**الكلمات المفتاحية** (87 / 100):

```
تمويل,حاسبة,قرض,عقاري,شخصي,قسط,راتب,مرابحة,سكن,عقار,ميزانية,التزامات,استقطاع,مالية,قدرة
```

**النص الترويجي** (اختياري، حتى 170 حرفًا):

> اعرف قبل أن تتقدّم: احسب تقديريًا أقصى مبلغ تمويل وقسط شهري يناسب دخلك، وقارن بين السيناريوهات بسهولة.

**الوصف:**

```
«قُدرة» يساعدك على تقدير قدرتك التمويلية قبل اتخاذ قرارك المالي.

• حاسبة التمويل الشخصي: أقصى مبلغ تمويل وقسط شهري تقديري حسب دخلك والتزاماتك.
• حاسبة التمويل العقاري: قيمة العقار التقديرية التي يمكنك تملّكها والدفعة الأولى المناسبة.
• مقارنة السيناريوهات: قارن بين مدد ودفعات مختلفة جنبًا إلى جنب.
• نتائج واضحة: توزيع المبلغ بين الأصل والربح، ونسبة الأقساط من دخلك.
• سجل النتائج: احفظ نتائجك وارجع إليها في أي وقت.
• خصوصيتك أولًا: الحسابات تتم على جهازك، ولا يُحفظ شيء إلا باختيارك. بدون إعلانات أو تتبّع.

تنبيه: «قُدرة» أداة تقديرية للتخطيط فقط. لا يقدّم التطبيق تمويلًا ولا يمثّل أي جهة تمويلية، والنتائج ليست عرضًا ولا موافقة.
```

## 2) التصنيف العمري

أجب بـ «لا» على كل الأسئلة. التطبيق موجّه لمن هم فوق 18 عامًا (مذكور في سياسة الخصوصية). اختر **17+** فقط إن طلبت ذلك سياسة الجهة المالكة.

## 3) خصوصية التطبيق (App Privacy)

يجب أن تطابق `Qudra/Resources/PrivacyInfo.xcprivacy`:

| نوع البيانات | مرتبطة بالمستخدم | للتتبّع | الغرض |
|---|---|---|---|
| Contact Info → Email Address | نعم | لا | App Functionality |
| Contact Info → Name | نعم | لا | App Functionality |
| Contact Info → Phone Number | نعم | لا | App Functionality |
| Financial Info → Other Financial Info | نعم | لا | App Functionality |

- **Tracking:** لا.
- **Third-party advertising / analytics:** لا يوجد.

## 4) استضافة الصفحات القانونية

الصفحات في `docs/` مولّدة من نفس ملفات `Qudra/Resources/Legal/*.md` المعروضة داخل التطبيق:

```bash
python3 scripts/build_legal_pages.py
```

للنشر عبر GitHub Pages: Settings → Pages → Deploy from branch → اختر الفرع ومجلد `/docs`.

> ⚠️ قبل النشر: استبدل كل ما بين أقواس مربعة في ملفات Legal (اسم الجهة، البريد، التاريخ، منطقة الاستضافة، الجهة القضائية)، واطلب مراجعة قانونية.

## 5) ملاحظات للمراجِع (App Review Notes)

```
Qudra is an estimation/planning calculator. It does NOT offer, broker or originate loans,
and does not represent any lender. All results are clearly labelled as estimates.

Demo account:
  Email:    <REVIEW_ACCOUNT_EMAIL>
  Password: <REVIEW_ACCOUNT_PASSWORD>
The app can also be used without an account ("المتابعة كضيف" / Continue as guest).

Account deletion: Profile tab (حسابي) → "حذف الحساب" at the bottom → confirm.
Calculation rules are configured server-side; the rules-admin screen is only visible to
internal admin accounts and is not part of the consumer experience.
```

أنشئ حساب المراجعة مسبقًا وتأكد من تفعيل بريده.

## 6) التشفير (Export Compliance)

`ITSAppUsesNonExemptEncryption = NO` مضبوط في `project.yml`: التطبيق يستخدم HTTPS القياسي فقط.

## 7) لقطات الشاشة

المطلوب: iPhone 6.9 بوصة (1320×2868) على الأقل. اقتراح الترتيب:

1. الصفحة الرئيسية
2. حاسبة التمويل العقاري مع بيانات
3. صفحة النتيجة (شريط توزيع المبلغ)
4. مقارنة السيناريوهات
5. سجل النتائج

> لا تنشر لقطات تُظهر شريط «قيم تجريبية» في النسخة النهائية؛ انشر القواعد المعتمدة أولًا.

## 8) قائمة التحقق قبل الإرسال

- [ ] استبدال القيم التجريبية بقواعد معتمدة (من لوحة الإدارة، مع إلغاء «قيم تجريبية»).
- [ ] تعبئة الحقول بين الأقواس في ملفات Legal ومراجعتها قانونيًا، ثم `build_legal_pages.py` ونشر `docs/`.
- [ ] ضبط `QUDRA_SUPPORT_EMAIL` في `Secrets.xcconfig`.
- [ ] تعيين Bundle ID وفريق التوقيع (Signing & Capabilities) والرقم `MARKETING_VERSION`.
- [ ] إضافة `qudra://auth-callback` في Redirect URLs على Supabase.
- [ ] تفعيل تأكيد البريد وقوالب رسائل Supabase بالعربية (Authentication → Email Templates).
- [ ] اختبار: إنشاء حساب، تأكيد البريد، استعادة كلمة المرور، حذف الحساب، وضع الضيف.
- [ ] اختبار VoiceOver وحجم الخط الكبير (Settings → Accessibility → Larger Text).
- [ ] رفع البناء عبر Xcode → Product → Archive → Distribute App.
