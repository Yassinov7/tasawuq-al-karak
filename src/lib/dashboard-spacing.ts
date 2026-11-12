import { Spacing } from "@/constants/theme";

/** Uses the already-cleared content viewport, not the full device height.
 * Section heights exclude these gaps, so measuring never feeds back into itself.
 * Extra room is bounded; large text and overflowing content keep compact gaps.
 */
export function dashboardSectionGap(viewport: number, content: number, sections: number, fontScale: number) {
  if (viewport <= 0 || content <= 0 || sections < 2 || fontScale > 1.25) return Spacing.two;
  const available = (viewport - content - Spacing.four * 2) / (sections - 1);
  return available >= Spacing.four ? Spacing.four : available >= Spacing.three ? Spacing.three : Spacing.two;
}
