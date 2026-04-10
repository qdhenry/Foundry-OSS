import {
  Suspense,
  lazy,
  type ComponentType,
  type JSX,
} from "react";

type DynamicImportResult<P> =
  | ComponentType<P>
  | { default: ComponentType<P> };

type DynamicLoader<P> = () => Promise<DynamicImportResult<P>>;

interface DynamicOptions<P> {
  loading?: ComponentType<P>;
  ssr?: boolean;
}

function normalizeDynamicImport<P>(
  value: DynamicImportResult<P>
): { default: ComponentType<P> } {
  if (
    value &&
    typeof value === "object" &&
    "default" in value &&
    typeof value.default === "function"
  ) {
    return value;
  }

  return { default: value as ComponentType<P> };
}

export default function dynamic<P extends object = Record<string, never>>(
  loader: DynamicLoader<P>,
  options: DynamicOptions<P> = {}
): ComponentType<P> {
  const LazyComponent = lazy(async () => {
    const loaded = await loader();
    return normalizeDynamicImport(loaded);
  });

  function DynamicComponent(props: P): JSX.Element {
    const LoadingComponent = options.loading;
    const fallback = LoadingComponent ? <LoadingComponent {...props} /> : null;

    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  }

  DynamicComponent.displayName = "DesktopNextDynamicShim";

  return DynamicComponent;
}
