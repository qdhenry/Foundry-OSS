FROM node:22-slim

RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*

# Install bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

RUN useradd -m -s /bin/bash -u 1000 verifier \
    && chown -R verifier:verifier /home/verifier

WORKDIR /workspace
EXPOSE 3000 5173 8080
