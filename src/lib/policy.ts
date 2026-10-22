export type ClientPolicy = {
  allowClientCancel: boolean;
  cancelMinHours: number;
  allowClientReschedule: boolean;
  rescheduleMinHours: number;
};

export type PolicyDecision = { allowed: true } | { allowed: false; reason: string };

function decide(enabled: boolean, minHours: number, startsAt: Date, now: Date, verb: string): PolicyDecision {
  if (!enabled) return { allowed: false, reason: `Para ${verb}, fale com a gente pelo WhatsApp.` };
  if (startsAt.getTime() <= now.getTime()) return { allowed: false, reason: "Este horário já passou." };
  if (startsAt.getTime() - now.getTime() < minHours * 3_600_000) {
    return {
      allowed: false,
      reason: `Pelo site, só é possível ${verb} com ${minHours} h de antecedência. Fale com a gente pelo WhatsApp.`,
    };
  }
  return { allowed: true };
}

export function canClientCancel(policy: ClientPolicy, startsAt: Date, now: Date) {
  return decide(policy.allowClientCancel, policy.cancelMinHours, startsAt, now, "cancelar");
}

export function canClientReschedule(policy: ClientPolicy, startsAt: Date, now: Date) {
  return decide(policy.allowClientReschedule, policy.rescheduleMinHours, startsAt, now, "reagendar");
}
