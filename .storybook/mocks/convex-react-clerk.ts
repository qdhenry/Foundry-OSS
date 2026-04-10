/**
 * Mock for convex/react-clerk.
 * ConvexProviderWithClerk is used in the app's provider hierarchy.
 * In Storybook, we bypass it entirely since convex/react is already mocked.
 */
import React from "react";

export function ConvexProviderWithClerk({
  children,
}: {
  children: React.ReactNode;
  client?: unknown;
  useAuth?: unknown;
}) {
  return children;
}
