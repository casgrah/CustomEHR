/** Short codes and tone for the flag chips on a census face card. */
export const FLAG_META: Record<string, { short: string; tone: 'crit' | 'warn' | 'info' | 'mute'; full: string }> = {
  'F-01': { short: 'ALG',  tone: 'crit', full: 'Allergies' },
  'F-02': { short: 'SAFE', tone: 'crit', full: 'Safety plan on file — review before session' },
  'F-03': { short: 'ELOP', tone: 'crit', full: 'Elopement risk' },
  'F-04': { short: 'PREC', tone: 'warn', full: 'Fall precautions' },
  'F-05': { short: 'MOUD', tone: 'info', full: 'Medication for opioid use disorder' },
  'F-06': { short: 'INT',  tone: 'info', full: 'Interpreter required' },
  'F-07': { short: 'LEG',  tone: 'warn', full: 'Court-involved' },
}
export function flagMeta(code: string, label?: string) {
  return FLAG_META[code] ?? {
    short: (label ?? code).slice(0, 4).toUpperCase(), tone: 'mute' as const, full: label ?? code,
  }
}
