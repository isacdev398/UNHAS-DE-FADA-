import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/data/public";
import { siteUrl } from "@/lib/env";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const { services } = await getCatalog();
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/agendar`, changeFrequency: "weekly", priority: 0.9 },
    ...services.map((s) => ({ url: `${base}/agendar?servico=${s.slug}`, changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${base}/privacidade`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
