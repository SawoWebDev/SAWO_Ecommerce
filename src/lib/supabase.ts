// src/lib/supabase.ts
// Own Supabase client for the ecommerce storefront, reading from the same
// Supabase project as REACT_SITE (shared CMS data) but built entirely in
// this codebase.
//
// Built per-request rather than as a module-level singleton: on Cloudflare,
// wrangler.jsonc's `vars` are only injected into the Worker's runtime env
// (Astro.locals.runtime.env), not into the Vite build step, so
// import.meta.env.PUBLIC_* is undefined in the deployed SSR bundle. Reading
// runtimeEnv first (falling back to import.meta.env for local `astro dev`,
// which Vite does inline) makes both cases work.
import { createClient } from "@supabase/supabase-js";

export function getSupabase(runtimeEnv?: Partial<CloudflareEnv>) {
  const url = runtimeEnv?.PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
  const anonKey = runtimeEnv?.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY");
  }

  return createClient(url, anonKey);
}
