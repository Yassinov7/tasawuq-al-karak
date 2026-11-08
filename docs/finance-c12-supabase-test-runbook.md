# C12 — حزمة تحقق بعد التطبيق على Supabase TEST

الهدف المصرح به من المالك: `dfpaeiffqkmedftjiqbm`، وليس إذنًا باتصال الوكيل أو بالكتابة. لا migration أو مستخدم أو طلب أو قيد جديد أو تفعيل ضمن هذه الجولة.

## الحالة الحالية ومصدر الإثبات

OWNER REPORTED: إصدارات C4–C11 الأحد عشر موجودة في schema_migrations؛ قيد journal_lines_syp_major_amount_check موجود، وقيد trunc(amount) القديم غير موجود؛ توقيع change_subscription_account(uuid,uuid,uuid,text,text,text) موجود بعد hotfix القوسين. هذه تأكيدات المالك، وليست نتائج SQL شاهدها الوكيل، ولا تثبت سلوك الدوال.

REMOTE READ-ONLY CHECKS: WAITING FOR OWNER RESULTS. SQL/JWT/RLS/concurrency/business cycles/reconciliation: NOT RUN BY AGENT. لا اعتماد للتفعيل حتى وصول نتائج القراءة ثم اختبار سلوكي مصرح وآمن. غياب PostgreSQL المحلي السابق لا ينفي وجود مشروع TEST الآن؛ بيئة أدوات الاختبار المعزولة المثبتة الهوية ما زالت غير مجهزة محليًا.

## 1. تشغيل القراءة فقط الآن

1. افتح Dashboard وتحقق بنفسك من مرجع المشروع `dfpaeiffqkmedftjiqbm`. اسم قاعدة postgres أو SQL يعرض النص المتوقع ليس دليل هوية المشروع.
2. افتح SQL Editor بصلاحية المالك. شغّل `supabase/verification/finance_c12_test_readonly.sql` فقط. يبدأ READ ONLY + REPEATABLE READ وينتهي ROLLBACK. لا set_config أو nextval أو RPC مالية أو إصلاحات أو DO/DDL.
3. راجع أولًا 01–03: 11 إصدارًا، و37 جدولًا و52 توقيع RPC من المخطط المحلي C2–C11، والمشغلات. أي missing/NULL/false أو خطأ SQL يستوجب التوقف والتقرير؛ لا تتجاوز الخطأ بحذف فحص، ولا تشغل الاختبارات التي تكتب. إذا أوقف خطأ المعاملة، نفّذ ROLLBACK فقط.
4. إذا أظهر 10_scheduler_catalog وجود cron.job، شغّل `supabase/verification/finance_c12_cron_readonly.sql` منفصلًا. إن كانت NULL فلا تشغله. الملف يعرض jobid/schedule/active وبصمة command فقط، ولا يطبع الأوامر أو URLs/headers/tokens.
5. أرسل النتائج بحسب section/check_name، مع تنقيح أي بيانات مالية/معرفات غير لازمة. لا ترسل كلمات مرور أو connection strings أو service-role أو JWT.

### تفسير النتائج

- 02_migration: 11 صفًا، pass=true. لا يعني وجود السجل تطابق جسم كل دالة أو نجاح السيناريوهات.
- 03_table: present=true وrls_enabled=true. 03_table_acl: anon/authenticated لا يملكان DML؛ authenticated SELECT قد يكون صحيحًا بشرط سياسة الدور/الملكية. service_role معروض للمراجعة ولا يُستعمل بدل JWT الدور. 03_rpc: present/prosecdef/empty_search_path=true، anon/service_execute=false وauthenticated_execute=true للمداخل المدرجة؛ grant لا يعني قبول إجراء بلا تفويض.
- 03_internal_acl: can_execute=false لجميع runtime roles على builders الثلاثة. 03_required_trigger: كل guard موجود وO أوA. تفاصيل 03_triggers تتيح مراجعة ربط المشغلات القديمة والجديدة وdeferrable؛ تفعيل trigger ليس إثبات منع double posting.
- 03_unvalidated_constraint/03_invalid_index: صفر صفوف. قائمة السياسات ليست اختبار JWT؛ افحص predicates والملكية وغياب سياسة عامة توسع القراءة.
- 04_private_* و04_unsafe_definer: صفر صفوف. هذه فحوص catalog فقط ولا تختبر امتيازًا فعليًا بهوية مستخدم.
- 05_accounts: 17 حسابًا، pass=true، وopening_balance_equity مصنف equity. amount_type=numeric وatttypmod=-1؛ القيد المحدد موجود ومتحقق، و05_old_whole_amount_constraint بلا صفوف. راجع نص CHECK ليكون amount=round(amount,2) وليس numeric typmod يُقرّب قبل الفحص.
- 06_c11_gates: ثمانية صفوف فقط، كلها admit=false وpass=true. 06_c11_all_off و06_baseline_all_off=true. لا يكفي أن C11 مغلقة: flags الأصلية وscheduler_enabled وopening_enabled يجب أن تكون مغلقة في baseline غير المفعلة. لا يعد الملف أي علم؛ وجود ضابط drain مفتوح يحتاج تفسير المالك، لا إغلاقًا تلقائيًا قد يعلق التزامات قائمة.
- 06_sensitive_grants: يعرض عدد التفويضات فقط. عدم وجود تفويض قد يكون الوضع المقصود. وجوده لا يثبت خرقًا بذاته؛ يجب أن يطابق قرار المالك. لا تُمنح أو تُلغى أي صلاحية في هذه الجولة.
- 07_volume: توثيق حجم الدليل. الدفتر الفارغ لا يثبت أن posting يعمل. جميع 07_bad/duplicate/invalid/reversal/negative checks متوقع صفر صفوف. pending_operation قائمة مراجعة، لا أمر إعادة تنفيذ أو حذف. قيد متوازن وحده لا يثبت صحة الحساب الاقتصادي؛ تطابق C10 مكمل، والسيناريو الحقيقي لازم.
- 08: صفر صفوف للازدواج أو الصياغة الخاطئة. فحص 6+ خانات لا يقص الأرقام الطويلة. FK وCHECK definitions معروضة؛ C10 يكمل ربط ORD/SUB/DLV ومراجع المستندات الجديدة.
- 09: errors=0؛ كل warning له تفسير قبل الاعتماد. 09_account_differences صفر صفوف. هذه مطابقة بيانات موجودة فقط؛ إذا كانت البيانات فارغة فهي دليل vacuous وليست اختبار دورة مالية. سلسلة helpers المقروءة في المصدر المحلي تستخدم SELECT فقط؛ لا تستدعي API الكتابة.
- 10: scheduler_enabled=false شرط مستقل. أي cron.job نشط يحتاج مراجعة المالك، سواء طابقت كلماته المالية أو لا؛ النداءات غير المباشرة قد لا تطابق keyword_hint. pgagent موجود؟ يلزم فحصه منفصلًا. قاعدة البيانات لا تثبت غياب Edge/external scheduler أو Webhooks أو مستدعٍ خارجي؛ تبقى مراجعة Dashboard/التشغيل الخارجي NOT VERIFIED، ولا يصرح التقرير بسلامتها.

الفحص لا ينفذ readiness activation RPC أو private scheduler. SELECT من C10 views يقرأ helpers subscription_invoice_voided/c6_cash_remaining/c9_request_state/c9_cash_cut ثم c9_cash_lines؛ فُحصت محليًا بوصفها SELECT-only. READ ONLY يمنع الكتابة داخل PostgreSQL، ولا يُقدّم إثباتًا عامًا عن خدمات خارجية.

## 2. اختبارات JWT الحقيقية — بعد إذن منفصل فقط

المطلوب قبل تشغيلها: موافقة مكتوبة على بيانات اصطناعية في TEST وعلى نطاق/مدة أي تفعيل تجريبي لازم، حصر UUIDs اختبار لا بيانات عميل، مستخدمون حقيقيون في Auth المحلي أو TEST المصرح، API URL مثبت إلى المرجع الصحيح ومفتاح publishable/anon فقط، وJWTs قصيرة العمر لا تطبع في logs. لا يوضع service-role في التطبيق أو تقرير أو shell history. لا إنشاء مستخدمين أو تفويضات الآن.

لا تختبر رفض RPC كتابة بإرسالها الآن حتى إن توقعت الرفض: العيب نفسه قد يجعلها تنفذ. موافقة اختبارات الكتابة يجب أن تسبق اختبارات الرفض تلك أيضًا. يمكن للمالك تنفيذ قراءات JWT فقط بعد تجهيز حسابات اختبار مأذونة، لكن غياب صفوف اختبار معروفة لا يثبت العزل.

مصفوفة السيناريوهات المطلوبة:

1. Customer: يرى سياق طلبه فقط، لا C2 journal/خزينة/عهدة، ولا طلب عميل آخر؛ expected_user مختلف يُرفض.
2. Merchant A/B: يرى كل منهما SUB ومستحقات/اشتراك متجره؛ لا إجمالي COD الأب أو بيانات التاجر الآخر. يلزم سجلان اصطناعيان مثبتان حتى لا يكون [] نجاحًا كاذبًا.
3. Driver A/B: السائق المسند فقط يرى مبلغ التحصيل الجاري والعهدة والأجر الخاصين به؛ لا يقرأ أو يستلم/يسلّم مهمة الآخر.
4. Admin بلا تفويض: مرفوض في إجراءات القبض/الصرف/التفعيل الحساسة. **تنبيه عقد قائم:** raw C2 SELECT تسمح به سياسة is_admin()؛ لا تفترض أن admin غير المفوض ممنوع من كل قراءة C2. تقييد ذلك يحتاج قرارًا منفصلًا، لا تعديلًا صامتًا هنا.
5. Admin قبض: C5 receiver وC8 collect فقط بحسب تفويضه، دون صرف أو اعتماد طلبه بنفسه.
6. Admin صرف: C6/C7/C9 pay وفق التفويض والخزينة والأهلية، لا تأكيد قبض تلقائي ولا اعتماد ذاتي.
7. Admin جرد/تصحيح: count/request/approve مستقلة؛ عداد النقد ومقدم التصحيح لا يعتمدان الفرق بأنفسهما.
8. Owner: opening mapping + permission + explicit approval؛ ليس admin role وحده. تبقى opening_enabled=false الآن. إثبات مسار الافتتاحي يحتاج إذن تجربة خاصًا لاحقًا.
9. Scheduler: لا يوجد JWT عام ينبغي منحه role=scheduler. اختبر رفض انتحاله بالـJWT، وتشغيله الحقيقي في جلسة مالك قاعدة اختبار موثوقة مع auth.uid NULL؛ سمّها SYSTEM OWNER SESSION، لا signed JWT.

أدوات test-finance-c9-jwt.cjs و-c10-jwt.cjs و-c11-jwt.cjs تستعمل HTTP حقيقيًا وتتحقق من Auth/profile، لكنها تقبل numeric loopback فقط. **لا تشغّلها على dfpaeiffqkmedftjiqbm، ولا تُزل حراسها أو تُبدّل URL لتجاوزها.**

المسار المتاح للأدوات الحالية: بيئة Supabase محلية معزولة، psql مثبت الهوية وmanifest خارج المستودع وfixtures مناسبة. بعد إذن المالك وتجهيزها، مثال محلي فقط:

```powershell
# لا تنفذ الآن. كل القيم محلية، وليست مفاتيح مشروع TEST المستضاف.
$env:C2_ALLOW_DISPOSABLE_TEST = 'yes'
$env:C9_JWT_ALLOW_DISPOSABLE_TEST = 'yes'
$env:C11_JWT_ALLOW_DISPOSABLE_TEST = 'yes'
# يجهز المالك C2_TEST_DATABASE_URL وC2_TEST_MANIFEST وC9_TEST_API_URL وtokens محلية.
node scripts/test-finance-c11-jwt.cjs
```

هذا المثال لا يثبت وحده كل المصفوفة أعلاه. تنفيذها على Supabase TEST المستضاف يتطلب harness مخصصًا منفصلًا، تثبيت project ref وهوية الاتصال وقائمة fixtures ونطاق الكتابة، وموافقة المالك. لم تُكتب أداة بعيدة متجاوزة للحماية في هذه الحزمة. لا تستعمل SQL Editor مع set_config كدليل توقيع JWT؛ هذا JWT CLAIM SIMULATION فقط.

## 3. PostgreSQL والتزامن — بعد إذن منفصل فقط

يلزم psql/driver موثوق ومسموح، اتصالات مستقلة، fixtures اصطناعية مثبتة، وحدود زمن، وسجل لكل attempt/event/reference، ومراقب read-only لإثبات تداخل المعاملتين بـpg_blocking_pids أو دليل مكافئ. Promise.all أو طلبان HTTP ناجحان متتاليان لا يثبتان overlap. اختبارات SQL التي تضبط claims هي محاكاة صلاحيات؛ أضف JWT حقيقيًا منفصلًا.

السيناريوهات المطلوبة، كل منها BLOCKED حاليًا:

- C3 متعدد المتاجر مع رفض متجر، لا زيادة في current.total، واستمرار snapshot الأصلي؛ لا DLV قبل الجميع ولا أكثر من DLV.
- C4 complete twice بنفس المفتاح وبمفتاح آخر ومتزامنين، lost response/recovery، version mismatch، review_required، zero_cash_delivery بلا cash event أو journal صفري؛ لا مبلغ من العميل.
- C5 RCT مزدوج/جزئي ومتزامن، reservations تمنع تجاوز العهدة، discrepancy لا يتحول إلى تسوية صامتة، وفشل القيد يرجع المعاملة كاملة.
- C6 الأجرة من snapshot، لا صرف قبل تسليم عهدة DLV كاملة، صرف مزدوج/نقص خزينة، ولا خصم من عهدة COD.
- C7 SUB مرفوض/مسلّم، عمولات مختلفة وثابتة، لا استحقاق ثانٍ لـC4، SET بلا cash، PAY مرة واحدة وبخزينة كافية.
- التنافس C6/C7/C9 على الخزينة، وقبض C8/C5 أثناء الصرف/الجرد؛ لا negative treasury أو lost update أو partial commit.
- C8 SIN/RCT والفترة المدفوعة، manual/automatic/disabled، إلغاء/تعليق دون محو تاريخ، 168 ساعة بالضبط، فاتورتا anchor ومجدولان متزامنان، لا قبض تلقائي، استمرار الطلبات السابقة واستعادة الأهلية بالسداد.
- C9 expense requested/approved بلا cash ثم posted فعليًا، تصحيح فرق مع حركة لاحقة، افتتاحيان متزامنان تحت إذن خاص، ومنع الذات/عدم كفاية التفويض.
- C11 legacy طلب قائم ومكتمل واشتراك مدفوع/منتهٍ، إيقاف admission أثناء طلب C4، استمرار drain، لا تحويل كاتب أو أرصدة أو ازدواج مع legacy.
- deferred fault عند COMMIT يرجع التسليم/التحصيل/الدفتر/المستحقات والنتيجة كلها؛ ثم نفس frozen attempt يُستعاد أو يعاد بأمان. افحص أيضًا COMMIT ناجحًا في معاملات منفصلة، لا rollback فقط.
- بعد كل دورة: C10 errors=0، warnings مفسرة، ومراجعة raw journals وORD/SUB/DLV/RCT/SET/PAY/SIN وعدم تكرار الحدث.

أداة test-finance-c11-postgres.cjs محلية loopback ومثبتة إلى *_c2_test/OID/systemIdentifier/token/psql. تعيد استخدام C10 مع إعداد واختبار C11 صريحين، وتنفذ COMMIT وتترك بيانات اصطناعية؛ لا تُشغّل على المشروع المستضاف ولا على قاعدة المستخدم الحالية. الأدوات المرحلية لها متطلبات مخطط وpristine fixtures مختلفة؛ لا تشغّل C2–C11 عميانيًا على قاعدة واحدة مستخدمة.

الأعلام مغلقة الآن: اختبار المسار الإيجابي end-to-end يحتاج تفويض تفعيل تجريبي محدود أولًا، أو بيئة محلية مصرحًا لها. لا تستنتج نجاحه من نجاح عمليات الرفض بسبب OFF، ولا تفتح علمًا لتجاوز الاختبار دون موافقة.

## 4. قائمة BLOCKED وقرار الإصدار

- نتائج ملف القراءة الرئيسي والـcron الاختياري: بانتظار المالك، لم تُنفذ من الوكيل.
- إثبات project identity من اتصال فعلي: بانتظار إجراء المالك، لا يكفي اسم postgres.
- signed JWT وكل صفوف العزل ذات fixtures موجبة: NOT RUN؛ المستخدمون/tokens والتفويضات المأذونة غير متاحة هنا.
- الكتابة الإيجابية والرفض على RPC mutating: BLOCKED — OWNER AUTHORIZATION + SYNTHETIC FIXTURES REQUIRED.
- اتصالات PostgreSQL/overlap/COMMIT والجولات المرحلية: BLOCKED — SAFE TEST RUNNER/ENVIRONMENT REQUIRED؛ الأدوات المحلية لا تدعم remote.
- بيانات C10 والمطابقة: NOT RUN، لا نعلن صفر فروقات.
- فحص Scheduler خارج قاعدة البيانات والهاتف: NOT VERIFIED / NOT RUN.

لا عيب مالي جديد مثبت من هذه الحزمة المصدرية وحدها، ولا إثبات لعدم وجوده. أي فشل PASS/zero-row أو mismatch/منح غير متوقعة/trigger معطل/C10 error أو automatic job غير معتمد يستلزم إيقاف الاعتماد والتحقيق، دون تعديل migrations المطبقة. أي إصلاح خادمي لاحق يحتاج additive migration منفصلة بعد مراجعة المالك، لا إعادة كتابة C2–C11.

**ليس READY FOR CONTROLLED ACTIVATION.** تأكيد التطبيق البنيوي تقدم مهم، لكنه لا يغلق C12. الخطوة التالية الآن: تشغيل المالك ملف القراءة فقط وإرجاع نتائجه؛ اختبارات الكتابة والتفعيل تبقى مؤجلة حتى موافقة منفصلة.
