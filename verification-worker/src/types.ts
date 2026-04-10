export interface Env {
  VERIFICATION_API_SECRET: string;
  ANTHROPIC_API_KEY: string;
  CONVEX_HTTP_URL: string;
  VERIFICATION_LOG_LEVEL: string;
  BROWSER: Fetcher;
  VerificationContainer: DurableObjectNamespace;
}
