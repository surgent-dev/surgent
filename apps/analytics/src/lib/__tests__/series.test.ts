import { normalizeTimeSeries } from '../series'

describe('normalizeTimeSeries', () => {
  test('fills missing daily buckets with zeros', () => {
    const data = [
      { x: '2026-03-01T00:00:00Z', y: 4 },
      { x: '2026-03-03T00:00:00Z', y: 9 },
    ]

    const result = normalizeTimeSeries(data, {
      startDate: new Date('2026-03-01T00:00:00Z'),
      endDate: new Date('2026-03-03T23:59:59Z'),
      unit: 'day',
      timezone: 'UTC',
    })

    expect(result).toEqual([
      { x: '2026-03-01T00:00:00Z', y: 4 },
      { x: '2026-03-02T00:00:00Z', y: 0 },
      { x: '2026-03-03T00:00:00Z', y: 9 },
    ])
  })

  test('fills missing hourly buckets with zeros', () => {
    const data = [
      { x: '2026-03-01T00:00:00Z', y: 2 },
      { x: '2026-03-01T02:00:00Z', y: 5 },
    ]

    const result = normalizeTimeSeries(data, {
      startDate: new Date('2026-03-01T00:00:00Z'),
      endDate: new Date('2026-03-01T02:59:59Z'),
      unit: 'hour',
      timezone: 'UTC',
    })

    expect(result).toEqual([
      { x: '2026-03-01T00:00:00Z', y: 2 },
      { x: '2026-03-01T01:00:00Z', y: 0 },
      { x: '2026-03-01T02:00:00Z', y: 5 },
    ])
  })

  test('returns zero-filled buckets for empty data', () => {
    const result = normalizeTimeSeries([], {
      startDate: new Date('2026-03-01T00:00:00Z'),
      endDate: new Date('2026-03-03T23:59:59Z'),
      unit: 'day',
      timezone: 'UTC',
    })

    expect(result).toEqual([
      { x: '2026-03-01T00:00:00Z', y: 0 },
      { x: '2026-03-02T00:00:00Z', y: 0 },
      { x: '2026-03-03T00:00:00Z', y: 0 },
    ])
  })

  test('preserves non-utc bucket offsets', () => {
    const data = [
      { x: '2026-03-01 00:00:00', y: 4 },
      { x: '2026-03-02 00:00:00', y: 7 },
    ]

    const result = normalizeTimeSeries(data, {
      startDate: new Date('2026-03-01T08:00:00Z'),
      endDate: new Date('2026-03-02T23:59:59-08:00'),
      unit: 'day',
      timezone: 'America/Los_Angeles',
    })

    expect(result).toEqual([
      { x: '2026-03-01T00:00:00-08:00', y: 4 },
      { x: '2026-03-02T00:00:00-08:00', y: 7 },
    ])
  })

  test('keeps the local end-day bucket for los angeles daily ranges', () => {
    const result = normalizeTimeSeries([{ x: '2026-03-27 00:00:00', y: 34 }], {
      startDate: new Date(1773990000000),
      endDate: new Date(1774681199999),
      unit: 'day',
      timezone: 'America/Los_Angeles',
    })

    expect(result).toEqual([
      { x: '2026-03-20T00:00:00-07:00', y: 0 },
      { x: '2026-03-21T00:00:00-07:00', y: 0 },
      { x: '2026-03-22T00:00:00-07:00', y: 0 },
      { x: '2026-03-23T00:00:00-07:00', y: 0 },
      { x: '2026-03-24T00:00:00-07:00', y: 0 },
      { x: '2026-03-25T00:00:00-07:00', y: 0 },
      { x: '2026-03-26T00:00:00-07:00', y: 0 },
      { x: '2026-03-27T00:00:00-07:00', y: 34 },
    ])
  })

  test('handles dst spring-forward without generating a fake 2am bucket', () => {
    const result = normalizeTimeSeries([], {
      startDate: new Date('2025-03-09T05:00:00Z'),
      endDate: new Date('2025-03-10T03:59:59Z'),
      unit: 'hour',
      timezone: 'America/New_York',
    })

    expect(result).toHaveLength(23)
    expect(result[0]).toEqual({ x: '2025-03-09T00:00:00-05:00', y: 0 })
    expect(result[1]).toEqual({ x: '2025-03-09T01:00:00-05:00', y: 0 })
    expect(result.some((point) => point.x.includes('T02:00:00'))).toBe(false)
    expect(result[result.length - 1]).toEqual({ x: '2025-03-09T23:00:00-04:00', y: 0 })
  })

  test('falls back to utc for invalid timezones', () => {
    const data = [{ x: '2026-03-01T00:00:00Z', y: 3 }]

    const result = normalizeTimeSeries(data, {
      startDate: new Date('2026-03-01T00:00:00Z'),
      endDate: new Date('2026-03-01T23:59:59Z'),
      unit: 'day',
      timezone: 'Mars/Olympus',
    })

    expect(result).toEqual([{ x: '2026-03-01T00:00:00Z', y: 3 }])
  })
})
