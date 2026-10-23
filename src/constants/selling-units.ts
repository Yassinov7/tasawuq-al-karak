// selling_unit is existing free text (1–32 chars), not a database enum.
// Keep an old/custom value selectable verbatim; never silently convert saved units.
const units = ["قطعة", "كيلوغرام", "غرام", "لتر", "ملليلتر", "عبوة", "صندوق", "كيس", "ربطة", "متر", "كغ", "غ", "مل", "كوب", "وجبة", "جهاز", "مجموعة", "دفتر", "كتاب", "باقة"];
export function sellingUnitOptions(current: string) {
  const values = current && !units.includes(current) ? [current, ...units] : units;
  return values.map((value) => ({ value, label: value === "كغ" ? "كيلوغرام (كغ)" : value === "غ" ? "غرام (غ)" : value === "مل" ? "ملليلتر (مل)" : value }));
}
