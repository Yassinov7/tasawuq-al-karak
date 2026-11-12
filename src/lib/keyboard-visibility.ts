/** Window-relative measurements; supports both resized Android windows and overlaid keyboards. */
export function keyboardFormLayout(viewTop: number, viewHeight: number, keyboardTop: number, toolbarHeight = 44) {
  const overlap = Math.max(0, viewTop + viewHeight - keyboardTop);
  return { overlap, bottomSpace: overlap + toolbarHeight + 16, visibleBottom: Math.min(viewTop + viewHeight, keyboardTop) - toolbarHeight - 16 };
}
export function focusedFieldScroll(currentScroll: number, fieldTop: number, fieldHeight: number, viewTop: number, visibleBottom: number): number {
  const top = viewTop + 12;
  if (fieldTop < top || fieldHeight > visibleBottom - top) return Math.max(0, currentScroll + fieldTop - top);
  return Math.max(0, currentScroll + Math.max(0, fieldTop + fieldHeight - visibleBottom));
}
