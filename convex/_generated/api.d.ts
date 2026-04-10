/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as __tests___helpers_aiFactory from "../__tests__/helpers/aiFactory.js";
import type * as __tests___helpers_baseFactory from "../__tests__/helpers/baseFactory.js";
import type * as __tests___helpers_designFactory from "../__tests__/helpers/designFactory.js";
import type * as __tests___helpers_googleDriveFactory from "../__tests__/helpers/googleDriveFactory.js";
import type * as activityEvents from "../activityEvents.js";
import type * as agentExecutions from "../agentExecutions.js";
import type * as agentTeam_agents from "../agentTeam/agents.js";
import type * as agentTeam_budgets from "../agentTeam/budgets.js";
import type * as agentTeam_dispatch from "../agentTeam/dispatch.js";
import type * as agentTeam_executions from "../agentTeam/executions.js";
import type * as agentTeam_generation from "../agentTeam/generation.js";
import type * as agentTeam_notifications from "../agentTeam/notifications.js";
import type * as agentTeam_orchestrator from "../agentTeam/orchestrator.js";
import type * as agentTeam_settings from "../agentTeam/settings.js";
import type * as agentTeam_templates from "../agentTeam/templates.js";
import type * as agentTeam_versions from "../agentTeam/versions.js";
import type * as agentTeam_workflowSetup from "../agentTeam/workflowSetup.js";
import type * as agentTeam_workflows from "../agentTeam/workflows.js";
import type * as ai from "../ai.js";
import type * as ai_models from "../ai/models.js";
import type * as ai_modelsInternal from "../ai/modelsInternal.js";
import type * as ai_prompts from "../ai/prompts.js";
import type * as ai_retry from "../ai/retry.js";
import type * as ai_schemas from "../ai/schemas.js";
import type * as aiWorkstreamSuggestions from "../aiWorkstreamSuggestions.js";
import type * as atlassian_client from "../atlassian/client.js";
import type * as atlassian_confluence_ingest from "../atlassian/confluence/ingest.js";
import type * as atlassian_confluence_ingester from "../atlassian/confluence/ingester.js";
import type * as atlassian_confluence_publish from "../atlassian/confluence/publish.js";
import type * as atlassian_confluence_publisher from "../atlassian/confluence/publisher.js";
import type * as atlassian_confluence_renderer from "../atlassian/confluence/renderer.js";
import type * as atlassian_confluence_webhookRegistration from "../atlassian/confluence/webhookRegistration.js";
import type * as atlassian_connections from "../atlassian/connections.js";
import type * as atlassian_jira_executor from "../atlassian/jira/executor.js";
import type * as atlassian_jira_mapper from "../atlassian/jira/mapper.js";
import type * as atlassian_jira_mapperQueries from "../atlassian/jira/mapperQueries.js";
import type * as atlassian_jira_push from "../atlassian/jira/push.js";
import type * as atlassian_jira_sync from "../atlassian/jira/sync.js";
import type * as atlassian_jira_webhookRegistration from "../atlassian/jira/webhookRegistration.js";
import type * as atlassian_oauthActions from "../atlassian/oauthActions.js";
import type * as atlassian_webhooks_handler from "../atlassian/webhooks/handler.js";
import type * as atlassian_webhooks_processor from "../atlassian/webhooks/processor.js";
import type * as auditLog from "../auditLog.js";
import type * as billing_aggregation from "../billing/aggregation.js";
import type * as billing_analytics from "../billing/analytics.js";
import type * as billing_checkout from "../billing/checkout.js";
import type * as billing_gates from "../billing/gates.js";
import type * as billing_overageReporting from "../billing/overageReporting.js";
import type * as billing_performanceAnalytics from "../billing/performanceAnalytics.js";
import type * as billing_plans from "../billing/plans.js";
import type * as billing_stripeSetup from "../billing/stripeSetup.js";
import type * as billing_subscriptions from "../billing/subscriptions.js";
import type * as billing_trial from "../billing/trial.js";
import type * as billing_usageCounters from "../billing/usageCounters.js";
import type * as billing_usageRecords from "../billing/usageRecords.js";
import type * as billing_validators from "../billing/validators.js";
import type * as billing_webhookProcessor from "../billing/webhookProcessor.js";
import type * as codebaseAnalysis from "../codebaseAnalysis.js";
import type * as codebaseAnalysisActions from "../codebaseAnalysisActions.js";
import type * as codebaseRequirementAnalysis from "../codebaseRequirementAnalysis.js";
import type * as codebaseRequirementAnalysis_validators from "../codebaseRequirementAnalysis/validators.js";
import type * as codebaseRequirementAnalysisActions from "../codebaseRequirementAnalysisActions.js";
import type * as comments from "../comments.js";
import type * as crons from "../crons.js";
import type * as dependencyDetection from "../dependencyDetection.js";
import type * as dependencyDetectionActions from "../dependencyDetectionActions.js";
import type * as designAnalyses from "../designAnalyses.js";
import type * as designAnalysisActions from "../designAnalysisActions.js";
import type * as designAnalysisHelpers from "../designAnalysisHelpers.js";
import type * as designAssets from "../designAssets.js";
import type * as designFidelityChecks from "../designFidelityChecks.js";
import type * as designInteractions from "../designInteractions.js";
import type * as designTokenSets from "../designTokenSets.js";
import type * as discoveryFindings from "../discoveryFindings.js";
import type * as documentAnalysis from "../documentAnalysis.js";
import type * as documentAnalysisActions from "../documentAnalysisActions.js";
import type * as documents from "../documents.js";
import type * as evidence from "../evidence.js";
import type * as executionAudit from "../executionAudit.js";
import type * as googleDrive_auth from "../googleDrive/auth.js";
import type * as googleDrive_credentials from "../googleDrive/credentials.js";
import type * as googleDrive_encryption from "../googleDrive/encryption.js";
import type * as googleDrive_importActions from "../googleDrive/importActions.js";
import type * as googleDrive_oauthActions from "../googleDrive/oauthActions.js";
import type * as health_checkpoints from "../health/checkpoints.js";
import type * as health_incidents from "../health/incidents.js";
import type * as health_serviceHealth from "../health/serviceHealth.js";
import type * as healthScoring from "../healthScoring.js";
import type * as healthScoringActions from "../healthScoringActions.js";
import type * as http from "../http.js";
import type * as integrations from "../integrations.js";
import type * as lib_agentServiceClient from "../lib/agentServiceClient.js";
import type * as lib_aiClient from "../lib/aiClient.js";
import type * as lib_aiCostTracking from "../lib/aiCostTracking.js";
import type * as lib_repoContext from "../lib/repoContext.js";
import type * as lib_streamingJsonParser from "../lib/streamingJsonParser.js";
import type * as lib_twelveLabsClient from "../lib/twelveLabsClient.js";
import type * as lib_videoFindingNormalization from "../lib/videoFindingNormalization.js";
import type * as lib_videoRetention from "../lib/videoRetention.js";
import type * as missionControl from "../missionControl.js";
import type * as missionControlActions from "../missionControlActions.js";
import type * as model_access from "../model/access.js";
import type * as model_audit from "../model/audit.js";
import type * as model_context from "../model/context.js";
import type * as model_designCascade from "../model/designCascade.js";
import type * as model_designContext from "../model/designContext.js";
import type * as model_slugify from "../model/slugify.js";
import type * as model_tokenParser from "../model/tokenParser.js";
import type * as notifications from "../notifications.js";
import type * as orchestration_controls from "../orchestration/controls.js";
import type * as orchestration_events from "../orchestration/events.js";
import type * as orchestration_executor from "../orchestration/executor.js";
import type * as orchestration_planner from "../orchestration/planner.js";
import type * as orchestration_reporter from "../orchestration/reporter.js";
import type * as orchestration_runs from "../orchestration/runs.js";
import type * as orchestration_workflow from "../orchestration/workflow.js";
import type * as playbooks from "../playbooks.js";
import type * as presence from "../presence.js";
import type * as programs from "../programs.js";
import type * as requirementRefinement from "../requirementRefinement.js";
import type * as requirementRefinementActions from "../requirementRefinementActions.js";
import type * as requirements from "../requirements.js";
import type * as riskAutogeneration from "../riskAutogeneration.js";
import type * as riskAutogenerationActions from "../riskAutogenerationActions.js";
import type * as risks from "../risks.js";
import type * as sandbox_aiProviders from "../sandbox/aiProviders.js";
import type * as sandbox_configs from "../sandbox/configs.js";
import type * as sandbox_envVault from "../sandbox/envVault.js";
import type * as sandbox_files from "../sandbox/files.js";
import type * as sandbox_logs from "../sandbox/logs.js";
import type * as sandbox_orchestrator from "../sandbox/orchestrator.js";
import type * as sandbox_presets from "../sandbox/presets.js";
import type * as sandbox_queue from "../sandbox/queue.js";
import type * as sandbox_secureSettings from "../sandbox/secureSettings.js";
import type * as sandbox_sessions from "../sandbox/sessions.js";
import type * as sandbox_telemetry from "../sandbox/telemetry.js";
import type * as sandbox_terminal from "../sandbox/terminal.js";
import type * as sandbox_validators from "../sandbox/validators.js";
import type * as scheduled from "../scheduled.js";
import type * as scheduledActions from "../scheduledActions.js";
import type * as search from "../search.js";
import type * as seed from "../seed.js";
import type * as shared_pipelineStage from "../shared/pipelineStage.js";
import type * as shared_videoContracts from "../shared/videoContracts.js";
import type * as skillTemplates from "../skillTemplates.js";
import type * as skillVersionAnalytics from "../skillVersionAnalytics.js";
import type * as skillVersions from "../skillVersions.js";
import type * as skills from "../skills.js";
import type * as sourceControl_branching_deviationDetection from "../sourceControl/branching/deviationDetection.js";
import type * as sourceControl_branching_strategyRecommendation from "../sourceControl/branching/strategyRecommendation.js";
import type * as sourceControl_branching_strategyRecommendationActions from "../sourceControl/branching/strategyRecommendationActions.js";
import type * as sourceControl_completeness_implementationScore from "../sourceControl/completeness/implementationScore.js";
import type * as sourceControl_completeness_readinessMatrix from "../sourceControl/completeness/readinessMatrix.js";
import type * as sourceControl_deployments_deploymentTracking from "../sourceControl/deployments/deploymentTracking.js";
import type * as sourceControl_deployments_environmentMapping from "../sourceControl/deployments/environmentMapping.js";
import type * as sourceControl_deployments_prDetection from "../sourceControl/deployments/prDetection.js";
import type * as sourceControl_deployments_prDetectionActions from "../sourceControl/deployments/prDetectionActions.js";
import type * as sourceControl_entityBindings from "../sourceControl/entityBindings.js";
import type * as sourceControl_factory from "../sourceControl/factory.js";
import type * as sourceControl_gates_codeEvidence from "../sourceControl/gates/codeEvidence.js";
import type * as sourceControl_health_codeHealthSignals from "../sourceControl/health/codeHealthSignals.js";
import type * as sourceControl_health_healthScoreIntegration from "../sourceControl/health/healthScoreIntegration.js";
import type * as sourceControl_installations from "../sourceControl/installations.js";
import type * as sourceControl_listAvailableRepos from "../sourceControl/listAvailableRepos.js";
import type * as sourceControl_mcp_queries from "../sourceControl/mcp/queries.js";
import type * as sourceControl_mcp_sourceControlMcpServer from "../sourceControl/mcp/sourceControlMcpServer.js";
import type * as sourceControl_patterns_patternMining from "../sourceControl/patterns/patternMining.js";
import type * as sourceControl_patterns_patternMiningActions from "../sourceControl/patterns/patternMiningActions.js";
import type * as sourceControl_patterns_snippetStorage from "../sourceControl/patterns/snippetStorage.js";
import type * as sourceControl_providers_github from "../sourceControl/providers/github.js";
import type * as sourceControl_provisioning from "../sourceControl/provisioning.js";
import type * as sourceControl_repositories from "../sourceControl/repositories.js";
import type * as sourceControl_reviews_contextAssembly from "../sourceControl/reviews/contextAssembly.js";
import type * as sourceControl_reviews_migrationReview from "../sourceControl/reviews/migrationReview.js";
import type * as sourceControl_reviews_migrationReviewActions from "../sourceControl/reviews/migrationReviewActions.js";
import type * as sourceControl_sync_initialSync from "../sourceControl/sync/initialSync.js";
import type * as sourceControl_sync_initialSyncActions from "../sourceControl/sync/initialSyncActions.js";
import type * as sourceControl_sync_reconciliation from "../sourceControl/sync/reconciliation.js";
import type * as sourceControl_sync_reconciliationActions from "../sourceControl/sync/reconciliationActions.js";
import type * as sourceControl_sync_retryQueue from "../sourceControl/sync/retryQueue.js";
import type * as sourceControl_sync_retryQueueActions from "../sourceControl/sync/retryQueueActions.js";
import type * as sourceControl_tasks_activityEvents from "../sourceControl/tasks/activityEvents.js";
import type * as sourceControl_tasks_dependencySync from "../sourceControl/tasks/dependencySync.js";
import type * as sourceControl_tasks_dependencySyncActions from "../sourceControl/tasks/dependencySyncActions.js";
import type * as sourceControl_tasks_issueSync from "../sourceControl/tasks/issueSync.js";
import type * as sourceControl_tasks_issueSyncActions from "../sourceControl/tasks/issueSyncActions.js";
import type * as sourceControl_tasks_prActions from "../sourceControl/tasks/prActions.js";
import type * as sourceControl_tasks_prActionsInternal from "../sourceControl/tasks/prActionsInternal.js";
import type * as sourceControl_tasks_prLifecycle from "../sourceControl/tasks/prLifecycle.js";
import type * as sourceControl_tasks_prLinking from "../sourceControl/tasks/prLinking.js";
import type * as sourceControl_tasks_prLinkingActions from "../sourceControl/tasks/prLinkingActions.js";
import type * as sourceControl_tasks_prTracking from "../sourceControl/tasks/prTracking.js";
import type * as sourceControl_templates from "../sourceControl/templates.js";
import type * as sourceControl_templates_fetcher from "../sourceControl/templates/fetcher.js";
import type * as sourceControl_templates_renderer from "../sourceControl/templates/renderer.js";
import type * as sourceControl_types from "../sourceControl/types.js";
import type * as sourceControl_webhooks_handler from "../sourceControl/webhooks/handler.js";
import type * as sourceControl_webhooks_processor from "../sourceControl/webhooks/processor.js";
import type * as sprintGateEvaluation from "../sprintGateEvaluation.js";
import type * as sprintGateEvaluationActions from "../sprintGateEvaluationActions.js";
import type * as sprintGates from "../sprintGates.js";
import type * as sprintPlanning from "../sprintPlanning.js";
import type * as sprintPlanningActions from "../sprintPlanningActions.js";
import type * as sprints from "../sprints.js";
import type * as subtaskGeneration from "../subtaskGeneration.js";
import type * as subtaskGenerationActions from "../subtaskGenerationActions.js";
import type * as subtasks from "../subtasks.js";
import type * as taskDecomposition from "../taskDecomposition.js";
import type * as taskDecompositionActions from "../taskDecompositionActions.js";
import type * as taskDesignSnapshots from "../taskDesignSnapshots.js";
import type * as taskVerificationActions from "../taskVerificationActions.js";
import type * as taskVerifications from "../taskVerifications.js";
import type * as tasks from "../tasks.js";
import type * as teamMembers from "../teamMembers.js";
import type * as traceAnalytics from "../traceAnalytics.js";
import type * as users from "../users.js";
import type * as videoAnalysis from "../videoAnalysis.js";
import type * as videoAnalysisActions from "../videoAnalysisActions.js";
import type * as videoAnalysisActionsTL from "../videoAnalysisActionsTL.js";
import type * as workstreamDependencies from "../workstreamDependencies.js";
import type * as workstreams from "../workstreams.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "__tests__/helpers/aiFactory": typeof __tests___helpers_aiFactory;
  "__tests__/helpers/baseFactory": typeof __tests___helpers_baseFactory;
  "__tests__/helpers/designFactory": typeof __tests___helpers_designFactory;
  "__tests__/helpers/googleDriveFactory": typeof __tests___helpers_googleDriveFactory;
  activityEvents: typeof activityEvents;
  agentExecutions: typeof agentExecutions;
  "agentTeam/agents": typeof agentTeam_agents;
  "agentTeam/budgets": typeof agentTeam_budgets;
  "agentTeam/dispatch": typeof agentTeam_dispatch;
  "agentTeam/executions": typeof agentTeam_executions;
  "agentTeam/generation": typeof agentTeam_generation;
  "agentTeam/notifications": typeof agentTeam_notifications;
  "agentTeam/orchestrator": typeof agentTeam_orchestrator;
  "agentTeam/settings": typeof agentTeam_settings;
  "agentTeam/templates": typeof agentTeam_templates;
  "agentTeam/versions": typeof agentTeam_versions;
  "agentTeam/workflowSetup": typeof agentTeam_workflowSetup;
  "agentTeam/workflows": typeof agentTeam_workflows;
  ai: typeof ai;
  "ai/models": typeof ai_models;
  "ai/modelsInternal": typeof ai_modelsInternal;
  "ai/prompts": typeof ai_prompts;
  "ai/retry": typeof ai_retry;
  "ai/schemas": typeof ai_schemas;
  aiWorkstreamSuggestions: typeof aiWorkstreamSuggestions;
  "atlassian/client": typeof atlassian_client;
  "atlassian/confluence/ingest": typeof atlassian_confluence_ingest;
  "atlassian/confluence/ingester": typeof atlassian_confluence_ingester;
  "atlassian/confluence/publish": typeof atlassian_confluence_publish;
  "atlassian/confluence/publisher": typeof atlassian_confluence_publisher;
  "atlassian/confluence/renderer": typeof atlassian_confluence_renderer;
  "atlassian/confluence/webhookRegistration": typeof atlassian_confluence_webhookRegistration;
  "atlassian/connections": typeof atlassian_connections;
  "atlassian/jira/executor": typeof atlassian_jira_executor;
  "atlassian/jira/mapper": typeof atlassian_jira_mapper;
  "atlassian/jira/mapperQueries": typeof atlassian_jira_mapperQueries;
  "atlassian/jira/push": typeof atlassian_jira_push;
  "atlassian/jira/sync": typeof atlassian_jira_sync;
  "atlassian/jira/webhookRegistration": typeof atlassian_jira_webhookRegistration;
  "atlassian/oauthActions": typeof atlassian_oauthActions;
  "atlassian/webhooks/handler": typeof atlassian_webhooks_handler;
  "atlassian/webhooks/processor": typeof atlassian_webhooks_processor;
  auditLog: typeof auditLog;
  "billing/aggregation": typeof billing_aggregation;
  "billing/analytics": typeof billing_analytics;
  "billing/checkout": typeof billing_checkout;
  "billing/gates": typeof billing_gates;
  "billing/overageReporting": typeof billing_overageReporting;
  "billing/performanceAnalytics": typeof billing_performanceAnalytics;
  "billing/plans": typeof billing_plans;
  "billing/stripeSetup": typeof billing_stripeSetup;
  "billing/subscriptions": typeof billing_subscriptions;
  "billing/trial": typeof billing_trial;
  "billing/usageCounters": typeof billing_usageCounters;
  "billing/usageRecords": typeof billing_usageRecords;
  "billing/validators": typeof billing_validators;
  "billing/webhookProcessor": typeof billing_webhookProcessor;
  codebaseAnalysis: typeof codebaseAnalysis;
  codebaseAnalysisActions: typeof codebaseAnalysisActions;
  codebaseRequirementAnalysis: typeof codebaseRequirementAnalysis;
  "codebaseRequirementAnalysis/validators": typeof codebaseRequirementAnalysis_validators;
  codebaseRequirementAnalysisActions: typeof codebaseRequirementAnalysisActions;
  comments: typeof comments;
  crons: typeof crons;
  dependencyDetection: typeof dependencyDetection;
  dependencyDetectionActions: typeof dependencyDetectionActions;
  designAnalyses: typeof designAnalyses;
  designAnalysisActions: typeof designAnalysisActions;
  designAnalysisHelpers: typeof designAnalysisHelpers;
  designAssets: typeof designAssets;
  designFidelityChecks: typeof designFidelityChecks;
  designInteractions: typeof designInteractions;
  designTokenSets: typeof designTokenSets;
  discoveryFindings: typeof discoveryFindings;
  documentAnalysis: typeof documentAnalysis;
  documentAnalysisActions: typeof documentAnalysisActions;
  documents: typeof documents;
  evidence: typeof evidence;
  executionAudit: typeof executionAudit;
  "googleDrive/auth": typeof googleDrive_auth;
  "googleDrive/credentials": typeof googleDrive_credentials;
  "googleDrive/encryption": typeof googleDrive_encryption;
  "googleDrive/importActions": typeof googleDrive_importActions;
  "googleDrive/oauthActions": typeof googleDrive_oauthActions;
  "health/checkpoints": typeof health_checkpoints;
  "health/incidents": typeof health_incidents;
  "health/serviceHealth": typeof health_serviceHealth;
  healthScoring: typeof healthScoring;
  healthScoringActions: typeof healthScoringActions;
  http: typeof http;
  integrations: typeof integrations;
  "lib/agentServiceClient": typeof lib_agentServiceClient;
  "lib/aiClient": typeof lib_aiClient;
  "lib/aiCostTracking": typeof lib_aiCostTracking;
  "lib/repoContext": typeof lib_repoContext;
  "lib/streamingJsonParser": typeof lib_streamingJsonParser;
  "lib/twelveLabsClient": typeof lib_twelveLabsClient;
  "lib/videoFindingNormalization": typeof lib_videoFindingNormalization;
  "lib/videoRetention": typeof lib_videoRetention;
  missionControl: typeof missionControl;
  missionControlActions: typeof missionControlActions;
  "model/access": typeof model_access;
  "model/audit": typeof model_audit;
  "model/context": typeof model_context;
  "model/designCascade": typeof model_designCascade;
  "model/designContext": typeof model_designContext;
  "model/slugify": typeof model_slugify;
  "model/tokenParser": typeof model_tokenParser;
  notifications: typeof notifications;
  "orchestration/controls": typeof orchestration_controls;
  "orchestration/events": typeof orchestration_events;
  "orchestration/executor": typeof orchestration_executor;
  "orchestration/planner": typeof orchestration_planner;
  "orchestration/reporter": typeof orchestration_reporter;
  "orchestration/runs": typeof orchestration_runs;
  "orchestration/workflow": typeof orchestration_workflow;
  playbooks: typeof playbooks;
  presence: typeof presence;
  programs: typeof programs;
  requirementRefinement: typeof requirementRefinement;
  requirementRefinementActions: typeof requirementRefinementActions;
  requirements: typeof requirements;
  riskAutogeneration: typeof riskAutogeneration;
  riskAutogenerationActions: typeof riskAutogenerationActions;
  risks: typeof risks;
  "sandbox/aiProviders": typeof sandbox_aiProviders;
  "sandbox/configs": typeof sandbox_configs;
  "sandbox/envVault": typeof sandbox_envVault;
  "sandbox/files": typeof sandbox_files;
  "sandbox/logs": typeof sandbox_logs;
  "sandbox/orchestrator": typeof sandbox_orchestrator;
  "sandbox/presets": typeof sandbox_presets;
  "sandbox/queue": typeof sandbox_queue;
  "sandbox/secureSettings": typeof sandbox_secureSettings;
  "sandbox/sessions": typeof sandbox_sessions;
  "sandbox/telemetry": typeof sandbox_telemetry;
  "sandbox/terminal": typeof sandbox_terminal;
  "sandbox/validators": typeof sandbox_validators;
  scheduled: typeof scheduled;
  scheduledActions: typeof scheduledActions;
  search: typeof search;
  seed: typeof seed;
  "shared/pipelineStage": typeof shared_pipelineStage;
  "shared/videoContracts": typeof shared_videoContracts;
  skillTemplates: typeof skillTemplates;
  skillVersionAnalytics: typeof skillVersionAnalytics;
  skillVersions: typeof skillVersions;
  skills: typeof skills;
  "sourceControl/branching/deviationDetection": typeof sourceControl_branching_deviationDetection;
  "sourceControl/branching/strategyRecommendation": typeof sourceControl_branching_strategyRecommendation;
  "sourceControl/branching/strategyRecommendationActions": typeof sourceControl_branching_strategyRecommendationActions;
  "sourceControl/completeness/implementationScore": typeof sourceControl_completeness_implementationScore;
  "sourceControl/completeness/readinessMatrix": typeof sourceControl_completeness_readinessMatrix;
  "sourceControl/deployments/deploymentTracking": typeof sourceControl_deployments_deploymentTracking;
  "sourceControl/deployments/environmentMapping": typeof sourceControl_deployments_environmentMapping;
  "sourceControl/deployments/prDetection": typeof sourceControl_deployments_prDetection;
  "sourceControl/deployments/prDetectionActions": typeof sourceControl_deployments_prDetectionActions;
  "sourceControl/entityBindings": typeof sourceControl_entityBindings;
  "sourceControl/factory": typeof sourceControl_factory;
  "sourceControl/gates/codeEvidence": typeof sourceControl_gates_codeEvidence;
  "sourceControl/health/codeHealthSignals": typeof sourceControl_health_codeHealthSignals;
  "sourceControl/health/healthScoreIntegration": typeof sourceControl_health_healthScoreIntegration;
  "sourceControl/installations": typeof sourceControl_installations;
  "sourceControl/listAvailableRepos": typeof sourceControl_listAvailableRepos;
  "sourceControl/mcp/queries": typeof sourceControl_mcp_queries;
  "sourceControl/mcp/sourceControlMcpServer": typeof sourceControl_mcp_sourceControlMcpServer;
  "sourceControl/patterns/patternMining": typeof sourceControl_patterns_patternMining;
  "sourceControl/patterns/patternMiningActions": typeof sourceControl_patterns_patternMiningActions;
  "sourceControl/patterns/snippetStorage": typeof sourceControl_patterns_snippetStorage;
  "sourceControl/providers/github": typeof sourceControl_providers_github;
  "sourceControl/provisioning": typeof sourceControl_provisioning;
  "sourceControl/repositories": typeof sourceControl_repositories;
  "sourceControl/reviews/contextAssembly": typeof sourceControl_reviews_contextAssembly;
  "sourceControl/reviews/migrationReview": typeof sourceControl_reviews_migrationReview;
  "sourceControl/reviews/migrationReviewActions": typeof sourceControl_reviews_migrationReviewActions;
  "sourceControl/sync/initialSync": typeof sourceControl_sync_initialSync;
  "sourceControl/sync/initialSyncActions": typeof sourceControl_sync_initialSyncActions;
  "sourceControl/sync/reconciliation": typeof sourceControl_sync_reconciliation;
  "sourceControl/sync/reconciliationActions": typeof sourceControl_sync_reconciliationActions;
  "sourceControl/sync/retryQueue": typeof sourceControl_sync_retryQueue;
  "sourceControl/sync/retryQueueActions": typeof sourceControl_sync_retryQueueActions;
  "sourceControl/tasks/activityEvents": typeof sourceControl_tasks_activityEvents;
  "sourceControl/tasks/dependencySync": typeof sourceControl_tasks_dependencySync;
  "sourceControl/tasks/dependencySyncActions": typeof sourceControl_tasks_dependencySyncActions;
  "sourceControl/tasks/issueSync": typeof sourceControl_tasks_issueSync;
  "sourceControl/tasks/issueSyncActions": typeof sourceControl_tasks_issueSyncActions;
  "sourceControl/tasks/prActions": typeof sourceControl_tasks_prActions;
  "sourceControl/tasks/prActionsInternal": typeof sourceControl_tasks_prActionsInternal;
  "sourceControl/tasks/prLifecycle": typeof sourceControl_tasks_prLifecycle;
  "sourceControl/tasks/prLinking": typeof sourceControl_tasks_prLinking;
  "sourceControl/tasks/prLinkingActions": typeof sourceControl_tasks_prLinkingActions;
  "sourceControl/tasks/prTracking": typeof sourceControl_tasks_prTracking;
  "sourceControl/templates": typeof sourceControl_templates;
  "sourceControl/templates/fetcher": typeof sourceControl_templates_fetcher;
  "sourceControl/templates/renderer": typeof sourceControl_templates_renderer;
  "sourceControl/types": typeof sourceControl_types;
  "sourceControl/webhooks/handler": typeof sourceControl_webhooks_handler;
  "sourceControl/webhooks/processor": typeof sourceControl_webhooks_processor;
  sprintGateEvaluation: typeof sprintGateEvaluation;
  sprintGateEvaluationActions: typeof sprintGateEvaluationActions;
  sprintGates: typeof sprintGates;
  sprintPlanning: typeof sprintPlanning;
  sprintPlanningActions: typeof sprintPlanningActions;
  sprints: typeof sprints;
  subtaskGeneration: typeof subtaskGeneration;
  subtaskGenerationActions: typeof subtaskGenerationActions;
  subtasks: typeof subtasks;
  taskDecomposition: typeof taskDecomposition;
  taskDecompositionActions: typeof taskDecompositionActions;
  taskDesignSnapshots: typeof taskDesignSnapshots;
  taskVerificationActions: typeof taskVerificationActions;
  taskVerifications: typeof taskVerifications;
  tasks: typeof tasks;
  teamMembers: typeof teamMembers;
  traceAnalytics: typeof traceAnalytics;
  users: typeof users;
  videoAnalysis: typeof videoAnalysis;
  videoAnalysisActions: typeof videoAnalysisActions;
  videoAnalysisActionsTL: typeof videoAnalysisActionsTL;
  workstreamDependencies: typeof workstreamDependencies;
  workstreams: typeof workstreams;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  workflow: {
    event: {
      create: FunctionReference<
        "mutation",
        "internal",
        { name: string; workflowId: string },
        string
      >;
      send: FunctionReference<
        "mutation",
        "internal",
        {
          eventId?: string;
          name?: string;
          result:
            | { kind: "success"; returnValue: any }
            | { error: string; kind: "failed" }
            | { kind: "canceled" };
          workflowId?: string;
          workpoolOptions?: {
            defaultRetryBehavior?: {
              base: number;
              initialBackoffMs: number;
              maxAttempts: number;
            };
            logLevel?: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
            maxParallelism?: number;
            retryActionsByDefault?: boolean;
          };
        },
        string
      >;
    };
    journal: {
      load: FunctionReference<
        "query",
        "internal",
        { shortCircuit?: boolean; workflowId: string },
        {
          blocked?: boolean;
          journalEntries: Array<{
            _creationTime: number;
            _id: string;
            step:
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  functionType: "query" | "mutation" | "action";
                  handle: string;
                  inProgress: boolean;
                  kind?: "function";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workId?: string;
                }
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  handle: string;
                  inProgress: boolean;
                  kind: "workflow";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workflowId?: string;
                }
              | {
                  args: { eventId?: string };
                  argsSize: number;
                  completedAt?: number;
                  eventId?: string;
                  inProgress: boolean;
                  kind: "event";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                }
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  inProgress: boolean;
                  kind: "sleep";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workId?: string;
                };
            stepNumber: number;
            workflowId: string;
          }>;
          logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
          ok: boolean;
          workflow: {
            _creationTime: number;
            _id: string;
            args: any;
            generationNumber: number;
            logLevel?: any;
            name?: string;
            onComplete?: { context?: any; fnHandle: string };
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            startedAt?: any;
            state?: any;
            workflowHandle: string;
          };
        }
      >;
      startSteps: FunctionReference<
        "mutation",
        "internal",
        {
          generationNumber: number;
          steps: Array<{
            retry?:
              | boolean
              | { base: number; initialBackoffMs: number; maxAttempts: number };
            schedulerOptions?: { runAt?: number } | { runAfter?: number };
            step:
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  functionType: "query" | "mutation" | "action";
                  handle: string;
                  inProgress: boolean;
                  kind?: "function";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workId?: string;
                }
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  handle: string;
                  inProgress: boolean;
                  kind: "workflow";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workflowId?: string;
                }
              | {
                  args: { eventId?: string };
                  argsSize: number;
                  completedAt?: number;
                  eventId?: string;
                  inProgress: boolean;
                  kind: "event";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                }
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  inProgress: boolean;
                  kind: "sleep";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workId?: string;
                };
          }>;
          workflowId: string;
          workpoolOptions?: {
            defaultRetryBehavior?: {
              base: number;
              initialBackoffMs: number;
              maxAttempts: number;
            };
            logLevel?: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
            maxParallelism?: number;
            retryActionsByDefault?: boolean;
          };
        },
        Array<{
          _creationTime: number;
          _id: string;
          step:
            | {
                args: any;
                argsSize: number;
                completedAt?: number;
                functionType: "query" | "mutation" | "action";
                handle: string;
                inProgress: boolean;
                kind?: "function";
                name: string;
                runResult?:
                  | { kind: "success"; returnValue: any }
                  | { error: string; kind: "failed" }
                  | { kind: "canceled" };
                startedAt: number;
                workId?: string;
              }
            | {
                args: any;
                argsSize: number;
                completedAt?: number;
                handle: string;
                inProgress: boolean;
                kind: "workflow";
                name: string;
                runResult?:
                  | { kind: "success"; returnValue: any }
                  | { error: string; kind: "failed" }
                  | { kind: "canceled" };
                startedAt: number;
                workflowId?: string;
              }
            | {
                args: { eventId?: string };
                argsSize: number;
                completedAt?: number;
                eventId?: string;
                inProgress: boolean;
                kind: "event";
                name: string;
                runResult?:
                  | { kind: "success"; returnValue: any }
                  | { error: string; kind: "failed" }
                  | { kind: "canceled" };
                startedAt: number;
              }
            | {
                args: any;
                argsSize: number;
                completedAt?: number;
                inProgress: boolean;
                kind: "sleep";
                name: string;
                runResult?:
                  | { kind: "success"; returnValue: any }
                  | { error: string; kind: "failed" }
                  | { kind: "canceled" };
                startedAt: number;
                workId?: string;
              };
          stepNumber: number;
          workflowId: string;
        }>
      >;
    };
    workflow: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        { workflowId: string },
        null
      >;
      cleanup: FunctionReference<
        "mutation",
        "internal",
        { force?: boolean; workflowId: string },
        boolean
      >;
      complete: FunctionReference<
        "mutation",
        "internal",
        {
          generationNumber: number;
          runResult:
            | { kind: "success"; returnValue: any }
            | { error: string; kind: "failed" }
            | { kind: "canceled" };
          workflowId: string;
        },
        null
      >;
      create: FunctionReference<
        "mutation",
        "internal",
        {
          maxParallelism?: number;
          onComplete?: { context?: any; fnHandle: string };
          startAsync?: boolean;
          workflowArgs: any;
          workflowHandle: string;
          workflowName: string;
        },
        string
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { workflowId: string },
        {
          inProgress: Array<{
            _creationTime: number;
            _id: string;
            step:
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  functionType: "query" | "mutation" | "action";
                  handle: string;
                  inProgress: boolean;
                  kind?: "function";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workId?: string;
                }
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  handle: string;
                  inProgress: boolean;
                  kind: "workflow";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workflowId?: string;
                }
              | {
                  args: { eventId?: string };
                  argsSize: number;
                  completedAt?: number;
                  eventId?: string;
                  inProgress: boolean;
                  kind: "event";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                }
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  inProgress: boolean;
                  kind: "sleep";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workId?: string;
                };
            stepNumber: number;
            workflowId: string;
          }>;
          logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
          workflow: {
            _creationTime: number;
            _id: string;
            args: any;
            generationNumber: number;
            logLevel?: any;
            name?: string;
            onComplete?: { context?: any; fnHandle: string };
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            startedAt?: any;
            state?: any;
            workflowHandle: string;
          };
        }
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          order: "asc" | "desc";
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            args: any;
            context?: any;
            name?: string;
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            workflowId: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      listByName: FunctionReference<
        "query",
        "internal",
        {
          name: string;
          order: "asc" | "desc";
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            args: any;
            context?: any;
            name?: string;
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            workflowId: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      listSteps: FunctionReference<
        "query",
        "internal",
        {
          order: "asc" | "desc";
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          workflowId: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            args: any;
            completedAt?: number;
            eventId?: string;
            kind: "function" | "workflow" | "event" | "sleep";
            name: string;
            nestedWorkflowId?: string;
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            startedAt: number;
            stepId: string;
            stepNumber: number;
            workId?: string;
            workflowId: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      restart: FunctionReference<
        "mutation",
        "internal",
        { from?: number | string; startAsync?: boolean; workflowId: string },
        null
      >;
    };
  };
};
