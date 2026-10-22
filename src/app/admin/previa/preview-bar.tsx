"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { publishAction } from "@/app/admin/(painel)/configuracoes/actions";
import { Button, Spinner } from "@/components/ui/button";
import type { ActionResult } from "@/lib/errors";

export function PreviewBar() {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center gap-2 bg-cocoa px-4 py-2.5 text-sm text-shell" role="region" aria-label="Pré-visualização">
      <p className="flex-1 font-medium">{result?.ok ? "Publicado!" : "Pré-visualização — ainda não publicado"}</p>
      {result && !result.ok && <p className="w-full text-nude">{result.error}</p>}
      <Link href="/admin/configuracoes/site" className="inline-flex min-h-10 items-center rounded-pill px-4 ring-1 ring-shell/40">
        Voltar e editar
      </Link>
      {!result?.ok && (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => setResult(await publishAction()))}>
          {pending && <Spinner />} Publicar
        </Button>
      )}
    </div>
  );
}
