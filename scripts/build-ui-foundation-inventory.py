"""Read-only source inventory; writes documentation only. Run --check to verify coverage.

Import reachability is conservative and file-level, not proof of runtime rendering or
authorization. No database access or third-party Python dependencies.
"""
from pathlib import Path
import json
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[1]

# Explicit order is the stable page ID registry. Append new entries, never renumber.
GROUPS = {
    "MER": ("التاجر", "merchant/index:الرئيسية|merchant/orders:طلبات المتجر|merchant/finance:مالية التاجر|merchant/catalog:الكتالوج|merchant/products:المنتجات|merchant/product-editor:إضافة وتعديل منتج|merchant/offers:العروض|merchant/offer-editor:إضافة وتعديل عرض|merchant/store-info:بيانات المتجر|merchant/account:حساب التاجر|merchant/personal-info:بيانات التاجر الشخصية|merchant/settings:إعدادات التاجر|merchant/security:أمان حساب التاجر"),
    "DRV": ("السائق", "driver/index:الرئيسية|driver/orders:توصيلاتي|driver/task-details:تفاصيل مهمة التوصيل|driver/cash-account:مالية السائق|driver/account:حساب السائق|driver/credentials:بيانات الاعتماد|driver/settings:إعدادات السائق"),
    "ADM": ("الإدارة", "admin/index:الرئيسية|admin/orders:الطلبات|admin/order-details:تفاصيل الطلب|admin/applications:طلبات الانضمام|admin/application-details:مراجعة طلب الانضمام|admin/finance:مالية الإدارة|admin/stores:المتاجر|admin/store-details:تفاصيل المتجر|admin/drivers:السائقون|admin/driver-details:تفاصيل السائق|admin/plans:خطط الاشتراك|admin/plan-form:إضافة وتعديل خطة|admin/more:المزيد وأدوات الإدارة|admin/categories:إدارة التصنيفات|admin/home-ads:إعلانات الرئيسية"),
    "CUS": ("العميل", "home/index:الرئيسية|home/search:البحث|stores:المتاجر|store-details:تفاصيل المتجر|product-details:تفاصيل المنتج|home/offers:العروض|offer-details:تفاصيل العرض|cart:السلة|checkout:إتمام الطلب|orders:طلباتي|order-details:متابعة الطلب|invoice:فاتورة الطلب|favorites:المفضلة|addresses:العناوين|home/account:حساب العميل"),
    "SHR": ("مشتركة بحسب صلاحية الحساب", "notifications:الإشعارات|financial-invoice:تفاصيل الفاتورة المالية|wallet:مدخل الحساب المالي المشترك|settings:الإعدادات|personal-info:البيانات الشخصية|security:الأمان"),
    "AUTH": ("الدخول والتسجيل والانضمام", "index:بوابة بدء التطبيق وتوجيه الحساب|login:تسجيل الدخول|signup:إنشاء حساب|verify-email:تأكيد البريد|reset-password:استعادة كلمة المرور|merchant-application:طلب انضمام التاجر|driver-application:طلب انضمام السائق|application-status:حالة طلب الانضمام"),
    "LEGAL": ("القانونية ومعلومات التطبيق", "about:معلومات التطبيق|privacy:سياسة الخصوصية|terms:شروط الاستخدام"),
}
TABS = {"home/index", "home/search", "home/offers", "home/account", "merchant/index", "merchant/orders", "merchant/catalog", "merchant/finance", "merchant/account", "driver/index", "driver/orders", "driver/cash-account", "driver/account", "admin/index", "admin/orders", "admin/applications", "admin/finance", "admin/more"}
# Function, access, existing children / gaps, text and state review. No new route is authorized here.
NOTES = {
 "merchant/index": ("متابعة الطلبات وأهلية المتجر؛ العدادات من operational-home وخادم الأهلية، لا من الرصيد", "تبويب الرئيسية", "طلبات مفلترة في /merchant/orders؛ الاشتراك سياق SUB- داخل المالية؛ لا حاجة لصفحة إحصاءات", "الرئيسية مقبولة نهائيًا؛ تعديل الكتالوج المدمج POST-01 بعد القبول ينتظر تحققًا بصريًا سريعًا، دون إعادة فتح المقبول"),
 "merchant/orders": ("إدارة أجزاء طلبات المتجر مع بحث مقيد بالرمز/رقم طلب العميل وفلاتر خادمية وتفاصيل مضمنة وإجراءات مؤكدة", "تبويب الطلبات وعدادات الرئيسية وإشعار الجزء المحدد", "تفاصيل بطاقة واحدة فقط عبر MerchantOrderCard داخل القائمة؛ لا مسار جديد. البحث يحتاج migration مستقلة؛ لا إعادة هيكلة لتفاصيل الإدارة", "تصميم مدمج ببحث وفلاتر أفقية وبطاقة محايدة؛ أكد المالك تطبيق ترحيل البحث وقبول الهاتف والتصميم"),
 "merchant/finance": ("عرض مستحقات التاجر وفواتيره والاشتراك", "تبويب المالية وحسابي ورابط الاشتراك", "التفاصيل /financial-invoice؛ رابط SUB- يفعّل فلتر الاشتراك؛ قائمة مرقمة بعشر فواتير", "رصيد ثنائي الاتجاه وصافٍ واضح، مبلغ الاشتراك، قائمة مضغوطة بحالة المستند والسداد؛ التحقق من ملكية الرد والمحاولة المحفوظة"),
 "merchant/catalog": ("تنظيم كتالوج المنتجات والعروض", "تبويب الكتالوج", "عرض مدمج من MerchantCatalogPanel بحسب تبويب الرابط؛ إضافة وتعديل عبر المحررين الحاليين", "فراغ المنتجات والعروض والفلاتر وحالة النشر"),
 "merchant/products": ("إدارة قائمة المنتجات", "المسار المستقل تحت الكتالوج", "بطاقة المنتج للملخص ومحرر product-editor للإضافة أو التعديل حسب id", "إتاحة وإيقاف مؤكد، وفلاتر أفقية وترقيم خادمي وخطأ قابل لإعادة المحاولة"),
 "merchant/offers": ("إدارة العروض", "الكتالوج وسياق العروض المستقل", "offer-editor إضافة وتعديل بحسب id؛ انتهاء العرض حالة وليست صفحة", "تاريخ الانتهاء والخصم والمخزون دون ادعاء نجاح مبكر"),
 "driver/index": ("متابعة التوفر والمهمات المتاحة والمسندة", "تبويب الرئيسية وإشعار taskId", "مهمة حالية تفتح توصيلاتي، صفوف قبول المهام المتاحة، ومؤشرا التوريد والمستحق منفصلان", "عدم تحويل كل تحديث إلى تحميل كامل؛ FIX-DRV-01 مقبول ولا يعاد بناؤه"),
 "driver/orders": ("متابعة المهمات المسندة", "تبويب توصيلاتي؛ الرابط القديم بمعرّف المهمة يوجّه إلى التفاصيل", "بحث TSK وفلاتر الجارية والمكتملة وترقيم خادمي؛ البطاقات تفتح RUI-DRV-02.01", "مرجع المهمة، وجهة مختصرة، الحفاظ على سياق القائمة"),
 "driver/cash-account": ("متابعة النقد الواجب توريده ومستحقات الأجور والمستندات", "تبويب المالية ورابط الحساب في الرئيسية", "قالب عرض موحد مع مالية التاجر؛ بحث وفلاتر أفقية وترقيم خادمي وتفاصيل مشتركة", "رصيدان مستقلان؛ أكد المالك الترحيل واختبار الهاتف والقبول"),
 "driver/task-details": ("الاستلام والتسليم والتحصيل للمهمة المسندة", "بطاقات الرئيسية وتوصيلاتي والتنبيهات المملوكة أو الرابط المباشر بمعرّف المهمة", "صفحة فرعية مستقلة RUI-DRV-02.01؛ تأكيد التسليم يستخدم الحوار المشترك", "صلاحية المهمة، إخفاء بيانات المستلم بعد التسليم، استعادة نتيجة التحصيل"),
 "driver/account": ("بيانات الحساب والمعلومات المهنية", "تبويب حسابي", "هوية مختصرة وحالة الاعتماد؛ روابط الاعتماد والمالية والحساب والخصوصية وحول التطبيق", "ترتيب الروابط وحوار الخروج المشترك"),
 "driver/credentials": ("عرض بيانات اعتماد السائق للقراءة فقط", "حساب السائق أو رابط مباشر تحت حارس الدور", "حالة الاعتماد والاسم المهني وهاتف العمل والمركبة وأوقات التوفر", "عزل الحساب وحالة الاعتماد غير المؤكدة والرجوع"),
 "driver/settings": ("تفضيل مظهر التطبيق للسائق", "حساب السائق أو رابط مباشر تحت حارس الدور", "نفس مكوّن إعدادات التاجر بوضع المظهر فقط", "التلقائي والفاتح والداكن وحفظ التفضيل والرجوع"),
 "admin/index": ("لوحة متابعة تشغيلية للانضمام والطلبات التي تحتاج تدخلًا", "تبويب الرئيسية", "عدادات تؤدي إلى التطبيقات والطلبات بفلاترها؛ المالية ليست إجراءً حساسًا في الرئيسية", "أعداد exact من المصدر لا طول صفحة؛ UI-02 ينتظر الترحيل والقبول"),
 "admin/orders": ("متابعة طلبات العملاء والتدخل بصلاحية الإدارة", "تبويب الطلبات وملخص الرئيسية", "admin/order-details؛ admin/requests اسم توافق لنفس الصفحة", "وضوح الحالة والفلتر وسبب التدخل؛ عدم إسقاط أدوات التاجر على الإدارة"),
 "admin/order-details": ("تفاصيل الطلب ومتاجره والتوصيل والإجراءات الإدارية", "قائمة الطلبات وإشعار الطلب", "تفاصيل ضمن هذه الصفحة وروابط الفاتورة/المهمة بحسب المصدر؛ لا منح صلاحية بالرمز", "الرجوع المباشر وحالة الإلغاء/عدم الصلاحية وقفل الإجراء"),
 "admin/applications": ("قائمة طلبات التجار والسائقين", "تبويب الانضمام وعدادات الرئيسية", "admin/application-details", "نوع الطلب وحالته وطلبات تنتظر مراجعة؛ لا إجمالي من العناصر المحملة"),
 "admin/application-details": ("مراجعة بيانات الانضمام والخطة المختارة والقرار", "قائمة الانضمام وإشعار مسموح", "تفاصيل المهنة والخطة ضمن الصفحة؛ لا إعادة اختيار خطة نيابة عن التاجر", "نتيجة الموافقة وفاتورة الاشتراك لا تعني السداد"),
 "admin/finance": ("حسابات الأطراف والخزينة والفواتير والتسويات والتحقق", "تبويب المالية وروابط ثانوية", "تفاصيل /financial-invoice؛ SET/COR من سياق معلوم؛ المسارات المالية القديمة تحويلات وليست شاشات؛ الفصل المستقبلي حسب UI-03 وحاجة كل قائمة", "فصل نقد الخزينة عن المستحقات؛ الطرف/المبلغ/المرجع في غير المحسوم؛ لا WAG في تشغيل الإطلاق"),
 "admin/more": ("الوصول إلى أدوات الإدارة والحساب", "تبويب المزيد", "المتاجر والسائقون والخطط والحساب والإعدادات؛ C3DeliverySettings مدمج وليس صفحة مستقلة", "لا تكرار كل التبويبات؛ أسماء أدوات واضحة"),
 "admin/categories": ("إدارة التصنيفات المركزية للمتاجر والمنتجات", "المزيد ← إدارة التصنيفات؛ حساب الإدارة", "الشجرة والبحث ونموذج الإضافة والتعديل داخل الصفحة؛ SYS-CAT-01.04", "حالة التفعيل وأثر تعطيل الأب وأسباب تعذر الحذف"),
 "financial-invoice": ("عرض مستند مالي وسداده وروابطه وإجراءات الإدارة المسموحة", "صفوف الفواتير والإشعارات بعد تحقق ملكية", "مسار مشترك مع MerchantInvoiceScreen للتاجر وInvoiceScreen للأدوار الأخرى", "مستند مؤكد لا يعني مدفوعًا؛ فتح التفاصيل لا ينشئ عملية"),
 "wallet": ("مدخل إضافي إلى FinanceScreen الحالية", "روابط توافق/الحساب إن وجدت؛ ليست محفظة مالية قديمة", "نفس FinanceScreen؛ لا نظام مالي ثان ولا صفحة محفظة جديدة", "مراجعة ضرورة المدخل واسم المحفظة مع مستهلكيه قبل أي إزالة"),
 "invoice": ("فاتورة مرتبطة بطلب أو مدخل المالية عند غياب id/orderId", "تفاصيل طلب العميل وروابط الفاتورة", "InvoiceScreen order عند وجود المعرف؛ FinanceScreen عند غيابه؛ حالتان في مسار واحد", "منع عرض مستند غير مملوك ووضوح الرجوع"),
 "notifications": ("قراءة إشعارات الحساب وفتح المرجع المسموح", "جرس الترويسة والحساب وتفاعل Push", "تنقل آمن إلى الطلب/المهمة/الفاتورة؛ لا صفحة إعدادات Push جديدة لازمة", "غير المقروء إجمالي مستقل؛ لا بيانات حساسة في Push؛ UX-05 ما زال ينتظر الإعداد والأجهزة"),
 "index": ("تحديد الجلسة والدور وتوجيهه مع حالة بدء وخطأ", "تشغيل التطبيق والمسار /", "توجيه فعلي مع واجهة انتظار/إعادة محاولة؛ ليس Redirect صرفًا", "فشل الجلسة وإعادة المحاولة بلا تسريب حساب سابق"),
 "signup": ("اختيار الدور ثم البيانات اللازمة والانضمام المهني", "الدخول وإنشاء حساب", "خطوات داخل الصفحة؛ تاريخ الميلاد للجميع وخطة يختارها التاجر؛ لا تعد كل خطوة صفحة", "التحقق من الحقول والخصوصية وتأكيد البريد؛ لوحة المفاتيح"),
 "application-status": ("متابعة قرار الانضمام", "توجيه الجلسة/إكمال الطلب", "merchant-application أو driver-application لاستكمال البيانات؛ review القديم تحويل", "قيد المراجعة/رفض مع السبب المتاح؛ تحديث آمن عند العودة"),
 "checkout": ("مراجعة العنوان والسلة وتأكيد إنشاء الطلب", "السلة", "اختيار العنوان ضمن التدفق؛ متابعة الطلب في order-details", "السعر قبل التأكيد مقابل لقطة السعر المثبتة بعده؛ منع إرسال مزدوج"),
 "cart": ("مراجعة عناصر المتاجر والعروض والكميات", "زر السلة من السوق", "checkout وproduct-details/offer-details", "تغير السعر/توفر المتجر ورسوم الطلب واضحة؛ لا حذف بيانات عند تحديث خلفي"),
 "order-details": ("متابعة طلب العميل ومتاجره والتسليم", "طلباتي والإشعار", "فاتورة invoice؛ تتبع ضمن OrderTracking لا صفحة خرائط مفترضة", "الطلب ORD مقابل أجزاء المتاجر؛ التحديث وحالة الإلغاء"),
 "home/account": ("حساب العميل وروابط الخدمات المشتركة", "تبويب حسابي", "settings/personal-info/security والطلبات والعناوين والقانونية؛ لا /account مشترك فعلي", "أسماء الوجهات وبيانات الدور والعودة"),
}
NOTES.update({
 "admin/home-ads": ("إدارة إعلانات الرئيسية ضمن SYS-ADS-01", "المزيد ← إعلانات الرئيسية؛ حساب الإدارة", "الرفع والمعاينة والتحرير داخل الصفحة؛ يتطلب ترحيل الإعلانات", "نفذ الأساس البرمجي؛ التطبيق على Supabase واختبار الهاتف معلقان"),
 "merchant/product-editor": ("إنشاء منتج أو تعديل منتج يملكه المتجر بحسب id", "المنتجات والكتالوج", "MerchantAddProduct/MerchantEditProduct وMerchantProductForm؛ اختيار فئة ووحدة ووسائط داخل النموذج", "فصل الحفظ الجاري عن تحميل المنتج؛ حقول السعر والوحدة والصور ولوحة المفاتيح"),
 "merchant/offer-editor": ("إنشاء أو تعديل عرض المتجر بحسب id", "العروض والكتالوج", "MerchantOfferEditor/Form وOfferExpirationPicker؛ ليست صفحة إنشاء وأخرى تعديل", "انتهاء العرض ونطاقه والتحقق من السعر؛ لا نجاح قبل تأكيد الحفظ"),
 "merchant/store-info": ("تحرير معلومات وهوية المتجر", "حساب التاجر", "MerchantStoreBranding ضمن بيانات المتجر", "عرض الخطأ لكل حقل/وسائط والحفاظ على المدخلات؛ حالة الحفظ"),
 "merchant/account": ("روابط حساب التاجر وبياناته المهنية", "تبويب حسابي", "بيانات المتجر والمعلومات الشخصية والإعدادات والخصوصية والأمان وحول التطبيق؛ الاشتراك إلى finance مع SUB-", "مطابقة عنوان الاشتراك للوجهة دون صفحة اشتراك وهمية"),
 "merchant/personal-info": ("عرض وتحرير البيانات الشخصية اللازمة", "حساب التاجر", "MerchantAccountScreens يستخدم الهيكل المشترك؛ لا صفحة إضافية لكل حقل", "تاريخ الميلاد والحقول القابلة للتحرير والتحقق؛ لا جمع معلومات إضافية"),
 "merchant/settings": ("إعدادات حساب التاجر والعرض", "حساب التاجر", "SettingsScreen بنمط المظهر فقط؛ الخصوصية وحول التطبيق ضمن حساب التاجر", "الثيم والتفضيلات الفعلية فقط؛ لا إضافة خيارات غير مستخدمة"),
 "merchant/security": ("إدارة كلمة المرور والأمان المتاح", "حساب التاجر", "SecurityScreen؛ النموذج داخل الصفحة", "تأكيد الحفظ والتحقق من كلمة المرور؛ لا ادعاء وسائل أمان غير منفذة"),
 "admin/stores": ("قائمة المتاجر الإدارية وحالاتها", "المزيد", "admin/store-details", "البحث والحالة والفراغ؛ تمييز الموافقة عن أهلية استقبال الطلبات"),
 "admin/store-details": ("مراجعة متجر وأدوات الإدارة المسموحة", "قائمة المتاجر", "بيانات المتجر والإجراءات في الصفحة؛ المالية الحديثة في admin/finance", "مرجع المتجر وحالته ونتيجة الإجراء؛ لا استنتاج الأهلية من رصيد"),
 "admin/drivers": ("قائمة السائقين وإدارتهم", "المزيد", "admin/driver-details", "التوفر والحالة والبحث ورفض الصلاحية"),
 "admin/driver-details": ("مراجعة معلومات السائق المهنية وإدارته", "قائمة السائقين", "تفاصيل مهنية وأدوات داخل الصفحة؛ الحساب المالي في المالية", "توضيح التوفر مقابل حالة الانضمام؛ لا كشف بيانات سائق لحساب آخر"),
 "admin/plans": ("إدارة خطط اشتراك التجار", "أدوات الإدارة/المالية حسب الروابط الحالية", "admin/plan-form بحسب id", "الخطة والتكلفة ودورية الاشتراك وحالتها؛ لا تغيير شروط تجارية لأجل التصميم"),
 "admin/plan-form": ("إنشاء وتعديل خطة اشتراك", "قائمة الخطط", "وضعا إنشاء وتعديل داخل المسار نفسه", "وحدات السعر والتحقق وملخص قبل الحفظ؛ المالك يحسم أي تغيير تجاري"),
 "home/index": ("بدء التسوق وعرض المحتوى المحلي المتاح", "تبويب الرئيسية", "إعلان ممول بعد البحث واكتشاف خادمي مستقر وشعار المتجر المنشور؛ دليل docs/rui-cus-01.ar.md", "حفظ حالة العودة من البحث، الإعلان العريض والفيديو الصامت والرفوف المدمجة. ينتظر ترحيل المصغرات واختبار الهاتف وقبول المالك"),
 "home/search": ("البحث في المنتجات والعروض وتنقيح النتائج", "تبويب البحث وروابط البحث", "ProductRefinements وSearchControls/Results وproduct-details/offer-details", "تمييز الفراغ من فشل البحث؛ استخدام الشعار المنشور حيث تظهر هوية متجر عند تطوير النتائج"),
 "stores": ("استعراض المتاجر المتاحة للعميل", "الرئيسية وروابط السوق", "store-details عبر StoreCard", "الأهلية والتوفر من المصدر؛ استخدام الشعار المنشور عند تطوير القائمة"),
 "store-details": ("عرض المتجر وكتالوجه ومراجعاته", "بطاقة المتجر", "product-details/offer-details ومراجعات داخل RatingsSection", "استخدام الشعار المنشور؛ الفيديو المنشور عند الطلب مع إيقافه عند المغادرة وإخفاء قسمه عند غيابه؛ التنفيذ مؤجل لهذه الصفحة"),
 "product-details": ("اختيار المنتج والكمية وإضافته للسلة", "بطاقات المنتجات والبحث والمتجر والمفضلة", "ProductMediaGallery/Preview ومراجعات؛ السلة مسار مستقل", "الوحدة والسعر والتوفر وملاحظات الإضافة؛ عرض الوسائط حوار لا صفحة"),
 "home/offers": ("تصفح العروض المتاحة", "تبويب العروض", "offer-details عبر OfferCard", "الانتهاء والتوفر والسعر الفعلي؛ لا لون ذهبي صغير ضعيف"),
 "offer-details": ("مراجعة العرض ومكوناته وإضافته للسلة", "بطاقة عرض", "المنتجات المرتبطة والسلة؛ التفاصيل داخل الصفحة", "تمييز سعر العرض من السعر الأصلي وشروطه الحقيقية"),
 "orders": ("قائمة طلبات العميل ومتابعتها", "حسابي وروابط الطلبات", "order-details وفاتورة الطلب", "حالات ORD مفهومة وتحديث غير مزعج؛ فراغ مختلف عن فشل القراءة"),
 "favorites": ("الوصول إلى المنتجات المفضلة", "حساب العميل وروابط المفضلة", "product-details", "التوفر وحذف المفضلة والفراغ؛ عدم ظهور مفضلة حساب سابق"),
 "addresses": ("إدارة عناوين التوصيل", "حسابي وتدفق إتمام الطلب", "إضافة/تعديل العنوان ضمن الصفحة لا مسار مستقل", "العنوان والمنطقة والحقول اللازمة ولوحة المفاتيح؛ لا إرسال بيانات موقع إلى السجلات"),
 "settings": ("تعديل تفضيلات الحساب والعرض", "حساب العميل/السائق/الإدارة", "SettingsScreen؛ لا إعداد مستقل لكل دور مطلوب", "الثيم والإعدادات المتاحة فعلًا؛ الرجوع الآمن إلى حساب الدور"),
 "personal-info": ("تحرير البيانات الشخصية المشتركة", "حسابي للأدوار التي تستخدم المسار المشترك", "PersonalInfoScreen؛ معلومات السائق المهنية في حسابه", "الحقول الضرورية وتاريخ الميلاد والحفظ والتحقق؛ لا اقتطاع عربي مع الأرقام"),
 "security": ("تعديل كلمة المرور والأمان الموجود", "حسابي للأدوار المشتركة", "SecurityScreen ونموذج كلمة المرور", "لوحة المفاتيح وأخطاء التحقق الآمنة؛ لا تسريب تفاصيل جلسة أو مزود"),
 "login": ("تسجيل الدخول واستعادة الوصول", "بوابة البدء وروابط التسجيل", "ForgotPasswordSection وreset-password وsignup", "خطأ دخول واضح وآمن دون كشف وجود حساب؛ حفظ حالة النموذج"),
 "verify-email": ("تأكيد البريد واستكمال الدخول", "بعد التسجيل/توجيه الجلسة", "إعادة إرسال والعودة للدخول ضمن الصفحة", "مهلة إعادة الإرسال وحالة التأكيد وانتهاء الرابط؛ لا زر نجاح محلي"),
 "reset-password": ("تعيين كلمة مرور بعد رابط الاستعادة", "رابط البريد وتدفق الاستعادة", "نموذج داخل الصفحة؛ login بعد نجاح الخادم", "انتهاء الرابط وكلمة المرور والتأكيد والعودة الآمنة"),
 "merchant-application": ("استكمال طلب التاجر وبيانات متجره والخطة المختارة", "التسجيل وحالة الطلب؛ review القديم يعيد هنا", "ProfessionalApplicationScreen/Fields وMerchantPlanChoice؛ الخطوات ليست صفحات مستقلة", "KeyboardAwareScrollView؛ تكلفة وشروط الخطة دون اختيار الإدارة نيابة عنه"),
 "driver-application": ("استكمال بيانات انضمام السائق اللازمة", "التسجيل وحالة الطلب", "ProfessionalApplicationScreen/Fields؛ لا راتب أو وسيلة دفع مفترضة", "تاريخ الميلاد والبيانات المهنية والتحقق ولوحة المفاتيح؛ حفظ المدخلات"),
 "about": ("تعريف التطبيق ومعلوماته الحالية", "حسابي والروابط القانونية", "AboutContent/FeatureList/Header وروابط privacy/terms", "لا وظائف أو دعم أو منطقة خدمة غير موجودة؛ مطابقة الهوية الفعلية"),
 "privacy": ("شرح جمع البيانات واستخدامها والحقوق الفعلية", "التسجيل والحساب والصفحات القانونية", "LegalPageLayout/Section/RelatedDocument؛ لا مسار حذف بيانات منفذ يثبت بالنص وحده", "قرار المالك ومراجعة متطلبات المتجرين عند التنفيذ؛ لا ادعاء حذف أو تعهد غير مطبق"),
 "terms": ("بيان شروط الاستخدام التشغيلية والتجارية الفعلية", "التسجيل والحساب والصفحات القانونية", "LegalPageLayout ومراجع الخصوصية؛ لا صفحة دفع متجر جديدة مفترضة", "تطابق الاشتراك والعمولة والتوصيل والإلغاء مع التطبيق؛ لا تبسيط يغير المعنى القانوني"),
})

FUNCTIONS = dict(line.split(":", 1) for line in """
AboutContent:محتوى تعريف التطبيق
AboutFeatureList:قائمة مزايا التطبيق التعريفية
AboutHeader:هوية وترويسة صفحة معلومات التطبيق
AccountMenuItem:صف رابط ضمن حسابي
AccountProfileHeader:بطاقة هوية الحساب
AccountSection:تجميع عناصر حسابي بعنوان
AccountShell:حاوية تخطيط صفحة حساب
DriverProfessionalInfo:عرض بيانات السائق المهنية
PersonalInfoScreen:شاشة البيانات الشخصية والتحقق والحفظ
SecurityScreen:شاشة كلمة المرور والأمان الموجود
SettingsScreen:شاشة تفضيلات الحساب والثيم
AccountLoadState:عرض تحميل أو خطأ الحساب
AccountLogout:إجراء الخروج من الحساب
SharedAccountIdentity:عرض بيانات هوية الحساب المشتركة
SharedAccountMenu:روابط البيانات والإعدادات والأمان المشتركة
C3DeliverySettings:نموذج إعدادات التوصيل الإداري المضمن
ApplicationStatusEmptyState:فراغ حالة طلب الانضمام
OnboardingFrame:إطار تدفق التسجيل والانضمام
RoleRouteGuard:حارس دور المسار وحالات انتظار/رفض الدخول
BrandMark:الشعار والهوية
MerchantOrderCard:ملخص طلب متجر محايد مدمج مع توسعة صفوف المنتجات والإجراءات؛ لا بيانات طلبات الإدارة
MerchantFinanceView:رصيد المتجر والاشتراك والبحث وقائمة المستندات للتاجر
MerchantOrdersToolbar:بحث ومسح ومؤشر اتصال مختصر وفلاتر أفقية دون أعداد ظاهرة؛ العدادات الخادمية وصولية
DeliveryTaskCard:بطاقة المهمة وحالاتها والتحصيل وإجراء تقدمها
StorePickupPanel:خطوات استلام المهمة من كل متجر
FinanceScreen:شاشة مالية مشتركة مقيّدة بالدور والطرف
FinancialAccountSummary:ملخص حساب الطرف ومستحقاته
FinancialAmount:عرض مبلغ باستخدام التنسيق المالي القائم؛ المصدر يحدد عقد كل نسخة
FinancialFeedback:رسالة مالية داخل سياقها
FinancialSection:حاوية قسم مالي
InvoiceListItem:صف فاتورة ورابط تفاصيلها
InvoiceScreen:تفاصيل المستند والسداد وأدوات الإدارة المصرح بها
InvoiceStatus:عرض حالة مستند/استحقاق الفاتورة
PendingMoneyCard:ملخص عملية مالية غير محسومة ومسار التحقق بنفس المفتاح
ShoppingCardImage:صور بطاقات السوق العامة وروابط الوسائط المقيدة بالذاكرة
HomeAdTargetPicker:اختيار وجهة إعلان باسم المتجر أو المنتج أو العرض
CustomerHomeSponsored:مساحة الإعلان 16:9 مع تبديل وفيديو صامت
HomeSummary:ملخص تشغيلي قابل للانتقال إلى قائمته
LegalPageLayout:تخطيط صفحة قانونية قابلة للقراءة
LegalRelatedDocument:رابط إلى مستند قانوني مرتبط
LegalSection:فقرة قانونية بعنوان
ForgotPasswordSection:نموذج طلب استعادة كلمة المرور
LoginFooter:روابط أسفل تسجيل الدخول
LoginForm:حقول الدخول والتحقق والإرسال
LoginHeader:ترويسة الدخول والهوية
CategoryChip:اختيار فئة ضمن السوق
CustomerCatalogStatus:حالات توفر/تحميل الكتالوج للعميل
OfferCard:بطاقة عرض وسعره وتوفره
ProductCard:بطاقة منتج وإجراءاته
ProductMediaGallery:معرض وسائط المنتج
ProductMediaPreview:معاينة وسائط مكبرة
RatingsSection:قائمة تقييمات وملخصها ونموذجها
RatingStars:تمثيل التقييم بالنجوم
RatingSummary:ملخص عددي للتقييم
ReviewCard:عرض تقييم ومحتواه
ReviewForm:نموذج كتابة تقييم
StoreCard:بطاقة متجر وتوفره
StoreDetailsHero:هوية المتجر في صفحة تفاصيله
MerchantAccountHub:صفحة حساب التاجر وروابطه
MerchantPersonalInfo:بيانات التاجر الشخصية
MerchantStoreInfo:بيانات المتجر القابلة للتحرير
MerchantAddProduct:تدفق إضافة منتج
MerchantCatalogPanel:قائمة كتالوج موحدة بحسب kind للمنتجات أو العروض
MerchantCategorySelect:اختيار فئة منتج المتجر
MerchantEditProduct:تحميل وتعديل منتج قائم
FinancialCard:حاوية بطاقة مالية تجارية
FinancialLink:رابط مالي مصور
FinancialText:نص مالي بتنسيق محلي
MerchantOfferEditor:إدارة تحميل وحفظ محرر العرض
MerchantOfferForm:حقول العرض والتحقق منه
MerchantProductForm:حقول المنتج والسعر والوحدة والوسائط
MerchantStoreBranding:تحرير وسائط هوية المتجر
MerchantStoreInfo:معلومات المتجر والتواصل
OfferExpirationPicker:تحديد انتهاء العرض
SellingUnitSelect:اختيار وحدة البيع
AppBottomNav:شريط وجهات الدور وحالتها النشطة
AppHeader:ترويسة وعودة وجرس بحسب السياق
PushBridge:ربط تفاعل Push بدورة الجلسة والتنقل؛ مضيف غير مرئي وليس بطاقة
CustomerOrderTimeline:تسلسل حالات طلب العميل
DeliveryTracking:عرض حالة توصيل الطلب
StoreStatusHistory:تاريخ حالات جزء المتجر
ProductRefinements:خيارات تنقيح نتائج المنتجات
SearchControls:حقل البحث وتحكماته
SearchEmptyState:فراغ نتائج البحث
SearchResults:عرض نتائج البحث
BirthDateField:إدخال تاريخ الميلاد والتحقق منه
MerchantPlanChoice:اختيار التاجر خطة اشتراكه
ProfessionalApplicationFields:البيانات المهنية اللازمة للتاجر/السائق
ProfessionalApplicationScreen:تدفق طلب انضمام مهني كامل
SignupCredentialsStep:بيانات الدخول اللازمة للتسجيل
SignupErrorNotice:خطأ التسجيل في موضعه
SignupProgress:تقدم خطوات التسجيل
SignupReviewStep:مراجعة البيانات قبل إرسال التسجيل
SignupRoleStep:اختيار الدور قبل فورم البيانات
AppBadge:شارة حالة نصية مع أيقونة اختيارية
AppButton:زر مشترك مع نوع وحالة تحميل وتعطيل
AppEmptyState:حالة عدم وجود بيانات وإجراء مناسب
AppIcon:رمز مرئي موحد
AppAlertModal:رسالة حوارية بالهوية المشتركة
AppConfirmModal:حوار قرار وتأكيد
AppModal:غلاف حوار ذي سطح وحاجز وإغلاق
AppSearchBar:حقل بحث مشترك
AppSectionHeader:عنوان قسم وإجراء اختياري
AppTextField:حقل بعنوان وخطأ ومساعدة وتركيز وتعطيل
DocumentReference:نص مرجع باتجاه LTR قابل للتحديد مع تحقق صيغته؛ لا زر نسخ مستقل
FinancialStatus:حالة مالية بنص وألوان دلالية
KeyboardAwareScrollView:تمرير النموذج وإبقاء الحقل النشط فوق لوحة المفاتيح
LiveStatus:حالة التحديث المباشر والقراءة دون toast دوري
LoadingSkeleton:عناصر تحميل أول ثابتة بلا حركة مستمرة
RefreshStatus:صف محجوز لحالة التحديث دون إزاحة المحتوى
OperationFeedback:نتيجة عملية ضمن سياقها
SyriaFlag:أصل بصري للمنطقة لا منطق صلاحية أو حساب
ToastProvider:مضيف الرسائل العابرة المنضبطة بالدور/الجلسة/المسار
AppDialogProvider:مضيف وطابور الحوارات المشتركة
""".strip().splitlines())

def read(path):
    return path.read_text(encoding="utf-8-sig")

def route(key):
    return "/" + (key[:-6] if key.endswith("/index") else "" if key == "index" else key)

def resolve(source, spec):
    if spec.startswith("@/"):
        target = ROOT / "src" / spec[2:]
    elif spec.startswith("."):
        target = source.parent / spec
    else:
        return None
    for candidate in [target.with_suffix(".tsx"), target.with_suffix(".ts"), target / "index.tsx", target / "index.ts"]:
        if candidate.is_file():
            return candidate.resolve().relative_to(ROOT).as_posix()
    return None

sources = {p.relative_to(ROOT).as_posix(): read(p) for p in sorted((ROOT / "src").rglob("*")) if p.suffix in (".ts", ".tsx")}
graph = {}
for path, text in sources.items():
    specs = re.findall(r'(?:from\s*|import\s*)[\'"]([^\'"\n]+)[\'"]', text)
    graph[path] = sorted({target for spec in specs if (target := resolve(ROOT / path, spec))})

def closure(path):
    seen, todo = set(), [path]
    while todo:
        current = todo.pop()
        if current in seen:
            continue
        seen.add(current)
        todo.extend(graph.get(current, []))
    return seen

pages, excluded = [], []
for path, text in sources.items():
    if not path.startswith("src/app/") or not path.endswith(".tsx"):
        continue
    kind = "layout" if path.endswith("/_layout.tsx") else "redirect" if "<Redirect" in text and len(text) < 800 else "alias" if re.fullmatch(r'\s*export \{ default \} from "\./orders";\s*', text) else "page"
    if kind != "page":
        target = re.search(r'(?:href=\{?\s*(?:\{pathname:)?|from )"([^"]+)"', text)
        excluded.append({"path": path, "kind": kind, "target": {"src/app/merchant/products.tsx": "/merchant/catalog?tab=products", "src/app/merchant/offers.tsx": "/merchant/catalog?tab=offers"}.get(path, target.group(1) if target else "حاوية تنقل")})

registered = set()
for code, (role, entries) in GROUPS.items():
    for n, item in enumerate(entries.split("|"), 1):
        key, name = item.split(":", 1)
        path = "src/app/" + key + ".tsx"
        assert path in sources, path
        assert path not in registered
        if key in {"merchant/products", "merchant/offers"}:
            assert any(row["path"] == path and row["kind"] == "redirect" for row in excluded)
            continue  # Keep historical MER-05 and MER-07 slots without renumbering.
        registered.add(path)
        function, access, children, concerns = NOTES.get(key, ("عرض وإدارة " + name + " بحسب الدور والصلاحية القائمة", "روابط الأب المسجلة أدناه؛ تحقق الوصول الفعلي في دفعة الصفحة", "تفاصيل/نماذج ضمن المسار أو روابط الملف؛ لا صفحة جديدة مقررة دون حاجة مثبتة", "وضوح العنوان والإجراء والتحقق والفراغ والخطأ؛ مراجعة النصوص في سياق الصفحة لا إعادة صياغة عشوائية"))
        parents = sorted(p for p, s in sources.items() if p != path and (('"'+route(key)+'"') in s or ("'"+route(key)+"'") in s))
        reachable = closure(path)
        components = sorted(p for p in reachable if p.startswith("src/components/") and p.endswith(".tsx"))
        services = sorted(p for p in reachable if p.startswith(("src/lib/", "src/hooks/")))
        page_id = {"driver/task-details": "RUI-DRV-02.01", "driver/credentials": "RUI-DRV-04.01", "driver/settings": "RUI-DRV-04.02"}.get(key, f"RUI-{code}-{n - 1 if code == 'DRV' and n > 3 else n:02}")
        pages.append({"id": page_id, "group": code, "role": role, "name": name, "path": path, "route": route(key), "function": function, "access": access, "reference_files": parents, "bottom_tab": key in TABS, "children": children, "components": components, "services": services, "concerns": concerns, "priority": "P0: بيانات/مال/إجراء" if any(x in key for x in ["finance", "cash-account", "invoice", "orders", "task-details", "checkout", "application"]) else "P1: الاستخدام اليومي", "status": "مغلقة" if key in {"merchant/index", "merchant/orders", "merchant/finance", "merchant/catalog", "merchant/product-editor"} else "مغلقة لعرض التاجر" if key == "financial-invoice" else "مغلقة" if key == "admin/categories" else "مغلقة" if key == "merchant/offer-editor" else "مغلقة" if key == "merchant/store-info" else "مغلقة" if key == "merchant/account" else "مغلقة" if key in {"merchant/personal-info", "merchant/settings"} else "مغلقة" if key == "merchant/security" else "مغلقة" if key == "driver/index" else "مغلقة" if key in {"driver/orders", "driver/task-details"} else "مغلقة" if key == "driver/cash-account" else "بانتظار اختبار الهاتف" if key in {"driver/account", "driver/credentials", "driver/settings", "home/index", "admin/home-ads"} else "لم تبدأ", "phone": "أكد المالك نجاح جميع اختبارات الهاتف وقبول الوظائف والتصميم وتطبيق ترحيل البحث في 11 نوفمبر 2026" if key == "merchant/orders" else "المالك أكد نجاح اختبار الهاتف النهائي وأغلق RUI-MER-03.01 والمالية" if key == "merchant/finance" else "قبول نهائي لعرض التاجر بحسب اختبار المالك" if key == "financial-invoice" else "قبول نهائي لتصميم الكتالوج ووظائفه بعد اختبار الهاتف" if key == "merchant/catalog" else "قبول نهائي لمحرر المنتج المشترك بعد اختبار الهاتف" if key == "merchant/product-editor" else "قبول نهائي من المالك للتصميم والوظائف والثيمين والمسافات؛ تعديل الكتالوج بعد القبول POST-01 ينتظر تحققًا بصريًا مستقلًا" if key == "merchant/index" else "قبل المالك لوحة SYS-CAT-01.04 نهائيًا بعد اختبار الهاتف" if key == "admin/categories" else "أغلق المالك محرر العرض بعد نجاح اختبار الهاتف" if key == "merchant/offer-editor" else "أغلق المالك بيانات المتجر بعد نجاح اختبار الهاتف" if key == "merchant/store-info" else "أغلق المالك حساب التاجر بعد نجاح اختبار الهاتف" if key == "merchant/account" else "أغلق المالك بيانات التاجر الشخصية بعد نجاح اختبار الهاتف" if key == "merchant/personal-info" else "أغلق المالك إعدادات التاجر بعد اختبار إعادة التنظيم" if key == "merchant/settings" else "أغلق المالك أمان التاجر بعد نجاح اختبار الهاتف" if key == "merchant/security" else "أغلق المالك رئيسية السائق بعد نجاح اختبار الهاتف" if key == "driver/index" else "أكد المالك تطبيق ترحيل البحث في Production وقبوله النهائي على الهاتف" if key == "driver/orders" else "أكد المالك نجاح اختبار الوظائف وفوّض الإغلاق بعد فحوص اللمسات البصرية" if key == "driver/task-details" else "أكد المالك تطبيق الترحيل في Production وقبول المالية والعرض المشترك على الهاتف" if key == "driver/cash-account" else "مكتملة برمجيًا وتنتظر اختبار المالك وقبوله" if key in {"driver/account", "driver/credentials", "driver/settings"} else "لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md"})

actual = {p for p in sources if p.startswith("src/app/") and p.endswith(".tsx")} - {p["path"] for p in excluded}
assert actual == registered, f"Unregistered={actual-registered}; extra={registered-actual}"

components = []
component_paths = [p for p in sources if p.startswith("src/components/") and p.endswith(".tsx")]
component_paths += ["src/context/ToastContext.tsx", "src/context/AppDialogContext.tsx"]
for path in component_paths:
    text = sources[path]
    names = re.findall(r'export\s+(?:default\s+)?function\s+([A-Z]\w*)|export\s+(?:default\s+)?(?:const|class)\s+([A-Z]\w*)', text)
    names = sorted({a or b for a, b in names})
    if not names:
        names = [Path(path).stem + " (تصدير/واجهة الملف)"]
    direct = sorted(p for p, deps in graph.items() if path in deps)
    used = [p["id"] for p in pages if path in closure(p["path"])]
    # Include ancestor layouts separately: file-level graph is conservative and may
    # include other exports from the same module. Never call this runtime coverage.
    layouts = [p["path"] for p in excluded if p["kind"] == "layout" and path in closure(p["path"])]
    for name in names:
        assessment = "مرشح لإعادة الاستخدام ضمن اختصاصه؛ لا استبدال مقرر دون حاجة الصفحة واختبار props والمستهلكين"
        if name == 'DeliveryTaskCard':
            assessment = "يبقى؛ تحسين أزواج ألوان الحالات المحلية وonPrimary عند RUI-DRV-02، دون إعادة بناء FIX-DRV-01 المقبولة"
        elif name == 'MerchantCatalogPanel':
            assessment = "يبقى؛ يستعمله الكتالوج بالعرض المدمج وصفحة العروض بالعرض الافتراضي"
        elif name == 'FinancialAmount':
            assessment = "نسختان بالاسم نفسه في ui وFinancialParts؛ قارن العقد والتنسيق والمستهلكين قبل أي دمج، لا تخلط الحساب بالعرض"
        elif name in ['HomeSummary','LiveStatus']:
            assessment = "يبقى؛ compact اختياري لرئيسية التاجر فقط، مع الحفاظ على العرض الافتراضي للمستهلكين الآخرين؛ بانتظار قبول تصميم الهاتف"
        elif name in ['AppBadge', 'FinancialStatus', 'AppButton', 'AppTextField', 'LoadingSkeleton', 'RefreshStatus', 'ToastProvider', 'AppDialogProvider']:
            assessment = "أساس مشترك قائم قابل للإبقاء؛ تحقق سلوكي بصري في الصفحة الحالية، لا مبرر لاستبداله الشامل من المصدر وحده"
        elif name in ['FinanceScreen','InvoiceScreen','PendingMoneyCard']:
            assessment = "يبقى السلوك المالي المقبول؛ افصل العرض فقط حسب حاجة الدور ولا تغير مفتاح التحقق أو شروط الإجراء؛ UX-03/04 تنتظران القبول"
        components.append({"name": name, "path": path, "function": FUNCTIONS.get(name, "جزء متخصص؛ اقرأ عقد props قبل إعادة الاستخدام"), "page_reachability": used, "layout_reachability": layouts, "direct_consumers": direct, "theme": "يستخدم useTheme/رموز colors في الملف؛ يحتاج تحقق الأزواج" if "useTheme" in text or "colors." in text else "لا استدعاء ثيم مباشر؛ افحص الألوان الممررة/المكون الأب، لا يثبت غياب الدعم", "rtl": "دلائل اتجاه/محاذاة في الملف؛ يلزم هاتف وأرقام مختلطة" if re.search(r'right|RTL|row-reverse|writingDirection|textAlign', text) else "لا دليل مباشر في الملف؛ افحص الوراثة والأيقونات", "states": {k: bool(re.search(v, text, re.I)) for k, v in {"loading": "loading|busy|pending|ActivityIndicator|Skeleton", "error": "error|feedback|failure", "disabled": "disabled|editable|locked"}.items()}, "fixed_colors": sorted(set(re.findall(r'#[0-9A-Fa-f]{3,8}\b', text))), "assessment": assessment})

counts = {code: sum(p["group"] == code for p in pages) for code in GROUPS}
manifest = {"scope": "source-only; no runtime/phone/database verification", "counts": counts, "page_count": len(pages), "route_file_count": len(actual) + len(excluded), "excluded": excluded, "pages": pages, "components": components, "component_module_count": len(component_paths), "component_export_record_count": len(components), "import_graph": graph}

def screen_markdown():
    out = ["# جرد صفحات تسوق — من ملفات المصدر", "", "مرجع ثابت للترقيم؛ المصدر هو src/app وليس عناوين الترويسة القديمة. توليد: `python scripts/build-ui-foundation-inventory.py`؛ تحقق دون كتابة: `python scripts/build-ui-foundation-inventory.py --check`.", "", f"الإجمالي **{len(pages)} صفحة فعلية** ضمن **{len(actual)+len(excluded)} ملف مسار**. لا يعد التبويب الداخلي أو الحوار أو وضع الإضافة/التعديل صفحة إضافية. المسار المشترك يعد مرة واحدة؛ مسارات دورين إلى مكون واحد تبقى مدخلين فعليين مختلفين.", "", "## حدود الدليل", "", "فحص ساكن بلا جلسات دخول أو هاتف. المكونات والخدمات أدناه وصول محافظ عبر imports/re-exports على مستوى الملف، وقد يشمل تصديرًا آخر أو مسارًا شرطيًا؛ ليس إثبات عرض أو صلاحية. ملفات الإشارة تضم الترويسات وخرائط التنقل وقد لا تكون زرًا قابلًا للضغط. المسارات الديناميكية/Push يراجعها اختبار الصفحة. الحاويات الموروثة في الملحق؛ لا تكرر قوائمها لكل صفحة. جرد JSON يضم خدمات/hooks كل صفحة وسلسلة الاعتماديات القابلة للتتبع.", ""]
    for code in ["CUS", "MER", "DRV", "ADM", "SHR", "AUTH", "LEGAL"]:
        out += [f"## {GROUPS[code][0]} — {counts[code]} صفحة", ""]
        for p in [p for p in pages if p["group"] == code]:
            out += [f"### {p['id']} — {p['name']}", "", f"- الدور: {p['role']}. المصدر: `{p['path']}`؛ الوجهة: `{p['route']}`.", f"- الوظيفة: {p['function']}.", f"- الوصول: {p['access']}. إشارات المصدر: " + ("، ".join('`'+x+'`' for x in p['reference_files']) or "لا مرجع حرفي مباشر؛ قد يفتح بتوجيه ديناميكي/بدء التطبيق") + ".", f"- التبويب: {'تبويب مباشر' if p['bottom_tab'] else 'ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout' }.", f"- التفاصيل الموجودة/الناقصة: {p['children']}.", "- المكونات (وصول محافظ): " + ("، ".join('`'+x+'`' for x in p['components']) or "عناصر محلية/حاوية توجيه؛ انظر المصدر") + ".", f"- النصوص والحالات: {p['concerns']}.", "- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.", f"- الأولوية: {p['priority']}. الحالة: **{p['status']}** في مسار RUI؛ {p['phone']}.", ""]
    out += ["## ملفات لا تعد صفحات مستقلة", "", "لا تعاد إحياء المالية القديمة بسبب وجود اسم مسار. التحويلات أدناه تبقى توافقًا إلى النظام الحالي. `admin/requests` اسم بديل للطلبات؛ لا يمثل شاشة أخرى.", ""]
    out += [f"- `{p['path']}` — {p['kind']} → `{p['target']}`." for p in excluded]
    out += ["", "## الفجوات المؤكدة وحدود قرار الصفحات الجديدة", "", "- تفاصيل طلب التاجر ضمن القائمة. تفاصيل مهمة السائق صفحة مستقلة RUI-DRV-02.01 وفق قرار المالك، وتبقى البطاقات مداخل مختصرة.", "- قوائم الفواتير والتسويات والخزينة وأدواتها الحالية داخل FinanceScreen/InvoiceScreen؛ المسارات القديمة لا توفر صفحات حديثة مستقلة. أي فصل مطلوب يملك مهمة فرعية مستقلة بعد تحديد الحاجة، ولا ينفذ تلقائيًا مع لوحة المالية.", "- لا صفحة /account مشتركة؛ حسابي له مسار لكل دور. المشترَك هو القطع والمداخل الفرعية؛ لا ننشئ صفحة وهمية في العد.", "- بيانات اعتماد السائق في صفحة مستقلة للعرض، وإعدادات السائق تستخدم مكوّن المظهر المشترك.", "- لا مسار مشروع مخصص لـ404 في الجرد؛ لا يعني ذلك غياب fallback الخاص بـExpo Router. يراجع الرجوع/الرابط غير الصالح في كل صفحة.", "- صفحات القانونية لا تثبت وجود حذف حساب أو توافق دفع المتجرين؛ تطابق مع الوظائف الفعلية ومتطلبات حديثة عند الوصول إلى مرحلتها.", ""]
    return "\n".join(out)

def component_markdown():
    out = ["# جرد المكونات وإعادة الاستخدام", "", f"**{len(component_paths)} وحدة TSX**: مكونات src/components ومضيفا AppDialog/Toast في context؛ **{len(components)} سجل تصدير مسمى بحرف كبير**، بينها حارس دور ومضيف Push غير مرئيين. hooks والأنواع المساعدة ليست ضمن عدد التصديرات المرئية. لا يمثل العدد عدد شاشات أو عدد مكونات معروضة على هاتف.", "", "المستهلكون والصفحات محسوبون على مستوى الملف؛ تعدد exports قد يجعل القائمة أوسع من الاستخدام الفعلي لكل رمز. `—` لا يثبت أن المكون ميت: قد يستخدم من layout أو بتصدير آخر. مؤشرات loading/error/disabled تعني وجود رمز في الملف، وليست اختبار سلوك. المكون الزخرفي لا يحتاج حالات طلب شبكي؛ تدار لدى الأب. المكونات الخاصة لا تحول إلى مكون عام بشروط أدوار كثيرة.", "", "## قرارات reuse قبل أي تنفيذ", "", "- اعتماد AppButton/AppTextField/AppModal وKeyboardAwareScrollView وLoadingState وLiveStatus وToast/AppDialog أساسًا؛ لا مكتبة Toast جديدة ولا Alert أصلي.", "- اعتماد FinancialAccountSummary/FinancialParts/InvoiceStatus/PendingMoneyCard مع الحفاظ على الصلاحيات ومفتاح العملية؛ لا إنشاء نموذج تشغيل حر لفاتورة الطلب أو الاشتراك.", "- DeliveryTaskCard/StorePickupPanel قابلان للتحسين المحدد؛ افحص أزواج accent/accentLight وحالة Delivered بدل إعادة بناء إصلاح السائق المقبول.", "- src/app/merchant/catalog.tsx يستخدم MerchantCatalogPanel مباشرة بالعرض المدمج. مسار المنتجات تحويل إلى تبويب المنتجات، ومسار العروض القديم يحوّل إلى تبويب العروض.", "- FinancialAmount موجود في ui وكذلك FinancialParts: افحص اختلاف المسؤولية قبل دمج الرمزين؛ التشابه الاسمي ليس دليل تكرار مطابق.", "- SharedAccountParts وMerchantAccountScreens يعيدان استخدام الهيكل؛ تجنب تضخم شروط الدور، وراجع كل تصدير ومستهلكه عند تعديل صف مشترك.", "- AppBottomNav/AppHeader يؤثران في كل الأدوار؛ أي تعديل لازم للصفحة الحالية يحتاج اختبار تنقل وsafe area لجميع المستهلكين.", ""]
    for c in components:
        function = c['function']
        out += [f"## {c['name']}", "", f"- الملف: `{c['path']}`. الوظيفة: {function}.", "- صفحات محتملة بالوصول الساكن: " + ("، ".join(c['page_reachability']) or "—") + ".", "- مستخدم عبر layout: " + ("، ".join('`'+p+'`' for p in c['layout_reachability']) or "—") + ".", "- المستهلكون المباشرون: " + ("، ".join('`'+p+'`' for p in c['direct_consumers']) or "—") + ".", f"- الثيمان: {c['theme']}. RTL: {c['rtl']}.", "- مؤشرات حالات الملف: " + "؛ ".join(k + (" موجود" if v else " غير ظاهر؛ افحص الأب/props") for k, v in c['states'].items()) + ".", "- ألوان حرفية: " + ("، ".join(c['fixed_colors']) if c['fixed_colors'] else "لا hex حرفي؛ هذا لا يثبت التباين") + ".", f"- إعادة الاستخدام والتحسين: {c['assessment']}. لا استبدال مقرر بلا فحص الصفحة وأثر المستهلكين.", ""]
    out += ["## ما لا يدخل في عدد المكونات", "", "العناصر الخاصة المعرّفة داخل routes والحوارات المحلية لا تعد مكونات مشتركة مستقلة؛ افحصها ضمن الصفحة. ملفات .ts للأنواع/النماذج/الأنماط وcontexts غير المرئية/hooks خدمات اعتماديات وليست widgets؛ graph في JSON يحتفظ بارتباطاتها. المكونات المركبة قد تحوي عناصر محلية غير مصدرة؛ لا ندعي اختبار كل عنصر بمجرد جرد الوحدة.", ""]
    return "\n".join(out)

def roadmap_markdown():
    out = ["# RUI — ترتيب مراجعة الصفحات وتنفيذها", "", "تأسيس بتاريخ 10 نوفمبر 2026 بطلب المالك. هذا سجل الصفحة الواحدة المطلوب، لا إعادة بناء للأنظمة ولا إلغاء لخطة UI/UX/TXT. **حالة كل صفحة موضحة بسجلها؛ RUI-MER-01 مغلقة بعد قبول الهاتف؛ تعديل الكتالوج POST-01 ينتظر تحققًا بصريًا؛ MER-02 مغلقة بقبول المالك وتأكيده تطبيق الترحيلات؛ MER-03 وتحسين القائمة مقبولان ومغلقان، وعرض التاجر في SHR-02 مقبول ومغلق، والكتالوج MER-04 مغلق بقبول المالك، وقبل المالك تحويل MER-05 واستقرار الكتالوج، ومحرر المنتج MER-06 مغلق بعد قبول الهاتف**؛ لا تعني إعادة الميزة من الصفر. قبول سابق يثبت سلوكه فقط، وليس قبول تحسين لم ينفذ بعد. WORK_PROGRESS.md المرجع الأعلى للحالة والقبول، وهذا الملف تفصيل النطاق والترتيب الثابت.", "", "## قواعد التبعية والقبول لكل رقم", "", "1. اقرأ المهارة والقواعد والمتابعة وصف الجرد؛ أجب عن أسئلة المهارة العشرين من الكود والسياق. حدد ما يعمل وما يحتاج تغييرًا فقط.", "2. افحص المكون الموجود والمستهلكين والصفحات المتصلة؛ أصلح المشترك عند ضرورة الصفحة الحالية فقط. لا تنفذ صفحتين تحت اسم مكون مشترك.", "3. نفذ نطاق صفحة فعلية واحدة؛ التفاصيل داخلها والحوارات أجزاء منها. إن ثبتت حاجة لمسار فرعي جديد، سجل RUI-ROLE-NN.01 مستقلًا واطلب اعتماده قبل إضافته للدفعة؛ لا تحسبه موجودًا في الجرد الحالي.", "4. راجع TXT لهذه الصفحة وقاموسه، ثم الثيمين وRTL والكيبورد وخط النظام والحالات الست واستقرار التحديث. لا تقبل تعديلًا بصريًا يغير صلاحية أو معادلة مالية.", "5. شغّل expo lint وtsc --noEmit واختبارات السلوك المحددة أدناه بحسب أثر التغيير؛ لا تدعِ أن اختبارات المصدر تعادل الهاتف. قائمة الاختبارات ليست أمرًا لتكرار كل اختبارات المشروع على تعديل نص واحد.", "6. سجل مكتملة برمجيًا ثم بانتظار اختبار الهاتف؛ المالك يجرب ويقبل أو يطلب إصلاحًا. لا تنتقل تلقائيًا ولا تغلق الدور قبل كل صفحاته المعتمدة. الحالات: لم تبدأ، قيد التنفيذ، مكتملة برمجيًا، بانتظار اختبار الهاتف، تحتاج إصلاحًا، مغلقة.", "", "## العلاقة بالمراحل السابقة", "", "- UI-01/TXT-02 وFIX-DRV-01 مقبولة ومغلقة؛ تبقى كذلك. مراجعة RUI لاحقة ليست إعادة فتح لها.", "- UI-02 مكتملة برمجيًا، لا إفادة بتطبيق 20261119000100_operational_home.sql أو قبول الهاتف؛ MER-01 وADM-01 يبدأان بتقييم تحسينها الحالي لا بإعادة تنفيذ عداداتها.", "- UX-FOUNDATION-01 وTXT المرتبط بها بانتظار الهاتف وقبولهما مستقل. المالك طلب تنفيذ RUI-MER-03 صراحة في 11 نوفمبر 2026؛ بقية أعمال UI-03 تحتفظ باعتمادياتها.", "- UX-03/04 بانتظار قبول الهاتف؛ UX-05 ينتظر إعدادات/نشر/أجهزة Push والتأكيدات غير المكتملة. تنقل الجرس المقبول لا يغلق اختبار Push.", "- UI-03 إلى UI-06 تبقى سجلات أهداف؛ RUI هو وحدة التسليم الأضيق: MER/ADM الرئيسية↔UI-02، المالية↔UI-03، DRV المهمات↔UI-04، طلبات MER/ADM↔UI-05، العميل والحساب والهوية↔UI-06. لا يغلق أي هدف قديم آليًا بإغلاق صفحة واحدة.", "- صفحات الحساب الخاصة بالدور تراجع في نهاية ذلك الدور لأنها مداخل حقيقية مختلفة؛ الصفحات العامة والهيكل المشترك في المسار الأخير. لا صفحة /account مشتركة مفترضة، ولا مرحلة مفقودة لتفاصيل مهمة غير موجودة كمسار.", "", "## ترتيب الأدوار", "", "1. التاجر: الرئيسية، الطلبات، المالية، الكتالوج والمنتجات والعروض، ثم بياناته وحسابه.", "2. السائق: الرئيسية، توصيلاتي وتفاصيلها المضمنة، المالية، الحساب.", "3. الإدارة: الرئيسية، الطلبات وتفاصيلها، الانضمام وتفاصيله، المالية، أدوات الإدارة.", "4. العميل: الرئيسية، البحث والسوق، السلة والتأكيد، متابعة الطلب وفاتورته، الباقي.", "5. المسار النهائي: المشترك ثم الدخول/الانضمام ثم القانونية والمعلومات. فصل هذه المجموعات يحافظ على عد الجرد، ولا يؤخر مراجعة حقل مشترك لازم لصفحة حالية.", ""]
    out += ["## فلسفة Compact Mobile Dashboard المعتمدة", "", "اعتمد المالك التصميم النهائي لرئيسية التاجر مرجعًا: استغلال عرض الهاتف بصفوف وشبكات، كثافة مناسبة للوظيفة، تقليل البطاقات الكبيرة والمسافات غير المبررة، وعدم تكرار المعلومات بين العنوان والبطاقة والرسالة. الوظيفة والإجراء قبل الزينة؛ الداكن هوية متكاملة؛ إعادة الاستخدام والتحسين قبل الإنشاء. لا منع للتمرير عند الحاجة ولا مساس بأهداف اللمس والإتاحة والخط المكبر. تطبق عند كل صفحة في دورها، دون فتح إعادة تصميم جماعية أو اعتبار قبول الاتجاه قبولًا لتفاصيلها الأخيرة.", ""]
    for code, (role, _) in GROUPS.items():
        out += [f"## {role}", ""]
        for p in [p for p in pages if p['group'] == code]:
            k = p['path'][8:-4]
            financial = any(x in k for x in ['finance','cash-account','invoice','wallet'])
            tests = 'اختبارات invoice-finance-client وinvoice-presentation وpending-money-review ومنع تكرار الإجراء إذا تأثرت؛ رفض غير المملوك' if financial else 'اختبارات operational-home وmerchant-home إن تأثرت العدادات/الأهلية' if k in ['merchant/index','admin/index'] else 'اختبارات driver-refresh وdriver-collection وdelivery-collection-attempt عند تأثر مسار المهمة' if code == 'DRV' else 'اختبارات auth-onboarding عند تأثر التسجيل/الجلسة، وui-navigation للمسارات المتغيرة' if code == 'AUTH' else 'اختبار سلوك الصفحة المتغير والتنقل/الفلاتر والرد القديم بحسب أثر التعديل؛ إعادة استخدام اختبارات المشروع المناسبة'
            dependency = 'تنفيذ RUI-MER-03 مصرح به بطلب المالك الحالي؛ قبول هذه الصفحة وUX-FOUNDATION-01 وUX-03/04 يتتبع كل على حدة' if k == 'merchant/finance' else 'UX-FOUNDATION-01 وقبولها قبل UI-03، وعدم إغلاق UX-03/04 المعلقة؛ لا تغيير معادلات' if financial else 'تأكيد تطبيق ترحيل operational_home واختبار UI-02؛ لا إعادة كتابة المصدر الخادمي' if k in ['merchant/index','admin/index'] else 'نتيجة الصفحة السابقة وقبول المالك؛ صلاحية الدور؛ لا عائق إعداد خارجي مفترض'
            phone = 'الفواتير/السداد/المبلغ والطرف والرجوع، فتح بلا كتابة، نتيجة غير محسومة إن توفرت، والتأكيد الحساس دون تكرار' if financial else 'كل عدد يفتح فلتره، حدث حقيقي يحدّث الملخص، وأهلية متجر غير متاح مع السبب' if k in ['merchant/index','admin/index'] else 'فتح من الأب ومن رابط مباشر مسموح، تنفيذ الإجراء الأساسي مرة، ثم الرجوع؛ الفراغ والخطأ والتحديث الحقيقي'
            out += [f"### {p['id']} — {p['name']}", "", f"- الهدف/المشكلة: {p['function']}. موضع المراجعة: {p['concerns']}.", f"- الملفات: `{p['path']}`؛ المكونات والخدمات المتصلة مفصلة في [جرد الصفحات](screen-inventory.ar.md) تحت {p['id']} وفي JSON. يجب التحقق من المستهلك المباشر قبل تحرير مكون مشترك.", f"- حدود الصفحة/الفروع: {p['children']}.", "- التنفيذ: تقييم وظيفي من الصفر لا إعادة برمجة من الصفر → اختيار فجوة مثبتة → إعادة استخدام وتحسين محدد → TXT → حالات البيانات والثيمان → فحص وتسليم. التنفيذ يتبع حالة الصفحة أدناه؛ لا تبدأ التالية دون قبول المالك.", f"- الاختبارات البرمجية: {tests}؛ ثم lint وTypeScript حسب قواعد المشروع.", f"- اختبار المالك: {phone}؛ إضافة فاتح/داكن، خط مكبر/RTL وأرقام، شاشة صغيرة، كيبورد إن وجد، خلفية/شبكة وتبديل حساب حسب الصفحة.", "- القبول والإغلاق: الهدف الأساسي واضح؛ لا نقص صلاحية أو بيانات حساب سابق أو تعطيل تحديث؛ لا تغيير مالي غير مقصود؛ الفحوص المناسبة ناجحة وقبول هاتف صريح مسجل. الأدلة غير المتاحة تبقى مفتوحة.", f"- الاعتماديات/العوائق: {dependency}. الصفحات القانونية تحتاج قرارات المالك ومتطلبات المتجرين الحالية عند التنفيذ؛ لا نخترع دعمًا أو حذف حساب.", f"- الحالة: **{p['status']}** في RUI؛ الاختبارات التاريخية لا يعاد تصنيفها هنا. نتيجة التنفيذ/الهاتف/القبول تسجل في WORK_PROGRESS.md عند كل دفعة.", ""]
    out += ["## تحويل RUI-MER-05 وRUI-MER-07 وترتيب صفحات التاجر", "", "RUI-MER-05 مسار توافق من /merchant/products إلى /merchant/catalog?tab=products. بقي الرقم محجوزًا لسجل التحويل. قبل المالك التحويل والتحديث وأغلق RUI-MER-05. أُغلق RUI-MER-06 على /merchant/product-editor بعد قبول الهاتف. أُغلق SYS-CAT-01 بعد قبول المالك واستؤنف مسار RUI عند RUI-MER-08. الإضافة والتعديل يشتركان في MerchantProductForm على المسار نفسه، مع تدفقي حفظ منفصلين. أغلق المالك محرر العرض RUI-MER-08 بعد اختبار الهاتف. RUI-MER-07 تحويل توافق من /merchant/offers إلى /merchant/catalog?tab=offers لأن المسار كان يعرض لوحة العروض نفسها. حُفظ رقم التحويل. أُغلق RUI-MER-09 بعد قبول المالك. أُغلق RUI-MER-10 بعد قبول المالك. أُغلق RUI-MER-11 بعد قبول المالك. نُقلت روابط الخصوصية وحول التطبيق إلى حساب التاجر وبقيت إعدادات المظهر في مسارها. قبل المالك التنظيم وأُغلق RUI-MER-12. أُغلق RUI-MER-13 وأُكمل مسار التاجر. أُغلق RUI-DRV-01 بعد قبول المالك. أُغلقت RUI-DRV-02 وصفحتها الفرعية RUI-DRV-02.01 بعد قبول الوظائف وفحوص اللمسات البصرية. أُغلقت RUI-DRV-03 وبحث RUI-DRV-02 بعد تطبيق الترحيلين وقبول الهاتف. RUI-DRV-04 على /driver/account تنتظر قبول إعادة التنظيم قبل مراجعة الصفحات المشتركة للسائق ثم الإدارة.", ""]
    out += ["## مراجعة صفحات حساب السائق بعد قبول الدفعة", "",
            "ينتظر حساب السائق وصفحتا الاعتماد والإعدادات اختبار الهاتف. يبقى محرر المعلومات الشخصية على /personal-info (RUI-SHR-05). مراجعة الأمان RUI-DRV-04.03 على /security (RUI-SHR-06) لم تبدأ.", ""]
    out += ["## قرار معتمد بشأن تفاصيل منتجات التاجر وعروضه", "", "بطاقة المنتج تعرض المعلومات الأساسية، ومحرر المنتج يعرض البيانات الكاملة ويعدلها. بطاقة العرض وتوسعتها تعرضان المنتجات المشمولة، ومحرر العرض يدير بياناته. لا صفحات تفاصيل مستقلة لهذه العناصر حاليًا. فتح المحرر يقرأ البيانات فقط؛ الحفظ إجراء صريح.", ""]
    out += ["## أول دفعة بعد اعتماد التأسيس", "", "**RUI-MER-01 — رئيسية التاجر، src/app/merchant/index.tsx**. تبدأ بقراءة تنفيذ UI-02 الحالي ومصدر الأهلية والعدادات؛ تحدد النقص الفعلي وتحافظ على الوظائف المكتملة. يتأكد تطبيق ترحيلها مع المالك قبل ادعاء تجربة مصدر العدادات على بيئته. قبلها المالك نهائيًا؛ دليلها docs/rui-mer-01.ar.md. تعديل الكتالوج POST-01 يحتاج تحققًا بصريًا مستقلًا، أغلق المالك RUI-MER-02 بعد نجاح اختبارات الهاتف وقبول التصميم وتطبيق الترحيلات. نُفذ عرض RUI-MER-03 بطلبه وقبل المالك أساسها على الهاتف. أُغلق تحسين القائمة RUI-MER-03.01 بعد قبول الهاتف. قبل المالك تفاصيل التاجر في مسار RUI-SHR-02، وقبل RUI-MER-04 نهائيًا. أُغلق تحويل RUI-MER-05 بعد قبول الهاتف، وقبل المالك محرر المنتج RUI-MER-06 نهائيًا. POST-01 يحتفظ بحالة تحققه المستقلة دون افتراض قبول. لا إنشاء مسارات مالية فرعية الآن ولا مخطط بيانات جديد.", ""]
    return "\n".join(out)

outputs = {
    "docs/ui-foundation-inventory.json": json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    "docs/screen-inventory.ar.md": screen_markdown(),
    "docs/component-inventory.ar.md": component_markdown(),
    "docs/role-page-roadmap.ar.md": roadmap_markdown(),
}
check = "--check" in sys.argv
for name, content in outputs.items():
    path = ROOT / name
    if check:
        assert path.exists() and read(path) == content, f"Stale inventory: {name}"
    else:
        path.write_text(content, encoding="utf-8", newline="\n")
print(json.dumps({"pages": len(pages), "counts": counts, "excluded": {k: sum(p['kind'] == k for p in excluded) for k in ['layout','redirect','alias']}, "component_modules": len(component_paths), "export_records": len(components), "mode": "check" if check else "generate"}, ensure_ascii=False))
