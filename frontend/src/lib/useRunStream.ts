// SSE hook — streams ITelemetryFrame events from the backend
import { useEffect, useRef, useState, useCallback } from "react";

export interface ITelemetryFrame {
  type: "thinking" | "tool_start" | "viewport_update" | "action_required" | "complete" | "agent_message";
  message: string;
  timestamp: string;
  payload?: {
    screenshotUrl?: string;
    liveViewUrl?: string;
    confirmationCardData?: {
      title: string;
      cost: string;
    };
  };
}

type StreamStatus = "connecting" | "open" | "closed" | "error";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export function useRunStream(runId: string | null) {
  const [events, setEvents] = useState<ITelemetryFrame[]>([]);
  const [status, setStatus] = useState<StreamStatus>("closed");
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastEventIdRef = useRef<string | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStatus("closed");
  }, []);

  useEffect(() => {
    if (!runId) {
      disconnect();
      setEvents([]);
      return;
    }

    setStatus("connecting");
    setEvents([]);

    const url = `${BASE}/api/agent/stream/${runId}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setStatus("open");

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setStatus("closed");
      } else if (es.readyState === EventSource.CONNECTING) {
        // Reconnecting — this is normal after a clean close
        setStatus("connecting");
      } else {
        setStatus("error");
      }
    };

    // Listen for the generic "message" event (fallback)
    es.onmessage = (e) => {
      try {
        const frame = JSON.parse(e.data) as ITelemetryFrame;
        lastEventIdRef.current = e.lastEventId;
        setEvents((prev) => [...prev, frame]);
      } catch {
        // ignore parse errors
      }
    };

    // Also listen for typed events
    const types = ["thinking", "tool_start", "viewport_update", "action_required", "complete", "agent_message"] as const;
    for (const type of types) {
      es.addEventListener(type, ((e: MessageEvent) => {
        try {
          const frame = JSON.parse(e.data) as ITelemetryFrame;
          lastEventIdRef.current = e.lastEventId;
          setEvents((prev) => [...prev, frame]);
        } catch {
          // ignore
        }
      }) as EventListener);
    }

    // ── Close event: server signals the run is done ───────────────────────
    // This prevents the "ERR_INCOMPLETE_CHUNKED_ENCODING" error by cleanly
    // closing the connection instead of letting it drop.
    es.addEventListener("close", () => {
      // Run is terminal — close cleanly, no auto-reconnect
      es.close();
      eventSourceRef.current = null;
      setStatus("closed");
    });

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [runId, disconnect]);

  return { events, status, disconnect };
}
