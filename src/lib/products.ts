// src/lib/products.ts
// Own product data functions for the ecommerce storefront. Queries the same
// `products` table REACT_SITE reads (see its src/local-storage/supabaseReader.js
// and visibility.js), reimplemented independently here for Astro.
import { supabase } from "./supabase";

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

export async function getVisibleProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select(LISTING_COLUMNS)
    .eq("visible", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[products] Failed to fetch products:", error.message);
    return [];
  }

  return ((data as unknown as Product[]) || []).filter((p) => isPubliclyVisible(p));
}

export function getCategories(products: Product[]): string[] {
  const set = new Set<string>();
  for (const p of products) {
    for (const c of p.categories || []) set.add(c);
  }
  return [...set].sort();
}
