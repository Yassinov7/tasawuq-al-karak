type CategoryNode = { id: string; parentId?: string | null };

export function categoryFilterIds(categories: readonly CategoryNode[], selected: string) {
  if (!categories.some(category => category.id === selected)) return new Set<string>();
  return new Set([selected, ...categories.filter(category => category.parentId === selected).map(category => category.id)]);
}

export function categoryPath<T extends CategoryNode & { name: string }>(category: T, categories: ReadonlyMap<string, T>) {
  const parent = category.parentId ? categories.get(category.parentId) : undefined;
  return parent ? `${parent.name} / ${category.name}` : category.name;
}
