import { describe, expect, it } from 'vitest';

import {
  SATURDAY_NAVAGRAHA_LABEL,
  filterFixedUbhayamRowsForDonor,
  shouldUseFixedUbhayamRows,
  shouldAppendSaturdayNavagrahaLabel,
} from './ubhayamReportFilters';

describe('shouldUseFixedUbhayamRows', () => {
  it('uses fixed May/June allocation rows for admin and donor report views', () => {
    expect(shouldUseFixedUbhayamRows(true, true)).toBe(true);
    expect(shouldUseFixedUbhayamRows(false, true)).toBe(true);
    expect(shouldUseFixedUbhayamRows(true, false)).toBe(false);
  });
});

describe('filterFixedUbhayamRowsForDonor', () => {
  it('keeps only fixed allocation rows for the current donor and trims paired donor columns', () => {
    const rows = [
      {
        date: '2026-06-13',
        day_of_month: 'Saturday',
        tamil_star: 'கிருத்திகை',
        pooja_day_option: 'Choose Your Star, Saturday Navagraha Pooja',
        donor_id: 'D14, D15, D87',
        donor_name: 'R Vaidhyanathan, Shuba, Aravind Ramkumar',
        donor_mobile_number: '9176656063, 9840991908, +919962966009',
      },
      {
        date: '2026-06-14',
        day_of_month: 'Sunday',
        tamil_star: 'ரோகிணி',
        pooja_day_option: 'On Amavasai day of month',
        donor_id: 'D16, D20, D96',
        donor_name: 'R Ravichandran, R Sethuraman, Chitra S',
        donor_mobile_number: '9940670847, +919840817675, +919445401576',
      },
    ];

    expect(filterFixedUbhayamRowsForDonor(rows, 'D14')).toEqual([
      {
        date: '2026-06-13',
        day_of_month: 'Saturday',
        tamil_star: 'கிருத்திகை',
        pooja_day_option: 'Choose Your Star, Saturday Navagraha Pooja',
        donor_id: 'D14',
        donor_name: 'R Vaidhyanathan',
        donor_mobile_number: '9176656063',
      },
    ]);
  });

  it('matches donor ids case-insensitively without partial donor number matches', () => {
    const rows = [
      {
        date: '2026-06-01',
        day_of_month: 'Monday',
        tamil_star: 'கேட்டை',
        pooja_day_option: 'Choose Your Star',
        donor_id: 'D140, D141',
        donor_name: 'Wrong One, Wrong Two',
        donor_mobile_number: '111, 222',
      },
      {
        date: '2026-06-02',
        day_of_month: 'Tuesday',
        tamil_star: 'மூலம்',
        pooja_day_option: 'Choose Your Star',
        donor_id: 'd14',
        donor_name: 'Right Donor',
        donor_mobile_number: '333',
      },
    ];

    expect(filterFixedUbhayamRowsForDonor(rows, 'D14')).toHaveLength(1);
    expect(filterFixedUbhayamRowsForDonor(rows, 'D14')[0].donor_name).toBe('Right Donor');
  });
});

describe('shouldAppendSaturdayNavagrahaLabel', () => {
  it('does not append the Saturday label when the report row already has it', () => {
    expect(
      shouldAppendSaturdayNavagrahaLabel(
        ['On sashti day of month', SATURDAY_NAVAGRAHA_LABEL],
        true,
      ),
    ).toBe(false);
  });

  it('appends the Saturday label only when the row does not already include it', () => {
    expect(shouldAppendSaturdayNavagrahaLabel(['Choose Your Star'], true)).toBe(true);
    expect(shouldAppendSaturdayNavagrahaLabel(['Choose Your Star'], false)).toBe(false);
  });
});
