"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useProgramContext } from "../programs";
import { ProgramDiscoveryRoute } from "./ProgramDiscoveryRoute";

function useDocumentsDiscoveryRedirect() {
  const router = useRouter();
  const { slug } = useProgramContext();

  useEffect(() => {
    router.replace(`/${slug}/discovery?section=documents`);
  }, [router, slug]);
}

export function ProgramDocumentsRoute() {
  useDocumentsDiscoveryRedirect();
  return <ProgramDiscoveryRoute />;
}
