type CategoryNode = { id: string; parentId?: string | null };

export function categoryFilterIds(categories: readonly CategoryNode[], selected: string) {
  if (!categories.some(category => category.id === selected)) return new Set<string>();
  const children = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentId) continue;
    const siblings = children.get(category.parentId) ?? [];
    siblings.push(category.id);
    children.set(category.parentId, siblings);
  }
  const ids = new Set([selected]);
  for (const id of ids) {
    for (const child of children.get(id) ?? []) ids.add(child);
  }
  return ids;
}

export function categoryAncestors<T extends CategoryNode>(category: T, categories: ReadonlyMap<string, T>) {
  const path = [category];
  const seen = new Set([category.id]);
  let parentId = category.parentId;
  while (parentId && !seen.has(parentId)) {
    const parent = categories.get(parentId);
    if (!parent) break;
    seen.add(parentId);
    path.unshift(parent);
    parentId = parent.parentId;
  }
  return path;
}

export function categoryPath<T extends CategoryNode & { name: string }>(category: T, categories: ReadonlyMap<string, T>) {
  return categoryAncestors(category, categories).map(node => node.name).join(" / ");
}
