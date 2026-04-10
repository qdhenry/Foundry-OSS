// Shared test helper — glob must be called from the convex root to get consistent paths
export type ConvexTestModuleLoader = () => Promise<any>;
export type ConvexTestModuleMap = Record<string, ConvexTestModuleLoader>;

type ImportMetaWithGlob = ImportMeta & {
  glob: (pattern: string) => ConvexTestModuleMap;
};

export const modules: ConvexTestModuleMap = (import.meta as ImportMetaWithGlob).glob("./**/*.*s");
