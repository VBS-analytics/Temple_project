import clsx from 'clsx';
import { Link, NavLink, Outlet } from 'react-router-dom';

import useCartSync from '../hooks/useCartSync';
import { isAdmin, useAuthStore } from '../store/auth';

type NavItem = {
  to: string;
  label: string;
  show: boolean;
  end?: boolean;
  badge?: string;
};

const AppLayout = () => {
  const user = useAuthStore((state) => state.user);
  const clear = useAuthStore((state) => state.clear);
  useCartSync();

  const mainClassName = 'responsive-layout py-6 sm:py-8';
  const isAdminUser = Boolean(user && isAdmin(user.role));

  const userInitials =
    user?.name
      ?.split(' ')
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase())
      .slice(0, 2)
      .join('') ?? 'TA';

  const userRoleLabel = user
    ? isAdminUser
      ? 'Temple Admin'
      : 'Donor'
    : 'Guest';

  const headerSubtitle = !user
    ? 'Temple operations portal'
    : isAdminUser
      ? 'Admin command center'
      : 'Donor hub';

  const navItems: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', show: true, end: true },
    { to: '/profile', label: 'Donor Profile', show: Boolean(user && !isAdmin(user.role)) },
    { to: '/admin/master', label: 'Admin', show: Boolean(user && isAdmin(user.role)) },
    { to: '/admin/bulk-upload', label: 'Bulk Upload', show: Boolean(user && isAdmin(user.role)) },
    { to: '/admin/donors', label: 'Donor Details', show: Boolean(user && isAdmin(user.role)) },
    { to: '/pooja/register', label: 'Pooja Registration', show: !isAdminUser },
    { to: '/payments/general', label: 'Payment Page', show: !isAdminUser },
    { to: '/payments/combine', label: 'Combine Payment', show: !isAdminUser },
    {
      to: '/payments/statement',
      label: 'Payment Statement',
      show: Boolean(user),
    },
    { to: '/admin/pooja-details', label: 'Ubhayam Report', show: Boolean(user && isAdmin(user.role)) },
    {
      to: '/reports',
      label: 'Report',
      show: Boolean(user && isAdmin(user.role)),
    },
    {
      to: '/admin/expenses',
      label: 'Expenses',
      show: Boolean(user && isAdmin(user.role)),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HEADER */}
      <header className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 shadow-sm">
        <div className="responsive-layout flex flex-col gap-4 py-3">

            {/* TOP ROW */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* LOGO */}
              <Link to="/" className="flex items-center gap-3 text-left">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg font-semibold text-white shadow-sm">
                  TD
                </span>
                <span>
                  <span className="block text-lg font-semibold text-slate-900">
                    Temple Donor Portal
                  </span>
                  <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                    {headerSubtitle.toUpperCase()}
                  </span>
                </span>
              </Link>

              {/* ACTIONS */}
              <div className="notranslate flex items-center gap-3" translate="no">
                <div className="hidden h-10 w-px bg-slate-200 md:block" />

                <div className="flex items-center gap-3">
                  {/* USER CARD */}
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-600">
                      {userInitials}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-700">
                        {user?.name ?? 'Temple Admin'}
                      </span>
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        {userRoleLabel}
                      </span>
                    </div>
                  </div>

                  {/* LOGOUT BUTTON */}
                  <button
                    type="button"
                    onClick={clear}
                    className="rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-600 hover:to-purple-700"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>

            {/* NAVIGATION */}
            <nav className="flex items-center gap-2 overflow-x-auto rounded-full border border-slate-200 bg-white/85 p-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60">
              {navItems
                .filter((item) => item.show)
                .map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      clsx(
                        'relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition',
                        isActive
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-[0_12px_20px_-14px_rgba(79,70,229,0.6)]'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      )
                    }
                  >
                    {item.label}

                    {/* BADGE */}
                    {item.badge && (
                      <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/90 px-1 text-xs font-semibold text-orange-600 shadow-sm">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                ))}
            </nav>
        </div>
      </header>

      {/* CONTENT */}
      <main className={mainClassName}>
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
