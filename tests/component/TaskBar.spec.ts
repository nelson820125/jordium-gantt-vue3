import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TaskBar from '@/components/TaskBar.vue'
import { TimelineScale } from '@/models/types/TimelineScale'
import type { Task } from '@/models/classes/Task'

// Der rote parent-overflow-bar-Strich (bei enableParentTaskAutoSchedule=false, wenn Kinder
// ueber das Eltern-Zeitfenster hinausragen) muss sich exakt wie ein normaler Task-Balken
// verhalten, der die Kinder-Huellkurve (minStart..maxEnd) spannt - inklusive Uhrzeit.
// Invariante statt harter Pixelwerte: Overflow-Kanten == Balken-Kanten gleicher Spanne.

const DAY_WIDTH = 48
const ROW_HEIGHT = 40
const BASE = new Date(2026, 6, 20) // 20.07.2026, lokale Mitternacht (Timeline-Basis)

function mountBar(props: Record<string, unknown>) {
  return mount(TaskBar, {
    props: {
      rowHeight: ROW_HEIGHT,
      dayWidth: DAY_WIDTH,
      startDate: BASE,
      currentTimeScale: TimelineScale.DAY,
      ...props,
    },
    global: {
      stubs: { Teleport: true },
      mocks: { $t: (k: string) => k },
    },
  })
}

function px(wrapper: ReturnType<typeof mount>, selector: string, prop: 'left' | 'width'): number {
  const el = wrapper.find(selector).element as HTMLElement
  return parseFloat(el.style[prop] || '0')
}

// Kinder mit konkreten Uhrzeiten -> Huellkurve 20.07. 08:00 .. 28.07. 14:00
const children: Partial<Task>[] = [
  { id: 11, name: 'c1', startDate: '2026-07-20 08:00', endDate: '2026-07-24 12:00', progress: 0 },
  { id: 12, name: 'c2', startDate: '2026-07-22 09:00', endDate: '2026-07-28 14:00', progress: 0 },
]

describe('TaskBar parent-overflow-bar', () => {
  it('deckt sich mit einem Task-Balken der gleichen Spanne (Tagesansicht, ohne timelineData)', () => {
    // Eltern: Config-Fenster 21.07..26.07 (schmaler als Kinder -> Overflow links UND rechts)
    const parent = mountBar({
      isParent: true,
      enableParentTaskAutoSchedule: false,
      task: {
        id: 1,
        name: 'project',
        startDate: '2026-07-21 00:00',
        endDate: '2026-07-26 00:00',
        progress: 0,
        isParent: true,
        children,
      },
    })

    // Normaler Balken, der exakt minStart..maxEnd spannt
    const plain = mountBar({
      isParent: false,
      task: {
        id: 2,
        name: 'span',
        startDate: '2026-07-20 08:00',
        endDate: '2026-07-28 14:00',
        progress: 0,
      },
    })

    expect(parent.find('.parent-overflow-bar').exists()).toBe(true)

    const oLeft = px(parent, '.parent-overflow-bar', 'left')
    const oWidth = px(parent, '.parent-overflow-bar', 'width')
    const bLeft = px(plain, '.task-bar', 'left')
    const bWidth = px(plain, '.task-bar', 'width')

    expect(oLeft).toBeCloseTo(bLeft, 1)
    expect(oWidth).toBeCloseTo(bWidth, 1)
  })

  it('deckt sich mit einem Task-Balken der gleichen Spanne (Tagesansicht, mit timelineData)', () => {
    // timelineData wie die App sie liefert: ein Zeitraum mit Tages-Zellen ab 20.07.
    const days = Array.from({ length: 12 }, (_, i) => ({
      date: new Date(2026, 6, 20 + i),
      day: 20 + i,
    }))
    const timelineData = [{ days }]

    const parent = mountBar({
      isParent: true,
      enableParentTaskAutoSchedule: false,
      timelineData,
      task: {
        id: 1,
        name: 'project',
        startDate: '2026-07-21 00:00',
        endDate: '2026-07-26 00:00',
        progress: 0,
        isParent: true,
        children,
      },
    })
    const plain = mountBar({
      isParent: false,
      timelineData,
      task: {
        id: 2,
        name: 'span',
        startDate: '2026-07-20 08:00',
        endDate: '2026-07-28 14:00',
        progress: 0,
      },
    })

    expect(parent.find('.parent-overflow-bar').exists()).toBe(true)
    expect(px(parent, '.parent-overflow-bar', 'left')).toBeCloseTo(
      px(plain, '.task-bar', 'left'),
      1
    )
    expect(px(parent, '.parent-overflow-bar', 'width')).toBeCloseTo(
      px(plain, '.task-bar', 'width'),
      1
    )
  })

  it('deckt sich mit einem Task-Balken der gleichen Spanne (Stundenansicht)', () => {
    const parent = mountBar({
      isParent: true,
      enableParentTaskAutoSchedule: false,
      currentTimeScale: TimelineScale.HOUR,
      task: {
        id: 1,
        name: 'project',
        startDate: '2026-07-21 00:00',
        endDate: '2026-07-26 00:00',
        progress: 0,
        isParent: true,
        children,
      },
    })
    const plain = mountBar({
      isParent: false,
      currentTimeScale: TimelineScale.HOUR,
      task: {
        id: 2,
        name: 'span',
        startDate: '2026-07-20 08:00',
        endDate: '2026-07-28 14:00',
        progress: 0,
      },
    })

    expect(parent.find('.parent-overflow-bar').exists()).toBe(true)
    expect(px(parent, '.parent-overflow-bar', 'left')).toBeCloseTo(
      px(plain, '.task-bar', 'left'),
      1
    )
    expect(px(parent, '.parent-overflow-bar', 'width')).toBeCloseTo(
      px(plain, '.task-bar', 'width'),
      1
    )
  })
})

// progress wird im Booking-Gantt als Ressourcen-Belegung (gebucht/gesamt) genutzt, nicht als
// Fertigstellung. Ein zu 100% belegter Bedarf muss weiter zeitlich verschieb- und resizebar sein.
// allowDragAndResize=true spiegelt die Produktion (GanttChart/Timeline reichen den Default durch).
describe('TaskBar: Verschieben/Resize trotz 100% Belegung (progress=100)', () => {
  const fullyBooked: Partial<Task> = {
    id: 3,
    name: 'full',
    startDate: '2026-07-20 08:00',
    endDate: '2026-07-24 12:00',
    progress: 100,
  }
  const mountBooked = (extra: Record<string, unknown> = {}) =>
    mountBar({ isParent: false, allowDragAndResize: true, task: fullyBooked, ...extra })

  it('rendert die Resize-Griffe auch bei progress=100 (Nicht-Parent)', () => {
    const w = mountBooked()
    expect(w.find('.resize-handle-left').exists()).toBe(true)
    expect(w.find('.resize-handle-right').exists()).toBe(true)
  })

  it('blockiert den Drag-Start bei progress=100 nicht (mousedown wird verarbeitet)', () => {
    const w = mountBooked()
    const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    w.find('.task-bar-content').element.dispatchEvent(ev)
    // handleMouseDown ruft preventDefault erst, wenn es NICHT frueh abbricht (progress>=100 brach ab).
    expect(ev.defaultPrevented).toBe(true)
  })

  it('zeigt cursor:move bei progress=100 (Nicht-Parent)', () => {
    const el = mountBooked().find('.task-bar').element as HTMLElement
    expect(el.style.cursor).toBe('move')
  })

  it('sperrt Parent-Balken auch bei progress=100 weiterhin (keine Griffe)', () => {
    const w = mountBar({
      isParent: true,
      allowDragAndResize: true,
      task: { ...fullyBooked, isParent: true },
    })
    expect(w.find('.resize-handle-left').exists()).toBe(false)
    expect(w.find('.resize-handle-right').exists()).toBe(false)
  })
})
