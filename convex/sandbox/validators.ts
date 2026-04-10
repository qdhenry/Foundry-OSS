import { RUNTIME_MODE_SEQUENCE, SETUP_STAGE_SEQUENCE } from "@foundry/types/sandbox";
import { v } from "convex/values";

function buildLiteralUnionValidator<T extends readonly [string, string, ...string[]]>(values: T) {
  const [first, second, ...rest] = values;
  return v.union(v.literal(first), v.literal(second), ...rest.map((value) => v.literal(value)));
}

export const SETUP_PROGRESS_STAGE_NAMES = SETUP_STAGE_SEQUENCE;

export const setupProgressStageValidator = buildLiteralUnionValidator(SETUP_PROGRESS_STAGE_NAMES);

export const sandboxRuntimeModeValidator = buildLiteralUnionValidator(RUNTIME_MODE_SEQUENCE);

export const setupProgressStateValidator = v.union(
  v.object({ status: v.literal("pending") }),
  v.object({
    status: v.literal("running"),
    startedAt: v.number(),
  }),
  v.object({
    status: v.literal("completed"),
    startedAt: v.number(),
    completedAt: v.number(),
  }),
  v.object({
    status: v.literal("failed"),
    startedAt: v.number(),
    failedAt: v.number(),
    error: v.string(),
  }),
  v.object({
    status: v.literal("skipped"),
    reason: v.string(),
    skippedAt: v.optional(v.number()),
  }),
);

const setupProgressStageFieldValidators = Object.fromEntries(
  SETUP_PROGRESS_STAGE_NAMES.map((stageName) => [
    stageName,
    v.optional(setupProgressStateValidator),
  ]),
) as Record<string, ReturnType<typeof v.optional>>;

export const setupProgressValidator = v.object({
  // Deprecated: networkValidation stage removed; kept optional for existing documents.
  networkValidation: v.optional(setupProgressStateValidator),
  ...setupProgressStageFieldValidators,
});
