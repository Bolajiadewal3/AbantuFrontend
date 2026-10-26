import { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../utils/api";
import { authStorage } from "../utils/auth";

interface ServiceUser {
  id: number;
  firstName: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth?: string | null;
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

type ModalTab = "details" | "team" | "handovers";

export default function CarerCalendar() {
  const currentUser = authStorage.getUser();

  // Navigation & Data States
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [clients, setClients] = useState<Record<number, ServiceUser>>({});
  const [loading, setLoading] = useState(true);

  // Selected Shift & Modal State
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<ModalTab>("details");

  // Handover Note Editing State (24-hour window)
  const [noteContent, setNoteContent] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  // 14-day Handover History State
  const [clientHandoverHistory, setClientHandoverHistory] = useState<
    HandoverNote[]
  >([]);
  const [loadingHandovers, setLoadingHandovers] = useState(false);

  // Load calendar & shift data
  const loadCalendarData = async () => {
    setLoading(true);
    try {
      const [shiftsRes, clientsRes] = await Promise.all([
        apiFetch("/api/shifts"),
        apiFetch("/api/serviceUsers/active"),
      ]);

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
        // Filter shifts assigned to current carer
        const myShifts = allShifts.filter((s) =>
          s.carerAssignments?.some((a) => a.carerId === currentUser?.id),
        );
        setShifts(myShifts);
      }
    } catch (err) {
      console.error("Failed to load calendar data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalendarData();
  }, []);

  // Check if shift is within the 24-hour edit window from completion
  const checkIsWithin24Hours = (shift: Shift) => {
    const myAssignment = shift.carerAssignments?.find(
      (a) => a.carerId === currentUser?.id,
    );
    const endTime = myAssignment?.actualEndTime
      ? new Date(myAssignment.actualEndTime)
      : new Date(shift.endTime);

    const now = new Date();
    const hoursDiff = (now.getTime() - endTime.getTime()) / (1000 * 60 * 60);

    // Shift must be completed or past end time, and within 24 hours
    return hoursDiff >= 0 && hoursDiff <= 24;
  };

  // Open Shift Details Modal
  const handleSelectShift = async (shift: Shift) => {
    setSelectedShift(shift);
    setActiveModalTab("details");
    setNoteContent("");

    // Fetch existing note for this shift
    try {
      const noteRes = await apiFetch(`/api/shifts/${shift.id}/handover-notes`);
      if (noteRes.ok) {
        const notes: HandoverNote[] = await noteRes.json();
        const myNote = notes.find((n) => n.carerId === currentUser?.id);
        if (myNote) {
          setNoteContent(myNote.contentMarkdown);
        }
      }
    } catch (err) {
      console.error("Error fetching shift note:", err);
    }

    if (shift.clientId != null) {
      void fetch14DayHandovers(shift.clientId);
    } else {
      setClientHandoverHistory([]);
      setLoadingHandovers(false);
    }
  };

  // Fetch Handover Notes going back 14 days for a given client
  const fetch14DayHandovers = async (clientId: number) => {
    setLoadingHandovers(true);
    try {
      const res = await apiFetch(
        `/api/serviceUsers/${clientId}/handover-notes?days=14`,
      );
      if (res.ok) {
        const history: HandoverNote[] = await res.json();
        setClientHandoverHistory(history);
      } else {
        // Fallback: search through shift notes
        const allShiftNotesRes = await apiFetch(
          `/api/shifts/client/${clientId}/handover-notes`,
        );
        if (allShiftNotesRes.ok) {
          const notes: HandoverNote[] = await allShiftNotesRes.json();
          const fourteenDaysAgo = new Date();
          fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

          const filtered = notes.filter(
            (n) => new Date(n.createdAt) >= fourteenDaysAgo,
          );
          setClientHandoverHistory(filtered);
        } else {
          setClientHandoverHistory([]);
        }
      }
    } catch (err) {
      console.error("Error fetching handover history:", err);
      setClientHandoverHistory([]);
    } finally {
      setLoadingHandovers(false);
    }
  };

  // Save/Update Note within 24 hours
  const handleSaveNote = async () => {
    if (!selectedShift || !noteContent.trim()) return;

    setIsSavingNote(true);
    try {
      const res = await apiFetch(
        `/api/shifts/${selectedShift.id}/handover-notes`,
        {
          method: "POST",
          body: JSON.stringify({ contentMarkdown: noteContent }),
        },
      );

      if (res.ok) {
        alert("Note saved successfully!");
        handleSelectShift(selectedShift); // Refresh modal data
      } else {
        const errData = await res.json();
        alert(errData.message || "Failed to save note.");
      }
    } catch (err) {
      alert("Error saving shift note.");
    } finally {
      setIsSavingNote(false);
    }
  };

  // Month Grid Calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysCount = new Date(year, month + 1, 0).getDate();

    const paddingDays = Array.from({ length: firstDay });
    const monthDays = Array.from({ length: daysCount }, (_, i) => i + 1);

    return { paddingDays, monthDays };
  }, [year, month]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const isSameDay = (d1: Date, dayNum: number) => {
    return (
      d1.getDate() === dayNum &&
      d1.getMonth() === month &&
      d1.getFullYear() === year
    );
  };

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-2xl backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            {currentDate.toLocaleDateString("default", {
              month: "long",
              year: "numeric",
            })}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Click on any shift to view service user details, team members, and
            14-day handover history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition-all"
          >
            ← Prev
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer shadow-lg shadow-blue-500/20 transition-all"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition-all"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800/80 overflow-hidden shadow-2xl">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 bg-slate-950/80 border-b border-slate-800 text-center font-bold text-xs text-slate-400 py-3">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Days Grid */}
        {loading ? (
          <div className="h-96 flex items-center justify-center text-slate-400 text-sm animate-pulse">
            Loading calendar shifts...
          </div>
        ) : (
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-800/60 auto-rows-fr min-h-[520px]">
            {/* Blank padding cells */}
            {daysInMonth.paddingDays.map((_, index) => (
              <div
                key={`pad-${index}`}
                className="bg-slate-950/30 p-2 min-h-[100px]"
              />
            ))}

            {/* Month Day cells */}
            {daysInMonth.monthDays.map((dayNum) => {
              const dayShifts = shifts.filter((s) =>
                isSameDay(new Date(s.startTime), dayNum),
              );

              const isToday =
                new Date().getDate() === dayNum &&
                new Date().getMonth() === month &&
                new Date().getFullYear() === year;

              return (
                <div
                  key={dayNum}
                  className={`p-2 min-h-[100px] flex flex-col justify-start gap-1 transition-colors ${
                    isToday ? "bg-blue-950/20" : "hover:bg-slate-800/20"
                  }`}
                >
                  <span
                    className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? "bg-blue-600 text-white" : "text-slate-400"
                    }`}
                  >
                    {dayNum}
                  </span>

                  {/* Shift Cards in Day Cell */}
                  <div className="space-y-1 mt-1">
                    {dayShifts.map((shift) => {
                      const client = shift.clientId == null ? undefined : clients[shift.clientId];
                      const canEditNote = checkIsWithin24Hours(shift);

                      return (
                        <div
                          key={shift.id}
                          onClick={() => handleSelectShift(shift)}
                          className="p-1.5 rounded-lg bg-slate-800/90 border border-slate-700/80 hover:border-blue-500 cursor-pointer text-[11px] transition-all hover:scale-[1.02] space-y-0.5 shadow-sm"
                        >
                          <div className="font-bold text-white truncate">
                            {shift.locationId != null
                              ? `Location: ${shift.locationName ?? `#${shift.locationId}`}`
                              : `Service User: ${client ? `${client.firstName} ${client.lastName}` : `#${shift.clientId}`}`}
                          </div>
                          {shift.locationId != null && shift.locationServiceUsers?.length ? (
                            <div className="text-[9px] text-slate-300 truncate">
                              Service users: {shift.locationServiceUsers.map((serviceUser) => serviceUser.preferredName || `${serviceUser.firstName} ${serviceUser.lastName}`).join(", ")}
                            </div>
                          ) : null}
                          <div className="text-slate-400 text-[10px]">
                            {new Date(shift.startTime).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          {shift.requiredCarers > 1 && (
                            <span className="inline-block px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-300 text-[9px] border border-purple-800/50">
                              👥 Multi-carer (
                              {shift.carerAssignments?.length || 1}/
                              {shift.requiredCarers})
                            </span>
                          )}
                          {canEditNote && (
                            <span className="inline-block px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 text-[9px] border border-emerald-800/50 ml-1">
                              ✏️ Note Window Active
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SHIFT & HANDOVER DETAILS TABBED MODAL */}
      {selectedShift && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            {/* Modal Title */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>📅</span> Shift Details
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Date(selectedShift.startTime).toLocaleString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  –{" "}
                  {new Date(selectedShift.endTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              <button
                onClick={() => setSelectedShift(null)}
                className="text-slate-400 hover:text-white p-1 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
              <button
                onClick={() => setActiveModalTab("details")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  activeModalTab === "details"
                    ? "bg-blue-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {selectedShift.locationId != null ? "📍 Location & Notes" : "🏡 Service User & Notes"}
              </button>
              <button
                onClick={() => setActiveModalTab("team")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  activeModalTab === "team"
                    ? "bg-blue-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                👥 Shift Team ({selectedShift.carerAssignments?.length || 1})
              </button>
              <button
                disabled={selectedShift.clientId == null}
                onClick={() => setActiveModalTab("handovers")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  activeModalTab === "handovers"
                    ? "bg-blue-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                📖 14-Day Handovers
              </button>
            </div>

            {/* Tab 1: Client Details & 24-Hour Editable Shift Notes */}
            {activeModalTab === "details" && (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Client Profile Summary */}
                {selectedShift.clientId != null && clients[selectedShift.clientId] && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs text-slate-300">
                    <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                      <span>👤</span>{" "}
                      {clients[selectedShift.clientId].firstName}{" "}
                      {clients[selectedShift.clientId].lastName}
                    </h4>
                    <p>
                      <strong className="text-slate-200">Address:</strong>{" "}
                      {clients[selectedShift.clientId].addressDetails ||
                        "No address recorded"}
                      {clients[selectedShift.clientId].postcode &&
                        `, ${clients[selectedShift.clientId].postcode}`}
                    </p>
                    <div className="pt-2 border-t border-slate-800/80">
                      <strong className="text-slate-200">
                        Care Plan Summary:
                      </strong>
                      <p className="text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">
                        {clients[selectedShift.clientId].carePlanSummary ||
                          "No care plan summary provided."}
                      </p>
                    </div>
                  </div>
                )}

                {selectedShift.locationId != null && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs text-slate-300">
                    <h4 className="font-bold text-white text-sm">Location: {selectedShift.locationName ?? `#${selectedShift.locationId}`}</h4>
                    <p className="font-semibold text-slate-200">Service users at this location:</p>
                    {selectedShift.locationServiceUsers?.length ? (
                      <ul className="list-disc list-inside space-y-1">
                        {selectedShift.locationServiceUsers.map((serviceUser) => (
                          <li key={serviceUser.id}>{serviceUser.preferredName || `${serviceUser.firstName} ${serviceUser.lastName}`}</li>
                        ))}
                      </ul>
                    ) : <p>No service users are currently assigned to this location.</p>}
                  </div>
                )}

                {/* Shift Note Box with 24-Hour Rule Check */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <span>📝</span> My Shift Handover Note
                    </h4>
                    {checkIsWithin24Hours(selectedShift) ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                        🟢 Editable (Within 24 Hours)
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        🔒 Read-Only (Window Closed)
                      </span>
                    )}
                  </div>

                  <textarea
                    rows={4}
                    disabled={!checkIsWithin24Hours(selectedShift)}
                    placeholder={
                      checkIsWithin24Hours(selectedShift)
                        ? "Enter observations, food logs, medication records, or handover notes for this shift..."
                        : "Notes for this shift can no longer be edited as the 24-hour window post-shift has passed."
                    }
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
                  />

                  {checkIsWithin24Hours(selectedShift) && (
                    <div className="flex justify-end">
                      <button
                        onClick={handleSaveNote}
                        disabled={isSavingNote || !noteContent.trim()}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-blue-500/20 cursor-pointer"
                      >
                        {isSavingNote ? "Saving..." : "Save Note"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Team Members on Shift */}
            {activeModalTab === "team" && (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                <p className="text-xs text-slate-400">
                  Required carers for this shift:{" "}
                  <strong className="text-white">
                    {selectedShift.requiredCarers}
                  </strong>
                </p>

                <div className="space-y-2">
                  {selectedShift.carerAssignments &&
                  selectedShift.carerAssignments.length > 0 ? (
                    selectedShift.carerAssignments.map((assignment, index) => {
                      const isSelf = assignment.carerId === currentUser?.id;

                      return (
                        <div
                          key={index}
                          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                            isSelf
                              ? "bg-blue-950/40 border-blue-800/60 text-blue-200"
                              : "bg-slate-950 border-slate-800 text-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-xs">
                              {assignment.carerName.charAt(0)}
                            </span>
                            <div>
                              <p className="font-bold text-white">
                                {assignment.carerName} {isSelf && "(You)"}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                Assigned Carer Slot #{index + 1}
                              </p>
                            </div>
                          </div>

                          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
                            Active Team Member
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      No carers assigned to this shift yet.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: 14-Day Handover History for Service User */}
            {activeModalTab === "handovers" && (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300">
                  Showing handover history for{" "}
                  <strong className="text-white">
                    {selectedShift.clientId != null && clients[selectedShift.clientId]
                      ? `${clients[selectedShift.clientId].firstName} ${clients[selectedShift.clientId].lastName}`
                      : `Service User #${selectedShift.clientId}`}
                  </strong>{" "}
                  over the past 14 days.
                </div>

                {loadingHandovers ? (
                  <div className="p-6 text-center text-xs text-slate-400 animate-pulse">
                    Fetching 14-day handover history...
                  </div>
                ) : clientHandoverHistory.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 italic rounded-xl bg-slate-950 border border-slate-800">
                    No handover notes recorded for this client in the last 14
                    days.
                  </div>
                ) : (
                  clientHandoverHistory.map((note) => (
                    <div
                      key={note.id}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1.5 border-b border-slate-800/80">
                        <span className="font-bold text-blue-400 flex items-center gap-1">
                          <span>👤</span>{" "}
                          {note.carerName || `Carer #${note.carerId}`}
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
            )}

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedShift(null)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
