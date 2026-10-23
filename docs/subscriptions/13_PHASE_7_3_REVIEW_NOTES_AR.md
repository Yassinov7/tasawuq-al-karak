# ملاحظات مراجعة Migration — Phase 7.3

- تم تأكيد أن `store_order_totals` جدول محمي بـRLS، ومصدر أساس العمولة هو `items_subtotal` لكل `(store_order_id, currency)`.
- الانتقال الفعلي إلى التسليم يمر عبر `update_delivery_task_status` الذي يحدّث طلبات المتاجر إلى `delivered`. لا تعدّل Migration التأسيسية هذه الدالة أو تضيف Trigger عليها.
- Migration الجاهزة للمراجعة هي `supabase/migrations/20261018000100_financial_foundation.sql`. لا تنشئ فواتير أو عمولات أو ديونًا تاريخية.
- Grants الحالية تمنح `anon` و`authenticated` صلاحيات جدول واسعة على جداول الطلبات والتسليم؛ RLS الحالي يحصر القراءة ولا توجد سياسات DML ظاهرة. المعالجة الآمنة مؤجلة إلى Migration منفصلة بعد اختبار RPCs الحالية، لأن `REVOKE` غير المدروس قد يقطع تدفقات الطلبات.
- تخصيصات الدفعات وقيود الدفتر append-only. التصحيح يكون بقيد عكس جديد، لا بتعديل أو حذف السجل المعتمد.
