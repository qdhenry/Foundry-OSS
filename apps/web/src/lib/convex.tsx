"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ComponentProps, ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

const clerkAppearance: ComponentProps<typeof ClerkProvider>["appearance"] = {
  variables: {
    colorPrimary: "#2563eb",
    colorDanger: "#dc2626",
    colorSuccess: "#16a34a",
    colorWarning: "#d97706",
    colorText: "#0f172a",
    colorTextSecondary: "#475569",
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorInputText: "#0f172a",
    borderRadius: "6px",
    fontFamily: "var(--font-sans), 'DM Sans', system-ui, sans-serif",
    fontFamilyButtons: "var(--font-sans), 'DM Sans', system-ui, sans-serif",
    fontSize: "0.875rem",
  },
  elements: {
    card: {
      borderRadius: "var(--radius-xl)",
      border: "1px solid var(--border-default)",
      boxShadow: "var(--shadow-lg)",
      backgroundColor: "var(--component-modal-bg, var(--surface-default))",
    },
    formButtonPrimary: {
      background:
        "linear-gradient(135deg, var(--component-button-primary-gradient-start, #3b82f6), var(--component-button-primary-gradient-end, #2563eb))",
      borderRadius: "var(--radius-sm)",
      fontWeight: "500",
      fontSize: "0.875rem",
      letterSpacing: "0.02em",
    },
    "formButtonPrimary:hover": {
      boxShadow: "var(--shadow-button-hover)",
    },
    formFieldInput: {
      backgroundColor: "var(--component-input-bg, var(--surface-default))",
      border: "1px solid var(--component-input-border, var(--border-default))",
      borderRadius: "var(--radius-sm)",
      color: "var(--component-input-text, var(--text-primary))",
      fontSize: "0.875rem",
    },
    "formFieldInput:focus": {
      borderColor: "var(--component-input-focus-border, var(--accent-default))",
      boxShadow: "var(--shadow-focus-ring)",
    },
    formFieldLabel: {
      fontWeight: "500",
      fontSize: "0.75rem",
      color: "var(--text-secondary)",
    },
    headerTitle: {
      fontFamily: "var(--font-display), 'Instrument Serif', serif",
      fontWeight: "400",
      fontSize: "1.55rem",
      color: "var(--text-heading)",
    },
    headerSubtitle: {
      fontSize: "0.875rem",
      color: "var(--text-secondary)",
    },
    socialButtonsBlockButton: {
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-sm)",
      backgroundColor: "var(--surface-default)",
      color: "var(--text-primary)",
      fontSize: "0.875rem",
      fontWeight: "500",
    },
    dividerLine: {
      backgroundColor: "var(--border-default)",
    },
    footer: {
      backgroundColor: "var(--surface-raised)",
      borderTop: "1px solid var(--border-subtle)",
    },
    footerActionLink: {
      color: "var(--text-link)",
    },
    "footerActionLink:hover": {
      color: "var(--text-link-hover)",
    },
    formFieldErrorText: {
      fontSize: "0.75rem",
      color: "var(--status-error-fg)",
    },
    rootBox: {
      fontFamily: "var(--font-sans), 'DM Sans', system-ui, sans-serif",
    },
  },
};

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider appearance={clerkAppearance} afterSignUpUrl="/onboarding">
      {convex ? (
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          {children}
        </ConvexProviderWithClerk>
      ) : (
        children
      )}
    </ClerkProvider>
  );
}
