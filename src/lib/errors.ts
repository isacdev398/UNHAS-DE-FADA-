/** Mensagens das exceções levantadas pelas funções do banco. */
const MESSAGES: Record<string, string> = {
  SLOT_UNAVAILABLE: "Esse horário acabou de ser ocupado. Escolha outro horário.",
  SERVICE_UNAVAILABLE: "Um dos serviços escolhidos não está mais disponível. Revise a seleção.",
  INVALID_PRICE: "Os preços mudaram. Revise a seleção e tente de novo.",
  NO_ITEMS: "Escolha pelo menos um serviço.",
  TOO_MANY_ITEMS: "Escolha no máximo 10 serviços por agendamento.",
  INVALID_CLIENT: "Confira o nome e o WhatsApp.",
  CLIENT_NOT_FOUND: "Cliente não encontrada.",
  APPOINTMENT_NOT_FOUND: "Agendamento não encontrado.",
  APPOINTMENT_NOT_ACTIVE: "Este agendamento já foi cancelado ou concluído.",
  CLIENT_HAS_FUTURE_APPOINTMENTS: "Cancele os agendamentos futuros desta cliente antes de remover os dados.",
  FINANCIAL_ROW_IMMUTABLE: "Lançamentos não podem ser alterados. Estorne e lance de novo.",
  FINANCIAL_ROW_VOIDED: "Este lançamento já foi estornado.",
};

export function dbErrorMessage(error: unknown, fallback = "Não foi possível concluir. Tente de novo.") {
  const message = typeof error === "object" && error && "message" in error ? String(error.message) : "";
  const code = Object.keys(MESSAGES).find((k) => message.includes(k));
  if (code) return MESSAGES[code];
  if (message.includes("duplicate key") && message.includes("phone")) return "Já existe uma cliente com este WhatsApp.";
  if (message.includes("duplicate key") && message.includes("slug")) return "Já existe um serviço com este link.";
  return fallback;
}

export function isSlotTaken(error: unknown) {
  return typeof error === "object" && error !== null && "message" in error && String(error.message).includes("SLOT_UNAVAILABLE");
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
