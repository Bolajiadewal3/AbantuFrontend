import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";

interface ServiceUser {
  id: number;
  firstName: string;
  lastName: string;
}

interface Location {
  id: number;
  name: string;
}

interface CarerCandidate {
  carerId: number;
  fullName: string;
  isPreferred: boolean;
  hasOptedOut: boolean;
  hasOverlappingShift: boolean;
  hasRequiredCompetencies: boolean;
  missingCompetencies: string[];
}

interface ShiftCarerAssignment {
  carerId: number;
  carerName: string;
  status: number;
  isReplacement: boolean;
  acceptedAt?: string;
  actualStartTime?: string;
  actualEndTime?: string;
}

interface Shift {
  id: number;
  clientId: number | null;
  locationId: number | null;
  client?: ServiceUser;
  location?: Location;
  startTime: string;
  endTime: string;
  requiredCarers: number;
  status: number | string;
  handoverNotes?: string;
  carerAssignments: ShiftCarerAssignment[];
}

export default function RosterBasic() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [clients, setClients] = useState<ServiceUser[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [candidatesByShift, setCandidatesByShift] = useState<Record<number, CarerCandidate[]>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Form State
  const [targetType, setTargetType] = useState<"client" | "location">("client");
  const [clientId, setClientId] = useState<number | "">("");
  const [locationId, setLocationId] = useState<number | "">("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [requiredCarers, setRequiredCarers] = useState(1);
  const [handoverNotes, setHandoverNotes] = useState("");
  const [isDraft, setIsDraft] = useState<boolean>(true);

  // Track selected carer per shift
  const [selectedCarers, setSelectedCarers] = useState<{
    [shiftId: number]: number;
  }>({});

  const loadRosterData = async () => {
    setLoading(true);
    setError("");
    try {
      const [shiftsRes, clientsRes, locationsRes] = await Promise.all([
        apiFetch("/api/shifts/unassigned"),
        apiFetch("/api/serviceUsers/active"),
        apiFetch("/api/locations"),
      ]);

      if (shiftsRes.ok) {
        const shiftsData: Shift[] = await shiftsRes.json();
        setShifts(shiftsData);
        const candidateEntries = await Promise.all(shiftsData.map(async (shift) => {
          try {
            const response = await apiFetch(`/api/shifts/${shift.id}/candidate-carers`);
            return [shift.id, response.ok ? await response.json() as CarerCandidate[] : []] as const;
          } catch {
            return [shift.id, []] as const;
          }
        }));
        setCandidatesByShift(Object.fromEntries(candidateEntries));
      }

      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        setClients(clientsData);
      }
      if (locationsRes.ok) setLocations(await locationsRes.json());
    } catch {
      setError("Failed to load roster data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRosterData();
  }, []);

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((targetType === "client" && !clientId) || (targetType === "location" && !locationId)) {
      alert(`Please select a ${targetType === "client" ? "service user" : "location"} for this shift.`);
      return;
    }

    try {
      const response = await apiFetch("/api/shifts", {
        method: "POST",
        body: JSON.stringify({
          clientId: targetType === "client" ? Number(clientId) : null,
          locationId: targetType === "location" ? Number(locationId) : null,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          requiredCarers: Number(requiredCarers),
          handoverNotes: handoverNotes || null,
          isDraft: isDraft,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create shift");
      }

      setClientId("");
      setLocationId("");
      setTargetType("client");
      setStartTime("");
      setEndTime("");
      setRequiredCarers(1);
      setHandoverNotes("");
      setIsDraft(true);
      await loadRosterData();
    } catch (err: any) {
      setError(err.message || "Error creating shift.");
    }
  };

  const handlePublishCurrentWeek = async () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); 
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    if (
      !window.confirm(
        "Publish all draft shifts for the current week? They will become visible to assigned carers."
      )
    )
      return;

    try {
      const response = await apiFetch("/api/shifts/publish-week", {
        method: "POST",
        body: JSON.stringify({
          weekStart: startOfWeek.toISOString(),
          weekEnd: endOfWeek.toISOString(),
        }),
      });
      if (!response.ok) throw new Error("Failed to publish shifts");
      await loadRosterData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAssignCarer = async (shiftId: number) => {
    const carerUserId = selectedCarers[shiftId];
    if (!carerUserId) return;

    const candidate = candidatesByShift[shiftId]?.find((item) => item.carerId === Number(carerUserId));
    if (!candidate || candidate.hasOptedOut || candidate.hasOverlappingShift || !candidate.hasRequiredCompetencies) {
      const reason = candidate?.hasOptedOut
        ? "This carer has opted out for a service user at this shift target."
        : candidate?.hasOverlappingShift
          ? "This carer is already assigned to an overlapping shift."
          : candidate?.missingCompetencies.length
            ? `Missing required competencies: ${candidate.missingCompetencies.join(", ")}.`
            : "Candidate eligibility is still loading. Please try again.";
      alert(reason);
      return;
    }

    try {
      const response = await apiFetch(`/api/shifts/${shiftId}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ carerUserId: Number(carerUserId) }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Assignment failed");
      }

      await loadRosterData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs sm:text-sm font-medium flex items-center gap-3">
          <svg
            className="w-5 h-5 text-rose-400 shrink-0"
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
          <span>{error}</span>
        </div>
      )}

      {/* CREATE SHIFT FORM */}
      <section className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/85 shadow-2xl backdrop-blur-md space-y-5">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <svg
              className="w-4 h-4"
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
          <h2 className="text-lg font-bold text-white tracking-tight">
            Post New Shift
          </h2>
        </div>

        <form onSubmit={handleCreateShift} className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["client", "location"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTargetType(type)}
                aria-pressed={targetType === type}
                className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${targetType === type ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-950 border-slate-800 text-slate-300"}`}
              >
                {type === "client" ? "Service User" : "Location"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                {targetType === "client" ? "Service User" : "Location"}
              </label>
              {targetType === "client" ? (
                <select value={clientId} onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : "")} required className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all">
                  <option value="" disabled className="bg-slate-900 text-slate-400">Select Service User...</option>
                  {clients.map((client) => <option key={client.id} value={client.id} className="bg-slate-900 text-slate-200">{client.firstName} {client.lastName}</option>)}
                </select>
              ) : (
                <select value={locationId} onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : "")} required className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all">
                  <option value="" disabled className="bg-slate-900 text-slate-400">Select Location...</option>
                  {locations.map((location) => <option key={location.id} value={location.id} className="bg-slate-900 text-slate-200">{location.name}</option>)}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Start Time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all [color-scheme:dark]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                End Time
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all [color-scheme:dark]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Carers Needed
              </label>
              <input
                type="number"
                min="1"
                value={requiredCarers}
                onChange={(e) => setRequiredCarers(Number(e.target.value))}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Handover Notes (Optional)
            </label>
            <input
              type="text"
              value={handoverNotes}
              onChange={(e) => setHandoverNotes(e.target.value)}
              placeholder="Key details or instructions for this shift..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-white text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-2 bg-slate-950/80 px-3.5 py-2.5 rounded-xl border border-slate-800/80 w-full sm:w-auto">
              <input
                type="checkbox"
                id="isDraftToggleBasic"
                checked={isDraft}
                onChange={(e) => setIsDraft(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500/50 accent-blue-600 cursor-pointer"
              />
              <label
                htmlFor="isDraftToggleBasic"
                className="text-xs font-semibold text-slate-300 select-none cursor-pointer uppercase tracking-wider"
              >
                Save as Draft (Hidden from Carers)
              </label>
            </div>
            
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-blue-500/20 active:scale-[0.99] transition-all cursor-pointer w-full sm:w-auto"
            >
              Post Shift
            </button>
          </div>
        </form>
      </section>

      {/* SHIFTS LIST */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <svg
              className="w-4 h-4 text-amber-400"
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
            Unassigned & Open Shifts
          </h2>
          <button
            onClick={handlePublishCurrentWeek}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 active:scale-95 transition-all"
          >
            📢 Publish Current Week
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse"
              />
            ))}
          </div>
        ) : shifts.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800/85 text-slate-400 text-xs sm:text-sm">
            No unassigned shifts found. All scheduled shifts are fully staffed!
          </div>
        ) : (
          <div className="grid gap-4">
            {shifts.map((shift) => (
              <div
                key={shift.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  shift.status === 0 || shift.status === "Draft"
                    ? "bg-slate-800/50 border-slate-600 border-dashed opacity-80"
                    : "bg-slate-900/70 border-slate-800/85 hover:border-slate-700/80"
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    {(shift.status === 0 || shift.status === "Draft") && (
                      <span className="text-[10px] font-bold text-slate-900 bg-slate-400 px-1.5 py-0.5 rounded">
                        🚧 DRAFT
                      </span>
                    )}
                    <h3 className="text-base font-bold text-white">
                      {shift.clientId != null ? "Service User: " : "Location: "}
                      <span className="text-blue-400">
                        {shift.clientId != null
                          ? shift.client
                            ? `${shift.client.firstName} ${shift.client.lastName}`
                            : clients.find((client) => client.id === shift.clientId)
                              ? `${clients.find((client) => client.id === shift.clientId)!.firstName} ${clients.find((client) => client.id === shift.clientId)!.lastName}`
                              : `Service User #${shift.clientId}`
                          : locations.find((location) => location.id === shift.locationId)?.name ?? `Location #${shift.locationId}`}
                      </span>
                    </h3>
                  </div>
                  <p className="text-xs text-slate-300 flex items-center gap-1.5">
                    <span>🕒</span>
                    <span>
                      {new Date(shift.startTime).toLocaleString()} -{" "}
                      {new Date(shift.endTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </p>

                  {shift.handoverNotes && (
                    <p className="text-xs italic text-blue-300/90 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-lg inline-block">
                      📝 Note: {shift.handoverNotes}
                    </p>
                  )}

                  <p className="text-xs text-slate-400 pt-1">
                    <strong className="text-slate-200">
                      Assigned ({shift.carerAssignments?.length ?? 0}/
                      {shift.requiredCarers}):
                    </strong>{" "}
                      {shift.carerAssignments && shift.carerAssignments.length > 0
                      ? shift.carerAssignments
                          .map((assignment) => {
                            const statusLabel = assignment.status === 0
                              ? "Awaiting acceptance"
                              : assignment.status === 5
                                ? "Accepted"
                                : assignment.status === 1
                                  ? "Clocked in"
                                  : assignment.status === 2
                                    ? "Completed"
                                    : "Assigned";
                            return `${assignment.carerName} (${statusLabel})`;
                          })
                          .join(", ")
                      : "None"}
                  </p>
                </div>

                {/* Assignment Controls */}
                <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0">
                  <select
                    onChange={(e) =>
                      setSelectedCarers({
                        ...selectedCarers,
                        [shift.id]: Number(e.target.value),
                      })
                    }
                    defaultValue=""
                    className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option
                      value=""
                      disabled
                      className="bg-slate-900 text-slate-400"
                    >
                      Select Carer...
                    </option>
                    {(candidatesByShift[shift.id] ?? []).map((candidate) => {
                      const unavailable = candidate.hasOptedOut || candidate.hasOverlappingShift || !candidate.hasRequiredCompetencies;
                      const status = candidate.hasOptedOut
                        ? "Opted out"
                        : candidate.hasOverlappingShift
                          ? "Schedule conflict"
                          : !candidate.hasRequiredCompetencies
                            ? `Missing: ${candidate.missingCompetencies.join(", ")}`
                            : candidate.isPreferred ? "Preferred" : "Eligible";
                      return (
                        <option key={candidate.carerId} value={candidate.carerId} disabled={unavailable} className="bg-slate-900 text-slate-200">
                          {candidate.isPreferred ? "⭐ " : ""}{candidate.fullName} — {status}
                        </option>
                      );
                    })}
                  </select>

                  <button
                    onClick={() => handleAssignCarer(shift.id)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                  >
                    Assign
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}