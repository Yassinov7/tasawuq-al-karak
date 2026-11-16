export type OrderedCartItem = {
  productId: string;
  quantity: number;
};

/**
 * Updates an existing cart line without moving it. New lines are appended, while
 * deletion is the only operation that removes a position from the sequence.
 */
export function updateOrderedCartItem<T extends OrderedCartItem>(
  items: readonly T[],
  productId: string,
  quantity: number,
): T[] {
  const itemIndex = items.findIndex((item) => item.productId === productId);

  if (quantity <= 0) {
    return itemIndex < 0
      ? [...items]
      : items.filter((_, index) => index !== itemIndex);
  }

  if (itemIndex < 0) {
    return [...items, { productId, quantity } as T];
  }

  return items.map((item, index) =>
    index === itemIndex ? { ...item, quantity } : item,
  );
}

export function isCartReadCurrent(
  readVersion: number,
  currentVersion: number,
) {
  return readVersion === currentVersion;
}
