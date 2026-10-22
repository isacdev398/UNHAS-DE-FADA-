import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="foil font-display text-6xl">unhas de fada</p>
      <h1 className="mt-6 font-display text-3xl text-rose-ink">Página não encontrada</h1>
      <p className="mt-2 text-cocoa-soft">
        O link pode estar incompleto ou ter expirado. Se for o link do seu agendamento, confira se copiou ele inteiro.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <LinkButton href="/agendar">Agendar horário</LinkButton>
        <LinkButton href="/" variant="secondary">
          Ir para o início
        </LinkButton>
      </div>
    </main>
  );
}
