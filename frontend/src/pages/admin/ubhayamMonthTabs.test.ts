import { describe, expect, it } from 'vitest';

import {
  buildContinuousUbhayamMonthTabs,
  buildRollingUbhayamMonthTabs,
  buildUbhayamYearOptions,
} from './ubhayamMonthTabs';

describe('buildRollingUbhayamMonthTabs', () => {
  it('keeps the existing rolling 13-month admin window', () => {
    const tabs = buildRollingUbhayamMonthTabs({
      referenceDate: new Date(2026, 9, 20),
    });

    expect(tabs[0]?.key).toBe('2026-09');
    expect(tabs[1]?.key).toBe('2026-10');
    expect(tabs).toHaveLength(13);
    expect(tabs.at(-1)?.key).toBe('2027-09');
  });
});

describe('buildContinuousUbhayamMonthTabs', () => {
  it('builds a continuous donor month list from the configured historical start through the current month', () => {
    const tabs = buildContinuousUbhayamMonthTabs('2026-01', {
      referenceDate: new Date(2026, 9, 20),
    });

    expect(tabs.map((tab) => tab.key)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
  });
});

describe('buildUbhayamYearOptions', () => {
  it('builds continuous donor year options from the historical start through the current year', () => {
    const years = buildUbhayamYearOptions('2026-01', {
      referenceDate: new Date(2027, 0, 10),
    });

    expect(years).toEqual([
      { value: 2026, label: '2026' },
      { value: 2027, label: '2027' },
    ]);
  });
});
