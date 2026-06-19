import { describe, expect, it } from 'vitest';

import { canViewDonorUbhayamReport, type UserProfile } from './auth';

const makeUser = (role: UserProfile['role']): UserProfile => ({
  id: role === 'admin' ? 1 : 2,
  phone_number: role === 'admin' ? '9999999999' : '5001',
  name: role === 'admin' ? 'Admin User' : 'Donor User',
  role,
});

describe('canViewDonorUbhayamReport', () => {
  it('shows the donor Ubhayam report page for donor logins', () => {
    expect(canViewDonorUbhayamReport(makeUser('donor'))).toBe(true);
  });

  it('does not grant the donor route to admin users', () => {
    expect(canViewDonorUbhayamReport(makeUser('admin'))).toBe(false);
  });

  it('does not expose the page to guests', () => {
    expect(canViewDonorUbhayamReport()).toBe(false);
  });
});
