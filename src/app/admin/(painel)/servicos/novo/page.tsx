import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader, Section } from "@/components/admin/ui";
import { listServices } from "@/lib/data/admin";
import { CategoryForm, ServiceForm } from "../service-forms";

export const metadata: Metadata = { title: "Novo serviço" };

export default async function NewServicePage() {
  await connection();
  const { services, categories } = await listServices();
  return (
    <>
      <PageHeader title="Novo serviço" back={{ href: "/admin/servicos", label: "Serviços" }} />
      <ServiceForm categories={categories} others={services.filter((s) => !s.isCombo).map((s) => ({ id: s.id, name: s.name }))} />
      <Section title="Categorias">
        <CategoryForm />
      </Section>
    </>
  );
}
