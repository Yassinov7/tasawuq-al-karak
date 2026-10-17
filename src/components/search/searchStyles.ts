import { StyleSheet } from "react-native";

import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.ten,
  },

  searchRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
  },

  searchBox: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },

  input: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: Spacing.two,
    paddingVertical: 0,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
  },

  clearButton: {
    width: 32,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },

  filterToggle: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.lg,
    position: "relative",
  },

  activeFilterBadge: {
    position: "absolute",
    top: -4,
    end: -4,
    minWidth: 19,
    height: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.full,
  },

  activeFilterCount: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    textAlign: "center",
  },

  filterPanel: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  filterPanelHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },

  filterPanelTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  filterHint: {
    marginTop: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  filters: {
    flexDirection: "row-reverse",
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },

  filterChip: {
    flexDirection: "row-reverse",
    gap: Spacing.one,
    alignItems: "center",
    borderRadius: Radius.full,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
  },

  filterText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  filterCount: {
    minWidth: 20,
    textAlign: "center",
    overflow: "hidden",
    borderRadius: Radius.full,
    paddingHorizontal: 5,
    paddingVertical: 2,
    fontFamily: Fonts.bold,
    fontSize: 10,
  },

  refinements: {
    gap: Spacing.three,
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },

  refinementsToggle: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },

  refinementsToggleText: {
    flex: 1,
    alignItems: "flex-end",
  },

  refinementSummary: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  refinementsHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },

  refinementTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },

  resetInlineText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  refinementLabel: {
    marginBottom: Spacing.two,
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  categoryFilter: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.full,
  },

  categoryFilterText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  sortOptions: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: Spacing.two,
  },

  sortChip: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.full,
  },

  sortText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  emptyState: {
    alignItems: "center",
    paddingTop: Spacing.seven,
  },

  heroIcon: {
    width: 112,
    height: 112,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.full,
  },

  heroIconInner: {
    width: 78,
    height: 78,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  title: {
    marginTop: Spacing.five,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
  },

  description: {
    maxWidth: 330,
    marginTop: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 23,
    textAlign: "center",
  },

  quickSearchCard: {
    width: "100%",
    marginTop: Spacing.six,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  quickHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
  },

  quickIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },

  quickTitleArea: {
    flex: 1,
    alignItems: "flex-end",
  },

  quickTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  quickSubtitle: {
    marginTop: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },

  quickChips: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: Spacing.two,
    marginTop: Spacing.three,
  },

  quickChip: {
    maxWidth: "100%",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.full,
  },

  quickChipText: {
    flexShrink: 1,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  noResults: {
    alignItems: "center",
    paddingTop: Spacing.seven,
  },

  emptyHint: {
    marginTop: Spacing.three,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  resetFilters: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
    minHeight: 42,
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.full,
  },

  resetFiltersText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
  },

  results: {
    marginTop: Spacing.five,
  },

  resultsHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
  },

  resultsTitleArea: {
    flex: 1,
    alignItems: "flex-end",
  },

  resultsTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
  },

  resultsSubtitle: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },

  resultsCountBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
  },

  resultsCount: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },

  resultsCountLabel: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  section: {
    marginTop: Spacing.five,
  },

  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },

  sectionIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },

  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  horizontalList: {
    flexDirection: "row-reverse",
    gap: Spacing.two,
    paddingBottom: Spacing.one,
  },

  storeResults: {
    gap: Spacing.two,
  },

  storeResult: {
    flexDirection: "row-reverse",
    alignItems: "center",
    minHeight: 86,
    padding: Spacing.three,
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  storeResultIcon: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },

  storeResultInfo: {
    flex: 1,
    alignItems: "flex-end",
  },

  storeResultName: {
    width: "100%",
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  storeResultDescription: {
    width: "100%",
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  storeResultMeta: {
    flexDirection: "row-reverse",
    gap: Spacing.three,
    marginTop: 4,
  },

  storeMetaItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
  },

  storeMetaText: {
    fontFamily: Fonts.medium,
    fontSize: 10,
  },

  storeArrow: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  productGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: Spacing.three,
  },

  pressed: {
    opacity: 0.7,
  },
});
