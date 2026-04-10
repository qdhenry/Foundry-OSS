/**
 * Mock for @clerk/nextjs and @clerk/clerk-react in Storybook.
 * Provides stub implementations of all Clerk hooks and components
 * used across the Foundry codebase.
 */
import React from "react";
import { fn } from "@storybook/test";

// ─── Auth hooks ───────────────────────────────────────────────────────────

export function useAuth() {
  return {
    isLoaded: true,
    isSignedIn: true,
    userId: "user_storybook_demo",
    orgId: "org_foundry_demo",
    orgSlug: "foundry-demo",
    orgRole: "org:admin",
    sessionId: "sess_storybook",
    getToken: fn().mockName("clerk.getToken").mockResolvedValue("mock-jwt-token"),
    signOut: fn().mockName("clerk.signOut"),
  };
}

export function useUser() {
  return {
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: "user_storybook_demo",
      firstName: "Demo",
      lastName: "User",
      fullName: "Demo User",
      primaryEmailAddress: { emailAddress: "demo@foundry.io" },
      emailAddresses: [{ emailAddress: "demo@foundry.io" }],
      imageUrl: "",
      hasImage: false,
    },
  };
}

export function useOrganization() {
  return {
    isLoaded: true,
    organization: {
      id: "org_foundry_demo",
      name: "Foundry Demo",
      slug: "foundry-demo",
      imageUrl: "",
      membersCount: 5,
    },
    membership: {
      role: "org:admin",
    },
  };
}

export function useOrganizationList() {
  return {
    isLoaded: true,
    userMemberships: {
      data: [
        {
          organization: {
            id: "org_foundry_demo",
            name: "Foundry Demo",
            slug: "foundry-demo",
          },
          role: "org:admin",
        },
      ],
    },
    setActive: fn().mockName("clerk.setActive"),
  };
}

export function useClerk() {
  return {
    signOut: fn().mockName("clerk.signOut"),
    openSignIn: fn().mockName("clerk.openSignIn"),
    openSignUp: fn().mockName("clerk.openSignUp"),
    openUserProfile: fn().mockName("clerk.openUserProfile"),
    openOrganizationProfile: fn().mockName("clerk.openOrganizationProfile"),
  };
}

export function useSignIn() {
  return { isLoaded: true, signIn: null, setActive: fn() };
}

export function useSignUp() {
  return { isLoaded: true, signUp: null, setActive: fn() };
}

// ─── Components ───────────────────────────────────────────────────────────

export function UserButton() {
  return React.createElement(
    "div",
    {
      className: "flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs text-white font-medium",
      "aria-label": "User menu",
    },
    "DU"
  );
}

export function OrganizationSwitcher() {
  return React.createElement(
    "div",
    { className: "text-sm text-text-secondary" },
    "Foundry Demo"
  );
}

export function SignIn() {
  return React.createElement("div", null, "Sign In (Storybook Mock)");
}

export function SignUp() {
  return React.createElement("div", null, "Sign Up (Storybook Mock)");
}

export function ClerkProvider({ children }: { children: React.ReactNode }) {
  return children;
}

export function SignedIn({ children }: { children: React.ReactNode }) {
  return children;
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  return null;
}

export function Protect({ children }: { children: React.ReactNode }) {
  return children;
}

// ─── Server-side stubs ────────────────────────────────────────────────────

export function auth() {
  return { userId: "user_storybook_demo", orgId: "org_foundry_demo" };
}

export function currentUser() {
  return { id: "user_storybook_demo", firstName: "Demo", lastName: "User" };
}

export function clerkClient() {
  return {};
}
