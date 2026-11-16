import { StyleSheet } from "react-native";

import { ControlSizes, FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: Spacing.four, paddingBottom: Spacing.six },
  controls: { gap: Spacing.one, paddingTop: Spacing.two },
  row: { direction: "rtl", flexDirection: "row", alignItems: "center", gap: Spacing.two },
  searchBox: { flex: 1, minWidth: 0, minHeight: ControlSizes.input, paddingHorizontal: Spacing.two, borderRadius: Radius.lg, borderWidth: 1 },
  input: { flex: 1, minWidth: 0, minHeight: ControlSizes.input, textAlign: "right", fontFamily: Fonts.medium, fontSize: FontSizes.sm },
  iconButton: { minWidth: ControlSizes.touch, minHeight: ControlSizes.touch, alignItems: "center", justifyContent: "center" },
  typeMenu: { direction: "rtl", flexDirection: "row", flexWrap: "wrap", gap: Spacing.one, padding: Spacing.one, borderWidth: 1, borderRadius: Radius.lg },
  type: { minWidth: ControlSizes.touch, minHeight: ControlSizes.touch, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.two, borderRadius: Radius.md },
  context: { flexWrap: "wrap", justifyContent: "space-between" },
  tool: { minHeight: ControlSizes.touch, justifyContent: "center", paddingHorizontal: Spacing.two, borderWidth: 1, borderRadius: Radius.lg },
  text: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, textAlign: "right" },
  selectedText: { fontFamily: Fonts.bold, fontSize: FontSizes.sm, textAlign: "right" },
  heading: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" },
  section: { paddingTop: Spacing.three, paddingBottom: Spacing.two },
  item: { paddingBottom: Spacing.two },
  resultRow: { direction: "rtl", flexDirection: "row", gap: Spacing.two, alignItems: "stretch" },
  resultCell: { flexDirection: "row", minWidth: 0 },
  notice: { minHeight: ControlSizes.touch, paddingVertical: Spacing.one, justifyContent: "center" },
  placeholder: { minHeight: 88, borderRadius: Radius.lg, marginBottom: Spacing.two },
});
