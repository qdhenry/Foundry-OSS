"use client";

import { CreateOrganization } from "@clerk/nextjs";

export default function OnboardingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-2 type-display-m text-text-heading">Welcome to Foundry</h1>
        <p className="mb-8 text-sm text-text-secondary">Create your organization to get started.</p>
        <CreateOrganization afterCreateOrganizationUrl="/programs" skipInvitationScreen />
      </div>
    </div>
  );
}
