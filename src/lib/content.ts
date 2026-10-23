import { z } from "zod";

/** Textos e contatos editáveis do site (rascunho → pré-visualização → publicação). */
export const siteContentSchema = z.object({
  heroTitle: z.string().trim().min(3, { error: "Escreva um título." }).max(90),
  heroSubtitle: z.string().trim().max(240),
  aboutTitle: z.string().trim().max(60),
  about: z.string().trim().max(1200),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\d{12,13}$/, { error: "Use o número com DDD, só números." }),
  instagram: z
    .string()
    .trim()
    .regex(/^@?[A-Za-z0-9._]{0,30}$/, { error: "Informe só o usuário do Instagram." })
    .transform((v) => v.replace(/^@/, "")),
  address: z.string().trim().max(160),
  city: z.string().trim().max(80),
  mapsUrl: z.union([z.literal(""), z.url({ protocol: /^https$/, error: "Cole um link https." })]),
  hoursNote: z.string().trim().max(160),
  heroImagePath: z.string().max(300),
  aboutImagePath: z.string().max(300),
});

export type SiteContent = z.infer<typeof siteContentSchema>;

/** Usado quando o banco ainda não foi configurado. Mesmos dados da migração inicial. */
export const DEFAULT_CONTENT: SiteContent = {
  heroTitle: "Unhas bem cuidadas, do jeitinho que você gosta",
  heroSubtitle:
    "Manicure e pedicure com carinho, capricho e horário marcado. Escolha o serviço e veja os horários livres em segundos.",
  aboutTitle: "Sobre o atendimento",
  about:
    "Cada atendimento é feito com calma e atenção aos detalhes, em um espaço pensado para você relaxar enquanto cuida das suas unhas.",
  whatsapp: "5586994508467",
  instagram: "",
  address: "Rua Francisco Brito Souza, 5039 – Vila Bandeirante",
  city: "",
  mapsUrl: "",
  hoursNote: "",
  heroImagePath: "",
  aboutImagePath: "",
};

export function parseContent(raw: unknown): SiteContent {
  const merged = { ...DEFAULT_CONTENT, ...(typeof raw === "object" && raw ? raw : {}) };
  const parsed = siteContentSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_CONTENT;
}
