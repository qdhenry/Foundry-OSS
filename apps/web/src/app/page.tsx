import { SignIn } from "@clerk/nextjs";
import { FoundryLogo } from "@foundry/ui/brand";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface-page">
      <FoundryLogo size="lg" />
      <p className="mt-4 text-lg text-text-secondary">Agentic Delivery Platform</p>
      <div className="mt-8">
        <SignIn fallbackRedirectUrl="/programs" />
      </div>
    </main>
  );
}
