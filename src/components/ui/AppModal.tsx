import { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type AppModalProps = {
  design?: "legacy" | "refined";
  visible: boolean;
  title: string;
  message?: string;
  icon?: React.ComponentProps<typeof AppIcon>["name"];
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  busy?: boolean;
  showCloseButton?: boolean;
  onConfirm?: () => void;
  onCancel: () => void;
  children?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
};

export function AppModal({
  design = "refined",
  visible,
  title,
  message,
  icon = "information-circle-outline",
  confirmText = "حسنًا",
  cancelText,
  destructive = false,
  busy = false,
  showCloseButton = false,
  onConfirm,
  onCancel,
  children,
  actions,
  compact = false,
}: AppModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const refined = design === "refined";
  const Content = refined ? ScrollView : View;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
        onRequestClose={() => { if (!busy) onCancel(); }}
    >
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: refined ? colors.overlayScrim : "rgba(0, 0, 0, 0.5)",
            ...(refined ? { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 } : {}),
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { if (!busy) onCancel(); }} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={[styles.keyboardContainer, refined && { maxHeight: "100%", flexShrink: 1 }]}
        >
          <Content
            {...(refined ? { keyboardShouldPersistTaps: "handled" as const, contentContainerStyle: { padding: compact ? Spacing.four : 20 } } : {})}
            style={[
              styles.card,
              refined && { padding: 0, maxHeight: "100%", flexGrow: 0 },
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
          {showCloseButton ? (
            <Pressable
              disabled={busy}
              hitSlop={8}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.closeButton,
                refined && { minWidth: 44, minHeight: 44 },
                { backgroundColor: colors.surfaceSecondary },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="إغلاق"
            >
              <AppIcon
                name="close-outline"
                size={19}
                color={colors.textSecondary}
              />
            </Pressable>
          ) : null}

          <View
            style={[
              styles.iconContainer,
              compact && styles.compactIcon,
              {
                backgroundColor: colors.primaryLight,
              },
            ]}
          >
            <AppIcon name={icon} size={compact ? 20 : 24} color={colors.primary} />
          </View>

          <Text
            style={[
              styles.title,
              refined && Typography.sectionTitle,
              compact && styles.compactTitle,
              {
                color: colors.text,
              },
            ]}
          >
            {title}
          </Text>

          {message ? (
            <Text
              style={[
                styles.message,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              {message}
            </Text>
          ) : null}

          {children}

          {actions ?? <View style={styles.actions}>
            {cancelText ? (
              <Pressable
                onPress={onCancel}
                disabled={busy}
                style={({ pressed }) => [
                  styles.button,
                  refined && { minHeight: 48, paddingVertical: 8 },
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.cancelText,
                    {
                      color: colors.textSecondary,
                    },
                  ]}
                >
                  {cancelText}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={busy ? undefined : onConfirm ?? onCancel}
              disabled={busy}
              style={({ pressed }) => [
                styles.button,
                refined && { minHeight: 48, paddingVertical: 8 },
                {
                  backgroundColor: destructive ? colors.error : colors.primary,
                },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.confirmText,
                  {
                    color: refined ? destructive ? colors.onError : colors.onPrimary : colors.surface,
                  },
                ]}
              >
                {busy ? "جارٍ التنفيذ…" : confirmText}
              </Text>
            </Pressable>
          </View>}
          </Content>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export function AppConfirmModal({ icon = "help-circle-outline", ...props }: AppModalProps) {
  return <AppModal icon={icon} {...props} />;
}

export function AppAlertModal(props: Omit<AppModalProps, "cancelText" | "onConfirm">) {
  return <AppModal {...props} />;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.five,
  },

  keyboardContainer: {
    width: "100%",
  },

  card: {
    width: "100%",
    maxWidth: 420,
    padding: Spacing.five,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  closeButton: {
    alignItems: "center",
    borderRadius: Radius.full,
    height: 34,
    justifyContent: "center",
    left: Spacing.three,
    position: "absolute",
    top: Spacing.three,
    width: 34,
    zIndex: 1,
  },

  iconContainer: {
    width: 50,
    height: 50,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  compactIcon: { width: 40, height: 40 },
  compactTitle: { marginTop: Spacing.two },

  title: {
    marginTop: Spacing.three,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "center",
  },

  message: {
    marginTop: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 24,
    textAlign: "center",
  },

  actions: {
    flexDirection: "row-reverse",
    gap: Spacing.two,
    marginTop: Spacing.five,
  },

  button: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.md,
  },

  confirmText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },

  cancelText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },

  pressed: {
    opacity: 0.7,
  },
});
