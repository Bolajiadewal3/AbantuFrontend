import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../utils/api";

type CarerAlert = {
  id: number;
  category: string;
  title: string;
  message: string;
  createdAt: string;
  relatedEntityType?: string | null;
  relatedEntityId?: number | null;
};

export default function CarerAlerts() {
  const [alerts, setAlerts] = useState<CarerAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissingId, setDismissingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadAlerts = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await apiFetch("/api/carer-alerts", { signal });
      if (!response.ok) {
        throw new Error(`Could not load alerts (${response.status}).`);
      }
      setAlerts(await response.json());
      setError("");
    } catch (loadError) {
      if (!signal?.aborted) {
        setError(loadError instanceof Error ? loadError.message : "Could not load alerts.");
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadAlerts(controller.signal);
    return () => controller.abort();
  }, [loadAlerts]);

  const dismissAlert = async (alertId: number) => {
    setDismissingId(alertId);
    setError("");
    try {
      const response = await apiFetch(`/api/carer-alerts/${alertId}/dismiss`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(`Could not dismiss alert (${response.status}).`);
      setAlerts((current) => current.filter((alert) => alert.id !== alertId));
      window.dispatchEvent(new Event("careapp:alerts-updated"));
    } catch (dismissError) {
      setError(dismissError instanceof Error ? dismissError.message : "Could not dismiss alert.");
    } finally {
      setDismissingId(null);
    }
  };

  const getRelatedPath = (alert: CarerAlert) => {
    switch (alert.relatedEntityType) {
      case "Shift":
        return "/user/shifts";
      case "Payslip":
        return "/payslips";
      case "Broadcast":
        return "/user/messages";
      default:
        return null;
    }
  };

  return (
    <section className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">My Alerts</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Shift changes, payroll updates, reminders, and Admin announcements.
          </p>
        </div>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
          {alerts.length} active
        </span>
      </header>

      {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      {loading ? (
        <p className="py-6 text-sm text-slate-500 dark:text-slate-400">Loading alerts...</p>
      ) : alerts.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          You’re all caught up. New alerts will appear here until dismissed.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {alerts.map((alert) => {
            const relatedPath = getRelatedPath(alert);
            const logbookType = alert.category === "LogbookClockIn"
              ? "ClockIn"
              : alert.category === "LogbookClockOut"
                ? "ClockOut"
                : null;
            const relatedLink = logbookType && alert.relatedEntityId
              ? `/user/shifts?logbookShiftId=${alert.relatedEntityId}&logbookType=${logbookType}`
              : relatedPath;
            return (
              <li key={alert.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{alert.title}</h2>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {new Date(alert.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-300">{alert.message}</p>
                  {relatedLink && (
                    <Link to={relatedLink} className="inline-flex py-1 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
                      {logbookType ? "Record logbook entry" : "Open related page"}
                    </Link>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void dismissAlert(alert.id)}
                  disabled={dismissingId !== null}
                  className="min-h-9 shrink-0 self-start rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {dismissingId === alert.id ? "Dismissing..." : "Dismiss"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}