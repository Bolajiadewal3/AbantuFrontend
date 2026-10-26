import { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { authStorage } from "../utils/auth";

interface AuditEntry {
  id: number;
  occurredAt: string;
  actorUserId: number | null;
  entityName: string;
  entityId: string;
  action: string;
  changedProperties: string;
  changeDetails: string;
}

const PAGE_SIZE = 50;

function formatJson(value: string) {
  try {
    return JSON.stringify(JSON.parse(value));
  } catch {
    return value;
  }
}

function actionStyle(action: string) {
  switch (action.toLowerCase()) {
    case "added":
      return "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    case "modified":
      return "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    case "deleted":
      return "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
}

export default function AdminAuditTrail() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [superAdminMode, setSuperAdminMode] = useState(authStorage.isSuperAdmin());
  const [superAdminDialogOpen, setSuperAdminDialogOpen] = useState(false);
  const [superAdminPassword, setSuperAdminPassword] = useState("");
  const [superAdminError, setSuperAdminError] = useState("");
  const [superAdminBusy, setSuperAdminBusy] = useState(false);
  const [actorFilter, setActorFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    const refreshMode = () => {
      setSuperAdminMode(authStorage.isSuperAdmin());
      setReloadKey((key) => key + 1);
    };
    window.addEventListener("careapp:auth-updated", refreshMode);
    return () => window.removeEventListener("careapp:auth-updated", refreshMode);
  }, []);

  useEffect(() => {
    if (!superAdminError) return;
    const timeoutId = window.setTimeout(() => setSuperAdminError(""), 6000);
    return () => window.clearTimeout(timeoutId);
  }, [superAdminError]);

  const handleEnterSuperAdmin = async () => {
    setSuperAdminBusy(true);
    setSuperAdminError("");
    try {
      const response = await apiFetch("/api/auth/super-admin/enter", {
        method: "POST",
        body: JSON.stringify({ password: superAdminPassword }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.token) {
        setSuperAdminError(body?.message || "Could not enter Super Admin mode.");
        return;
      }

      authStorage.setSuperAdminToken(body.token);
      setSuperAdminPassword("");
      setSuperAdminDialogOpen(false);
      window.dispatchEvent(new Event("careapp:auth-updated"));
    } catch {
      setSuperAdminError("Could not enter Super Admin mode. Check your connection and try again.");
    } finally {
      setSuperAdminBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadEntries = async () => {
      setIsLoading(true);
      setError("");

      try {
        const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
        if (actorFilter.trim()) query.set("actorUserId", actorFilter.trim());
        if (entityFilter.trim()) query.set("entityName", entityFilter.trim());
        if (actionFilter.trim()) query.set("action", actionFilter.trim());
        if (fromDate) query.set("fromUtc", new Date(`${fromDate}T00:00:00`).toISOString());
        if (toDate) query.set("toUtc", new Date(`${toDate}T23:59:59.999`).toISOString());
        const response = await apiFetch(
          `/api/AuditLogs${superAdminMode ? "/super-admin" : ""}?${query.toString()}`,
        );
        if (!response.ok) {
          throw new Error(
            response.status === 403
              ? "You do not have permission to view the audit trail."
              : "Could not load audit records. Please try again.",
          );
        }

        const data: AuditEntry[] = await response.json();
        if (!cancelled) setEntries(data);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load audit records. Please try again.",
          );
          setEntries([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadEntries();
    return () => {
      cancelled = true;
    };
  }, [page, reloadKey, superAdminMode, actorFilter, entityFilter, actionFilter, fromDate, toDate]);

  const hasNextPage = entries.length === PAGE_SIZE;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">
            Administration
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
            Audit trail
          </h1>
          {superAdminMode && (
            <p className="mt-1 text-sm font-semibold text-amber-700 dark:text-amber-300">
              Super Admin mode: complete audit history
            </p>
          )}
          {!superAdminMode && (
            <button
              type="button"
              onClick={() => {
                setSuperAdminError("");
                setSuperAdminDialogOpen(true);
              }}
              className="mt-2 text-xs font-semibold text-amber-700 underline decoration-amber-500/40 underline-offset-2 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
            >
              Enter Super Admin mode
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((key) => key + 1)}
          disabled={isLoading}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Actor user ID
          <input type="number" min="1" value={actorFilter} onChange={(event) => { setPage(1); setActorFilter(event.target.value); }} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Entity
          <input value={entityFilter} onChange={(event) => { setPage(1); setEntityFilter(event.target.value); }} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Action
          <input value={actionFilter} onChange={(event) => { setPage(1); setActionFilter(event.target.value); }} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          From date
          <input type="date" value={fromDate} onChange={(event) => { setPage(1); setFromDate(event.target.value); }} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          To date
          <input type="date" value={toDate} onChange={(event) => { setPage(1); setToDate(event.target.value); }} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
        </label>
        <button type="button" onClick={() => { setActorFilter(""); setEntityFilter(""); setActionFilter(""); setFromDate(""); setToDate(""); setPage(1); }} className="justify-self-start rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 lg:col-span-5">
          Clear filters
        </button>
      </div>

      <div className="mt-5 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {error ? (
          <div role="alert" className="p-6 text-sm text-rose-700 dark:text-rose-300">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="mt-3 font-semibold underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        ) : isLoading ? (
          <p role="status" className="p-6 text-sm text-slate-600 dark:text-slate-300">
            Loading audit records...
          </p>
        ) : entries.length === 0 ? (
          <p className="p-6 text-sm text-slate-600 dark:text-slate-300">
            No audit records on this page.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Date and time</th>
                  <th scope="col" className="px-4 py-3 font-semibold">User ID</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Action</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Record</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Changed fields</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Approved old/new values</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {entries.map((entry) => (
                  <tr key={entry.id} className="align-top text-slate-700 dark:text-slate-200">
                    <td className="whitespace-nowrap px-4 py-3">
                      <time dateTime={entry.occurredAt}>
                        {new Date(entry.occurredAt).toLocaleString()}
                      </time>
                    </td>
                    <td className="px-4 py-3">{entry.actorUserId ?? "System"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${actionStyle(entry.action)}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="max-w-56 break-words px-4 py-3">
                      <span className="font-semibold">{entry.entityName}</span>
                      <code className="mt-1 block break-all text-xs text-slate-500 dark:text-slate-400">
                        {formatJson(entry.entityId)}
                      </code>
                    </td>
                    <td className="max-w-72 break-words px-4 py-3 text-xs">
                      {formatJson(entry.changedProperties)}
                    </td>
                    <td className="max-w-80 break-words px-4 py-3 text-xs">
                      {formatJson(entry.changeDetails || "[]")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">Page {page}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1 || isLoading}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={!hasNextPage || isLoading}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Next
          </button>
        </div>
      </div>

      {superAdminDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="super-admin-title"
            onSubmit={(event) => {
              event.preventDefault();
              void handleEnterSuperAdmin();
            }}
            className="w-full max-w-md space-y-4 rounded-lg border border-amber-500/40 bg-white p-5 text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-white"
          >
            <div>
              <h2 id="super-admin-title" className="text-lg font-bold">Enter Super Admin mode</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Elevated access expires after 10 minutes. Actions remain in the audit trail.</p>
            </div>
            <label className="block space-y-1.5 text-sm font-medium">
              Super Admin password
              <input
                autoFocus
                type="password"
                autoComplete="current-password"
                required
                value={superAdminPassword}
                onChange={(event) => setSuperAdminPassword(event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
            {superAdminError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{superAdminError}</p>}
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
              <button type="button" onClick={() => setSuperAdminDialogOpen(false)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
              <button type="submit" disabled={superAdminBusy || !superAdminPassword} className="rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-500 disabled:cursor-wait disabled:opacity-50">{superAdminBusy ? "Verifying..." : "Verify and enter"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}