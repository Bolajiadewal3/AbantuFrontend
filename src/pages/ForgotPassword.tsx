import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../utils/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSubmitting(true);

    try {
      const response = await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Could not request a reset link.");
      }
      setMessage(data.message);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not request a reset link. Please try again.",
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
          <h1 className="mt-2 text-2xl font-bold">Reset your password</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Enter your account email. If it matches an active account, we’ll send a reset link.
          </p>
        </header>

        {message && (
          <p role="status" className="rounded-md border border-emerald-800 bg-emerald-950/60 p-3 text-sm text-emerald-200">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-md border border-rose-800 bg-rose-950/60 p-3 text-sm text-rose-200">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="reset-email" className="block text-sm font-medium text-slate-300">
              Email address
            </label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              placeholder="name@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting ? "Sending request..." : "Send reset link"}
          </button>
        </form>

        <Link to="/login" className="inline-block text-sm font-medium text-teal-300 underline underline-offset-4 hover:text-teal-200">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}