import { SignIn } from "@clerk/nextjs";
import { FoundryLogo } from "@foundry/ui/brand";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page">
      <div className="flex flex-col items-center">
        <div className="mb-8">
          <FoundryLogo size="lg" />
        </div>
        <SignIn fallbackRedirectUrl="/programs" />
      </div>
    </div>
  );
}
