import { usePathname } from "next/navigation";

export function useBillingSettingsUrl(): string {
  const pathname = usePathname();
  const programSlug = pathname?.split("/").filter(Boolean)[0] ?? "";
  return programSlug ? `/${programSlug}/settings?tab=billing` : "/settings?tab=billing";
}

export function useProgramSettingsPath(): string {
  const pathname = usePathname();
  const programSlug = pathname?.split("/").filter(Boolean)[0] ?? "";
  return programSlug ? `/${programSlug}/settings` : "/settings";
}
