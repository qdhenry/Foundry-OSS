"use client";

import type { FitAddon as XTermFitAddon } from "@xterm/addon-fit";
import type { Terminal as XTermTerminal } from "@xterm/xterm";
import { useCallback, useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import type { SandboxTerminalConnectionInfo } from "../backend";
import { useSandboxBackend } from "../backend";
import { TerminalReconnectOverlay } from "../resilience-ui/service-errors/TerminalReconnectOverlay";

interface SandboxTerminalProps {
  sessionId: string;
  disabled?: boolean;
}

type ConnectionState = "disconnected" | "connecting" | "connected";

interface XTermDisposable {
  dispose: () => void;
}

function safeErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error instanceof Error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
    if (message != null) {
      try {
        const serialized = JSON.stringify(message);
        if (serialized && serialized !== "{}") return serialized;
      } catch {
        // Fall through to fallback.
      }
    }
  }
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") return serialized;
  } catch {
    // Fall through to fallback.
  }
  return fallback;
}

function trimToUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function summarizeInputForLog(input: string): string {
  return input.replace(/\n/g, "\\n").replace(/\r/g, "\\r").slice(0, 80);
}

export function SandboxTerminal({ sessionId, disabled }: SandboxTerminalProps) {
  const { getTerminalConnectionInfo } = useSandboxBackend();
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTermTerminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<XTermFitAddon | null>(null);
  const onDataDisposableRef = useRef<XTermDisposable | null>(null);
  const onResizeDisposableRef = useRef<XTermDisposable | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [state, setState] = useState<ConnectionState>("disconnected");
  const [error, setError] = useState<string | null>(null);

  // Auto-reconnect state
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [reconnectNextAt, setReconnectNextAt] = useState(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isManualDisconnectRef = useRef(false);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];

  const clearInputBindings = useCallback(() => {
    onDataDisposableRef.current?.dispose();
    onDataDisposableRef.current = null;
    onResizeDisposableRef.current?.dispose();
    onResizeDisposableRef.current = null;
  }, []);

  const bindInputHandlers = useCallback(
    (
      term: XTermTerminal,
      handlers: {
        onData: (data: string) => void;
        onResize?: (size: { cols: number; rows: number }) => void;
      },
    ) => {
      clearInputBindings();
      onDataDisposableRef.current = term.onData(handlers.onData) as XTermDisposable;
      if (handlers.onResize) {
        onResizeDisposableRef.current = term.onResize(handlers.onResize) as XTermDisposable;
      }
    },
    [clearInputBindings],
  );

  const ensureTerminal = useCallback(async (): Promise<XTermTerminal> => {
    if (termRef.current) {
      return termRef.current;
    }

    if (!terminalRef.current) {
      throw new Error("Interactive terminal unavailable");
    }

    const [{ Terminal }, { FitAddon }] = await Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
    ]);

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      // Preserve line alignment when PTY output contains LF-only newlines.
      convertEol: true,
      theme: {
        background: "#0a0e1a",
        foreground: "#6878a0",
        cursor: "#60a5fa",
      },
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(terminalRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    resizeObserverRef.current?.disconnect();
    const observer = new ResizeObserver(() => fitRef.current?.fit());
    observer.observe(terminalRef.current);
    resizeObserverRef.current = observer;

    return term;
  }, []);

  const disconnectActiveTransport = useCallback(() => {
    clearInputBindings();
    if (wsRef.current) {
      console.info("[SandboxTerminal] Closing websocket terminal", {
        sessionId,
        readyState: wsRef.current.readyState,
      });
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [clearInputBindings, sessionId]);

  const connectViaWebSocket = useCallback(
    async (info: SandboxTerminalConnectionInfo, term: XTermTerminal) => {
      const wsBaseUrl = trimToUndefined(info.wsUrl);
      if (!wsBaseUrl) {
        throw new Error("Terminal websocket URL is unavailable");
      }
      const token = trimToUndefined(info.token);
      if (!token) {
        throw new Error("Terminal websocket token is unavailable");
      }

      const url = `${wsBaseUrl}?token=${encodeURIComponent(token)}&cols=${term.cols}&rows=${term.rows}`;
      console.info("[SandboxTerminal] Connecting websocket terminal", {
        sessionId,
        url,
        transport: info.transport ?? "websocket",
        cwd: info.cwd ?? null,
      });
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        console.info("[SandboxTerminal] websocket connected", {
          sessionId,
          readyState: ws.readyState,
        });
        setState("connected");
        term.focus();
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer || ArrayBuffer.isView(event.data)) {
          const binaryPayload =
            event.data instanceof ArrayBuffer
              ? new Uint8Array(event.data)
              : new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);
          console.info("[SandboxTerminal] websocket output (binary)", {
            sessionId,
            bytes: binaryPayload.byteLength,
          });
          term.write(binaryPayload);
          return;
        }

        if (event.data instanceof Blob) {
          console.info("[SandboxTerminal] websocket output (blob)", {
            sessionId,
            bytes: event.data.size,
          });
          void event.data
            .arrayBuffer()
            .then((buffer) => {
              term.write(new Uint8Array(buffer));
            })
            .catch((blobError) => {
              console.error("[SandboxTerminal] Failed to decode blob output", blobError);
              setError(safeErrorMessage(blobError, "Terminal output decode failed"));
            });
          return;
        }

        if (typeof event.data === "string") {
          console.info("[SandboxTerminal] websocket output (text)", {
            sessionId,
            length: event.data.length,
            preview: summarizeInputForLog(event.data),
          });
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "exit") {
              console.info("[SandboxTerminal] websocket exit payload", {
                sessionId,
                code: msg.code ?? null,
              });
              term.writeln(`\r\n[Process exited with code ${msg.code ?? "?"}]`);
              setState("disconnected");
              return;
            } else if (msg.type === "error") {
              const message = safeErrorMessage(msg?.message, "Terminal error");
              console.error("[SandboxTerminal] websocket error payload", {
                sessionId,
                message,
              });
              setError(message);
              return;
            }
          } catch {
            // Fall through for regular UTF-8 output payloads.
          }

          term.write(event.data);
          return;
        }

        console.info("[SandboxTerminal] websocket output (unknown)", {
          sessionId,
          outputType: typeof event.data,
        });
      };

      ws.onclose = (closeEvent) => {
        console.info("[SandboxTerminal] websocket closed", {
          sessionId,
          code: closeEvent.code,
          reason: closeEvent.reason || null,
          wasClean: closeEvent.wasClean,
        });
        clearInputBindings();
        if (wsRef.current === ws) {
          wsRef.current = null;
        }

        // Auto-reconnect if not a manual disconnect and not a clean close
        if (!isManualDisconnectRef.current && !closeEvent.wasClean) {
          setReconnectAttempt((prev) => {
            const nextAttempt = prev + 1;
            if (nextAttempt <= MAX_RECONNECT_ATTEMPTS) {
              const delay =
                RECONNECT_DELAYS[Math.min(nextAttempt - 1, RECONNECT_DELAYS.length - 1)];
              setReconnectNextAt(Date.now() + delay);
              setState("disconnected");
              return nextAttempt;
            }
            setState("disconnected");
            setError("Connection lost — automatic reconnect failed");
            return 0;
          });
        } else {
          setState("disconnected");
          isManualDisconnectRef.current = false;
        }
      };

      ws.onerror = (event) => {
        console.error("[SandboxTerminal] websocket error", {
          sessionId,
          readyState: ws.readyState,
          eventType: event.type,
        });
        setError("WebSocket connection failed");
      };

      bindInputHandlers(term, {
        onData: (data) => {
          console.info("[SandboxTerminal] onData -> websocket send", {
            sessionId,
            rawLength: data.length,
            preview: summarizeInputForLog(data),
            readyState: ws.readyState,
          });
          if (ws.readyState !== WebSocket.OPEN) {
            return;
          }

          try {
            ws.send(new TextEncoder().encode(data));
          } catch (sendError) {
            console.error("[SandboxTerminal] websocket send failed", sendError);
            setError(safeErrorMessage(sendError, "Failed to write to terminal"));
          }
        },
        onResize: ({ cols, rows }) => {
          console.info("[SandboxTerminal] onResize -> websocket send", {
            sessionId,
            cols,
            rows,
            readyState: ws.readyState,
          });
          if (ws.readyState !== WebSocket.OPEN) {
            return;
          }

          try {
            ws.send(JSON.stringify({ type: "resize", cols, rows }));
          } catch (sendError) {
            console.error("[SandboxTerminal] websocket resize send failed", sendError);
            setError(safeErrorMessage(sendError, "Failed to resize terminal"));
          }
        },
      });
    },
    [bindInputHandlers, clearInputBindings, sessionId],
  );

  const connect = useCallback(async () => {
    if (!terminalRef.current || disabled || state === "connecting") return;

    console.info("[SandboxTerminal] Connect requested", { sessionId });
    setState("connecting");
    setError(null);

    try {
      const info = await getTerminalConnectionInfo({ sessionId });
      console.info("[SandboxTerminal] Connection info received", {
        sessionId,
        transport: info.transport ?? "websocket",
        hasWsUrl: Boolean(info.wsUrl),
        hasToken: Boolean(info.token),
        cwd: info.cwd ?? null,
      });
      const term = await ensureTerminal();

      await connectViaWebSocket(info, term);
    } catch (err: unknown) {
      console.error("[SandboxTerminal] Connection failed", err);
      setError(safeErrorMessage(err, "Failed to connect"));
      setState("disconnected");
    }
  }, [connectViaWebSocket, disabled, ensureTerminal, getTerminalConnectionInfo, sessionId, state]);

  const disconnect = useCallback(() => {
    console.info("[SandboxTerminal] Disconnect requested", { sessionId });
    isManualDisconnectRef.current = true;
    setReconnectAttempt(0);
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    disconnectActiveTransport();
    setState("disconnected");
  }, [disconnectActiveTransport, sessionId]);

  const cancelReconnect = useCallback(() => {
    setReconnectAttempt(0);
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  // Auto-reconnect effect
  useEffect(() => {
    if (reconnectAttempt > 0 && reconnectAttempt <= MAX_RECONNECT_ATTEMPTS) {
      const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt - 1, RECONNECT_DELAYS.length - 1)];
      console.info("[SandboxTerminal] Auto-reconnect scheduled", {
        sessionId,
        attempt: reconnectAttempt,
        delayMs: delay,
      });
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        setReconnectAttempt(0);
        connect();
      }, delay);
      return () => {
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      };
    }
  }, [reconnectAttempt, connect, sessionId]);

  useEffect(() => {
    return () => {
      isManualDisconnectRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      disconnectActiveTransport();
      termRef.current?.dispose();
      termRef.current = null;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
    };
  }, [disconnectActiveTransport]);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-medium text-comp-terminal-text">Terminal</h3>
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              state === "connected"
                ? "bg-comp-terminal-success"
                : state === "connecting"
                  ? "bg-comp-terminal-agent animate-pulse"
                  : "bg-comp-terminal-text"
            }`}
          />
        </div>
        {state === "disconnected" && (
          <button
            onClick={connect}
            disabled={disabled}
            className="rounded-lg border border-comp-terminal-border bg-comp-terminal-bg px-2.5 py-1 text-xs font-medium text-comp-terminal-text transition-colors hover:bg-comp-terminal-border disabled:opacity-50"
          >
            Connect
          </button>
        )}
        {state === "connected" && (
          <button
            onClick={disconnect}
            className="rounded-lg border border-comp-terminal-border bg-comp-terminal-bg px-2.5 py-1 text-xs font-medium text-comp-terminal-text transition-colors hover:bg-comp-terminal-border"
          >
            Disconnect
          </button>
        )}
      </div>

      <div className="relative">
        <div
          ref={terminalRef}
          className="h-64 rounded-lg border border-comp-terminal-border bg-comp-terminal-bg p-1 overflow-hidden"
        />
        {reconnectAttempt > 0 && (
          <TerminalReconnectOverlay
            attempt={reconnectAttempt}
            maxAttempts={MAX_RECONNECT_ATTEMPTS}
            nextRetryAt={reconnectNextAt}
            onCancel={cancelReconnect}
            onManualConnect={() => {
              cancelReconnect();
              connect();
            }}
          />
        )}
      </div>

      {error && <p className="mt-1 text-xs text-status-error-fg">{error}</p>}
    </div>
  );
}
