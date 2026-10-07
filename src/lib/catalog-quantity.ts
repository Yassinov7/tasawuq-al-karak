const QUANTITY_SCALE = 1000;

export function normalizeCatalogQuantity(quantity: number) {
  return Math.round(quantity * QUANTITY_SCALE) / QUANTITY_SCALE;
}

export function snapCatalogQuantity(
  requested: number,
  minimum: number,
  step: number,
) {
  const minimumUnits = Math.round(minimum * QUANTITY_SCALE);
  const stepUnits = Math.max(1, Math.round(step * QUANTITY_SCALE));
  const requestedUnits = Math.max(0, Math.round(requested * QUANTITY_SCALE));
  const steps = Math.ceil(Math.max(0, requestedUnits - minimumUnits) / stepUnits);

  return (minimumUnits + steps * stepUnits) / QUANTITY_SCALE;
}
