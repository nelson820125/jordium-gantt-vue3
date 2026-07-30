const pad2 = (n: number): string => String(n).padStart(2, '0')

/**
 * Formatiert einen Roh-Datumswert als deutsches "TT.MM.JJJJ HH:mm" fuer die Gantt-Tooltips.
 *
 * Parst die im Gantt genutzten Rohformate robust (reines Datum, "YYYY-MM-DD HH:mm", ISO als
 * Fallback) statt per substring - so bleibt die Uhrzeit erhalten. Ein reines Datum ohne Zeit
 * wird als 00:00 gezeigt.
 *
 * @param {string | null | undefined} input - Roh-Datumsstring (YYYY-MM-DD, YYYY-MM-DD HH:mm oder ISO).
 * @returns {string | null} "TT.MM.JJJJ HH:mm", oder null wenn leer/unparsbar - der Aufrufer
 *   setzt dann seinen eigenen Fallback (z.B. t('dateNotSet')).
 */
export function formatDateTimeDE(input: string | null | undefined): string | null {
  if (!input) return null

  // ponytail: Parse spiegelt TaskBar.createLocalDate. Die mehreren Parser-Varianten im Fork
  // (predecessorUtils, TaskBar, taskPositionUtils) zu einem zu konsolidieren ist eigener Scope.
  let date: Date | null = null
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number)
    date = new Date(y, m - 1, d)
  } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(input)) {
    const [datePart, timePart] = input.split(' ')
    const [y, m, d] = datePart.split('-').map(Number)
    const [hh, mm] = timePart.split(':').map(Number)
    date = new Date(y, m - 1, d, hh, mm)
  } else {
    const parsed = new Date(input)
    date = isNaN(parsed.getTime()) ? null : parsed
  }
  if (!date) return null

  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}
