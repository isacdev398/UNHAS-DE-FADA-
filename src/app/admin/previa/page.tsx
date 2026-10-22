import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { HomeView } from "@/components/site/home-view";
import { requireAdmin } from "@/lib/auth";
import { parseContent } from "@/lib/content";
import { getCatalog, getGallery, getTestimonials } from "@/lib/data/public";
import { createSessionClient } from "@/lib/supabase/server";
import { PreviewBar } from "./preview-bar";

export const metadata: Metadata = { title: "Pré-visualização", robots: { index: false, follow: false } };

async function Preview() {
  await connection();
  await requireAdmin();
  const db = await createSessionClient();
  const [{ data }, catalog, gallery, testimonials] = await Promise.all([
    db.from("site_content_draft").select("draft").eq("id", 1).single(),
    getCatalog(),
    getGallery(),
    getTestimonials(),
  ]);
  return (
    <>
      <PreviewBar />
      <HomeView content={parseContent(data?.draft)} catalog={catalog} gallery={gallery} testimonials={testimonials} preview />
    </>
  );
}

/** Mostra a página inicial com o rascunho, antes de publicar. */
export default function PreviewPage() {
  return (
    <Suspense fallback={<p className="p-6 text-cocoa-soft">Carregando pré-visualização…</p>}>
      <Preview />
    </Suspense>
  );
}
