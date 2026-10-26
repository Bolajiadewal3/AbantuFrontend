import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { authStorage } from "../utils/auth";

export default function ELearningNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const user = authStorage.getUser();
  const isAdmin = user?.role === "Admin" || user?.role === "Manager";

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleExit = () => {
    navigate(isAdmin ? "/admin/dashboard" : "/user/dashboard");
  };

  const isActive = (path: string) => location.pathname === path;

  const getLinkClass = (path: string) => {
    const active = isActive(path);
    return `rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200 whitespace-nowrap sm:px-3.5 sm:text-sm ${
      active
        ? "bg-emerald-600/90 text-white shadow-md shadow-emerald-500/20"
        : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
    }`;
  };

  const navigationItems = isAdmin
    ? [
        { to: "/elearning/admin/create", label: "➕ Create Course" },
        { to: "/elearning/admin/import", label: "📥 Import" },
        { to: "/elearning/admin/external-cert", label: "📜 Add External Cert" },
        { to: "/elearning/admin/enrolments", label: "👥 Enrolments" },
        { to: "/elearning/admin/compliance", label: "📊 Compliance Matrix" },
        { to: "/care-info", label: "🛟 Incident guide" },
      ]
    : [
        { to: "/elearning/todo", label: "📚 To Do Courses" },
        { to: "/elearning/completed", label: "✅ Completed Courses" },
        { to: "/elearning/expiring", label: "⚠️ Upcoming Expirations" },
        { to: "/user/alerts", label: "🔔 Alerts" },
        { to: "/care-info", label: "🛟 Incident guide" },
      ];

  const renderNavigationItems = (mobile = false) =>
    navigationItems.map((item) => (
      <Link
        key={item.to}
        to={item.to}
        aria-current={isActive(item.to) ? "page" : undefined}
        onClick={() => setMenuOpen(false)}
        className={`${getLinkClass(item.to)} ${mobile ? "w-full" : "shrink-0"}`}
      >
        {item.label}
      </Link>
    ));

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md">
      <div className="relative mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-2 gap-y-2 px-3 py-3 sm:px-6">
        {/* Brand */}
        <div className="order-1 flex min-w-0 shrink-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 font-bold text-white shadow-lg shadow-emerald-500/20 ring-1 ring-white/20">
            🎓
          </div>
          <div className="min-w-0">
            <span className="block truncate text-base font-bold leading-none tracking-tight text-white sm:text-lg">
              CareApp Academy
            </span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-widest text-emerald-400 sm:block">
              {isAdmin ? "Admin Portal" : "Training Portal"}
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav
          aria-label="Learning Center navigation"
          className="order-3 hidden w-full basis-full flex-wrap items-center justify-center gap-1.5 py-1 lg:flex"
        >
          {renderNavigationItems()}
        </nav>

        {/* Exit & User Info */}
        <div className="order-2 flex shrink-0 items-center gap-2 sm:gap-4">
          <button
            type="button"
            aria-label={menuOpen ? "Close Learning Center navigation" : "Open Learning Center navigation"}
            aria-expanded={menuOpen}
            aria-controls="elearning-mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-lg border border-slate-700 px-2.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 lg:hidden"
          >
            {menuOpen ? "Close" : "Menu"}
          </button>
          <div className="hidden lg:flex items-center gap-3">
            <span className="text-xs sm:text-sm text-slate-300 font-medium">
              {user?.firstName} {user?.lastName}
            </span>
          </div>
          <button
            onClick={handleExit}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 cursor-pointer flex items-center gap-2 shrink-0"
          >
            <svg
              width="14"
              height="14"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span className="hidden sm:inline">Exit Learning Center</span>
            <span className="sm:hidden">Exit</span>
          </button>
        </div>
        {menuOpen && (
          <nav
            id="elearning-mobile-navigation"
            aria-label="Learning Center navigation"
            className="absolute left-0 right-0 top-full z-50 flex max-h-[calc(100dvh-4rem)] flex-col gap-1 overflow-y-auto border-b border-slate-800 bg-slate-900 p-3 shadow-lg lg:hidden"
          >
            {renderNavigationItems(true)}
          </nav>
        )}
      </div>
    </header>
  );
}
