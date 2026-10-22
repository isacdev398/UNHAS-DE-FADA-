"use client";

import { useState, useTransition } from "react";
import { Checkbox, FormMessage } from "@/components/ui/form";
import type { ActionResult } from "@/lib/errors";
import { toggleWhatsAppAction } from "../actions";

export function WhatsAppToggle({ enabled, configured }: { enabled: boolean; configured: boolean }) {
  const [on, setOn] = useState(enabled);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <Checkbox
        label="Enviar mensagens automáticas"
        checked={on}
        disabled={pending || (!configured && !on)}
        onChange={(e) => {
          const next = e.target.checked;
          start(async () => {
            const r = await toggleWhatsAppAction(next);
            setResult(r);
            if (r.ok) setOn(next);
          });
        }}
      />
      <FormMessage result={result} />
    </div>
  );
}
