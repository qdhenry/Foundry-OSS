import { SignUp } from "@clerk/nextjs";
import { FoundryLogo } from "@foundry/ui/brand";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const redirectUrl = plan ? `/programs?plan=${encodeURIComponent(plan)}` : "/programs";

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page">
      <div className="flex flex-col items-center">
        <div className="mb-8">
          <FoundryLogo size="lg" />
        </div>
        <SignUp fallbackRedirectUrl={redirectUrl} />
      </div>
    </div>
  );
}
