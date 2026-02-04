import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { Link, To, useLocation } from 'react-router-dom';


type LinkType = 'anchor' | 'route';

type NavLinkItem = {
  label: string;
  href: string;
  type: LinkType;
  children?: Array<{ label: string; href: string; type: LinkType }>;
};

const navLinks: NavLinkItem[] = [
  { label: 'Home', href: '#top', type: 'anchor' },
  { label: 'History of Kakkalani', href: '/history', type: 'route' },
  {
    label: 'Why we should visit our village',
    href: '/why-visit-native-village',
    type: 'route'
  },
  { label: 'About Kakkalani Village', href: '/about-kakkalani-village', type: 'route' },
  {
    label: 'About',
    href: '/about',
    type: 'route',
    children: [
      { label: 'Founder Members', href: '/about#founder-members', type: 'route' },
      { label: 'Committee Members', href: '/about#committee-members', type: 'route' },
      { label: 'Family Tree', href: '/about#family-tree', type: 'route' }
    ]
  }
];

const resolveAnchorTo = (hash: string): To => ({
  pathname: '/',
  hash: hash.startsWith('#') ? hash : `#${hash}`
});

type PublicSiteHeaderProps = {
  variant?: 'overlay' | 'solid';
};

const PublicSiteHeader = ({ variant = 'solid' }: PublicSiteHeaderProps) => {
  const location = useLocation();
  const showAuthCtas = location.pathname !== '/login' && location.pathname !== '/register';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerClass = clsx(
    'z-30',
    variant === 'overlay'
      ? 'absolute inset-x-0 top-0 bg-transparent text-white'
      : 'relative sticky top-0 border-b border-slate-200 bg-white/90 text-slate-900 backdrop-blur supports-[backdrop-filter]:bg-white/75'
  );
  const navLinkClass =
    variant === 'overlay'
      ? 'text-white transition hover:text-[#f4ba1a]'
      : 'text-slate-700 transition hover:text-green-600';
  const dropdownClass = variant === 'overlay' ? 'bg-white/95 text-slate-700' : 'bg-white text-slate-700';
  const buttonBase =
    variant === 'overlay'
      ? 'bg-[#f06f4a] hover:bg-[#ff8a60]'
      : 'bg-green-600 hover:bg-green-700';

  const brandTextClass =
    variant === 'overlay'
      ? 'text-white/80'
      : 'text-slate-900/70';

  const resolveLinkTo = (href: string, type: LinkType) => (type === 'route' ? href : resolveAnchorTo(href));
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const toggleButtonBase =
    variant === 'overlay'
      ? 'border-white/40 text-white hover:bg-white/10'
      : 'border-slate-300 text-slate-700 hover:bg-slate-100';

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  return (
    <header className={headerClass}>
      <div className="responsive-layout flex items-center justify-between gap-4 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-4 md:gap-8">
          <Link to="/" className={clsx('min-w-0 flex-shrink text-left', brandTextClass)}>
            <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] sm:text-sm sm:tracking-[0.24em]">
              Kakkalani Gramam
            </p>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-6 text-sm font-semibold md:flex">
            {navLinks.map((item) => {
              if (item.children?.length) {
                return (
                  <div key={item.label} className="group relative">
                    <Link
                      to={item.href}
                      className={clsx('flex items-center gap-1', navLinkClass)}
                      aria-haspopup="true"
                    >
                      {item.label}
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 12 12"
                        className="h-3 w-3 transition-transform group-hover:translate-y-px"
                        fill="currentColor"
                      >
                        <path d="M2.4 4.2a.6.6 0 0 1 .85-.1L6 6.3l2.75-2.2a.6.6 0 1 1 .75.95l-3.1 2.5a.6.6 0 0 1-.75 0l-3.1-2.5a.6.6 0 0 1-.15-.85Z" />
                      </svg>
                    </Link>
                    <div
                      className={clsx(
                        'invisible absolute left-0 top-full z-10 mt-3 w-56 translate-y-2 rounded-xl p-2 text-sm shadow-lg ring-1 ring-slate-900/5 opacity-0 transition-all duration-150',
                        dropdownClass,
                        'group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100'
                      )}
                    >
                      {item.children.map((child) => {
                        const toValue =
                          child.type === 'route'
                            ? child.href
                            : resolveAnchorTo(child.href);
                        return (
                          <Link
                            key={child.label}
                            to={toValue}
                            className="block rounded-lg px-3 py-2 transition hover:bg-indigo-50 hover:text-indigo-900"
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              if (item.type === 'route') {
                return (
                  <Link key={item.label} to={item.href} className={navLinkClass}>
                    {item.label}
                  </Link>
                );
              }

              return (
                <Link key={item.label} to={resolveAnchorTo(item.href)} className={navLinkClass}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

          <div className="flex flex-shrink-0 items-center gap-3">
            <div className="hidden items-center gap-3 sm:flex">
              {showAuthCtas && (
                <>
                  <Link
                    to="/login"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={clsx(
                      'rounded-full px-4 py-2 text-sm font-semibold text-white transition',
                      buttonBase
                    )}
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={clsx(
                      'rounded-full px-4 py-2 text-sm font-semibold text-white transition',
                      buttonBase
                    )}
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className={clsx(
                'inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition md:hidden',
                toggleButtonBase
              )}
              aria-label="Open menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0" onClick={closeMobileMenu} />
          <div className="absolute inset-y-0 right-0 flex h-full w-full max-w-sm flex-col bg-white text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Kakkalani Gramam</p>
              </div>
              <button
                type="button"
                onClick={closeMobileMenu}
                className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
                aria-label="Close menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-6 py-6">
              <ul className="space-y-4 text-base font-semibold text-slate-800">
                {navLinks.map((item) => {
                  const toValue = resolveLinkTo(item.href, item.type);
                  return (
                    <li key={item.label} className="space-y-3">
                      <Link
                        to={toValue}
                        onClick={closeMobileMenu}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-slate-300"
                      >
                        <span>{item.label}</span>
                        {item.children && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 text-slate-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </Link>
                      {item.children && (
                        <ul className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-sm font-medium">
                          {item.children.map((child) => {
                            const childTo = resolveLinkTo(child.href, child.type);
                            return (
                              <li key={child.label}>
                                <Link
                                  to={childTo}
                                  onClick={closeMobileMenu}
                                  className="block rounded-xl px-3 py-2 text-slate-600 transition hover:bg-white"
                                >
                                  {child.label}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
              {showAuthCtas && (
                <div className="mt-8 space-y-3">
                  <Link
                    to="/login"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={closeMobileMenu}
                    className={clsx(
                      'block w-full rounded-full px-4 py-3 text-center text-sm font-semibold text-white transition',
                      buttonBase
                    )}
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={closeMobileMenu}
                    className={clsx(
                      'block w-full rounded-full px-4 py-3 text-center text-sm font-semibold text-white transition',
                      buttonBase
                    )}
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};

export default PublicSiteHeader;
