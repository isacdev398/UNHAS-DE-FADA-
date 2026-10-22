/** Preço no estilo da tabela impressa: "R$" pequeno, reais em destaque e centavos pequenos. */
export function Price({
  cents,
  className = "",
  size = "md",
}: {
  cents: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const reais = Math.floor(cents / 100).toLocaleString("pt-BR");
  const centavos = String(cents % 100).padStart(2, "0");
  const big = { sm: "text-2xl", md: "text-4xl", lg: "text-5xl" }[size];
  return (
    <span className={`inline-flex items-baseline font-display leading-none tabular ${className}`}>
      <span className="sr-only">
        {reais},{centavos} reais
      </span>
      <span aria-hidden="true" className="mr-0.5 text-[0.95rem] font-semibold">
        R$
      </span>
      <span aria-hidden="true" className={`${big} font-semibold tracking-tight`}>
        {reais}
      </span>
      <span aria-hidden="true" className="text-[0.95rem] font-semibold">
        ,{centavos}
      </span>
    </span>
  );
}
