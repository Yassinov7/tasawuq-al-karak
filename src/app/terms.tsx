import { Link, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

const sections = [
  {
    title: "1. مقدمة",
    paragraphs: [
      "مرحبًا بك في تسوق. تتيح المنصة للمستخدمين استعراض المتاجر والمنتجات والعروض، وإنشاء الطلبات، واختيار طريقة الاستلام أو التوصيل بحسب الخدمات المتاحة.",
      "باستخدامك للمنصة أو إنشاء حساب فيها، فإنك تقرأ هذه الشروط وتوافق على الالتزام بها.",
    ],
  },
  {
    title: "2. الحساب",
    paragraphs: [
      "يجب تقديم معلومات صحيحة عند إنشاء الحساب والمحافظة على تحديثها عند الحاجة.",
      "أنت مسؤول عن المحافظة على سرية بيانات الدخول الخاصة بك وعن الأنشطة التي تتم من خلال حسابك.",
      "يجب عدم استخدام حسابك بطريقة تخالف القوانين أو تضر بالمستخدمين أو المتاجر أو المنصة.",
    ],
  },
  {
    title: "3. المتاجر والمنتجات",
    paragraphs: [
      "المتاجر مسؤولة عن إدخال معلومات المنتجات والأسعار والتفاصيل والتوفر الخاصة بها.",
      "قد تختلف الأسعار والتوفر والعروض من متجر إلى آخر، وقد تتغير قبل تأكيد الطلب.",
      "عرض المنتج داخل المنصة لا يعني بالضرورة توفره في جميع الأوقات.",
    ],
  },
  {
    title: "4. الطلبات",
    paragraphs: [
      "عند إرسال الطلب، يتم إنشاء طلب بحسب المنتجات والمتاجر التي اخترتها.",
      "قد يحتوي الطلب الواحد على منتجات من أكثر من متجر، وقد تتم معالجة كل جزء من الطلب وفق حالة المتجر المعني.",
      "قد يتم رفض بعض المنتجات أو الطلبات عندما تكون المنتجات غير متوفرة أو عند وجود سبب تشغيلي يمنع تنفيذ الطلب.",
    ],
  },
  {
    title: "5. إلغاء الطلب",
    paragraphs: [
      "يمكن إلغاء طلب العميل خلال الفترة المسموح بها في النظام وقبل بدء تجهيز الطلب من أحد المتاجر.",
      "بعد بدء تجهيز أحد أجزاء الطلب، قد لا يكون الإلغاء متاحًا وفق حالة الطلب.",
      "قد تختلف نتيجة الإلغاء بحسب حالة كل متجر والطلب والتوصيل.",
    ],
  },
  {
    title: "6. الأسعار والدفع",
    paragraphs: [
      "تظهر الأسعار والعملة بحسب المعلومات التي يحددها المتجر والمنصة.",
      "طريقة الدفع المتاحة حاليًا قد تشمل الدفع نقدًا عند الاستلام أو الاستلام بحسب ما يظهر لك أثناء إتمام الطلب.",
      "تحتفظ المنصة بمعلومات الطلب والأسعار المستخدمة عند إنشاء الطلب لأغراض المتابعة والفوترة.",
    ],
  },
  {
    title: "7. التوصيل والاستلام",
    paragraphs: [
      "تختلف إمكانية التوصيل ورسومه بحسب المنطقة وإعدادات المنصة والمتجر.",
      "قد تستخدم المنصة مناطق توصيل محددة برسوم ثابتة أو وفق قواعد تشغيلية يتم تحديدها من إدارة المنصة.",
      "وقت التوصيل تقديري وقد يتأثر بتوفر المنتجات وتجهيز الطلب وحركة السائق والظروف التشغيلية.",
    ],
  },
  {
    title: "8. التجار والسائقون",
    paragraphs: [
      "يخضع انضمام التجار والسائقين للمراجعة والإجراءات التي تحددها إدارة المنصة.",
      "يجب على التجار المحافظة على دقة بيانات المتجر والمنتجات والأسعار والتوفر.",
      "يجب على السائقين الالتزام بمتطلبات العمل والتعليمات التشغيلية المعتمدة من المنصة.",
    ],
  },
  {
    title: "9. الاستخدام المقبول",
    paragraphs: [
      "يُمنع استخدام المنصة لأغراض احتيالية أو مضللة أو غير قانونية.",
      "يُمنع محاولة الوصول غير المصرح به إلى حسابات أو بيانات أو أنظمة المنصة.",
      "يُمنع استخدام المنصة بطريقة تؤدي إلى تعطيل الخدمة أو الإضرار بالمستخدمين أو المتاجر أو السائقين.",
    ],
  },
  {
    title: "10. إيقاف الحساب",
    paragraphs: [
      "يجوز للمنصة تعليق أو إيقاف الحساب عند مخالفة هذه الشروط أو عند وجود نشاط يهدد أمن المنصة أو مستخدميها.",
      "يمكن اتخاذ إجراءات إضافية بحسب طبيعة المخالفة وحالتها.",
    ],
  },
  {
    title: "11. التغييرات على الشروط",
    paragraphs: [
      "قد يتم تحديث هذه الشروط عند إضافة خدمات أو ميزات جديدة أو عند الحاجة التشغيلية أو القانونية.",
      "عند إجراء تغييرات جوهرية، سيتم نشر النسخة المحدثة داخل المنصة.",
    ],
  },
  {
    title: "12. التواصل",
    paragraphs: [
      "إذا كان لديك سؤال حول هذه الشروط أو حول استخدام المنصة، يمكنك التواصل مع إدارة تسوق عبر قنوات التواصل المعتمدة داخل التطبيق.",
    ],
  },
];

export default function TermsScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="رجوع"
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.backButton}
        >
          <AppIcon name="arrow-forward" size={22} color={colors.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: colors.text }]}>
          شروط الاستخدام
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.introCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.introTitle, { color: colors.text }]}>
            شروط استخدام تسوق
          </Text>

          <Text style={[styles.introText, { color: colors.textSecondary }]}>
            هذه الصفحة توضح القواعد الأساسية لاستخدام منصة تسوق والاستفادة من
            خدماتها.
          </Text>

          <Text style={[styles.updated, { color: colors.textMuted }]}>
            آخر تحديث: الإصدار الأول
          </Text>
        </View>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {section.title}
            </Text>

            {section.paragraphs.map((paragraph) => (
              <Text
                key={paragraph}
                style={[styles.paragraph, { color: colors.textSecondary }]}
              >
                {paragraph}
              </Text>
            ))}
          </View>
        ))}

        <View
          style={[
            styles.footerCard,
            {
              backgroundColor: colors.primaryLight,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.footerTitle, { color: colors.text }]}>
            سياسة الخصوصية
          </Text>

          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            لمعرفة كيفية التعامل مع بياناتك ومعلومات حسابك، يمكنك الاطلاع على
            سياسة الخصوصية.
          </Text>

          <Link href="/privacy" asChild>
            <Pressable
              accessibilityRole="link"
              hitSlop={6}
              style={styles.linkButton}
            >
              <Text style={[styles.link, { color: colors.primary }]}>
                الانتقال إلى سياسة الخصوصية
              </Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.bottomLinks}>
          <Link href="/privacy" asChild>
            <Pressable hitSlop={6}>
              <Text style={[styles.bottomLink, { color: colors.primary }]}>
                سياسة الخصوصية
              </Text>
            </Pressable>
          </Link>

          <View
            style={[styles.separator, { backgroundColor: colors.border }]}
          />

          <Link href="/about" asChild>
            <Pressable hitSlop={6}>
              <Text style={[styles.bottomLink, { color: colors.primary }]}>
                معلومات البرنامج
              </Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.five,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  headerSpacer: {
    width: 40,
  },

  content: {
    padding: Spacing.five,
    paddingBottom: Spacing.nine,
  },

  introCard: {
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.lg,
    marginBottom: Spacing.six,
  },

  introTitle: {
    textAlign: "right",
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
  },

  introText: {
    marginTop: Spacing.two,
    textAlign: "right",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 24,
  },

  updated: {
    marginTop: Spacing.three,
    textAlign: "right",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },

  section: {
    marginBottom: Spacing.five,
  },

  sectionTitle: {
    textAlign: "right",
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    marginBottom: Spacing.two,
  },

  paragraph: {
    textAlign: "right",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 25,
    marginBottom: Spacing.two,
  },

  footerCard: {
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.lg,
    marginTop: Spacing.two,
  },

  footerTitle: {
    textAlign: "right",
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  footerText: {
    marginTop: Spacing.two,
    textAlign: "right",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 24,
  },

  linkButton: {
    alignSelf: "flex-start",
    marginTop: Spacing.three,
  },

  link: {
    textAlign: "right",
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },

  bottomLinks: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.two,
    marginTop: Spacing.six,
  },

  bottomLink: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  separator: {
    width: 3,
    height: 3,
    borderRadius: Radius.full,
  },
});
