# SAWO_ECOM

Independent Astro storefront for SAWO products. Shares the **Supabase
`products` table** with the main site (`REACT_SITE`) but has no runtime or
build dependency on it — separate codebase, separate GitHub repo, separate
Cloudflare deployment.

## Phase 1

Single page (`/`): Header → Hero → Category filter → Product grid → Footer.
Real products, pulled live from Supabase, filtered to publicly-visible rows
the same way the main site does (`src/lib/products.ts`).

Not built yet (future phases): payments, checkout, accounts, orders,
shipping, product detail routes, cart.

## Data model

Reuses the existing `products` table as-is — no second table, no duplicated
data. Current schema has no price/SKU/stock fields; the card only shows
fields that actually exist (image, name, category, short description).
Product images (`thumbnail`, `images[]`) are already absolute R2-backed
URLs, so they're used directly with no separate R2 binding needed here.

## Setup

```bash
npm install
cp .env.example .env   # fill in PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY
                        # (same Supabase project as REACT_SITE, anon key only)
npm run dev
```

## Deploy

Astro + `@astrojs/cloudflare` (server output). Push to its own GitHub repo
and connect to a Cloudflare Pages/Workers project; set the same two env
vars there. `wrangler.jsonc` is pre-configured for Pages deployment.
