// src/lib/supabase.ts
// Own Supabase client for the ecommerce storefront. Reads from the same
// Supabase project as REACT_SITE (shared CMS data), but this client and
// every query built on it lives entirely in this codebase.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(url, anonKey);
