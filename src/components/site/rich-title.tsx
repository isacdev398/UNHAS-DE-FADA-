import { Fragment } from "react";

/**
 * Título com destaque em itálico: trechos entre *asteriscos* aparecem em
 * itálico rosewood (ex.: "Unhas do *jeitinho* que você gosta").
 */
export function RichTitle({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("*") && part.endsWith("*") ? (
          <em key={i} className="font-display italic text-rose-deep">
            {part.slice(1, -1)}
          </em>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/** Mesmo texto sem os asteriscos (para metadados e leitores de tela). */
export function plainTitle(text: string) {
  return text.replace(/\*/g, "");
}
