import type { Doc } from "../_generated/dataModel";
import { assembleDesignContext, classifyTaskType } from "./designContext";

interface CodebaseAnalysisContext {
  refId: string;
  implementationStatus: string;
  confidence: number;
  evidenceSummary: string;
  gapDescription?: string;
}

interface ContextData {
  program: Doc<"programs">;
  requirements: Doc<"requirements">[];
  skill: Doc<"skills">;
  recentExecutions: Doc<"agentExecutions">[];
  taskPrompt: string;
  designSnapshot?: {
    resolvedTokens: string;
    resolvedComponents: string;
    screenSpecs: string | null;
    interactionSpecs: string;
  } | null;
  taskTitle?: string;
  taskDescription?: string;
  codebaseAnalysis?: CodebaseAnalysisContext[];
  codebaseAnalysisTimestamp?: number;
}

function assembleCodebaseAnalysisContext(
  results: CodebaseAnalysisContext[],
  lastRunTimestamp?: number,
): string | null {
  if (results.length === 0) return null;

  const timestamp = lastRunTimestamp ? new Date(lastRunTimestamp).toISOString() : "unknown";

  const reqLines = results.map((r) => {
    let line = `  <requirement ref_id="${r.refId}" status="${r.implementationStatus}" confidence="${r.confidence}">`;
    if (r.evidenceSummary) {
      line += `\n    <evidence>${r.evidenceSummary}</evidence>`;
    }
    if (r.gapDescription) {
      line += `\n    <gap>${r.gapDescription}</gap>`;
    }
    line += `\n  </requirement>`;
    return line;
  });

  return `<codebase_analysis last_run="${timestamp}">\n${reqLines.join("\n")}\n</codebase_analysis>`;
}

export function assemblePrompt(data: ContextData): string {
  const { program, requirements, skill, recentExecutions, taskPrompt } = data;

  const sections: string[] = [];

  // 1. Program context
  const programLines = [`Name: ${program.name}`, `Client: ${program.clientName}`];
  if (program.engagementType) {
    programLines.push(`Engagement Type: ${program.engagementType.replace(/_/g, " ")}`);
  }
  if (
    program.sourcePlatform &&
    program.sourcePlatform !== "none" &&
    program.targetPlatform &&
    program.targetPlatform !== "none"
  ) {
    programLines.push(`Source: ${program.sourcePlatform} → Target: ${program.targetPlatform}`);
  }
  if (
    (program as any).techStack &&
    Array.isArray((program as any).techStack) &&
    (program as any).techStack.length > 0
  ) {
    const techStackFormatted = (program as any).techStack
      .map(
        (t: { category: string; technologies: string[] }) =>
          `${t.category}: ${t.technologies.join(", ")}`,
      )
      .join("; ");
    programLines.push(`Tech Stack: ${techStackFormatted}`);
  }
  programLines.push(`Phase: ${program.phase}`);
  programLines.push(`Status: ${program.status}`);
  sections.push(`<program_context>\n${programLines.join("\n")}\n</program_context>`);

  // 2. Requirements
  const reqLines = requirements.map(
    (r) => `${r.refId}: ${r.title} (${r.priority}, ${r.fitGap}, ${r.status})`,
  );
  sections.push(
    `<requirements count="${requirements.length}">
${reqLines.join("\n")}
</requirements>`,
  );

  // 3. Skill instructions
  sections.push(
    `<skill_instructions name="${skill.name}" domain="${skill.domain}" version="${skill.currentVersion}">
${skill.content}
</skill_instructions>`,
  );

  // 4. Recent executions
  if (recentExecutions.length > 0) {
    const execLines = recentExecutions.map(
      (e) => `${e.taskType} - ${e.outputSummary ?? "no output"} (${e.reviewStatus})`,
    );
    sections.push(
      `<recent_executions count="${recentExecutions.length}">
${execLines.join("\n")}
</recent_executions>`,
    );
  }

  // 5. Codebase analysis context
  if (data.codebaseAnalysis && data.codebaseAnalysis.length > 0) {
    const analysisBlock = assembleCodebaseAnalysisContext(
      data.codebaseAnalysis,
      data.codebaseAnalysisTimestamp,
    );
    if (analysisBlock) {
      sections.push(analysisBlock);
    }
  }

  // 6. Task prompt
  sections.push(
    `<task>
${taskPrompt}
</task>`,
  );

  // 7. Design context (dynamic budget based on task type)
  if (data.designSnapshot) {
    const taskType = classifyTaskType(data.taskTitle ?? data.taskPrompt, data.taskDescription);
    const designBlock = assembleDesignContext(data.designSnapshot, taskType);
    if (designBlock) {
      sections.push(designBlock);
    }
  }

  return sections.join("\n\n");
}
