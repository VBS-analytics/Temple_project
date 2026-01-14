import clsx from 'clsx';

import type { UseSessionTimeoutOutput } from '../hooks/useSessionTimeout';

const roleLabelMap: Record<string, string> = {
  admin: 'Admin',
  donor: 'Donor',
};

interface SessionExpiryPromptProps {
  shouldShowPrompt: UseSessionTimeoutOutput['shouldShowPrompt'];
  extendSession: UseSessionTimeoutOutput['extendSession'];
  handleLogout: UseSessionTimeoutOutput['handleLogout'];
  role: UseSessionTimeoutOutput['role'];
  sessionDurationMinutes: UseSessionTimeoutOutput['sessionDurationMinutes'];
}

const SessionExpiryPrompt = ({
  shouldShowPrompt,
  extendSession,
  handleLogout,
  role,
  sessionDurationMinutes,
}: SessionExpiryPromptProps) => {
  if (!shouldShowPrompt || !role || sessionDurationMinutes === null) {
    return null;
  }

  const roleLabel = roleLabelMap[role] ?? 'Temple';
  const durationLabel =
    sessionDurationMinutes > 1 ? `${sessionDurationMinutes} minutes` : `${sessionDurationMinutes} minute`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/70" aria-hidden="true" />
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">
          {roleLabel} session timeout
        </p>
        <h3 className="mt-2 text-xl font-semibold text-slate-900">Session expired</h3>
        <p className="mt-2 text-sm text-slate-600">
          This {roleLabel} session is configured for {durationLabel}. Would you like to continue or logout?
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={handleLogout}
            className={clsx(
              'rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition',
              'hover:border-slate-300 hover:text-slate-900',
            )}
          >
            Logout
          </button>
          <button
            type="button"
            onClick={extendSession}
            className={clsx(
              'rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition',
              'hover:from-indigo-600 hover:to-purple-700',
            )}
          >
            Continue session
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionExpiryPrompt;
