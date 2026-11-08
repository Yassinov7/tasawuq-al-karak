import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useState,type ReactNode} from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";

import { Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type AccountShellProps = {
  header: ReactNode;
  children: ReactNode;
  keyboardAware?: boolean;
  safeBottom?: boolean;
  keyboardVerticalOffset?: number;
};

/** Shared page frame; account screens provide their own data and actions. */
export function AccountShell({ header, children, keyboardAware = false, safeBottom = false, keyboardVerticalOffset }: AccountShellProps) {
  const { colors } = useTheme();
  const insets=useSafeAreaInsets();
  const [headerHeight,setHeaderHeight]=useState(0);

  const content = (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content,safeBottom&&{paddingBottom:Spacing.four+insets.bottom}]}
    >
      {children}
    </ScrollView>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {header?<View onLayout={event=>setHeaderHeight(event.nativeEvent.layout.height)}>{header}</View>:null}
      {keyboardAware ? (
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={keyboardVerticalOffset??headerHeight}
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
