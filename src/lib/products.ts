// src/lib/products.ts
// Own product data functions for the ecommerce storefront. Queries the same
// `products` table REACT_SITE reads (see its src/local-storage/supabaseReader.js
// and visibility.js), reimplemented independently here for Astro.
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
  status: string | null;
  visible: boolean | null;
  publish_at: string | null;
  featured: boolean | null;
  sort_order: number | null;
  is_deleted: boolean | null;
}

const LISTING_COLUMNS =
  "id,name,slug,short_description,thumbnail,images,categories,tags,features,brand,status,visible,publish_at,featured,sort_order,is_deleted";

// A product is visible to shoppers when it isn't soft-deleted, hasn't been
// hidden, and is either explicitly published or has a publish_at in the past.
// Mirrors REACT_SITE's local-storage/visibility.js isPubliclyVisible().
export function isPubliclyVisible(product: Product, now: number = Date.now()): boolean {
  if (!product) return false;
  if (product.is_deleted) return false;
  if (product.visible === false) return false;
  if (product.status === "published") return true;
  if (product.publish_at && new Date(product.publish_at).getTime() <= now) return true;
  return false;
}

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

// Featured items first, then CMS sort_order, then newest-defined name order
// as a stable tiebreaker.
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
    .from("products")
    .select(LISTING_COLUMNS)
    .eq("visible", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[products] Failed to fetch products:", error.message);
    return [];
  }

  return ((data as unknown as Product[]) || [])
    .filter((p) => isPubliclyVisible(p) && isAccessoryProduct(p))
    .sort(byFeaturedThenSortOrder);
}

export function getAccessoryGroupLabels(products: Product[]): string[] {
  const present = new Set<string>();
  for (const p of products) {
    for (const label of getAccessoryGroupsForProduct(p)) present.add(label);
  }
  return ACCESSORY_GROUPS.map((g) => g.label).filter((label) => present.has(label));
}
