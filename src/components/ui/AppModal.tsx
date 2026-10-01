import { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type AppModalProps = {
  visible: boolean;
  title: string;
  message?: string;
  icon?: React.ComponentProps<typeof AppIcon>["name"];
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm?: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

export function AppModal({
  visible,
  title,
  message,
  icon = "information-circle-outline",
  confirmText = "حسنًا",
  cancelText,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
  children,
}: AppModalProps) {
  const { colors } = useTheme();

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
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { if (!busy) onCancel(); }} />

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: colors.primaryLight,
              },
            ]}
          >
            <AppIcon name={icon} size={24} color={colors.primary} />
          </View>

          <Text
            style={[
              styles.title,
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

          <View style={styles.actions}>
            {cancelText ? (
              <Pressable
                onPress={onCancel}
                disabled={busy}
                style={({ pressed }) => [
                  styles.button,
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
                    color: colors.surface,
                  },
                ]}
              >
                {busy ? "جارٍ التنفيذ…" : confirmText}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function AppConfirmModal(props: Omit<AppModalProps, "icon">) {
  return <AppModal icon="help-circle-outline" {...props} />;
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

  card: {
    width: "100%",
    maxWidth: 420,
    padding: Spacing.five,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  iconContainer: {
    width: 50,
    height: 50,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

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
