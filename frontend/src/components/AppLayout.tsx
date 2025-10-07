import { Link, NavLink, Outlet } from 'react-router-dom';

import LanguageToggle from './LanguageToggle';
import { isAdmin, useAuthStore } from '../store/auth';
import { useCartStore } from '../store/cart';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-brand-50'}`;

const AppLayout = () => {
  const user = useAuthStore((state) => state.user);
  const clear = useAuthStore((state) => state.clear);
  const cartKey = user ? String(user.id) : 'guest';
  const cartCount = useCartStore((state) => state.itemsByUser[cartKey]?.length ?? 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-xl font-semibold text-brand-700">
            Temple Donor Portal
          </Link>
          <nav className="flex items-center gap-2">
            <NavLink to="/dashboard" className={navLinkClass} end>
              Dashboard
            </NavLink>
            {user && isAdmin(user.role) && (
              <>
                <NavLink to="/admin/master" className={navLinkClass}>
                  Admin
                </NavLink>
                <NavLink to="/admin/donors" className={navLinkClass}>
                  Donor Details
                </NavLink>
                <NavLink to="/admin/donor-pooja-registrations" className={navLinkClass}>
                  Donor Pooja Registrations
                </NavLink>
              </>
            )}
            
            <NavLink to="/pooja/register" className={navLinkClass}>
              Pooja Registration
            </NavLink>

            <NavLink to="/pooja/cart" className={navLinkClass}>
              Cart{cartCount > 0 ? ` (${cartCount})` : ''}
            </NavLink>
          </nav>
          <div className="flex items-center gap-4">
            <LanguageToggle theme="light" />
            <span className="text-sm text-slate-600">{user?.name}</span>
            <button
              type="button"
              onClick={clear}
              className="rounded-md bg-slate-200 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-300"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
