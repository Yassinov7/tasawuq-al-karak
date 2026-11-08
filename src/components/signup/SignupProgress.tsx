import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type SignupProgressProps = {
  step: 1 | 2 | 3;
  onBack?: () => void;
  onCancel: () => void;
  busy?: boolean;
};

const labels = ["الترحيب", "معلومات الحساب", "نوع الحساب"];

export function SignupProgress({ step, onBack, onCancel, busy }: SignupProgressProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="العودة إلى الخطوة السابقة"
            onPress={onBack}
            style={styles.backButton}
          >
            <AppIcon
              name="arrow-forward"
              size={19}
              color={colors.textSecondary}
            />
            <Text style={[styles.backLabel, { color: colors.textSecondary }]}>
              رجوع
            </Text>
          </Pressable>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
        <Pressable disabled={busy} onPress={onCancel} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.primary, fontFamily: Fonts.medium }}>إلغاء والعودة</Text></Pressable>
        <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>
          {`الخطوة ${["١", "٢", "٣"][step - 1]} من ٣`}
        </Text>
      </View>

      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`التقدم في التسجيل: ${labels[step - 1]}`}
        accessibilityValue={{ min: 1, max: 3, now: step, text: labels[step - 1] }}
        style={styles.stages}
      >
        {labels.map((label, index) => {
          const stage = index + 1;
          const complete = stage < step;
          const current = stage === step;
          const highlighted = complete || current;

          return (
            <View key={label} style={styles.stage}>
              <View
                style={[
                  styles.stageMark,
                  {
                    backgroundColor: highlighted
                      ? colors.primary
                      : colors.surface,
                    borderColor: highlighted ? colors.primary : colors.border,
                  },
                ]}
              >
                {complete ? (
                  <AppIcon name="checkmark" size={13} color={colors.surface} />
                ) : (
                  <Text
                    style={[
                      styles.stageNumber,
                      { color: current ? colors.onPrimary : colors.textSecondary },
                    ]}
                  >
                    {["١", "٢", "٣"][index]}
                  </Text>
                )}
              </View>
              <Text
                                style={[
                  styles.stageLabel,
                  { color: current ? colors.primary : colors.textSecondary },
                  current && styles.currentStageLabel,
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: colors.primary,
              width: `${(step / 3) * 100}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  topRow: {
    minHeight: 40,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    minWidth: 72,
    minHeight: 44,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
  },
  backPlaceholder: {
    minWidth: 72,
    minHeight: 44,
  },
  backLabel: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },
  stepLabel: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },
  stages: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: Spacing.two,
  },
  stage: {
    flex: 1,
    alignItems: "center",
    gap: Spacing.one,
  },
  stageMark: {
    width: 27,
    height: 27,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.full,
  },
  stageNumber: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
    lineHeight: 19,
  },
  stageLabel: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },
  currentStageLabel: {
    fontFamily: Fonts.bold,
  },
  track: {
    height: 4,
    overflow: "hidden",
    borderRadius: Radius.full,
    marginTop: Spacing.two,
  },
  fill: {
    height: "100%",
    borderRadius: Radius.full,
    alignSelf: "flex-end",
  },
});
