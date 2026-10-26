import React, { useState } from "react";
import { Link } from "react-router-dom";
import { authStorage } from "../utils/auth";
import { apiFetch } from "../utils/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      authStorage.setSession(data.token, data.user);

      // Login_3.tsx
      if (["admin", "manager"].includes(data.user.role?.toLowerCase())) {
        window.location.href = "/admin/dashboard";
      } else if (data.user.role?.toLowerCase() === "carer") {
        window.location.href = "/user/dashboard";
      } else {
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      setError(
        err.message || "Something went wrong. Please check your connection.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-slate-950 text-slate-100 flex font-sans antialiased selection:bg-blue-500 selection:text-white">
      {/* Left Desktop Panel - Branding & Hero (Visible on lg screens and up) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] 2xl:w-[60%] relative bg-slate-900 border-r border-slate-800/80 overflow-hidden flex-col justify-between p-8 lg:p-12 xl:p-16">
        {/* Ambient Background Glows */}
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-[450px] h-[450px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />

        {/* Top Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/25 ring-1 ring-white/20">
            C
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white block leading-none">
              CareApp
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-400">
              Enterprise Workspace
            </span>
          </div>
        </div>

        {/* Center Hero Content */}
        <div className="relative z-10 space-y-6 max-w-lg my-auto py-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            System Operational • v2.4 Active
          </div>

          <h1 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Empowering Care Teams, <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-sky-300 bg-clip-text text-transparent">
              Simplified Operations.
            </span>
          </h1>

          <p className="text-slate-400 text-sm xl:text-base leading-relaxed">
            Manage real-time rosters, client care plans, and automated payroll
            workflows with complete compliance and precision.
          </p>

          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-medium text-slate-300">
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
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
              <span>Smart Shift Matching</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
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
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <span>Audit & Compliance</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/60 pt-6">
          <span>&copy; {new Date().getFullYear()} CareApp Technologies</span>
          <span>End-to-End Encrypted</span>
        </div>
      </div>

      {/* Right Form Panel - Fully responsive across mobile, tablet, desktop */}
      <div className="w-full lg:w-1/2 xl:w-[45%] 2xl:w-[40%] flex flex-col justify-center items-center px-4 sm:px-8 lg:px-12 py-8 sm:py-12 bg-slate-950 relative overflow-y-auto">
        {/* Mobile Background Glow */}
        <div className="lg:hidden absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-blue-600/10 rounded-full blur-[90px] pointer-events-none" />

        <div className="w-full max-w-sm sm:max-w-md space-y-6 sm:space-y-8 my-auto relative z-10">
          {/* Header & Mobile Logo */}
          <div className="space-y-2">
            <div className="lg:hidden flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white text-base shadow-md shadow-blue-500/20">
                C
              </div>
              <div>
                <span className="text-base font-bold text-white block leading-none">
                  CareApp
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-400">
                  Enterprise Workspace
                </span>
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Welcome back
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Please enter your credentials to access your workspace.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 sm:p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-start gap-3">
              <svg
                width="16"
                height="16"
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
              <div className="space-y-0.5">
                <span className="font-semibold text-rose-200 block">
                  Authentication Error
                </span>
                <span className="text-rose-300/90 leading-normal">{error}</span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div className="space-y-1.5 sm:space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Email Address
              </label>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@careapp.com"
                required
                className="w-full h-11 sm:h-12 px-4 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all placeholder:text-slate-600 appearance-none"
              />
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-medium text-slate-300">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors py-0.5"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-11 sm:h-12 pl-4 pr-11 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all placeholder:text-slate-600 appearance-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 bottom-0 px-3.5 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors select-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg
                      width="16"
                      height="16"
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a8.959 8.959 0 013.682-.783c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m-1.785 1.785a9.92 9.92 0 01-3.627.788M3 3l18 18"
                      />
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-blue-600 focus:ring-blue-500/20 focus:ring-offset-0"
                />
                <span className="text-xs text-slate-400">
                  Remember this device for 30 days
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 sm:h-12 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:from-blue-700 active:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>Sign In to Dashboard</span>
                  <svg
                    width="16"
                    height="16"
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </span>
              )}
            </button>
          </form>

          {/* Support Note */}
          <p className="text-center text-xs text-slate-500 pt-2">
            Need access? Contact your administrator at{" "}
            <a
              href="mailto:support@careapp.internal"
              className="text-slate-400 underline underline-offset-2 hover:text-slate-300"
            >
              support@careapp.internal
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
