"use client";

import { useEffect } from "react";

type EventKind = "page_view" | "booking_start" | "booking_complete";

/** Origem da visita: utm_source, navegador do Instagram ou domínio de quem indicou. */
function visitSource() {
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = params.get("utm_source");
    if (utm) return utm.slice(0, 60);
    if (/Instagram/i.test(navigator.userAgent)) return "instagram";
    if (/FBAN|FBAV/i.test(navigator.userAgent)) return "facebook";
    if (document.referrer) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, "");
      if (host !== window.location.hostname) return host.slice(0, 60);
    }
  } catch {
    // sem origem
  }
  return null;
}

function optedOut() {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || navigator.doNotTrack === "1";
}

/**
 * Métricas anônimas: tipo do evento, página e origem. Sem cookies, sem IP,
 * sem identificadores; respeita "Não rastrear" e Global Privacy Control.
 */
export function track(kind: EventKind) {
  if (typeof window === "undefined" || optedOut()) return;
  const body = JSON.stringify({ kind, path: window.location.pathname, source: visitSource() });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/track", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
    }
  } catch {
    // métricas nunca atrapalham a navegação
  }
}

const sent = new Set<string>();

/**
 * Registra o evento uma vez por página. Agendamento concluído conta uma vez
 * por sessão do navegador, mesmo se a cliente recarregar a confirmação.
 */
export function TrackEvent({ kind }: { kind: EventKind }) {
  useEffect(() => {
    const key = `${kind}:${window.location.pathname}`;
    if (sent.has(key)) return;
    sent.add(key);
    if (kind === "booking_complete") {
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {
        // sem sessionStorage (navegação privada): conta mesmo assim
      }
    }
    track(kind);
  }, [kind]);
  return null;
}
