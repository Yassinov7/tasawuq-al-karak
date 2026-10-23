# مطابقة Schema الإنتاج

تقرير الإنتاج يؤكد وجود جميع الجداول الأساسية وRLS عليها، ويؤكد أن `merchant_subscriptions_merchant_id_key` هو قيد فعلي يمنع تعدد الفترات للتاجر.

- `store_order_totals` جدول محمي بـRLS، ومفتاحه `(store_order_id, currency)`، و`items_subtotal` غير سالب. وهو مصدر أساس العمولة المعتمد.
- انتقال التسليم يمر عبر `update_delivery_task_status(target_customer_order, next_status)`؛ عند `delivered` يحدّث طلبات المتاجر من `handed_to_driver` إلى `delivered`.
- سياسات القراءة تحصر بيانات الطلبات بالمشاركين، لكن Grants الجداول واسعة لـ`anon` و`authenticated` و`service_role`. لا يغيّر Migration المالية هذه الصلاحيات.
- لا توجد كائنات مالية مقترحة مسبقًا في تقرير الإنتاج.

النتيجة: Schema مناسب لإنشاء الأساس المالي، لكن أي تقليص لـGrants الطلبات يحتاج Migration مستقلة واختبارات تدفق الطلبات وRPCs.
