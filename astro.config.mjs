import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

// Server-rendered so product data (and CMS visibility toggles) stay live
// without a rebuild — mirrors how the existing React site reads Supabase
// at runtime rather than baking data in at build time.
export default defineConfig({
  output: "server",
  adapter: cloudflare({
    imageService: "compile",
  }),
});
