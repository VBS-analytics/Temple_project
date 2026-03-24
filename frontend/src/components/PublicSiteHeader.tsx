import clsx from 'clsx';
import { MouseEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, To, useLocation } from 'react-router-dom';


type LinkType = 'anchor' | 'route';

type NavLinkItem = {
  label: string;
  href: string;
  type: LinkType;
  children?: Array<{ label: string; href: string; type: LinkType }>;
};

const baseNavLinks: NavLinkItem[] = [
  { label: 'HOME', href: '/', type: 'route' },
  {
    label: 'SIGNIFICANCE OF KAKKALANI VILLAGE',
    href: '#significance-of-kakkalani-village',
    type: 'anchor'
  },
  {
    label: 'KAKKALANI TEMPLES',
    href: '/kovi-details',
    type: 'route'
  },
  {
    label: 'WHY WE SHOULD VISIT OUR VILLAGE',
    href: '/why-visit-native-village',
    type: 'route'
  }
];

const loginPageNavLinks: NavLinkItem[] = [
  { label: 'LOGIN PAGE', href: '/login', type: 'route' },
  {
    label: 'ABOUT US',
    href: '/about',
    type: 'route',
  },
  {
    label: 'SIGNIFICANCE OF KAKKALANI VILLAGE',
    href: '#significance-of-kakkalani-village',
    type: 'anchor',
  },
  {
    label: 'KAKKALANI TEMPLES',
    href: '/kovi-details',
    type: 'route',
  },
  {
    label: 'WHY WE SHOULD VISIT OUR VILLAGE',
    href: '/why-visit-native-village',
    type: 'route',
  },
];

const LOGIN_NAV_QUERY_KEY = 'nav';
const LOGIN_NAV_QUERY_VALUE = 'login';
const PATRON_CONTACTS = [
  { name: 'R S Mani', phoneDisplay: '+91 88790 71390', phoneE164: '+918879071390' },
  { name: 'V Lakshmi Anand', phoneDisplay: '+91 98427 59013', phoneE164: '+919842759013' },
  { name: 'V Swaminathan', phoneDisplay: '+91 98407 41719', phoneE164: '+919840741719' },
];

const resolveAnchorTo = (hash: string, includeLoginContext = false): To => ({
  pathname: '/',
  search: includeLoginContext ? `?${LOGIN_NAV_QUERY_KEY}=${LOGIN_NAV_QUERY_VALUE}` : '',
  hash: hash.startsWith('#') ? hash : `#${hash}`
});

type PublicSiteHeaderProps = {
  variant?: 'overlay' | 'solid' | 'amber';
  templeWallBorder?: boolean;
  navLinkWeight?: 'bold' | 'semibold';
};

const PublicSiteHeader = ({
  variant = 'solid',
  templeWallBorder = true,
  navLinkWeight,
}: PublicSiteHeaderProps) => {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const loginFlowContext = new URLSearchParams(location.search).get(LOGIN_NAV_QUERY_KEY) === LOGIN_NAV_QUERY_VALUE;
  const useLoginFlowHeaderLinks = isLoginPage || loginFlowContext;
  const effectiveNavLinkWeight = navLinkWeight ?? (useLoginFlowHeaderLinks ? 'semibold' : 'bold');
  const navLinks = useLoginFlowHeaderLinks ? loginPageNavLinks : baseNavLinks;
  const showLoginMarketingLinks = useLoginFlowHeaderLinks;
  const visibleNavLinks =
    location.pathname === '/' ? navLinks.filter((item) => !(item.type === 'route' && item.href === '/')) : navLinks;
  const mobileNavLinks = visibleNavLinks.length > 0 ? visibleNavLinks : navLinks;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [patronDialogOpen, setPatronDialogOpen] = useState(false);
  const headerClass = clsx(
    'z-30',
    variant === 'overlay'
      ? 'absolute inset-x-0 top-0 bg-transparent text-white'
      : variant === 'amber'
      ? 'relative sticky top-0 border-b border-[#efd9cf] bg-[#f7f1e6]/95 text-black shadow-[0_10px_24px_-20px_rgba(126,42,32,0.28)] backdrop-blur'
      : 'relative sticky top-0 border-b border-[#90CAF9] bg-[#E3F2FD]/95 text-black shadow-[0_10px_24px_-20px_rgba(21,101,192,0.35)] backdrop-blur'
  );
  const navWeightClass = effectiveNavLinkWeight === 'semibold' ? 'font-semibold' : 'font-bold';
  const navLinkClass =
    variant === 'overlay'
      ? `${navWeightClass} text-white transition hover:text-[#f4ba1a]`
      : variant === 'amber'
      ? `${navWeightClass} text-black transition hover:text-[#7e2a20]`
      : `${navWeightClass} text-black transition hover:text-[#1565C0]`;
  const dropdownClass =
    variant === 'overlay'
      ? 'bg-white/95 text-slate-700'
      : variant === 'amber'
      ? 'bg-[#fffdf8] text-[#5f4636] border border-[#efd9cf]'
      : 'bg-white text-black border border-[#90CAF9]';
  const brandTextClass =
    variant === 'overlay'
      ? 'text-white/80'
      : variant === 'amber'
      ? 'text-[#7e2a20]'
      : 'text-[#1565C0]';

  const appendLoginContextToPath = (href: string) => {
    if (!useLoginFlowHeaderLinks) {
      return href;
    }
    const [pathWithQuery, hash = ''] = href.split('#');
    const [pathname, query = ''] = pathWithQuery.split('?');
    const params = new URLSearchParams(query);
    params.set(LOGIN_NAV_QUERY_KEY, LOGIN_NAV_QUERY_VALUE);
    const search = params.toString();
    return `${pathname}${search ? `?${search}` : ''}${hash ? `#${hash}` : ''}`;
  };
  const resolveLinkTo = (href: string, type: LinkType) =>
    type === 'route' ? appendLoginContextToPath(href) : resolveAnchorTo(href, useLoginFlowHeaderLinks);
  const scrollToAnchorSection = (hash: string) => {
    const id = hash.replace(/^#/, '');
    const section = document.getElementById(id);
    if (!section) return;

    const headerOffset = 110;
    const targetY = section.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top: Math.max(targetY, 0), behavior: 'smooth' });
    window.history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
  };
  const handleAnchorClick = (event: MouseEvent<HTMLAnchorElement>, hash: string) => {
    if (location.pathname !== '/') return;
    event.preventDefault();
    scrollToAnchorSection(hash);
  };
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const openPatronDialog = () => {
    setPatronDialogOpen(true);
  };
  const closePatronDialog = () => {
    setPatronDialogOpen(false);
  };
  const isNavItemActive = (item: NavLinkItem) => {
    if (item.type === 'route') {
      return location.pathname === item.href;
    }
    return location.pathname === '/' && (location.hash === item.href || location.hash === '' || location.hash === '#top');
  };
  const toggleButtonBase =
    variant === 'overlay'
      ? 'border-white/40 text-white hover:bg-white/10'
      : variant === 'amber'
      ? 'border-[#efd9cf] text-[#a33a2b] hover:bg-[#fff7f3]/80'
      : 'border-[#90CAF9] text-[#1565C0] hover:bg-white/80';
  const donateButtonClass =
    variant === 'overlay'
      ? 'text-xs font-semibold uppercase tracking-wide text-white transition hover:text-white/80'
      : variant === 'amber'
      ? 'text-xs font-semibold uppercase tracking-wide text-black transition hover:text-[#7e2a20]'
      : 'text-xs font-semibold uppercase tracking-wide text-black transition hover:text-[#1976D2]';
  const patronButtonClass =
    variant === 'overlay'
      ? 'text-xs font-semibold uppercase tracking-wide text-white transition hover:text-[#ffd8c2]'
      : variant === 'amber'
      ? 'text-xs font-semibold uppercase tracking-wide text-[#b64a1f] transition hover:text-[#8f3118]'
      : 'text-xs font-semibold uppercase tracking-wide text-[#1565C0] transition hover:text-[#0d47a1]';
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

  useEffect(() => {
    // Close overlays after any route/hash navigation.
    setMobileMenuOpen(false);
    setPatronDialogOpen(false);
  }, [location.pathname, location.hash]);

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
          <Link to={resolveLinkTo('/', 'route')} className={clsx('min-w-0 flex-shrink text-left', brandTextClass)}>
            <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] sm:text-sm sm:tracking-[0.24em]">
              Kakkalani Village
            </p>
          </Link>

          <nav className={clsx(
            "hidden flex-1 items-center justify-center text-xs tracking-wide md:flex",
            templeWallBorder ? "gap-7" : "gap-6"
          )}>
            {visibleNavLinks.map((item) => {
              if (item.children?.length) {
                const parentTo = resolveLinkTo(item.href, item.type);
                return (
                  <div key={item.label} className="group relative">
                    <Link
                      to={parentTo}
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
                        const toValue = resolveLinkTo(child.href, child.type);
                        return (
                          <Link
                            key={child.label}
                            to={toValue}
                            className={clsx(
                              "block rounded-lg px-3 py-2 transition",
                              variant === 'amber'
                                ? "hover:bg-[#f8eee2] hover:text-[#7e2a20]"
                                : "hover:bg-blue-50 hover:text-blue-900"
                            )}
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
                const routeTo = resolveLinkTo(item.href, item.type);
                return (
                  <Link
                    key={item.label}
                    to={routeTo}
                    className={navLinkClass}
                  >
                    {item.label}
                  </Link>
                );
              }

              return (
                <Link
                  key={item.label}
                  to={resolveLinkTo(item.href, item.type)}
                  onClick={(event) => handleAnchorClick(event, item.href)}
                  className={navLinkClass}
                >
                  {item.label}
                </Link>
              );
            })}
            {showLoginMarketingLinks && (
              <>
                <Link to={resolveLinkTo('/donation', 'route')} className={donateButtonClass}>
                  Donate Now
                </Link>
                <button
                  type="button"
                  onClick={openPatronDialog}
                  className={clsx('rounded-full border-0 bg-transparent px-1 py-0.5', patronButtonClass)}
                >
                  Contact to Become a Patron
                </button>
              </>
            )}
          </nav>
        </div>

          <div className="flex flex-shrink-0 items-center gap-3">
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
      {templeWallBorder && (
        <div
          aria-hidden="true"
          className="h-[6px] w-full border-y border-[#efd9cf]"
          style={{
            background:
              'repeating-linear-gradient(90deg, #a33a2b 0 8px, #fffdf8 8px 16px)',
          }}
        />
      )}

      {mobileMenuOpen &&
        createPortal(
          <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm md:hidden" role="dialog" aria-modal="true">
            <div className="absolute inset-0" onClick={closeMobileMenu} />
            <div
              className="absolute right-0 z-[81] flex w-full flex-col text-black shadow-2xl sm:max-w-sm"
              style={{
                top: 0,
                bottom: 0,
                height: '100dvh',
                minHeight: '100vh',
                backgroundColor: variant === 'amber' ? '#fffdf8' : '#ffffff',
              }}
            >
              <div className={clsx("flex items-center justify-between border-b px-6 py-4", variant === 'amber' ? "border-[#efd9cf]" : "border-[#90CAF9]")}>
                <div>
                  <p className={clsx("text-xs font-semibold uppercase tracking-[0.3em]", variant === 'amber' ? "text-[#7e2a20]" : "text-[#1565C0]")}>Kakkalani Gramam</p>
                </div>
                <button
                  type="button"
                  onClick={closeMobileMenu}
                  className={clsx("rounded-full border p-2 transition", variant === 'amber' ? "border-[#efd9cf] text-[#a33a2b] hover:bg-[#f8eee2]" : "border-[#90CAF9] text-[#1565C0] hover:bg-blue-50")}
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
              <nav className="relative z-10 flex-1 overflow-y-auto px-4 py-4">
                <ul className="space-y-2">
                  {mobileNavLinks.map((item) => {
                    const toValue = resolveLinkTo(item.href, item.type);
                    return (
                      <li key={item.label}>
                        <Link
                          to={toValue}
                          onClick={(event) => {
                            if (item.type === 'anchor') {
                              handleAnchorClick(event, item.href);
                            }
                            closeMobileMenu();
                          }}
                          className={clsx(
                            'block w-full rounded-xl border px-4 py-3 text-sm font-semibold text-black transition',
                            isNavItemActive(item)
                              ? variant === 'amber'
                                ? 'border-[#efd9cf] bg-[#f8eee2] text-[#a33a2b]'
                                : 'border-[#90CAF9] bg-blue-50 text-[#1565C0]'
                              : variant === 'amber'
                                ? 'border-[#efd9cf] bg-white hover:border-[#a33a2b] hover:bg-[#f8eee2]'
                                : 'border-blue-100 bg-white hover:border-[#90CAF9] hover:bg-blue-50/70'
                          )}
                          aria-current={isNavItemActive(item) ? 'page' : undefined}
                        >
                          {item.label}
                        </Link>
                        {item.children && (
                          <ul className={clsx(
                            "mt-2 space-y-1 rounded-xl p-2 text-sm font-medium",
                            variant === 'amber'
                              ? "border border-[#efd9cf] bg-[#f8eee2]/60"
                              : "border border-blue-100 bg-blue-50/50"
                          )}>
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
                {showLoginMarketingLinks && (
                  <div className="mt-8 space-y-3">
                    <Link
                      to={resolveLinkTo('/donation', 'route')}
                      onClick={closeMobileMenu}
                      className={clsx(
                        "block w-full text-center text-sm font-semibold transition",
                        variant === 'amber'
                          ? "py-2 text-black hover:text-[#7e2a20]"
                          : variant === 'overlay'
                          ? "py-2 text-white hover:text-white/80"
                          : "py-2 text-black hover:text-[#1976D2]"
                      )}
                    >
                      Donate Now
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        closeMobileMenu();
                        openPatronDialog();
                      }}
                      className={clsx(
                        "block w-full rounded-full border-0 bg-transparent text-center text-sm font-semibold transition",
                        variant === 'amber'
                          ? "py-2 text-[#b64a1f] hover:text-[#8f3118]"
                          : variant === 'overlay'
                          ? "py-2 text-white hover:text-[#ffd8c2]"
                          : "py-2 text-[#1565C0] hover:text-[#0d47a1]"
                      )}
                    >
                      Contact to Become a Patron
                    </button>
                  </div>
                )}
              </nav>
            </div>
          </div>,
          document.body
        )}
      {patronDialogOpen &&
        createPortal(
          <div className="fixed inset-0 z-[90] bg-[#2b140f]/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Patron contact details">
            <div className="absolute inset-0" onClick={closePatronDialog} />
            <div className="relative mx-auto mt-16 w-full max-w-md rounded-2xl border border-[#f0d2a8] bg-[#fffaf3] p-5 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b64a1f]">Contact to Become a Patron</p>
                  <h3 className="mt-1 text-xl font-bold text-[#3c2419]">Patron Contact Details</h3>
                </div>
                <button
                  type="button"
                  onClick={closePatronDialog}
                  className="rounded-full border border-[#f0d2a8] p-2 text-[#b64a1f] transition hover:bg-[#fff1df]"
                  aria-label="Close patron contact dialog"
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

              <p className="mb-4 text-sm font-semibold text-[#5f4636]">
                Please call any coordinator below for patron enrollment details.
              </p>

              <div className="space-y-3">
                {PATRON_CONTACTS.map((contact) => (
                  <div
                    key={contact.phoneE164}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#f0d2a8] bg-[#fffefd] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-[#3c2419]">{contact.name}</p>
                      <p className="text-sm font-semibold text-[#6b4f3b]">{contact.phoneDisplay}</p>
                    </div>
                    <a
                      href={`tel:${contact.phoneE164}`}
                      className="rounded-full border border-[#c85b2e] bg-[#c85b2e] px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-[#a94722]"
                    >
                      Call
                    </a>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={closePatronDialog}
                  className="rounded-full bg-gradient-to-r from-[#c85b2e] to-[#a33a2b] px-5 py-1.5 text-sm font-semibold text-white transition hover:brightness-95"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
};

export default PublicSiteHeader;
