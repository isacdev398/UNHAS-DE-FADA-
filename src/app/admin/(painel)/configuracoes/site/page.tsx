import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader } from "@/components/admin/ui";
import { parseContent } from "@/lib/content";
import { storagePublicUrl } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";
import { ContentForm } from "./content-form";

export const metadata: Metadata = { title: "Conteúdo do site" };

export default async function SiteContentPage() {
  await connection();
  const db = await createSessionClient();
  const [draft, published, photos] = await Promise.all([
    db.from("site_content_draft").select("draft, updated_at").eq("id", 1).single(),
    db.from("site_content").select("published, published_at").eq("id", 1).single(),
    db.from("gallery_photos").select("storage_path, alt").order("created_at", { ascending: false }).limit(60),
  ]);
  const content = parseContent(draft.data?.draft);
  const hasChanges = JSON.stringify(parseContent(published.data?.published)) !== JSON.stringify(content);

  return (
    <>
      <PageHeader title="Conteúdo do site" back={{ href: "/admin/configuracoes", label: "Configurações" }} description="Salve, confira na pré-visualização e publique." />
      <ContentForm
        content={content}
        hasChanges={hasChanges}
        photos={(photos.data ?? []).map((p) => ({ path: p.storage_path as string, url: storagePublicUrl(p.storage_path as string), alt: p.alt as string }))}
      />
    </>
  );
}
