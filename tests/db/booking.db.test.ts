import { beforeEach, describe, expect, it } from "vitest";
import { PROFESSIONAL_ID, SERVICE_MAO, SERVICE_PE, asRole, createTestDb, tokenHash, type TestDb } from "./harness";

let db: TestDb;

beforeEach(async () => {
  db = await createTestDb();
});

async function book(
  startsAt: string,
  opts: { items?: unknown[]; phone?: string; token?: string; clientName?: string } = {},
) {
  const items = opts.items ?? [{ service_id: SERVICE_MAO, price_cents: 2000 }];
  const res = await db.query<{ id: string }>(
    `select book_appointment($1, $2, $3::jsonb, null, $4, $5, 'online', $6) as id`,
    [
      PROFESSIONAL_ID,
      startsAt,
      JSON.stringify(items),
      opts.clientName ?? "Maria",
      opts.phone ?? "5586999990000",
      opts.token ?? tokenHash(startsAt + (opts.phone ?? "")),
    ],
  );
  return res.rows[0].id;
}

describe("book_appointment", () => {
  it("cria agendamento com duração e preço vindos do banco", async () => {
    const id = await book("2030-01-08T12:00:00Z", {
      items: [
        { service_id: SERVICE_MAO, price_cents: 2000 },
        { service_id: SERVICE_PE, price_cents: 2000 },
      ],
    });
    const { rows } = await db.query<{ ends_at: Date; total_cents: number }>(
      "select ends_at, total_cents from appointments where id = $1",
      [id],
    );
    expect(rows[0].total_cents).toBe(4000);
    // 45 + 50 minutos
    expect(rows[0].ends_at.toISOString()).toBe("2030-01-08T13:35:00.000Z");
    const items = await db.query("select * from appointment_items where appointment_id = $1", [id]);
    expect(items.rows).toHaveLength(2);
  });

  it("recusa horário sobreposto (conflito)", async () => {
    await book("2030-01-08T12:00:00Z", { phone: "5586999990001" });
    await expect(book("2030-01-08T12:30:00Z", { phone: "5586999990002" })).rejects.toThrow(/SLOT_UNAVAILABLE/);
  });

  it("aceita horário que começa exatamente no fim do anterior", async () => {
    await book("2030-01-08T12:00:00Z", { phone: "5586999990001" });
    await expect(book("2030-01-08T12:45:00Z", { phone: "5586999990002" })).resolves.toBeTruthy();
  });

  it("reservas simultâneas no mesmo horário: apenas uma vence", async () => {
    const results = await Promise.allSettled([
      book("2030-01-09T12:00:00Z", { phone: "5586999990011" }),
      book("2030-01-09T12:00:00Z", { phone: "5586999990012" }),
      book("2030-01-09T12:15:00Z", { phone: "5586999990013" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from appointments where status = 'confirmed'",
    );
    expect(rows[0].n).toBe(1);
  });

  it("a restrição do banco impede sobreposição mesmo fora da função", async () => {
    await book("2030-01-10T12:00:00Z");
    await expect(
      db.query(
        `insert into appointments (professional_id, client_id, starts_at, ends_at, source, total_cents, list_total_cents, manage_token_hash)
         select $1, id, '2030-01-10T12:10:00Z', '2030-01-10T12:20:00Z', 'admin', 0, 0, $2 from clients limit 1`,
        [PROFESSIONAL_ID, tokenHash("direct")],
      ),
    ).rejects.toThrow(/appointments_no_overlap/);
  });

  it("recusa preço abaixo do cheio sem promoção válida", async () => {
    await expect(
      book("2030-01-08T12:00:00Z", { items: [{ service_id: SERVICE_MAO, price_cents: 1 }] }),
    ).rejects.toThrow(/INVALID_PRICE/);
  });

  it("aceita preço promocional de promoção vigente", async () => {
    const promo = await db.query<{ id: string }>(
      `insert into promotions (title, promo_price_cents, starts_on, ends_on) values ('Promo', 3500, '2030-01-01', '2030-01-31') returning id`,
    );
    const promoId = promo.rows[0].id;
    await db.query(`insert into promotion_services values ($1, $2), ($1, $3)`, [promoId, SERVICE_MAO, SERVICE_PE]);
    const id = await book("2030-01-08T12:00:00Z", {
      items: [
        { service_id: SERVICE_MAO, price_cents: 1750, promotion_id: promoId },
        { service_id: SERVICE_PE, price_cents: 1750, promotion_id: promoId },
      ],
    });
    const { rows } = await db.query<{ total_cents: number; list_total_cents: number }>(
      "select total_cents, list_total_cents from appointments where id = $1",
      [id],
    );
    expect(rows[0]).toEqual({ total_cents: 3500, list_total_cents: 4000 });
  });

  it("recusa promoção fora da validade", async () => {
    const promo = await db.query<{ id: string }>(
      `insert into promotions (title, promo_price_cents, starts_on, ends_on) values ('Velha', 1000, '2029-01-01', '2029-01-31') returning id`,
    );
    await db.query(`insert into promotion_services values ($1, $2)`, [promo.rows[0].id, SERVICE_MAO]);
    await expect(
      book("2030-01-08T12:00:00Z", {
        items: [{ service_id: SERVICE_MAO, price_cents: 1000, promotion_id: promo.rows[0].id }],
      }),
    ).rejects.toThrow(/INVALID_PRICE/);
  });

  it("recusa serviço inativo", async () => {
    await db.query("update services set active = false where id = $1", [SERVICE_MAO]);
    await expect(book("2030-01-08T12:00:00Z")).rejects.toThrow(/SERVICE_UNAVAILABLE/);
  });

  it("recusa horário bloqueado (folga/férias)", async () => {
    await db.query(
      `insert into time_blocks (professional_id, kind, starts_at, ends_at) values ($1, 'vacation', '2030-01-08T00:00:00Z', '2030-01-15T00:00:00Z')`,
      [PROFESSIONAL_ID],
    );
    await expect(book("2030-01-08T12:00:00Z")).rejects.toThrow(/SLOT_UNAVAILABLE/);
  });

  it("não altera o nome de cliente já cadastrada ao reservar com o mesmo telefone", async () => {
    await book("2030-01-08T12:00:00Z", { phone: "5586999990099", clientName: "Joana" });
    await book("2030-01-08T14:00:00Z", { phone: "5586999990099", clientName: "Outra Pessoa" });
    const { rows } = await db.query<{ name: string }>("select name from clients where phone = '5586999990099'");
    expect(rows).toEqual([{ name: "Joana" }]);
  });
});

describe("cancelamento e reagendamento", () => {
  it("cancelar libera o horário", async () => {
    const id = await book("2030-01-08T12:00:00Z", { phone: "5586999990001" });
    await db.query("select cancel_appointment($1, 'imprevisto')", [id]);
    await expect(book("2030-01-08T12:00:00Z", { phone: "5586999990002" })).resolves.toBeTruthy();
  });

  it("não cancela duas vezes", async () => {
    const id = await book("2030-01-08T12:00:00Z");
    await db.query("select cancel_appointment($1)", [id]);
    await expect(db.query("select cancel_appointment($1)", [id])).rejects.toThrow(/APPOINTMENT_NOT_ACTIVE/);
  });

  it("reagenda mantendo a duração", async () => {
    const id = await book("2030-01-08T12:00:00Z");
    await db.query("select reschedule_appointment($1, '2030-01-08T15:00:00Z')", [id]);
    const { rows } = await db.query<{ starts_at: Date; ends_at: Date }>(
      "select starts_at, ends_at from appointments where id = $1",
      [id],
    );
    expect(rows[0].starts_at.toISOString()).toBe("2030-01-08T15:00:00.000Z");
    expect(rows[0].ends_at.toISOString()).toBe("2030-01-08T15:45:00.000Z");
  });

  it("não reagenda para horário ocupado", async () => {
    const a = await book("2030-01-08T12:00:00Z", { phone: "5586999990001" });
    await book("2030-01-08T15:00:00Z", { phone: "5586999990002" });
    await expect(db.query("select reschedule_appointment($1, '2030-01-08T15:15:00Z')", [a])).rejects.toThrow(
      /SLOT_UNAVAILABLE/,
    );
  });

  it("enfileira notificações só quando o WhatsApp está ativado", async () => {
    await book("2030-01-08T12:00:00Z", { phone: "5586999990001" });
    let n = await db.query<{ n: number }>("select count(*)::int as n from notification_outbox");
    expect(n.rows[0].n).toBe(0);
    await db.query("update settings set whatsapp_notifications_enabled = true");
    await book("2030-01-08T14:00:00Z", { phone: "5586999990002" });
    n = await db.query<{ n: number }>("select count(*)::int as n from notification_outbox");
    expect(n.rows[0].n).toBe(2); // confirmação + lembrete 24h
  });
});

describe("integridade financeira", () => {
  async function payment() {
    const id = await book("2030-01-08T12:00:00Z");
    const { rows } = await db.query<{ id: string }>(
      `insert into payments (appointment_id, method_id, amount_cents)
       select $1, id, 2000 from payment_methods where name = 'Pix' returning id`,
      [id],
    );
    return rows[0].id;
  }

  it("não permite alterar o valor de um pagamento lançado", async () => {
    const id = await payment();
    await expect(db.query("update payments set amount_cents = 1 where id = $1", [id])).rejects.toThrow(
      /FINANCIAL_ROW_IMMUTABLE/,
    );
  });

  it("estorno exige motivo e é definitivo", async () => {
    const id = await payment();
    await expect(db.query("update payments set voided_at = now() where id = $1", [id])).rejects.toThrow();
    await db.query("update payments set voided_at = now(), void_reason = 'lançado errado' where id = $1", [id]);
    await expect(db.query("update payments set notes = 'x' where id = $1", [id])).rejects.toThrow(
      /FINANCIAL_ROW_VOIDED/,
    );
  });

  it("registra auditoria das alterações", async () => {
    await payment();
    const { rows } = await db.query<{ table_name: string }>(
      "select distinct table_name from audit_log order by table_name",
    );
    expect(rows.map((r) => r.table_name)).toEqual(expect.arrayContaining(["appointments", "clients", "payments"]));
  });
});

describe("LGPD", () => {
  it("anonimiza cliente preservando o histórico financeiro", async () => {
    await book("2020-01-08T12:00:00Z", { phone: "5586999990077", clientName: "Fulana" });
    const { rows } = await db.query<{ id: string }>("select id from clients where phone = '5586999990077'");
    await db.query("select anonymize_client($1)", [rows[0].id]);
    const after = await db.query<{ name: string; phone: string }>("select name, phone from clients where id = $1", [
      rows[0].id,
    ]);
    expect(after.rows[0].name).toBe("Cliente removida");
    expect(after.rows[0].phone).not.toBe("5586999990077");
    const audit = await db.query<{ n: number }>(
      "select count(*)::int as n from audit_log where table_name = 'clients' and new_data::text like '%Fulana%'",
    );
    expect(audit.rows[0].n).toBe(0);
    const appts = await db.query<{ n: number }>("select count(*)::int as n from appointments where client_id = $1", [
      rows[0].id,
    ]);
    expect(appts.rows[0].n).toBe(1);
  });
});

describe("Row Level Security", () => {
  const ADMIN = "11111111-1111-4111-8111-111111111111";
  const STRANGER = "22222222-2222-4222-8222-222222222222";

  beforeEach(async () => {
    await db.query("insert into auth.users (id) values ($1), ($2)", [ADMIN, STRANGER]);
    await db.query("insert into admins (user_id, name) values ($1, 'Admin')", [ADMIN]);
    await book("2030-01-08T12:00:00Z");
  });

  it("visitante não lê clientes, agendamentos nem pagamentos", async () => {
    for (const table of ["clients", "appointments", "payments", "expenses", "audit_log", "site_content_draft"]) {
      await expect(asRole(db, "anon", null, () => db.query(`select * from ${table}`))).rejects.toThrow(
        /permission denied/,
      );
    }
  });

  it("usuário autenticado que não é admin não vê dados de clientes", async () => {
    const res = await asRole(db, "authenticated", STRANGER, () => db.query("select * from clients"));
    expect(res.rows).toHaveLength(0);
    const appts = await asRole(db, "authenticated", STRANGER, () => db.query("select * from appointments"));
    expect(appts.rows).toHaveLength(0);
  });

  it("admin vê clientes e agendamentos", async () => {
    const res = await asRole(db, "authenticated", ADMIN, () => db.query("select * from clients"));
    expect(res.rows).toHaveLength(1);
  });

  it("visitante lê apenas serviços ativos", async () => {
    await db.query("update services set active = false where id = $1", [SERVICE_PE]);
    const res = await asRole(db, "anon", null, () => db.query<{ id: string }>("select id from services"));
    expect(res.rows.map((r) => r.id)).not.toContain(SERVICE_PE);
    expect(res.rows.length).toBeGreaterThan(0);
  });

  it("visitante não consegue chamar as funções de agendamento diretamente", async () => {
    await expect(
      asRole(db, "anon", null, () =>
        db.query(`select book_appointment($1, now(), '[]'::jsonb, null, 'x', '5586999999999', 'online', $2)`, [
          PROFESSIONAL_ID,
          tokenHash("anon"),
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole(db, "authenticated", STRANGER, () =>
        db.query(`select cancel_appointment(id) from appointments limit 1`),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("visitante não altera serviços", async () => {
    await expect(
      asRole(db, "anon", null, () => db.query("update services set price_cents = 0")),
    ).rejects.toThrow(/permission denied/);
    const stranger = await asRole(db, "authenticated", STRANGER, () =>
      db.query("update services set price_cents = 0"),
    );
    expect(stranger.affectedRows).toBe(0);
  });
});

describe("horários de funcionamento", () => {
  const ADMIN = "33333333-3333-4333-8333-333333333333";

  it("admin substitui os horários semanais de forma atômica", async () => {
    await db.query("insert into auth.users (id) values ($1)", [ADMIN]);
    await db.query("insert into admins (user_id, name) values ($1, 'Admin')", [ADMIN]);
    await asRole(db, "authenticated", ADMIN, () =>
      db.query("select replace_business_hours($1, $2::jsonb)", [
        PROFESSIONAL_ID,
        JSON.stringify([{ weekday: 1, opensAt: "09:00", closesAt: "17:00" }]),
      ]),
    );
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from business_hours");
    expect(rows[0].n).toBe(1);
  });

  it("faixa inválida desfaz tudo (horários antigos continuam)", async () => {
    await db.query("insert into auth.users (id) values ($1)", [ADMIN]);
    await db.query("insert into admins (user_id, name) values ($1, 'Admin')", [ADMIN]);
    const before = await db.query<{ n: number }>("select count(*)::int as n from business_hours");
    await expect(
      asRole(db, "authenticated", ADMIN, () =>
        db.query("select replace_business_hours($1, $2::jsonb)", [
          PROFESSIONAL_ID,
          JSON.stringify([{ weekday: 1, opensAt: "18:00", closesAt: "09:00" }]),
        ]),
      ),
    ).rejects.toThrow();
    const after = await db.query<{ n: number }>("select count(*)::int as n from business_hours");
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it("quem não é admin não altera horários", async () => {
    await db.query("insert into auth.users (id) values ($1)", [ADMIN]);
    await expect(
      asRole(db, "authenticated", ADMIN, () => db.query("select replace_business_hours($1, '[]'::jsonb)", [PROFESSIONAL_ID])),
    ).rejects.toThrow(/FORBIDDEN/);
  });
});
