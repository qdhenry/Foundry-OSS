FROM docker.io/cloudflare/sandbox:0.7.4

# Claude Code CLI is required for sandbox task execution.
RUN npm install -g @anthropic-ai/claude-code

# Create a non-root user — Claude Code refuses --dangerously-skip-permissions as root.
RUN useradd -m -s /bin/bash -u 1000 sandbox \
    && chown -R sandbox:sandbox /workspace

# Required during local development to access exposed ports.
EXPOSE 8080
