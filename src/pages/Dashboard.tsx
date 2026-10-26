import { useEffect, useState } from "react";
import { authStorage } from "../utils/auth";
import { apiFetch } from "../utils/api";

interface Shift {
  id: number;
  title?: string;
  startTime: string;
  endTime: string;
  location?: string;
}

export default function Dashboard() {
  const user = authStorage.getUser();
  const canViewAdminDashboard = user?.role === "Admin" || user?.role === "Manager";

  // Admin state
  const [activeCarersCount, setActiveCarersCount] = useState<number | null>(
    null,
  );
  const [activeClientsCount, setActiveClientsCount] = useState<number | null>(
    null,
  );
  const [unassignedShiftsCount, setUnassignedShiftsCount] = useState<
    number | null
  >(null);

  // Carer state
  const [nextShift, setNextShift] = useState<Shift | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      setError("");

      try {
        if (canViewAdminDashboard) {
          // Fetch operational metrics for Admins and Managers.
          const [carersRes, clientsRes, shiftsRes] = await Promise.all([
            apiFetch("/api/users/active"),
            apiFetch("/api/serviceUsers/active"),
            apiFetch("/api/shifts/unassigned"),
          ]);

          if (carersRes.ok) {
            const carers = await carersRes.json();
            setActiveCarersCount(carers.length);
          }

          if (clientsRes.ok) {
            const clients = await clientsRes.json();
            setActiveClientsCount(clients.length);
          }

          if (shiftsRes.ok) {
            const shifts = await shiftsRes.json();
            setUnassignedShiftsCount(shifts.length);
          }
        } else {
          // Fetch profile / shifts for Carers to find their next shift
          const userRes = await apiFetch(`/api/users/${user?.id}`);
          if (userRes.ok) {
            const userData = await userRes.json();

            if (userData.assignedShifts && userData.assignedShifts.length > 0) {
              const sorted = userData.assignedShifts
                .filter((s: Shift) => new Date(s.startTime) > new Date())
                .sort(
                  (a: Shift, b: Shift) =>
                    new Date(a.startTime).getTime() -
                    new Date(b.startTime).getTime(),
                );

              setNextShift(sorted[0] || null);
            }
          }
        }
      } catch {
        setError("Failed to load dashboard metrics.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [canViewAdminDashboard, user?.id]);

  const handleLogout = () => {
    authStorage.clearSession();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-[100dvh] w-full bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans antialiased selection:bg-blue-500 selection:text-white relative overflow-x-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[350px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-[500px] h-[400px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Workspace Tag */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20 ring-1 ring-white/20 shrink-0">
              C
            </div>
            <div>
              <span className="text-base sm:text-lg font-bold tracking-tight text-white block leading-none">
                CareApp
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-400 hidden sm:block">
                Enterprise Workspace
              </span>
            </div>
          </div>

          {/* User Profile Info & Logout */}
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-blue-400">
                {user?.firstName?.[0] || "U"}
                {user?.lastName?.[0] || ""}
              </div>
              <div className="hidden sm:block text-right">
                <span className="text-xs font-semibold text-slate-200 block leading-tight">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="text-[11px] font-medium text-slate-400">
                  {user?.role}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all duration-200 flex items-center gap-2 cursor-pointer"
            >
              <svg
                width="16"
                height="16"
                className="w-4 h-4 text-slate-400 shrink-0"
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
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-10 relative z-10 space-y-8">
        {/* Hero Greeting Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 shadow-lg dark:shadow-2xl backdrop-blur-md">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Active Session
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Welcome back,{" "}
              <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-sky-300 bg-clip-text text-transparent">
                {user?.firstName || "User"}
              </span>
              ! 👋
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm">
              {canViewAdminDashboard
                ? "Here is the real-time operational overview across your organization."
                : "Here is your upcoming schedule and shift details."}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-medium text-blue-400">
              Role: {user?.role}
            </span>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs sm:text-sm font-medium flex items-start gap-3">
            <svg
              width="18"
              height="18"
              className="w-4 h-4 text-rose-400 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <span className="font-semibold text-rose-200 block">
                Dashboard Error
              </span>
              <span className="text-rose-300/90">{error}</span>
            </div>
          </div>
        )}

        {/* Loading State Skeleton */}
        {loading ? (
          <div className="space-y-4">
            <div className="h-6 w-36 bg-slate-800/60 rounded-lg animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-36 rounded-2xl bg-slate-900/60 border border-slate-800/80 p-6 space-y-4 animate-pulse"
                >
                  <div className="h-4 w-24 bg-slate-800 rounded" />
                  <div className="h-8 w-16 bg-slate-800 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        ) : canViewAdminDashboard ? (
          /* ================= ADMIN VIEW ================= */
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <svg
                  width="18"
                  height="18"
                  className="w-4 h-4 text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                System Overview
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Metric 1: Active Carers */}
              <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 transition-all duration-200 space-y-3 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Active Carers
                  </span>
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <svg
                      width="18"
                      height="18"
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  </div>
                </div>
                <div>
                  <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                    {activeCarersCount !== null ? activeCarersCount : "--"}
                  </span>
                  <p className="text-xs text-slate-500 mt-1">
                    Carers currently available & registered
                  </p>
                </div>
              </div>

              {/* Metric 2: Active Clients */}
              <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 transition-all duration-200 space-y-3 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Active Clients
                  </span>
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <svg
                      width="18"
                      height="18"
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0h4m-4 0H9"
                      />
                    </svg>
                  </div>
                </div>
                <div>
                  <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                    {activeClientsCount !== null ? activeClientsCount : "--"}
                  </span>
                  <p className="text-xs text-slate-500 mt-1">
                    Service users receiving care
                  </p>
                </div>
              </div>

              {/* Metric 3: Unassigned Shifts */}
              <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 transition-all duration-200 space-y-3 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Unassigned Shifts
                  </span>
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <svg
                      width="18"
                      height="18"
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
                <div>
                  <span className="text-3xl sm:text-4xl font-extrabold text-amber-400 tracking-tight">
                    {unassignedShiftsCount !== null
                      ? unassignedShiftsCount
                      : "--"}
                  </span>
                  <p className="text-xs text-slate-500 mt-1">
                    Shifts awaiting carer assignment
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ================= CARER VIEW ================= */
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <svg
                width="18"
                height="18"
                className="w-4 h-4 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 002-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Your Schedule
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Next Upcoming Shift
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] font-medium">
                    Scheduled
                  </span>
                </div>

                {nextShift ? (
                  <div className="space-y-3 pt-1">
                    <h3 className="text-xl font-bold text-white">
                      {nextShift.title || "Care Shift"}
                    </h3>

                    <div className="space-y-2 text-xs sm:text-sm text-slate-300">
                      <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50">
                        <svg
                          width="16"
                          height="16"
                          className="w-4 h-4 text-blue-400 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 002-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span>
                          {new Date(nextShift.startTime).toLocaleDateString(
                            undefined,
                            {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            },
                          )}{" "}
                          at{" "}
                          {new Date(nextShift.startTime).toLocaleTimeString(
                            [],
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                      </div>

                      {nextShift.location && (
                        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50">
                          <svg
                            width="16"
                            height="16"
                            className="w-4 h-4 text-emerald-400 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          <span className="truncate">{nextShift.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center space-y-2">
                    <p className="text-slate-400 text-sm font-medium">
                      No upcoming shifts scheduled.
                    </p>
                    <p className="text-slate-500 text-xs">
                      Check back later for new roster updates.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
