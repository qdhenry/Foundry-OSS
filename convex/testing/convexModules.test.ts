import type { ConvexTestModuleMap } from "../test.helpers";

/**
 * Shared module glob for convex-test.
 *
 * This file MUST live close to the convex root so that import.meta.glob
 * produces consistent relative paths. When test files are deeply nested
 * (e.g., convex/atlassian/jira/__tests__/), Vite normalizes glob results
 * relative to the importing file, breaking convex-test's module resolution.
 *
 * By defining the glob here (one level below convex/), all paths are
 * relative to convex/testing/ and convex-test can find _generated/ and
 * all function modules consistently.
 */
type ImportMetaWithGlob = ImportMeta & {
  glob: (pattern: string) => ConvexTestModuleMap;
};

const importMetaWithGlob = import.meta as ImportMetaWithGlob;

export const modules: ConvexTestModuleMap = importMetaWithGlob.glob("../**/*.ts");
