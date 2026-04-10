export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 1000;
  const maxDelayMs = options?.maxDelayMs ?? 30000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const errorMessage = error instanceof Error ? error.message : String(error);

      // Detect rate limiting
      const isRateLimit =
        errorMessage.includes("429") ||
        errorMessage.toLowerCase().includes("rate limit") ||
        errorMessage.toLowerCase().includes("too many requests");

      // Detect overloaded
      const isOverloaded =
        errorMessage.includes("529") || errorMessage.toLowerCase().includes("overloaded");

      // Exponential backoff with jitter
      const exponentialDelay = baseDelayMs * 2 ** attempt;
      const jitter = Math.random() * baseDelayMs;
      let delay = Math.min(exponentialDelay + jitter, maxDelayMs);

      // Rate limits and overloaded: wait longer
      if (isRateLimit || isOverloaded) {
        delay = Math.min(delay * 2, maxDelayMs);
      }

      console.log(
        `[retry] Attempt ${attempt + 1}/${maxRetries} failed: ${errorMessage.slice(0, 100)}. Retrying in ${Math.round(delay)}ms`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // TypeScript: unreachable, but satisfies return type
  throw new Error("Retry exhausted");
}
