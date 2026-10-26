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
}

export default function PreferredCarersManager() {
  const [clients, setClients] = useState<ServiceUser[]>([]);
  const [carers, setCarers] = useState<User[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | "">("");
  const [selectedCarerIds, setSelectedCarerIds] = useState<number[]>([]);
  const [optedOutCarerIds, setOptedOutCarerIds] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
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
      const [prefRes, optOutRes] = await Promise.all([
        apiFetch(`/api/serviceUsers/${clientId}/preferred-carers`),
        apiFetch(`/api/serviceUsers/${clientId}/opted-out-carers`),
      ]);

      if (prefRes.ok) {
        setSelectedCarerIds(await prefRes.json());
      } else {
        setSelectedCarerIds([]);
      }

      if (optOutRes.ok) {
        const optOuts: OptOutRecord[] = await optOutRes.json();
        setOptedOutCarerIds(optOuts.map((o) => o.carerId));
      } else {
        setOptedOutCarerIds([]);
      }
    } catch (err) {
      setSelectedCarerIds([]);
      setOptedOutCarerIds([]);
    }
  };

  const toggleCarerPreference = (carerId: number) => {
    if (optedOutCarerIds.includes(carerId)) return; // Prevent selecting opted-out carers
    setSelectedCarerIds((prev) =>
      prev.includes(carerId)
        ? prev.filter((id) => id !== carerId)
        : [...prev, carerId],
    );
  };

  const handleSavePreferences = async () => {
    if (!selectedClientId) return;
    setSaving(true);
    setMessage("");

    try {
      const response = await apiFetch(
        `/api/serviceUsers/${selectedClientId}/preferred-carers`,
        {
          method: "PUT",
          body: JSON.stringify({ preferredCarerIds: selectedCarerIds }),
        },
      );

      if (!response.ok) throw new Error("Failed to update preferred carers.");

      setMessage("Preferred carers updated successfully!");
    } catch (err: any) {
      setMessage(err.message || "An error occurred.");
    } finally {
      setSaving(false);
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
          <span>⭐</span> Manage Preferred Carers
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Select a service user below to set their preferred carers for
          automatic roster prioritization.
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
              Preferred Carers List
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
              {carers.map((carer) => {
                const isSelected = selectedCarerIds.includes(carer.id);
                const isOptedOut = optedOutCarerIds.includes(carer.id);

                return (
                  <div
                    key={carer.id}
                    onClick={() => toggleCarerPreference(carer.id)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${
                      isOptedOut
                        ? "border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/30 opacity-40 cursor-not-allowed text-slate-400"
                        : isSelected
                          ? "border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-950 dark:text-sky-100 shadow-sm cursor-pointer"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer"
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-semibold">
                      {carer.firstName} {carer.lastName}
                    </span>
                    <span className="text-xs font-medium">
                      {isOptedOut ? "🚫 Opted Out" : isSelected ? "⭐" : "➕"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <button
                onClick={handleSavePreferences}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save Preferences"}
              </button>

              {message && (
                <p
                  className={`text-xs sm:text-sm font-medium ${
                    message.includes("successfully")
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {message}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
