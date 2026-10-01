import { Link, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

const sections = [
  {
    title: "1. مقدمة",
    paragraphs: [
      "نحترم خصوصيتك ونسعى إلى التعامل مع بياناتك بطريقة واضحة ومسؤولة.",
      "توضح هذه السياسة أنواع المعلومات التي قد يتم جمعها عند استخدام منصة تسوق وكيف يمكن استخدامها وحمايتها.",
    ],
  },
  {
    title: "2. المعلومات التي تقدمها لنا",
    paragraphs: [
      "قد نجمع المعلومات التي تدخلها عند إنشاء الحساب أو استخدام المنصة، مثل الاسم والبريد الإلكتروني وبيانات التواصل المرتبطة بالحساب.",
      "قد تقدم أيضًا معلومات مرتبطة بالطلبات والعناوين وطرق الاستلام أو التوصيل عند استخدام الخدمات التي تتطلب ذلك.",
    ],
  },
  {
    title: "3. معلومات الطلبات",
    paragraphs: [
      "نحتفظ بمعلومات مرتبطة بالطلبات لتتمكن من متابعة الطلبات وإظهار تفاصيلها ومعالجة حالتها.",
      "قد تشمل هذه المعلومات المنتجات والمتاجر والكميات والأسعار والعنوان المختار وحالة الطلب ومعلومات التوصيل ذات الصلة.",
    ],
  },
  {
    title: "4. معلومات التجار والسائقين",
    paragraphs: [
      "قد يحتاج التاجر أو السائق إلى تقديم معلومات إضافية عند طلب الانضمام إلى المنصة.",
      "تُستخدم هذه المعلومات لأغراض المراجعة وإدارة الحساب وتشغيل الخدمات المرتبطة بالدور المحدد.",
    ],
  },
  {
    title: "5. استخدام المعلومات",
    paragraphs: [
      "نستخدم المعلومات لتشغيل المنصة وتوفير الخدمات المطلوبة وإدارة الحسابات والطلبات.",
      "قد نستخدمها أيضًا لتحسين تجربة الاستخدام ومعالجة المشكلات التقنية وحماية المنصة من الاستخدام غير المصرح به.",
      "لا نستخدم معلوماتك لغرض مختلف جوهريًا عن الغرض الذي جُمعت من أجله إلا عندما يكون ذلك مطلوبًا أو مسموحًا به وفقًا للقواعد المعمول بها.",
    ],
  },
  {
    title: "6. مشاركة المعلومات",
    paragraphs: [
      "قد تتم مشاركة المعلومات الضرورية لتنفيذ الطلب مع الأطراف المرتبطة بتنفيذ الخدمة، مثل المتجر أو السائق عندما تكون تلك المعلومات لازمة لإتمام الطلب.",
      "لا يعني ذلك إتاحة جميع بيانات حسابك لجميع الأطراف.",
      "قد يتم الإفصاح عن المعلومات عندما يكون ذلك مطلوبًا بموجب القانون أو لحماية الحقوق والأمن ومنع إساءة الاستخدام.",
    ],
  },
  {
    title: "7. حماية البيانات",
    paragraphs: [
      "نستخدم وسائل تقنية وتنظيمية مناسبة للمساعدة في حماية المعلومات من الوصول أو الاستخدام غير المصرح به.",
      "مع ذلك، لا توجد وسيلة إلكترونية يمكن ضمان أنها آمنة بشكل مطلق، لذلك لا يمكن ضمان الحماية المطلقة لأي بيانات يتم إرسالها عبر الإنترنت.",
    ],
  },
  {
    title: "8. كلمات المرور والحساب",
    paragraphs: [
      "يجب المحافظة على سرية كلمة المرور وعدم مشاركتها مع الآخرين.",
      "إذا اشتبهت بوجود وصول غير مصرح به إلى حسابك، ينبغي تغيير كلمة المرور والتواصل مع إدارة المنصة عند الحاجة.",
    ],
  },
  {
    title: "9. التخزين والاحتفاظ",
    paragraphs: [
      "قد نحتفظ ببعض البيانات طالما كانت ضرورية لتشغيل الحساب أو تنفيذ الطلبات أو الوفاء بالالتزامات التشغيلية والقانونية.",
      "تختلف مدة الاحتفاظ بحسب نوع البيانات والغرض من استخدامها.",
    ],
  },
  {
    title: "10. حقوقك",
    paragraphs: [
      "بحسب القوانين المطبقة عليك، قد تكون لديك حقوق تتعلق بالوصول إلى بياناتك أو تصحيحها أو طلب حذفها أو الاعتراض على بعض أوجه استخدامها.",
      "يمكنك التواصل مع إدارة المنصة للاستفسار عن هذه الطلبات والإجراءات المتاحة.",
    ],
  },
  {
    title: "11. التغييرات على سياسة الخصوصية",
    paragraphs: [
      "قد نحدّث هذه السياسة عندما تتغير خدمات المنصة أو طريقة معالجة البيانات أو المتطلبات القانونية.",
      "سيتم نشر النسخة المحدثة داخل التطبيق عند اعتمادها.",
    ],
  },
  {
    title: "12. التواصل",
    paragraphs: [
      "إذا كان لديك سؤال أو استفسار متعلق بالخصوصية، يمكنك التواصل مع إدارة تسوق عبر قنوات التواصل المعتمدة داخل التطبيق.",
    ],
  },
];

export default function PrivacyScreen() {
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
          سياسة الخصوصية
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
            خصوصيتك مهمة لنا
          </Text>

          <Text style={[styles.introText, { color: colors.textSecondary }]}>
            توضح هذه السياسة بصورة مبسطة كيف نتعامل مع المعلومات المرتبطة
            باستخدامك لمنصة تسوق.
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
            شروط الاستخدام
          </Text>

          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            لاستخدام المنصة، يرجى أيضًا الاطلاع على شروط الاستخدام التي توضح
            القواعد الأساسية للخدمة.
          </Text>

          <Link href="/terms" asChild>
            <Pressable
              accessibilityRole="link"
              hitSlop={6}
              style={styles.linkButton}
            >
              <Text style={[styles.link, { color: colors.primary }]}>
                الانتقال إلى شروط الاستخدام
              </Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.bottomLinks}>
          <Link href="/terms" asChild>
            <Pressable hitSlop={6}>
              <Text style={[styles.bottomLink, { color: colors.primary }]}>
                شروط الاستخدام
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
