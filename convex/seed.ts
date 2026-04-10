import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { assertOrgAccess } from "./model/access";

type Priority = "must_have" | "should_have" | "nice_to_have" | "deferred";
type FitGap = "native" | "config" | "custom_dev" | "third_party" | "not_feasible";
type Effort = "low" | "medium" | "high" | "very_high";
type Status = "draft" | "approved" | "in_progress";

interface RequirementDef {
  refId: string;
  ws: string;
  title: string;
  description: string;
  batch: string;
  priority: Priority;
  fitGap: FitGap;
  effortEstimate: Effort;
  status: Status;
}

// ---------- Batch 1: Foundation (17 requirements) ----------
const BATCH_1_FOUNDATION: RequirementDef[] = [
  {
    refId: "REQ-001",
    ws: "WS-1",
    title: "Implement Experience Cloud B2B storefront template",
    description:
      "Deploy and configure the Salesforce B2B Commerce Experience Cloud template as the foundation for the AcmeCorp storefront.",
    batch: "Foundation",
    priority: "must_have",
    fitGap: "config",
    effortEstimate: "high",
    status: "approved",
  },
  {
    refId: "REQ-002",
    ws: "WS-1",
    title: "Configure B2B Commerce org settings and permission sets",
    description:
      "Set up B2B Commerce org-level settings including buyer group configurations, commerce-specific permissions, and sharing rules.",
    batch: "Foundation",
    priority: "must_have",
    fitGap: "config",
    effortEstimate: "medium",
    status: "approved",
  },
  {
    refId: "REQ-003",
    ws: "WS-2",
    title: "Set up buyer account hierarchy with parent/child accounts",
    description:
      "Configure hierarchical account structure supporting AcmeCorp's parent companies and subsidiary buyer accounts with inherited permissions.",
    batch: "Foundation",
    priority: "must_have",
    fitGap: "config",
    effortEstimate: "high",
    status: "approved",
  },
  {
    refId: "REQ-004",
    ws: "WS-2",
    title: "Migrate Magento admin roles to Salesforce permission sets",
    description:
      "Map existing Magento admin and buyer roles to Salesforce permission sets and profiles, ensuring equivalent access controls.",
    batch: "Foundation",
    priority: "should_have",
    fitGap: "config",
    effortEstimate: "low",
    status: "approved",
  },
  {
    refId: "REQ-005",
    ws: "WS-2",
    title: "Implement SSO integration for enterprise identity provider",
    description:
      "Configure SAML-based SSO with AcmeCorp's Azure AD identity provider for seamless buyer authentication.",
    batch: "Foundation",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "high",
    status: "approved",
  },
  {
    refId: "REQ-006",
    ws: "WS-1",
    title: "Configure Salesforce B2B Commerce data model extensions",
    description:
      "Extend standard B2B Commerce objects with custom fields required for AcmeCorp's product and order data.",
    batch: "Foundation",
    priority: "must_have",
    fitGap: "config",
    effortEstimate: "medium",
    status: "approved",
  },
  {
    refId: "REQ-007",
    ws: "WS-1",
    title: "Set up multi-currency support for international accounts",
    description:
      "Enable and configure multi-currency in Salesforce to support AcmeCorp's USD, CAD, and EUR pricing for international buyers.",
    batch: "Foundation",
    priority: "should_have",
    fitGap: "config",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-008",
    ws: "WS-1",
    title: "Build custom LWC navigation menu component",
    description:
      "Create a custom Lightning Web Component for the storefront navigation with mega-menu support matching Magento's category structure.",
    batch: "Foundation",
    priority: "nice_to_have",
    fitGap: "custom_dev",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-009",
    ws: "WS-2",
    title: "Configure guest browsing with restricted pricing visibility",
    description:
      "Allow unauthenticated users to browse the catalog while hiding account-specific pricing. Require login for pricing and checkout.",
    batch: "Foundation",
    priority: "should_have",
    fitGap: "config",
    effortEstimate: "low",
    status: "draft",
  },
  {
    refId: "REQ-010",
    ws: "WS-1",
    title: "Set up Salesforce sandbox environments for dev/staging/prod",
    description:
      "Provision and configure full-copy sandbox for staging and developer sandboxes for the build team. Establish deployment pipeline.",
    batch: "Foundation",
    priority: "must_have",
    fitGap: "native",
    effortEstimate: "low",
    status: "approved",
  },
  {
    refId: "REQ-011",
    ws: "WS-1",
    title: "Define custom object relationships for B2B product data",
    description:
      "Create custom objects and relationships for product compliance data, certifications, and regulatory tracking.",
    batch: "Foundation",
    priority: "must_have",
    fitGap: "config",
    effortEstimate: "high",
    status: "draft",
  },
  {
    refId: "REQ-012",
    ws: "WS-1",
    title: "Configure transactional email templates",
    description:
      "Set up email templates for order confirmations, shipping notifications, and account approval workflows using Salesforce email.",
    batch: "Foundation",
    priority: "nice_to_have",
    fitGap: "config",
    effortEstimate: "low",
    status: "draft",
  },
  {
    refId: "REQ-013",
    ws: "WS-2",
    title: "Implement role-based dashboard access for buyer personas",
    description:
      "Configure Experience Cloud page visibility rules so each buyer persona (purchasing agent, procurement manager, admin) sees relevant content.",
    batch: "Foundation",
    priority: "should_have",
    fitGap: "config",
    effortEstimate: "low",
    status: "approved",
  },
  {
    refId: "REQ-014",
    ws: "WS-2",
    title: "Set up Salesforce Shield encryption for sensitive data",
    description:
      "Enable platform encryption for PII fields and sensitive buyer data using Salesforce Shield.",
    batch: "Foundation",
    priority: "must_have",
    fitGap: "third_party",
    effortEstimate: "high",
    status: "draft",
  },
  {
    refId: "REQ-015",
    ws: "WS-2",
    title: "Configure B2B Commerce entitlement policies",
    description:
      "Define buyer entitlement policies controlling which accounts can access specific product catalogs and pricing tiers.",
    batch: "Foundation",
    priority: "must_have",
    fitGap: "config",
    effortEstimate: "medium",
    status: "approved",
  },
  {
    refId: "REQ-016",
    ws: "WS-2",
    title: "Implement audit trail logging for compliance requirements",
    description:
      "Enable and configure field audit trail for regulated fields. Set up custom audit log for buyer actions and order modifications.",
    batch: "Foundation",
    priority: "should_have",
    fitGap: "native",
    effortEstimate: "low",
    status: "draft",
  },
  {
    refId: "REQ-017",
    ws: "WS-1",
    title: "Build custom error handling and notification framework",
    description:
      "Create reusable Apex exception handling with structured error logging and admin notification for integration failures.",
    batch: "Foundation",
    priority: "deferred",
    fitGap: "not_feasible",
    effortEstimate: "very_high",
    status: "draft",
  },
];

// ---------- Batch 2: Catalog & Products (17 requirements) ----------
const BATCH_2_CATALOG: RequirementDef[] = [
  {
    refId: "REQ-018",
    ws: "WS-1",
    title: "Migrate product catalog structure with categories and attributes",
    description:
      "Extract Magento category tree and product attributes, transform to Salesforce product hierarchy with entitlement-based catalog assignment.",
    batch: "Catalog & Products",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "very_high",
    status: "approved",
  },
  {
    refId: "REQ-019",
    ws: "WS-1",
    title: "Implement product variant and option configuration",
    description:
      "Map Magento configurable products to Salesforce product variations. Support size, packaging, and material options for industrial supplies.",
    batch: "Catalog & Products",
    priority: "must_have",
    fitGap: "config",
    effortEstimate: "high",
    status: "approved",
  },
  {
    refId: "REQ-020",
    ws: "WS-1",
    title: "Build custom LWC product comparison component",
    description:
      "Create a Lightning Web Component allowing buyers to compare up to 4 products side-by-side with specification matrix.",
    batch: "Catalog & Products",
    priority: "should_have",
    fitGap: "custom_dev",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-021",
    ws: "WS-1",
    title: "Implement faceted search with product attribute filters",
    description:
      "Configure B2B Commerce search with custom facets for product class, rating, material type, and compliance certifications.",
    batch: "Catalog & Products",
    priority: "must_have",
    fitGap: "config",
    effortEstimate: "high",
    status: "draft",
  },
  {
    refId: "REQ-022",
    ws: "WS-1",
    title: "Migrate 2,000 SKU product data with enrichment",
    description:
      "ETL pipeline to migrate all 2K product SKUs from Magento including descriptions, images, specifications, and cross-sell relationships.",
    batch: "Catalog & Products",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "very_high",
    status: "approved",
  },
  {
    refId: "REQ-023",
    ws: "WS-1",
    title: "Implement product image gallery with zoom and alternate views",
    description:
      "Build responsive product image gallery supporting multiple angles, zoom on hover, and high-resolution product imagery.",
    batch: "Catalog & Products",
    priority: "nice_to_have",
    fitGap: "config",
    effortEstimate: "low",
    status: "draft",
  },
  {
    refId: "REQ-024",
    ws: "WS-1",
    title: "Configure product bundling and kit assembly",
    description:
      "Support assembly kits (e.g., installation prep kits) as product bundles with individual component tracking and variable pricing.",
    batch: "Catalog & Products",
    priority: "should_have",
    fitGap: "third_party",
    effortEstimate: "very_high",
    status: "draft",
  },
  {
    refId: "REQ-025",
    ws: "WS-1",
    title: "Build product quick-order pad for repeat buyers",
    description:
      "Create LWC quick-order component allowing buyers to enter multiple SKU/quantity pairs for rapid reordering of known products.",
    batch: "Catalog & Products",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "high",
    status: "draft",
  },
  {
    refId: "REQ-026",
    ws: "WS-1",
    title: "Implement product availability and lead time display",
    description:
      "Show real-time stock status, estimated lead times, and backorder availability on product detail and listing pages.",
    batch: "Catalog & Products",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "high",
    status: "draft",
  },
  {
    refId: "REQ-027",
    ws: "WS-1",
    title: "Configure product recommendations engine",
    description:
      "Set up Einstein Product Recommendations for cross-sell and upsell suggestions based on buyer purchase history and browsing behavior.",
    batch: "Catalog & Products",
    priority: "nice_to_have",
    fitGap: "native",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-028",
    ws: "WS-1",
    title: "Implement regulatory compliance badges on product listings",
    description:
      "Display regulatory clearance status, CE marking, ISO certifications as visual badges on product cards and detail pages.",
    batch: "Catalog & Products",
    priority: "should_have",
    fitGap: "config",
    effortEstimate: "low",
    status: "approved",
  },
  {
    refId: "REQ-029",
    ws: "WS-1",
    title: "Build product document library for spec sheets and SDS",
    description:
      "Allow downloadable PDF attachments per product (safety data sheets, instructions for use, certification documents) with version tracking.",
    batch: "Catalog & Products",
    priority: "nice_to_have",
    fitGap: "native",
    effortEstimate: "low",
    status: "draft",
  },
  {
    refId: "REQ-030",
    ws: "WS-1",
    title: "Configure catalog entitlements by account segment",
    description:
      "Restrict product visibility by buyer segment (enterprise, reseller, distributor) using B2B Commerce catalog entitlements.",
    batch: "Catalog & Products",
    priority: "must_have",
    fitGap: "config",
    effortEstimate: "medium",
    status: "approved",
  },
  {
    refId: "REQ-031",
    ws: "WS-1",
    title: "Implement product lifecycle status management",
    description:
      "Track product lifecycle stages (active, discontinued, recalled) with automated visibility rules and buyer notification workflows.",
    batch: "Catalog & Products",
    priority: "nice_to_have",
    fitGap: "native",
    effortEstimate: "low",
    status: "draft",
  },
  {
    refId: "REQ-032",
    ws: "WS-1",
    title: "Build recently viewed and saved products functionality",
    description:
      "Implement buyer-specific recently viewed products list and saved/favorites list with persistent storage across sessions.",
    batch: "Catalog & Products",
    priority: "nice_to_have",
    fitGap: "native",
    effortEstimate: "low",
    status: "draft",
  },
  {
    refId: "REQ-033",
    ws: "WS-1",
    title: "Implement unit of measure conversion for product ordering",
    description:
      "Support ordering in multiple units of measure (each, box, case, pallet) with automatic quantity conversion and pricing adjustment.",
    batch: "Catalog & Products",
    priority: "should_have",
    fitGap: "custom_dev",
    effortEstimate: "high",
    status: "draft",
  },
  {
    refId: "REQ-034",
    ws: "WS-1",
    title: "Configure search synonyms and industry terminology mapping",
    description:
      "Build search synonym dictionary mapping common industry terms, brand names, and generic equivalents to improve search relevance.",
    batch: "Catalog & Products",
    priority: "nice_to_have",
    fitGap: "config",
    effortEstimate: "low",
    status: "draft",
  },
];

// ---------- Batch 3: Customer & Auth (17 requirements) ----------
const BATCH_3_CUSTOMER: RequirementDef[] = [
  {
    refId: "REQ-035",
    ws: "WS-2",
    title: "Migrate 9,000+ buyer accounts with purchase history",
    description:
      "Extract and load all buyer accounts from Magento including company profiles, contact hierarchies, addresses, and 3 years of order history.",
    batch: "Customer & Auth",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "very_high",
    status: "approved",
  },
  {
    refId: "REQ-036",
    ws: "WS-2",
    title: "Implement account-based pricing visibility rules",
    description:
      "Configure pricing visibility so each buyer account only sees their contracted prices, not list prices or other accounts' pricing.",
    batch: "Customer & Auth",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "high",
    status: "in_progress",
  },
  {
    refId: "REQ-037",
    ws: "WS-2",
    title: "Build self-service account registration workflow",
    description:
      "Create account registration flow with company verification, tax ID validation, and admin approval queue before buyer activation.",
    batch: "Customer & Auth",
    priority: "must_have",
    fitGap: "config",
    effortEstimate: "very_high",
    status: "in_progress",
  },
  {
    refId: "REQ-038",
    ws: "WS-2",
    title: "Configure buyer self-service account management portal",
    description:
      "Allow buyers to manage their profile, shipping addresses, payment methods, and contact information without admin assistance.",
    batch: "Customer & Auth",
    priority: "should_have",
    fitGap: "config",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-039",
    ws: "WS-2",
    title: "Implement delegated account administration for large buyers",
    description:
      "Enable enterprise buyers to manage their own sub-users, assign ordering permissions, and set spending limits per user.",
    batch: "Customer & Auth",
    priority: "nice_to_have",
    fitGap: "custom_dev",
    effortEstimate: "very_high",
    status: "draft",
  },
  {
    refId: "REQ-040",
    ws: "WS-2",
    title: "Build purchase approval workflow with configurable thresholds",
    description:
      "Implement multi-level purchase approval workflow where orders exceeding account-specific thresholds require manager approval.",
    batch: "Customer & Auth",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "very_high",
    status: "draft",
  },
  {
    refId: "REQ-041",
    ws: "WS-2",
    title: "Migrate customer credit terms and payment methods",
    description:
      "Transfer existing credit terms (Net 30, Net 60), credit limits, and stored payment methods from Magento to Salesforce.",
    batch: "Customer & Auth",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "very_high",
    status: "in_progress",
  },
  {
    refId: "REQ-042",
    ws: "WS-2",
    title: "Implement account-specific catalog restrictions",
    description:
      "Enforce product visibility rules by account type — restrict controlled products to verified industrial buyers only.",
    batch: "Customer & Auth",
    priority: "must_have",
    fitGap: "config",
    effortEstimate: "medium",
    status: "approved",
  },
  {
    refId: "REQ-043",
    ws: "WS-2",
    title: "Build buyer onboarding wizard with guided setup",
    description:
      "Create a step-by-step onboarding experience for new buyers covering profile setup, catalog preferences, and first order guidance.",
    batch: "Customer & Auth",
    priority: "deferred",
    fitGap: "not_feasible",
    effortEstimate: "very_high",
    status: "draft",
  },
  {
    refId: "REQ-044",
    ws: "WS-2",
    title: "Configure IP-based access restrictions for enterprise accounts",
    description:
      "Allow enterprise buyers to restrict storefront access to approved IP ranges for enhanced security compliance.",
    batch: "Customer & Auth",
    priority: "deferred",
    fitGap: "not_feasible",
    effortEstimate: "high",
    status: "draft",
  },
  {
    refId: "REQ-045",
    ws: "WS-2",
    title: "Implement customer segmentation with dynamic groups",
    description:
      "Create dynamic customer segments (enterprise, mid-market, distributors, GPOs) for targeted pricing, promotions, and catalog rules.",
    batch: "Customer & Auth",
    priority: "should_have",
    fitGap: "config",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-046",
    ws: "WS-2",
    title: "Build account health dashboard for sales representatives",
    description:
      "Create internal dashboard showing account activity, order frequency, declining engagement, and reorder prediction for sales team.",
    batch: "Customer & Auth",
    priority: "deferred",
    fitGap: "not_feasible",
    effortEstimate: "very_high",
    status: "draft",
  },
  {
    refId: "REQ-047",
    ws: "WS-2",
    title: "Implement MFA enforcement for privileged buyer accounts",
    description:
      "Require multi-factor authentication for accounts with elevated permissions (procurement managers, account admins) via Salesforce MFA.",
    batch: "Customer & Auth",
    priority: "should_have",
    fitGap: "native",
    effortEstimate: "low",
    status: "draft",
  },
  {
    refId: "REQ-048",
    ws: "WS-2",
    title: "Configure shared cart functionality for team ordering",
    description:
      "Allow multiple users within the same buyer account to contribute items to a shared cart with collaborative ordering capabilities.",
    batch: "Customer & Auth",
    priority: "deferred",
    fitGap: "not_feasible",
    effortEstimate: "high",
    status: "draft",
  },
  {
    refId: "REQ-049",
    ws: "WS-2",
    title: "Implement customer data validation and deduplication",
    description:
      "Build data quality rules to prevent duplicate accounts during migration and ongoing registration. Include fuzzy matching on company name and tax ID.",
    batch: "Customer & Auth",
    priority: "deferred",
    fitGap: "third_party",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-050",
    ws: "WS-2",
    title: "Build order history migration verification tool",
    description:
      "Create admin utility to verify migrated order history data integrity by comparing Magento source records with Salesforce target records.",
    batch: "Customer & Auth",
    priority: "should_have",
    fitGap: "native",
    effortEstimate: "low",
    status: "approved",
  },
  {
    refId: "REQ-051",
    ws: "WS-2",
    title: "Configure session management and timeout policies",
    description:
      "Set up session timeout policies, concurrent session limits, and secure session handling for B2B storefront per compliance requirements.",
    batch: "Customer & Auth",
    priority: "should_have",
    fitGap: "native",
    effortEstimate: "low",
    status: "approved",
  },
];

// ---------- Batch 4: Pricing & Orders (17 requirements) ----------
const BATCH_4_PRICING: RequirementDef[] = [
  {
    refId: "REQ-052",
    ws: "WS-3",
    title: "Migrate 49K pricebook combinations to B2B Commerce",
    description:
      "Transform and load all 49,000 pricebook entries from Magento tier/group pricing into Salesforce B2B Commerce pricebook structure.",
    batch: "Pricing & Orders",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "very_high",
    status: "approved",
  },
  {
    refId: "REQ-053",
    ws: "WS-3",
    title: "Implement tiered volume discount pricing engine",
    description:
      "Configure volume-based pricing tiers where unit price decreases at defined quantity breakpoints per product per account.",
    batch: "Pricing & Orders",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "high",
    status: "in_progress",
  },
  {
    refId: "REQ-054",
    ws: "WS-4",
    title: "Build custom checkout flow with PO number capture",
    description:
      "Create custom checkout experience supporting PO number entry, cost center allocation, and account-specific shipping options.",
    batch: "Pricing & Orders",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "high",
    status: "draft",
  },
  {
    refId: "REQ-055",
    ws: "WS-3",
    title: "Configure contract pricing with effective date ranges",
    description:
      "Support time-bound contract pricing allowing future-dated price changes and automatic expiration with fallback to list pricing.",
    batch: "Pricing & Orders",
    priority: "must_have",
    fitGap: "config",
    effortEstimate: "high",
    status: "draft",
  },
  {
    refId: "REQ-056",
    ws: "WS-3",
    title: "Implement promotional pricing and discount codes",
    description:
      "Build promotion engine supporting percentage discounts, fixed amount off, BOGO, and free shipping promotions with coupon code validation.",
    batch: "Pricing & Orders",
    priority: "should_have",
    fitGap: "config",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-057",
    ws: "WS-4",
    title: "Build custom Apex order orchestration service",
    description:
      "Create Apex service to handle complex order processing including split shipments, backorder management, and partial fulfillment.",
    batch: "Pricing & Orders",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "very_high",
    status: "draft",
  },
  {
    refId: "REQ-058",
    ws: "WS-4",
    title: "Implement reorder functionality from order history",
    description:
      "Allow buyers to reorder previous orders with a single click, pre-populating cart with previous quantities and applying current pricing.",
    batch: "Pricing & Orders",
    priority: "should_have",
    fitGap: "native",
    effortEstimate: "low",
    status: "approved",
  },
  {
    refId: "REQ-059",
    ws: "WS-4",
    title: "Configure tax calculation with Avalara integration",
    description:
      "Integrate Avalara AvaTax for real-time sales tax calculation supporting regulated product tax exemptions and state-specific rules.",
    batch: "Pricing & Orders",
    priority: "must_have",
    fitGap: "third_party",
    effortEstimate: "high",
    status: "draft",
  },
  {
    refId: "REQ-060",
    ws: "WS-4",
    title: "Build shipping rate calculator with carrier integration",
    description:
      "Integrate FedEx and UPS APIs for real-time shipping rate quotes with support for hazmat shipping requirements.",
    batch: "Pricing & Orders",
    priority: "must_have",
    fitGap: "third_party",
    effortEstimate: "high",
    status: "draft",
  },
  {
    refId: "REQ-061",
    ws: "WS-3",
    title: "Implement GPO contract pricing with group membership",
    description:
      "Support Group Purchasing Organization contract pricing where member accounts inherit negotiated GPO pricing tiers.",
    batch: "Pricing & Orders",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "very_high",
    status: "draft",
  },
  {
    refId: "REQ-062",
    ws: "WS-4",
    title: "Configure order status tracking and notifications",
    description:
      "Implement order lifecycle status tracking with automated email and in-app notifications at key milestones (confirmed, shipped, delivered).",
    batch: "Pricing & Orders",
    priority: "should_have",
    fitGap: "config",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-063",
    ws: "WS-4",
    title: "Build returns and RMA workflow for regulated products",
    description:
      "Create return merchandise authorization workflow with regulated return handling including lot tracking.",
    batch: "Pricing & Orders",
    priority: "deferred",
    fitGap: "custom_dev",
    effortEstimate: "very_high",
    status: "draft",
  },
  {
    refId: "REQ-064",
    ws: "WS-3",
    title: "Implement price override approval workflow for sales reps",
    description:
      "Allow sales representatives to request price overrides with configurable approval chains based on discount percentage thresholds.",
    batch: "Pricing & Orders",
    priority: "nice_to_have",
    fitGap: "config",
    effortEstimate: "low",
    status: "draft",
  },
  {
    refId: "REQ-065",
    ws: "WS-4",
    title: "Configure saved cart and draft order functionality",
    description:
      "Allow buyers to save carts as drafts, name them, and return later. Support multiple concurrent saved carts per buyer.",
    batch: "Pricing & Orders",
    priority: "should_have",
    fitGap: "native",
    effortEstimate: "low",
    status: "draft",
  },
  {
    refId: "REQ-066",
    ws: "WS-4",
    title: "Implement standing order and subscription scheduling",
    description:
      "Build recurring order functionality for consumable supplies with configurable frequency and automatic reorder triggers.",
    batch: "Pricing & Orders",
    priority: "deferred",
    fitGap: "not_feasible",
    effortEstimate: "very_high",
    status: "draft",
  },
  {
    refId: "REQ-067",
    ws: "WS-3",
    title: "Build pricing audit trail and change history",
    description:
      "Track all pricing changes with who, when, and why. Support compliance reporting for contract pricing modifications.",
    batch: "Pricing & Orders",
    priority: "should_have",
    fitGap: "native",
    effortEstimate: "low",
    status: "draft",
  },
  {
    refId: "REQ-068",
    ws: "WS-4",
    title: "Configure credit card and ACH payment processing",
    description:
      "Integrate payment gateway for credit card and ACH payments alongside existing invoicing and PO-based payment methods.",
    batch: "Pricing & Orders",
    priority: "should_have",
    fitGap: "third_party",
    effortEstimate: "high",
    status: "draft",
  },
];

// ---------- Batch 5: Integration (17 requirements) ----------
const BATCH_5_INTEGRATION: RequirementDef[] = [
  {
    refId: "REQ-069",
    ws: "WS-5",
    title: "Build ERP order sync via MuleSoft middleware",
    description:
      "Develop bi-directional order integration between Salesforce and AcmeCorp's SAP ERP using MuleSoft Anypoint Platform.",
    batch: "Integration",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "very_high",
    status: "approved",
  },
  {
    refId: "REQ-070",
    ws: "WS-5",
    title: "Implement real-time inventory sync from warehouse system",
    description:
      "Build real-time inventory feed from WMS to Salesforce updating stock levels, allocation, and ATP quantities across 3 distribution centers.",
    batch: "Integration",
    priority: "must_have",
    fitGap: "third_party",
    effortEstimate: "very_high",
    status: "in_progress",
  },
  {
    refId: "REQ-071",
    ws: "WS-5",
    title: "Migrate historical order data from Magento (3 years)",
    description:
      "Extract, transform, and load 3 years of historical order data from Magento database into Salesforce for buyer order history continuity.",
    batch: "Integration",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "very_high",
    status: "approved",
  },
  {
    refId: "REQ-072",
    ws: "WS-5",
    title: "Configure Salesforce-to-Magento cutover data sync",
    description:
      "Build data synchronization pipeline for parallel-run period where both Magento and Salesforce accept orders during phased cutover.",
    batch: "Integration",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "very_high",
    status: "draft",
  },
  {
    refId: "REQ-073",
    ws: "WS-5",
    title: "Integrate shipping carrier tracking with platform events",
    description:
      "Consume carrier tracking webhooks (FedEx, UPS) and publish platform events to update order status and notify buyers in real-time.",
    batch: "Integration",
    priority: "nice_to_have",
    fitGap: "third_party",
    effortEstimate: "very_high",
    status: "draft",
  },
  {
    refId: "REQ-074",
    ws: "WS-5",
    title: "Build product data import pipeline from PIM system",
    description:
      "Automate nightly product data sync from AcmeCorp's Akeneo PIM including product descriptions, images, and attributes.",
    batch: "Integration",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "high",
    status: "draft",
  },
  {
    refId: "REQ-075",
    ws: "WS-5",
    title: "Implement CRM customer sync between Sales Cloud and B2B",
    description:
      "Ensure buyer account data stays synchronized between Salesforce Sales Cloud (used by sales team) and B2B Commerce storefront.",
    batch: "Integration",
    priority: "should_have",
    fitGap: "native",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-076",
    ws: "WS-5",
    title: "Configure error handling and retry logic for integrations",
    description:
      "Implement circuit breaker patterns, dead letter queues, and automated retry with exponential backoff for all integration endpoints.",
    batch: "Integration",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "high",
    status: "draft",
  },
  {
    refId: "REQ-077",
    ws: "WS-5",
    title: "Build integration monitoring dashboard with alerting",
    description:
      "Create operations dashboard tracking integration health, throughput, error rates, and latency with PagerDuty alert integration.",
    batch: "Integration",
    priority: "should_have",
    fitGap: "third_party",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-078",
    ws: "WS-5",
    title: "Implement EDI order processing for enterprise buyers",
    description:
      "Support EDI 850 (purchase order) and EDI 855 (acknowledgment) for AcmeCorp's largest enterprise accounts.",
    batch: "Integration",
    priority: "deferred",
    fitGap: "not_feasible",
    effortEstimate: "very_high",
    status: "draft",
  },
  {
    refId: "REQ-079",
    ws: "WS-5",
    title: "Configure Salesforce Connect for external data objects",
    description:
      "Use Salesforce Connect to expose ERP data (inventory levels, shipment tracking) as external objects without data replication.",
    batch: "Integration",
    priority: "nice_to_have",
    fitGap: "native",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-080",
    ws: "WS-5",
    title: "Build data validation framework for migration batches",
    description:
      "Create automated validation suite comparing source Magento data against loaded Salesforce data with row counts, checksum, and sample verification.",
    batch: "Integration",
    priority: "nice_to_have",
    fitGap: "custom_dev",
    effortEstimate: "very_high",
    status: "draft",
  },
  {
    refId: "REQ-081",
    ws: "WS-5",
    title: "Implement webhook event system for third-party notifications",
    description:
      "Build outbound webhook system to notify AcmeCorp's internal tools (BI, demand planning) of key commerce events.",
    batch: "Integration",
    priority: "nice_to_have",
    fitGap: "not_feasible",
    effortEstimate: "very_high",
    status: "draft",
  },
  {
    refId: "REQ-082",
    ws: "WS-5",
    title: "Configure Google Analytics 4 e-commerce event tracking",
    description:
      "Implement GA4 enhanced e-commerce tracking for product views, add to cart, checkout steps, and purchase events on the B2B storefront.",
    batch: "Integration",
    priority: "nice_to_have",
    fitGap: "config",
    effortEstimate: "low",
    status: "draft",
  },
  {
    refId: "REQ-083",
    ws: "WS-5",
    title: "Build API rate limiting and throttling layer",
    description:
      "Implement rate limiting for all external API integrations to prevent Salesforce governor limit violations during peak order periods.",
    batch: "Integration",
    priority: "should_have",
    fitGap: "custom_dev",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-084",
    ws: "WS-5",
    title: "Implement document generation integration for invoices",
    description:
      "Integrate with Conga or Drawloop for automated PDF invoice and packing slip generation from Salesforce order data.",
    batch: "Integration",
    priority: "deferred",
    fitGap: "third_party",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-085",
    ws: "WS-5",
    title: "Configure compliant data transfer encryption",
    description:
      "Ensure all integration data transfers use TLS 1.2+ encryption and implement field-level encryption for sensitive data in transit.",
    batch: "Integration",
    priority: "must_have",
    fitGap: "config",
    effortEstimate: "medium",
    status: "approved",
  },
];

// ---------- Batch 6: Content & UX (17 requirements) ----------
const BATCH_6_CONTENT: RequirementDef[] = [
  {
    refId: "REQ-086",
    ws: "WS-6",
    title: "Design responsive B2B storefront theme for industrial commerce",
    description:
      "Create custom Experience Cloud theme with AcmeCorp branding, responsive layout for desktop/tablet, and WCAG 2.1 AA compliance.",
    batch: "Content & UX",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "high",
    status: "approved",
  },
  {
    refId: "REQ-087",
    ws: "WS-6",
    title: "Migrate CMS content pages from Magento to Experience Cloud",
    description:
      "Transfer 45+ content pages (about, policies, FAQ, support) from Magento CMS to Experience Cloud CMS with URL redirect mapping.",
    batch: "Content & UX",
    priority: "should_have",
    fitGap: "native",
    effortEstimate: "low",
    status: "approved",
  },
  {
    refId: "REQ-088",
    ws: "WS-6",
    title: "Build personalized buyer dashboard landing page",
    description:
      "Create post-login dashboard showing recent orders, reorder suggestions, account alerts, and contract expiration notifications per buyer.",
    batch: "Content & UX",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "high",
    status: "draft",
  },
  {
    refId: "REQ-089",
    ws: "WS-6",
    title: "Implement multi-language support for product content",
    description:
      "Configure Experience Cloud translation workbench for English, French (Canada), and Spanish product content and UI labels.",
    batch: "Content & UX",
    priority: "deferred",
    fitGap: "native",
    effortEstimate: "high",
    status: "draft",
  },
  {
    refId: "REQ-090",
    ws: "WS-6",
    title: "Build custom LWC data table for order management",
    description:
      "Create sortable, filterable data table component for buyers to view and manage orders with inline status updates and export to CSV.",
    batch: "Content & UX",
    priority: "should_have",
    fitGap: "custom_dev",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-091",
    ws: "WS-6",
    title: "Configure SEO metadata and URL structure for storefront",
    description:
      "Implement SEO-friendly URLs, meta tags, structured data markup, and XML sitemap generation for product and category pages.",
    batch: "Content & UX",
    priority: "nice_to_have",
    fitGap: "config",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-092",
    ws: "WS-6",
    title: "Build notification center for buyer communications",
    description:
      "Create in-app notification center aggregating order updates, price change alerts, new product announcements, and system messages.",
    batch: "Content & UX",
    priority: "deferred",
    fitGap: "not_feasible",
    effortEstimate: "very_high",
    status: "draft",
  },
  {
    refId: "REQ-093",
    ws: "WS-6",
    title: "Implement buyer-facing reporting and analytics dashboards",
    description:
      "Build self-service reports showing purchase trends, spending by category, order frequency, and budget utilization for procurement managers.",
    batch: "Content & UX",
    priority: "should_have",
    fitGap: "native",
    effortEstimate: "very_high",
    status: "draft",
  },
  {
    refId: "REQ-094",
    ws: "WS-6",
    title: "Design mobile-optimized checkout experience",
    description:
      "Optimize checkout flow for tablet users in field environments with touch-friendly controls and simplified PO entry.",
    batch: "Content & UX",
    priority: "should_have",
    fitGap: "config",
    effortEstimate: "medium",
    status: "in_progress",
  },
  {
    refId: "REQ-095",
    ws: "WS-6",
    title: "Build product training and resource center",
    description:
      "Create a knowledge base section with product training videos, installation guides, and technical application resources.",
    batch: "Content & UX",
    priority: "deferred",
    fitGap: "native",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-096",
    ws: "WS-6",
    title: "Implement live chat integration for buyer support",
    description:
      "Integrate Salesforce Service Cloud chat widget on the storefront for real-time buyer support with case creation fallback.",
    batch: "Content & UX",
    priority: "nice_to_have",
    fitGap: "third_party",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-097",
    ws: "WS-6",
    title: "Configure content approval workflow for CMS updates",
    description:
      "Set up content approval workflow requiring marketing and compliance sign-off before publishing CMS changes to the storefront.",
    batch: "Content & UX",
    priority: "nice_to_have",
    fitGap: "native",
    effortEstimate: "low",
    status: "draft",
  },
  {
    refId: "REQ-098",
    ws: "WS-6",
    title: "Build WCAG 2.1 AA accessibility compliance layer",
    description:
      "Audit and remediate all custom LWC components for WCAG 2.1 AA compliance including screen reader support, keyboard navigation, and contrast ratios.",
    batch: "Content & UX",
    priority: "nice_to_have",
    fitGap: "custom_dev",
    effortEstimate: "very_high",
    status: "approved",
  },
  {
    refId: "REQ-099",
    ws: "WS-6",
    title: "Implement 301 redirect mapping from Magento URLs",
    description:
      "Map all existing Magento product and category URLs to new Salesforce storefront URLs. Implement 301 redirects to preserve SEO equity.",
    batch: "Content & UX",
    priority: "should_have",
    fitGap: "config",
    effortEstimate: "low",
    status: "draft",
  },
  {
    refId: "REQ-100",
    ws: "WS-6",
    title: "Configure A/B testing framework for storefront optimization",
    description:
      "Set up Optimizely or native A/B testing for conversion optimization on key storefront pages (PDP, checkout, category).",
    batch: "Content & UX",
    priority: "deferred",
    fitGap: "third_party",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-101",
    ws: "WS-6",
    title: "Build contextual help system with tooltips and guided tours",
    description:
      "Implement contextual help tooltips and optional guided tours for new buyer onboarding across key storefront workflows.",
    batch: "Content & UX",
    priority: "deferred",
    fitGap: "third_party",
    effortEstimate: "low",
    status: "draft",
  },
  {
    refId: "REQ-102",
    ws: "WS-6",
    title: "Implement page performance optimization and lazy loading",
    description:
      "Optimize Experience Cloud page load times with image lazy loading, component defer loading, and CDN caching configuration.",
    batch: "Content & UX",
    priority: "should_have",
    fitGap: "config",
    effortEstimate: "medium",
    status: "draft",
  },
];

// ---------- Batch 7: Testing & Launch (16 requirements) ----------
const BATCH_7_TESTING: RequirementDef[] = [
  {
    refId: "REQ-103",
    ws: "WS-7",
    title: "Create comprehensive UAT test plan for all user personas",
    description:
      "Develop UAT test plan covering 8 buyer personas with test scenarios for ordering, account management, and edge cases.",
    batch: "Testing & Launch",
    priority: "must_have",
    fitGap: "native",
    effortEstimate: "medium",
    status: "approved",
  },
  {
    refId: "REQ-104",
    ws: "WS-7",
    title: "Perform load testing for 500+ concurrent B2B sessions",
    description:
      "Execute load tests simulating 500+ concurrent buyer sessions with realistic order patterns to validate platform scalability.",
    batch: "Testing & Launch",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "high",
    status: "draft",
  },
  {
    refId: "REQ-105",
    ws: "WS-7",
    title: "Build automated regression test suite for core workflows",
    description:
      "Create Selenium/Playwright automated test suite covering critical paths: browse, search, add to cart, checkout, order management.",
    batch: "Testing & Launch",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "high",
    status: "draft",
  },
  {
    refId: "REQ-106",
    ws: "WS-7",
    title: "Execute integration testing for all external system connections",
    description:
      "Validate all MuleSoft integrations (ERP, WMS, PIM, carriers) with end-to-end data flow testing and error scenario coverage.",
    batch: "Testing & Launch",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "high",
    status: "draft",
  },
  {
    refId: "REQ-107",
    ws: "WS-7",
    title: "Conduct security penetration testing and vulnerability scan",
    description:
      "Engage third-party security firm to perform penetration testing on storefront, APIs, and integrations. Remediate all critical/high findings.",
    batch: "Testing & Launch",
    priority: "must_have",
    fitGap: "third_party",
    effortEstimate: "high",
    status: "draft",
  },
  {
    refId: "REQ-108",
    ws: "WS-7",
    title: "Develop data migration validation and reconciliation report",
    description:
      "Create comprehensive reconciliation report comparing source and target data counts, checksums, and sample records across all migrated entities.",
    batch: "Testing & Launch",
    priority: "must_have",
    fitGap: "native",
    effortEstimate: "medium",
    status: "approved",
  },
  {
    refId: "REQ-109",
    ws: "WS-7",
    title: "Create production deployment runbook and rollback plan",
    description:
      "Document step-by-step deployment procedure, go/no-go criteria, rollback triggers, and emergency contacts for launch weekend.",
    batch: "Testing & Launch",
    priority: "must_have",
    fitGap: "native",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-110",
    ws: "WS-7",
    title: "Execute phased go-live with pilot buyer group",
    description:
      "Launch with a pilot group of 50 selected buyer accounts for 2-week controlled rollout before full cutover.",
    batch: "Testing & Launch",
    priority: "should_have",
    fitGap: "native",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-111",
    ws: "WS-7",
    title: "Build post-launch monitoring and alert dashboard",
    description:
      "Configure real-time monitoring dashboard tracking order volume, error rates, page load times, and integration health during launch period.",
    batch: "Testing & Launch",
    priority: "should_have",
    fitGap: "config",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-112",
    ws: "WS-7",
    title: "Conduct buyer acceptance testing with key accounts",
    description:
      "Coordinate UAT sessions with AcmeCorp's top 10 buyer accounts for real-world workflow validation and feedback collection.",
    batch: "Testing & Launch",
    priority: "must_have",
    fitGap: "native",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-113",
    ws: "WS-7",
    title: "Develop training materials for internal sales and support teams",
    description:
      "Create training documentation and video walkthroughs for AcmeCorp's sales team and customer support staff on the new platform.",
    batch: "Testing & Launch",
    priority: "should_have",
    fitGap: "native",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-114",
    ws: "WS-7",
    title: "Configure production environment and CDN settings",
    description:
      "Set up production Salesforce org with CDN configuration, custom domain, SSL certificates, and DNS cutover plan.",
    batch: "Testing & Launch",
    priority: "must_have",
    fitGap: "config",
    effortEstimate: "medium",
    status: "approved",
  },
  {
    refId: "REQ-115",
    ws: "WS-7",
    title: "Implement Magento storefront decommission plan",
    description:
      "Plan and execute Magento storefront shutdown including read-only archive period, URL redirects, and historical data retention.",
    batch: "Testing & Launch",
    priority: "should_have",
    fitGap: "native",
    effortEstimate: "low",
    status: "draft",
  },
  {
    refId: "REQ-116",
    ws: "WS-7",
    title: "Execute accessibility audit and remediation",
    description:
      "Perform full WCAG 2.1 AA audit of production storefront using automated tools and manual testing. Fix all critical accessibility issues.",
    batch: "Testing & Launch",
    priority: "nice_to_have",
    fitGap: "third_party",
    effortEstimate: "very_high",
    status: "draft",
  },
  {
    refId: "REQ-117",
    ws: "WS-7",
    title: "Build automated smoke test suite for production monitoring",
    description:
      "Create lightweight automated smoke tests running every 15 minutes in production to detect critical failures in ordering and auth flows.",
    batch: "Testing & Launch",
    priority: "nice_to_have",
    fitGap: "custom_dev",
    effortEstimate: "medium",
    status: "draft",
  },
  {
    refId: "REQ-118",
    ws: "WS-7",
    title: "Develop hypercare support plan for 30-day post-launch period",
    description:
      "Define hypercare support model with extended hours, escalation paths, dedicated Salesforce support, and daily health check reviews.",
    batch: "Testing & Launch",
    priority: "should_have",
    fitGap: "native",
    effortEstimate: "low",
    status: "draft",
  },
];

const ALL_REQUIREMENTS: RequirementDef[] = [
  ...BATCH_1_FOUNDATION,
  ...BATCH_2_CATALOG,
  ...BATCH_3_CUSTOMER,
  ...BATCH_4_PRICING,
  ...BATCH_5_INTEGRATION,
  ...BATCH_6_CONTENT,
  ...BATCH_7_TESTING,
];

export const seedAcmeCorp = mutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    // Check if already seeded
    const existing = await ctx.db
      .query("programs")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    if (existing.some((p) => p.clientName === "AcmeCorp")) {
      throw new Error("AcmeCorp data already exists in this organization");
    }

    // 1. Create program
    const programId = await ctx.db.insert("programs", {
      orgId: args.orgId,
      name: "AcmeCorp Migration",
      clientName: "AcmeCorp",
      sourcePlatform: "magento",
      targetPlatform: "salesforce_b2b",
      phase: "discovery",
      status: "active",
      description:
        "Enterprise B2B migration from Magento to Salesforce B2B Commerce. 880+ dev-day engagement, 9K+ buyer accounts, 2K SKUs, 49K pricebook combinations, 8 user personas.",
    });

    // 2. Create 7 workstreams (Salesforce B2B template)
    const workstreamTemplates = [
      { name: "Storefront Foundation & Catalog", shortCode: "WS-1", sortOrder: 1 },
      { name: "Customer Accounts & Auth", shortCode: "WS-2", sortOrder: 2 },
      { name: "Pricing & Pricebooks", shortCode: "WS-3", sortOrder: 3 },
      { name: "Order Management & Checkout", shortCode: "WS-4", sortOrder: 4 },
      { name: "Integration & Data Migration", shortCode: "WS-5", sortOrder: 5 },
      { name: "Content & Experience", shortCode: "WS-6", sortOrder: 6 },
      { name: "Testing & Deployment", shortCode: "WS-7", sortOrder: 7 },
    ];

    const workstreamIds: Record<string, Id<"workstreams">> = {};
    for (const ws of workstreamTemplates) {
      const id = await ctx.db.insert("workstreams", {
        orgId: args.orgId,
        programId,
        name: ws.name,
        shortCode: ws.shortCode,
        status: "on_track",
        sprintCadence: 14,
        currentSprint: 1,
        sortOrder: ws.sortOrder,
      });
      workstreamIds[ws.shortCode] = id;
    }

    // 3. Insert 118 requirements across 7 batches
    for (const req of ALL_REQUIREMENTS) {
      await ctx.db.insert("requirements", {
        orgId: args.orgId,
        programId,
        workstreamId: workstreamIds[req.ws],
        refId: req.refId,
        title: req.title,
        description: req.description,
        batch: req.batch,
        priority: req.priority,
        fitGap: req.fitGap,
        effortEstimate: req.effortEstimate,
        status: req.status,
      });
    }

    return programId;
  },
});
