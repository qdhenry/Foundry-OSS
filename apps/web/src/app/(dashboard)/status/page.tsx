"use client";

import { useOrganization } from "@clerk/nextjs";
import { StatusPageRoute } from "@foundry/ui/status";

export default function StatusPage() {
  const { organization } = useOrganization();
  return <StatusPageRoute orgId={organization?.id} />;
}
