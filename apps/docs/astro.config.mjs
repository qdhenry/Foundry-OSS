// @ts-check
import mdx from "@astrojs/mdx";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import rehypeMermaid from "rehype-mermaid";

// https://astro.build/config
//
// Deployment: Cloudflare Pages at https://docs.foundryworks.com
// No `base` is set — this is a subdomain deployment, not a path mount.
//
// i18n note: we use the `root` locale pattern so content lives in
// `src/content/docs/` with clean URLs at the root (`/getting-started`,
// not `/en/getting-started`). To add a second locale later, switch
// `root` to `en` and introduce a new locale key; Starlight will reshape
// URLs to include the locale prefix at that point.
export default defineConfig({
  site: "https://docs.foundryworks.com",
  integrations: [
    starlight({
      title: "Foundry",
      description:
        "Agentic Delivery Platform — open-source docs for self-hosters, contributors, and integrators.",
      defaultLocale: "root",
      locales: {
        root: { label: "English", lang: "en" },
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/qdhenry/Foundry",
        },
      ],
      editLink: {
        baseUrl: "https://github.com/qdhenry/Foundry/edit/main/apps/docs/",
      },
      components: {
        Head: "./src/components/Head.astro",
      },
      customCss: ["./src/styles/foundry-tokens.css", "./src/styles/foundry-theme.css"],
      lastUpdated: true,
      pagination: true,
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { slug: "getting-started" },
            { slug: "getting-started/prerequisites" },
            { slug: "getting-started/quickstart" },
            { slug: "getting-started/first-program" },
            { slug: "getting-started/environment-variables" },
          ],
        },
        {
          label: "Guides",
          items: [
            {
              label: "Architecture & Concepts",
              autogenerate: { directory: "architecture" },
              collapsed: false,
            },
            {
              label: "Deployment & Operations",
              autogenerate: { directory: "deployment" },
              collapsed: false,
            },
            {
              label: "Features",
              autogenerate: { directory: "features" },
              collapsed: true,
            },
            {
              label: "Troubleshooting",
              autogenerate: { directory: "troubleshooting" },
              collapsed: true,
            },
          ],
        },
        {
          label: "Reference",
          items: [
            { slug: "reference" },
            {
              label: "Schema",
              autogenerate: { directory: "reference/generated/schema" },
              collapsed: true,
            },
            {
              label: "Functions",
              autogenerate: { directory: "reference/generated/functions" },
              collapsed: true,
            },
          ],
        },
        {
          label: "Contributing",
          autogenerate: { directory: "contributing" },
          collapsed: true,
        },
      ],
    }),
    mdx(),
  ],
  markdown: {
    // Mermaid diagrams embedded in MDX via triple-backtick `mermaid` blocks.
    // `img-svg` strategy pre-renders to SVG at build time (no client JS).
    rehypePlugins: [[rehypeMermaid, { strategy: "img-svg" }]],
  },
});
