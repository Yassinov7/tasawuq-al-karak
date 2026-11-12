# C11 — الانتقال الآمن، محلي وغير مفعّل

القرار المحلي: READY FOR OWNER REVIEW، وليس تصريح تطبيق أو تفعيل. لا اتصال بـSupabase ولا SQL بعيد ولا تشغيل تطبيق. لا C12. اختبارات PostgreSQL وJWT وCOMMIT والتزامن الحقيقي غير منفذة.

## 1. جرد المصادر القديمة

الجرد القابل لإعادة الإنتاج: `scripts/finance-c11-inventory.cjs` ينتج `docs/finance-c11-source-inventory.json` بمسارات الملفات وأرقام الأسطر لكل علاقة. هذه فهرسة مصدر، لا استنتاج اعتماديات PostgreSQL من catalog ولا إثبات تشغيل. تصنيف الملف المختلط إلى requires isolation يعني وجوب تتبع حراسه، لا أنه ثغرة بذاته. المصادر التاريخية لا تعدّل.

- legacy only: wallets / wallet_transactions. لا يمثل رصيد المحفظة نقد خزينة C2، ولا يُستورد.
- legacy only: customer_order_cash_obligations، driver_delivery_fee_entitlements، driver_cash_remittances، driver_cash_credit_payouts، driver_cash_custody_positions. العهدة القديمة تطرح الأجر بمعادلة 20261018001400؛ العهدة الجديدة كاملة النقد C4 ولا يجوز جمعهما.
- legacy only: merchant_order_entitlements / adjustments / positions؛ merchant_settlement_batches / batch_entitlements / payment_allocations، وmerchant_settlement_payments القديم. المستحق ناقص التخصيصات الفعلية، دون إسقاط المستحقات غير المدرجة في تسوية.
- legacy only: subscription_invoices / subscription_payments / invoice_payment_allocations، merchant_billing_settings، merchant_subscription_plan_changes، merchant_credit_limits، merchant_ledger_entries، merchant_financial_positions.
- shared read / native guarded write: customer_orders، store_orders، store_order_totals، delivery_tasks؛ immutable writer in order_financial_modes، والغياب للطلب السابق يعني legacy. C3 pricing لا يعني أن الكاتب C4: اختيار legacy ممكن لطلب ذي سياق C3.
- incompatible / requires isolation: store_order_commissions (snapshot للتسعير لكلا المسارين، لكن due/reversal/legacy ledger محظورة لطلب C4). merchant_subscriptions وsubscription_plans سجلات مهنية مشتركة؛ C8 fences تحمي الفترات المُدارة ومصدر إيصالها. لا تستنتج الكاتب من وجود فترة native فقط.
- new finance only: C2 financial_operations/events/accounts/journal_entries/lines؛ C4 results؛ C5 requests/attempts؛ C6 wages/payments/allocations؛ C7 positions/SET/c7_merchant_settlement_payments؛ C8 memberships/billing_documents/cash_receipts؛ C9 postings؛ C10 reconciliation.

تعارض مثبت أُصلح: C7 كانت تنشئ public.merchant_settlement_payments الموجود تاريخيًا بأعمدة batch_id مختلفة. عُزل جدول C7 باسم public.c7_merchant_settlement_payments؛ حدّثت FK المرجع PAY والقراءات والمشغلات وRealtime وC10 وأدوات الاختبارات التابعة. الجدول القديم والأنواع الرسمية الخاصة به وخدماته لم تُغيّر. الفحص الجديد يرفض أي CREATE TABLE متكرر في سلسلة migrations كاملة.

## 2. خريطة الكاتب والمشغلات

- store_order_totals_snapshot_commission_after_insert مؤجل → snapshot_store_order_commission_after_totals: لقطة العمولة تبقى للتسعير، ولا تُستحق في legacy لطلب C4.
- store_orders_apply_commission_after_status_change → apply_store_order_commission_status_change → accrue_store_order_commission / reversal. C4 public wrappers تفوض إلى finance_private.c4_legacy_accrue / c4_legacy_reverse_commission للطلبات legacy فقط؛ c4_commission_due_guard يمنع التجاوز.
- store_orders_cash_financial_foundations_after_status_change وdelivery_tasks_cash_financial_foundations_after_status_change المؤجل → create_delivered_order_cash_foundations → التزام العميل وأجر السائق ومستحق التاجر القديم. wrapper C4 وc4_legacy_write_guard يعزلان طلبات C4 دون تعطيل المشغلات القديمة.
- store_order_commission_reversal_append_merchant_entitlement_adjustment: يبقى لتصحيح entitlement القديم فقط؛ لا عكس C4 عبر RPC القديم.
- C4 complete_delivery_and_collect_cash: الحدثان والقيدان الحاليان فقط، وC6/C7 deferred extensions. C11 لا يضيف كاتبًا ولا يعدل مبلغًا. c11_order_event_writer يرفض أحداث full_cash_collected / delivery_completed / driver_wage_accrued إن لم ينتم مرجع DLV إلى طلب C4.
- C8 native/old invoice/payment/billing guards تبقى، وlegacy scheduler يستبعد enrolled cohorts كما في C8. لا إصدار فاتورة أو قبض بمجرد انتقال عضوية.
- C5–C9 يبقون على C2 والمستندات المعتمدة، لا يقرؤون legacy لتغطية صرف. خزينة C9 لا تستقبل سند افتتاحي تلقائيًا.

## 3. بوابات التفعيل

الجديدة في finance_private.c11_gates: new_orders / delivery / custody / wages / settlements / subscriptions / treasury / reconciliation. كلها false. c11_permissions مستقلة عن admin، افتراضيًا false، ولا توجد RPC لمنحها. لا صلاحيات أو تمويل تُمنح تلقائيًا.

RPC `set_finance_transition_gate(expected_user,path_value,enabled_value,change_reason)` يتحقق من JWT ودور admin والتفويض والسبب، يقفل البوابات بترتيب path ويسجل audit ثابتًا. فحص readiness يتحقق من صلاحيات private، RLS والكتابة المباشرة، القيود، المشغلات المطلوبة، دوال الإكمال والاستعادة، تفويضات الاستلام والصرف والمطابقة؛ والتفعيل يرفض أخطاء C10. هذا فحص بنيوي، لا ادعاء اجتياز الاختبارات السلوكية.

new_orders يعتمد على delivery/custody/wages/settlements/treasury/reconciliation، إضافة إلى الضوابط القديمة اللازمة للاستكمال ووجود سياسة أجور. الاشتراك بوابة مستقلة ولا تُفعّل ضمن فتح الطلبات، لكن قبول عضوية C8 يتطلب جاهزية بوابتي treasury/reconciliation لأن C8 تقبض نقدًا. لا تُفتح بوابات أخرى تلقائيًا. يجب إيقاف new_orders قبل إغلاق إحدى اعتمادياته، وإيقاف قبول subscriptions قبل إغلاق treasury/reconciliation؛ العضويات القائمة تظل قابلة للاستكمال والقبض.

تمكين كل بوابة يضبط ضابط مسارها فقط عند الحاجة: C5 requests؛ C6 task admission+payout؛ C7 preparation+payout؛ C8 operations+eligibility؛ C9 enabled. فتح reconciliation لا يمنح may_reconcile. لا scheduler ولا opening_enabled ولا تفويض مالك ولا رصيد افتتاحي.

**الإيقاف هو إيقاف قبول مجموعات جديدة، وليس قتل استكمال الالتزامات**: new_orders يوقف اختيار C4 للولادات التالية فقط؛ subscriptions تمنع memberships الجديدة؛ treasury تمنع طلبات C9 الجديدة. C5/C6/C7 تخدم مستحقات المجموعات المسجلة حتى بعد إغلاق بوابات القبول، لذلك لا تُغلق underlying payout/receipt controls. delivery لا يعطل تسليم C4 القائم. القراءة والاستعادة والمطابقة تبقى. هذه ليست emergency kill switches؛ إيقاف عملية جارية بسبب حادث يحتاج قرارًا ماليًا مستقلًا.

## 4. الطلبات

c4_select_mode داخل إنشاء C3، بعد علامة الولادة وفي المعاملة نفسها، يأخذ SHARE على البوابات قبل ضابط C4. لا يُحوّل snapshot يُضاف لطلب قديم. order_financial_modes ثابت ولا يتغير بعد flag flip. الإجمالي المعتمد الصفري أصلًا يبقى على اختيار C4 السابق (legacy)؛ الصفر بعد رفض متجر في طلب C4 يستعمل zero_cash_delivery المعتمد.

للولادات C4 المقبولة بعد C11 سجل خاص ثابت يضمن استمرار لقطة الأجور عند إنشاء DLV ولو توقف accept_tasks لاحقًا. admission_policy_id دليل جاهزية عند القبول فقط؛ نسبة الأجر النهائية ما زالت تُثبت عند DLV حسب C6، ولم تُنقل إلى checkout. لا backfill لأي DLV أو قيد تاريخي.

تعارض واجهة legacy أُصلح: السند القديم للتحصيل لا يوجد إلا بعد التسليم، فكان غيابه يمنع التسليم من الواجهة. RPC get_legacy_delivery_collection يقرأ للسائق المسند فقط، دون C3/C4، ويستعمل مجموع snapshots المتاجر غير المرفوضة/الملغاة مع الرسم المحفوظ مرة واحدة. يرفض البيانات الناقصة والحالات غير الصالحة. بعد التسليم يقرأ الالتزام المثبت. لا historical parent totals ولا جمع على الجهاز. C3 pricing الجاري يظل الأولوية إن وُجد. هذه قراءة، وليست قبضًا أو كاتبًا جديدًا.

## 5. الاشتراكات وأول فاتورة

الفترة القديمة المدفوعة تبقى native وlegacy store eligibility تبقى لمن لا يملك membership. لا يؤثر غياب C8 في متجر قديم مؤهل. الانتقال لا يحدث تلقائيًا عند فتح flag.

RPC transition_legacy_subscription يستخدم C8 enrollment الفعلي، بصلاحية transition control وC8 issue معًا، تحت قفل merchant. أثناء الفترة أو حتى نهاية 168 ساعة يُرفض الانتقال؛ يجب أيضًا تسوية/فصل فواتير legacy المفتوحة والدفعات غير المخصصة بقرار مستقل، وتكون C8 receivable صفرًا. لا تحويل لهذه الالتزامات. الانتظار حتى نهاية المهلة هو المسار المحافظ الموجود في C8، وليس سياسة جديدة للانتقال منتصف فترة مدفوعة.

كل membership جديد عبر RPC C8 الأصلي أو wrapper C11 يُسجل عبر trigger: الفترة السابقة ونهايتها والمستخدم والسبب وoperation. لا مسار أصلي غير مدقق. إعادة نفس المحاولة ترجع النتيجة؛ إيقاف القبول لا يحذف membership أو يعيدها إلى legacy.

أول SIN لا ينشأ عند enrollment؛ يصدر صراحة لاحقًا. أصلحت C11 بداية snapshot الفاتورة بعد انتهاء مهلة قديمة لتستخدم subscription_activation_start نفسها: بعد 168 ساعة تبدأ من وقت الإصدار، لا من نهاية قديمة منذ أشهر. قيمة الفاتورة وخطتها وتفرد anchor والقيد كما C8. الفترة المدفوعة الفعلية تبدأ عند القبض وفق C8؛ snapshot الفاتورة ليس وعدًا ببدء الخدمة قبل القبض. لا فواتير catch-up للأشهر غير النشطة، ولا إيراد لفترة سبق دفعها. نفس pending SIN يُعاد بدل فاتورة مكررة.

## 6. الالتزامات التاريخية والتراجع

read_finance_transition تقرير مستقل مفوض، paginated، يعرض عهدة/رصيد السائق القديم، مستحق التاجر ناقص المدفوع الفعلي، ديون/أرصدة الاشتراك، وأجر legacy المدمج بالعهدة (ليس أجرة C6 غير مدفوعة). لا إجمالي يجمع هذه الفئات، ولا استيرادها. أرصدة wallets ومصدر الخزينة القديمة وحركاتها تبقى في تقاريرها؛ لا يُستنتج رصيد نقد فعلي من المحفظة أو صافي حركات غير مصالحة.

قبل أول قيد جديد: أوقف new_orders؛ العمليات المستقبلية legacy. لا تحتاج rollback DDL ولا حذف إعدادات أو بيانات. بعد وجود قيد: نفس إيقاف القبول مسموح، لكن كل C4/C8 قائم يبقى على كاتبه ويستكمل عبر التحصيل والعهدة والصرف والاستعادة؛ لا تحويل أو عكس أو حذف قيود بسبب flag. لا تُستخدم opening equity لتفسير فرق غير معروف. الرجوع إلى legacy لمجموعة C4 أو C8 قائمة ممنوع.

قرارات مستقلة مطلوبة قبل إطلاق فعلي: رصد/إثبات نقد المكتب القديم؛ تسوية العهد والأرصدة القديمة؛ المستحقات غير المصروفة؛ ديون وأرصدة الاشتراكات؛ اختيار الموظفين والتفويضات؛ إثبات اختبارات PostgreSQL/JWT. C11 لا تختار معالجة مالية لهذه القيم.

## 7. توافق الواجهات

- العميل cart/checkout/orders/order-details وc3-orders: quote/create/recover C3 محفوظة، لا تغيير السعر ولا السلة. pricing context لا يحدد الكاتب المالي وحده.
- التاجر merchant/orders: update_store_order_status كما هو. MerchantFinancialScreen وMerchantSettlementPanel: legacy sections مستقلة عن C7؛ صلح Realtime لاسم جدول C7 المعزول. subscription.tsx / SubscriptionAccountPanel: managed=false يعرض المحتوى القديم المميز، managed=true يعرض C8.
- السائق orders/DeliveryTaskCard: capabilities C4 تحدد الاستلام والتسليم، legacy القديم update_delivery_task_status؛ أضيفت قراءة pre-C3 المعزولة فقط. cash-account يجمع مكونات عرض مستقلة C5/C6 وسجل قديم معلّم، ولا يجمع أرصدتها.
- الإدارة finance/financial-reports/legacy ledger/custody: السجلات القديمة تبقى منفصلة؛ treasury وC10 للنظام الجديد. أضيف /admin/finance-transition للقراءة فقط، من finance، مع رسالة صلاحية/فشل دون صفر افتراضي. لم تتغير Layout/Header/BottomNav. عنوان Header العام للمسار الجديد يحتاج مراجعة هاتف ضمن البنية الحالية؛ لا Header جديد.
- DTOs C11 وC7 تبقى مواءمة يدوية موثقة لمسودات غير مطبقة. database.ts الرسمي للـlegacy لم يُغيّر أو يُزعم توليده.

## 8. migrations والاختبارات

C2/C3 المطبقتان لم تُغيّرا. C7 وC10 **مسودتان غير مطبقتين بحسب السياق**: عُدّل اسم جدول الصرف المتعارض وتوابعه فقط. الجديدة: 20261114000100_finance_c11_safe_transition.sql بعد C10. لا تطبق C11 على نسخة قديمة من C7/C10، ولا تُعدّل migration طبقت فعلًا؛ إن أثبت المالك تطبيق إحداهما، يلزم مسار additive منفصل يُراجع أولًا. preflight C11 يرفض غياب الجدول المعزول. ترتيب C2→C3→C4(3)→C5→C6→C7 المعدلة→C8→C9(2)→C10 المعدلة→C11.

محليًا: test-finance-c11.cjs يفحص adapters الحقيقية بالاستجابات الاصطناعية (القراءة، الدقة، منع التسرب، timeout المشترك) وعقود SQL المصدرية، وتصادم أسماء الجداول وسلامة أدوات الاختبار. source checks ليست PostgreSQL.

الاختبار السلوكي المجهز: test-finance-c11-postgres.cjs، يتطلب C11_ALLOW_DISPOSABLE_TEST=yes وC2_ALLOW_DISPOSABLE_TEST=yes وC2_TEST_MANIFEST مطلق وC2_TEST_DATABASE_URL عددي loopback وقاعدة *_c2_test وعلامة وOID/systemIdentifier/psql مثبتة. كل اتصال يتحقق من الهوية قبل SQL. لا db push أو reset أو تطبيق migration أو إنشاء مستخدم في الأداة.

يتطلب مخطط C2–C11 مطبقًا مسبقًا بواسطة المالك على PostgreSQL معزول، وfixtures C10 السابقة، مع manifest.c11.paidMerchant ذي فترة legacy فعالة، وc8.expiredMerchant بعد 168 ساعة بلا ديون/رصيد غير مخصص، وثلاثة تجار مختلفين، وc11.preC3Task مسند إلى fixture driver في picked_up بلا C3 pricing، وc11.legacyCollectible نص المبلغ الصحيح المستقل. missing fixtures تعني فشلًا، لا SKIP. لا تستخدم المشروع الأساسي.

الأداة تركب SQL C10 الأصلي مع finance_c11_transition.sql بعلامات مصدر فريدة؛ تختبر الدورة المالية الأصلية والتراجع المؤجل ثم paid legacy، الانتقال الصريح وأول SIN، grace، إيقاف القبول أثناء الطلب، legacy/new isolation، الأجور بعد توقف العلم، الاستعادة، وقراءة legacy للسائق المسموح فقط. تشغل rollback ثم COMMIT حقيقيًا منفصلًا وتراقب pg_blocking_pids لوحدتي تحكم متزامنتين. التزامن المالي C5/C6/C7 مغطى بأدوات C10/C7 المعزولة المستقلة بعد مواءمتها؛ لم تُشغّل هذه الجولات هنا.

مثال المالك في بيئة الاختبار فقط بعد تجهيز الهوية والمخطط والـfixtures: اضبط متغيرات الاختبار أعلاه، ثم `node scripts/test-finance-c11-postgres.cjs`. يترك الاختبار الملتزم بيانات اصطناعية وتاريخ تدقيق، والبوابات الجديدة مغلقة؛ يحتفظ بضوابط drain كما تتطلب العقود. لا يحذف بيانات أو يعيد تهيئة قاعدة. rollback لا يعيد sequences؛ لا external side effects أو Auth/Storage من SQL الاختبارات.

test-finance-c11-jwt.cjs يحتاج opt-in C11_JWT_ALLOW_DISPOSABLE_TEST=yes ومتطلبات C9 JWT المحلية المستقلة، Auth/PostgREST محليين، وأدوار حقيقية وfixture admin مفوض C11. يعيد تحقق C9 identity ثم يفحص منع دور غير مفوض/expected_user مزور للقراءة والتفعيل. لا يقبل URL مستضافًا. لا تطبع tokens. هذا الاختبار **غير منفذ**، وكذلك PostgreSQL/RLS/التزامن واختبار الهاتف.

استعلامات المالك للقراءة فقط بعد التطبيق في بيئته المعتمدة: supabase/verification/finance_c11_readiness.sql. نتائج البوابات متوقع false قبل التفعيل، وقد تكون readiness=false بسبب تفويضات مغلقة؛ هذا ليس دعوة لمنحها تلقائيًا. أخطاء C10 تتطلب مراجعة. صفر أخطاء مطابقة لا يثبت JWT أو السلوك المتزامن.

## 9. ملفات التسليم ونتائج الفحوص

جديدة: migration C11؛ SQL اختبار C11 وverification؛ finance-transition.ts وlegacy-delivery-collection.ts؛ FinanceTransitionReview.tsx و/admin/finance-transition؛ scripts/test-finance-c11.cjs و-postgres.cjs و-jwt.cjs وfinance-c11-inventory.cjs؛ هذه الوثيقة والجرد JSON.

معدلة: driver-collection.ts وdriver-deliveries.ts لقراءة المبلغ القديم؛ admin/finance.tsx للوصول للتقرير؛ MerchantSettlementPanel وMerchantSettlementAdministration وuseOrderRealtime لجدول C7 المعزول؛ finance-integration-contract.ts؛ مسودتا C7/C10 وverification C10 وSQL اختبار C7 وأدوات PostgreSQL C7/C8/C9/C9-completion والتوثيق C7 لتحديث اسم الجدول فقط. لا تعديل database.ts الرسمي، أو C2/C3، أو Layout.

نتائج التشغيل المحلي: 17 مجموعة ناجحة؛ 330 فحصًا مرقمًا ومجموعتا عقود إضافيتان بلا عداد. C11: 22 فحصًا. TypeScript ناجح؛ Lint صفر أخطاء وستة تحذيرات سابقة خارج نطاق C11؛ git diff --check ناجح؛ فحص صياغة أدوات C11 ناجح. لم يوجد psql/postgres على PATH، ولم يُنشأ اتصال. PostgreSQL وCOMMIT وRLS/JWT والتزامن الحقيقي والهاتف: NOT RUN.

ملاحظة إصدار أدوات الاختبار: أدوات PostgreSQL القديمة لكل مرحلة تستهدف مخطط تلك المرحلة وتوقعات أعلامها؛ بعد إضافة C11 لا تشغّلها عميانيًا على السلسلة الكاملة ببوابات C11 المغلقة. استخدم runner C11 الذي يركب اختبار C10 مع إعداد بوابات وتحقق C11 صريحين، وراجع اختبارات التزامن المرحلية قبل تشغيلها مع C11. لا يُفتح أي علم تلقائيًا عند مجرد استيراد الأدوات أو تشغيل الفحوص المحلية.
