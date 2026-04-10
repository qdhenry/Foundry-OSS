# src/components/
~360 files, feature-based organization. Co-located: Component.tsx + .stories.tsx + .test.tsx

## Domains
layout/ (Sidebar,Header) | sandbox/ (HUD flagship) | ai/ (ActivityFeed,ExecuteSkill)
ai-features/ (TaskDecomp,RiskAssess,SprintPlanner,GateEval,DocAnalysis)
audit/ | discovery/ | tasks/ | skills/ | gates/ | risks/ | sprints/
pipeline/ | pipeline-lab/ | programs/ | playbooks/ | source-control/ | videos/
brand/ | comments/ | coordination/ | dashboard/ | documents/ | integrations/
mission-control/ | search/ | shared/ (PresenceBar)

## Sandbox HUD
SandboxHUD.tsx (~485 lines). Fixed bottom panel, 36px collapsed, 400px max expanded.
Tabs per session. Sub-tabs: Logs, Terminal, Files, Editor, Audit, Chat.
State: SandboxHUDProvider (useReducer) in lib/sandboxHUDContext.tsx

## Styling Rules
- Design tokens only, never raw Tailwind colors (text-primary, not text-gray-900)
- Use globals.css utility classes (.btn-primary, .card, .input)
- Instrument Serif for headings, DM Sans for body
- No purple color schemes
- Dark mode: .dark class on root

## Storybook
@storybook/nextjs-vite | Mocks: .storybook/mocks/ (Convex, Clerk, ProgramContext)
Variants: Default, Empty, Mobile, Loading | autodocs + a11y addon

## Icons
@untitledui/icons — import individual: `import { Grid01 } from "@untitledui/icons"`
