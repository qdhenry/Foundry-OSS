<overview>
Complete map of all Foundry component domains and page routes. Use this to plan subagent batches and verify full coverage.
</overview>

<component_domains>

<domain name="ai" path="src/components/ai/">
- ActivityFeed.tsx
- ExecuteSkillModal.tsx
- ExecutionOutput.tsx
</domain>

<domain name="ai-features" path="src/components/ai-features/">
- DocumentAnalysisSuggestions.tsx
- RequirementRefinementPanel.tsx
- RiskAssessmentPanel.tsx
- SprintCapacityPlanner.tsx
- SprintGateEvaluator.tsx
- TaskDecompositionPanel.tsx
</domain>

<domain name="audit" path="src/components/audit/">
- AuditEntry.tsx
- AuditFilters.tsx
- AuditTimeline.tsx
</domain>

<domain name="comments" path="src/components/comments/">
- CommentThread.tsx
</domain>

<domain name="coordination" path="src/components/coordination/">
- DependencyManager.tsx
- WorkstreamDependencies.tsx
</domain>

<domain name="dashboard" path="src/components/dashboard/">
- AiActivityFeed.tsx
- KpiCards.tsx
- RequirementStatusBars.tsx
- WorkstreamGrid.tsx
</domain>

<domain name="discovery" path="src/components/discovery/">
- AnalysisProgress.tsx
- AnalysisProgressPanel.tsx
- CreateRequirementForm.tsx
- DiscoveryEmptyState.tsx
- EvidenceUpload.tsx
- FindingCard.tsx
- FindingEditModal.tsx
- FindingGroup.tsx
- ImportStatusPicker.tsx
- MergeableFindingCard.tsx
- ReAnalyzeDialog.tsx
- RequirementDetailPanel.tsx
- RequirementFilters.tsx
- RequirementsTable.tsx
</domain>

<domain name="documents" path="src/components/documents/">
- AnalysisSidePanel.tsx
- DocumentCard.tsx
- DocumentFilters.tsx
- DocumentUploadZone.tsx
</domain>

<domain name="gates" path="src/components/gates/">
- ApprovalPanel.tsx
- CriteriaChecklist.tsx
- GateCard.tsx
</domain>

<domain name="integrations" path="src/components/integrations/">
- IntegrationCard.tsx
- IntegrationFilters.tsx
- IntegrationFlowDiagram.tsx
</domain>

<domain name="layout" path="src/components/layout/">
- Breadcrumbs.tsx
- ThemeToggle.tsx
</domain>

<domain name="mission-control" path="src/components/mission-control/">
- DailyDigest.tsx
- DependencySuggestions.tsx
- HealthScoreCard.tsx
</domain>

<domain name="pipeline" path="src/components/pipeline/">
Scan dynamically — files may be added.
</domain>

<domain name="pipeline-lab" path="src/components/pipeline-lab/">
Scan dynamically — files may be added.
</domain>

<domain name="playbooks" path="src/components/playbooks/">
- InstanceCard.tsx
- StepEditor.tsx
</domain>

<domain name="programs" path="src/components/programs/">
- SeedDataButton.tsx
- wizard/AnalysisStep.tsx
- wizard/DocumentUploadStep.tsx
- wizard/LaunchStep.tsx
- wizard/ReviewStep.tsx
- wizard/WizardStepIndicator.tsx
</domain>

<domain name="risks" path="src/components/risks/">
- RiskCard.tsx
- RiskFilters.tsx
- RiskMatrix.tsx
</domain>

<domain name="sandbox" path="src/components/sandbox/">
- ChatPanel.tsx
- RuntimeModeBadge.tsx
- SandboxConfigPanel.tsx
- SandboxEditor.tsx
- SandboxFileChanges.tsx
- SandboxHUD.tsx
- SandboxLogStream.tsx
- SandboxManagerPage.tsx
- SandboxSettingsPage.tsx
- SandboxStatusBadge.tsx
- SandboxTerminal.tsx
- StageProgress.tsx
</domain>

<domain name="search" path="src/components/search/">
- CommandPalette.tsx
- SearchProvider.tsx
</domain>

<domain name="shared" path="src/components/shared/">
- ActivityFeed.tsx
- PresenceBar.tsx
</domain>

<domain name="skills" path="src/components/skills/">
- SkillEditor.tsx
- SkillTemplateModal.tsx
- VersionDiff.tsx
- VersionHistory.tsx
</domain>

<domain name="source-control" path="src/components/source-control/">
- BranchStrategyPanel.tsx
- CodeEvidenceSection.tsx
- CodeHealthSection.tsx
- DeploymentTimeline.tsx
- ProvisionFromTemplate.tsx
- ReadinessMatrix.tsx
- SnippetCard.tsx
</domain>

<domain name="sprints" path="src/components/sprints/">
- SprintCard.tsx
- SprintFilters.tsx
</domain>

<domain name="tasks" path="src/components/tasks/">
- TaskFilters.tsx
</domain>

<domain name="videos" path="src/components/videos/">
- AnalysisCompletionCard.tsx
- VideoActivityFeed.tsx
</domain>

</component_domains>

<page_routes>

<route_group name="auth">
- src/app/page.tsx (landing)
- src/app/sign-in/[[...sign-in]]/page.tsx
- src/app/sign-up/[[...sign-up]]/page.tsx
</route_group>

<route_group name="programs">
- src/app/(dashboard)/programs/page.tsx (program list)
- src/app/(dashboard)/programs/new/page.tsx (create program)
</route_group>

<route_group name="program-scoped" params="[programId]">
- page.tsx (program dashboard)
- activity/page.tsx
- audit/page.tsx
- discovery/page.tsx
- documents/page.tsx
- documents/upload/page.tsx
- gates/page.tsx
- gates/new/page.tsx
- gates/[gateId]/page.tsx
- integrations/page.tsx
- integrations/new/page.tsx
- integrations/[integrationId]/page.tsx
- mission-control/page.tsx
- patterns/page.tsx
- pipeline-lab/page.tsx
- playbooks/page.tsx
- playbooks/new/page.tsx
- playbooks/[playbookId]/page.tsx
- risks/page.tsx
- risks/new/page.tsx
- risks/[riskId]/page.tsx
- settings/page.tsx
- skills/page.tsx
- skills/new/page.tsx
- skills/[skillId]/page.tsx
- sprints/page.tsx
- sprints/[sprintId]/page.tsx
- tasks/page.tsx
- tasks/new/page.tsx
- tasks/[taskId]/page.tsx
- videos/page.tsx
- videos/upload/page.tsx
- videos/[analysisId]/page.tsx
- workstreams/page.tsx
- workstreams/[workstreamId]/page.tsx
</route_group>

<route_group name="sandboxes">
- src/app/(dashboard)/sandboxes/page.tsx
- src/app/(dashboard)/sandboxes/settings/page.tsx
</route_group>

</page_routes>

<batching_strategy>
**Recommended subagent wave plan (6 per wave):**

Wave 1 (largest domains):
1. discovery (14 files)
2. sandbox (12 files)
3. source-control (7 files)
4. ai-features (6 files)
5. programs (6 files)
6. documents (4 files)

Wave 2:
7. dashboard (4 files)
8. skills (4 files)
9. risks (3 files)
10. gates (3 files)
11. integrations (3 files)
12. ai (3 files)

Wave 3:
13. audit (3 files)
14. mission-control (3 files)
15. playbooks (2 files)
16. coordination (2 files)
17. sprints (2 files)
18. search (2 files)

Wave 4:
19. shared (2 files)
20. layout (2 files)
21. videos (2 files)
22. comments (1 file)
23. tasks (1 file)
24. pipeline + pipeline-lab (dynamic scan)

Wave 5:
25. pages batch (42 page routes)
</batching_strategy>
