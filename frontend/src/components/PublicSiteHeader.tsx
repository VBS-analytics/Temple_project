import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  { label: 'About Kakkalani Village', href: '/about-kakkalani-village', type: 'route' },
  {
    label: 'About',
    href: '/about',
    type: 'route'
  },
  {
    label: 'About Kovil',
    href: '/kovi-details',
    type: 'route'
  },
  {
    label: 'Why we should visit our village',
    href: '/why-visit-native-village',
    type: 'route'
  }
];

const patronContacts = [
  { name: 'R S Mani', phoneDisplay: '+91 88790 71390', phoneRaw: '+918879071390' },
  { name: 'V Lakshmi Anand', phoneDisplay: '+91 98427 59013', phoneRaw: '+919842759013' },
  { name: 'V Swaminathan', phoneDisplay: '+91 98407 41719', phoneRaw: '+919840741719' }
] as const;

const resolveAnchorTo = (hash: string): To => ({
  pathname: '/',
  hash: hash.startsWith('#') ? hash : `#${hash}`
});

type PublicSiteHeaderProps = {
  variant?: 'overlay' | 'solid';
};

const PublicSiteHeader = ({ variant = 'solid' }: PublicSiteHeaderProps) => {
  const location = useLocation();
  const showLoginCta = location.pathname !== '/login';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [patronDialogOpen, setPatronDialogOpen] = useState(false);
  const handlePatronContactClick = () => {
    setPatronDialogOpen(true);
  };
  const closePatronDialog = () => setPatronDialogOpen(false);
  const headerClass = clsx(
    'z-30',
    variant === 'overlay'
      ? 'absolute inset-x-0 top-0 bg-transparent text-white'
      : 'relative sticky top-0 border-b border-[#90CAF9] bg-[#E3F2FD]/95 text-black shadow-[0_10px_24px_-20px_rgba(21,101,192,0.35)] backdrop-blur'
  );
  const navLinkClass =
    variant === 'overlay'
      ? 'text-white transition hover:text-[#f4ba1a]'
      : 'text-black transition hover:text-[#1565C0]';
  const dropdownClass = variant === 'overlay' ? 'bg-white/95 text-slate-700' : 'bg-white text-black border border-[#90CAF9]';
  const buttonBase =
    variant === 'overlay'
      ? 'bg-[#f06f4a] hover:bg-[#ff8a60]'
      : 'bg-[#E65100] hover:bg-[#F57C00]';

  const brandTextClass =
    variant === 'overlay'
      ? 'text-white/80'
      : 'text-[#1565C0]';

  const resolveLinkTo = (href: string, type: LinkType) => (type === 'route' ? href : resolveAnchorTo(href));
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const isNavItemActive = (item: NavLinkItem) => {
    if (item.type === 'route') {
      return location.pathname === item.href;
    }
    return location.pathname === '/' && (location.hash === item.href || location.hash === '' || location.hash === '#top');
  };
  const toggleButtonBase =
    variant === 'overlay'
      ? 'border-white/40 text-white hover:bg-white/10'
      : 'border-[#90CAF9] text-[#1565C0] hover:bg-white/80';
  const donateButtonClass =
    variant === 'overlay'
      ? 'rounded-full bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-red-700 transition hover:bg-amber-100'
      : 'rounded-full bg-[#E65100] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-[#F57C00]';
  const patronButtonClass =
    variant === 'overlay'
      ? 'rounded-full border border-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white/10'
      : 'rounded-full border border-[#1565C0] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#1565C0] transition hover:bg-blue-50';

  useEffect(() => {
    if (!mobileMenuOpen && !patronDialogOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen, patronDialogOpen]);

  useEffect(() => {
    // Close overlays after any route/hash navigation.
    setMobileMenuOpen(false);
    setPatronDialogOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!patronDialogOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPatronDialogOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [patronDialogOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
                            className="block rounded-lg px-3 py-2 transition hover:bg-blue-50 hover:text-blue-900"
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
            <a
              href="/donation"
              target="_blank"
              rel="noopener noreferrer"
              className={donateButtonClass}
            >
              Donate Now
            </a>
            <button
              type="button"
              onClick={handlePatronContactClick}
              className={patronButtonClass}
            >
              Contact to Become a Patron
            </button>
          </nav>
        </div>

          <div className="flex flex-shrink-0 items-center gap-3">
            <div className="hidden min-w-[98px] items-center justify-end sm:flex">
              {showLoginCta && (
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
          <div className="absolute inset-y-0 right-0 flex h-[100dvh] w-full flex-col bg-white text-black shadow-2xl sm:max-w-sm">
            <div className="flex items-center justify-between border-b border-[#90CAF9] px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#1565C0]">Kakkalani Gramam</p>
              </div>
              <button
                type="button"
                onClick={closeMobileMenu}
                className="rounded-full border border-[#90CAF9] p-2 text-[#1565C0] transition hover:bg-blue-50"
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
            <nav className="flex-1 overflow-y-auto px-4 py-4">
              <ul className="space-y-2">
                {navLinks.map((item) => {
                  const toValue = resolveLinkTo(item.href, item.type);
                  return (
                    <li key={item.label}>
                      <Link
                        to={toValue}
                        onClick={closeMobileMenu}
                        className={clsx(
                          'block w-full rounded-xl border px-4 py-3 text-sm font-semibold text-black transition',
                          isNavItemActive(item)
                            ? 'border-[#90CAF9] bg-blue-50 text-[#1565C0]'
                            : 'border-blue-100 bg-white hover:border-[#90CAF9] hover:bg-blue-50/70'
                        )}
                        aria-current={isNavItemActive(item) ? 'page' : undefined}
                      >
                        {item.label}
                      </Link>
                      {item.children && (
                        <ul className="mt-2 space-y-1 rounded-xl border border-blue-100 bg-blue-50/50 p-2 text-sm font-medium">
                          {item.children.map((child) => {
                            const childTo = resolveLinkTo(child.href, child.type);
                            return (
                              <li key={child.label}>
                                <Link
                                  to={childTo}
                                  onClick={closeMobileMenu}
                                  className="block rounded-lg px-3 py-2 text-black transition hover:bg-white"
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
              <div className="mt-8 space-y-3">
                <a
                  href="/donation"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeMobileMenu}
                  className="block w-full rounded-full bg-[#E65100] px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#F57C00]"
                >
                  Donate Now
                </a>
                <button
                  type="button"
                  onClick={() => {
                    closeMobileMenu();
                    handlePatronContactClick();
                  }}
                  className="block w-full rounded-full border border-[#1565C0] px-4 py-3 text-center text-sm font-semibold text-[#1565C0] transition hover:bg-blue-50"
                >
                  Contact to Become a Patron
                </button>
                {showLoginCta && (
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
                )}
              </div>
            </nav>
          </div>
        </div>
      )}

      {patronDialogOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] overflow-y-auto bg-slate-900/55 px-4 py-6 backdrop-blur-sm sm:px-6 sm:py-10"
            role="dialog"
            aria-modal="true"
            aria-labelledby="patron-contact-title"
            aria-describedby="patron-contact-description"
            onClick={closePatronDialog}
          >
            <div className="flex min-h-full items-start justify-center sm:items-center">
              <div
                className="relative w-full max-w-md max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-2xl border border-[#90CAF9] bg-white p-5 shadow-[0_30px_80px_-30px_rgba(21,101,192,0.55)] sm:max-h-[calc(100dvh-5rem)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#1565C0] via-[#1976D2] to-[#1565C0]" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-[#1565C0]">
                      Contact to Become a Patron
                    </p>
                    <h2 id="patron-contact-title" className="mt-1 text-xl font-semibold text-black">
                      Patron Contact Details
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={closePatronDialog}
                    className="rounded-full border border-[#EF9A9A] p-2 text-[#C62828] transition hover:bg-[#FFEBEE] hover:text-[#B71C1C]"
                    aria-label="Close patron popup"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>

                <p id="patron-contact-description" className="mt-2 text-sm text-black">
                  Please call any coordinator below for patron enrollment details.
                </p>

                <div className="mt-4 space-y-3">
                  {patronContacts.map((contact) => (
                    <a
                      key={contact.phoneRaw}
                      href={`tel:${contact.phoneRaw}`}
                      className="group flex items-center justify-between rounded-xl border border-blue-100 bg-white px-4 py-3 transition hover:border-[#90CAF9]"
                    >
                      <div>
                        <p className="text-sm font-semibold text-black">{contact.name}</p>
                        <p className="text-sm text-black">{contact.phoneDisplay}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#2E7D32]/35 bg-[#E8F5E9] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#2E7D32] transition group-hover:bg-[#C8E6C9]">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M2 4.5A2.5 2.5 0 014.5 2h1.707a1 1 0 01.95.684l1.2 3.6a1 1 0 01-.24 1.022l-1.27 1.27a11.042 11.042 0 004.848 4.848l1.27-1.27a1 1 0 011.022-.24l3.6 1.2a1 1 0 01.684.95V15.5A2.5 2.5 0 0115.5 18h-1C7.596 18 2 12.404 2 5.5v-1z" />
                        </svg>
                        Call
                      </span>
                    </a>
                  ))}
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={closePatronDialog}
                    className="rounded-full bg-[#C62828] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#B71C1C]"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
};

export default PublicSiteHeader;
