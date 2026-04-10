import { defineCollection } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { z } from "astro/zod";

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        /**
         * ISO date (YYYY-MM-DD) the page was last reviewed for accuracy.
         * Set during Phase 3 content drafting and refreshed in Phase 4 review.
         */
        lastReviewed: z.string().optional(),
        /**
         * Version tag this page belongs to. Use `latest` for current,
         * `v1`/`v2`/... for historical snapshots.
         */
        versionTag: z.enum(["latest", "v1"]).optional().default("latest"),
        /**
         * Set by `generate-reference.ts` on auto-generated pages. Format:
         * `<relative-source-path>@<commit-sha>`. Hand-written pages omit this.
         */
        generatedFrom: z.string().optional(),
      }),
    }),
  }),
};
