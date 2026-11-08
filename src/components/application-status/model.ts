import { formatSyp } from "@/lib/money";
export type Status = {
  status: string;
  review_note: string | null;
  submitted_at: string;
  plan_price_snapshot?: number;
  plan_currency_snapshot?: string;
};

export type StatusConfig = {
  title: string;
  note: string;
  icon:
    | "time-outline"
    | "checkmark-circle-outline"
    | "close-circle-outline"
    | "information-circle-outline";
  tone: "pending" | "accepted" | "rejected" | "changes";
};

export const statusText: Record<string, StatusConfig> = {
  pending: {
    title: "طلبك قيد المراجعة",
    note: "ستراجع الإدارة المعلومات التي قدمتها، وسيتم تحديث حالة الطلب بعد انتهاء المراجعة.",
    icon: "time-outline",
    tone: "pending",
  },
  accepted: {
    title: "تمت الموافقة على طلبك",
    note: "تم اعتماد طلبك وأصبح حسابك جاهزاً للانتقال إلى المرحلة التالية.",
    icon: "checkmark-circle-outline",
    tone: "accepted",
  },
  rejected: {
    title: "تعذر قبول الطلب حالياً",
    note: "راجع ملاحظة الإدارة لمعرفة سبب عدم قبول الطلب والخطوة التالية المتاحة لك.",
    icon: "close-circle-outline",
    tone: "rejected",
  },
  changes_requested: {
    title: "نحتاج معلومات إضافية",
    note: "راجِع ملاحظة الإدارة واستكمل المعلومات المطلوبة عند إعادة فتح الطلب.",
    icon: "information-circle-outline",
    tone: "changes",
  },
};

export const formatDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "غير متوفر";
  }

  return date.toLocaleDateString("ar-SY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const formatMoney = (
  value: number | undefined,
  currency: string | undefined,
) => {
  if (value === undefined || currency !== "SYP") return "غير مثبت";
  return formatSyp(Number(value), currency);
};
