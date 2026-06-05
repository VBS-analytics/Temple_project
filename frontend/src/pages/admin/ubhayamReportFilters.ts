export type FixedUbhayamAllocationRow = {
  date: string;
  day_of_month: string;
  tamil_star: string;
  pooja_day_option: string;
  donor_id: string;
  donor_name: string;
  donor_mobile_number: string;
};

export const SATURDAY_NAVAGRAHA_LABEL = 'Saturday Navagraha Pooja';

const splitColumn = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim());

const normalizeDonorId = (value?: string | null) => (value ?? '').trim().toUpperCase();

const normalizeDayOptionLabel = (value?: string | null) =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const shouldAppendSaturdayNavagrahaLabel = (
  existingLabels: string[],
  isSaturday: boolean,
) => {
  if (!isSaturday) {
    return false;
  }
  const saturdayLabel = normalizeDayOptionLabel(SATURDAY_NAVAGRAHA_LABEL);
  return !existingLabels.some((label) => normalizeDayOptionLabel(label) === saturdayLabel);
};

export const shouldUseFixedUbhayamRows = (isAdminUser: boolean, hasFixedMonthRows: boolean) =>
  hasFixedMonthRows;

export const filterFixedUbhayamRowsForDonor = <T extends FixedUbhayamAllocationRow>(
  rows: T[],
  donorId?: string | null,
): T[] => {
  const targetDonorId = normalizeDonorId(donorId);
  if (!targetDonorId) {
    return [];
  }

  return rows.reduce<T[]>((filteredRows, row) => {
    const donorIds = splitColumn(row.donor_id ?? '');
    const donorIndex = donorIds.findIndex((value) => normalizeDonorId(value) === targetDonorId);
    if (donorIndex < 0) {
      return filteredRows;
    }

    const donorNames = splitColumn(row.donor_name ?? '');
    const donorMobileNumbers = splitColumn(row.donor_mobile_number ?? '');
    filteredRows.push({
      ...row,
      donor_id: donorIds[donorIndex] ?? '',
      donor_name: donorNames[donorIndex] ?? '',
      donor_mobile_number: donorMobileNumbers[donorIndex] ?? '',
    });
    return filteredRows;
  }, []);
};
