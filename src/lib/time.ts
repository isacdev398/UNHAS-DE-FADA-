/**
 * Datas no fuso da profissional. Datas locais são strings "YYYY-MM-DD" e horários
 * locais são minutos desde a meia-noite; instantes são sempre Date (UTC).
 */

export const DEFAULT_TZ = "America/Fortaleza";

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string) {
  let f = partsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(tz, f);
  }
  return f;
}

function zonedParts(date: Date, tz: string) {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(tz).formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Diferença (ms) entre o horário local no fuso e UTC naquele instante. */
export function tzOffsetMs(date: Date, tz: string) {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function parseLocalDate(date: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Data inválida: ${date}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** Converte data + minutos locais do fuso em instante UTC. */
export function zonedToUtc(date: string, minutes: number, tz: string): Date {
  const { year, month, day } = parseLocalDate(date);
  const guess = Date.UTC(year, month - 1, day, 0, minutes);
  const first = guess - tzOffsetMs(new Date(guess), tz);
  // Segunda passada corrige mudanças de horário de verão no meio do dia.
  return new Date(guess - tzOffsetMs(new Date(first), tz));
}

/** Data local, minutos locais e dia da semana (0 = domingo) de um instante. */
export function utcToZoned(date: Date, tz: string) {
  const p = zonedParts(date, tz);
  const localDate = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  return { date: localDate, minutes: p.hour * 60 + p.minute, weekday: weekdayOf(localDate) };
}

export function todayIn(tz: string, now: Date = new Date()) {
  return utcToZoned(now, tz).date;
}

export function addDays(date: string, days: number) {
  const { year, month, day } = parseLocalDate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(date: string) {
  const { year, month, day } = parseLocalDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function diffDays(from: string, to: string) {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
}

/** "HH:MM" ou "HH:MM:SS" → minutos */
export function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Início da semana (domingo) de uma data local. */
export function startOfWeek(date: string) {
  return addDays(date, -weekdayOf(date));
}

export function startOfMonth(date: string) {
  return `${date.slice(0, 7)}-01`;
}

export function daysInMonth(date: string) {
  const { year, month } = parseLocalDate(date);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// ---------------------------------------------------------------------------
// Formatação (pt-BR)
// ---------------------------------------------------------------------------

export function formatTime(date: Date, tz: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(date);
}

/** "terça-feira, 8 de janeiro" */
export function formatLocalDateLong(date: string) {
  const { year, month, day } = parseLocalDate(date);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** "08/01" */
export function formatLocalDateShort(date: string) {
  const { month, day } = parseLocalDate(date);
  return `${pad(day)}/${pad(month)}`;
}

export function formatWeekdayShort(date: string) {
  const { year, month, day } = parseLocalDate(date);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short" })
    .format(new Date(Date.UTC(year, month - 1, day)))
    .replace(".", "");
}

export function formatMonthYear(date: string) {
  const { year, month } = parseLocalDate(date);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

export function formatDateTime(date: Date, tz: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export const WEEKDAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** "out" */
export function formatMonthShort(date: string) {
  const { year, month, day } = parseLocalDate(date);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "short" })
    .format(new Date(Date.UTC(year, month - 1, day)))
    .replace(".", "");
}
