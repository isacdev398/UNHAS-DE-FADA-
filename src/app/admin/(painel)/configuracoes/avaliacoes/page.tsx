import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader, Section } from "@/components/admin/ui";
import { createSessionClient } from "@/lib/supabase/server";
import { TestimonialForm, TestimonialRow } from "./testimonial-forms";

export const metadata: Metadata = { title: "Avaliações" };

export default async function TestimonialsPage() {
  await connection();
  const { data } = await (await createSessionClient()).from("testimonials").select("id, author_name, body, rating, published").order("created_at", { ascending: false });
  const list = (data ?? []) as { id: string; author_name: string; body: string; rating: number | null; published: boolean }[];
  return (
    <>
      <PageHeader title="Avaliações" back={{ href: "/admin/configuracoes", label: "Configurações" }} description="Publique só avaliações reais, com autorização da cliente. A seção só aparece no site quando houver alguma publicada." />
      <TestimonialForm />
      <Section title="Cadastradas">
        {list.length === 0 ? (
          <p className="text-sm text-cocoa-soft">Nenhuma avaliação ainda.</p>
        ) : (
          <ul className="divide-y divide-nude/70 rounded-2xl bg-shell shadow-soft">
            {list.map((t) => (
              <TestimonialRow key={t.id} t={{ id: t.id, authorName: t.author_name, body: t.body, rating: t.rating, published: t.published }} />
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
