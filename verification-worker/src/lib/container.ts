import { DurableObject } from "cloudflare:workers";

interface ContainerConfig {
  repoUrl: string;
  branch: string;
  githubToken?: string;
  devServerCommand: string;
  devServerPort: number;
}

export class VerificationContainer extends DurableObject {
  private containerReady = false;
  private devServerPort: number | null = null;

  private async getConfiguredPort() {
    if (this.devServerPort !== null) {
      return this.devServerPort;
    }
    const storedPort = await this.ctx.storage.get<number>("devServerPort");
    this.devServerPort = storedPort ?? null;
    return this.devServerPort;
  }

  async setup(config: ContainerConfig): Promise<void> {
    const container = await (this.ctx as any).container;
    if (!container) {
      throw new Error("Container binding not available");
    }

    this.devServerPort = config.devServerPort;
    await this.ctx.storage.put("devServerPort", config.devServerPort);

    // Clone repository
    const cloneUrl = config.githubToken
      ? `https://x-access-token:${config.githubToken}@github.com/${config.repoUrl}.git`
      : `https://github.com/${config.repoUrl}.git`;

    await container.exec("git", [
      "clone", "--depth", "1", "--branch", config.branch,
      cloneUrl, "/workspace/app",
    ]);

    // Detect and install dependencies
    const hasBunLock = await container.exec("test", ["-f", "/workspace/app/bun.lock"])
      .then(() => true)
      .catch(() => false);

    if (hasBunLock) {
      await container.exec("bun", ["install"], { cwd: "/workspace/app" });
    } else {
      await container.exec("npm", ["install"], { cwd: "/workspace/app" });
    }

    // Start dev server in background
    void container.exec("sh", ["-c", `cd /workspace/app && ${config.devServerCommand} &`]);

    // Poll for dev server readiness
    const maxWait = 90_000;
    const pollInterval = 2_000;
    const start = Date.now();
    const port = container.getTcpPort(config.devServerPort);

    while (Date.now() - start < maxWait) {
      try {
        await port.fetch("http://container/");
        this.containerReady = true;
        await this.ctx.storage.put("containerReady", true);
        return;
      } catch {
        // Not ready yet
      }
      await new Promise((r) => setTimeout(r, pollInterval));
    }

    throw new Error(`Dev server failed to start within ${maxWait / 1000}s`);
  }

  async cleanup(): Promise<void> {
    this.containerReady = false;
    await this.ctx.storage.put("containerReady", false);
  }

  async fetch(request: Request): Promise<Response> {
    const container = await (this.ctx as any).container;
    if (!container) {
      return new Response("Container binding not available", { status: 500 });
    }

    const portNumber = await this.getConfiguredPort();
    const ready =
      this.containerReady ||
      (await this.ctx.storage.get<boolean>("containerReady")) === true;
    if (!ready || portNumber === null) {
      return new Response("Verification container is not ready", { status: 503 });
    }

    const url = new URL(request.url);
    const targetUrl = new URL(`${url.pathname}${url.search}`, "http://container");
    const tcpPort = container.getTcpPort(portNumber);
    return await tcpPort.fetch(new Request(targetUrl.toString(), request));
  }
}
