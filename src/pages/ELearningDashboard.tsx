import { useEffect, useState } from "react";
import { authStorage } from "../utils/auth";
import { apiFetch } from "../utils/api";

export default function ELearningDashboard() {
  const user = authStorage.getUser();
  const isAdmin = user?.role === "Admin" || user?.role === "Manager";

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Data states could be hydrated from apiFetch("/api/courses") and ("/api/courses/admin/compliance-matrix")
  const [stats, setStats] = useState({
    todo: 0,
    completed: 0,
    expiring: 0,
    totalStaffCompliant: 0,
  });

  useEffect(() => {
    async function loadTrainingData() {
      setLoading(true);
      try {
        // Example logic mapping to your CoursesController
        if (isAdmin) {
          const res = await apiFetch("/api/courses/admin/compliance-matrix");
          if (res.ok) {
            const matrix = await res.json();
            // Calculate compliance metrics for admin view...
            setStats((prev) => ({
              ...prev,
              totalStaffCompliant: matrix.length,
            }));
          }
        } else {
          const res = await apiFetch("/api/courses");
          if (res.ok) {
            const catalog = await res.json();
            setStats({
              todo: catalog.filter((c: any) => c.status === 2 || c.status === 1)
                .length, // InProgress or Enrolled
              completed: catalog.filter((c: any) => c.status === 3).length, // Passed
              expiring: catalog.filter((c: any) => {
                if (!c.expiresAt) return false;
                const daysToExpiry =
                  (new Date(c.expiresAt).getTime() - new Date().getTime()) /
                  (1000 * 3600 * 24);
                return c.status === 3 && daysToExpiry < 30; // Passing but expiring in < 30 days
              }).length,
              totalStaffCompliant: 0,
            });
          }
        }
      } catch (err: any) {
        setError("Failed to load training data.");
      } finally {
        setLoading(false);
      }
    }
    loadTrainingData();
  }, [isAdmin]);

  return (
    <div className="min-h-[100dvh] w-full bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-white relative overflow-x-hidden">
      {/* Background Ambient Glows - Shifted to Emerald/Teal */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[350px] bg-emerald-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-[500px] h-[400px] bg-teal-600/10 rounded-full blur-[150px] pointer-events-none" />

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-10 relative z-10 space-y-8">
        {/* Hero Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-900/90 border border-slate-800/80 shadow-2xl backdrop-blur-md">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Learning Portal Active
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {isAdmin ? "Training Administration" : "Your Learning Path"},{" "}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
                {user?.firstName || "User"}
              </span>
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm">
              {isAdmin
                ? "Manage course content, track compliance, and oversee staff training matrices."
                : "Complete your mandatory training, check your upcoming expirations, and stay compliant."}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs sm:text-sm font-medium">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <div className="h-6 w-36 bg-slate-800/60 rounded-lg animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-36 rounded-2xl bg-slate-900/60 border border-slate-800/80 p-6 animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : isAdmin ? (
          /* ================= ADMIN VIEW ================= */
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Management Actions
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Action: Create Course */}
              <button className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-emerald-500/50 hover:bg-slate-800/80 transition-all duration-200 text-left group">
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit mb-4 group-hover:scale-110 transition-transform">
                  <svg
                    width="24"
                    height="24"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">
                  Create a Course
                </h3>
                <p className="text-xs text-slate-400">
                  Build a new training module, add slides, and configure
                  quizzes.
                </p>
              </button>

              {/* Action: Import Course */}
              <button className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-teal-500/50 hover:bg-slate-800/80 transition-all duration-200 text-left group">
                <div className="p-3 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 w-fit mb-4 group-hover:scale-110 transition-transform">
                  <svg
                    width="24"
                    height="24"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">
                  Import a Course
                </h3>
                <p className="text-xs text-slate-400">
                  Upload standard SCORM packages or JSON course definitions.
                </p>
              </button>

              {/* Action: Add External Certificate */}
              <button className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-blue-500/50 hover:bg-slate-800/80 transition-all duration-200 text-left group">
                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 w-fit mb-4 group-hover:scale-110 transition-transform">
                  <svg
                    width="24"
                    height="24"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">
                  Add External Certificate
                </h3>
                <p className="text-xs text-slate-400">
                  Log prior learning or third-party certifications for a carer.
                </p>
              </button>

              {/* Action: Manage Enrolments */}
              <button className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-indigo-500/50 hover:bg-slate-800/80 transition-all duration-200 text-left group">
                <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 w-fit mb-4 group-hover:scale-110 transition-transform">
                  <svg
                    width="24"
                    height="24"
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
                <h3 className="text-lg font-bold text-white mb-1">
                  Manage Enrolments
                </h3>
                <p className="text-xs text-slate-400">
                  Assign mandatory training modules to specific staff members.
                </p>
              </button>

              {/* Action: View Current Progress */}
              <button className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-amber-500/50 hover:bg-slate-800/80 transition-all duration-200 text-left group md:col-span-2 lg:col-span-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 w-fit mb-4 group-hover:scale-110 transition-transform">
                      <svg
                        width="24"
                        height="24"
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
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">
                      View Current Progress & Compliance
                    </h3>
                    <p className="text-xs text-slate-400 max-w-sm">
                      Access the CQC Compliance Matrix to review real-time
                      course completions and upcoming expirations across the
                      workforce.
                    </p>
                  </div>
                  <div className="hidden sm:block text-right">
                    <span className="text-3xl font-extrabold text-amber-400">
                      {stats.totalStaffCompliant}
                    </span>
                    <span className="block text-[10px] text-slate-500 uppercase tracking-wider mt-1">
                      Monitored Records
                    </span>
                  </div>
                </div>
              </button>
            </div>
          </div>
        ) : (
          /* ================= CARER VIEW ================= */
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Metric: To Do */}
            <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  To Do
                </span>
              </div>
              <span className="text-4xl font-extrabold text-white tracking-tight">
                {stats.todo}
              </span>
              <p className="text-xs text-slate-500">
                Courses pending completion
              </p>
            </div>

            {/* Metric: Completed */}
            <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-teal-500" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Completed
                </span>
              </div>
              <span className="text-4xl font-extrabold text-white tracking-tight">
                {stats.completed}
              </span>
              <p className="text-xs text-slate-500">
                Successfully passed courses
              </p>
            </div>

            {/* Metric: Expiring */}
            <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Expiring Soon
                </span>
              </div>
              <span className="text-4xl font-extrabold text-amber-400 tracking-tight">
                {stats.expiring}
              </span>
              <p className="text-xs text-slate-500">
                Requires renewal within 30 days
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
