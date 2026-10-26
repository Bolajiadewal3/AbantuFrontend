import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { authStorage } from "../utils/auth";
import { isLearningCenterEnabled } from "../utils/features";
import { apiFetch } from "../utils/api";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeAlertCount, setActiveAlertCount] = useState(0);
  const [superAdminActive, setSuperAdminActive] = useState(authStorage.isSuperAdmin());
  const [superAdminError, setSuperAdminError] = useState("");
  const [superAdminBusy, setSuperAdminBusy] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!superAdminError) return;
    const timeoutId = window.setTimeout(() => setSuperAdminError(""), 6000);
    return () => window.clearTimeout(timeoutId);
  }, [superAdminError]);

  useEffect(() => {
    const syncSuperAdminMode = () => setSuperAdminActive(authStorage.isSuperAdmin());
    window.addEventListener("careapp:auth-updated", syncSuperAdminMode);
    return () => window.removeEventListener("careapp:auth-updated", syncSuperAdminMode);
  }, []);

  useEffect(() => {
    if (!superAdminActive) return;
    const expiresAt = authStorage.getElevatedTokenExpiry();
    if (!expiresAt) {
      setSuperAdminActive(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      authStorage.clearSuperAdminToken();
      setSuperAdminActive(false);
      window.dispatchEvent(new Event("careapp:auth-updated"));
    }, Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timeoutId);
  }, [superAdminActive]);

  const user = authStorage.getUser();
  const userRole = user?.role || "Carer";

  useEffect(() => {
    if (userRole !== "Carer") {
      setActiveAlertCount(0);
      return;
    }

    const controller = new AbortController();
    const refreshAlertCount = async () => {
      try {
        const response = await apiFetch("/api/carer-alerts", { signal: controller.signal });
        if (response.ok) {
          const alerts = (await response.json()) as unknown[];
          setActiveAlertCount(alerts.length);
        }
      } catch {
        if (!controller.signal.aborted) setActiveAlertCount(0);
      }
    };

    const handleAlertsUpdated = () => void refreshAlertCount();
    void refreshAlertCount();
    const intervalId = window.setInterval(handleAlertsUpdated, 60_000);
    window.addEventListener("careapp:alerts-updated", handleAlertsUpdated);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
      window.removeEventListener("careapp:alerts-updated", handleAlertsUpdated);
    };
  }, [userRole]);

  const handleLogout = async () => {
    if (authStorage.isSuperAdmin()) {
      try {
        await apiFetch("/api/auth/super-admin/exit", { method: "POST" });
      } catch {
        // Local sign-out still clears the elevated token if the API is unavailable.
      }
    }
    authStorage.clearSession();
    void navigate("/login");
  };

  const handleExitSuperAdmin = async () => {
    setSuperAdminBusy(true);
    setSuperAdminError("");
    try {
      const response = await apiFetch("/api/auth/super-admin/exit", { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setSuperAdminError(body?.message || "Could not exit Super Admin mode. Sign out if this continues.");
        return;
      }

      authStorage.clearSuperAdminToken();
      setSuperAdminActive(false);
      window.dispatchEvent(new Event("careapp:auth-updated"));
    } catch {
      setSuperAdminError("Could not exit Super Admin mode. Check your connection and try again.");
    } finally {
      setSuperAdminBusy(false);
    }
  };

  const isActive = (path: string) => location.pathname === path;
  const isELearningActive = location.pathname.startsWith("/elearning");

  const getLinkClass = (path: string) => {
    const active = isActive(path);
    return `px-3.5 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 ${
      active
        ? "bg-blue-600/90 text-white shadow-md shadow-blue-500/20"
        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
    }`;
  };

  const navigationItems =
    userRole === "Carer"
      ? [
          { to: "/user/dashboard", label: "📊 Dashboard" },
          { to: "/user/shifts", label: "📋 My Shifts" },
          { to: "/user/calendar", label: "📅 Calendar" },
          { to: "/user/messages", label: "📩 Messages" },
          { to: "/user/alerts", label: "🔔 Alerts" },
          { to: "/user/requests", label: "🗓️ Leave requests" },
          { to: "/payslips", label: "📄 Payslips" },
        ]
      : userRole === "Admin" || userRole === "Manager"
        ? [
            { to: "/admin/dashboard", label: "📊 Dashboard" },
            { to: "/admin/roster", label: "📋 Shifts" },
            { to: "/admin/messages", label: "📩 Messages" },
            { to: "/admin/clients", label: "👥 Clients" },
            { to: "/admin/staff", label: "👨‍⚕️ Staff" },
            { to: "/admin/import", label: "📥 Import data" },
            {
              to: "/admin/observationsAndCompetencies",
              label: "🛡️ Observations And Competencies",
            },
            { to: "/admin/payslips", label: "📄 Payslips" },
            ...(userRole === "Admin" ? [{ to: "/admin/audit-trail", label: "Audit trail" }] : []),
            { to: "/admin/settings", label: "⚙️ Settings" },
            { to: "/admin/requests", label: "🗂️ Requests" },
          ]
        : [];

  if (isLearningCenterEnabled) {
    navigationItems.push({
      to: "/elearning/dashboard",
      label: "🎓 eLearning",
    });
  }

  navigationItems.push({ to: "/care-info", label: "🛟 Incident guide" });

  const renderNavigationItems = (mobile = false) =>
    navigationItems.map((item) =>
      item.to === "/user/alerts" ? (
        <Link
          key={item.to}
          to={item.to}
          aria-current={isActive(item.to) ? "page" : undefined}
          onClick={() => setMenuOpen(false)}
          className={`${getLinkClass(item.to)} relative inline-flex items-center justify-center whitespace-nowrap ${activeAlertCount > 0 ? "pr-10" : ""} ${mobile ? "w-full" : "shrink-0"}`}
        >
          {item.label}
          {activeAlertCount > 0 && (
            <span className="absolute right-2 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {activeAlertCount > 99 ? "99+" : activeAlertCount}
            </span>
          )}
        </Link>
      ) : item.to === "/elearning/dashboard" ? (
        <Link
          key={item.to}
          to={item.to}
          aria-current={isELearningActive ? "page" : undefined}
          onClick={() => setMenuOpen(false)}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all duration-200 shadow-sm whitespace-nowrap ${
            isELearningActive
              ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50"
          } ${mobile ? "w-full" : "shrink-0"}`}
        >
          {item.label}
        </Link>
      ) : (
        <Link
          key={item.to}
          to={item.to}
          aria-current={isActive(item.to) ? "page" : undefined}
          onClick={() => setMenuOpen(false)}
          className={`${getLinkClass(item.to)} whitespace-nowrap ${mobile ? "w-full" : "shrink-0"}`}
        >
          {item.label}
        </Link>
      ),
    );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
      <div className="relative flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-2 px-3 py-3 sm:px-6">
        {/* Brand */}
        <div className="order-1 flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
          <span className="text-xl">🏥</span>
          <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight sm:text-lg">
            CareRoster
          </span>
          <span className={`hidden rounded-full border px-2.5 py-0.5 text-[11px] font-semibold sm:inline-flex ${superAdminActive ? "border-amber-400/50 bg-amber-400/15 text-amber-700 dark:text-amber-300" : "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"}`}>
            {superAdminActive ? "Super Admin mode" : userRole}
          </span>
        </div>

        {/* Navigation Links */}
        <nav
          aria-label="Primary navigation"
          className="order-3 hidden w-full basis-full flex-wrap items-center justify-center gap-1.5 py-1 lg:flex"
        >
          {renderNavigationItems()}
        </nav>

        {/* User Info & Actions */}
        <div className="order-2 flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            aria-label={menuOpen ? "Close primary navigation" : "Open primary navigation"}
            aria-expanded={menuOpen}
            aria-controls="mobile-primary-navigation"
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
          >
            {menuOpen ? "Close menu" : "Menu"}
          </button>
          {/* 🎓 eLearning Portal Entry Button */}
          <span className="hidden max-w-48 truncate text-xs font-medium text-slate-700 dark:text-slate-300 sm:inline sm:text-sm">
            {user?.firstName
              ? `${user.firstName} ${user.lastName}`
              : user?.email}
          </span>
          {userRole === "Admin" && superAdminActive && (
            <button
              type="button"
              onClick={() => void handleExitSuperAdmin()}
              disabled={superAdminBusy}
              className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-200"
            >
              {superAdminBusy ? "Exiting..." : "Exit Super Admin"}
            </button>
          )}
          <button
            onClick={handleLogout}
            className="rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/80 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/30 cursor-pointer"
          >
            Logout
          </button>
        </div>
        {menuOpen && (
          <nav
            id="mobile-primary-navigation"
            aria-label="Primary navigation"
            className="absolute left-0 right-0 top-full z-50 flex max-h-[calc(100dvh-4rem)] flex-col gap-1 overflow-y-auto border-b border-slate-200 bg-white p-3 shadow-lg dark:border-slate-800 dark:bg-slate-900 lg:hidden"
          >
            {renderNavigationItems(true)}
          </nav>
        )}
      </div>
      {superAdminError && (
        <p role="alert" className="border-t border-rose-300/30 bg-rose-950/30 px-4 py-2 text-right text-xs text-rose-700 dark:text-rose-200">
          {superAdminError}
        </p>
      )}
    </header>
  );
}
