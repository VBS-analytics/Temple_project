export type RecurrenceKind = 'recurring' | 'one_time_extra';
export type RecurrenceFrequency = 'monthly' | 'quarterly' | 'annually';

export type RecurrenceSelection =
  | { kind: 'recurring'; frequency: RecurrenceFrequency }
  | { kind: 'one_time_extra'; oneTimeDate?: string };
