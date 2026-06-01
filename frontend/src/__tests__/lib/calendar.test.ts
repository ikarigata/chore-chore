import { describe, it, expect } from 'vitest'
import { buildMonthGrid, prevMonth, nextMonth, isInMonth } from '../../lib/calendar'

describe('buildMonthGrid', () => {
  it('2026-06 は日曜始まり・土曜終わりで月末まで覆う', () => {
    const grid = buildMonthGrid('2026-06')
    // 2026-06-01 は月曜 → 日曜の 2026-05-31 から始まる
    expect(grid[0]).toBe('2026-05-31')
    // 月末 2026-06-30 は火曜 → その週の土曜 2026-07-04 まで
    expect(grid[grid.length - 1]).toBe('2026-07-04')
  })

  it('6 週入る月（2026-05）は 42 セル', () => {
    const grid = buildMonthGrid('2026-05')
    expect(grid.length).toBe(42)
    expect(grid[0]).toBe('2026-04-26')
    expect(grid[41]).toBe('2026-06-06')
  })

  it('5 週で収まる月（2026-02 平年）は 28 セル', () => {
    const grid = buildMonthGrid('2026-02')
    // 2026-02-01 は日曜 → そのまま始まる、月末は 2026-02-28 (土)
    expect(grid.length).toBe(28)
    expect(grid[0]).toBe('2026-02-01')
    expect(grid[27]).toBe('2026-02-28')
  })

  it('閏年 2024-02 は 29 日まで', () => {
    const grid = buildMonthGrid('2024-02')
    expect(grid).toContain('2024-02-29')
    expect(grid).not.toContain('2024-02-30')
  })
})

describe('prevMonth / nextMonth', () => {
  it('年をまたいで前月を返す', () => {
    expect(prevMonth('2026-01')).toBe('2025-12')
  })
  it('年をまたいで次月を返す', () => {
    expect(nextMonth('2026-12')).toBe('2027-01')
  })
  it('同じ年の月送り', () => {
    expect(prevMonth('2026-06')).toBe('2026-05')
    expect(nextMonth('2026-06')).toBe('2026-07')
  })
})

describe('isInMonth', () => {
  it('当月の日付は true', () => {
    expect(isInMonth('2026-06-01', '2026-06')).toBe(true)
    expect(isInMonth('2026-06-30', '2026-06')).toBe(true)
  })
  it('月跨ぎの日付は false', () => {
    expect(isInMonth('2026-05-31', '2026-06')).toBe(false)
    expect(isInMonth('2026-07-01', '2026-06')).toBe(false)
  })
})
