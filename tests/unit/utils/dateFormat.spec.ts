/**
 * dateFormat.spec.ts - Datum+Uhrzeit-Formatierung fuer die Gantt-Tooltips
 */

import { describe, it, expect } from 'vitest'
import { formatDateTimeDE } from '../../../src/utils/dateFormat'

describe('formatDateTimeDE', () => {
  it('formatiert "YYYY-MM-DD HH:mm" als "TT.MM.JJJJ HH:mm"', () => {
    expect(formatDateTimeDE('2026-07-24 10:30')).toBe('24.07.2026 10:30')
  })

  it('zeigt ein reines Datum mit 00:00', () => {
    expect(formatDateTimeDE('2026-07-24')).toBe('24.07.2026 00:00')
  })

  it('parst ISO-Datumszeit ohne Zeitzone als lokale Zeit', () => {
    expect(formatDateTimeDE('2026-07-24T10:30:00')).toBe('24.07.2026 10:30')
  })

  it('padded ein- und zweistellige Werte', () => {
    expect(formatDateTimeDE('2026-01-05 09:07')).toBe('05.01.2026 09:07')
  })

  it('gibt null bei leerem, null/undefined oder unparsbarem Wert', () => {
    expect(formatDateTimeDE('')).toBeNull()
    expect(formatDateTimeDE(null)).toBeNull()
    expect(formatDateTimeDE(undefined)).toBeNull()
    expect(formatDateTimeDE('kein datum')).toBeNull()
  })
})
