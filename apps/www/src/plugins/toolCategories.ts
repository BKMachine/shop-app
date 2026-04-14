export const toolCategories = ['milling', 'turning', 'swiss', 'other'] as const;
export const toolFilterCategories = [...toolCategories, 'all'] as const;

export function isToolCategory(value: string | null | undefined): value is ToolCategory {
  return typeof value === 'string' && toolCategories.includes(value as ToolCategory);
}

export function isToolFilterCategory(
  value: string | null | undefined,
): value is ToolFilterCategory {
  return typeof value === 'string' && toolFilterCategories.includes(value as ToolFilterCategory);
}
