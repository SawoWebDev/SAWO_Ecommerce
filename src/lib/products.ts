// src/lib/products.ts
// Own product data functions for the ecommerce storefront. Queries
// `product_display` — a view (see supabase/migrations/0001_product_commerce.sql)
// that joins the same `products` table REACT_SITE reads with the
// ecommerce-only `product_commerce` table, and applies the same visibility
// rule REACT_SITE's local-storage/visibility.js enforces client-side
// (is_deleted false, visible true, published or publish_at already past) —
// server-side, in the view's WHERE clause, so it doesn't need reimplementing
// here.
import { getSupabase } from "./supabase";

export interface Product {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  thumbnail: string | null;
  images: string[] | null;
  categories: string[] | null;
  tags: string[] | null;
  features: string[] | null;
  brand: string | null;
  featured: boolean | null;
  sort_order: number | null;
  // Ecommerce fields, from product_commerce via the product_display view.
  // Null when no product_commerce row exists yet (not priced by the ecom
  // CMS yet) — callers should treat that as "not orderable", not as zero.
  sku: string | null;
  price: number | null;
  compare_at_price: number | null;
  currency: string | null;
  stock_status: "in_stock" | "out_of_stock" | "preorder" | "backorder" | null;
  in_stock: boolean | null;
  is_low_stock: boolean | null;
  is_purchasable: boolean | null;
  rating_average: number | null;
  rating_count: number | null;
}

const LISTING_COLUMNS =
  "id,name,slug,short_description,thumbnail,images,categories,tags,features,brand,featured,sort_order," +
  "sku,price,compare_at_price,currency,stock_status,in_stock,is_low_stock,is_purchasable,rating_average,rating_count";

// Accessory-only scope for this storefront: heaters, steam, sauna rooms,
// infrared, and controls are excluded. Group definitions (category + tag
// matches) are ported from REACT_SITE's per-category pages
// (src/pages/Sauna/accessories/*.jsx — e.g. PailsLadles.jsx's
// DISPLAY_CATEGORIES/DISPLAY_TAGS) so a product shows up here under the
// same rules it shows up there.
export interface AccessoryGroup {
  label: string;
  categories: string[];
  tags: string[];
}

export const ACCESSORY_GROUPS: AccessoryGroup[] = [
  { label: "Pails & Ladles", categories: ["Pails", "Ladles", "Pail Shower"], tags: ["Pail Shower"] },
  { label: "Thermometers & Combined Meters", categories: ["Thermometers", "Combined Meters", "Hygrometers"], tags: ["Thermometers"] },
  { label: "Clocks & Timers", categories: ["Clocks", "Sand Timers", "Clocks & Timers"], tags: ["Clocks & Timers"] },
  { label: "Sauna Lights", categories: ["Sauna Lights", "Light Covers", "Lights & Covers"], tags: ["Sauna Lights"] },
  { label: "Headrest & Backrests", categories: ["Headrests", "Backrests", "Headrest & Backrest"], tags: ["Headrest & Backrest"] },
  { label: "Doors & Handles", categories: ["Doors & Handles", "Sauna Doors", "Sauna Handles"], tags: ["Doors & Handles"] },
  { label: "Benches, Hangers & Floor Mats", categories: ["Benches", "Wooden Floor Mats", "Cloth Hangers", "Benches & Floor Tiles"], tags: ["Benches", "Wooden Floor Mats", "Cloth Hangers"] },
  { label: "Kivistone", categories: ["Kivistone"], tags: ["Kivistone"] },
  { label: "Ventilations & Miscellaneous Items", categories: ["Ventilation & Miscellaneous", "Ventilations", "Add-Ons", "Cloth Hangers"], tags: ["Ventilation & Miscellaneous", "Cloth Hangers"] },
  { label: "Accessory Sets", categories: ["Accessory Sets"], tags: ["Accessory Sets"] },
];

function arrayMatchesAny(arr: string[] | null | undefined, targets: string[]): boolean {
  if (!targets.length || !arr?.length) return false;
  const lower = targets.map((t) => t.toLowerCase());
  return arr.some((item) => lower.includes(item.toLowerCase()));
}

// Every accessory group a product belongs to (a product can land in more
// than one — e.g. tagged both "Kivistone" and "Ventilations").
export function getAccessoryGroupsForProduct(product: Product): string[] {
  return ACCESSORY_GROUPS.filter(
    (g) => arrayMatchesAny(product.categories, g.categories) || arrayMatchesAny(product.tags, g.tags)
  ).map((g) => g.label);
}

function isAccessoryProduct(product: Product): boolean {
  return getAccessoryGroupsForProduct(product).length > 0;
}

// Featured items first, then CMS sort_order, then name as a stable tiebreaker.
function byFeaturedThenSortOrder(a: Product, b: Product): number {
  const fa = a.featured ? 0 : 1;
  const fb = b.featured ? 0 : 1;
  if (fa !== fb) return fa - fb;
  const sa = a.sort_order ?? 999;
  const sb = b.sort_order ?? 999;
  if (sa !== sb) return sa - sb;
  return (a.name || "").localeCompare(b.name || "");
}

export async function getVisibleProducts(runtimeEnv?: Partial<CloudflareEnv>): Promise<Product[]> {
  const { data, error } = await getSupabase(runtimeEnv)
    .from("product_display")
    .select(LISTING_COLUMNS)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[products] Failed to fetch products:", error.message);
    return [];
  }

  return ((data as unknown as Product[]) || [])
    .filter(isAccessoryProduct)
    .sort(byFeaturedThenSortOrder);
}

export function getAccessoryGroupLabels(products: Product[]): string[] {
  const present = new Set<string>();
  for (const p of products) {
    for (const label of getAccessoryGroupsForProduct(p)) present.add(label);
  }
  return ACCESSORY_GROUPS.map((g) => g.label).filter((label) => present.has(label));
}
