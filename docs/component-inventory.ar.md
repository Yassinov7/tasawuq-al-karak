# جرد المكونات وإعادة الاستخدام

**102 وحدة TSX**: مكونات src/components ومضيفا AppDialog/Toast في context؛ **120 سجل تصدير مسمى بحرف كبير**، بينها حارس دور ومضيف Push غير مرئيين. hooks والأنواع المساعدة ليست ضمن عدد التصديرات المرئية. لا يمثل العدد عدد شاشات أو عدد مكونات معروضة على هاتف.

المستهلكون والصفحات محسوبون على مستوى الملف؛ تعدد exports قد يجعل القائمة أوسع من الاستخدام الفعلي لكل رمز. `—` لا يثبت أن المكون ميت: قد يستخدم من layout أو بتصدير آخر. مؤشرات loading/error/disabled تعني وجود رمز في الملف، وليست اختبار سلوك. المكون الزخرفي لا يحتاج حالات طلب شبكي؛ تدار لدى الأب. المكونات الخاصة لا تحول إلى مكون عام بشروط أدوار كثيرة.

## قرارات reuse قبل أي تنفيذ

- اعتماد AppButton/AppTextField/AppModal وKeyboardAwareScrollView وLoadingState وLiveStatus وToast/AppDialog أساسًا؛ لا مكتبة Toast جديدة ولا Alert أصلي.
- اعتماد FinancialAccountSummary/FinancialParts/InvoiceStatus/PendingMoneyCard مع الحفاظ على الصلاحيات ومفتاح العملية؛ لا إنشاء نموذج تشغيل حر لفاتورة الطلب أو الاشتراك.
- DeliveryTaskCard/StorePickupPanel قابلان للتحسين المحدد؛ افحص أزواج accent/accentLight وحالة Delivered بدل إعادة بناء إصلاح السائق المقبول.
- src/app/merchant/catalog.tsx يستخدم MerchantCatalogPanel مباشرة بالعرض المدمج. مسار المنتجات تحويل إلى تبويب المنتجات، ومسار العروض القديم يحوّل إلى تبويب العروض.
- FinancialAmount موجود في ui وكذلك FinancialParts: افحص اختلاف المسؤولية قبل دمج الرمزين؛ التشابه الاسمي ليس دليل تكرار مطابق.
- SharedAccountParts وMerchantAccountScreens يعيدان استخدام الهيكل؛ تجنب تضخم شروط الدور، وراجع كل تصدير ومستهلكه عند تعديل صف مشترك.
- AppBottomNav/AppHeader يؤثران في كل الأدوار؛ أي تعديل لازم للصفحة الحالية يحتاج اختبار تنقل وsafe area لجميع المستهلكين.

## AboutContent

- الملف: `src/components/about/AboutContent.tsx`. الوظيفة: محتوى تعريف التطبيق.
- صفحات محتملة بالوصول الساكن: RUI-LEGAL-01.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/about.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## AboutFeatureList

- الملف: `src/components/about/AboutFeatureList.tsx`. الوظيفة: قائمة مزايا التطبيق التعريفية.
- صفحات محتملة بالوصول الساكن: RUI-LEGAL-01.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/components/about/AboutContent.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## AboutHeader

- الملف: `src/components/about/AboutHeader.tsx`. الوظيفة: هوية وترويسة صفحة معلومات التطبيق.
- صفحات محتملة بالوصول الساكن: RUI-LEGAL-01.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/about.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## AccountMenuItem

- الملف: `src/components/account/AccountMenuItem.tsx`. الوظيفة: صف رابط ضمن حسابي.
- صفحات محتملة بالوصول الساكن: RUI-MER-10، RUI-MER-11، RUI-MER-13، RUI-DRV-04، RUI-ADM-13، RUI-CUS-15، RUI-SHR-05، RUI-SHR-06.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/admin/more.tsx`، `src/app/driver/account.tsx`، `src/app/home/account.tsx`، `src/components/account/SharedAccountParts.tsx`، `src/components/merchant/MerchantAccountScreens.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error غير ظاهر؛ افحص الأب/props؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## AccountProfileHeader

- الملف: `src/components/account/AccountProfileHeader.tsx`. الوظيفة: بطاقة هوية الحساب.
- صفحات محتملة بالوصول الساكن: RUI-MER-10، RUI-MER-11، RUI-MER-13، RUI-DRV-04، RUI-ADM-13، RUI-CUS-15، RUI-SHR-05، RUI-SHR-06.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/driver/account.tsx`، `src/components/account/SharedAccountParts.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## AccountSection

- الملف: `src/components/account/AccountSection.tsx`. الوظيفة: تجميع عناصر حسابي بعنوان.
- صفحات محتملة بالوصول الساكن: RUI-MER-10، RUI-MER-11، RUI-MER-13، RUI-DRV-04، RUI-DRV-04.01، RUI-ADM-13، RUI-CUS-15، RUI-SHR-05، RUI-SHR-06.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/admin/more.tsx`، `src/app/driver/account.tsx`، `src/app/home/account.tsx`، `src/components/account/DriverProfessionalInfo.tsx`، `src/components/account/PersonalInfoScreen.tsx`، `src/components/account/SecurityScreen.tsx`، `src/components/account/SharedAccountParts.tsx`، `src/components/admin/C3DeliverySettings.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## AccountShell

- الملف: `src/components/account/AccountShell.tsx`. الوظيفة: حاوية تخطيط صفحة حساب.
- صفحات محتملة بالوصول الساكن: RUI-MER-10، RUI-MER-11، RUI-MER-13، RUI-DRV-04، RUI-DRV-04.01، RUI-ADM-13، RUI-CUS-15، RUI-SHR-05، RUI-SHR-06.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/admin/more.tsx`، `src/app/driver/account.tsx`، `src/app/driver/credentials.tsx`، `src/app/home/account.tsx`، `src/components/account/PersonalInfoScreen.tsx`، `src/components/account/SecurityScreen.tsx`، `src/components/merchant/MerchantAccountScreens.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: لا دليل مباشر في الملف؛ افحص الوراثة والأيقونات.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## DriverProfessionalInfo

- الملف: `src/components/account/DriverProfessionalInfo.tsx`. الوظيفة: عرض بيانات السائق المهنية.
- صفحات محتملة بالوصول الساكن: RUI-DRV-04، RUI-DRV-04.01.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/driver/account.tsx`، `src/app/driver/credentials.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## PersonalInfoScreen

- الملف: `src/components/account/PersonalInfoScreen.tsx`. الوظيفة: شاشة البيانات الشخصية والتحقق والحفظ.
- صفحات محتملة بالوصول الساكن: RUI-MER-10، RUI-MER-11، RUI-SHR-05.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/personal-info.tsx`، `src/components/merchant/MerchantAccountScreens.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## SecurityScreen

- الملف: `src/components/account/SecurityScreen.tsx`. الوظيفة: شاشة كلمة المرور والأمان الموجود.
- صفحات محتملة بالوصول الساكن: RUI-MER-13، RUI-SHR-06.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/merchant/security.tsx`، `src/app/security.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## SettingsScreen

- الملف: `src/components/account/SettingsScreen.tsx`. الوظيفة: شاشة تفضيلات الحساب والثيم.
- صفحات محتملة بالوصول الساكن: RUI-MER-12، RUI-DRV-04.02، RUI-SHR-04.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/driver/settings.tsx`، `src/app/merchant/settings.tsx`، `src/app/settings.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## AccountLoadState

- الملف: `src/components/account/SharedAccountParts.tsx`. الوظيفة: عرض تحميل أو خطأ الحساب.
- صفحات محتملة بالوصول الساكن: RUI-MER-10، RUI-MER-11، RUI-MER-13، RUI-DRV-04، RUI-ADM-13، RUI-CUS-15، RUI-SHR-05، RUI-SHR-06.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/admin/more.tsx`، `src/app/driver/account.tsx`، `src/app/home/account.tsx`، `src/components/account/PersonalInfoScreen.tsx`، `src/components/account/SecurityScreen.tsx`، `src/components/merchant/MerchantAccountScreens.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## AccountLogout

- الملف: `src/components/account/SharedAccountParts.tsx`. الوظيفة: إجراء الخروج من الحساب.
- صفحات محتملة بالوصول الساكن: RUI-MER-10، RUI-MER-11، RUI-MER-13، RUI-DRV-04، RUI-ADM-13، RUI-CUS-15، RUI-SHR-05، RUI-SHR-06.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/admin/more.tsx`، `src/app/driver/account.tsx`، `src/app/home/account.tsx`، `src/components/account/PersonalInfoScreen.tsx`، `src/components/account/SecurityScreen.tsx`، `src/components/merchant/MerchantAccountScreens.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## SharedAccountIdentity

- الملف: `src/components/account/SharedAccountParts.tsx`. الوظيفة: عرض بيانات هوية الحساب المشتركة.
- صفحات محتملة بالوصول الساكن: RUI-MER-10، RUI-MER-11، RUI-MER-13، RUI-DRV-04، RUI-ADM-13، RUI-CUS-15، RUI-SHR-05، RUI-SHR-06.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/admin/more.tsx`، `src/app/driver/account.tsx`، `src/app/home/account.tsx`، `src/components/account/PersonalInfoScreen.tsx`، `src/components/account/SecurityScreen.tsx`، `src/components/merchant/MerchantAccountScreens.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## SharedAccountMenu

- الملف: `src/components/account/SharedAccountParts.tsx`. الوظيفة: روابط البيانات والإعدادات والأمان المشتركة.
- صفحات محتملة بالوصول الساكن: RUI-MER-10، RUI-MER-11، RUI-MER-13، RUI-DRV-04، RUI-ADM-13، RUI-CUS-15، RUI-SHR-05، RUI-SHR-06.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/admin/more.tsx`، `src/app/driver/account.tsx`، `src/app/home/account.tsx`، `src/components/account/PersonalInfoScreen.tsx`، `src/components/account/SecurityScreen.tsx`، `src/components/merchant/MerchantAccountScreens.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## AdminCategoriesScreen

- الملف: `src/components/admin/AdminCategoriesScreen.tsx`. الوظيفة: جزء متخصص؛ اقرأ عقد props قبل إعادة الاستخدام.
- صفحات محتملة بالوصول الساكن: RUI-ADM-14.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/admin/categories.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## C3DeliverySettings

- الملف: `src/components/admin/C3DeliverySettings.tsx`. الوظيفة: نموذج إعدادات التوصيل الإداري المضمن.
- صفحات محتملة بالوصول الساكن: RUI-ADM-13.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/admin/more.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## HomeAdTargetPicker

- الملف: `src/components/admin/HomeAdTargetPicker.tsx`. الوظيفة: اختيار وجهة إعلان باسم المتجر أو المنتج أو العرض.
- صفحات محتملة بالوصول الساكن: RUI-ADM-15.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/admin/home-ads.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## ApplicationStatusEmptyState

- الملف: `src/components/application-status/ApplicationStatusEmptyState.tsx`. الوظيفة: فراغ حالة طلب الانضمام.
- صفحات محتملة بالوصول الساكن: RUI-AUTH-08.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/application-status.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: لا دليل مباشر في الملف؛ افحص الوراثة والأيقونات.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## OnboardingFrame

- الملف: `src/components/auth/OnboardingFrame.tsx`. الوظيفة: إطار تدفق التسجيل والانضمام.
- صفحات محتملة بالوصول الساكن: RUI-AUTH-04، RUI-AUTH-05، RUI-AUTH-06، RUI-AUTH-07، RUI-AUTH-08.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/application-status.tsx`، `src/app/reset-password.tsx`، `src/app/verify-email.tsx`، `src/components/signup/ProfessionalApplicationScreen.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error غير ظاهر؛ افحص الأب/props؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## RoleRouteGuard

- الملف: `src/components/auth/RoleRouteGuard.tsx`. الوظيفة: حارس دور المسار وحالات انتظار/رفض الدخول.
- صفحات محتملة بالوصول الساكن: —.
- مستخدم عبر layout: `src/app/admin/_layout.tsx`، `src/app/driver/_layout.tsx`، `src/app/merchant/_layout.tsx`.
- المستهلكون المباشرون: `src/app/admin/_layout.tsx`، `src/app/driver/_layout.tsx`، `src/app/merchant/_layout.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## BrandMark

- الملف: `src/components/brand/BrandMark.tsx`. الوظيفة: الشعار والهوية.
- صفحات محتملة بالوصول الساكن: RUI-AUTH-01، RUI-AUTH-02، RUI-AUTH-04، RUI-LEGAL-01.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/index.tsx`، `src/app/verify-email.tsx`، `src/components/about/AboutHeader.tsx`، `src/components/login/LoginHeader.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: لا دليل مباشر في الملف؛ افحص الوراثة والأيقونات.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## DeliveryTaskCard

- الملف: `src/components/driver/DeliveryTaskCard.tsx`. الوظيفة: بطاقة المهمة وحالاتها والتحصيل وإجراء تقدمها.
- صفحات محتملة بالوصول الساكن: —.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: —.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: يبقى؛ تحسين أزواج ألوان الحالات المحلية وonPrimary عند RUI-DRV-02، دون إعادة بناء FIX-DRV-01 المقبولة. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## DriverPickupPreview

- الملف: `src/components/driver/DriverTaskLocation.tsx`. الوظيفة: جزء متخصص؛ اقرأ عقد props قبل إعادة الاستخدام.
- صفحات محتملة بالوصول الساكن: RUI-DRV-01، RUI-DRV-02، RUI-DRV-02.01.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/driver/index.tsx`، `src/app/driver/orders.tsx`، `src/app/driver/task-details.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## DriverTaskDestination

- الملف: `src/components/driver/DriverTaskLocation.tsx`. الوظيفة: جزء متخصص؛ اقرأ عقد props قبل إعادة الاستخدام.
- صفحات محتملة بالوصول الساكن: RUI-DRV-01، RUI-DRV-02، RUI-DRV-02.01.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/driver/index.tsx`، `src/app/driver/orders.tsx`، `src/app/driver/task-details.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## StorePickupPanel

- الملف: `src/components/driver/StorePickupPanel.tsx`. الوظيفة: خطوات استلام المهمة من كل متجر.
- صفحات محتملة بالوصول الساكن: RUI-DRV-02.01.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/driver/task-details.tsx`، `src/components/driver/DeliveryTaskCard.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error غير ظاهر؛ افحص الأب/props؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## FinanceScreen

- الملف: `src/components/finance/FinanceScreen.tsx`. الوظيفة: شاشة مالية مشتركة مقيّدة بالدور والطرف.
- صفحات محتملة بالوصول الساكن: RUI-MER-03، RUI-ADM-06، RUI-CUS-12، RUI-SHR-03.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/admin/finance.tsx`، `src/app/invoice.tsx`، `src/app/merchant/finance.tsx`، `src/app/wallet.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: يبقى السلوك المالي المقبول؛ افصل العرض فقط حسب حاجة الدور ولا تغير مفتاح التحقق أو شروط الإجراء؛ UX-03/04 تنتظران القبول. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## FinancialAccountSummary

- الملف: `src/components/finance/FinancialAccountSummary.tsx`. الوظيفة: ملخص حساب الطرف ومستحقاته.
- صفحات محتملة بالوصول الساكن: RUI-MER-03، RUI-ADM-06، RUI-CUS-12، RUI-SHR-03.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/components/finance/FinanceScreen.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## FinancialAmount

- الملف: `src/components/finance/FinancialParts.tsx`. الوظيفة: عرض مبلغ باستخدام التنسيق المالي القائم؛ المصدر يحدد عقد كل نسخة.
- صفحات محتملة بالوصول الساكن: RUI-MER-03، RUI-DRV-03، RUI-ADM-06، RUI-CUS-12، RUI-SHR-02، RUI-SHR-03.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/financial-invoice.tsx`، `src/components/finance/FinanceScreen.tsx`، `src/components/finance/FinancialAccountSummary.tsx`، `src/components/finance/InvoiceScreen.tsx`، `src/components/finance/MerchantFinanceView.tsx`، `src/components/finance/MerchantInvoiceScreen.tsx`، `src/components/finance/PendingMoneyCard.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: نسختان بالاسم نفسه في ui وFinancialParts؛ قارن العقد والتنسيق والمستهلكين قبل أي دمج، لا تخلط الحساب بالعرض. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## FinancialFeedback

- الملف: `src/components/finance/FinancialParts.tsx`. الوظيفة: رسالة مالية داخل سياقها.
- صفحات محتملة بالوصول الساكن: RUI-MER-03، RUI-DRV-03، RUI-ADM-06، RUI-CUS-12، RUI-SHR-02، RUI-SHR-03.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/financial-invoice.tsx`، `src/components/finance/FinanceScreen.tsx`، `src/components/finance/FinancialAccountSummary.tsx`، `src/components/finance/InvoiceScreen.tsx`، `src/components/finance/MerchantFinanceView.tsx`، `src/components/finance/MerchantInvoiceScreen.tsx`، `src/components/finance/PendingMoneyCard.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## FinancialSection

- الملف: `src/components/finance/FinancialParts.tsx`. الوظيفة: حاوية قسم مالي.
- صفحات محتملة بالوصول الساكن: RUI-MER-03، RUI-DRV-03، RUI-ADM-06، RUI-CUS-12، RUI-SHR-02، RUI-SHR-03.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/financial-invoice.tsx`، `src/components/finance/FinanceScreen.tsx`، `src/components/finance/FinancialAccountSummary.tsx`، `src/components/finance/InvoiceScreen.tsx`، `src/components/finance/MerchantFinanceView.tsx`، `src/components/finance/MerchantInvoiceScreen.tsx`، `src/components/finance/PendingMoneyCard.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## InvoiceListItem

- الملف: `src/components/finance/FinancialParts.tsx`. الوظيفة: صف فاتورة ورابط تفاصيلها.
- صفحات محتملة بالوصول الساكن: RUI-MER-03، RUI-DRV-03، RUI-ADM-06، RUI-CUS-12، RUI-SHR-02، RUI-SHR-03.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/financial-invoice.tsx`، `src/components/finance/FinanceScreen.tsx`، `src/components/finance/FinancialAccountSummary.tsx`، `src/components/finance/InvoiceScreen.tsx`، `src/components/finance/MerchantFinanceView.tsx`، `src/components/finance/MerchantInvoiceScreen.tsx`، `src/components/finance/PendingMoneyCard.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## InvoiceScreen

- الملف: `src/components/finance/InvoiceScreen.tsx`. الوظيفة: تفاصيل المستند والسداد وأدوات الإدارة المصرح بها.
- صفحات محتملة بالوصول الساكن: RUI-CUS-12، RUI-SHR-02.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/financial-invoice.tsx`، `src/app/invoice.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: يبقى السلوك المالي المقبول؛ افصل العرض فقط حسب حاجة الدور ولا تغير مفتاح التحقق أو شروط الإجراء؛ UX-03/04 تنتظران القبول. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## InvoiceStatus

- الملف: `src/components/finance/InvoiceStatus.tsx`. الوظيفة: عرض حالة مستند/استحقاق الفاتورة.
- صفحات محتملة بالوصول الساكن: RUI-MER-03، RUI-DRV-03، RUI-ADM-06، RUI-CUS-12، RUI-SHR-02، RUI-SHR-03.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/components/finance/FinancialParts.tsx`، `src/components/finance/InvoiceScreen.tsx`، `src/components/finance/MerchantFinanceView.tsx`، `src/components/finance/MerchantInvoiceScreen.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## FinanceAccountView

- الملف: `src/components/finance/MerchantFinanceView.tsx`. الوظيفة: جزء متخصص؛ اقرأ عقد props قبل إعادة الاستخدام.
- صفحات محتملة بالوصول الساكن: RUI-MER-03، RUI-DRV-03، RUI-ADM-06، RUI-CUS-12، RUI-SHR-03.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/driver/cash-account.tsx`، `src/app/merchant/finance.tsx`، `src/components/finance/FinanceScreen.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## MerchantFinanceView

- الملف: `src/components/finance/MerchantFinanceView.tsx`. الوظيفة: رصيد المتجر والاشتراك والبحث وقائمة المستندات للتاجر.
- صفحات محتملة بالوصول الساكن: RUI-MER-03، RUI-DRV-03، RUI-ADM-06، RUI-CUS-12، RUI-SHR-03.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/driver/cash-account.tsx`، `src/app/merchant/finance.tsx`، `src/components/finance/FinanceScreen.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## MerchantInvoiceDocument

- الملف: `src/components/finance/MerchantInvoiceScreen.tsx`. الوظيفة: جزء متخصص؛ اقرأ عقد props قبل إعادة الاستخدام.
- صفحات محتملة بالوصول الساكن: RUI-SHR-02.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/financial-invoice.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## MerchantInvoiceScreen

- الملف: `src/components/finance/MerchantInvoiceScreen.tsx`. الوظيفة: جزء متخصص؛ اقرأ عقد props قبل إعادة الاستخدام.
- صفحات محتملة بالوصول الساكن: RUI-SHR-02.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/financial-invoice.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## PendingMoneyCard

- الملف: `src/components/finance/PendingMoneyCard.tsx`. الوظيفة: ملخص عملية مالية غير محسومة ومسار التحقق بنفس المفتاح.
- صفحات محتملة بالوصول الساكن: RUI-MER-03، RUI-ADM-06، RUI-CUS-12، RUI-SHR-02، RUI-SHR-03.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/components/finance/FinanceScreen.tsx`، `src/components/finance/InvoiceScreen.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: يبقى السلوك المالي المقبول؛ افصل العرض فقط حسب حاجة الدور ولا تغير مفتاح التحقق أو شروط الإجراء؛ UX-03/04 تنتظران القبول. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## CustomerHomeSponsored

- الملف: `src/components/home/CustomerHomeSponsored.tsx`. الوظيفة: مساحة الإعلان 16:9 مع تبديل وفيديو صامت.
- صفحات محتملة بالوصول الساكن: RUI-CUS-01.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/home/index.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## HomeSummary

- الملف: `src/components/home/HomeSummary.tsx`. الوظيفة: ملخص تشغيلي قابل للانتقال إلى قائمته.
- صفحات محتملة بالوصول الساكن: RUI-MER-01، RUI-ADM-01.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/admin/index.tsx`، `src/app/merchant/index.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error غير ظاهر؛ افحص الأب/props؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: يبقى؛ compact اختياري لرئيسية التاجر فقط، مع الحفاظ على العرض الافتراضي للمستهلكين الآخرين؛ بانتظار قبول تصميم الهاتف. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## LegalPageLayout

- الملف: `src/components/legal/LegalPageLayout.tsx`. الوظيفة: تخطيط صفحة قانونية قابلة للقراءة.
- صفحات محتملة بالوصول الساكن: RUI-LEGAL-02، RUI-LEGAL-03.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/privacy.tsx`، `src/app/terms.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## LegalRelatedDocument

- الملف: `src/components/legal/LegalRelatedDocument.tsx`. الوظيفة: رابط إلى مستند قانوني مرتبط.
- صفحات محتملة بالوصول الساكن: RUI-LEGAL-02، RUI-LEGAL-03.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/components/legal/LegalPageLayout.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## LegalSection

- الملف: `src/components/legal/LegalSection.tsx`. الوظيفة: فقرة قانونية بعنوان.
- صفحات محتملة بالوصول الساكن: RUI-LEGAL-02، RUI-LEGAL-03.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/components/legal/LegalPageLayout.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## ForgotPasswordSection

- الملف: `src/components/login/ForgotPasswordSection.tsx`. الوظيفة: نموذج طلب استعادة كلمة المرور.
- صفحات محتملة بالوصول الساكن: RUI-AUTH-02.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/components/login/LoginForm.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## LoginFooter

- الملف: `src/components/login/LoginFooter.tsx`. الوظيفة: روابط أسفل تسجيل الدخول.
- صفحات محتملة بالوصول الساكن: RUI-AUTH-02.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/login.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## LoginForm

- الملف: `src/components/login/LoginForm.tsx`. الوظيفة: حقول الدخول والتحقق والإرسال.
- صفحات محتملة بالوصول الساكن: RUI-AUTH-02.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/login.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## LoginHeader

- الملف: `src/components/login/LoginHeader.tsx`. الوظيفة: ترويسة الدخول والهوية.
- صفحات محتملة بالوصول الساكن: RUI-AUTH-02.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/login.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## CategoryChip

- الملف: `src/components/marketplace/CategoryChip.tsx`. الوظيفة: اختيار فئة ضمن السوق.
- صفحات محتملة بالوصول الساكن: RUI-CUS-01، RUI-CUS-02، RUI-CUS-03، RUI-CUS-04، RUI-CUS-06.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/home/index.tsx`، `src/app/home/offers.tsx`، `src/app/store-details.tsx`، `src/app/stores.tsx`، `src/components/search/ProductRefinements.tsx`، `src/components/search/SearchResults.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## CustomerCatalogStatus

- الملف: `src/components/marketplace/CustomerCatalogStatus.tsx`. الوظيفة: حالات توفر/تحميل الكتالوج للعميل.
- صفحات محتملة بالوصول الساكن: RUI-CUS-02، RUI-CUS-03، RUI-CUS-04، RUI-CUS-05، RUI-CUS-06، RUI-CUS-07، RUI-CUS-08، RUI-CUS-13.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/cart.tsx`، `src/app/favorites.tsx`، `src/app/home/offers.tsx`، `src/app/home/search.tsx`، `src/app/offer-details.tsx`، `src/app/product-details.tsx`، `src/app/store-details.tsx`، `src/app/stores.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## OfferCard

- الملف: `src/components/marketplace/OfferCard.tsx`. الوظيفة: بطاقة عرض وسعره وتوفره.
- صفحات محتملة بالوصول الساكن: RUI-CUS-01، RUI-CUS-04، RUI-CUS-06.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/home/index.tsx`، `src/app/home/offers.tsx`، `src/app/store-details.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## ProductCard

- الملف: `src/components/marketplace/ProductCard.tsx`. الوظيفة: بطاقة منتج وإجراءاته.
- صفحات محتملة بالوصول الساكن: RUI-CUS-01، RUI-CUS-02، RUI-CUS-04، RUI-CUS-05.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/home/index.tsx`، `src/app/product-details.tsx`، `src/app/store-details.tsx`، `src/components/search/SearchResults.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## ProductMediaGallery

- الملف: `src/components/marketplace/ProductMediaGallery.tsx`. الوظيفة: معرض وسائط المنتج.
- صفحات محتملة بالوصول الساكن: RUI-CUS-05.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/product-details.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## ProductMediaPreview

- الملف: `src/components/marketplace/ProductMediaPreview.tsx`. الوظيفة: معاينة وسائط مكبرة.
- صفحات محتملة بالوصول الساكن: RUI-CUS-05.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/components/marketplace/ProductMediaGallery.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: #FFFFFF.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## RatingsSection

- الملف: `src/components/marketplace/RatingsSection.tsx`. الوظيفة: قائمة تقييمات وملخصها ونموذجها.
- صفحات محتملة بالوصول الساكن: RUI-CUS-04، RUI-CUS-05.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/product-details.tsx`، `src/app/store-details.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## RatingStars

- الملف: `src/components/marketplace/RatingStars.tsx`. الوظيفة: تمثيل التقييم بالنجوم.
- صفحات محتملة بالوصول الساكن: RUI-CUS-01، RUI-CUS-02، RUI-CUS-03، RUI-CUS-04، RUI-CUS-05.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/product-details.tsx`، `src/components/marketplace/ProductCard.tsx`، `src/components/marketplace/RatingsSection.tsx`، `src/components/marketplace/ReviewCard.tsx`، `src/components/marketplace/ReviewForm.tsx`، `src/components/marketplace/StoreCard.tsx`، `src/components/marketplace/StoreDetailsHero.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## RatingSummary

- الملف: `src/components/marketplace/RatingStars.tsx`. الوظيفة: ملخص عددي للتقييم.
- صفحات محتملة بالوصول الساكن: RUI-CUS-01، RUI-CUS-02، RUI-CUS-03، RUI-CUS-04، RUI-CUS-05.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/product-details.tsx`، `src/components/marketplace/ProductCard.tsx`، `src/components/marketplace/RatingsSection.tsx`، `src/components/marketplace/ReviewCard.tsx`، `src/components/marketplace/ReviewForm.tsx`، `src/components/marketplace/StoreCard.tsx`، `src/components/marketplace/StoreDetailsHero.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## ReviewCard

- الملف: `src/components/marketplace/ReviewCard.tsx`. الوظيفة: عرض تقييم ومحتواه.
- صفحات محتملة بالوصول الساكن: RUI-CUS-04، RUI-CUS-05.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/components/marketplace/RatingsSection.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## ReviewForm

- الملف: `src/components/marketplace/ReviewForm.tsx`. الوظيفة: نموذج كتابة تقييم.
- صفحات محتملة بالوصول الساكن: RUI-CUS-04، RUI-CUS-05.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/components/marketplace/RatingsSection.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## ShoppingCardImage

- الملف: `src/components/marketplace/ShoppingCardImage.tsx`. الوظيفة: صور بطاقات السوق العامة وروابط الوسائط المقيدة بالذاكرة.
- صفحات محتملة بالوصول الساكن: RUI-ADM-15، RUI-CUS-01، RUI-CUS-02، RUI-CUS-03، RUI-CUS-04، RUI-CUS-05، RUI-CUS-06.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/admin/home-ads.tsx`، `src/components/admin/HomeAdTargetPicker.tsx`، `src/components/home/CustomerHomeSponsored.tsx`، `src/components/marketplace/OfferCard.tsx`، `src/components/marketplace/ProductCard.tsx`، `src/components/marketplace/StoreCard.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: لا دليل مباشر في الملف؛ افحص الوراثة والأيقونات.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## StoreCard

- الملف: `src/components/marketplace/StoreCard.tsx`. الوظيفة: بطاقة متجر وتوفره.
- صفحات محتملة بالوصول الساكن: RUI-CUS-01، RUI-CUS-02، RUI-CUS-03.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/home/index.tsx`، `src/app/stores.tsx`، `src/components/search/SearchResults.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## StoreDetailsHero

- الملف: `src/components/marketplace/StoreDetailsHero.tsx`. الوظيفة: هوية المتجر في صفحة تفاصيله.
- صفحات محتملة بالوصول الساكن: RUI-CUS-04.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/store-details.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## MerchantAccountHub

- الملف: `src/components/merchant/MerchantAccountScreens.tsx`. الوظيفة: صفحة حساب التاجر وروابطه.
- صفحات محتملة بالوصول الساكن: RUI-MER-10، RUI-MER-11.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/merchant/account.tsx`، `src/app/merchant/personal-info.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## MerchantPersonalInfo

- الملف: `src/components/merchant/MerchantAccountScreens.tsx`. الوظيفة: بيانات التاجر الشخصية.
- صفحات محتملة بالوصول الساكن: RUI-MER-10، RUI-MER-11.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/merchant/account.tsx`، `src/app/merchant/personal-info.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## MerchantAddProduct

- الملف: `src/components/merchant/MerchantAddProduct.tsx`. الوظيفة: تدفق إضافة منتج.
- صفحات محتملة بالوصول الساكن: RUI-MER-06.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/merchant/product-editor.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: لا دليل مباشر في الملف؛ افحص الوراثة والأيقونات.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## MerchantCatalogPanel

- الملف: `src/components/merchant/MerchantCatalogPanel.tsx`. الوظيفة: قائمة كتالوج موحدة بحسب kind للمنتجات أو العروض.
- صفحات محتملة بالوصول الساكن: RUI-MER-04.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/merchant/catalog.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: يبقى؛ يستعمله الكتالوج بالعرض المدمج وصفحة العروض بالعرض الافتراضي. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## MerchantCategorySelect

- الملف: `src/components/merchant/MerchantCategorySelect.tsx`. الوظيفة: اختيار فئة منتج المتجر.
- صفحات محتملة بالوصول الساكن: RUI-MER-06، RUI-MER-08، RUI-AUTH-03، RUI-AUTH-06، RUI-AUTH-07.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/components/merchant/MerchantProductForm.tsx`، `src/components/signup/ProfessionalApplicationFields.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## MerchantEditProduct

- الملف: `src/components/merchant/MerchantEditProduct.tsx`. الوظيفة: تحميل وتعديل منتج قائم.
- صفحات محتملة بالوصول الساكن: RUI-MER-06.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/merchant/product-editor.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: لا دليل مباشر في الملف؛ افحص الوراثة والأيقونات.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## FinancialCard

- الملف: `src/components/merchant/MerchantFinancialCards.tsx`. الوظيفة: حاوية بطاقة مالية تجارية.
- صفحات محتملة بالوصول الساكن: —.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: —.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## FinancialLink

- الملف: `src/components/merchant/MerchantFinancialCards.tsx`. الوظيفة: رابط مالي مصور.
- صفحات محتملة بالوصول الساكن: —.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: —.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## FinancialText

- الملف: `src/components/merchant/MerchantFinancialCards.tsx`. الوظيفة: نص مالي بتنسيق محلي.
- صفحات محتملة بالوصول الساكن: —.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: —.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## MerchantOfferEditor

- الملف: `src/components/merchant/MerchantOfferEditor.tsx`. الوظيفة: إدارة تحميل وحفظ محرر العرض.
- صفحات محتملة بالوصول الساكن: RUI-MER-08.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/merchant/offer-editor.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: لا دليل مباشر في الملف؛ افحص الوراثة والأيقونات.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## MerchantOfferForm

- الملف: `src/components/merchant/MerchantOfferForm.tsx`. الوظيفة: حقول العرض والتحقق منه.
- صفحات محتملة بالوصول الساكن: RUI-MER-08.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/components/merchant/MerchantOfferEditor.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## MerchantProductForm

- الملف: `src/components/merchant/MerchantProductForm.tsx`. الوظيفة: حقول المنتج والسعر والوحدة والوسائط.
- صفحات محتملة بالوصول الساكن: RUI-MER-06، RUI-MER-08.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/components/merchant/MerchantAddProduct.tsx`، `src/components/merchant/MerchantEditProduct.tsx`، `src/components/merchant/MerchantOfferEditor.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## MerchantStoreBranding

- الملف: `src/components/merchant/MerchantStoreBranding.tsx`. الوظيفة: تحرير وسائط هوية المتجر.
- صفحات محتملة بالوصول الساكن: RUI-MER-09.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/components/merchant/MerchantStoreInfo.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## MerchantStoreInfo

- الملف: `src/components/merchant/MerchantStoreInfo.tsx`. الوظيفة: معلومات المتجر والتواصل.
- صفحات محتملة بالوصول الساكن: RUI-MER-09.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/merchant/store-info.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## OfferExpirationPicker

- الملف: `src/components/merchant/OfferExpirationPicker.tsx`. الوظيفة: تحديد انتهاء العرض.
- صفحات محتملة بالوصول الساكن: RUI-MER-08.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/components/merchant/MerchantOfferForm.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## SellingUnitSelect

- الملف: `src/components/merchant/SellingUnitSelect.tsx`. الوظيفة: اختيار وحدة البيع.
- صفحات محتملة بالوصول الساكن: RUI-MER-06، RUI-MER-08.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/components/merchant/MerchantProductForm.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## AppBottomNav

- الملف: `src/components/navigation/AppBottomNav.tsx`. الوظيفة: شريط وجهات الدور وحالتها النشطة.
- صفحات محتملة بالوصول الساكن: —.
- مستخدم عبر layout: `src/app/_layout.tsx`، `src/app/admin/_layout.tsx`، `src/app/merchant/_layout.tsx`.
- المستهلكون المباشرون: `src/app/_layout.tsx`، `src/app/admin/_layout.tsx`، `src/app/merchant/_layout.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## AppHeader

- الملف: `src/components/navigation/AppHeader.tsx`. الوظيفة: ترويسة وعودة وجرس بحسب السياق.
- صفحات محتملة بالوصول الساكن: RUI-MER-03، RUI-MER-10، RUI-MER-11، RUI-MER-12، RUI-MER-13، RUI-DRV-01، RUI-DRV-02، RUI-DRV-02.01، RUI-DRV-03، RUI-DRV-04، RUI-DRV-04.01، RUI-DRV-04.02، RUI-ADM-06، RUI-CUS-01، RUI-CUS-02، RUI-CUS-03، RUI-CUS-04، RUI-CUS-05، RUI-CUS-06، RUI-CUS-07، RUI-CUS-08، RUI-CUS-09، RUI-CUS-10، RUI-CUS-11، RUI-CUS-12، RUI-CUS-13، RUI-CUS-14، RUI-CUS-15، RUI-SHR-01، RUI-SHR-02، RUI-SHR-03، RUI-SHR-04، RUI-SHR-05، RUI-SHR-06.
- مستخدم عبر layout: `src/app/admin/_layout.tsx`، `src/app/merchant/_layout.tsx`.
- المستهلكون المباشرون: `src/app/addresses.tsx`، `src/app/admin/_layout.tsx`، `src/app/cart.tsx`، `src/app/checkout.tsx`، `src/app/driver/account.tsx`، `src/app/driver/cash-account.tsx`، `src/app/driver/credentials.tsx`، `src/app/driver/index.tsx`، `src/app/driver/orders.tsx`، `src/app/driver/task-details.tsx`، `src/app/favorites.tsx`، `src/app/financial-invoice.tsx`، `src/app/home/account.tsx`، `src/app/home/index.tsx`، `src/app/home/offers.tsx`، `src/app/home/search.tsx`، `src/app/merchant/_layout.tsx`، `src/app/notifications.tsx`، `src/app/offer-details.tsx`، `src/app/order-details.tsx`، `src/app/orders.tsx`، `src/app/product-details.tsx`، `src/app/store-details.tsx`، `src/app/stores.tsx`، `src/components/account/PersonalInfoScreen.tsx`، `src/components/account/SecurityScreen.tsx`، `src/components/account/SettingsScreen.tsx`، `src/components/finance/FinanceScreen.tsx`، `src/components/finance/InvoiceScreen.tsx`، `src/components/finance/MerchantInvoiceScreen.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## PushBridge

- الملف: `src/components/notifications/PushBridge.tsx`. الوظيفة: ربط تفاعل Push بدورة الجلسة والتنقل؛ مضيف غير مرئي وليس بطاقة.
- صفحات محتملة بالوصول الساكن: —.
- مستخدم عبر layout: `src/app/_layout.tsx`.
- المستهلكون المباشرون: `src/app/_layout.tsx`.
- الثيمان: لا استدعاء ثيم مباشر؛ افحص الألوان الممررة/المكون الأب، لا يثبت غياب الدعم. RTL: لا دليل مباشر في الملف؛ افحص الوراثة والأيقونات.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## MerchantOrderCard

- الملف: `src/components/orders/MerchantOrderCard.tsx`. الوظيفة: ملخص طلب متجر محايد مدمج مع توسعة صفوف المنتجات والإجراءات؛ لا بيانات طلبات الإدارة.
- صفحات محتملة بالوصول الساكن: RUI-MER-02.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/merchant/orders.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## MerchantOrdersToolbar

- الملف: `src/components/orders/MerchantOrdersToolbar.tsx`. الوظيفة: بحث ومسح ومؤشر اتصال مختصر وفلاتر أفقية دون أعداد ظاهرة؛ العدادات الخادمية وصولية.
- صفحات محتملة بالوصول الساكن: RUI-MER-02.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/merchant/orders.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## CustomerOrderTimeline

- الملف: `src/components/orders/OrderTracking.tsx`. الوظيفة: تسلسل حالات طلب العميل.
- صفحات محتملة بالوصول الساكن: RUI-CUS-11.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/order-details.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## DeliveryTracking

- الملف: `src/components/orders/OrderTracking.tsx`. الوظيفة: عرض حالة توصيل الطلب.
- صفحات محتملة بالوصول الساكن: RUI-CUS-11.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/order-details.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## StoreStatusHistory

- الملف: `src/components/orders/OrderTracking.tsx`. الوظيفة: تاريخ حالات جزء المتجر.
- صفحات محتملة بالوصول الساكن: RUI-CUS-11.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/order-details.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## ProductRefinements

- الملف: `src/components/search/ProductRefinements.tsx`. الوظيفة: خيارات تنقيح نتائج المنتجات.
- صفحات محتملة بالوصول الساكن: RUI-CUS-02.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/home/search.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: لا دليل مباشر في الملف؛ افحص الوراثة والأيقونات.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## SearchControls

- الملف: `src/components/search/SearchControls.tsx`. الوظيفة: حقل البحث وتحكماته.
- صفحات محتملة بالوصول الساكن: RUI-CUS-02.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/home/search.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## SearchEmptyState

- الملف: `src/components/search/SearchEmptyState.tsx`. الوظيفة: فراغ نتائج البحث.
- صفحات محتملة بالوصول الساكن: RUI-CUS-02.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/home/search.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: لا دليل مباشر في الملف؛ افحص الوراثة والأيقونات.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## SearchResults

- الملف: `src/components/search/SearchResults.tsx`. الوظيفة: عرض نتائج البحث.
- صفحات محتملة بالوصول الساكن: RUI-CUS-02.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/home/search.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: لا دليل مباشر في الملف؛ افحص الوراثة والأيقونات.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## BirthDateField

- الملف: `src/components/signup/BirthDateField.tsx`. الوظيفة: إدخال تاريخ الميلاد والتحقق منه.
- صفحات محتملة بالوصول الساكن: RUI-AUTH-03، RUI-AUTH-06، RUI-AUTH-07.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/components/signup/ProfessionalApplicationScreen.tsx`، `src/components/signup/SignupCredentialsStep.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## MerchantPlanChoice

- الملف: `src/components/signup/MerchantPlanChoice.tsx`. الوظيفة: اختيار التاجر خطة اشتراكه.
- صفحات محتملة بالوصول الساكن: RUI-AUTH-03، RUI-AUTH-06، RUI-AUTH-07.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/components/signup/ProfessionalApplicationFields.tsx`، `src/components/signup/SignupReviewStep.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## ProfessionalApplicationFields

- الملف: `src/components/signup/ProfessionalApplicationFields.tsx`. الوظيفة: البيانات المهنية اللازمة للتاجر/السائق.
- صفحات محتملة بالوصول الساكن: RUI-AUTH-03، RUI-AUTH-06، RUI-AUTH-07.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/signup.tsx`، `src/components/signup/ProfessionalApplicationScreen.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## ProfessionalApplicationScreen

- الملف: `src/components/signup/ProfessionalApplicationScreen.tsx`. الوظيفة: تدفق طلب انضمام مهني كامل.
- صفحات محتملة بالوصول الساكن: RUI-AUTH-06، RUI-AUTH-07.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/driver-application.tsx`، `src/app/merchant-application.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## SignupCredentialsStep

- الملف: `src/components/signup/SignupCredentialsStep.tsx`. الوظيفة: بيانات الدخول اللازمة للتسجيل.
- صفحات محتملة بالوصول الساكن: RUI-AUTH-03.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/signup.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## SignupErrorNotice

- الملف: `src/components/signup/SignupErrorNotice.tsx`. الوظيفة: خطأ التسجيل في موضعه.
- صفحات محتملة بالوصول الساكن: RUI-AUTH-03.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/signup.tsx`، `src/components/signup/SignupCredentialsStep.tsx`، `src/components/signup/SignupReviewStep.tsx`، `src/components/signup/SignupRoleStep.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## SignupProgress

- الملف: `src/components/signup/SignupProgress.tsx`. الوظيفة: تقدم خطوات التسجيل.
- صفحات محتملة بالوصول الساكن: RUI-AUTH-03.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/signup.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error غير ظاهر؛ افحص الأب/props؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## SignupReviewStep

- الملف: `src/components/signup/SignupReviewStep.tsx`. الوظيفة: مراجعة البيانات قبل إرسال التسجيل.
- صفحات محتملة بالوصول الساكن: RUI-AUTH-03.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/signup.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## SignupRoleStep

- الملف: `src/components/signup/SignupRoleStep.tsx`. الوظيفة: اختيار الدور قبل فورم البيانات.
- صفحات محتملة بالوصول الساكن: RUI-AUTH-03.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/signup.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## AppBadge

- الملف: `src/components/ui/AppBadge.tsx`. الوظيفة: شارة حالة نصية مع أيقونة اختيارية.
- صفحات محتملة بالوصول الساكن: RUI-CUS-01، RUI-CUS-02، RUI-CUS-04، RUI-CUS-05.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/components/marketplace/ProductCard.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: أساس مشترك قائم قابل للإبقاء؛ تحقق سلوكي بصري في الصفحة الحالية، لا مبرر لاستبداله الشامل من المصدر وحده. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## AppButton

- الملف: `src/components/ui/AppButton.tsx`. الوظيفة: زر مشترك مع نوع وحالة تحميل وتعطيل.
- صفحات محتملة بالوصول الساكن: RUI-MER-01، RUI-MER-02، RUI-MER-03، RUI-MER-04، RUI-MER-06، RUI-MER-08، RUI-MER-09، RUI-MER-10، RUI-MER-11، RUI-MER-13، RUI-DRV-01، RUI-DRV-02، RUI-DRV-02.01، RUI-DRV-04، RUI-DRV-04.01، RUI-ADM-01، RUI-ADM-02، RUI-ADM-03، RUI-ADM-04، RUI-ADM-05، RUI-ADM-06، RUI-ADM-07، RUI-ADM-08، RUI-ADM-09، RUI-ADM-10، RUI-ADM-11، RUI-ADM-12، RUI-ADM-13، RUI-ADM-14، RUI-ADM-15، RUI-CUS-01، RUI-CUS-02، RUI-CUS-03، RUI-CUS-04، RUI-CUS-05، RUI-CUS-06، RUI-CUS-07، RUI-CUS-08، RUI-CUS-09، RUI-CUS-10، RUI-CUS-11، RUI-CUS-12، RUI-CUS-13، RUI-CUS-14، RUI-CUS-15، RUI-SHR-01، RUI-SHR-02، RUI-SHR-03، RUI-SHR-05، RUI-SHR-06، RUI-AUTH-01، RUI-AUTH-02، RUI-AUTH-03، RUI-AUTH-04، RUI-AUTH-05، RUI-AUTH-06، RUI-AUTH-07، RUI-AUTH-08.
- مستخدم عبر layout: `src/app/admin/_layout.tsx`، `src/app/driver/_layout.tsx`، `src/app/merchant/_layout.tsx`.
- المستهلكون المباشرون: `src/app/addresses.tsx`، `src/app/admin/application-details.tsx`، `src/app/admin/applications.tsx`، `src/app/admin/driver-details.tsx`، `src/app/admin/drivers.tsx`، `src/app/admin/home-ads.tsx`، `src/app/admin/index.tsx`، `src/app/admin/order-details.tsx`، `src/app/admin/orders.tsx`، `src/app/admin/plan-form.tsx`، `src/app/admin/plans.tsx`، `src/app/admin/store-details.tsx`، `src/app/admin/stores.tsx`، `src/app/application-status.tsx`، `src/app/cart.tsx`، `src/app/checkout.tsx`، `src/app/driver/account.tsx`، `src/app/driver/index.tsx`، `src/app/driver/orders.tsx`، `src/app/driver/task-details.tsx`، `src/app/financial-invoice.tsx`، `src/app/index.tsx`، `src/app/merchant/index.tsx`، `src/app/merchant/orders.tsx`، `src/app/notifications.tsx`، `src/app/offer-details.tsx`، `src/app/order-details.tsx`، `src/app/orders.tsx`، `src/app/product-details.tsx`، `src/app/reset-password.tsx`، `src/app/signup.tsx`، `src/app/verify-email.tsx`، `src/components/account/DriverProfessionalInfo.tsx`، `src/components/account/PersonalInfoScreen.tsx`، `src/components/account/SecurityScreen.tsx`، `src/components/account/SharedAccountParts.tsx`، `src/components/admin/AdminCategoriesScreen.tsx`، `src/components/admin/C3DeliverySettings.tsx`، `src/components/admin/HomeAdTargetPicker.tsx`، `src/components/application-status/ApplicationStatusEmptyState.tsx`، `src/components/auth/RoleRouteGuard.tsx`، `src/components/driver/DeliveryTaskCard.tsx`، `src/components/driver/DriverTaskLocation.tsx`، `src/components/driver/StorePickupPanel.tsx`، `src/components/finance/FinanceScreen.tsx`، `src/components/finance/InvoiceScreen.tsx`، `src/components/finance/MerchantInvoiceScreen.tsx`، `src/components/finance/PendingMoneyCard.tsx`، `src/components/login/LoginForm.tsx`، `src/components/marketplace/CustomerCatalogStatus.tsx`، `src/components/merchant/MerchantAccountScreens.tsx`، `src/components/merchant/MerchantAddProduct.tsx`، `src/components/merchant/MerchantCatalogPanel.tsx`، `src/components/merchant/MerchantEditProduct.tsx`، `src/components/merchant/MerchantFinancialCards.tsx`، `src/components/merchant/MerchantOfferEditor.tsx`، `src/components/merchant/MerchantOfferForm.tsx`، `src/components/merchant/MerchantProductForm.tsx`، `src/components/merchant/MerchantStoreBranding.tsx`، `src/components/merchant/MerchantStoreInfo.tsx`، `src/components/merchant/OfferExpirationPicker.tsx`، `src/components/orders/MerchantOrderCard.tsx`، `src/components/signup/MerchantPlanChoice.tsx`، `src/components/signup/ProfessionalApplicationFields.tsx`، `src/components/signup/ProfessionalApplicationScreen.tsx`، `src/components/signup/SignupCredentialsStep.tsx`، `src/components/signup/SignupReviewStep.tsx`، `src/components/signup/SignupRoleStep.tsx`، `src/components/ui/AppEmptyState.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: أساس مشترك قائم قابل للإبقاء؛ تحقق سلوكي بصري في الصفحة الحالية، لا مبرر لاستبداله الشامل من المصدر وحده. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## AppEmptyState

- الملف: `src/components/ui/AppEmptyState.tsx`. الوظيفة: حالة عدم وجود بيانات وإجراء مناسب.
- صفحات محتملة بالوصول الساكن: RUI-CUS-01، RUI-CUS-02، RUI-CUS-03، RUI-CUS-06.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/home/index.tsx`، `src/app/home/offers.tsx`، `src/app/stores.tsx`، `src/components/search/SearchEmptyState.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## AppIcon

- الملف: `src/components/ui/AppIcon.tsx`. الوظيفة: رمز مرئي موحد.
- صفحات محتملة بالوصول الساكن: RUI-MER-01، RUI-MER-02، RUI-MER-03، RUI-MER-04، RUI-MER-06، RUI-MER-08، RUI-MER-09، RUI-MER-10، RUI-MER-11، RUI-MER-12، RUI-MER-13، RUI-DRV-01، RUI-DRV-02، RUI-DRV-02.01، RUI-DRV-03، RUI-DRV-04، RUI-DRV-04.01، RUI-DRV-04.02، RUI-ADM-01، RUI-ADM-02، RUI-ADM-03، RUI-ADM-04، RUI-ADM-05، RUI-ADM-06، RUI-ADM-07، RUI-ADM-08، RUI-ADM-09، RUI-ADM-10، RUI-ADM-11، RUI-ADM-12، RUI-ADM-13، RUI-ADM-14، RUI-ADM-15، RUI-CUS-01، RUI-CUS-02، RUI-CUS-03، RUI-CUS-04، RUI-CUS-05، RUI-CUS-06، RUI-CUS-07، RUI-CUS-08، RUI-CUS-09، RUI-CUS-10، RUI-CUS-11، RUI-CUS-12، RUI-CUS-13، RUI-CUS-14، RUI-CUS-15، RUI-SHR-01، RUI-SHR-02، RUI-SHR-03، RUI-SHR-04، RUI-SHR-05، RUI-SHR-06، RUI-AUTH-01، RUI-AUTH-02، RUI-AUTH-03، RUI-AUTH-04، RUI-AUTH-05، RUI-AUTH-06، RUI-AUTH-07، RUI-AUTH-08، RUI-LEGAL-01، RUI-LEGAL-02، RUI-LEGAL-03.
- مستخدم عبر layout: `src/app/_layout.tsx`، `src/app/admin/_layout.tsx`، `src/app/driver/_layout.tsx`، `src/app/merchant/_layout.tsx`.
- المستهلكون المباشرون: `src/app/about.tsx`، `src/app/addresses.tsx`، `src/app/admin/applications.tsx`، `src/app/admin/drivers.tsx`، `src/app/admin/orders.tsx`، `src/app/admin/plan-form.tsx`، `src/app/admin/plans.tsx`، `src/app/admin/stores.tsx`، `src/app/application-status.tsx`، `src/app/cart.tsx`، `src/app/checkout.tsx`، `src/app/driver/index.tsx`، `src/app/driver/orders.tsx`، `src/app/favorites.tsx`، `src/app/home/index.tsx`، `src/app/home/offers.tsx`، `src/app/home/search.tsx`، `src/app/merchant/catalog.tsx`، `src/app/merchant/index.tsx`، `src/app/merchant/orders.tsx`، `src/app/notifications.tsx`، `src/app/offer-details.tsx`، `src/app/order-details.tsx`، `src/app/orders.tsx`، `src/app/product-details.tsx`، `src/app/store-details.tsx`، `src/app/stores.tsx`، `src/components/about/AboutContent.tsx`، `src/components/about/AboutFeatureList.tsx`، `src/components/account/AccountMenuItem.tsx`، `src/components/account/AccountProfileHeader.tsx`، `src/components/account/AccountSection.tsx`، `src/components/account/SecurityScreen.tsx`، `src/components/account/SettingsScreen.tsx`، `src/components/admin/AdminCategoriesScreen.tsx`، `src/components/application-status/ApplicationStatusEmptyState.tsx`، `src/components/driver/DeliveryTaskCard.tsx`، `src/components/driver/DriverTaskLocation.tsx`، `src/components/finance/MerchantFinanceView.tsx`، `src/components/legal/LegalPageLayout.tsx`، `src/components/login/LoginForm.tsx`، `src/components/marketplace/CategoryChip.tsx`، `src/components/marketplace/OfferCard.tsx`، `src/components/marketplace/ProductMediaGallery.tsx`، `src/components/marketplace/ProductMediaPreview.tsx`، `src/components/marketplace/RatingStars.tsx`، `src/components/marketplace/ShoppingCardImage.tsx`، `src/components/marketplace/StoreCard.tsx`، `src/components/marketplace/StoreDetailsHero.tsx`، `src/components/merchant/MerchantAccountScreens.tsx`، `src/components/merchant/MerchantCatalogPanel.tsx`، `src/components/merchant/MerchantCategorySelect.tsx`، `src/components/merchant/MerchantProductForm.tsx`، `src/components/merchant/MerchantStoreBranding.tsx`، `src/components/navigation/AppBottomNav.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/orders/MerchantOrderCard.tsx`، `src/components/orders/MerchantOrdersToolbar.tsx`، `src/components/orders/OrderTracking.tsx`، `src/components/search/ProductRefinements.tsx`، `src/components/search/SearchControls.tsx`، `src/components/search/SearchEmptyState.tsx`، `src/components/search/SearchResults.tsx`، `src/components/signup/SignupProgress.tsx`، `src/components/signup/SignupReviewStep.tsx`، `src/components/signup/SignupRoleStep.tsx`، `src/components/ui/AppBadge.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppEmptyState.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppSearchBar.tsx`، `src/components/ui/AppSectionHeader.tsx`، `src/components/ui/AppTextField.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: لا دليل مباشر في الملف؛ افحص الوراثة والأيقونات.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## AppAlertModal

- الملف: `src/components/ui/AppModal.tsx`. الوظيفة: رسالة حوارية بالهوية المشتركة.
- صفحات محتملة بالوصول الساكن: RUI-MER-01، RUI-MER-02، RUI-MER-03، RUI-MER-04، RUI-MER-06، RUI-MER-08، RUI-MER-09، RUI-MER-10، RUI-MER-11، RUI-MER-13، RUI-DRV-02.01، RUI-DRV-04، RUI-ADM-05، RUI-ADM-06، RUI-ADM-12، RUI-ADM-13، RUI-ADM-14، RUI-ADM-15، RUI-CUS-08، RUI-CUS-09، RUI-CUS-11، RUI-CUS-12، RUI-CUS-13، RUI-CUS-15، RUI-SHR-01، RUI-SHR-02، RUI-SHR-03، RUI-SHR-05، RUI-SHR-06، RUI-AUTH-02، RUI-AUTH-03، RUI-AUTH-04، RUI-AUTH-05، RUI-AUTH-06، RUI-AUTH-07.
- مستخدم عبر layout: `src/app/_layout.tsx`.
- المستهلكون المباشرون: `src/app/admin/application-details.tsx`، `src/app/cart.tsx`، `src/app/checkout.tsx`، `src/app/driver/task-details.tsx`، `src/app/merchant/orders.tsx`، `src/app/notifications.tsx`، `src/app/order-details.tsx`، `src/app/verify-email.tsx`، `src/components/account/SharedAccountParts.tsx`، `src/components/admin/AdminCategoriesScreen.tsx`، `src/components/login/ForgotPasswordSection.tsx`، `src/components/merchant/MerchantAddProduct.tsx`، `src/components/merchant/MerchantCatalogPanel.tsx`، `src/components/merchant/MerchantEditProduct.tsx`، `src/components/merchant/MerchantOfferEditor.tsx`، `src/components/merchant/MerchantStoreBranding.tsx`، `src/components/merchant/OfferExpirationPicker.tsx`، `src/context/AppDialogContext.tsx`، `src/hooks/useAccountDraftGuard.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## AppConfirmModal

- الملف: `src/components/ui/AppModal.tsx`. الوظيفة: حوار قرار وتأكيد.
- صفحات محتملة بالوصول الساكن: RUI-MER-01، RUI-MER-02، RUI-MER-03، RUI-MER-04، RUI-MER-06، RUI-MER-08، RUI-MER-09، RUI-MER-10، RUI-MER-11، RUI-MER-13، RUI-DRV-02.01، RUI-DRV-04، RUI-ADM-05، RUI-ADM-06، RUI-ADM-12، RUI-ADM-13، RUI-ADM-14، RUI-ADM-15، RUI-CUS-08، RUI-CUS-09، RUI-CUS-11، RUI-CUS-12، RUI-CUS-13، RUI-CUS-15، RUI-SHR-01، RUI-SHR-02، RUI-SHR-03، RUI-SHR-05، RUI-SHR-06، RUI-AUTH-02، RUI-AUTH-03، RUI-AUTH-04، RUI-AUTH-05، RUI-AUTH-06، RUI-AUTH-07.
- مستخدم عبر layout: `src/app/_layout.tsx`.
- المستهلكون المباشرون: `src/app/admin/application-details.tsx`، `src/app/cart.tsx`، `src/app/checkout.tsx`، `src/app/driver/task-details.tsx`، `src/app/merchant/orders.tsx`، `src/app/notifications.tsx`، `src/app/order-details.tsx`، `src/app/verify-email.tsx`، `src/components/account/SharedAccountParts.tsx`، `src/components/admin/AdminCategoriesScreen.tsx`، `src/components/login/ForgotPasswordSection.tsx`، `src/components/merchant/MerchantAddProduct.tsx`، `src/components/merchant/MerchantCatalogPanel.tsx`، `src/components/merchant/MerchantEditProduct.tsx`، `src/components/merchant/MerchantOfferEditor.tsx`، `src/components/merchant/MerchantStoreBranding.tsx`، `src/components/merchant/OfferExpirationPicker.tsx`، `src/context/AppDialogContext.tsx`، `src/hooks/useAccountDraftGuard.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## AppModal

- الملف: `src/components/ui/AppModal.tsx`. الوظيفة: غلاف حوار ذي سطح وحاجز وإغلاق.
- صفحات محتملة بالوصول الساكن: RUI-MER-01، RUI-MER-02، RUI-MER-03، RUI-MER-04، RUI-MER-06، RUI-MER-08، RUI-MER-09، RUI-MER-10، RUI-MER-11، RUI-MER-13، RUI-DRV-02.01، RUI-DRV-04، RUI-ADM-05، RUI-ADM-06، RUI-ADM-12، RUI-ADM-13، RUI-ADM-14، RUI-ADM-15، RUI-CUS-08، RUI-CUS-09، RUI-CUS-11، RUI-CUS-12، RUI-CUS-13، RUI-CUS-15، RUI-SHR-01، RUI-SHR-02، RUI-SHR-03، RUI-SHR-05، RUI-SHR-06، RUI-AUTH-02، RUI-AUTH-03، RUI-AUTH-04، RUI-AUTH-05، RUI-AUTH-06، RUI-AUTH-07.
- مستخدم عبر layout: `src/app/_layout.tsx`.
- المستهلكون المباشرون: `src/app/admin/application-details.tsx`، `src/app/cart.tsx`، `src/app/checkout.tsx`، `src/app/driver/task-details.tsx`، `src/app/merchant/orders.tsx`، `src/app/notifications.tsx`، `src/app/order-details.tsx`، `src/app/verify-email.tsx`، `src/components/account/SharedAccountParts.tsx`، `src/components/admin/AdminCategoriesScreen.tsx`، `src/components/login/ForgotPasswordSection.tsx`، `src/components/merchant/MerchantAddProduct.tsx`، `src/components/merchant/MerchantCatalogPanel.tsx`، `src/components/merchant/MerchantEditProduct.tsx`، `src/components/merchant/MerchantOfferEditor.tsx`، `src/components/merchant/MerchantStoreBranding.tsx`، `src/components/merchant/OfferExpirationPicker.tsx`، `src/context/AppDialogContext.tsx`، `src/hooks/useAccountDraftGuard.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## AppSearchBar

- الملف: `src/components/ui/AppSearchBar.tsx`. الوظيفة: حقل بحث مشترك.
- صفحات محتملة بالوصول الساكن: —.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: —.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## AppSectionHeader

- الملف: `src/components/ui/AppSectionHeader.tsx`. الوظيفة: عنوان قسم وإجراء اختياري.
- صفحات محتملة بالوصول الساكن: RUI-CUS-01.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/home/index.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## AppTextField

- الملف: `src/components/ui/AppTextField.tsx`. الوظيفة: حقل بعنوان وخطأ ومساعدة وتركيز وتعطيل.
- صفحات محتملة بالوصول الساكن: RUI-MER-02، RUI-MER-03، RUI-MER-04، RUI-MER-06، RUI-MER-08، RUI-MER-09، RUI-MER-10، RUI-MER-11، RUI-MER-13، RUI-DRV-02، RUI-DRV-03، RUI-ADM-05، RUI-ADM-06، RUI-ADM-12، RUI-ADM-13، RUI-ADM-14، RUI-ADM-15، RUI-CUS-09، RUI-CUS-12، RUI-CUS-14، RUI-SHR-02، RUI-SHR-03، RUI-SHR-05، RUI-SHR-06، RUI-AUTH-02، RUI-AUTH-03، RUI-AUTH-05، RUI-AUTH-06، RUI-AUTH-07.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/addresses.tsx`، `src/app/admin/application-details.tsx`، `src/app/admin/home-ads.tsx`، `src/app/admin/plan-form.tsx`، `src/app/checkout.tsx`، `src/app/driver/orders.tsx`، `src/app/merchant/orders.tsx`، `src/app/reset-password.tsx`، `src/components/account/PersonalInfoScreen.tsx`، `src/components/account/SecurityScreen.tsx`، `src/components/admin/AdminCategoriesScreen.tsx`، `src/components/admin/C3DeliverySettings.tsx`، `src/components/admin/HomeAdTargetPicker.tsx`، `src/components/finance/FinanceScreen.tsx`، `src/components/finance/InvoiceScreen.tsx`، `src/components/finance/MerchantFinanceView.tsx`، `src/components/login/ForgotPasswordSection.tsx`، `src/components/login/LoginForm.tsx`، `src/components/merchant/MerchantCatalogPanel.tsx`، `src/components/merchant/MerchantCategorySelect.tsx`، `src/components/merchant/MerchantOfferForm.tsx`، `src/components/merchant/MerchantProductForm.tsx`، `src/components/merchant/MerchantStoreInfo.tsx`، `src/components/signup/BirthDateField.tsx`، `src/components/signup/ProfessionalApplicationFields.tsx`، `src/components/signup/SignupCredentialsStep.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled موجود.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: أساس مشترك قائم قابل للإبقاء؛ تحقق سلوكي بصري في الصفحة الحالية، لا مبرر لاستبداله الشامل من المصدر وحده. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## DocumentReference

- الملف: `src/components/ui/DocumentReference.tsx`. الوظيفة: نص مرجع باتجاه LTR قابل للتحديد مع تحقق صيغته؛ لا زر نسخ مستقل.
- صفحات محتملة بالوصول الساكن: RUI-MER-02، RUI-MER-03، RUI-DRV-03، RUI-ADM-06، RUI-CUS-12، RUI-SHR-02، RUI-SHR-03.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/components/finance/FinancialAccountSummary.tsx`، `src/components/finance/FinancialParts.tsx`، `src/components/finance/InvoiceScreen.tsx`، `src/components/finance/MerchantFinanceView.tsx`، `src/components/finance/MerchantInvoiceScreen.tsx`، `src/components/finance/PendingMoneyCard.tsx`، `src/components/orders/MerchantOrderCard.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## FinancialAmount

- الملف: `src/components/ui/FinancialAmount.tsx`. الوظيفة: عرض مبلغ باستخدام التنسيق المالي القائم؛ المصدر يحدد عقد كل نسخة.
- صفحات محتملة بالوصول الساكن: RUI-MER-01، RUI-DRV-01، RUI-DRV-02، RUI-DRV-02.01.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/driver/index.tsx`، `src/app/driver/orders.tsx`، `src/app/driver/task-details.tsx`، `src/app/merchant/index.tsx`، `src/components/driver/DeliveryTaskCard.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: نسختان بالاسم نفسه في ui وFinancialParts؛ قارن العقد والتنسيق والمستهلكين قبل أي دمج، لا تخلط الحساب بالعرض. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## FinancialStatus

- الملف: `src/components/ui/FinancialStatus.tsx`. الوظيفة: حالة مالية بنص وألوان دلالية.
- صفحات محتملة بالوصول الساكن: —.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/components/ui/OperationFeedback.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: أساس مشترك قائم قابل للإبقاء؛ تحقق سلوكي بصري في الصفحة الحالية، لا مبرر لاستبداله الشامل من المصدر وحده. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## KeyboardAwareScrollView

- الملف: `src/components/ui/KeyboardAwareScrollView.tsx`. الوظيفة: تمرير النموذج وإبقاء الحقل النشط فوق لوحة المفاتيح.
- صفحات محتملة بالوصول الساكن: RUI-MER-02، RUI-MER-03، RUI-MER-04، RUI-MER-06، RUI-MER-08، RUI-MER-09، RUI-MER-10، RUI-MER-11، RUI-MER-13، RUI-DRV-02، RUI-DRV-03، RUI-ADM-05، RUI-ADM-06، RUI-ADM-12، RUI-ADM-13، RUI-ADM-14، RUI-ADM-15، RUI-CUS-09، RUI-CUS-12، RUI-CUS-14، RUI-SHR-02، RUI-SHR-03، RUI-SHR-05، RUI-SHR-06، RUI-AUTH-02، RUI-AUTH-03، RUI-AUTH-05، RUI-AUTH-06، RUI-AUTH-07.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/admin/home-ads.tsx`، `src/app/admin/plan-form.tsx`، `src/app/checkout.tsx`، `src/app/driver/orders.tsx`، `src/app/reset-password.tsx`، `src/app/signup.tsx`، `src/components/account/PersonalInfoScreen.tsx`، `src/components/account/SecurityScreen.tsx`، `src/components/finance/FinanceScreen.tsx`، `src/components/finance/InvoiceScreen.tsx`، `src/components/finance/MerchantFinanceView.tsx`، `src/components/merchant/MerchantAddProduct.tsx`، `src/components/merchant/MerchantEditProduct.tsx`، `src/components/merchant/MerchantOfferEditor.tsx`، `src/components/merchant/MerchantStoreInfo.tsx`، `src/components/signup/ProfessionalApplicationScreen.tsx`، `src/components/ui/AppTextField.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: لا دليل مباشر في الملف؛ افحص الوراثة والأيقونات.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## LiveStatus

- الملف: `src/components/ui/LiveStatus.tsx`. الوظيفة: حالة التحديث المباشر والقراءة دون toast دوري.
- صفحات محتملة بالوصول الساكن: RUI-MER-01، RUI-MER-03، RUI-ADM-01، RUI-ADM-02، RUI-ADM-03، RUI-ADM-04، RUI-ADM-05، RUI-ADM-06، RUI-CUS-10، RUI-CUS-11، RUI-CUS-12، RUI-SHR-01، RUI-SHR-02، RUI-SHR-03، RUI-AUTH-08.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/app/admin/application-details.tsx`، `src/app/admin/applications.tsx`، `src/app/admin/index.tsx`، `src/app/admin/order-details.tsx`، `src/app/admin/orders.tsx`، `src/app/application-status.tsx`، `src/app/merchant/index.tsx`، `src/app/notifications.tsx`، `src/app/order-details.tsx`، `src/app/orders.tsx`، `src/components/finance/FinanceScreen.tsx`، `src/components/finance/InvoiceScreen.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: يبقى؛ compact اختياري لرئيسية التاجر فقط، مع الحفاظ على العرض الافتراضي للمستهلكين الآخرين؛ بانتظار قبول تصميم الهاتف. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## LoadingSkeleton

- الملف: `src/components/ui/LoadingState.tsx`. الوظيفة: عناصر تحميل أول ثابتة بلا حركة مستمرة.
- صفحات محتملة بالوصول الساكن: RUI-MER-01، RUI-MER-02، RUI-MER-03، RUI-MER-04، RUI-MER-06، RUI-MER-08، RUI-MER-09، RUI-MER-10، RUI-MER-11، RUI-MER-13، RUI-DRV-01، RUI-DRV-02، RUI-DRV-02.01، RUI-DRV-03، RUI-DRV-04، RUI-DRV-04.01، RUI-ADM-01، RUI-ADM-02، RUI-ADM-03، RUI-ADM-04، RUI-ADM-05، RUI-ADM-06، RUI-ADM-07، RUI-ADM-08، RUI-ADM-09، RUI-ADM-10، RUI-ADM-11، RUI-ADM-12، RUI-ADM-13، RUI-ADM-14، RUI-ADM-15، RUI-CUS-01، RUI-CUS-02، RUI-CUS-03، RUI-CUS-04، RUI-CUS-05، RUI-CUS-06، RUI-CUS-07، RUI-CUS-08، RUI-CUS-09، RUI-CUS-10، RUI-CUS-11، RUI-CUS-12، RUI-CUS-13، RUI-CUS-14، RUI-CUS-15، RUI-SHR-01، RUI-SHR-02، RUI-SHR-03، RUI-SHR-05، RUI-SHR-06، RUI-AUTH-01، RUI-AUTH-02، RUI-AUTH-03، RUI-AUTH-04، RUI-AUTH-05، RUI-AUTH-06، RUI-AUTH-07، RUI-AUTH-08.
- مستخدم عبر layout: `src/app/admin/_layout.tsx`، `src/app/driver/_layout.tsx`، `src/app/merchant/_layout.tsx`.
- المستهلكون المباشرون: `src/app/admin/applications.tsx`، `src/app/admin/index.tsx`، `src/app/admin/order-details.tsx`، `src/app/admin/orders.tsx`، `src/app/driver/cash-account.tsx`، `src/app/driver/index.tsx`، `src/app/driver/orders.tsx`، `src/app/driver/task-details.tsx`، `src/app/merchant/orders.tsx`، `src/app/order-details.tsx`، `src/app/orders.tsx`، `src/components/finance/FinanceScreen.tsx`، `src/components/finance/InvoiceScreen.tsx`، `src/components/finance/MerchantFinanceView.tsx`، `src/components/finance/MerchantInvoiceScreen.tsx`، `src/components/merchant/MerchantCatalogPanel.tsx`، `src/components/ui/AppButton.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: أساس مشترك قائم قابل للإبقاء؛ تحقق سلوكي بصري في الصفحة الحالية، لا مبرر لاستبداله الشامل من المصدر وحده. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## RefreshStatus

- الملف: `src/components/ui/LoadingState.tsx`. الوظيفة: صف محجوز لحالة التحديث دون إزاحة المحتوى.
- صفحات محتملة بالوصول الساكن: RUI-MER-01، RUI-MER-02، RUI-MER-03، RUI-MER-04، RUI-MER-06، RUI-MER-08، RUI-MER-09، RUI-MER-10، RUI-MER-11، RUI-MER-13، RUI-DRV-01، RUI-DRV-02، RUI-DRV-02.01، RUI-DRV-03، RUI-DRV-04، RUI-DRV-04.01، RUI-ADM-01، RUI-ADM-02، RUI-ADM-03، RUI-ADM-04، RUI-ADM-05، RUI-ADM-06، RUI-ADM-07، RUI-ADM-08، RUI-ADM-09، RUI-ADM-10، RUI-ADM-11، RUI-ADM-12، RUI-ADM-13، RUI-ADM-14، RUI-ADM-15، RUI-CUS-01، RUI-CUS-02، RUI-CUS-03، RUI-CUS-04، RUI-CUS-05، RUI-CUS-06، RUI-CUS-07، RUI-CUS-08، RUI-CUS-09، RUI-CUS-10، RUI-CUS-11، RUI-CUS-12، RUI-CUS-13، RUI-CUS-14، RUI-CUS-15، RUI-SHR-01، RUI-SHR-02، RUI-SHR-03، RUI-SHR-05، RUI-SHR-06، RUI-AUTH-01، RUI-AUTH-02، RUI-AUTH-03، RUI-AUTH-04، RUI-AUTH-05، RUI-AUTH-06، RUI-AUTH-07، RUI-AUTH-08.
- مستخدم عبر layout: `src/app/admin/_layout.tsx`، `src/app/driver/_layout.tsx`، `src/app/merchant/_layout.tsx`.
- المستهلكون المباشرون: `src/app/admin/applications.tsx`، `src/app/admin/index.tsx`، `src/app/admin/order-details.tsx`، `src/app/admin/orders.tsx`، `src/app/driver/cash-account.tsx`، `src/app/driver/index.tsx`، `src/app/driver/orders.tsx`، `src/app/driver/task-details.tsx`، `src/app/merchant/orders.tsx`، `src/app/order-details.tsx`، `src/app/orders.tsx`، `src/components/finance/FinanceScreen.tsx`، `src/components/finance/InvoiceScreen.tsx`، `src/components/finance/MerchantFinanceView.tsx`، `src/components/finance/MerchantInvoiceScreen.tsx`، `src/components/merchant/MerchantCatalogPanel.tsx`، `src/components/ui/AppButton.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading موجود؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: أساس مشترك قائم قابل للإبقاء؛ تحقق سلوكي بصري في الصفحة الحالية، لا مبرر لاستبداله الشامل من المصدر وحده. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## OperationFeedback

- الملف: `src/components/ui/OperationFeedback.tsx`. الوظيفة: نتيجة عملية ضمن سياقها.
- صفحات محتملة بالوصول الساكن: —.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: —.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## SyriaFlag

- الملف: `src/components/ui/SyriaFlag.tsx`. الوظيفة: أصل بصري للمنطقة لا منطق صلاحية أو حساب.
- صفحات محتملة بالوصول الساكن: RUI-MER-12، RUI-DRV-04.02، RUI-SHR-04.
- مستخدم عبر layout: —.
- المستهلكون المباشرون: `src/components/account/SettingsScreen.tsx`.
- الثيمان: لا استدعاء ثيم مباشر؛ افحص الألوان الممررة/المكون الأب، لا يثبت غياب الدعم. RTL: لا دليل مباشر في الملف؛ افحص الوراثة والأيقونات.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error غير ظاهر؛ افحص الأب/props؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: #000000، #007a3d، #ce1126، #ffffff.
- إعادة الاستخدام والتحسين: مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## ToastProvider

- الملف: `src/context/ToastContext.tsx`. الوظيفة: مضيف الرسائل العابرة المنضبطة بالدور/الجلسة/المسار.
- صفحات محتملة بالوصول الساكن: RUI-DRV-01، RUI-ADM-14، RUI-SHR-02.
- مستخدم عبر layout: `src/app/_layout.tsx`.
- المستهلكون المباشرون: `src/app/_layout.tsx`، `src/app/driver/index.tsx`، `src/components/admin/AdminCategoriesScreen.tsx`، `src/components/finance/MerchantInvoiceScreen.tsx`.
- الثيمان: يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج. RTL: دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: أساس مشترك قائم قابل للإبقاء؛ تحقق سلوكي بصري في الصفحة الحالية، لا مبرر لاستبداله الشامل من المصدر وحده. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## AppDialogProvider

- الملف: `src/context/AppDialogContext.tsx`. الوظيفة: مضيف وطابور الحوارات المشتركة.
- صفحات محتملة بالوصول الساكن: RUI-MER-01، RUI-MER-02، RUI-MER-03، RUI-ADM-06، RUI-ADM-12، RUI-ADM-14، RUI-ADM-15، RUI-CUS-12، RUI-CUS-13، RUI-SHR-01، RUI-SHR-02، RUI-SHR-03، RUI-AUTH-03، RUI-AUTH-05، RUI-AUTH-06، RUI-AUTH-07.
- مستخدم عبر layout: `src/app/_layout.tsx`.
- المستهلكون المباشرون: `src/app/_layout.tsx`، `src/app/admin/home-ads.tsx`، `src/app/admin/plan-form.tsx`، `src/app/favorites.tsx`، `src/app/merchant/index.tsx`، `src/app/merchant/orders.tsx`، `src/app/notifications.tsx`، `src/app/reset-password.tsx`، `src/components/admin/AdminCategoriesScreen.tsx`، `src/components/finance/FinanceScreen.tsx`، `src/components/finance/InvoiceScreen.tsx`، `src/components/notifications/PushBridge.tsx`، `src/hooks/useOnboardingExit.ts`.
- الثيمان: لا استدعاء ثيم مباشر؛ افحص الألوان الممررة/المكون الأب، لا يثبت غياب الدعم. RTL: لا دليل مباشر في الملف؛ افحص الوراثة والأيقونات.
- مؤشرات حالات الملف: loading غير ظاهر؛ افحص الأب/props؛ error موجود؛ disabled غير ظاهر؛ افحص الأب/props.
- ألوان حرفية: لا hex حرفي؛ هذا لا يثبت التباين.
- إعادة الاستخدام والتحسين: أساس مشترك قائم قابل للإبقاء؛ تحقق سلوكي بصري في الصفحة الحالية، لا مبرر لاستبداله الشامل من المصدر وحده. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.

## ما لا يدخل في عدد المكونات

العناصر الخاصة المعرّفة داخل routes والحوارات المحلية لا تعد مكونات مشتركة مستقلة؛ افحصها ضمن الصفحة. ملفات .ts للأنواع/النماذج/الأنماط وcontexts غير المرئية/hooks خدمات اعتماديات وليست widgets؛ graph في JSON يحتفظ بارتباطاتها. المكونات المركبة قد تحوي عناصر محلية غير مصدرة؛ لا ندعي اختبار كل عنصر بمجرد جرد الوحدة.
