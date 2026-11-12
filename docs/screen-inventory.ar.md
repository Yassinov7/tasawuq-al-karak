# جرد صفحات تسوق — من ملفات المصدر

مرجع ثابت للترقيم؛ المصدر هو src/app وليس عناوين الترويسة القديمة. توليد: `python scripts/build-ui-foundation-inventory.py`؛ تحقق دون كتابة: `python scripts/build-ui-foundation-inventory.py --check`.

الإجمالي **65 صفحة فعلية** ضمن **114 ملف مسار**. لا يعد التبويب الداخلي أو الحوار أو وضع الإضافة/التعديل صفحة إضافية. المسار المشترك يعد مرة واحدة؛ مسارات دورين إلى مكون واحد تبقى مدخلين فعليين مختلفين.

## حدود الدليل

فحص ساكن بلا جلسات دخول أو هاتف. المكونات والخدمات أدناه وصول محافظ عبر imports/re-exports على مستوى الملف، وقد يشمل تصديرًا آخر أو مسارًا شرطيًا؛ ليس إثبات عرض أو صلاحية. ملفات الإشارة تضم الترويسات وخرائط التنقل وقد لا تكون زرًا قابلًا للضغط. المسارات الديناميكية/Push يراجعها اختبار الصفحة. الحاويات الموروثة في الملحق؛ لا تكرر قوائمها لكل صفحة. جرد JSON يضم خدمات/hooks كل صفحة وسلسلة الاعتماديات القابلة للتتبع.

## العميل — 15 صفحة

### RUI-CUS-01 — الرئيسية

- الدور: العميل. المصدر: `src/app/home/index.tsx`؛ الوجهة: `/home`.
- الوظيفة: بدء التسوق وعرض المحتوى المحلي المتاح.
- الوصول: تبويب الرئيسية. إشارات المصدر: `src/app/_layout.tsx`، `src/app/cart.tsx`، `src/app/favorites.tsx`، `src/components/navigation/AppBottomNav.tsx`، `src/lib/account-routing.ts`، `src/lib/notification-opening.ts`، `src/lib/notification-routing.ts`، `src/lib/safe-back.ts`.
- التبويب: تبويب مباشر.
- التفاصيل الموجودة/الناقصة: إعلان ممول بعد البحث واكتشاف خادمي مستقر وشعار المتجر المنشور؛ دليل docs/rui-cus-01.ar.md.
- المكونات (وصول محافظ): `src/components/home/CustomerHomeSponsored.tsx`، `src/components/marketplace/CategoryChip.tsx`، `src/components/marketplace/OfferCard.tsx`، `src/components/marketplace/ProductCard.tsx`، `src/components/marketplace/RatingStars.tsx`، `src/components/marketplace/ShoppingCardImage.tsx`، `src/components/marketplace/StoreCard.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppBadge.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppEmptyState.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppSectionHeader.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: حفظ حالة العودة من البحث، الإعلان العريض والفيديو الصامت والرفوف المدمجة. ينتظر ترحيل المصغرات واختبار الهاتف وقبول المالك.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **بانتظار اختبار الهاتف** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-CUS-02 — البحث

- الدور: العميل. المصدر: `src/app/home/search.tsx`؛ الوجهة: `/home/search`.
- الوظيفة: البحث في المنتجات والعروض وتنقيح النتائج.
- الوصول: تبويب البحث وروابط البحث. إشارات المصدر: `src/app/_layout.tsx`، `src/app/home/index.tsx`، `src/components/navigation/AppBottomNav.tsx`.
- التبويب: تبويب مباشر.
- التفاصيل الموجودة/الناقصة: ProductRefinements وSearchControls/Results وproduct-details/offer-details.
- المكونات (وصول محافظ): `src/components/marketplace/CategoryChip.tsx`، `src/components/marketplace/CustomerCatalogStatus.tsx`، `src/components/marketplace/ProductCard.tsx`، `src/components/marketplace/RatingStars.tsx`، `src/components/marketplace/ShoppingCardImage.tsx`، `src/components/marketplace/StoreCard.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/search/ProductRefinements.tsx`، `src/components/search/SearchControls.tsx`، `src/components/search/SearchEmptyState.tsx`، `src/components/search/SearchResults.tsx`، `src/components/ui/AppBadge.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppEmptyState.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: تمييز الفراغ من فشل البحث؛ استخدام الشعار المنشور حيث تظهر هوية متجر عند تطوير النتائج.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-CUS-03 — المتاجر

- الدور: العميل. المصدر: `src/app/stores.tsx`؛ الوجهة: `/stores`.
- الوظيفة: استعراض المتاجر المتاحة للعميل.
- الوصول: الرئيسية وروابط السوق. إشارات المصدر: `src/app/home/index.tsx`، `src/app/store-details.tsx`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: store-details عبر StoreCard.
- المكونات (وصول محافظ): `src/components/marketplace/CategoryChip.tsx`، `src/components/marketplace/CustomerCatalogStatus.tsx`، `src/components/marketplace/RatingStars.tsx`، `src/components/marketplace/ShoppingCardImage.tsx`، `src/components/marketplace/StoreCard.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppEmptyState.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: الأهلية والتوفر من المصدر؛ استخدام الشعار المنشور عند تطوير القائمة.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-CUS-04 — تفاصيل المتجر

- الدور: العميل. المصدر: `src/app/store-details.tsx`؛ الوجهة: `/store-details`.
- الوظيفة: عرض المتجر وكتالوجه ومراجعاته.
- الوصول: بطاقة المتجر. إشارات المصدر: `src/app/home/index.tsx`، `src/app/home/search.tsx`، `src/app/offer-details.tsx`، `src/app/product-details.tsx`، `src/app/stores.tsx`، `src/lib/customer-home-feed.ts`، `src/lib/notification-opening.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: product-details/offer-details ومراجعات داخل RatingsSection.
- المكونات (وصول محافظ): `src/components/marketplace/CategoryChip.tsx`، `src/components/marketplace/CustomerCatalogStatus.tsx`، `src/components/marketplace/OfferCard.tsx`، `src/components/marketplace/ProductCard.tsx`، `src/components/marketplace/RatingStars.tsx`، `src/components/marketplace/RatingsSection.tsx`، `src/components/marketplace/ReviewCard.tsx`، `src/components/marketplace/ReviewForm.tsx`، `src/components/marketplace/ShoppingCardImage.tsx`، `src/components/marketplace/StoreDetailsHero.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppBadge.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: استخدام الشعار المنشور؛ الفيديو المنشور عند الطلب مع إيقافه عند المغادرة وإخفاء قسمه عند غيابه؛ التنفيذ مؤجل لهذه الصفحة.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-CUS-05 — تفاصيل المنتج

- الدور: العميل. المصدر: `src/app/product-details.tsx`؛ الوجهة: `/product-details`.
- الوظيفة: اختيار المنتج والكمية وإضافته للسلة.
- الوصول: بطاقات المنتجات والبحث والمتجر والمفضلة. إشارات المصدر: `src/app/favorites.tsx`، `src/app/home/index.tsx`، `src/app/home/search.tsx`، `src/app/offer-details.tsx`، `src/app/store-details.tsx`، `src/lib/customer-home-feed.ts`، `src/lib/notification-opening.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: ProductMediaGallery/Preview ومراجعات؛ السلة مسار مستقل.
- المكونات (وصول محافظ): `src/components/marketplace/CustomerCatalogStatus.tsx`، `src/components/marketplace/ProductCard.tsx`، `src/components/marketplace/ProductMediaGallery.tsx`، `src/components/marketplace/ProductMediaPreview.tsx`، `src/components/marketplace/RatingStars.tsx`، `src/components/marketplace/RatingsSection.tsx`، `src/components/marketplace/ReviewCard.tsx`، `src/components/marketplace/ReviewForm.tsx`، `src/components/marketplace/ShoppingCardImage.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppBadge.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: الوحدة والسعر والتوفر وملاحظات الإضافة؛ عرض الوسائط حوار لا صفحة.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-CUS-06 — العروض

- الدور: العميل. المصدر: `src/app/home/offers.tsx`؛ الوجهة: `/home/offers`.
- الوظيفة: تصفح العروض المتاحة.
- الوصول: تبويب العروض. إشارات المصدر: `src/app/_layout.tsx`، `src/app/home/index.tsx`، `src/app/offer-details.tsx`، `src/components/navigation/AppBottomNav.tsx`، `src/lib/notification-opening.ts`، `src/lib/notification-routing.ts`.
- التبويب: تبويب مباشر.
- التفاصيل الموجودة/الناقصة: offer-details عبر OfferCard.
- المكونات (وصول محافظ): `src/components/marketplace/CategoryChip.tsx`، `src/components/marketplace/CustomerCatalogStatus.tsx`، `src/components/marketplace/OfferCard.tsx`، `src/components/marketplace/ShoppingCardImage.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppEmptyState.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: الانتهاء والتوفر والسعر الفعلي؛ لا لون ذهبي صغير ضعيف.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-CUS-07 — تفاصيل العرض

- الدور: العميل. المصدر: `src/app/offer-details.tsx`؛ الوجهة: `/offer-details`.
- الوظيفة: مراجعة العرض ومكوناته وإضافته للسلة.
- الوصول: بطاقة عرض. إشارات المصدر: `src/app/home/index.tsx`، `src/app/home/offers.tsx`، `src/app/store-details.tsx`، `src/lib/customer-home-feed.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: المنتجات المرتبطة والسلة؛ التفاصيل داخل الصفحة.
- المكونات (وصول محافظ): `src/components/marketplace/CustomerCatalogStatus.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: تمييز سعر العرض من السعر الأصلي وشروطه الحقيقية.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-CUS-08 — السلة

- الدور: العميل. المصدر: `src/app/cart.tsx`؛ الوجهة: `/cart`.
- الوظيفة: مراجعة عناصر المتاجر والعروض والكميات.
- الوصول: زر السلة من السوق. إشارات المصدر: `src/app/offer-details.tsx`، `src/app/product-details.tsx`، `src/components/navigation/AppHeader.tsx`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: checkout وproduct-details/offer-details.
- المكونات (وصول محافظ): `src/components/marketplace/CustomerCatalogStatus.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: تغير السعر/توفر المتجر ورسوم الطلب واضحة؛ لا حذف بيانات عند تحديث خلفي.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-CUS-09 — إتمام الطلب

- الدور: العميل. المصدر: `src/app/checkout.tsx`؛ الوجهة: `/checkout`.
- الوظيفة: مراجعة العنوان والسلة وتأكيد إنشاء الطلب.
- الوصول: السلة. إشارات المصدر: `src/app/cart.tsx`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: اختيار العنوان ضمن التدفق؛ متابعة الطلب في order-details.
- المكونات (وصول محافظ): `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: السعر قبل التأكيد مقابل لقطة السعر المثبتة بعده؛ منع إرسال مزدوج.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P0: بيانات/مال/إجراء. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-CUS-10 — طلباتي

- الدور: العميل. المصدر: `src/app/orders.tsx`؛ الوجهة: `/orders`.
- الوظيفة: قائمة طلبات العميل ومتابعتها.
- الوصول: حسابي وروابط الطلبات. إشارات المصدر: `src/app/home/account.tsx`، `src/components/navigation/AppHeader.tsx`، `src/lib/safe-back.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: order-details وفاتورة الطلب.
- المكونات (وصول محافظ): `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/LiveStatus.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: حالات ORD مفهومة وتحديث غير مزعج؛ فراغ مختلف عن فشل القراءة.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P0: بيانات/مال/إجراء. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-CUS-11 — متابعة الطلب

- الدور: العميل. المصدر: `src/app/order-details.tsx`؛ الوجهة: `/order-details`.
- الوظيفة: متابعة طلب العميل ومتاجره والتسليم.
- الوصول: طلباتي والإشعار. إشارات المصدر: `src/app/checkout.tsx`، `src/app/orders.tsx`، `src/lib/notification-opening.ts`، `src/lib/notification-routing.ts`، `src/lib/safe-back.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: فاتورة invoice؛ تتبع ضمن OrderTracking لا صفحة خرائط مفترضة.
- المكونات (وصول محافظ): `src/components/navigation/AppHeader.tsx`، `src/components/orders/OrderTracking.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/LiveStatus.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: الطلب ORD مقابل أجزاء المتاجر؛ التحديث وحالة الإلغاء.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-CUS-12 — فاتورة الطلب

- الدور: العميل. المصدر: `src/app/invoice.tsx`؛ الوجهة: `/invoice`.
- الوظيفة: فاتورة مرتبطة بطلب أو مدخل المالية عند غياب id/orderId.
- الوصول: تفاصيل طلب العميل وروابط الفاتورة. إشارات المصدر: `src/app/home/account.tsx`، `src/app/order-details.tsx`، `src/components/finance/FinanceScreen.tsx`، `src/components/finance/InvoiceScreen.tsx`، `src/lib/safe-back.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: InvoiceScreen order عند وجود المعرف؛ FinanceScreen عند غيابه؛ حالتان في مسار واحد.
- المكونات (وصول محافظ): `src/components/finance/FinanceScreen.tsx`، `src/components/finance/FinancialAccountSummary.tsx`، `src/components/finance/FinancialParts.tsx`، `src/components/finance/InvoiceScreen.tsx`، `src/components/finance/InvoiceStatus.tsx`، `src/components/finance/MerchantFinanceView.tsx`، `src/components/finance/PendingMoneyCard.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/DocumentReference.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LiveStatus.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: منع عرض مستند غير مملوك ووضوح الرجوع.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P0: بيانات/مال/إجراء. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-CUS-13 — المفضلة

- الدور: العميل. المصدر: `src/app/favorites.tsx`؛ الوجهة: `/favorites`.
- الوظيفة: الوصول إلى المنتجات المفضلة.
- الوصول: حساب العميل وروابط المفضلة. إشارات المصدر: `src/app/home/account.tsx`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: product-details.
- المكونات (وصول محافظ): `src/components/marketplace/CustomerCatalogStatus.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: التوفر وحذف المفضلة والفراغ؛ عدم ظهور مفضلة حساب سابق.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-CUS-14 — العناوين

- الدور: العميل. المصدر: `src/app/addresses.tsx`؛ الوجهة: `/addresses`.
- الوظيفة: إدارة عناوين التوصيل.
- الوصول: حسابي وتدفق إتمام الطلب. إشارات المصدر: `src/app/checkout.tsx`، `src/app/home/account.tsx`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: إضافة/تعديل العنوان ضمن الصفحة لا مسار مستقل.
- المكونات (وصول محافظ): `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: العنوان والمنطقة والحقول اللازمة ولوحة المفاتيح؛ لا إرسال بيانات موقع إلى السجلات.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-CUS-15 — حساب العميل

- الدور: العميل. المصدر: `src/app/home/account.tsx`؛ الوجهة: `/home/account`.
- الوظيفة: حساب العميل وروابط الخدمات المشتركة.
- الوصول: تبويب حسابي. إشارات المصدر: `src/app/_layout.tsx`، `src/app/notifications.tsx`، `src/components/navigation/AppBottomNav.tsx`، `src/lib/personal-account-model.ts`، `src/lib/safe-back.ts`.
- التبويب: تبويب مباشر.
- التفاصيل الموجودة/الناقصة: settings/personal-info/security والطلبات والعناوين والقانونية؛ لا /account مشترك فعلي.
- المكونات (وصول محافظ): `src/components/account/AccountMenuItem.tsx`، `src/components/account/AccountProfileHeader.tsx`، `src/components/account/AccountSection.tsx`، `src/components/account/AccountShell.tsx`، `src/components/account/SharedAccountParts.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: أسماء الوجهات وبيانات الدور والعودة.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

## التاجر — 11 صفحة

### RUI-MER-01 — الرئيسية

- الدور: التاجر. المصدر: `src/app/merchant/index.tsx`؛ الوجهة: `/merchant`.
- الوظيفة: متابعة الطلبات وأهلية المتجر؛ العدادات من operational-home وخادم الأهلية، لا من الرصيد.
- الوصول: تبويب الرئيسية. إشارات المصدر: `src/app/_layout.tsx`، `src/app/application-status.tsx`، `src/app/financial-invoice.tsx`، `src/app/merchant/_layout.tsx`، `src/components/finance/FinanceScreen.tsx`، `src/components/navigation/AppBottomNav.tsx`، `src/components/navigation/AppHeader.tsx`، `src/lib/account-routing.ts`، `src/lib/merchant-navigation.ts`، `src/lib/notification-opening.ts`، `src/lib/notification-routing.ts`، `src/lib/safe-back.ts`.
- التبويب: تبويب مباشر.
- التفاصيل الموجودة/الناقصة: طلبات مفلترة في /merchant/orders؛ الاشتراك سياق SUB- داخل المالية؛ لا حاجة لصفحة إحصاءات.
- المكونات (وصول محافظ): `src/components/home/HomeSummary.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/FinancialAmount.tsx`، `src/components/ui/LiveStatus.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: الرئيسية مقبولة نهائيًا؛ تعديل الكتالوج المدمج POST-01 بعد القبول ينتظر تحققًا بصريًا سريعًا، دون إعادة فتح المقبول.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **مغلقة** في مسار RUI؛ قبول نهائي من المالك للتصميم والوظائف والثيمين والمسافات؛ تعديل الكتالوج بعد القبول POST-01 ينتظر تحققًا بصريًا مستقلًا.

### RUI-MER-02 — طلبات المتجر

- الدور: التاجر. المصدر: `src/app/merchant/orders.tsx`؛ الوجهة: `/merchant/orders`.
- الوظيفة: إدارة أجزاء طلبات المتجر مع بحث مقيد بالرمز/رقم طلب العميل وفلاتر خادمية وتفاصيل مضمنة وإجراءات مؤكدة.
- الوصول: تبويب الطلبات وعدادات الرئيسية وإشعار الجزء المحدد. إشارات المصدر: `src/app/_layout.tsx`، `src/app/merchant/index.tsx`، `src/components/finance/MerchantInvoiceScreen.tsx`، `src/components/navigation/AppBottomNav.tsx`، `src/lib/merchant-navigation.ts`، `src/lib/notification-opening.ts`، `src/lib/notification-routing.ts`.
- التبويب: تبويب مباشر.
- التفاصيل الموجودة/الناقصة: تفاصيل بطاقة واحدة فقط عبر MerchantOrderCard داخل القائمة؛ لا مسار جديد. البحث يحتاج migration مستقلة؛ لا إعادة هيكلة لتفاصيل الإدارة.
- المكونات (وصول محافظ): `src/components/orders/MerchantOrderCard.tsx`، `src/components/orders/MerchantOrdersToolbar.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/DocumentReference.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: تصميم مدمج ببحث وفلاتر أفقية وبطاقة محايدة؛ أكد المالك تطبيق ترحيل البحث وقبول الهاتف والتصميم.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P0: بيانات/مال/إجراء. الحالة: **مغلقة** في مسار RUI؛ أكد المالك نجاح جميع اختبارات الهاتف وقبول الوظائف والتصميم وتطبيق ترحيل البحث في 11 نوفمبر 2026.

### RUI-MER-03 — مالية التاجر

- الدور: التاجر. المصدر: `src/app/merchant/finance.tsx`؛ الوجهة: `/merchant/finance`.
- الوظيفة: عرض مستحقات التاجر وفواتيره والاشتراك.
- الوصول: تبويب المالية وحسابي ورابط الاشتراك. إشارات المصدر: `src/app/merchant/financial-ledger-details.tsx`، `src/app/merchant/financial-ledger.tsx`، `src/app/merchant/financial-sale-details.tsx`، `src/app/merchant/financial-sales.tsx`، `src/app/merchant/index.tsx`، `src/app/merchant/sales-commissions.tsx`، `src/app/merchant/settlement-details.tsx`، `src/app/merchant/settlements.tsx`، `src/app/merchant/subscription-invoice-details.tsx`، `src/app/merchant/subscription-invoices.tsx`، `src/app/merchant/subscription-payment-details.tsx`، `src/app/merchant/subscription-payments.tsx`، `src/app/merchant/subscription.tsx`، `src/components/finance/FinanceScreen.tsx`، `src/components/finance/MerchantInvoiceScreen.tsx`، `src/components/merchant/MerchantAccountScreens.tsx`، `src/components/navigation/AppBottomNav.tsx`، `src/lib/merchant-navigation.ts`، `src/lib/notification-opening.ts`، `src/lib/notification-routing.ts`، `src/lib/safe-back.ts`.
- التبويب: تبويب مباشر.
- التفاصيل الموجودة/الناقصة: التفاصيل /financial-invoice؛ رابط SUB- يفعّل فلتر الاشتراك؛ قائمة مرقمة بعشر فواتير.
- المكونات (وصول محافظ): `src/components/finance/FinanceScreen.tsx`، `src/components/finance/FinancialAccountSummary.tsx`، `src/components/finance/FinancialParts.tsx`، `src/components/finance/InvoiceStatus.tsx`، `src/components/finance/MerchantFinanceView.tsx`، `src/components/finance/PendingMoneyCard.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/DocumentReference.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LiveStatus.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: رصيد ثنائي الاتجاه وصافٍ واضح، مبلغ الاشتراك، قائمة مضغوطة بحالة المستند والسداد؛ التحقق من ملكية الرد والمحاولة المحفوظة.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P0: بيانات/مال/إجراء. الحالة: **مغلقة** في مسار RUI؛ المالك أكد نجاح اختبار الهاتف النهائي وأغلق RUI-MER-03.01 والمالية.

### RUI-MER-04 — الكتالوج

- الدور: التاجر. المصدر: `src/app/merchant/catalog.tsx`؛ الوجهة: `/merchant/catalog`.
- الوظيفة: تنظيم كتالوج المنتجات والعروض.
- الوصول: تبويب الكتالوج. إشارات المصدر: `src/app/_layout.tsx`، `src/app/merchant/offers.tsx`، `src/app/merchant/products.tsx`، `src/components/merchant/MerchantAddProduct.tsx`، `src/components/merchant/MerchantEditProduct.tsx`، `src/components/merchant/MerchantOfferEditor.tsx`، `src/components/navigation/AppBottomNav.tsx`، `src/lib/merchant-navigation.ts`.
- التبويب: تبويب مباشر.
- التفاصيل الموجودة/الناقصة: عرض مدمج من MerchantCatalogPanel بحسب تبويب الرابط؛ إضافة وتعديل عبر المحررين الحاليين.
- المكونات (وصول محافظ): `src/components/merchant/MerchantCatalogPanel.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: فراغ المنتجات والعروض والفلاتر وحالة النشر.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **مغلقة** في مسار RUI؛ قبول نهائي لتصميم الكتالوج ووظائفه بعد اختبار الهاتف.

### RUI-MER-06 — إضافة وتعديل منتج

- الدور: التاجر. المصدر: `src/app/merchant/product-editor.tsx`؛ الوجهة: `/merchant/product-editor`.
- الوظيفة: إنشاء منتج أو تعديل منتج يملكه المتجر بحسب id.
- الوصول: المنتجات والكتالوج. إشارات المصدر: `src/app/merchant/index.tsx`، `src/components/merchant/MerchantCatalogPanel.tsx`، `src/lib/merchant-navigation.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: MerchantAddProduct/MerchantEditProduct وMerchantProductForm؛ اختيار فئة ووحدة ووسائط داخل النموذج.
- المكونات (وصول محافظ): `src/components/merchant/MerchantAddProduct.tsx`، `src/components/merchant/MerchantCategorySelect.tsx`، `src/components/merchant/MerchantEditProduct.tsx`، `src/components/merchant/MerchantProductForm.tsx`، `src/components/merchant/SellingUnitSelect.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: فصل الحفظ الجاري عن تحميل المنتج؛ حقول السعر والوحدة والصور ولوحة المفاتيح.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **مغلقة** في مسار RUI؛ قبول نهائي لمحرر المنتج المشترك بعد اختبار الهاتف.

### RUI-MER-08 — إضافة وتعديل عرض

- الدور: التاجر. المصدر: `src/app/merchant/offer-editor.tsx`؛ الوجهة: `/merchant/offer-editor`.
- الوظيفة: إنشاء أو تعديل عرض المتجر بحسب id.
- الوصول: العروض والكتالوج. إشارات المصدر: `src/app/merchant/index.tsx`، `src/components/merchant/MerchantCatalogPanel.tsx`، `src/lib/merchant-navigation.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: MerchantOfferEditor/Form وOfferExpirationPicker؛ ليست صفحة إنشاء وأخرى تعديل.
- المكونات (وصول محافظ): `src/components/merchant/MerchantCategorySelect.tsx`، `src/components/merchant/MerchantOfferEditor.tsx`، `src/components/merchant/MerchantOfferForm.tsx`، `src/components/merchant/MerchantProductForm.tsx`، `src/components/merchant/OfferExpirationPicker.tsx`، `src/components/merchant/SellingUnitSelect.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: انتهاء العرض ونطاقه والتحقق من السعر؛ لا نجاح قبل تأكيد الحفظ.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **مغلقة** في مسار RUI؛ أغلق المالك محرر العرض بعد نجاح اختبار الهاتف.

### RUI-MER-09 — بيانات المتجر

- الدور: التاجر. المصدر: `src/app/merchant/store-info.tsx`؛ الوجهة: `/merchant/store-info`.
- الوظيفة: تحرير معلومات وهوية المتجر.
- الوصول: حساب التاجر. إشارات المصدر: `src/app/merchant/index.tsx`، `src/components/merchant/MerchantAccountScreens.tsx`، `src/lib/merchant-navigation.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: MerchantStoreBranding ضمن بيانات المتجر.
- المكونات (وصول محافظ): `src/components/merchant/MerchantStoreBranding.tsx`، `src/components/merchant/MerchantStoreInfo.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: عرض الخطأ لكل حقل/وسائط والحفاظ على المدخلات؛ حالة الحفظ.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **مغلقة** في مسار RUI؛ أغلق المالك بيانات المتجر بعد نجاح اختبار الهاتف.

### RUI-MER-10 — حساب التاجر

- الدور: التاجر. المصدر: `src/app/merchant/account.tsx`؛ الوجهة: `/merchant/account`.
- الوظيفة: روابط حساب التاجر وبياناته المهنية.
- الوصول: تبويب حسابي. إشارات المصدر: `src/app/_layout.tsx`، `src/app/notifications.tsx`، `src/components/account/SecurityScreen.tsx`، `src/components/merchant/MerchantStoreInfo.tsx`، `src/components/navigation/AppBottomNav.tsx`، `src/lib/merchant-navigation.ts`، `src/lib/personal-account-model.ts`.
- التبويب: تبويب مباشر.
- التفاصيل الموجودة/الناقصة: بيانات المتجر والمعلومات الشخصية والإعدادات والخصوصية والأمان وحول التطبيق؛ الاشتراك إلى finance مع SUB-.
- المكونات (وصول محافظ): `src/components/account/AccountMenuItem.tsx`، `src/components/account/AccountProfileHeader.tsx`، `src/components/account/AccountSection.tsx`، `src/components/account/AccountShell.tsx`، `src/components/account/PersonalInfoScreen.tsx`، `src/components/account/SharedAccountParts.tsx`، `src/components/merchant/MerchantAccountScreens.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: مطابقة عنوان الاشتراك للوجهة دون صفحة اشتراك وهمية.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **مغلقة** في مسار RUI؛ أغلق المالك حساب التاجر بعد نجاح اختبار الهاتف.

### RUI-MER-11 — بيانات التاجر الشخصية

- الدور: التاجر. المصدر: `src/app/merchant/personal-info.tsx`؛ الوجهة: `/merchant/personal-info`.
- الوظيفة: عرض وتحرير البيانات الشخصية اللازمة.
- الوصول: حساب التاجر. إشارات المصدر: `src/components/account/SharedAccountParts.tsx`، `src/components/merchant/MerchantAccountScreens.tsx`، `src/lib/merchant-navigation.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: MerchantAccountScreens يستخدم الهيكل المشترك؛ لا صفحة إضافية لكل حقل.
- المكونات (وصول محافظ): `src/components/account/AccountMenuItem.tsx`، `src/components/account/AccountProfileHeader.tsx`، `src/components/account/AccountSection.tsx`، `src/components/account/AccountShell.tsx`، `src/components/account/PersonalInfoScreen.tsx`، `src/components/account/SharedAccountParts.tsx`، `src/components/merchant/MerchantAccountScreens.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: تاريخ الميلاد والحقول القابلة للتحرير والتحقق؛ لا جمع معلومات إضافية.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **مغلقة** في مسار RUI؛ أغلق المالك بيانات التاجر الشخصية بعد نجاح اختبار الهاتف.

### RUI-MER-12 — إعدادات التاجر

- الدور: التاجر. المصدر: `src/app/merchant/settings.tsx`؛ الوجهة: `/merchant/settings`.
- الوظيفة: إعدادات حساب التاجر والعرض.
- الوصول: حساب التاجر. إشارات المصدر: `src/components/account/SharedAccountParts.tsx`، `src/components/merchant/MerchantAccountScreens.tsx`، `src/lib/merchant-navigation.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: SettingsScreen بنمط المظهر فقط؛ الخصوصية وحول التطبيق ضمن حساب التاجر.
- المكونات (وصول محافظ): `src/components/account/SettingsScreen.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/SyriaFlag.tsx`.
- النصوص والحالات: الثيم والتفضيلات الفعلية فقط؛ لا إضافة خيارات غير مستخدمة.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **مغلقة** في مسار RUI؛ أغلق المالك إعدادات التاجر بعد اختبار إعادة التنظيم.

### RUI-MER-13 — أمان حساب التاجر

- الدور: التاجر. المصدر: `src/app/merchant/security.tsx`؛ الوجهة: `/merchant/security`.
- الوظيفة: إدارة كلمة المرور والأمان المتاح.
- الوصول: حساب التاجر. إشارات المصدر: `src/components/account/SettingsScreen.tsx`، `src/components/account/SharedAccountParts.tsx`، `src/components/merchant/MerchantAccountScreens.tsx`، `src/lib/merchant-navigation.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: SecurityScreen؛ النموذج داخل الصفحة.
- المكونات (وصول محافظ): `src/components/account/AccountMenuItem.tsx`، `src/components/account/AccountProfileHeader.tsx`، `src/components/account/AccountSection.tsx`، `src/components/account/AccountShell.tsx`، `src/components/account/SecurityScreen.tsx`، `src/components/account/SharedAccountParts.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: تأكيد الحفظ والتحقق من كلمة المرور؛ لا ادعاء وسائل أمان غير منفذة.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **مغلقة** في مسار RUI؛ أغلق المالك أمان التاجر بعد نجاح اختبار الهاتف.

## السائق — 7 صفحة

### RUI-DRV-01 — الرئيسية

- الدور: السائق. المصدر: `src/app/driver/index.tsx`؛ الوجهة: `/driver`.
- الوظيفة: متابعة التوفر والمهمات المتاحة والمسندة.
- الوصول: تبويب الرئيسية وإشعار taskId. إشارات المصدر: `src/app/_layout.tsx`، `src/app/application-status.tsx`، `src/components/finance/FinanceScreen.tsx`، `src/components/navigation/AppBottomNav.tsx`، `src/components/navigation/AppHeader.tsx`، `src/lib/account-routing.ts`، `src/lib/notification-opening.ts`، `src/lib/notification-routing.ts`، `src/lib/safe-back.ts`.
- التبويب: تبويب مباشر.
- التفاصيل الموجودة/الناقصة: مهمة حالية تفتح توصيلاتي، صفوف قبول المهام المتاحة، ومؤشرا التوريد والمستحق منفصلان.
- المكونات (وصول محافظ): `src/components/driver/DriverTaskLocation.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/FinancialAmount.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: عدم تحويل كل تحديث إلى تحميل كامل؛ FIX-DRV-01 مقبول ولا يعاد بناؤه.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **مغلقة** في مسار RUI؛ أغلق المالك رئيسية السائق بعد نجاح اختبار الهاتف.

### RUI-DRV-02 — توصيلاتي

- الدور: السائق. المصدر: `src/app/driver/orders.tsx`؛ الوجهة: `/driver/orders`.
- الوظيفة: متابعة المهمات المسندة.
- الوصول: تبويب توصيلاتي؛ الرابط القديم بمعرّف المهمة يوجّه إلى التفاصيل. إشارات المصدر: `src/app/_layout.tsx`، `src/app/driver/index.tsx`، `src/components/navigation/AppBottomNav.tsx`، `src/lib/notification-opening.ts`، `src/lib/notification-routing.ts`، `src/lib/safe-back.ts`.
- التبويب: تبويب مباشر.
- التفاصيل الموجودة/الناقصة: بحث TSK وفلاتر الجارية والمكتملة وترقيم خادمي؛ البطاقات تفتح RUI-DRV-02.01.
- المكونات (وصول محافظ): `src/components/driver/DriverTaskLocation.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/FinancialAmount.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: مرجع المهمة، وجهة مختصرة، الحفاظ على سياق القائمة.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P0: بيانات/مال/إجراء. الحالة: **مغلقة** في مسار RUI؛ أكد المالك تطبيق ترحيل البحث في Production وقبوله النهائي على الهاتف.

### RUI-DRV-02.01 — تفاصيل مهمة التوصيل

- الدور: السائق. المصدر: `src/app/driver/task-details.tsx`؛ الوجهة: `/driver/task-details`.
- الوظيفة: الاستلام والتسليم والتحصيل للمهمة المسندة.
- الوصول: بطاقات الرئيسية وتوصيلاتي والتنبيهات المملوكة أو الرابط المباشر بمعرّف المهمة. إشارات المصدر: `src/app/driver/index.tsx`، `src/app/driver/orders.tsx`، `src/lib/notification-opening.ts`، `src/lib/notification-routing.ts`، `src/lib/safe-back.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: صفحة فرعية مستقلة RUI-DRV-02.01؛ تأكيد التسليم يستخدم الحوار المشترك.
- المكونات (وصول محافظ): `src/components/driver/DriverTaskLocation.tsx`، `src/components/driver/StorePickupPanel.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/FinancialAmount.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: صلاحية المهمة، إخفاء بيانات المستلم بعد التسليم، استعادة نتيجة التحصيل.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P0: بيانات/مال/إجراء. الحالة: **مغلقة** في مسار RUI؛ أكد المالك نجاح اختبار الوظائف وفوّض الإغلاق بعد فحوص اللمسات البصرية.

### RUI-DRV-03 — مالية السائق

- الدور: السائق. المصدر: `src/app/driver/cash-account.tsx`؛ الوجهة: `/driver/cash-account`.
- الوظيفة: متابعة النقد الواجب توريده ومستحقات الأجور والمستندات.
- الوصول: تبويب المالية ورابط الحساب في الرئيسية. إشارات المصدر: `src/app/_layout.tsx`، `src/app/driver/account.tsx`، `src/app/driver/index.tsx`، `src/components/finance/FinanceScreen.tsx`، `src/components/navigation/AppBottomNav.tsx`، `src/lib/safe-back.ts`.
- التبويب: تبويب مباشر.
- التفاصيل الموجودة/الناقصة: قالب عرض موحد مع مالية التاجر؛ بحث وفلاتر أفقية وترقيم خادمي وتفاصيل مشتركة.
- المكونات (وصول محافظ): `src/components/finance/FinancialParts.tsx`، `src/components/finance/InvoiceStatus.tsx`، `src/components/finance/MerchantFinanceView.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/DocumentReference.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: رصيدان مستقلان؛ أكد المالك الترحيل واختبار الهاتف والقبول.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P0: بيانات/مال/إجراء. الحالة: **مغلقة** في مسار RUI؛ أكد المالك تطبيق الترحيل في Production وقبول المالية والعرض المشترك على الهاتف.

### RUI-DRV-04 — حساب السائق

- الدور: السائق. المصدر: `src/app/driver/account.tsx`؛ الوجهة: `/driver/account`.
- الوظيفة: بيانات الحساب والمعلومات المهنية.
- الوصول: تبويب حسابي. إشارات المصدر: `src/app/_layout.tsx`، `src/app/driver/credentials.tsx`، `src/app/driver/settings.tsx`، `src/app/notifications.tsx`، `src/components/navigation/AppBottomNav.tsx`، `src/lib/personal-account-model.ts`.
- التبويب: تبويب مباشر.
- التفاصيل الموجودة/الناقصة: هوية مختصرة وحالة الاعتماد؛ روابط الاعتماد والمالية والحساب والخصوصية وحول التطبيق.
- المكونات (وصول محافظ): `src/components/account/AccountMenuItem.tsx`، `src/components/account/AccountProfileHeader.tsx`، `src/components/account/AccountSection.tsx`، `src/components/account/AccountShell.tsx`، `src/components/account/DriverProfessionalInfo.tsx`، `src/components/account/SharedAccountParts.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: ترتيب الروابط وحوار الخروج المشترك.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **بانتظار اختبار الهاتف** في مسار RUI؛ مكتملة برمجيًا وتنتظر اختبار المالك وقبوله.

### RUI-DRV-04.01 — بيانات الاعتماد

- الدور: السائق. المصدر: `src/app/driver/credentials.tsx`؛ الوجهة: `/driver/credentials`.
- الوظيفة: عرض بيانات اعتماد السائق للقراءة فقط.
- الوصول: حساب السائق أو رابط مباشر تحت حارس الدور. إشارات المصدر: `src/app/driver/account.tsx`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: حالة الاعتماد والاسم المهني وهاتف العمل والمركبة وأوقات التوفر.
- المكونات (وصول محافظ): `src/components/account/AccountSection.tsx`، `src/components/account/AccountShell.tsx`، `src/components/account/DriverProfessionalInfo.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: عزل الحساب وحالة الاعتماد غير المؤكدة والرجوع.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **بانتظار اختبار الهاتف** في مسار RUI؛ مكتملة برمجيًا وتنتظر اختبار المالك وقبوله.

### RUI-DRV-04.02 — إعدادات السائق

- الدور: السائق. المصدر: `src/app/driver/settings.tsx`؛ الوجهة: `/driver/settings`.
- الوظيفة: تفضيل مظهر التطبيق للسائق.
- الوصول: حساب السائق أو رابط مباشر تحت حارس الدور. إشارات المصدر: `src/app/driver/account.tsx`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: نفس مكوّن إعدادات التاجر بوضع المظهر فقط.
- المكونات (وصول محافظ): `src/components/account/SettingsScreen.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/SyriaFlag.tsx`.
- النصوص والحالات: التلقائي والفاتح والداكن وحفظ التفضيل والرجوع.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **بانتظار اختبار الهاتف** في مسار RUI؛ مكتملة برمجيًا وتنتظر اختبار المالك وقبوله.

## الإدارة — 15 صفحة

### RUI-ADM-01 — الرئيسية

- الدور: الإدارة. المصدر: `src/app/admin/index.tsx`؛ الوجهة: `/admin`.
- الوظيفة: لوحة متابعة تشغيلية للانضمام والطلبات التي تحتاج تدخلًا.
- الوصول: تبويب الرئيسية. إشارات المصدر: `src/app/admin/_layout.tsx`، `src/app/notifications.tsx`، `src/components/finance/FinanceScreen.tsx`، `src/components/navigation/AppBottomNav.tsx`، `src/lib/account-routing.ts`، `src/lib/notification-opening.ts`، `src/lib/notification-routing.ts`، `src/lib/safe-back.ts`.
- التبويب: تبويب مباشر.
- التفاصيل الموجودة/الناقصة: عدادات تؤدي إلى التطبيقات والطلبات بفلاترها؛ المالية ليست إجراءً حساسًا في الرئيسية.
- المكونات (وصول محافظ): `src/components/home/HomeSummary.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/LiveStatus.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: أعداد exact من المصدر لا طول صفحة؛ UI-02 ينتظر الترحيل والقبول.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-ADM-02 — الطلبات

- الدور: الإدارة. المصدر: `src/app/admin/orders.tsx`؛ الوجهة: `/admin/orders`.
- الوظيفة: متابعة طلبات العملاء والتدخل بصلاحية الإدارة.
- الوصول: تبويب الطلبات وملخص الرئيسية. إشارات المصدر: `src/app/admin/_layout.tsx`، `src/app/admin/index.tsx`، `src/components/navigation/AppBottomNav.tsx`.
- التبويب: تبويب مباشر.
- التفاصيل الموجودة/الناقصة: admin/order-details؛ admin/requests اسم توافق لنفس الصفحة.
- المكونات (وصول محافظ): `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/LiveStatus.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: وضوح الحالة والفلتر وسبب التدخل؛ عدم إسقاط أدوات التاجر على الإدارة.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P0: بيانات/مال/إجراء. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-ADM-03 — تفاصيل الطلب

- الدور: الإدارة. المصدر: `src/app/admin/order-details.tsx`؛ الوجهة: `/admin/order-details`.
- الوظيفة: تفاصيل الطلب ومتاجره والتوصيل والإجراءات الإدارية.
- الوصول: قائمة الطلبات وإشعار الطلب. إشارات المصدر: `src/app/admin/_layout.tsx`، `src/components/admin/C3DeliverySettings.tsx`، `src/components/navigation/AppBottomNav.tsx`، `src/lib/notification-opening.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: تفاصيل ضمن هذه الصفحة وروابط الفاتورة/المهمة بحسب المصدر؛ لا منح صلاحية بالرمز.
- المكونات (وصول محافظ): `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/LiveStatus.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: الرجوع المباشر وحالة الإلغاء/عدم الصلاحية وقفل الإجراء.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-ADM-04 — طلبات الانضمام

- الدور: الإدارة. المصدر: `src/app/admin/applications.tsx`؛ الوجهة: `/admin/applications`.
- الوظيفة: قائمة طلبات التجار والسائقين.
- الوصول: تبويب الانضمام وعدادات الرئيسية. إشارات المصدر: `src/app/admin/_layout.tsx`، `src/app/admin/index.tsx`، `src/components/navigation/AppBottomNav.tsx`.
- التبويب: تبويب مباشر.
- التفاصيل الموجودة/الناقصة: admin/application-details.
- المكونات (وصول محافظ): `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/LiveStatus.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: نوع الطلب وحالته وطلبات تنتظر مراجعة؛ لا إجمالي من العناصر المحملة.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P0: بيانات/مال/إجراء. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-ADM-05 — مراجعة طلب الانضمام

- الدور: الإدارة. المصدر: `src/app/admin/application-details.tsx`؛ الوجهة: `/admin/application-details`.
- الوظيفة: مراجعة بيانات الانضمام والخطة المختارة والقرار.
- الوصول: قائمة الانضمام وإشعار مسموح. إشارات المصدر: `src/app/admin/_layout.tsx`، `src/lib/notification-opening.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: تفاصيل المهنة والخطة ضمن الصفحة؛ لا إعادة اختيار خطة نيابة عن التاجر.
- المكونات (وصول محافظ): `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LiveStatus.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: نتيجة الموافقة وفاتورة الاشتراك لا تعني السداد.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P0: بيانات/مال/إجراء. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-ADM-06 — مالية الإدارة

- الدور: الإدارة. المصدر: `src/app/admin/finance.tsx`؛ الوجهة: `/admin/finance`.
- الوظيفة: حسابات الأطراف والخزينة والفواتير والتسويات والتحقق.
- الوصول: تبويب المالية وروابط ثانوية. إشارات المصدر: `src/app/admin/_layout.tsx`، `src/app/admin/cash-movement-report.tsx`، `src/app/admin/commission-details.tsx`، `src/app/admin/commissions.tsx`، `src/app/admin/create-merchant-settlement.tsx`، `src/app/admin/credit-details.tsx`، `src/app/admin/credit.tsx`، `src/app/admin/delivery-fees-report.tsx`، `src/app/admin/driver-custody-details.tsx`، `src/app/admin/driver-custody-report.tsx`، `src/app/admin/driver-custody.tsx`، `src/app/admin/finance-reconciliation.tsx`، `src/app/admin/finance-transition.tsx`، `src/app/admin/financial-indicators.tsx`، `src/app/admin/financial-reports.tsx`، `src/app/admin/index.tsx`، `src/app/admin/invoice-details.tsx`، `src/app/admin/invoices.tsx`، `src/app/admin/ledger-details.tsx`، `src/app/admin/ledger.tsx`، `src/app/admin/merchant-finance.tsx`، `src/app/admin/merchant-payouts-report.tsx`، `src/app/admin/merchant-settlement-details.tsx`، `src/app/admin/merchant-settlements.tsx`، `src/app/admin/more.tsx`، `src/app/admin/payment-details.tsx`، `src/app/admin/payments.tsx`، `src/app/admin/platform-revenue-report.tsx`، `src/app/admin/subscription-details.tsx`، `src/app/admin/subscriptions.tsx`، `src/app/admin/treasury.tsx`، `src/components/navigation/AppBottomNav.tsx`، `src/lib/safe-back.ts`.
- التبويب: تبويب مباشر.
- التفاصيل الموجودة/الناقصة: تفاصيل /financial-invoice؛ SET/COR من سياق معلوم؛ المسارات المالية القديمة تحويلات وليست شاشات؛ الفصل المستقبلي حسب UI-03 وحاجة كل قائمة.
- المكونات (وصول محافظ): `src/components/finance/FinanceScreen.tsx`، `src/components/finance/FinancialAccountSummary.tsx`، `src/components/finance/FinancialParts.tsx`، `src/components/finance/InvoiceStatus.tsx`، `src/components/finance/MerchantFinanceView.tsx`، `src/components/finance/PendingMoneyCard.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/DocumentReference.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LiveStatus.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: فصل نقد الخزينة عن المستحقات؛ الطرف/المبلغ/المرجع في غير المحسوم؛ لا WAG في تشغيل الإطلاق.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P0: بيانات/مال/إجراء. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-ADM-07 — المتاجر

- الدور: الإدارة. المصدر: `src/app/admin/stores.tsx`؛ الوجهة: `/admin/stores`.
- الوظيفة: قائمة المتاجر الإدارية وحالاتها.
- الوصول: المزيد. إشارات المصدر: `src/app/admin/_layout.tsx`، `src/app/admin/more.tsx`، `src/components/navigation/AppBottomNav.tsx`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: admin/store-details.
- المكونات (وصول محافظ): `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: البحث والحالة والفراغ؛ تمييز الموافقة عن أهلية استقبال الطلبات.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-ADM-08 — تفاصيل المتجر

- الدور: الإدارة. المصدر: `src/app/admin/store-details.tsx`؛ الوجهة: `/admin/store-details`.
- الوظيفة: مراجعة متجر وأدوات الإدارة المسموحة.
- الوصول: قائمة المتاجر. إشارات المصدر: `src/app/admin/_layout.tsx`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: بيانات المتجر والإجراءات في الصفحة؛ المالية الحديثة في admin/finance.
- المكونات (وصول محافظ): `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: مرجع المتجر وحالته ونتيجة الإجراء؛ لا استنتاج الأهلية من رصيد.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-ADM-09 — السائقون

- الدور: الإدارة. المصدر: `src/app/admin/drivers.tsx`؛ الوجهة: `/admin/drivers`.
- الوظيفة: قائمة السائقين وإدارتهم.
- الوصول: المزيد. إشارات المصدر: `src/app/admin/_layout.tsx`، `src/app/admin/more.tsx`، `src/components/navigation/AppBottomNav.tsx`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: admin/driver-details.
- المكونات (وصول محافظ): `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: التوفر والحالة والبحث ورفض الصلاحية.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-ADM-10 — تفاصيل السائق

- الدور: الإدارة. المصدر: `src/app/admin/driver-details.tsx`؛ الوجهة: `/admin/driver-details`.
- الوظيفة: مراجعة معلومات السائق المهنية وإدارته.
- الوصول: قائمة السائقين. إشارات المصدر: `src/app/admin/_layout.tsx`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: تفاصيل مهنية وأدوات داخل الصفحة؛ الحساب المالي في المالية.
- المكونات (وصول محافظ): `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: توضيح التوفر مقابل حالة الانضمام؛ لا كشف بيانات سائق لحساب آخر.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-ADM-11 — خطط الاشتراك

- الدور: الإدارة. المصدر: `src/app/admin/plans.tsx`؛ الوجهة: `/admin/plans`.
- الوظيفة: إدارة خطط اشتراك التجار.
- الوصول: أدوات الإدارة/المالية حسب الروابط الحالية. إشارات المصدر: `src/app/admin/_layout.tsx`، `src/components/finance/FinanceScreen.tsx`، `src/components/navigation/AppBottomNav.tsx`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: admin/plan-form بحسب id.
- المكونات (وصول محافظ): `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: الخطة والتكلفة ودورية الاشتراك وحالتها؛ لا تغيير شروط تجارية لأجل التصميم.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-ADM-12 — إضافة وتعديل خطة

- الدور: الإدارة. المصدر: `src/app/admin/plan-form.tsx`؛ الوجهة: `/admin/plan-form`.
- الوظيفة: إنشاء وتعديل خطة اشتراك.
- الوصول: قائمة الخطط. إشارات المصدر: `src/app/admin/_layout.tsx`، `src/components/navigation/AppBottomNav.tsx`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: وضعا إنشاء وتعديل داخل المسار نفسه.
- المكونات (وصول محافظ): `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: وحدات السعر والتحقق وملخص قبل الحفظ؛ المالك يحسم أي تغيير تجاري.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-ADM-13 — المزيد وأدوات الإدارة

- الدور: الإدارة. المصدر: `src/app/admin/more.tsx`؛ الوجهة: `/admin/more`.
- الوظيفة: الوصول إلى أدوات الإدارة والحساب.
- الوصول: تبويب المزيد. إشارات المصدر: `src/app/admin/_layout.tsx`، `src/app/admin/index.tsx`، `src/components/navigation/AppBottomNav.tsx`، `src/lib/personal-account-model.ts`.
- التبويب: تبويب مباشر.
- التفاصيل الموجودة/الناقصة: المتاجر والسائقون والخطط والحساب والإعدادات؛ C3DeliverySettings مدمج وليس صفحة مستقلة.
- المكونات (وصول محافظ): `src/components/account/AccountMenuItem.tsx`، `src/components/account/AccountProfileHeader.tsx`، `src/components/account/AccountSection.tsx`، `src/components/account/AccountShell.tsx`، `src/components/account/SharedAccountParts.tsx`، `src/components/admin/C3DeliverySettings.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: لا تكرار كل التبويبات؛ أسماء أدوات واضحة.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-ADM-14 — إدارة التصنيفات

- الدور: الإدارة. المصدر: `src/app/admin/categories.tsx`؛ الوجهة: `/admin/categories`.
- الوظيفة: إدارة التصنيفات المركزية للمتاجر والمنتجات.
- الوصول: المزيد ← إدارة التصنيفات؛ حساب الإدارة. إشارات المصدر: `src/app/admin/_layout.tsx`، `src/app/admin/more.tsx`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: الشجرة والبحث ونموذج الإضافة والتعديل داخل الصفحة؛ SYS-CAT-01.04.
- المكونات (وصول محافظ): `src/components/admin/AdminCategoriesScreen.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: حالة التفعيل وأثر تعطيل الأب وأسباب تعذر الحذف.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **مغلقة** في مسار RUI؛ قبل المالك لوحة SYS-CAT-01.04 نهائيًا بعد اختبار الهاتف.

### RUI-ADM-15 — إعلانات الرئيسية

- الدور: الإدارة. المصدر: `src/app/admin/home-ads.tsx`؛ الوجهة: `/admin/home-ads`.
- الوظيفة: إدارة إعلانات الرئيسية ضمن SYS-ADS-01.
- الوصول: المزيد ← إعلانات الرئيسية؛ حساب الإدارة. إشارات المصدر: `src/app/admin/_layout.tsx`، `src/app/admin/more.tsx`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: الرفع والمعاينة والتحرير داخل الصفحة؛ يتطلب ترحيل الإعلانات.
- المكونات (وصول محافظ): `src/components/admin/HomeAdTargetPicker.tsx`، `src/components/marketplace/ShoppingCardImage.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: نفذ الأساس البرمجي؛ التطبيق على Supabase واختبار الهاتف معلقان.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **بانتظار اختبار الهاتف** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

## مشتركة بحسب صلاحية الحساب — 6 صفحة

### RUI-SHR-01 — الإشعارات

- الدور: مشتركة بحسب صلاحية الحساب. المصدر: `src/app/notifications.tsx`؛ الوجهة: `/notifications`.
- الوظيفة: قراءة إشعارات الحساب وفتح المرجع المسموح.
- الوصول: جرس الترويسة والحساب وتفاعل Push. إشارات المصدر: `src/app/driver/account.tsx`، `src/app/home/account.tsx`، `src/components/merchant/MerchantAccountScreens.tsx`، `src/components/navigation/AppHeader.tsx`، `src/lib/safe-back.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: تنقل آمن إلى الطلب/المهمة/الفاتورة؛ لا صفحة إعدادات Push جديدة لازمة.
- المكونات (وصول محافظ): `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/LiveStatus.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: غير المقروء إجمالي مستقل؛ لا بيانات حساسة في Push؛ UX-05 ما زال ينتظر الإعداد والأجهزة.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-SHR-02 — تفاصيل الفاتورة المالية

- الدور: مشتركة بحسب صلاحية الحساب. المصدر: `src/app/financial-invoice.tsx`؛ الوجهة: `/financial-invoice`.
- الوظيفة: عرض مستند مالي وسداده وروابطه وإجراءات الإدارة المسموحة.
- الوصول: صفوف الفواتير والإشعارات بعد تحقق ملكية. إشارات المصدر: `src/app/driver/cash-account.tsx`، `src/components/finance/FinanceScreen.tsx`، `src/components/finance/InvoiceScreen.tsx`، `src/components/finance/MerchantInvoiceScreen.tsx`، `src/components/finance/PendingMoneyCard.tsx`، `src/lib/notification-opening.ts`، `src/lib/safe-back.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: مسار مشترك مع MerchantInvoiceScreen للتاجر وInvoiceScreen للأدوار الأخرى.
- المكونات (وصول محافظ): `src/components/finance/FinancialParts.tsx`، `src/components/finance/InvoiceScreen.tsx`، `src/components/finance/InvoiceStatus.tsx`، `src/components/finance/MerchantInvoiceScreen.tsx`، `src/components/finance/PendingMoneyCard.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/DocumentReference.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LiveStatus.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: مستند مؤكد لا يعني مدفوعًا؛ فتح التفاصيل لا ينشئ عملية.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P0: بيانات/مال/إجراء. الحالة: **مغلقة لعرض التاجر** في مسار RUI؛ قبول نهائي لعرض التاجر بحسب اختبار المالك.

### RUI-SHR-03 — مدخل الحساب المالي المشترك

- الدور: مشتركة بحسب صلاحية الحساب. المصدر: `src/app/wallet.tsx`؛ الوجهة: `/wallet`.
- الوظيفة: مدخل إضافي إلى FinanceScreen الحالية.
- الوصول: روابط توافق/الحساب إن وجدت؛ ليست محفظة مالية قديمة. إشارات المصدر: `src/components/finance/FinanceScreen.tsx`، `src/lib/account-routing.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: نفس FinanceScreen؛ لا نظام مالي ثان ولا صفحة محفظة جديدة.
- المكونات (وصول محافظ): `src/components/finance/FinanceScreen.tsx`، `src/components/finance/FinancialAccountSummary.tsx`، `src/components/finance/FinancialParts.tsx`، `src/components/finance/InvoiceStatus.tsx`، `src/components/finance/MerchantFinanceView.tsx`، `src/components/finance/PendingMoneyCard.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/DocumentReference.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LiveStatus.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: مراجعة ضرورة المدخل واسم المحفظة مع مستهلكيه قبل أي إزالة.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-SHR-04 — الإعدادات

- الدور: مشتركة بحسب صلاحية الحساب. المصدر: `src/app/settings.tsx`؛ الوجهة: `/settings`.
- الوظيفة: تعديل تفضيلات الحساب والعرض.
- الوصول: حساب العميل/السائق/الإدارة. إشارات المصدر: `src/components/account/SharedAccountParts.tsx`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: SettingsScreen؛ لا إعداد مستقل لكل دور مطلوب.
- المكونات (وصول محافظ): `src/components/account/SettingsScreen.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/SyriaFlag.tsx`.
- النصوص والحالات: الثيم والإعدادات المتاحة فعلًا؛ الرجوع الآمن إلى حساب الدور.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-SHR-05 — البيانات الشخصية

- الدور: مشتركة بحسب صلاحية الحساب. المصدر: `src/app/personal-info.tsx`؛ الوجهة: `/personal-info`.
- الوظيفة: تحرير البيانات الشخصية المشتركة.
- الوصول: حسابي للأدوار التي تستخدم المسار المشترك. إشارات المصدر: `src/app/driver/account.tsx`، `src/components/account/SharedAccountParts.tsx`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: PersonalInfoScreen؛ معلومات السائق المهنية في حسابه.
- المكونات (وصول محافظ): `src/components/account/AccountMenuItem.tsx`، `src/components/account/AccountProfileHeader.tsx`، `src/components/account/AccountSection.tsx`، `src/components/account/AccountShell.tsx`، `src/components/account/PersonalInfoScreen.tsx`، `src/components/account/SharedAccountParts.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: الحقول الضرورية وتاريخ الميلاد والحفظ والتحقق؛ لا اقتطاع عربي مع الأرقام.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-SHR-06 — الأمان

- الدور: مشتركة بحسب صلاحية الحساب. المصدر: `src/app/security.tsx`؛ الوجهة: `/security`.
- الوظيفة: تعديل كلمة المرور والأمان الموجود.
- الوصول: حسابي للأدوار المشتركة. إشارات المصدر: `src/app/driver/account.tsx`، `src/components/account/SettingsScreen.tsx`، `src/components/account/SharedAccountParts.tsx`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: SecurityScreen ونموذج كلمة المرور.
- المكونات (وصول محافظ): `src/components/account/AccountMenuItem.tsx`، `src/components/account/AccountProfileHeader.tsx`، `src/components/account/AccountSection.tsx`، `src/components/account/AccountShell.tsx`، `src/components/account/SecurityScreen.tsx`، `src/components/account/SharedAccountParts.tsx`، `src/components/navigation/AppHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: لوحة المفاتيح وأخطاء التحقق الآمنة؛ لا تسريب تفاصيل جلسة أو مزود.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

## الدخول والتسجيل والانضمام — 8 صفحة

### RUI-AUTH-01 — بوابة بدء التطبيق وتوجيه الحساب

- الدور: الدخول والتسجيل والانضمام. المصدر: `src/app/index.tsx`؛ الوجهة: `/`.
- الوظيفة: تحديد الجلسة والدور وتوجيهه مع حالة بدء وخطأ.
- الوصول: تشغيل التطبيق والمسار /. إشارات المصدر: `src/app/financial-invoice.tsx`، `src/app/notifications.tsx`، `src/components/account/SecurityScreen.tsx`، `src/components/account/SettingsScreen.tsx`، `src/hooks/useSafeBack.ts`، `src/lib/merchant-product-create.ts`، `src/lib/merchant-product-edit.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: توجيه فعلي مع واجهة انتظار/إعادة محاولة؛ ليس Redirect صرفًا.
- المكونات (وصول محافظ): `src/components/brand/BrandMark.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: فشل الجلسة وإعادة المحاولة بلا تسريب حساب سابق.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-AUTH-02 — تسجيل الدخول

- الدور: الدخول والتسجيل والانضمام. المصدر: `src/app/login.tsx`؛ الوجهة: `/login`.
- الوظيفة: تسجيل الدخول واستعادة الوصول.
- الوصول: بوابة البدء وروابط التسجيل. إشارات المصدر: `src/app/application-status.tsx`، `src/app/driver/index.tsx`، `src/app/driver/orders.tsx`، `src/app/home/account.tsx`، `src/app/index.tsx`، `src/app/notifications.tsx`، `src/app/reset-password.tsx`، `src/app/verify-email.tsx`، `src/components/account/SharedAccountParts.tsx`، `src/components/auth/RoleRouteGuard.tsx`، `src/components/finance/FinanceScreen.tsx`، `src/components/finance/InvoiceScreen.tsx`، `src/components/signup/ProfessionalApplicationScreen.tsx`، `src/hooks/useOnboardingExit.ts`، `src/hooks/useSafeBack.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: ForgotPasswordSection وreset-password وsignup.
- المكونات (وصول محافظ): `src/components/brand/BrandMark.tsx`، `src/components/login/ForgotPasswordSection.tsx`، `src/components/login/LoginFooter.tsx`، `src/components/login/LoginForm.tsx`، `src/components/login/LoginHeader.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: خطأ دخول واضح وآمن دون كشف وجود حساب؛ حفظ حالة النموذج.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-AUTH-03 — إنشاء حساب

- الدور: الدخول والتسجيل والانضمام. المصدر: `src/app/signup.tsx`؛ الوجهة: `/signup`.
- الوظيفة: اختيار الدور ثم البيانات اللازمة والانضمام المهني.
- الوصول: الدخول وإنشاء حساب. إشارات المصدر: `src/components/login/LoginFooter.tsx`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: خطوات داخل الصفحة؛ تاريخ الميلاد للجميع وخطة يختارها التاجر؛ لا تعد كل خطوة صفحة.
- المكونات (وصول محافظ): `src/components/merchant/MerchantCategorySelect.tsx`، `src/components/signup/BirthDateField.tsx`، `src/components/signup/MerchantPlanChoice.tsx`، `src/components/signup/ProfessionalApplicationFields.tsx`، `src/components/signup/SignupCredentialsStep.tsx`، `src/components/signup/SignupErrorNotice.tsx`، `src/components/signup/SignupProgress.tsx`، `src/components/signup/SignupReviewStep.tsx`، `src/components/signup/SignupRoleStep.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: التحقق من الحقول والخصوصية وتأكيد البريد؛ لوحة المفاتيح.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-AUTH-04 — تأكيد البريد

- الدور: الدخول والتسجيل والانضمام. المصدر: `src/app/verify-email.tsx`؛ الوجهة: `/verify-email`.
- الوظيفة: تأكيد البريد واستكمال الدخول.
- الوصول: بعد التسجيل/توجيه الجلسة. إشارات المصدر: `src/hooks/useSignup.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: إعادة إرسال والعودة للدخول ضمن الصفحة.
- المكونات (وصول محافظ): `src/components/auth/OnboardingFrame.tsx`، `src/components/brand/BrandMark.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: مهلة إعادة الإرسال وحالة التأكيد وانتهاء الرابط؛ لا زر نجاح محلي.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-AUTH-05 — استعادة كلمة المرور

- الدور: الدخول والتسجيل والانضمام. المصدر: `src/app/reset-password.tsx`؛ الوجهة: `/reset-password`.
- الوظيفة: تعيين كلمة مرور بعد رابط الاستعادة.
- الوصول: رابط البريد وتدفق الاستعادة. إشارات المصدر: لا مرجع حرفي مباشر؛ قد يفتح بتوجيه ديناميكي/بدء التطبيق.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: نموذج داخل الصفحة؛ login بعد نجاح الخادم.
- المكونات (وصول محافظ): `src/components/auth/OnboardingFrame.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: انتهاء الرابط وكلمة المرور والتأكيد والعودة الآمنة.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-AUTH-06 — طلب انضمام التاجر

- الدور: الدخول والتسجيل والانضمام. المصدر: `src/app/merchant-application.tsx`؛ الوجهة: `/merchant-application`.
- الوظيفة: استكمال طلب التاجر وبيانات متجره والخطة المختارة.
- الوصول: التسجيل وحالة الطلب؛ review القديم يعيد هنا. إشارات المصدر: `src/app/application-status.tsx`، `src/app/merchant-application-review.tsx`، `src/lib/account-routing.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: ProfessionalApplicationScreen/Fields وMerchantPlanChoice؛ الخطوات ليست صفحات مستقلة.
- المكونات (وصول محافظ): `src/components/auth/OnboardingFrame.tsx`، `src/components/merchant/MerchantCategorySelect.tsx`، `src/components/signup/BirthDateField.tsx`، `src/components/signup/MerchantPlanChoice.tsx`، `src/components/signup/ProfessionalApplicationFields.tsx`، `src/components/signup/ProfessionalApplicationScreen.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: KeyboardAwareScrollView؛ تكلفة وشروط الخطة دون اختيار الإدارة نيابة عنه.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P0: بيانات/مال/إجراء. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-AUTH-07 — طلب انضمام السائق

- الدور: الدخول والتسجيل والانضمام. المصدر: `src/app/driver-application.tsx`؛ الوجهة: `/driver-application`.
- الوظيفة: استكمال بيانات انضمام السائق اللازمة.
- الوصول: التسجيل وحالة الطلب. إشارات المصدر: `src/lib/account-routing.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: ProfessionalApplicationScreen/Fields؛ لا راتب أو وسيلة دفع مفترضة.
- المكونات (وصول محافظ): `src/components/auth/OnboardingFrame.tsx`، `src/components/merchant/MerchantCategorySelect.tsx`، `src/components/signup/BirthDateField.tsx`، `src/components/signup/MerchantPlanChoice.tsx`، `src/components/signup/ProfessionalApplicationFields.tsx`، `src/components/signup/ProfessionalApplicationScreen.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/AppModal.tsx`، `src/components/ui/AppTextField.tsx`، `src/components/ui/KeyboardAwareScrollView.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: تاريخ الميلاد والبيانات المهنية والتحقق ولوحة المفاتيح؛ حفظ المدخلات.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P0: بيانات/مال/إجراء. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-AUTH-08 — حالة طلب الانضمام

- الدور: الدخول والتسجيل والانضمام. المصدر: `src/app/application-status.tsx`؛ الوجهة: `/application-status`.
- الوظيفة: متابعة قرار الانضمام.
- الوصول: توجيه الجلسة/إكمال الطلب. إشارات المصدر: `src/app/driver/index.tsx`، `src/app/driver/orders.tsx`، `src/app/driver/task-details.tsx`، `src/components/account/DriverProfessionalInfo.tsx`، `src/components/signup/ProfessionalApplicationScreen.tsx`، `src/lib/account-routing.ts`، `src/lib/notification-opening.ts`، `src/lib/notification-routing.ts`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: merchant-application أو driver-application لاستكمال البيانات؛ review القديم تحويل.
- المكونات (وصول محافظ): `src/components/application-status/ApplicationStatusEmptyState.tsx`، `src/components/auth/OnboardingFrame.tsx`، `src/components/ui/AppButton.tsx`، `src/components/ui/AppIcon.tsx`، `src/components/ui/LiveStatus.tsx`، `src/components/ui/LoadingState.tsx`.
- النصوص والحالات: قيد المراجعة/رفض مع السبب المتاح؛ تحديث آمن عند العودة.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P0: بيانات/مال/إجراء. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

## القانونية ومعلومات التطبيق — 3 صفحة

### RUI-LEGAL-01 — معلومات التطبيق

- الدور: القانونية ومعلومات التطبيق. المصدر: `src/app/about.tsx`؛ الوجهة: `/about`.
- الوظيفة: تعريف التطبيق ومعلوماته الحالية.
- الوصول: حسابي والروابط القانونية. إشارات المصدر: `src/app/driver/account.tsx`، `src/components/account/SettingsScreen.tsx`، `src/components/legal/LegalPageLayout.tsx`، `src/components/login/LoginFooter.tsx`، `src/components/merchant/MerchantAccountScreens.tsx`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: AboutContent/FeatureList/Header وروابط privacy/terms.
- المكونات (وصول محافظ): `src/components/about/AboutContent.tsx`، `src/components/about/AboutFeatureList.tsx`، `src/components/about/AboutHeader.tsx`، `src/components/brand/BrandMark.tsx`، `src/components/ui/AppIcon.tsx`.
- النصوص والحالات: لا وظائف أو دعم أو منطقة خدمة غير موجودة؛ مطابقة الهوية الفعلية.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-LEGAL-02 — سياسة الخصوصية

- الدور: القانونية ومعلومات التطبيق. المصدر: `src/app/privacy.tsx`؛ الوجهة: `/privacy`.
- الوظيفة: شرح جمع البيانات واستخدامها والحقوق الفعلية.
- الوصول: التسجيل والحساب والصفحات القانونية. إشارات المصدر: `src/app/driver/account.tsx`، `src/app/terms.tsx`، `src/components/about/AboutContent.tsx`، `src/components/account/SettingsScreen.tsx`، `src/components/legal/LegalPageLayout.tsx`، `src/components/legal/LegalRelatedDocument.tsx`، `src/components/login/LoginFooter.tsx`، `src/components/merchant/MerchantAccountScreens.tsx`، `src/components/signup/SignupReviewStep.tsx`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: LegalPageLayout/Section/RelatedDocument؛ لا مسار حذف بيانات منفذ يثبت بالنص وحده.
- المكونات (وصول محافظ): `src/components/legal/LegalPageLayout.tsx`، `src/components/legal/LegalRelatedDocument.tsx`، `src/components/legal/LegalSection.tsx`، `src/components/ui/AppIcon.tsx`.
- النصوص والحالات: قرار المالك ومراجعة متطلبات المتجرين عند التنفيذ؛ لا ادعاء حذف أو تعهد غير مطبق.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

### RUI-LEGAL-03 — شروط الاستخدام

- الدور: القانونية ومعلومات التطبيق. المصدر: `src/app/terms.tsx`؛ الوجهة: `/terms`.
- الوظيفة: بيان شروط الاستخدام التشغيلية والتجارية الفعلية.
- الوصول: التسجيل والحساب والصفحات القانونية. إشارات المصدر: `src/app/driver/account.tsx`، `src/app/privacy.tsx`، `src/components/about/AboutContent.tsx`، `src/components/account/SettingsScreen.tsx`، `src/components/legal/LegalPageLayout.tsx`، `src/components/legal/LegalRelatedDocument.tsx`، `src/components/login/LoginFooter.tsx`، `src/components/merchant/MerchantAccountScreens.tsx`، `src/components/signup/SignupReviewStep.tsx`.
- التبويب: ليس تبويبًا مباشرًا؛ قد يبقى شريط الدور ظاهرًا عبر layout.
- التفاصيل الموجودة/الناقصة: LegalPageLayout ومراجع الخصوصية؛ لا صفحة دفع متجر جديدة مفترضة.
- المكونات (وصول محافظ): `src/components/legal/LegalPageLayout.tsx`، `src/components/legal/LegalRelatedDocument.tsx`، `src/components/legal/LegalSection.tsx`، `src/components/ui/AppIcon.tsx`.
- النصوص والحالات: تطابق الاشتراك والعمولة والتوصيل والإلغاء مع التطبيق؛ لا تبسيط يغير المعنى القانوني.
- الثيم الليلي: غير معتمد لهذه المراجعة؛ رموز الثيم المشتركة أساس موجود، والتباين والحالات المحلية تحتاج اختبار الصفحة. ملاحظات محددة في مرجع التصميم وجرد المكونات.
- الأولوية: P1: الاستخدام اليومي. الحالة: **لم تبدأ** في مسار RUI؛ لم تختبر هذه المراجعة الجديدة؛ القبول التاريخي محفوظ في WORK_PROGRESS.md.

## ملفات لا تعد صفحات مستقلة

لا تعاد إحياء المالية القديمة بسبب وجود اسم مسار. التحويلات أدناه تبقى توافقًا إلى النظام الحالي. `admin/requests` اسم بديل للطلبات؛ لا يمثل شاشة أخرى.

- `src/app/_layout.tsx` — layout → `@/context/ToastContext`.
- `src/app/admin/_layout.tsx` — layout → `expo-router`.
- `src/app/admin/cash-movement-report.tsx` — redirect → `expo-router`.
- `src/app/admin/commission-details.tsx` — redirect → `expo-router`.
- `src/app/admin/commissions.tsx` — redirect → `expo-router`.
- `src/app/admin/create-merchant-settlement.tsx` — redirect → `expo-router`.
- `src/app/admin/credit-details.tsx` — redirect → `expo-router`.
- `src/app/admin/credit.tsx` — redirect → `expo-router`.
- `src/app/admin/delivery-fees-report.tsx` — redirect → `expo-router`.
- `src/app/admin/driver-custody-details.tsx` — redirect → `expo-router`.
- `src/app/admin/driver-custody-report.tsx` — redirect → `expo-router`.
- `src/app/admin/driver-custody.tsx` — redirect → `expo-router`.
- `src/app/admin/finance-reconciliation.tsx` — redirect → `expo-router`.
- `src/app/admin/finance-transition.tsx` — redirect → `expo-router`.
- `src/app/admin/financial-indicators.tsx` — redirect → `expo-router`.
- `src/app/admin/financial-reports.tsx` — redirect → `expo-router`.
- `src/app/admin/invoice-details.tsx` — redirect → `expo-router`.
- `src/app/admin/invoices.tsx` — redirect → `expo-router`.
- `src/app/admin/ledger-details.tsx` — redirect → `expo-router`.
- `src/app/admin/ledger.tsx` — redirect → `expo-router`.
- `src/app/admin/merchant-finance.tsx` — redirect → `expo-router`.
- `src/app/admin/merchant-payouts-report.tsx` — redirect → `expo-router`.
- `src/app/admin/merchant-settlement-details.tsx` — redirect → `expo-router`.
- `src/app/admin/merchant-settlements.tsx` — redirect → `expo-router`.
- `src/app/admin/payment-details.tsx` — redirect → `expo-router`.
- `src/app/admin/payments.tsx` — redirect → `expo-router`.
- `src/app/admin/platform-revenue-report.tsx` — redirect → `expo-router`.
- `src/app/admin/requests.tsx` — alias → `./orders`.
- `src/app/admin/subscription-details.tsx` — redirect → `expo-router`.
- `src/app/admin/subscriptions.tsx` — redirect → `expo-router`.
- `src/app/admin/treasury.tsx` — redirect → `expo-router`.
- `src/app/driver/_layout.tsx` — layout → `@/context/ThemeContext`.
- `src/app/home/_layout.tsx` — layout → `expo-router`.
- `src/app/merchant/_layout.tsx` — layout → `expo-router`.
- `src/app/merchant/financial-ledger-details.tsx` — redirect → `expo-router`.
- `src/app/merchant/financial-ledger.tsx` — redirect → `expo-router`.
- `src/app/merchant/financial-sale-details.tsx` — redirect → `expo-router`.
- `src/app/merchant/financial-sales.tsx` — redirect → `expo-router`.
- `src/app/merchant/offers.tsx` — redirect → `/merchant/catalog?tab=offers`.
- `src/app/merchant/products.tsx` — redirect → `/merchant/catalog?tab=products`.
- `src/app/merchant/sales-commissions.tsx` — redirect → `expo-router`.
- `src/app/merchant/settlement-details.tsx` — redirect → `expo-router`.
- `src/app/merchant/settlements.tsx` — redirect → `expo-router`.
- `src/app/merchant/subscription-invoice-details.tsx` — redirect → `expo-router`.
- `src/app/merchant/subscription-invoices.tsx` — redirect → `expo-router`.
- `src/app/merchant/subscription-payment-details.tsx` — redirect → `expo-router`.
- `src/app/merchant/subscription-payments.tsx` — redirect → `expo-router`.
- `src/app/merchant/subscription.tsx` — redirect → `expo-router`.
- `src/app/merchant-application-review.tsx` — redirect → `expo-router`.

## الفجوات المؤكدة وحدود قرار الصفحات الجديدة

- تفاصيل طلب التاجر ضمن القائمة. تفاصيل مهمة السائق صفحة مستقلة RUI-DRV-02.01 وفق قرار المالك، وتبقى البطاقات مداخل مختصرة.
- قوائم الفواتير والتسويات والخزينة وأدواتها الحالية داخل FinanceScreen/InvoiceScreen؛ المسارات القديمة لا توفر صفحات حديثة مستقلة. أي فصل مطلوب يملك مهمة فرعية مستقلة بعد تحديد الحاجة، ولا ينفذ تلقائيًا مع لوحة المالية.
- لا صفحة /account مشتركة؛ حسابي له مسار لكل دور. المشترَك هو القطع والمداخل الفرعية؛ لا ننشئ صفحة وهمية في العد.
- بيانات اعتماد السائق في صفحة مستقلة للعرض، وإعدادات السائق تستخدم مكوّن المظهر المشترك.
- لا مسار مشروع مخصص لـ404 في الجرد؛ لا يعني ذلك غياب fallback الخاص بـExpo Router. يراجع الرجوع/الرابط غير الصالح في كل صفحة.
- صفحات القانونية لا تثبت وجود حذف حساب أو توافق دفع المتجرين؛ تطابق مع الوظائف الفعلية ومتطلبات حديثة عند الوصول إلى مرحلتها.
