import { useEffect } from "react";

import clsx from "clsx";
import { Link, NavLink, Outlet } from "react-router-dom";

import useCartSync from "../hooks/useCartSync";
import useSessionTimeout from "../hooks/useSessionTimeout";
import SessionExpiryPrompt from "./SessionExpiryPrompt";
import { canViewPaymentStatement, isAdmin, isReadOnlyAdmin, useAuthStore } from "../store/auth";
import { useCombineAccessStore } from "../store/combineAccess";

type NavItem = {
  to: string;
  label: string;
  show: boolean;
  end?: boolean;
  badge?: string;
};

const formatCountdown = (ms: number) => {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const AppLayout = () => {
  const user = useAuthStore((state) => state.user);
  const clear = useAuthStore((state) => state.clear);
  useCartSync();
  const sessionTimeout = useSessionTimeout();

  const { canCombine, fetchAccess, resetAccess } = useCombineAccessStore(
    (state) => ({
      canCombine: state.canCombine,
      fetchAccess: state.fetchAccess,
      resetAccess: state.resetAccess,
    }),
  );

  const mainClassName = "responsive-layout py-6 sm:py-8";
  const isAdminUser = Boolean(user && isAdmin(user.role));
  const readOnlyAdmin = isReadOnlyAdmin(user);

  const userInitials =
    user?.name
      ?.split(" ")
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase())
      .slice(0, 2)
      .join("") ?? "TA";

  const userRoleLabel = user
    ? isAdminUser
      ? readOnlyAdmin
        ? "Temple Admin (Read Only)"
        : "Temple Admin"
      : "Donor"
    : "Guest";

  const headerSubtitle = !user
    ? "Temple operations portal"
    : isAdminUser
      ? "Admin command center"
      : "Donor hub";
  const navTopStripColor = "#1565C0";
  const navMenuRowColor = "#1976D2";
  const navInactiveClass = "text-white hover:bg-[#1565C0] hover:text-white";
  const userChipBgColor = "#0F56A8";

  const adminNavItems: NavItem[] = [
    { to: "/admin/dashboard", label: "Dashboard", show: false, end: true },
    {
      to: "/admin/master",
      label: "Admin Master",
      show: Boolean(user && isAdmin(user.role)),
    },
    {
      to: "/profile/pooja-seva",
      label: "Pooja Seva",
      show: Boolean(user && isAdmin(user.role)),
    },
    {
      to: "/profile/cow-samrakshana-seva",
      label: "Cow Samrakshana Seva",
      show: Boolean(user && isAdmin(user.role)),
    },
    {
      to: "/admin/donors",
      label: "Donor Details",
      show: Boolean(user && isAdmin(user.role)),
    },
    {
      to: "/admin/combine-payment-donor",
      label: "Combine Payment - Donor",
      show: Boolean(user && isAdmin(user.role)),
    },
    {
      to: "/admin/pooja-pause-cancel",
      label: "Pooja - Pause/Cancel",
      show: Boolean(user && isAdmin(user.role)),
    },
    {
      to: "/admin/pooja-details",
      label: "Ubhayam Report",
      show: Boolean(user && isAdmin(user.role)),
    },
    {
      to: "/admin/donor-pooja-details",
      label: "Donor Pooja Details",
      show: Boolean(user && isAdmin(user.role)),
    },
    {
      to: "/reports",
      label: "Reports",
      show: Boolean(user && isAdmin(user.role)),
    },
    {
      to: "/admin/expenses",
      label: "Expense Tracker",
      show: Boolean(user && isAdmin(user.role)),
    },
    {
      to: "/payments/statement",
      label: "Payment Statement",
      show: canViewPaymentStatement(user),
    },
  ];

  const donorNavItems: NavItem[] = [
    {
      to: "/profile",
      label: "Donor Profile",
      show: Boolean(user && !isAdmin(user.role)),
      end: true,
    },
    {
      to: "/profile/donor-corner",
      label: "Donor Corner",
      show: Boolean(user && !isAdmin(user.role)),
    },
    {
      to: "/profile/cow-samrakshana-seva",
      label: "Cow Samrakshana Seva",
      show: Boolean(user),
    },
    {
      to: "/profile/pooja-seva",
      label: "Pooja Seva",
      show: Boolean(user),
    },
    {
      to: "/profile/ubhayam-report",
      label: "Ubhayam Report",
      show: Boolean(user && !isAdmin(user.role)),
    },
    { to: "/pooja/register", label: "Pooja Registration", show: !isAdminUser },
    {
      to: "/payments/general",
      label: "Payment Page",
      show: !isAdminUser && canCombine !== true,
    },
    {
      to: "/payments/combine",
      label: "Combine Payment",
      show: !isAdminUser && canCombine === true,
    },
    {
      to: "/payments/statement",
      label: "Payment Statement",
      show: canViewPaymentStatement(user),
    },
  ];

  const navItems = isAdminUser ? adminNavItems : donorNavItems;

  useEffect(() => {
    if (!user || isAdminUser) {
      resetAccess();
      return;
    }
    if (canCombine === null) {
      fetchAccess();
    }
  }, [user?.id, isAdminUser, canCombine, fetchAccess, resetAccess]);

  return (
    <div className="min-h-screen bg-slate-50">
      <SessionExpiryPrompt {...sessionTimeout} />
      {/* HEADER */}
      <header className="border-b shadow-sm" style={{ borderColor: navMenuRowColor }}>
        <div style={{ backgroundColor: navTopStripColor }}>
          <div className="responsive-layout py-3">
            {/* TOP ROW */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* LOGO */}
              <Link to="/" className="flex items-center gap-3 text-left">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5C518] text-lg font-bold text-[#000000] shadow-sm">
                  TD
                </span>
                <span>
                  <span className="block text-lg font-semibold text-white">
                    Temple Donor Portal
                  </span>
                  <span
                    className="block text-xs font-semibold uppercase tracking-[0.16em]"
                    style={{ color: isAdminUser ? "#F5C518" : "#BBDEFB" }}
                  >
                    {headerSubtitle.toUpperCase()}
                  </span>
                </span>
              </Link>

              {/* ACTIONS */}
              <div className="notranslate flex items-center gap-3" translate="no">
                <div className="hidden h-10 w-px bg-[#F5C518]/35 md:block" />

                <div className="flex items-center gap-3">
                  {/* USER CARD */}
                  <div
                    className="flex items-center gap-2 rounded-full border border-[#F5C518]/30 px-3 py-1.5 shadow-sm"
                    style={{ backgroundColor: userChipBgColor }}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F5C518]/20 text-sm font-semibold text-[#F5C518]">
                      {userInitials}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-white">
                        {user?.name ?? "Temple Admin"}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-[#BBDEFB]">
                        {userRoleLabel}
                      </span>
                      {sessionTimeout.timeLeftMs !== null && (
                        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#BBDEFB]">
                          Session Expires in{" "}
                          {formatCountdown(sessionTimeout.timeLeftMs)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* LOGOUT BUTTON */}
                  <button
                    type="button"
                    onClick={clear}
                    className="rounded-full bg-[#E65100] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#F57C00]"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* NAVIGATION */}
        <div style={{ backgroundColor: navMenuRowColor }}>
          <div className="responsive-layout py-2">
            <nav
              className="flex items-center gap-2 overflow-x-auto rounded-full border border-[#F5C518]/35 p-1"
              style={{ backgroundColor: navMenuRowColor }}
            >
              {navItems
                .filter((item) => item.show)
                .map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      clsx(
                        "relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
                        isActive
                          ? "bg-[#F5C518] text-[#000000] shadow-[0_10px_20px_-16px_rgba(245,197,24,0.8)]"
                          : navInactiveClass,
                      )
                    }
                  >
                    {item.label}

                    {/* BADGE */}
                    {item.badge && (
                      <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#E65100] px-1 text-xs font-semibold text-white shadow-sm">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                ))}
            </nav>
          </div>
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
