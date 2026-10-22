import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader, Section } from "@/components/admin/ui";
import { listServices } from "@/lib/data/admin";
import { siteUrl } from "@/lib/env";
import { CategoryForm, ServiceForm } from "../service-forms";

export const metadata: Metadata = { title: "Editar serviço" };

export default async function EditServicePage({ params }: PageProps<"/admin/servicos/[id]">) {
  await connection();
  const { id } = await params;
  const { services, categories } = await listServices();
  const service = services.find((s) => s.id === id);
  if (!service) notFound();
  const link = `${siteUrl()}/agendar?servico=${service.slug}`;

  return (
    <>
      <PageHeader title={service.name} back={{ href: "/admin/servicos", label: "Serviços" }} />
      <div className="mb-4 rounded-2xl bg-nude-soft p-3 text-sm">
        <p className="font-medium text-rose-ink">Link direto para agendar este serviço</p>
        <p className="mt-1 break-all text-cocoa-soft">{link}</p>
        <p className="mt-1 text-xs text-cocoa-soft">Use na bio ou nos stories do Instagram.</p>
      </div>
      <ServiceForm
        service={service}
        categories={categories}
        others={services.filter((s) => s.id !== id && !s.isCombo).map((s) => ({ id: s.id, name: s.name }))}
      />
      <Section title="Categorias">
        <CategoryForm />
      </Section>
    </>
  );
}
