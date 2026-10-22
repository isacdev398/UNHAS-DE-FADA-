import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { ClientForm } from "../client-forms";

export const metadata: Metadata = { title: "Nova cliente" };

export default function NewClientPage() {
  return (
    <>
      <PageHeader title="Nova cliente" back={{ href: "/admin/clientes", label: "Clientes" }} />
      <ClientForm />
    </>
  );
}
