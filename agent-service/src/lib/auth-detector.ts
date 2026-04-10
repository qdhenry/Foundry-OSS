import { access, constants, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface AuthStatus {
  source: "manual_config" | "env_var" | "claude_code_oauth" | "none";
  isConfigured: boolean;
  claudeCodeInstalled: boolean;
  claudeCodeEmail?: string;
  apiKeyPrefix?: string;
}

const CONFIG_DIR = join(process.cwd(), ".config");
const CONFIG_PATH = join(CONFIG_DIR, "auth.json");
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedStatus: AuthStatus | null = null;
let cacheTimestamp = 0;

function invalidateCache() {
  cachedStatus = null;
  cacheTimestamp = 0;
}

function keyPrefix(key: string): string {
  return `${key.slice(0, 10)}...`;
}

async function readClaudeCodeConfig(): Promise<{
  installed: boolean;
  email?: string;
}> {
  try {
    const raw = await readFile(join(homedir(), ".claude.json"), "utf-8");
    const config = JSON.parse(raw);
    const email = config?.oauthAccount?.emailAddress;
    return { installed: true, email: email || undefined };
  } catch {
    return { installed: false };
  }
}

async function readManualConfig(): Promise<string | null> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    const config = JSON.parse(raw);
    return config?.apiKey || null;
  } catch {
    return null;
  }
}

export async function detectAuthStatus(): Promise<AuthStatus> {
  if (cachedStatus && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedStatus;
  }

  const claudeCode = await readClaudeCodeConfig();

  // Priority 1: Manual config
  const manualKey = await readManualConfig();
  if (manualKey) {
    cachedStatus = {
      source: "manual_config",
      isConfigured: true,
      claudeCodeInstalled: claudeCode.installed,
      claudeCodeEmail: claudeCode.email,
      apiKeyPrefix: keyPrefix(manualKey),
    };
    cacheTimestamp = Date.now();
    return cachedStatus;
  }

  // Priority 2: Environment variable
  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey) {
    cachedStatus = {
      source: "env_var",
      isConfigured: true,
      claudeCodeInstalled: claudeCode.installed,
      claudeCodeEmail: claudeCode.email,
      apiKeyPrefix: keyPrefix(envKey),
    };
    cacheTimestamp = Date.now();
    return cachedStatus;
  }

  // Priority 3: Claude Code OAuth
  if (claudeCode.installed && claudeCode.email) {
    cachedStatus = {
      source: "claude_code_oauth",
      isConfigured: true,
      claudeCodeInstalled: true,
      claudeCodeEmail: claudeCode.email,
    };
    cacheTimestamp = Date.now();
    return cachedStatus;
  }

  // No auth available
  cachedStatus = {
    source: "none",
    isConfigured: false,
    claudeCodeInstalled: claudeCode.installed,
    claudeCodeEmail: claudeCode.email,
  };
  cacheTimestamp = Date.now();
  return cachedStatus;
}

export async function getApiKey(): Promise<string | null> {
  const manualKey = await readManualConfig();
  if (manualKey) return manualKey;

  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey) return envKey;

  // Claude Code OAuth: SDK subprocess handles auth itself
  return null;
}

export async function setApiKey(key: string): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await writeFile(CONFIG_PATH, JSON.stringify({ apiKey: key }), {
    mode: 0o600,
  });
  invalidateCache();
}

export async function clearApiKey(): Promise<void> {
  try {
    await access(CONFIG_PATH, constants.F_OK);
    await unlink(CONFIG_PATH);
  } catch {
    // File doesn't exist, nothing to clear
  }
  invalidateCache();
}
