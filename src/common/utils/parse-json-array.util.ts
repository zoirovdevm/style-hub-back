/**
 * Product.sizes/colors/images are stored as JSON-encoded strings in the DB
 * (SQLite has no native array/Json type — see prisma/schema.prisma). Any
 * place a `product` relation is included (cart, wishlist, order items, and
 * product.service.ts itself) needs to convert those fields back into real
 * string[] before the GraphQL layer serializes them as `[String]`.
 */
export function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function mapProductArrays<T extends Record<string, any>>(product: T | null | undefined): T | null | undefined {
  if (!product) return product;
  return {
    ...product,
    sizes: parseJsonArray(product.sizes),
    colors: parseJsonArray(product.colors),
    images: parseJsonArray(product.images),
  };
}
