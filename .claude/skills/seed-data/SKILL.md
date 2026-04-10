---
name: seed-data
description: Reset and seed the Convex database with AcmeCorp reference data (118 requirements, 8 skills, 7 workstreams) for demo preparation
---

# Seed Data

Reset the Convex database with AcmeCorp demo data.

## Prerequisites

- Convex dev server running (`bunx convex dev`) OR access to deploy
- A valid Clerk organization ID for the target tenant

## Steps

1. **Get the org ID** - Check the Clerk dashboard or ask the user for their organization ID
2. **Check existing data** - Query the programs table to see if AcmeCorp data already exists:
   ```bash
   bunx convex run seed:seedAcmeCorp '{"orgId": "<ORG_ID>"}'
   ```
3. **If data already exists** and user wants a fresh reset:
   - Delete existing AcmeCorp program and cascading data (requirements, workstreams, skills)
   - Re-run the seed mutation
4. **Verify** - Confirm the seed created:
   - 1 program (AcmeCorp Migration)
   - 7 workstreams (WS-1 through WS-7)
   - 118 requirements across 7 batches

## Seed Data Details

The seed function lives at `convex/seed.ts` and creates:

| Entity | Count | Details |
|--------|-------|---------|
| Program | 1 | "AcmeCorp Migration" - Magento to Salesforce B2B |
| Workstreams | 7 | Foundation, Catalog, Customer, Pricing, Integration, Content, Testing |
| Requirements | 118 | REQ-001 through REQ-118 across 7 batches |

## Batches

1. **Foundation** (17 reqs) - Platform setup, auth, data model
2. **Catalog & Products** (17 reqs) - Product migration, search, compliance
3. **Customer & Auth** (17 reqs) - Account migration, pricing visibility, registration
4. **Pricing & Orders** (17 reqs) - Pricebooks, checkout, tax, shipping
5. **Integration** (17 reqs) - ERP sync, inventory, data migration
6. **Content & UX** (17 reqs) - Storefront theme, CMS, accessibility
7. **Testing & Launch** (16 reqs) - UAT, load testing, deployment
