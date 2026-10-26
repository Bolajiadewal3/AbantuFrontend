import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../utils/api";
import { authStorage } from "../utils/auth";

interface ServiceUser {
  id: number;
  firstName: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth?: string | null;
  hasProfilePhoto?: boolean;
  addressDetails?: string;
  postcode?: string;
  carePlanSummary?: string;
}

interface LocationServiceUser {
  id: number;
  firstName: string;
  lastName: string;
  preferredName?: string;
}

interface ShiftCarerAssignment {
  carerId: number;
  carerName: string;
  status: number;
  acceptedAt?: string;
  actualStartTime?: string;
  actualEndTime?: string;
}

interface Shift {
  id: number;
  clientId: number | null;
  locationId: number | null;
  locationName?: string;
  locationServiceUsers?: LocationServiceUser[];
  client?: ServiceUser;
  startTime: string;
  endTime: string;
  requiredCarers: number;
  status: number | string;
  carerAssignments: ShiftCarerAssignment[];
}

interface HandoverNote {
  id: number;
  shiftId: number;
  carerId: number;
  carerName: string;
  contentMarkdown: string;
  createdAt: string;
}

interface ShiftLogEntry {
  id: number;
  shiftId: number;
  carerId: number;
  carerName: string;
  type: "ClockIn" | "ClockOut" | "General";
  content: string;
  createdAt: string;
}

interface LogbookPrompt {
  shiftId: number;
  type: "ClockIn" | "ClockOut" | "General";
}

export default function CarerShifts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [clients, setClients] = useState<Record<number, ServiceUser>>({});
  const [activeTab, setActiveTab] = useState<"upcoming" | "previous">(
    "upcoming",
  );
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedClient, setSelectedClient] = useState<ServiceUser | null>(
    null,
  );

  // Handover submission state
  const [handoverShiftId, setHandoverShiftId] = useState<number | null>(null);
  const [handoverText, setHandoverText] = useState("");

  // Reading handover notes state
  const [viewNotesShiftId, setViewNotesShiftId] = useState<number | null>(null);
  const [handoverNotesList, setHandoverNotesList] = useState<HandoverNote[]>(
    [],
  );
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [logbookPrompt, setLogbookPrompt] = useState<LogbookPrompt | null>(null);
  const [logbookText, setLogbookText] = useState("");
  const [logbookSubmitting, setLogbookSubmitting] = useState(false);
  const [viewLogbookShiftId, setViewLogbookShiftId] = useState<number | null>(null);
  const [logbookEntries, setLogbookEntries] = useState<ShiftLogEntry[]>([]);
  const [loadingLogbook, setLoadingLogbook] = useState(false);
  const [declineShiftId, setDeclineShiftId] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [declineSubmitting, setDeclineSubmitting] = useState(false);
  const [minimumCoverLeadTimeHours, setMinimumCoverLeadTimeHours] = useState(24);

  const currentUser = authStorage.getUser();
  const currentUserId = currentUser?.id;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [shiftsRes, clientsRes, coverPolicyRes] = await Promise.all([
        apiFetch("/api/shifts"),
        apiFetch("/api/serviceUsers/active"),
        apiFetch("/api/shifts/cover-policy"),
      ]);

      if (coverPolicyRes.ok) {
        const coverPolicy = await coverPolicyRes.json();
        if (Number.isFinite(coverPolicy.minimumLeadTimeHours)) {
          setMinimumCoverLeadTimeHours(coverPolicy.minimumLeadTimeHours);
        }
      }

      if (clientsRes.ok) {
        const clientList: ServiceUser[] = await clientsRes.json();
        const clientMap: Record<number, ServiceUser> = {};
        clientList.forEach((c) => {
          clientMap[c.id] = c;
        });
        setClients(clientMap);
      }

      if (shiftsRes.ok) {
        const allShifts: Shift[] = await shiftsRes.json();
        // Filter shifts where current carer is assigned
        const myShifts = allShifts.filter((s) =>
          s.carerAssignments?.some((a) => a.carerId === currentUserId),
        );
        setShifts(myShifts);
      }
    } catch (err) {
      console.error("Error loading carer shifts", err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const logbookShiftParam = searchParams.get("logbookShiftId");
  const logbookTypeParam = searchParams.get("logbookType");

  useEffect(() => {
    if (loading || !logbookShiftParam || !logbookTypeParam) return;

    const shiftId = Number(logbookShiftParam);
    const isAssigned = shifts.some((shift) =>
      shift.id === shiftId && shift.carerAssignments?.some((item) => item.carerId === currentUserId),
    );
    if (isAssigned && (logbookTypeParam === "ClockIn" || logbookTypeParam === "ClockOut")) {
      setLogbookText("");
      setLogbookPrompt({ shiftId, type: logbookTypeParam });
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("logbookShiftId");
    nextParams.delete("logbookType");
    setSearchParams(nextParams, { replace: true });
  }, [currentUserId, loading, logbookShiftParam, logbookTypeParam, searchParams, setSearchParams, shifts]);

  // Clock In
  const handleClockIn = async (shiftId: number) => {
    try {
      const res = await apiFetch(`/api/shifts/${shiftId}/clock-in`, {
        method: "PATCH",
      });
      if (res.ok) {
        await loadData();
        setLogbookText("");
        setLogbookPrompt({ shiftId, type: "ClockIn" });
        window.dispatchEvent(new Event("careapp:alerts-updated"));
      } else {
        const data = await res.json();
        alert(data.message || "Failed to clock in");
      }
    } catch {
      alert("Clock-in error");
    }
  };

  const handleAcceptShift = async (shiftId: number) => {
    try {
      const response = await apiFetch(`/api/shifts/${shiftId}/accept`, { method: "PATCH" });
      if (response.ok) {
        await loadData();
        alert("Shift offer accepted. You can now clock in when the shift begins.");
      } else {
        const body = await response.json().catch(() => null);
        alert(body?.message || "Could not accept this shift offer.");
      }
    } catch {
      alert("Could not accept this shift offer.");
    }
  };

  // Clock Out
  const handleClockOut = async (shiftId: number) => {
    try {
      const res = await apiFetch(`/api/shifts/${shiftId}/clock-out`, {
        method: "PATCH",
      });
      if (res.ok) {
        await loadData();
        setLogbookText("");
        setLogbookPrompt({ shiftId, type: "ClockOut" });
        window.dispatchEvent(new Event("careapp:alerts-updated"));
      } else {
        const data = await res.json();
        alert(data.message || "Failed to clock out");
      }
    } catch {
      alert("Clock-out error");
    }
  };

  const handleSubmitLogbookEntry = async () => {
    if (!logbookPrompt || !logbookText.trim()) return;
    const prompt = logbookPrompt;

    setLogbookSubmitting(true);
    try {
      const response = await apiFetch(`/api/shifts/${prompt.shiftId}/logbook`, {
        method: "POST",
        body: JSON.stringify({ type: prompt.type, content: logbookText.trim() }),
      });
      if (response.ok) {
        setLogbookPrompt(null);
        setLogbookText("");
        window.dispatchEvent(new Event("careapp:alerts-updated"));
        if (prompt.type === "General") {
          await handleViewLogbook(prompt.shiftId);
        }
      } else {
        const body = await response.json().catch(() => null);
        alert(body?.message || "Could not save the logbook entry.");
      }
    } catch {
      alert("Could not save the logbook entry.");
    } finally {
      setLogbookSubmitting(false);
    }
  };

  const handleViewLogbook = async (shiftId: number) => {
    setViewLogbookShiftId(shiftId);
    setLoadingLogbook(true);
    try {
      const response = await apiFetch(`/api/shifts/${shiftId}/logbook`);
      setLogbookEntries(response.ok ? await response.json() : []);
    } catch {
      setLogbookEntries([]);
    } finally {
      setLoadingLogbook(false);
    }
  };

  const handleAddLogbookEntry = () => {
    if (viewLogbookShiftId === null) return;
    setLogbookPrompt({ shiftId: viewLogbookShiftId, type: "General" });
    setLogbookText("");
    setViewLogbookShiftId(null);
  };

  const submitDeclineRequest = async () => {
    if (declineShiftId === null || declineReason.trim().length < 3) return;
    setDeclineSubmitting(true);
    try {
      const response = await apiFetch(`/api/carer-requests/shifts/${declineShiftId}/decline`, {
        method: "POST",
        body: JSON.stringify({ reason: declineReason.trim() }),
      });
      if (response.ok) {
        setDeclineShiftId(null);
        setDeclineReason("");
        alert("Request sent. You remain assigned to this shift unless Admin or Manager approves the decline.");
      } else {
        const body = await response.json().catch(() => null);
        alert(body?.message || "Could not submit the decline request.");
      }
    } catch {
      alert("Could not submit the decline request.");
    } finally {
      setDeclineSubmitting(false);
    }
  };

  // Submit Handover Note
  const handleSubmitHandover = async (shiftId: number) => {
    if (!handoverText.trim()) {
      alert("Please enter note content.");
      return;
    }
    try {
      const res = await apiFetch(`/api/shifts/${shiftId}/handover-notes`, {
        method: "POST",
        body: JSON.stringify({ contentMarkdown: handoverText }),
      });

      if (res.ok) {
        setHandoverShiftId(null);
        setHandoverText("");
        alert("Handover note saved successfully!");
        await loadData();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to save handover note.");
      }
    } catch {
      alert("Failed submitting handover note.");
    }
  };

  // Load Handover Notes for viewing
  const handleViewHandoverNotes = async (shiftId: number) => {
    setViewNotesShiftId(shiftId);
    setLoadingNotes(true);
    try {
      const res = await apiFetch(`/api/shifts/${shiftId}/handover-notes`);
      if (res.ok) {
        setHandoverNotesList(await res.json());
      } else {
        setHandoverNotesList([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingNotes(false);
    }
  };

  // Check 24 hour window requirement for handover submission
  const isWithin24Hours = (shift: Shift) => {
    const myAssignment = shift.carerAssignments?.find(
      (a) => a.carerId === currentUser?.id,
    );
    const end = myAssignment?.actualEndTime
      ? new Date(myAssignment.actualEndTime)
      : new Date(shift.endTime);

    const now = new Date();
    const diffHours = (now.getTime() - end.getTime()) / (1000 * 60 * 60);
    return diffHours >= 0 && diffHours <= 24;
  };

  const now = new Date();
  const isCoverRequestClosed = (shift: Shift) =>
    new Date(shift.startTime).getTime() - now.getTime() < minimumCoverLeadTimeHours * 60 * 60 * 1000;
  const isTerminalShift = (shift: Shift) =>
    shift.status === 3 || shift.status === 4 ||
    shift.status === "Completed" || shift.status === "Cancelled";

  const upcomingShifts = shifts
    .filter((shift) => !isTerminalShift(shift) && new Date(shift.endTime) >= now)
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

  const previousShifts = shifts
    .filter((shift) => isTerminalShift(shift) || new Date(shift.endTime) < now)
    .sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    );

  const displayedShifts =
    activeTab === "upcoming" ? upcomingShifts : previousShifts;

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-2xl backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            My Shift Portal
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track your schedule, log attendance, inspect client details, and
            record handovers.
          </p>
        </div>

        <div className="inline-flex p-1.5 rounded-xl bg-slate-950 border border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "upcoming"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Upcoming Shifts ({upcomingShifts.length})
          </button>
          <button
            onClick={() => setActiveTab("previous")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "previous"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Previous Shifts ({previousShifts.length})
          </button>
        </div>
      </div>

      {/* Shifts Grid */}
      {loading ? (
        <div className="h-64 rounded-2xl bg-slate-900/50 border border-slate-800 animate-pulse" />
      ) : displayedShifts.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 text-slate-400 text-center text-sm">
          No {activeTab} shifts found for your account.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedShifts.map((shift) => {
            const client = shift.clientId == null ? undefined : clients[shift.clientId];
            const myAssignment = shift.carerAssignments?.find(
              (a) => a.carerId === currentUser?.id,
            );
            const isClockedIn =
              myAssignment?.status === 1 ||
              (myAssignment?.actualStartTime && !myAssignment?.actualEndTime);
            const isCompleted =
              myAssignment?.status === 2 || !!myAssignment?.actualEndTime;
            const isAwaitingAcceptance = myAssignment?.status === 0;
            const isAccepted = myAssignment?.status === 5 || isClockedIn || isCompleted;
            const canHandover =
              isWithin24Hours(shift) && (isCompleted || isClockedIn);

            return (
              <div
                key={shift.id}
                className="rounded-2xl bg-slate-900/70 border border-slate-800/80 p-5 shadow-xl flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-950/60 text-blue-400 border border-blue-800/50">
                      📅{" "}
                      {new Date(shift.startTime).toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    {isClockedIn ? (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 flex items-center gap-1 animate-pulse">
                        🟢 Clocked In
                      </span>
                    ) : isCompleted ? (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        ✅ Completed
                      </span>
                    ) : isAwaitingAcceptance ? (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full border border-amber-800/50 bg-amber-950/60 px-2.5 py-1 text-amber-300">
                        ⏳ Awaiting acceptance
                      </span>
                    ) : isAccepted ? (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-800/50 bg-emerald-950/50 text-emerald-300">
                        ✓ Accepted
                      </span>
                    ) : (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/50">
                        ⏳ Scheduled
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-white">
                    {shift.locationId != null
                      ? `Location: ${shift.locationName ?? `#${shift.locationId}`}`
                      : `Service User: ${client ? `${client.firstName} ${client.lastName}` : `#${shift.clientId}`}`}
                  </h3>
                  {shift.locationId != null && (
                    <div className="mt-2 rounded-lg bg-slate-950/70 border border-slate-800 p-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Service users at this location</p>
                      {shift.locationServiceUsers?.length ? (
                        <ul className="mt-1 text-xs text-slate-200 space-y-0.5">
                          {shift.locationServiceUsers.map((serviceUser) => (
                            <li key={serviceUser.id}>{serviceUser.preferredName || `${serviceUser.firstName} ${serviceUser.lastName}`}</li>
                          ))}
                        </ul>
                      ) : <p className="mt-1 text-xs text-slate-500">No service users are currently assigned to this location.</p>}
                    </div>
                  )}

                  <p className="text-xs text-slate-300 mt-1">
                    🕒 <strong>Shift Time:</strong>{" "}
                    {new Date(shift.startTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    –{" "}
                    {new Date(shift.endTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>

                  {myAssignment?.actualStartTime && (
                    <p className="text-[11px] text-emerald-400 mt-0.5">
                      <strong>Actual Clock-in:</strong>{" "}
                      {new Date(
                        myAssignment.actualStartTime,
                      ).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                  {myAssignment?.actualEndTime && (
                    <p className="text-[11px] text-blue-400 mt-0.5">
                      <strong>Actual Clock-out:</strong>{" "}
                      {new Date(myAssignment.actualEndTime).toLocaleTimeString(
                        [],
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800/80">
                  {/* Service User Info Button */}
                  {client && (
                    <button
                      onClick={() => setSelectedClient(client)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer transition-all"
                    >
                      🏡 Client Info & Address
                    </button>
                  )}

                  {/* Read Previous Handover Notes */}
                  <button
                    onClick={() => handleViewHandoverNotes(shift.id)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-950/50 hover:bg-indigo-900/60 border border-indigo-800/50 text-indigo-300 text-xs font-medium cursor-pointer transition-all"
                  >
                    📖 Read Handovers
                  </button>
                  <button
                    onClick={() => void handleViewLogbook(shift.id)}
                    className="rounded-xl border border-cyan-800/50 bg-cyan-950/40 px-3 py-1.5 text-xs font-medium text-cyan-300 transition hover:bg-cyan-900/60"
                  >
                    📔 Shift Logbook
                  </button>

                  {/* Clock In/Out Actions */}
                  {isAwaitingAcceptance && activeTab === "upcoming" && (
                    <button
                      type="button"
                      onClick={() => void handleAcceptShift(shift.id)}
                      className="ml-auto rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500"
                    >
                      Accept shift
                    </button>
                  )}

                  {isAccepted && !isCompleted && !isClockedIn && activeTab === "upcoming" && (
                    <button
                      onClick={() => handleClockIn(shift.id)}
                      className="ml-auto px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                    >
                      🟢 Clock In
                    </button>
                  )}

                  {isClockedIn && (
                    <button
                      onClick={() => handleClockOut(shift.id)}
                      className="ml-auto px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 active:scale-95 transition-all cursor-pointer"
                    >
                      🔴 Clock Out
                    </button>
                  )}

                  {activeTab === "upcoming" &&
                    !isClockedIn &&
                    !isCompleted &&
                    shift.status !== "Cancelled" &&
                    shift.status !== 4 && (
                      <button
                        type="button"
                        disabled={isCoverRequestClosed(shift)}
                        onClick={() => {
                          setDeclineShiftId(shift.id);
                          setDeclineReason("");
                        }}
                        title={isCoverRequestClosed(shift) ? `Cover requests close ${minimumCoverLeadTimeHours} hours before the shift.` : undefined}
                        className="rounded-xl border border-amber-800/60 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-900/50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isCoverRequestClosed(shift) ? "Cover request closed" : "Request cover"}
                      </button>
                    )}

                  {/* Submit Handover Note */}
                  {canHandover && (
                    <button
                      onClick={() => {
                        setHandoverShiftId(shift.id);
                        setHandoverText("");
                      }}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
                    >
                      📝 Write Handover
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SERVICE USER BASIC INFO & ADDRESS MODAL */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🏡</span> Service User Profile
            </h3>

            <div className="space-y-3 text-xs bg-slate-950 border border-slate-800 p-4 rounded-xl text-slate-200">
              <p>
                <strong className="text-white">Name:</strong>{" "}
                {selectedClient.preferredName || `${selectedClient.firstName} ${selectedClient.lastName}`}
              </p>
              <p>
                <strong className="text-white">Postcode:</strong>{" "}
                {selectedClient.postcode || "N/A"}
              </p>
              {selectedClient.dateOfBirth && <p><strong className="text-white">Date of birth:</strong> {new Date(`${selectedClient.dateOfBirth}T00:00:00`).toLocaleDateString()}</p>}
              <p>
                <strong className="text-white">Address Details:</strong>
                <br />
                <span className="text-slate-300 mt-1 block whitespace-pre-wrap">
                  {selectedClient.addressDetails || "No address specified."}
                </span>
              </p>
              <div className="pt-2 border-t border-slate-800">
                <strong className="text-white">
                  Care Plan Summary / Notes:
                </strong>
                <p className="text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">
                  {selectedClient.carePlanSummary ||
                    "No care plan notes available."}
                </p>
              </div>
            </div>

            <button
              onClick={() => setSelectedClient(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* WRITE HANDOVER NOTE MODAL (24h Window) */}
      {handoverShiftId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>📝</span> Submit Shift Handover Note
            </h3>
            <p className="text-xs text-slate-400">
              Notes can be submitted within 24 hours of completing your shift.
            </p>

            <textarea
              rows={6}
              placeholder="Record medication details, dietary logs, behavioral notes, or key handover points..."
              value={handoverText}
              onChange={(e) => setHandoverText(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-white focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
            />

            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => setHandoverShiftId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSubmitHandover(handoverShiftId)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer shadow-lg shadow-blue-500/20"
              >
                Save Handover Note
              </button>
            </div>
          </div>
        </div>
      )}

      {logbookPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="shift-logbook-prompt-title"
            className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl sm:p-6"
          >
            <div>
              <h2 id="shift-logbook-prompt-title" className="text-lg font-bold text-white">
                {logbookPrompt.type === "ClockIn"
                  ? "Start-of-shift logbook"
                  : logbookPrompt.type === "ClockOut"
                    ? "End-of-shift logbook"
                    : "Add logbook entry"}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {logbookPrompt.type === "General"
                  ? "This entry will be added to the shift's in-app logbook."
                  : "Make the matching entry in the service user's physical record book as well. This in-app logbook does not replace that record. You can finish the app entry later from My Alerts."}
              </p>
            </div>
            <label className="block space-y-2 text-sm font-medium text-slate-200">
              Logbook entry
              <textarea
                autoFocus
                rows={5}
                maxLength={5000}
                value={logbookText}
                onChange={(event) => setLogbookText(event.target.value)}
                placeholder="Record relevant observations and care information..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setLogbookPrompt(null)}
                disabled={logbookSubmitting}
                className="min-h-10 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
              >
                Later
              </button>
              <button
                type="button"
                onClick={handleSubmitLogbookEntry}
                disabled={logbookSubmitting || !logbookText.trim()}
                className="min-h-10 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {logbookSubmitting ? "Saving..." : "Save app logbook entry"}
              </button>
            </div>
          </section>
        </div>
      )}

      {declineShiftId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
          <section role="dialog" aria-modal="true" aria-labelledby="decline-shift-title" className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl sm:p-6">
            <div>
              <h2 id="decline-shift-title" className="text-lg font-bold text-white">Request to decline shift?</h2>
              <p className="mt-1 text-sm text-slate-400">You remain assigned and responsible for this shift unless an Admin or Manager approves your request.</p>
            </div>
            <label className="block space-y-2 text-sm font-medium text-slate-200">
              Reason for request
              <textarea required minLength={3} maxLength={1000} rows={4} value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" disabled={declineSubmitting} onClick={() => setDeclineShiftId(null)} className="min-h-10 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50">Cancel</button>
              <button type="button" disabled={declineSubmitting || declineReason.trim().length < 3} onClick={submitDeclineRequest} className="min-h-10 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50">{declineSubmitting ? "Sending..." : "Send request"}</button>
            </div>
          </section>
        </div>
      )}

      {viewLogbookShiftId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="shift-logbook-title"
            className="flex max-h-[85dvh] w-full max-w-2xl flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl sm:p-6"
          >
            <h2 id="shift-logbook-title" className="text-lg font-bold text-white">Shift Logbook</h2>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
              {loadingLogbook ? (
                <p className="text-sm text-slate-400">Loading logbook...</p>
              ) : logbookEntries.length === 0 ? (
                <p className="text-sm text-slate-400">No logbook entries recorded for this shift yet.</p>
              ) : logbookEntries.map((entry) => (
                <article key={entry.id} className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-cyan-300">{entry.type} · {entry.carerName}</span>
                    <time className="text-slate-500">{new Date(entry.createdAt).toLocaleString()}</time>
                  </div>
                  <p className="whitespace-pre-wrap wrap-break-word text-sm text-slate-200">{entry.content}</p>
                </article>
              ))}
            </div>
              <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setViewLogbookShiftId(null)}
                  className="min-h-10 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleAddLogbookEntry}
                  disabled={loadingLogbook}
                  className="min-h-10 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:cursor-wait disabled:opacity-50"
                >
                  Add entry
                </button>
              </div>
          </section>
        </div>
      )}

      {/* READ HANDOVER NOTES MODAL */}
      {viewNotesShiftId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>📖</span> Previous Handover Notes
            </h3>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loadingNotes ? (
                <p className="text-xs text-slate-400">Loading notes...</p>
              ) : handoverNotesList.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  No handover notes recorded for this shift yet.
                </p>
              ) : (
                handoverNotesList.map((note) => (
                  <div
                    key={note.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5"
                  >
                    <div className="flex justify-between items-center text-slate-400 text-[11px]">
                      <span className="font-bold text-blue-400">
                        👤 {note.carerName || `Carer #${note.carerId}`}
                      </span>
                      <span>{new Date(note.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {note.contentMarkdown}
                    </p>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setViewNotesShiftId(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer mt-2"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
