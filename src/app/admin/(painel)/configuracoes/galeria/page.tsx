import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader, Section } from "@/components/admin/ui";
import { storagePublicUrl } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";
import { PhotoCard, PhotoUploader } from "./gallery-forms";

export const metadata: Metadata = { title: "Galeria" };

export default async function GalleryAdminPage() {
  await connection();
  const db = await createSessionClient();
  const [photos, services] = await Promise.all([
    db.from("gallery_photos").select("id, storage_path, alt, service_id, featured, sort").order("featured", { ascending: false }).order("sort").order("created_at", { ascending: false }),
    db.from("services").select("id, name").eq("active", true).order("sort"),
  ]);
  const list = (photos.data ?? []).map((p) => ({
    id: p.id as string,
    url: storagePublicUrl(p.storage_path as string),
    alt: p.alt as string,
    serviceId: p.service_id as string | null,
    featured: p.featured as boolean,
    sort: p.sort as number,
  }));
  const serviceList = (services.data ?? []) as { id: string; name: string }[];

  return (
    <>
      <PageHeader title="Galeria" back={{ href: "/admin/configuracoes", label: "Configurações" }} description="Fotos reais dos seus trabalhos. Ligue cada foto a um serviço para mostrar o botão “Agendar”." />
      <PhotoUploader services={serviceList} />
      <Section title={`Fotos (${list.length})`}>
        {list.length === 0 ? (
          <p className="text-sm text-cocoa-soft">Nenhuma foto ainda. A galeria só aparece no site quando houver fotos.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {list.map((p, i) => (
              <PhotoCard key={p.id} photo={p} services={serviceList} prevSort={list[i - 1]?.sort} nextSort={list[i + 1]?.sort} />
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
