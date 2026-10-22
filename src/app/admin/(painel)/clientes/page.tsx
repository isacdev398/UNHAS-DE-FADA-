import type { Metadata } from "next";
import { connection } from "next/server";
import { List, ListLink, PageHeader } from "@/components/admin/ui";
import { LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { IconChevronRight, IconPlus, IconSearch } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/misc";
import { listClients } from "@/lib/data/admin";
import { formatPhone } from "@/lib/format";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage({ searchParams }: PageProps<"/admin/clientes">) {
  await connection();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 60) : "";
  const clients = await listClients(q);

  return (
    <>
      <PageHeader
        title="Clientes"
        actions={
          <LinkButton href="/admin/clientes/nova" size="sm" aria-label="Nova cliente">
            <IconPlus size={18} /> <span className="hidden sm:inline">Nova</span>
          </LinkButton>
        }
      />
      <form role="search" className="relative mb-4">
        <IconSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cocoa-soft" size={18} />
        <Input name="q" defaultValue={q} placeholder="Buscar por nome ou telefone…" aria-label="Buscar cliente" className="pl-11" type="search" autoComplete="off" />
      </form>
      {clients.length === 0 ? (
        <EmptyState title={q ? "Nenhuma cliente encontrada" : "Nenhuma cliente ainda"} action={<LinkButton href="/admin/clientes/nova" size="sm">Cadastrar cliente</LinkButton>}>
          {q ? "Confira a grafia ou busque pelo telefone." : "As clientes aparecem aqui quando agendam pelo site ou quando você cadastra."}
        </EmptyState>
      ) : (
        <List>
          {clients.map((c) => (
            <li key={c.id}>
              <ListLink href={`/admin/clientes/${c.id}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="block text-sm text-cocoa-soft tabular">{formatPhone(c.phone)}</span>
                </span>
                <IconChevronRight className="text-cocoa-soft" size={18} />
              </ListLink>
            </li>
          ))}
        </List>
      )}
    </>
  );
}
