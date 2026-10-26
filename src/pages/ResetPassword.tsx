import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../utils/api";

export default function ResetPassword() {
  const [token, setToken] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "",
  );
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (token) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [token]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!token) {
      setError("This reset link is missing its token. Request a new link.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    if (new TextEncoder().encode(newPassword).length > 72) {
      setError("Password must be no more than 72 UTF-8 bytes.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Could not reset the password.");
      }
      setToken("");
      setMessage(data.message);
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Could not reset the password. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <section className="w-full max-w-md space-y-6">
        <header>
          <p className="text-sm font-semibold text-teal-400">CareApp account</p>
          <h1 className="mt-2 text-2xl font-bold">Choose a new password</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Use at least 12 characters. Reset links expire after 30 minutes and work once.
          </p>
        </header>

        {message ? (
          <div className="space-y-4">
            <p role="status" className="rounded-md border border-emerald-800 bg-emerald-950/60 p-3 text-sm text-emerald-200">
              {message}
            </p>
            <Link to="/login" className="inline-block text-sm font-medium text-teal-300 underline underline-offset-4 hover:text-teal-200">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <p role="alert" className="rounded-md border border-rose-800 bg-rose-950/60 p-3 text-sm text-rose-200">
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="new-password" className="block text-sm font-medium text-slate-300">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="h-11 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-300">
                  Confirm new password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-11 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting || !token}
                className="w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Updating password..." : "Update password"}
              </button>
            </form>

            <Link to="/forgot-password" className="inline-block text-sm font-medium text-teal-300 underline underline-offset-4 hover:text-teal-200">
              Request a new reset link
            </Link>
          </>
        )}
      </section>
    </main>
  );
}