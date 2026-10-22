/** Esqueleto mostrado na hora ao tocar em qualquer item do painel, enquanto a página carrega. */
export function PageSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Carregando">
      <div className="h-10 w-48 animate-pulse rounded-xl bg-nude-soft" />
      <div className="h-28 animate-pulse rounded-2xl bg-shell" />
      <div className="h-64 animate-pulse rounded-2xl bg-shell" />
    </div>
  );
}
