import clsx from 'clsx';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import LanguageToggle from './LanguageToggle';
import { isAdmin, useAuthStore } from '../store/auth';
import { useCartStore } from '../store/cart';

type NavItem = {
  to: string;
  label: string;
  show: boolean;
  end?: boolean;
  badge?: string;
};

const AppLayout = () => {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const clear = useAuthStore((state) => state.clear);
  const cartKey = user ? String(user.id) : 'guest';
  const cartCount = useCartStore((state) => state.itemsByUser[cartKey]?.length ?? 0);
  const isPoojaRegistrationPage = location.pathname.startsWith('/pooja/register');
  const mainClassName = isPoojaRegistrationPage
    ? 'w-full px-4 py-6'
    : 'mx-auto w-full max-w-6xl px-4 py-6';
  const userInitials = user?.name
    ?.split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join('') ?? 'TA';
  const userRoleLabel = user ? (isAdmin(user.role) ? 'Temple Admin' : 'Donor') : 'Guest';
  const headerSubtitle = !user
    ? 'Temple operations portal'
    : isAdmin(user.role)
      ? 'Admin command center'
      : 'Donor hub';

  const navItems: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', show: true, end: true },
    { to: '/profile', label: 'Donor Profile', show: Boolean(user && !isAdmin(user.role)) },
    { to: '/admin/master', label: 'Admin', show: Boolean(user && isAdmin(user.role)) },
    { to: '/admin/donors', label: 'Donor Details', show: Boolean(user && isAdmin(user.role)) },
    { to: '/admin/pooja-details', label: 'Pooja Details', show: Boolean(user && isAdmin(user.role)) },
    { to: '/pooja/register', label: 'Pooja Registration', show: true },
    {
      to: '/pooja/cart',
      label: 'Cart',
      show: true,
      badge: cartCount > 0 ? String(cartCount) : undefined
    }
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-gradient-to-r from-brand-50 via-white to-brand-50/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Link to="/" className="flex items-center gap-3 text-left">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-lg font-semibold text-white shadow-sm">
                  TD
                </span>
                <span>
                  <span className="block text-lg font-semibold text-slate-900">Temple Donor Portal</span>
                  <span className="block text-xs font-medium uppercase tracking-wide text-brand-600">
                    {headerSubtitle.toUpperCase()}
                  </span>
                </span>
              </Link>
              <div className="flex items-center gap-3">
                <LanguageToggle theme="light" />
                <div className="hidden h-10 w-px bg-slate-200 md:block" />
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-full border border-brand-100 bg-white px-3 py-1.5 shadow-sm">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                      {userInitials}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-700">{user?.name ?? 'Temple Admin'}</span>
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{userRoleLabel}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clear}
                    className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
            <nav className="flex items-center gap-2 overflow-x-auto rounded-full border border-brand-100 bg-white/85 p-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60">
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
                          ? 'bg-brand-600 text-white shadow-[0_12px_20px_-14px_rgba(55,48,163,0.9)]'
                          : 'text-slate-600 hover:bg-brand-50/80 hover:text-brand-600'
                      )
                    }
                  >
                    {item.label}
                    {item.badge && (
                      <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/90 px-1 text-xs font-semibold text-brand-600 shadow-sm">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                ))}
            </nav>
          </div>
        </div>
      </header>
      <main className={mainClassName}>
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
