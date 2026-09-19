export function getSortDirection(order: string | undefined): 1 | -1 {
  return order === 'desc' ? -1 : 1;
}
