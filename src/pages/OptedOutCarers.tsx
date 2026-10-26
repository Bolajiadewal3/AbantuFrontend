import { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";

interface User {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
}

interface ServiceUser {
  id: number;
  firstName: string;
  lastName: string;
}

interface OptOutRecord {
  carerId: number;
  reason: string;
  optedOutAt: string;
}

export default function OptedOutCarersManager() {
  const [clients, setClients] = useState<ServiceUser[]>([]);
  const [carers, setCarers] = useState<User[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | "">("");

  // Track existing opt-outs as a map of carerId -> reason
  const [optedOutMap, setOptedOutMap] = useState<Record<number, string>>({});
  const [preferredCarerIds, setPreferredCarerIds] = useState<number[]>([]);

  // Modal / Input state for adding a reason
  const [activeCarerForReason, setActiveCarerForReason] = useState<User | null>(
    null,
  );
  const [reasonInput, setReasonInput] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [clientsRes, carersRes] = await Promise.all([
        apiFetch("/api/serviceUsers/active"),
        apiFetch("/api/users/active"),
      ]);

      if (clientsRes.ok) setClients(await clientsRes.json());
      if (carersRes.ok) {
        const users: User[] = await carersRes.json();
        setCarers(users.filter((u) => u.role === "Carer"));
      }
    } catch (err) {
      setMessage("Failed to load initial data.");
    } finally {
      setLoading(false);
    }
  };

  const handleClientSelect = async (clientId: number) => {
    setSelectedClientId(clientId);
    setMessage("");
    try {
      const [optOutRes, prefRes] = await Promise.all([
        apiFetch(`/api/serviceUsers/${clientId}/opted-out-carers`),
        apiFetch(`/api/serviceUsers/${clientId}/preferred-carers`),
      ]);

      if (optOutRes.ok) {
        const records: OptOutRecord[] = await optOutRes.json();
        const map: Record<number, string> = {};
        records.forEach((r) => {
          map[r.carerId] = r.reason;
        });
        setOptedOutMap(map);
      } else {
        setOptedOutMap({});
      }

      if (prefRes.ok) {
        setPreferredCarerIds(await prefRes.json());
      } else {
        setPreferredCarerIds([]);
      }
    } catch (err) {
      setOptedOutMap({});
      setPreferredCarerIds([]);
    }
  };

  const handleCarerClick = (carer: User) => {
    if (preferredCarerIds.includes(carer.id)) return; // Block if preferred

    if (optedOutMap[carer.id] !== undefined) {
      // Already opted out, clicking removes them (or lets them edit reason)
      handleRemoveOptOut(carer.id);
    } else {
      // Open reason prompt
      setActiveCarerForReason(carer);
      setReasonInput("");
    }
  };

  const handleAddOptOutWithReason = async () => {
    if (!selectedClientId || !activeCarerForReason) return;
    setProcessing(true);
    setMessage("");

    try {
      const res = await apiFetch(
        `/api/serviceUsers/${selectedClientId}/opted-out-carers`,
        {
          method: "POST",
          body: JSON.stringify({
            carerId: activeCarerForReason.id,
            reason: reasonInput,
          }),
        },
      );

      if (!res.ok) throw new Error("Failed to add opt-out record.");

      setOptedOutMap((prev) => ({
        ...prev,
        [activeCarerForReason.id]: reasonInput,
      }));
      setMessage(
        `${activeCarerForReason.firstName} ${activeCarerForReason.lastName} added to opted-out list.`,
      );
      setActiveCarerForReason(null);
    } catch (err: any) {
      setMessage(err.message || "An error occurred.");
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveOptOut = async (carerId: number) => {
    if (!selectedClientId) return;
    setProcessing(true);
    setMessage("");

    try {
      const res = await apiFetch(
        `/api/serviceUsers/${selectedClientId}/opted-out-carers/${carerId}`,
        { method: "DELETE" },
      );

      if (!res.ok) throw new Error("Failed to remove opt-out record.");

      setOptedOutMap((prev) => {
        const copy = { ...prev };
        delete copy[carerId];
        return copy;
      });
      setMessage("Carer removed from opted-out list.");
    } catch (err: any) {
      setMessage(err.message || "An error occurred.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading)
    return (
      <div className="mx-auto max-w-7xl p-6 sm:p-8">
        <p className="text-slate-600 dark:text-slate-400 animate-pulse">
          Loading service users and carers...
        </p>
      </div>
    );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 sm:p-8">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/70 p-6 sm:p-8 shadow-sm dark:shadow-2xl backdrop-blur-md">
        <h2 className="mt-0 text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span>🚫</span> Manage Opted-Out Carers
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Select a service user below to manage carers who have opted out,
          including reasons.
        </p>

        {/* Select Service User */}
        <div className="mt-6 mb-6">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
            Select Service User:
          </label>
          <select
            value={selectedClientId}
            onChange={(e) => handleClientSelect(Number(e.target.value))}
            className="w-full max-w-md rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 p-3 text-xs sm:text-sm text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
          >
            <option value="" disabled>
              -- Select a Client --
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.firstName} {client.lastName}
              </option>
            ))}
          </select>
        </div>

        {selectedClientId && (
          <div className="space-y-5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Carer Opt-Out Status
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
              {carers.map((carer) => {
                const isOptedOut = optedOutMap[carer.id] !== undefined;
                const isPreferred = preferredCarerIds.includes(carer.id);

                return (
                  <div
                    key={carer.id}
                    onClick={() => handleCarerClick(carer)}
                    className={`flex flex-col justify-between p-3.5 rounded-xl border-2 transition-all ${
                      isPreferred
                        ? "border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/30 opacity-40 cursor-not-allowed text-slate-400"
                        : isOptedOut
                          ? "border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100 shadow-sm cursor-pointer"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-semibold">
                        {carer.firstName} {carer.lastName}
                      </span>
                      <span className="text-sm">
                        {isPreferred
                          ? "⭐ Preferred"
                          : isOptedOut
                            ? "🚫"
                            : "➕"}
                      </span>
                    </div>
                    {isOptedOut && (
                      <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-400 italic">
                        Reason: {optedOutMap[carer.id]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {message && (
              <p className="text-xs sm:text-sm font-medium text-emerald-600 dark:text-emerald-400">
                {message}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Reason Input Modal / Dialog */}
      {activeCarerForReason && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Opt-Out Reason for {activeCarerForReason.firstName}{" "}
              {activeCarerForReason.lastName}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Please enter the reason why this carer is opting out of working
              with this service user.
            </p>
            <textarea
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="e.g., Scheduling conflict, personal preference..."
              className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 p-3 text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 focus:outline-none h-24 resize-none"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setActiveCarerForReason(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-300 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddOptOutWithReason}
                disabled={processing}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {processing ? "Saving..." : "Confirm Opt-Out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
