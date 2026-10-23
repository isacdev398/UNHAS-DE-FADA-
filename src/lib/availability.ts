import { addDays, diffDays, timeToMinutes, todayIn, utcToZoned, weekdayOf, zonedToUtc } from "./time";

export type WeeklyHours = { weekday: number; opensAt: string; closesAt: string };
export type DateException = { onDate: string; opensAt: string; closesAt: string };
export type Interval = { start: Date; end: Date };

export type ScheduleRules = {
  tz: string;
  intervalMinutes: number;
  bufferMinutes: number;
  minAdvanceMinutes: number;
  maxAdvanceDays: number;
};

export type AgendaState = {
  weeklyHours: WeeklyHours[];
  exceptions: DateException[];
  /** Bloqueios, folgas, feriados e férias */
  blocks: Interval[];
  /** Agendamentos ativos */
  busy: Interval[];
};

/** Faixas de funcionamento (em minutos locais) de uma data. Exceções substituem o horário semanal. */
export function openRangesFor(date: string, state: Pick<AgendaState, "weeklyHours" | "exceptions">) {
  const exceptions = state.exceptions.filter((e) => e.onDate === date);
  const source = exceptions.length > 0 ? exceptions : state.weeklyHours.filter((h) => h.weekday === weekdayOf(date));
  return source
    .map((r) => ({ start: timeToMinutes(r.opensAt), end: timeToMinutes(r.closesAt) }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

/** Horários de início livres para um atendimento com a duração informada. */
export function computeDaySlots(
  date: string,
  durationMinutes: number,
  rules: ScheduleRules,
  state: AgendaState,
  now: Date,
  opts: { ignoreLimits?: boolean } = {},
): Date[] {
  if (durationMinutes <= 0) return [];

  const today = todayIn(rules.tz, now);
  const ahead = diffDays(today, date);
  if (!opts.ignoreLimits && (ahead < 0 || ahead > rules.maxAdvanceDays)) return [];

  const earliest = opts.ignoreLimits ? -Infinity : now.getTime() + rules.minAdvanceMinutes * 60_000;
  const buffer = rules.bufferMinutes * 60_000;
  const taken = [
    ...state.busy.map((b) => ({ start: b.start.getTime(), end: b.end.getTime() + buffer })),
    ...state.blocks.map((b) => ({ start: b.start.getTime(), end: b.end.getTime() })),
  ];

  // Como cada serviço tem uma duração, além da grade fixa oferecemos horários
  // encaixados: logo que um atendimento/bloqueio termina e o horário que termina
  // exatamente quando o próximo começa. Assim a agenda não fica com "buracos".
  const fitted: number[] = [];
  for (const t of taken) {
    const after = utcToZoned(new Date(t.end), rules.tz);
    if (after.date === date) fitted.push(after.minutes);
    const before = utcToZoned(new Date(t.start - (durationMinutes + rules.bufferMinutes) * 60_000), rules.tz);
    if (before.date === date) fitted.push(before.minutes);
  }

  const slots: Date[] = [];
  for (const range of openRangesFor(date, state)) {
    const candidates = new Set<number>();
    for (let m = range.start; m + durationMinutes <= range.end; m += rules.intervalMinutes) candidates.add(m);
    for (const m of fitted) if (m >= range.start && m + durationMinutes <= range.end) candidates.add(m);

    for (const m of [...candidates].sort((a, b) => a - b)) {
      const start = zonedToUtc(date, m, rules.tz).getTime();
      const end = start + durationMinutes * 60_000;
      if (start < earliest) continue;
      if (taken.some((t) => overlaps(start, end + buffer, t.start, t.end))) continue;
      slots.push(new Date(start));
    }
  }
  return slots;
}

/** Datas (a partir de hoje) que têm pelo menos um horário livre. */
export function computeAvailableDates(
  durationMinutes: number,
  rules: ScheduleRules,
  state: AgendaState,
  now: Date,
  days = rules.maxAdvanceDays,
) {
  const today = todayIn(rules.tz, now);
  const out: string[] = [];
  for (let i = 0; i <= Math.min(days, rules.maxAdvanceDays); i++) {
    const date = addDays(today, i);
    if (computeDaySlots(date, durationMinutes, rules, state, now).length > 0) out.push(date);
  }
  return out;
}

/** Confirma que um horário escolhido continua válido segundo as regras atuais. */
export function isSlotAvailable(
  start: Date,
  date: string,
  durationMinutes: number,
  rules: ScheduleRules,
  state: AgendaState,
  now: Date,
) {
  return computeDaySlots(date, durationMinutes, rules, state, now).some((s) => s.getTime() === start.getTime());
}
