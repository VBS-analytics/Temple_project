export type UbhayamMonthTab = {
  key: string;
  label: string;
  shortLabel: string;
  year: number;
  monthIndex: number;
};

export type UbhayamYearOption = {
  value: number;
  label: string;
};

const buildMonthTab = (targetDate: Date): UbhayamMonthTab => ({
  key: `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`,
  label: targetDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
  shortLabel: targetDate.toLocaleDateString('en-GB', { month: 'short' }),
  year: targetDate.getFullYear(),
  monthIndex: targetDate.getMonth(),
});

export const buildRollingUbhayamMonthTabs = (
  options?: { referenceDate?: Date; startOffset?: number; totalMonths?: number },
): UbhayamMonthTab[] => {
  const { referenceDate = new Date(), startOffset = -1, totalMonths = 13 } = options ?? {};
  return Array.from({ length: totalMonths }, (_, index) =>
    buildMonthTab(new Date(referenceDate.getFullYear(), referenceDate.getMonth() + startOffset + index, 1)),
  );
};

export const buildContinuousUbhayamMonthTabs = (
  startMonthKey: string,
  options?: { referenceDate?: Date },
): UbhayamMonthTab[] => {
  const parsed = /^(\d{4})-(\d{2})$/.exec(startMonthKey.trim());
  const referenceDate = options?.referenceDate ?? new Date();
  const endDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const startDate = parsed
    ? new Date(Number(parsed[1]), Math.max(0, Math.min(11, Number(parsed[2]) - 1)), 1)
    : endDate;
  const monthCount =
    (endDate.getFullYear() - startDate.getFullYear()) * 12
    + (endDate.getMonth() - startDate.getMonth())
    + 1;

  if (monthCount <= 0) {
    return [buildMonthTab(endDate)];
  }

  return Array.from({ length: monthCount }, (_, index) =>
    buildMonthTab(new Date(startDate.getFullYear(), startDate.getMonth() + index, 1)),
  );
};

export const buildUbhayamYearOptions = (
  startMonthKey: string,
  options?: { referenceDate?: Date },
): UbhayamYearOption[] => {
  const tabs = buildContinuousUbhayamMonthTabs(startMonthKey, options);
  return Array.from(new Set(tabs.map((tab) => tab.year))).map((year) => ({
    value: year,
    label: String(year),
  }));
};
