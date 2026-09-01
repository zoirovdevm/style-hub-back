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

// Same JSON-string-column pattern as parseJsonArray above, but for
// Product.colorImages' nested [{ color, images }] shape (see
// product.service.ts's own parseColorImages, which this mirrors).
export function parseColorImagesJsonArray(value: unknown): { color: string; images: string[] }[] {
  if (Array.isArray(value)) return value as { color: string; images: string[] }[];
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is { color: string; images: string[] } => !!v && typeof v.color === 'string' && Array.isArray(v.images),
    );
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
    // ROOT-CAUSE FIX: this field was added to Product (colorImages) and to
    // the PRODUCT_FIELDS/PRODUCT_FIELDS_STR GraphQL fragments (so cart,
    // wishlist, and order queries all request it now) without also being
    // parsed here — every place that goes through mapProductArrays instead
    // of product.service.ts's own mapProduct() kept returning the raw
    // JSON-encoded STRING for a field GraphQL expects as [ColorImages],
    // which fails to serialize and breaks the whole query. Symptom this
    // caused: toggling a wishlist heart appeared to work (the DB row was
    // actually created fine) but myWishlist's own query then failed the
    // same way, so the wishlist page never showed anything.
    colorImages: parseColorImagesJsonArray(product.colorImages),
  };
}
