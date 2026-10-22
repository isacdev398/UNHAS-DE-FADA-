export type PricedService = {
  id: string;
  name: string;
  priceCents: number;
  durationMinutes: number;
};

export type ActivePromotion = {
  id: string;
  title: string;
  promoPriceCents: number;
  serviceIds: string[];
  startsOn: string;
  endsOn: string;
};

export type QuoteItem = {
  serviceId: string;
  name: string;
  listPriceCents: number;
  priceCents: number;
  durationMinutes: number;
  promotionId: string | null;
};

export type Quote = {
  items: QuoteItem[];
  totalCents: number;
  listTotalCents: number;
  durationMinutes: number;
  appliedPromotions: { id: string; title: string; savingCents: number; endsOn: string }[];
};

/** Promoções válidas na data (inclusive). */
export function promotionsValidOn(promotions: ActivePromotion[], date: string) {
  return promotions.filter((p) => p.startsOn <= date && date <= p.endsOn);
}

/**
 * Soma preços e durações e aplica promoções: uma promoção vale quando todos os
 * serviços dela estão no pedido. Se houver mais de uma, aplica primeiro a de maior
 * economia, sem usar o mesmo serviço em duas promoções.
 */
export function quote(services: PricedService[], promotions: ActivePromotion[]): Quote {
  const unique = [...new Map(services.map((s) => [s.id, s])).values()];
  const items: QuoteItem[] = unique.map((s) => ({
    serviceId: s.id,
    name: s.name,
    listPriceCents: s.priceCents,
    priceCents: s.priceCents,
    durationMinutes: s.durationMinutes,
    promotionId: null,
  }));
  const byId = new Map(items.map((i) => [i.serviceId, i]));

  const candidates = promotions
    .filter((p) => p.serviceIds.length > 0 && p.serviceIds.every((id) => byId.has(id)))
    .map((p) => {
      const list = p.serviceIds.reduce((sum, id) => sum + byId.get(id)!.listPriceCents, 0);
      return { promo: p, list, saving: list - p.promoPriceCents };
    })
    .filter((c) => c.saving > 0)
    .sort((a, b) => b.saving - a.saving);

  const used = new Set<string>();
  const applied: Quote["appliedPromotions"] = [];
  for (const c of candidates) {
    if (c.promo.serviceIds.some((id) => used.has(id))) continue;
    const promoItems = c.promo.serviceIds.map((id) => byId.get(id)!);
    distribute(promoItems, c.promo.promoPriceCents, c.list);
    for (const item of promoItems) {
      item.promotionId = c.promo.id;
      used.add(item.serviceId);
    }
    applied.push({ id: c.promo.id, title: c.promo.title, savingCents: c.saving, endsOn: c.promo.endsOn });
  }

  return {
    items,
    totalCents: items.reduce((s, i) => s + i.priceCents, 0),
    listTotalCents: items.reduce((s, i) => s + i.listPriceCents, 0),
    durationMinutes: items.reduce((s, i) => s + i.durationMinutes, 0),
    appliedPromotions: applied,
  };
}

/** Reparte o preço promocional entre os itens, proporcional ao preço cheio, sem passar dele. */
function distribute(items: QuoteItem[], total: number, listTotal: number) {
  let assigned = 0;
  for (const item of items) {
    item.priceCents = listTotal === 0 ? 0 : Math.floor((item.listPriceCents * total) / listTotal);
    assigned += item.priceCents;
  }
  let remainder = total - assigned;
  while (remainder > 0) {
    const target = items.find((i) => i.priceCents < i.listPriceCents);
    if (!target) break;
    const add = Math.min(remainder, target.listPriceCents - target.priceCents);
    target.priceCents += add;
    remainder -= add;
  }
}
