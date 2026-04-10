"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";

/* ---------- Types ---------- */

interface PricingPlan {
  _id: string;
  slug: string;
  displayName: string;
  tagline: string;
  monthlyPriceUsd: number;
  annualPriceUsd?: number;
  overageRateUsd: number;
  limits: {
    maxSeats: number;
    maxPrograms: number;
    maxSessionsPerMonth: number;
  };
  features: string[];
  buyingMotion: "self_serve" | "sales_assisted" | "annual_contract";
  sortOrder: number;
}

/* ---------- Hardcoded fallback (mirrors seed data) ---------- */

const FALLBACK_PLANS: PricingPlan[] = [
  {
    _id: "fallback-crucible",
    slug: "crucible",
    displayName: "Crucible",
    tagline: "For solo operators shipping fast",
    monthlyPriceUsd: 299,
    overageRateUsd: 5,
    limits: { maxSeats: 1, maxPrograms: 5, maxSessionsPerMonth: 50 },
    features: [
      "All integrations (GitHub, Jira, Confluence)",
      "Health scoring & daily digests",
      "Audit trail",
      "Email support",
    ],
    buyingMotion: "self_serve",
    sortOrder: 1,
  },
  {
    _id: "fallback-forge",
    slug: "forge",
    displayName: "Forge",
    tagline: "For teams that deliver together",
    monthlyPriceUsd: 1800,
    overageRateUsd: 4,
    limits: { maxSeats: 10, maxPrograms: -1, maxSessionsPerMonth: 300 },
    features: [
      "All integrations (GitHub, Jira, Confluence)",
      "Health scoring & daily digests",
      "Audit trail",
      "Priority support",
      "Team collaboration",
      "Advanced analytics",
    ],
    buyingMotion: "sales_assisted",
    sortOrder: 2,
  },
  {
    _id: "fallback-foundry",
    slug: "foundry",
    displayName: "Foundry",
    tagline: "For organizations scaling delivery",
    monthlyPriceUsd: 8000,
    annualPriceUsd: 96000,
    overageRateUsd: 3,
    limits: { maxSeats: -1, maxPrograms: -1, maxSessionsPerMonth: 1500 },
    features: [
      "All integrations (GitHub, Jira, Confluence)",
      "Health scoring & daily digests",
      "Audit trail",
      "Priority support",
      "Team collaboration",
      "Advanced analytics",
      "Dedicated support",
      "Custom SLA",
      "SSO/SAML",
      "Volume API pricing",
    ],
    buyingMotion: "annual_contract",
    sortOrder: 3,
  },
];

/* ---------- Feature matrix definition ---------- */

interface FeatureRow {
  label: string;
  crucible: boolean;
  forge: boolean;
  foundry: boolean;
}

const FEATURE_MATRIX: FeatureRow[] = [
  {
    label: "All integrations (GitHub, Jira, Confluence)",
    crucible: true,
    forge: true,
    foundry: true,
  },
  { label: "Health scoring & daily digests", crucible: true, forge: true, foundry: true },
  { label: "Audit trail", crucible: true, forge: true, foundry: true },
  { label: "Priority support", crucible: false, forge: true, foundry: true },
  { label: "Team collaboration", crucible: false, forge: true, foundry: true },
  { label: "Advanced analytics", crucible: false, forge: true, foundry: true },
  { label: "Dedicated support", crucible: false, forge: false, foundry: true },
  { label: "Custom SLA", crucible: false, forge: false, foundry: true },
  { label: "SSO/SAML", crucible: false, forge: false, foundry: true },
];

/* ---------- FAQ data ---------- */

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: "What happens when I exceed my included sessions?",
    answer:
      "Overage sessions are billed at your tier's per-session rate at the end of each billing cycle. Crucible: $5/session, Forge: $4/session, Foundry: $3/session. You'll receive a notification when you hit 80% and 100% of your included sessions so there are no surprises.",
  },
  {
    question: "Can I upgrade or downgrade anytime?",
    answer:
      "Yes. Upgrades take effect immediately and are prorated for the remainder of your billing cycle. Downgrades take effect at the start of your next billing cycle so you keep access to your current tier's features until then.",
  },
  {
    question: "What's included in The Smelt Experience?",
    answer:
      "The Smelt Experience gives you 1 program, 10 sandbox sessions, and access to all core features including document analysis, requirement extraction, and AI health scoring. There's no time limit and no credit card required.",
  },
  {
    question: "Do you offer annual billing?",
    answer:
      "Yes. The Foundry tier is available with annual billing, which saves you the equivalent of two months compared to monthly billing. Contact our sales team to set up an annual contract.",
  },
  {
    question: "What's your refund policy?",
    answer:
      "We offer a 30-day money-back guarantee on all paid plans. If Foundry isn't the right fit, contact us within 30 days of your first payment for a full refund.",
  },
  {
    question: "How does the sandbox session system work?",
    answer:
      "Each sandbox session provisions an ephemeral AI coding environment scoped to a specific task. The agent clones your repo, installs dependencies, executes the task, and pushes changes — all autonomously. Sessions are counted per execution, not per hour.",
  },
];

/* ============================================================
   Subcomponents
   ============================================================ */

/* ---------- Check icon ---------- */

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "w-5 h-5 text-status-success-fg shrink-0"}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/* ---------- Chevron icon for FAQ ---------- */

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/* ---------- Loading skeleton ---------- */

function PricingSkeleton() {
  return (
    <div className="min-h-screen bg-surface-page">
      {/* Hero skeleton */}
      <section className="text-center py-20 px-4">
        <div className="h-14 w-3/4 max-w-xl mx-auto bg-surface-elevated rounded-lg animate-pulse mb-4" />
        <div className="h-6 w-1/2 max-w-md mx-auto bg-surface-elevated rounded animate-pulse mb-8" />
        <div className="h-12 w-48 mx-auto bg-surface-elevated rounded-md animate-pulse" />
      </section>

      {/* Cards skeleton */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-raised border border-border-default rounded-xl p-8">
              <div className="h-8 w-24 bg-surface-elevated rounded animate-pulse mb-2" />
              <div className="h-4 w-40 bg-surface-elevated rounded animate-pulse mb-6" />
              <div className="h-10 w-32 bg-surface-elevated rounded animate-pulse mb-6" />
              <div className="space-y-3">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-4 w-full bg-surface-elevated rounded animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ---------- Pricing card ---------- */

function formatPrice(plan: PricingPlan): string {
  if (plan.slug === "foundry") {
    return `$${plan.monthlyPriceUsd.toLocaleString()}+`;
  }
  return `$${plan.monthlyPriceUsd.toLocaleString()}`;
}

function formatLimit(value: number, unit: string): string {
  if (value === -1) return `Unlimited ${unit}`;
  return `${value} ${unit}`;
}

function PricingCard({ plan, highlighted }: { plan: PricingPlan; highlighted: boolean }) {
  const ctaText =
    plan.buyingMotion === "annual_contract" ? "Contact Sales" : `Start with ${plan.displayName}`;
  const ctaHref =
    plan.buyingMotion === "annual_contract" ? "#contact-sales" : `/sign-up?plan=${plan.slug}`;

  return (
    <div
      className={`relative flex flex-col bg-surface-raised rounded-xl p-8 transition-shadow ${
        highlighted
          ? "border-2 border-accent-default ring-1 ring-accent-default shadow-lg"
          : "border border-border-default shadow-card"
      }`}
    >
      {/* Most Popular badge */}
      {highlighted && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="inline-block bg-accent-default text-text-on-brand text-xs font-semibold tracking-wide uppercase px-4 py-1 rounded-full">
            Most Popular
          </span>
        </div>
      )}

      {/* Plan header */}
      <h3 className="font-display text-2xl text-text-primary">{plan.displayName}</h3>
      <p className="text-text-secondary text-sm mt-1 mb-6">{plan.tagline}</p>

      {/* Price */}
      <div className="mb-6">
        <span className="font-display text-4xl text-text-primary">{formatPrice(plan)}</span>
        <span className="text-text-secondary text-sm ml-1">/mo</span>
        {plan.annualPriceUsd && (
          <p className="text-text-muted text-xs mt-1">
            or ${plan.annualPriceUsd.toLocaleString()}/yr (save 2 months)
          </p>
        )}
      </div>

      {/* Key limits */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="inline-flex items-center text-xs font-medium bg-surface-elevated text-text-secondary rounded-full px-3 py-1">
          {formatLimit(plan.limits.maxSeats, plan.limits.maxSeats === 1 ? "seat" : "seats")}
        </span>
        <span className="inline-flex items-center text-xs font-medium bg-surface-elevated text-text-secondary rounded-full px-3 py-1">
          {formatLimit(plan.limits.maxPrograms, "programs")}
        </span>
        <span className="inline-flex items-center text-xs font-medium bg-surface-elevated text-text-secondary rounded-full px-3 py-1">
          {plan.limits.maxSessionsPerMonth.toLocaleString()} sessions/mo
        </span>
      </div>

      {/* Overage */}
      <p className="text-text-muted text-xs mb-6">${plan.overageRateUsd}/session overage</p>

      {/* Features */}
      <ul className="space-y-3 mb-8 flex-1">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-text-secondary">
            <CheckIcon />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <a
        href={ctaHref}
        className={`block text-center rounded-md py-3 px-6 font-medium text-sm transition-shadow ${
          highlighted
            ? "btn-primary"
            : "bg-surface-elevated text-text-primary hover:bg-surface-page border border-border-default"
        }`}
      >
        {ctaText}
      </a>
    </div>
  );
}

/* ---------- Feature matrix ---------- */

function FeatureMatrix() {
  return (
    <section className="max-w-5xl mx-auto px-4 py-20">
      <h2 className="font-display text-3xl text-text-primary text-center mb-12">Compare plans</h2>

      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full min-w-[540px] border-collapse">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left text-sm font-medium text-text-secondary py-4 pr-4 w-1/2">
                Feature
              </th>
              <th className="text-center text-sm font-medium text-text-secondary py-4 px-4 w-1/6">
                Crucible
              </th>
              <th className="text-center text-sm font-medium text-text-secondary py-4 px-4 w-1/6">
                Forge
              </th>
              <th className="text-center text-sm font-medium text-text-secondary py-4 pl-4 w-1/6">
                Foundry
              </th>
            </tr>
          </thead>
          <tbody>
            {FEATURE_MATRIX.map((row, i) => (
              <tr
                key={row.label}
                className={`border-b border-border-subtle ${i % 2 === 0 ? "" : "bg-surface-raised/50"}`}
              >
                <td className="text-sm text-text-primary py-3.5 pr-4">{row.label}</td>
                <td className="text-center py-3.5 px-4">
                  {row.crucible ? (
                    <CheckIcon className="w-5 h-5 text-status-success-fg mx-auto" />
                  ) : (
                    <span className="text-text-muted">&mdash;</span>
                  )}
                </td>
                <td className="text-center py-3.5 px-4">
                  {row.forge ? (
                    <CheckIcon className="w-5 h-5 text-status-success-fg mx-auto" />
                  ) : (
                    <span className="text-text-muted">&mdash;</span>
                  )}
                </td>
                <td className="text-center py-3.5 pl-4">
                  {row.foundry ? (
                    <CheckIcon className="w-5 h-5 text-status-success-fg mx-auto" />
                  ) : (
                    <span className="text-text-muted">&mdash;</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------- The Smelt Experience CTA ---------- */

function SmeltExperience() {
  return (
    <section className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-surface-raised rounded-2xl p-12 text-center">
        <h2 className="font-display text-3xl text-text-primary mb-4">Try Foundry Free</h2>
        <p className="text-text-secondary text-lg mb-3">
          Upload a SOW, watch requirements extracted in minutes.
        </p>
        <p className="text-text-muted text-sm mb-8">
          1 program &bull; 10 sessions &bull; No time limit &bull; No credit card
        </p>
        <a href="/sign-up" className="btn-primary inline-block text-lg px-8 py-3">
          Start The Smelt
        </a>
      </div>
    </section>
  );
}

/* ---------- ROI Calculator ---------- */

function ROICalculator() {
  const [teamSize, setTeamSize] = useState(5);
  const [hourlyRate, setHourlyRate] = useState(150);
  const [projectsPerMonth, setProjectsPerMonth] = useState(2);

  const hoursSaved = teamSize * 10 * projectsPerMonth;
  const valueDelivered = hoursSaved * hourlyRate;

  let recommendedTier: string;
  let monthlyCost: number;
  if (teamSize <= 2) {
    recommendedTier = "Crucible";
    monthlyCost = 299;
  } else if (teamSize <= 10) {
    recommendedTier = "Forge";
    monthlyCost = 1800;
  } else {
    recommendedTier = "Foundry";
    monthlyCost = 8000;
  }

  const roi =
    monthlyCost > 0 ? Math.round(((valueDelivered - monthlyCost) / monthlyCost) * 100) / 100 : 0;
  const roiDisplay = roi > 0 ? roi.toFixed(1) : "0";

  return (
    <section className="max-w-4xl mx-auto px-4 py-20">
      <h2 className="font-display text-3xl text-text-primary text-center mb-4">
        Calculate your ROI
      </h2>
      <p className="text-text-secondary text-center mb-12 max-w-xl mx-auto">
        See how much Foundry saves your delivery team each month.
      </p>

      <div className="bg-surface-raised rounded-2xl p-8 md:p-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          {/* Team size slider */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Team size</label>
            <input
              type="range"
              min={1}
              max={50}
              value={teamSize}
              onChange={(e) => setTeamSize(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-surface-elevated accent-accent-default"
            />
            <div className="flex justify-between text-xs text-text-muted mt-1">
              <span>1</span>
              <span className="text-sm font-semibold text-text-primary">{teamSize}</span>
              <span>50</span>
            </div>
          </div>

          {/* Hourly rate slider */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Hourly rate</label>
            <input
              type="range"
              min={75}
              max={300}
              step={5}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-surface-elevated accent-accent-default"
            />
            <div className="flex justify-between text-xs text-text-muted mt-1">
              <span>$75</span>
              <span className="text-sm font-semibold text-text-primary">${hourlyRate}</span>
              <span>$300</span>
            </div>
          </div>

          {/* Projects per month slider */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Projects per month
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={projectsPerMonth}
              onChange={(e) => setProjectsPerMonth(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-surface-elevated accent-accent-default"
            />
            <div className="flex justify-between text-xs text-text-muted mt-1">
              <span>1</span>
              <span className="text-sm font-semibold text-text-primary">{projectsPerMonth}</span>
              <span>10</span>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="border-t border-border-default pt-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div className="text-center">
              <p className="text-text-muted text-xs uppercase tracking-wider mb-1">
                Hours saved/mo
              </p>
              <p className="font-display text-3xl text-text-primary">{hoursSaved}</p>
            </div>
            <div className="text-center">
              <p className="text-text-muted text-xs uppercase tracking-wider mb-1">
                Value delivered
              </p>
              <p className="font-display text-3xl text-text-primary">
                ${valueDelivered.toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-text-muted text-xs uppercase tracking-wider mb-1">
                Recommended tier
              </p>
              <p className="font-display text-3xl text-accent-default">{recommendedTier}</p>
            </div>
            <div className="text-center">
              <p className="text-text-muted text-xs uppercase tracking-wider mb-1">Monthly cost</p>
              <p className="font-display text-3xl text-text-primary">
                ${monthlyCost.toLocaleString()}
              </p>
            </div>
          </div>

          <p className="text-center text-lg text-text-secondary">
            At <span className="font-semibold text-text-primary">${hourlyRate}/hr</span> with a{" "}
            <span className="font-semibold text-text-primary">{teamSize}-person team</span>, Foundry
            saves you{" "}
            <span className="font-semibold text-accent-default">
              ${valueDelivered.toLocaleString()}/month
            </span>
            . That&apos;s a <span className="font-semibold text-accent-default">{roiDisplay}x</span>{" "}
            return.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */

function FAQItem({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border-subtle">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-text-primary group-hover:text-accent-default transition-colors pr-4">
          {item.question}
        </span>
        <ChevronIcon open={open} />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          open ? "max-h-96 pb-5" : "max-h-0"
        }`}
      >
        <p className="text-sm text-text-secondary leading-relaxed">{item.answer}</p>
      </div>
    </div>
  );
}

function FAQSection() {
  return (
    <section className="max-w-3xl mx-auto px-4 py-20">
      <h2 className="font-display text-3xl text-text-primary text-center mb-12">
        Frequently asked questions
      </h2>
      <div className="border-t border-border-subtle">
        {FAQ_ITEMS.map((item) => (
          <FAQItem key={item.question} item={item} />
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   Main PricingPage
   ============================================================ */

export function PricingPage() {
  const plansRaw = useQuery("billing/plans:getPricingPlans" as any);
  const ensurePlansSeeded = useMutation("billing/plans:ensurePlansSeeded" as any);
  const seedRef = useRef(false);
  useEffect(() => {
    if (!seedRef.current) {
      seedRef.current = true;
      ensurePlansSeeded({}).catch(() => {});
    }
  }, [ensurePlansSeeded]);

  /* Loading state */
  if (plansRaw === undefined) {
    return <PricingSkeleton />;
  }

  /* Use live data or fallback */
  const plans: PricingPlan[] =
    plansRaw && (plansRaw as PricingPlan[]).length > 0
      ? (plansRaw as PricingPlan[])
      : FALLBACK_PLANS;

  return (
    <div className="min-h-screen bg-surface-page">
      {/* ---------- 1. Hero ---------- */}
      <section className="text-center py-20 px-4">
        <h1 className="font-display text-5xl md:text-6xl text-text-primary mb-4 leading-tight">
          Ship software with AI agents.
          <br />
          Pay for what you ship.
        </h1>
        <p className="text-text-secondary text-lg max-w-2xl mx-auto mb-8">
          From solo operators to enterprise teams, Foundry scales with your delivery.
        </p>
        <a href="/sign-up" className="btn-primary inline-block text-lg px-8 py-3">
          Start The Smelt — Free
        </a>
      </section>

      {/* ---------- 2. Tier comparison cards ---------- */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <PricingCard key={plan._id} plan={plan} highlighted={plan.sortOrder === 2} />
          ))}
        </div>
      </section>

      {/* ---------- 3. Feature matrix ---------- */}
      <FeatureMatrix />

      {/* ---------- 4. The Smelt Experience ---------- */}
      <SmeltExperience />

      {/* ---------- 5. ROI Calculator ---------- */}
      <ROICalculator />

      {/* ---------- 6. FAQ ---------- */}
      <FAQSection />

      {/* ---------- Footer CTA ---------- */}
      <section className="text-center py-16 px-4 border-t border-border-subtle">
        <p className="text-text-secondary mb-4">Questions? Need a custom plan?</p>
        <a href="#contact-sales" className="btn-secondary inline-block px-6 py-3">
          Talk to Sales
        </a>
      </section>
    </div>
  );
}
