import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";

import { Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type AccountShellProps = {
  header: ReactNode;
  children: ReactNode;
  keyboardAware?: boolean;
  keyboardVerticalOffset?: number;
};

/** Shared page frame; account screens provide their own data and actions. */
export function AccountShell({ header, children, keyboardAware = false, keyboardVerticalOffset = Platform.OS === "ios" ? 0 : 20 }: AccountShellProps) {
  const { colors } = useTheme();

  const content = (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      {children}
    </ScrollView>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {header}
      {keyboardAware ? (
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={keyboardVerticalOffset}
        >
          {content}
        </KeyboardAvoidingView>
      ) : content}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  keyboardContainer: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.ten,
  },
});
