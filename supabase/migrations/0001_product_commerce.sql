-- ============================================================
-- SAWO_ECOM: product_commerce table + product_display view
-- NOT YET APPLIED — draft for review. Run manually via the Supabase SQL
-- editor once approved (no supabase CLI/migration runner is wired up for
-- this project yet; this file is the durable record, same convention as
-- REACT_SITE's frontend/src/Administrator/Local/scripts/setup-*.sql files).
--
-- WHY A SEPARATE TABLE: `products` is shared, read/written by both
-- REACT_SITE and SAWO_ECOM. Ecommerce-only fields (price, stock, rating)
-- don't belong on it — REACT_SITE has no use for them and every column
-- added there is one more thing REACT_SITE's `select("*")` drags along.
-- Keeping them in product_commerce means REACT_SITE needs zero changes.
--
-- SCOPE: images, descriptions, name, categories, etc. stay exactly where
-- they are on `products` — both the REACT_SITE admin and the future
-- SAWO_ECOM CMS write to that same table/row, so those fields are synced
-- by construction, not by any sync process. This migration only adds the
-- ecom-specific fields that have nowhere to live today: SKU, price,
-- compare-at price, stock, and rating. (No cost_price/supplier/warehouse
-- fields — not asked for; add a separate internal-only table later if
-- COGS/supplier tracking becomes a real need, don't build it speculatively.)
--
-- VARIANTS: checked live data before writing this — 0 of 330 products use
-- `parent_product_id` (rows-based variants are unused), 163 of 330 have a
-- populated `variants` jsonb array (color/finish swatches only, no
-- per-variant id/sku/price/stock). So the purchasable unit today is one
-- row per products.id, and product_commerce can be a straight 1:1 FK to
-- products.id with no jsonb restructuring. If per-variant pricing/stock is
-- ever needed (e.g. different price per color), that's a real schema
-- change to revisit deliberately, not something to infer here.
--
-- RATINGS: no reviews/ratings table exists anywhere in the DB or codebase
-- (checked). rating_average/rating_count are plain admin-entered columns,
-- not aggregated from anything.
--
-- RLS: mirrors `products`' existing policy exactly (see
-- setup-rls-content-tables.sql) — permissive anon/authenticated
-- read+write. The future SAWO_ECOM CMS will write price/stock through the
-- same public anon key REACT_SITE's admin already uses to write products
-- today; that existing policy is documented there as "not real security,
-- pending real Supabase-Auth-based authorization" — this table accepts
-- the same known, already-live risk rather than inventing an inconsistent
-- stricter model for just one table. Tighten both together later if real
-- per-app auth lands.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_commerce (
  product_id uuid NOT NULL,
  sku text UNIQUE,
  price numeric(12,2) NOT NULL DEFAULT 0,
  compare_at_price numeric(12,2),
  currency text NOT NULL DEFAULT 'PHP',
  stock_quantity integer NOT NULL DEFAULT 0,
  -- Explicit, CMS-settable rather than purely derived from stock_quantity
  -- so "preorder"/"backorder" can be marked even while quantity is 0.
  stock_status text NOT NULL DEFAULT 'in_stock',
  low_stock_threshold integer DEFAULT 5,
  allow_backorder boolean DEFAULT false,
  is_purchasable boolean DEFAULT true,
  rating_average numeric(2,1),
  rating_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT product_commerce_pkey PRIMARY KEY (product_id),
  CONSTRAINT product_commerce_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products(id) ON DELETE CASCADE,
  CONSTRAINT product_commerce_stock_status_check
    CHECK (stock_status IN ('in_stock', 'out_of_stock', 'preorder', 'backorder'))
);

ALTER TABLE public.product_commerce ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_commerce_select" ON public.product_commerce;
CREATE POLICY "product_commerce_select" ON public.product_commerce
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "product_commerce_insert" ON public.product_commerce;
CREATE POLICY "product_commerce_insert" ON public.product_commerce
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "product_commerce_update" ON public.product_commerce;
CREATE POLICY "product_commerce_update" ON public.product_commerce
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "product_commerce_delete" ON public.product_commerce;
CREATE POLICY "product_commerce_delete" ON public.product_commerce
  FOR DELETE TO anon, authenticated USING (true);

-- Read-only convenience projection for anything that wants products +
-- commerce fields joined and pre-filtered to what's publicly visible.
-- Mirrors REACT_SITE's local-storage/visibility.js isPubliclyVisible()
-- exactly (is_deleted false, visible true, status published OR publish_at
-- already in the past) so callers don't have to reimplement that check.
-- Optional for REACT_SITE — it keeps reading raw `products` unmodified;
-- this view exists for SAWO_ECOM (and for REACT_SITE later, if it ever
-- wants to show price/stock without duplicating the visibility logic).
CREATE OR REPLACE VIEW public.product_display AS
SELECT
  p.*,
  pc.sku,
  pc.price,
  pc.compare_at_price,
  pc.currency,
  pc.stock_quantity,
  pc.stock_status,
  (pc.stock_status = 'in_stock' AND pc.stock_quantity > 0) AS in_stock,
  pc.low_stock_threshold,
  (pc.stock_quantity > 0 AND pc.stock_quantity <= pc.low_stock_threshold) AS is_low_stock,
  pc.is_purchasable,
  pc.rating_average,
  pc.rating_count
FROM public.products p
LEFT JOIN public.product_commerce pc ON pc.product_id = p.id
WHERE p.is_deleted = false
  AND p.visible = true
  AND (p.status = 'published' OR (p.publish_at IS NOT NULL AND p.publish_at <= now()));

GRANT SELECT ON public.product_display TO anon, authenticated;

-- Supabase's linter flags views as SECURITY DEFINER by default (they run
-- with the creator's privileges unless told otherwise) — force it to run
-- with the querying user's own permissions instead, so RLS on the
-- underlying tables is actually respected through the view.
ALTER VIEW public.product_display SET (security_invoker = true);

-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP VIEW IF EXISTS public.product_display;
-- DROP TABLE IF EXISTS public.product_commerce;
