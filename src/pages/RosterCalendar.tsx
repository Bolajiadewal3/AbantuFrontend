import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { authStorage } from "../utils/auth";
import "./RosterCalendar.css";

interface User {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
  maxWeeklyHours?: number;
}

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

interface ReplacementHistoryEntry {
  id: number;
  replacedAt: string;
  reason: string;
  outgoingCarerHadClockedIn: boolean;
  outgoingClockInAt?: string;
  outgoingCarer: string;
  replacementCarer: string;
  replacedBy: string;
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

type DuplicateConflictAction = "KeepExisting" | "UseCopy";

interface DuplicateWeekConflictPreview {
  shiftId: number;
  startTime: string;
  endTime: string;
  status: number | string;
  hasAssignments: boolean;
  canReplace: boolean;
  reason: string | null;
}

interface DuplicateWeekShiftPreview {
  sourceShiftId: number;
  targetStartTime: string;
  targetEndTime: string;
  conflicts: DuplicateWeekConflictPreview[];
}

interface ApiResponseBody {
  message?: string;
  [key: string]: unknown;
}

const readApiResponseBody = async (response: Response): Promise<ApiResponseBody | null> => {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null
      ? parsed as ApiResponseBody
      : null;
  } catch {
    return null;
  }
};

const getDuplicateApiError = (
  body: ApiResponseBody | null,
  response: Response,
  operation: string,
) => {
  if (body?.message) return body.message;
  if (response.status === 404) {
    return `${operation} endpoint not found (HTTP 404). The backend may need to load the latest API version.`;
  }
  return `${operation} failed with HTTP ${response.status}.`;
};

export default function RosterCalendar() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [carers, setCarers] = useState<User[]>([]);
  const [clients, setClients] = useState<ServiceUser[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const [highlightedCarerIds, setHighlightedCarerIds] = useState<number[]>([]);
  const [preferredCarerIds, setPreferredCarerIds] = useState<number[]>([]);
  const [optedOutCarerIds, setOptedOutCarerIds] = useState<number[]>([]);
  const [candidateCarers, setCandidateCarers] = useState<CarerCandidate[]>([]);

  // Modal States
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [publishingShiftId, setPublishingShiftId] = useState<number | null>(null);
  const [duplicateTargetDate, setDuplicateTargetDate] = useState("");
  const [duplicateKeepCarers, setDuplicateKeepCarers] = useState(false);
  const [duplicatePreview, setDuplicatePreview] = useState<DuplicateWeekShiftPreview[] | null>(null);
  const [duplicateResolutions, setDuplicateResolutions] = useState<Record<number, DuplicateConflictAction>>({});
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [duplicateError, setDuplicateError] = useState("");
  const [replacementTarget, setReplacementTarget] = useState<ShiftCarerAssignment | null>(null);
  const [replacementCarerId, setReplacementCarerId] = useState("");
  const [replacementReason, setReplacementReason] = useState("");
  const [replacementHistory, setReplacementHistory] = useState<ReplacementHistoryEntry[]>([]);
  const [replacementHistoryError, setReplacementHistoryError] = useState("");

  // Form state
  const [formTargetType, setFormTargetType] = useState<"client" | "location">("client");
  const [formClientId, setFormClientId] = useState<number | "">("");
  const [formLocationId, setFormLocationId] = useState<number | "">("");
  const [formStartTime, setFormStartTime] = useState<string>("");
  const [formEndTime, setFormEndTime] = useState<string>("");
  const [formRequiredCarers, setFormRequiredCarers] = useState<number>(1);
  const [formHandoverNotes, setFormHandoverNotes] = useState<string>("");
  const [formIsDraft, setFormIsDraft] = useState<boolean>(true);
  const [pastShiftOverrideReason, setPastShiftOverrideReason] = useState("");

  const loadCalendarData = async () => {
    setLoading(true);
    setError("");
    try {
      const [shiftsRes, carersRes, clientsRes, locationsRes] = await Promise.all([
        apiFetch("/api/shifts"),
        apiFetch("/api/users/active"),
        apiFetch("/api/serviceUsers/active"),
        apiFetch("/api/locations"),
      ]);

      if (shiftsRes.ok) setShifts(await shiftsRes.json());
      if (carersRes.ok) {
        const users: User[] = await carersRes.json();
        setCarers(users.filter((u) => u.role === "Carer"));
      }
      if (clientsRes.ok) setClients(await clientsRes.json());
      if (locationsRes.ok) setLocations(await locationsRes.json());
    } catch {
      setError("Failed to load roster data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalendarData();
  }, []);

  const selectedShiftId = selectedShift?.id;

  useEffect(() => {
    if (!selectedShiftId) {
      setReplacementHistory([]);
      setReplacementHistoryError("");
      return;
    }

    let cancelled = false;
    const loadReplacementHistory = async () => {
      setReplacementHistoryError("");
      try {
        const response = await apiFetch(
          `/api/shifts/${selectedShiftId}/replacement-history`,
        );
        if (!response.ok) throw new Error("Could not load replacement history.");
        const history: ReplacementHistoryEntry[] = await response.json();
        if (!cancelled) setReplacementHistory(history);
      } catch {
        if (!cancelled) setReplacementHistoryError("Could not load replacement history.");
      }
    };

    void loadReplacementHistory();
    return () => {
      cancelled = true;
    };
  }, [selectedShiftId]);

  const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day;
    return new Date(date.setDate(diff));
  };

  const startOfWeek = getStartOfWeek(currentDate);

  const weekDays = Array.from({ length: 7 }).map((_, index) => {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + index);
    return day;
  });

  const endOfWeek = weekDays[6];

  const prevWeek = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 7);
    setCurrentDate(prev);
    setHighlightedCarerIds([]);
  };

  const nextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    setCurrentDate(next);
    setHighlightedCarerIds([]);
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const getShiftsForDay = (targetDate: Date) => {
    return shifts.filter((shift) => {
      const start = new Date(shift.startTime);
      const end = new Date(shift.endTime);
      const dayStart = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
      );
      const dayEnd = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
        23,
        59,
        59,
      );

      return start <= dayEnd && end >= dayStart;
    });
  };

  const calculateCarerWeeklyHours = (carerId: number) => {
    const weekStartObj = new Date(
      startOfWeek.getFullYear(),
      startOfWeek.getMonth(),
      startOfWeek.getDate(),
    );
    const weekEndObj = new Date(
      endOfWeek.getFullYear(),
      endOfWeek.getMonth(),
      endOfWeek.getDate(),
      23,
      59,
      59,
    );

    let totalHours = 0;

    shifts.forEach((shift) => {
      const isAssigned = shift.carerAssignments?.some(
        (a) => a.carerId === carerId,
      );
      if (!isAssigned) return;

      const shiftStart = new Date(shift.startTime);
      const shiftEnd = new Date(shift.endTime);

      if (shiftStart <= weekEndObj && shiftEnd >= weekStartObj) {
        const effectiveStart =
          shiftStart < weekStartObj ? weekStartObj : shiftStart;
        const effectiveEnd = shiftEnd > weekEndObj ? weekEndObj : shiftEnd;

        const durationMs = effectiveEnd.getTime() - effectiveStart.getTime();
        totalHours += durationMs / (1000 * 60 * 60);
      }
    });

    return Math.round(totalHours * 10) / 10;
  };

  const handleShiftClick = async (shift: Shift) => {
    setSelectedShift(shift);
    setCandidateCarers([]);
    if (shift.carerAssignments && shift.carerAssignments.length > 0) {
      setHighlightedCarerIds(shift.carerAssignments.map((a) => a.carerId));
    } else {
      setHighlightedCarerIds([]);
    }

    try {
      const candidatesRes = await apiFetch(`/api/shifts/${shift.id}/candidate-carers`);
      const candidates: CarerCandidate[] = candidatesRes.ok ? await candidatesRes.json() : [];
      setCandidateCarers(candidates);
      setPreferredCarerIds(candidates.filter((candidate) => candidate.isPreferred).map((candidate) => candidate.carerId));
      setOptedOutCarerIds(candidates.filter((candidate) => candidate.hasOptedOut).map((candidate) => candidate.carerId));
    } catch {
      setCandidateCarers([]);
      setPreferredCarerIds([]);
      setOptedOutCarerIds([]);
    }
  };

  const handleDayClick = (selectedDate: Date) => {
    const yearStr = selectedDate.getFullYear();
    const monthStr = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const dayStr = String(selectedDate.getDate()).padStart(2, "0");
    const dateFormatted = `${yearStr}-${monthStr}-${dayStr}`;

    setFormStartTime(`${dateFormatted}T09:00`);
    setFormEndTime(`${dateFormatted}T17:00`);
    setFormTargetType("client");
    setFormClientId("");
    setFormLocationId("");
    setFormRequiredCarers(1);
    setFormHandoverNotes("");
    setFormIsDraft(true);
    setPastShiftOverrideReason("");
    setShowCreateModal(true);
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((formTargetType === "client" && !formClientId) || (formTargetType === "location" && !formLocationId)) {
      alert(`Please select a ${formTargetType === "client" ? "service user" : "location"}.`);
      return;
    }

    try {
      const response = await apiFetch("/api/shifts", {
        method: "POST",
        body: JSON.stringify({
          clientId: formTargetType === "client" ? Number(formClientId) : null,
          locationId: formTargetType === "location" ? Number(formLocationId) : null,
          startTime: new Date(formStartTime).toISOString(),
          endTime: new Date(formEndTime).toISOString(),
          requiredCarers: Number(formRequiredCarers),
          handoverNotes: formHandoverNotes || null,
          isDraft: formIsDraft,
          superAdminOverrideReason: authStorage.isSuperAdmin() ? pastShiftOverrideReason.trim() || null : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to create shift");
      }

      setShowCreateModal(false);
      await loadCalendarData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openEditModal = () => {
    if (!selectedShift) return;
    setFormTargetType(selectedShift.clientId != null ? "client" : "location");
    setFormClientId(selectedShift.clientId ?? "");
    setFormLocationId(selectedShift.locationId ?? "");
    setFormStartTime(selectedShift.startTime.slice(0, 16));
    setFormEndTime(selectedShift.endTime.slice(0, 16));
    setFormRequiredCarers(selectedShift.requiredCarers);
    setFormHandoverNotes(selectedShift.handoverNotes || "");
    setFormIsDraft(
      selectedShift.status === 0 || selectedShift.status === "Draft",
    );
    setShowEditModal(true);
  };

  const handleUpdateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShift) return;

    if (
      !window.confirm("Are you sure you want to save changes to this shift?")
    ) {
      return;
    }

    try {
      const response = await apiFetch(`/api/shifts/${selectedShift.id}`, {
        method: "PUT",
        body: JSON.stringify({
          id: selectedShift.id,
          clientId: formTargetType === "client" ? Number(formClientId) : null,
          locationId: formTargetType === "location" ? Number(formLocationId) : null,
          startTime: new Date(formStartTime).toISOString(),
          endTime: new Date(formEndTime).toISOString(),
          requiredCarers: Number(formRequiredCarers),
          handoverNotes: formHandoverNotes || null,
          isDraft: formIsDraft,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to update shift");
      }

      setShowEditModal(false);
      setSelectedShift(null);
      await loadCalendarData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteShift = async () => {
    if (!selectedShift) return;

    if (
      !window.confirm(
        `Are you sure you want to permanently delete this shift for ${getShiftTargetLabel(selectedShift)}?`,
      )
    ) {
      return;
    }

    try {
      const response = await apiFetch(`/api/shifts/${selectedShift.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to delete shift");
      }

      setSelectedShift(null);
      await loadCalendarData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePublishWeek = async () => {
    if (
      !window.confirm(
        "Are you sure you want to publish all draft shifts for this week?",
      )
    )
      return;

    const weekStartObj = new Date(
      startOfWeek.getFullYear(),
      startOfWeek.getMonth(),
      startOfWeek.getDate(),
    );
    const weekEndObj = new Date(
      endOfWeek.getFullYear(),
      endOfWeek.getMonth(),
      endOfWeek.getDate(),
      23,
      59,
      59,
    );

    try {
      const response = await apiFetch("/api/shifts/publish-week", {
        method: "POST",
        body: JSON.stringify({
          weekStart: weekStartObj.toISOString(),
          weekEnd: weekEndObj.toISOString(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to publish week.");
      }

      const data = await response.json();
      alert(data.message);
      await loadCalendarData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePublishShift = async () => {
    if (!selectedShift || publishingShiftId !== null) return;
    if (!window.confirm("Publish only this shift? Assigned carers will receive an in-app offer and may receive an email.")) return;

    setPublishingShiftId(selectedShift.id);
    try {
      const response = await apiFetch(`/api/shifts/${selectedShift.id}/publish`, {
        method: "POST",
      });
      const data = await readApiResponseBody(response);
      if (!response.ok) {
        throw new Error(data?.message ?? `Failed to publish shift (HTTP ${response.status}).`);
      }

      setSelectedShift(null);
      alert(data?.message ?? "Shift published.");
      await loadCalendarData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to publish shift.");
    } finally {
      setPublishingShiftId(null);
    }
  };

  const formatDateInput = (date: Date) => {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return localDate.toISOString().slice(0, 10);
  };

  const openDuplicateModal = () => {
    const target = new Date(startOfWeek);
    target.setDate(target.getDate() + 7);
    setDuplicateTargetDate(formatDateInput(target));
    setDuplicateKeepCarers(false);
    setDuplicatePreview(null);
    setDuplicateResolutions({});
    setDuplicateError("");
    setShowDuplicateModal(true);
  };

  const handlePreviewDuplicateWeek = async () => {
    if (!duplicateTargetDate) return;
    setDuplicateLoading(true);
    setDuplicateError("");
    setDuplicatePreview(null);
    setDuplicateResolutions({});

    const sourceWeekStart = new Date(
      startOfWeek.getFullYear(),
      startOfWeek.getMonth(),
      startOfWeek.getDate(),
    );
    const sourceWeekEnd = new Date(sourceWeekStart);
    sourceWeekEnd.setDate(sourceWeekEnd.getDate() + 7);
    const targetWeekStart = new Date(`${duplicateTargetDate}T00:00:00`);
    if (targetWeekStart.getDay() !== 0) {
      setDuplicateError("Choose a Sunday to start the target week.");
      setDuplicateLoading(false);
      return;
    }

    try {
      const response = await apiFetch("/api/shifts/duplicate-week/preview", {
        method: "POST",
        body: JSON.stringify({
          sourceWeekStart: sourceWeekStart.toISOString(),
          sourceWeekEnd: sourceWeekEnd.toISOString(),
          targetWeekStart: targetWeekStart.toISOString(),
          keepCarers: duplicateKeepCarers,
        }),
      });
      const data = await readApiResponseBody(response);
      if (!response.ok) throw new Error(getDuplicateApiError(data, response, "Duplicate preview"));
      if (!Array.isArray(data?.shifts)) {
        throw new TypeError("Duplicate preview returned an empty or invalid response.");
      }
      setDuplicatePreview(data.shifts as DuplicateWeekShiftPreview[]);
    } catch (err: unknown) {
      setDuplicateError(err instanceof Error ? err.message : "Failed to preview duplicated week.");
    } finally {
      setDuplicateLoading(false);
    }
  };

  const handleDuplicateWeek = async () => {
    if (!duplicatePreview || !duplicateTargetDate) return;
    const conflicts = duplicatePreview.filter((shift) => shift.conflicts.length > 0);
    if (conflicts.some((shift) => !duplicateResolutions[shift.sourceShiftId])) return;

    const replacedCount = new Set(conflicts
      .filter((shift) => duplicateResolutions[shift.sourceShiftId] === "UseCopy")
      .flatMap((shift) => shift.conflicts.map((conflict) => conflict.shiftId))).size;
    const copiedCount = duplicatePreview.length - conflicts.filter(
      (shift) => duplicateResolutions[shift.sourceShiftId] === "KeepExisting",
    ).length;
    const confirmation = replacedCount > 0
      ? `Create ${copiedCount} copied shifts and replace ${replacedCount} unassigned Draft shifts?`
      : `Create ${copiedCount} copied shifts for the target week?`;
    if (!window.confirm(confirmation)) return;

    setDuplicateLoading(true);
    setDuplicateError("");
    const sourceWeekStart = new Date(
      startOfWeek.getFullYear(),
      startOfWeek.getMonth(),
      startOfWeek.getDate(),
    );
    const sourceWeekEnd = new Date(sourceWeekStart);
    sourceWeekEnd.setDate(sourceWeekEnd.getDate() + 7);
    const targetWeekStart = new Date(`${duplicateTargetDate}T00:00:00`);
    if (targetWeekStart.getDay() !== 0) {
      setDuplicateError("Choose a Sunday to start the target week.");
      setDuplicateLoading(false);
      return;
    }

    try {
      const response = await apiFetch("/api/shifts/duplicate-week", {
        method: "POST",
        body: JSON.stringify({
          sourceWeekStart: sourceWeekStart.toISOString(),
          sourceWeekEnd: sourceWeekEnd.toISOString(),
          targetWeekStart: targetWeekStart.toISOString(),
          keepCarers: duplicateKeepCarers,
          conflictResolutions: conflicts.map((shift) => ({
            sourceShiftId: shift.sourceShiftId,
            action: duplicateResolutions[shift.sourceShiftId],
          })),
        }),
      });
      const data = await readApiResponseBody(response);
      if (!response.ok) throw new Error(getDuplicateApiError(data, response, "Duplicate week"));
      if (!data) throw new Error("Duplicate week returned an empty response.");
      setShowDuplicateModal(false);
      const copiedCount = typeof data.count === "number" ? data.count : 0;
      const replacedCount = typeof data.replacedCount === "number" ? data.replacedCount : 0;
      const skippedCount = typeof data.skippedCount === "number" ? data.skippedCount : 0;
      alert(`${data.message ?? "Week duplicated."} ${copiedCount} copied, ${replacedCount} Draft shifts replaced, ${skippedCount} skipped.`);
      await loadCalendarData();
    } catch (err: unknown) {
      setDuplicateError(err instanceof Error ? err.message : "Failed to duplicate week.");
    } finally {
      setDuplicateLoading(false);
    }
  };

  const handleAssignSlot = async (carerId: number) => {
    if (!selectedShift) return;

    const carer = carers.find((c) => c.id === carerId);
    if (!carer) return;

    const candidate = candidateCarers.find((item) => item.carerId === carer.id);
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

    const currentHours = calculateCarerWeeklyHours(carer.id);
    const maxHours = carer.maxWeeklyHours || 40;

    const shiftDurationHours =
      (new Date(selectedShift.endTime).getTime() -
        new Date(selectedShift.startTime).getTime()) /
      (1000 * 60 * 60);

    const projectedHours = currentHours + shiftDurationHours;

    if (projectedHours > maxHours) {
      const proceed = window.confirm(
        `⚠️ WARNING: Assigning ${carer.firstName} ${carer.lastName} will bring their total weekly hours to ${projectedHours} hrs, exceeding their maximum limit of ${maxHours} hrs.\n\nDo you still wish to assign them?`,
      );
      if (!proceed) return;
    }

    try {
      const response = await apiFetch(
        `/api/shifts/${selectedShift.id}/assign`,
        {
          method: "PATCH",
          body: JSON.stringify({ carerUserId: carerId }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Assignment failed");
      }

      await loadCalendarData();
      setSelectedShift(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUnassignSingleCarer = async (carerId: number) => {
    if (!selectedShift) return;

    try {
      const response = await apiFetch(
        `/api/shifts/${selectedShift.id}/unassign/${carerId}`,
        { method: "PATCH" },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to unassign carer.");
      }

      await loadCalendarData();
      setSelectedShift(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUnassignAll = async () => {
    if (!selectedShift) return;

    if (
      !window.confirm(
        "Are you sure you want to unassign ALL carers from this shift?",
      )
    ) {
      return;
    }

    try {
      const response = await apiFetch(
        `/api/shifts/${selectedShift.id}/unassign-all`,
        { method: "PATCH" },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to unassign all carers.");
      }

      await loadCalendarData();
      setSelectedShift(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openReplaceCarer = (assignment: ShiftCarerAssignment) => {
    setReplacementTarget(assignment);
    setReplacementCarerId("");
    setReplacementReason("");
  };

  const handleReplaceCarer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedShift || !replacementTarget || !replacementCarerId) return;

    try {
      const response = await apiFetch(
        `/api/shifts/${selectedShift.id}/assignments/${replacementTarget.carerId}/replace`,
        {
          method: "POST",
          body: JSON.stringify({
            replacementCarerId: Number(replacementCarerId),
            reason: replacementReason.trim(),
          }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Could not replace carer.");
      }

      setReplacementTarget(null);
      setSelectedShift(null);
      await loadCalendarData();
    } catch (replaceError) {
      alert(replaceError instanceof Error ? replaceError.message : "Could not replace carer.");
    }
  };

  const displayedCarers =
    highlightedCarerIds.length > 0
      ? carers.filter((c) => highlightedCarerIds.includes(c.id))
      : carers;

  const getShiftTargetLabel = (shift: Shift) => {
    if (shift.clientId != null) {
      const client = shift.client ?? clients.find((item) => item.id === shift.clientId);
      return client ? `${client.firstName} ${client.lastName}` : `Service User #${shift.clientId}`;
    }
    return shift.location?.name ?? locations.find((item) => item.id === shift.locationId)?.name ?? `Location #${shift.locationId}`;
  };

  const getShiftStatusLabel = (status: number | string) => {
    if (typeof status !== "number") return status;
    return ["Draft", "Scheduled", "In progress", "Completed", "Cancelled"][status] ?? `Status ${status}`;
  };

  const renderTargetSelector = () => (
    <div className="space-y-2">
      <div className="flex gap-2">
        {(["client", "location"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setFormTargetType(type)}
            aria-pressed={formTargetType === type}
            className={`px-3 py-2 rounded-lg border text-xs font-semibold ${formTargetType === type ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-950 border-slate-800 text-slate-300"}`}
          >
            {type === "client" ? "Service User" : "Location"}
          </button>
        ))}
      </div>
      <label className="block text-xs font-semibold text-slate-300 mb-1">
        {formTargetType === "client" ? "Service User" : "Location"}
      </label>
      {formTargetType === "client" ? (
        <select value={formClientId} onChange={(e) => setFormClientId(e.target.value ? Number(e.target.value) : "")} required className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs">
          <option value="" className="bg-slate-900 text-slate-400">Select Service User...</option>
          {clients.map((client) => <option key={client.id} value={client.id} className="bg-slate-900 text-slate-200">{client.firstName} {client.lastName}</option>)}
        </select>
      ) : (
        <select value={formLocationId} onChange={(e) => setFormLocationId(e.target.value ? Number(e.target.value) : "")} required className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs">
          <option value="" className="bg-slate-900 text-slate-400">Select Location...</option>
          {locations.map((location) => <option key={location.id} value={location.id} className="bg-slate-900 text-slate-200">{location.name}</option>)}
        </select>
      )}
    </div>
  );

  const now = new Date();
  const isSuperAdminMode = authStorage.isSuperAdmin();
  const createStartIsPast = formStartTime !== "" && new Date(formStartTime).getTime() <= now.getTime();
  const minShiftStart = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  return (
    <div className="space-y-6">
      {/* Calendar Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-6 rounded-2xl bg-slate-900/70 border border-slate-800/85 shadow-xl backdrop-blur-md">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white">
            {startOfWeek.toLocaleDateString("default", {
              month: "short",
              day: "numeric",
            })}
            {" – "}
            {endOfWeek.toLocaleDateString("default", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Click any day cell to add a new shift.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="roster-no-print rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            🖨️ Print week
          </button>
          <button
            onClick={handlePublishWeek}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
          >
            📢 Publish Week
          </button>
          <button
            type="button"
            onClick={openDuplicateModal}
            className="roster-no-print rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            Duplicate week
          </button>
          <button
            onClick={() => {
              const dateStr = now.toISOString().split("T")[0];
              setFormStartTime(`${dateStr}T09:00`);
              setFormEndTime(`${dateStr}T17:00`);
              setFormTargetType("client");
              setFormClientId("");
              setFormLocationId("");
              setFormRequiredCarers(1);
              setFormHandoverNotes("");
              setFormIsDraft(true);
              setPastShiftOverrideReason("");
              setShowCreateModal(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
          >
            + Create Shift
          </button>
          <button
            onClick={prevWeek}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium cursor-pointer transition-all"
          >
            ← Prev
          </button>
          <button
            onClick={() => {
              setCurrentDate(new Date());
              setHighlightedCarerIds([]);
            }}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium cursor-pointer transition-all"
          >
            This Week
          </button>
          <button
            onClick={nextWeek}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium cursor-pointer transition-all"
          >
            Next →
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}
      {loading && <p className="text-xs text-slate-400">Loading roster...</p>}

      {/* Grid Layout: Calendar + Sidebar */}
      <div className="roster-page-grid grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid Container */}
        <div id="roster-print-area" className="lg:col-span-3 rounded-2xl bg-slate-900/70 border border-slate-800/85 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <h1 className="roster-print-heading hidden px-2 pb-3 text-lg font-bold">
                Weekly roster: {startOfWeek.toLocaleDateString()} – {endOfWeek.toLocaleDateString()}
              </h1>
              {/* Days Header */}
              <div className="grid grid-cols-7 bg-slate-950/60 border-b border-slate-800/80 text-center font-bold">
                {weekDays.map((day) => {
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div
                      key={day.toISOString()}
                      className={`py-3 text-xs uppercase tracking-wider ${
                        isToday
                          ? "bg-blue-600/20 text-blue-400 border-b-2 border-blue-500"
                          : "text-slate-400"
                      }`}
                    >
                      <div>
                        {day.toLocaleDateString("default", {
                          weekday: "short",
                        })}
                      </div>
                      <div className="text-base font-extrabold mt-0.5 text-white">
                        {day.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Day Columns */}
              <div className="grid grid-cols-7 divide-x divide-slate-800/80 min-h-[480px]">
                {weekDays.map((day) => {
                  const dayShifts = getShiftsForDay(day);

                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => handleDayClick(day)}
                      className="p-2 min-h-[420px] bg-slate-900/30 hover:bg-slate-800/20 transition-colors cursor-pointer space-y-2"
                    >
                      {dayShifts.map((shift) => {
                        const shiftStart = new Date(shift.startTime);
                        const shiftEnd = new Date(shift.endTime);
                        const isMultiDay = !isSameDay(shiftStart, shiftEnd);
                        const isContinued =
                          isMultiDay && !isSameDay(shiftStart, day);
                        const isDraft =
                          shift.status === 0 || shift.status === "Draft";

                        const acceptedCount = shift.carerAssignments?.filter((assignment) =>
                          assignment.status === 5 || assignment.status === 1 || assignment.status === 2,
                        ).length ?? 0;
                        const pendingAcceptanceCount = shift.carerAssignments?.filter((assignment) =>
                          assignment.status === 0,
                        ).length ?? 0;
                        const isFullyStaffed =
                          acceptedCount >= shift.requiredCarers;

                        return (
                          <div
                            key={shift.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShiftClick(shift);
                            }}
                            className={`p-2.5 rounded-xl border text-xs transition-all shadow-md cursor-pointer hover:scale-[1.02] relative ${
                              isDraft
                                ? "bg-amber-950/60 border-2 border-amber-400/70 text-amber-100 border-dashed"
                                : isFullyStaffed
                                  ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                                  : "bg-amber-950/40 border-amber-500/40 text-amber-200"
                            }`}
                          >
                            {isDraft && (
                              <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-amber-300 rounded text-[9px] font-extrabold text-slate-950">
                                DRAFT
                              </div>
                            )}
                            {isMultiDay && (
                              <span className="text-[10px] font-bold text-purple-300 bg-purple-950/60 border border-purple-800/50 px-1.5 py-0.5 rounded block mb-1">
                                {isContinued ? "↩️ Cont." : "⏳ Multi-day"}
                              </span>
                            )}
                            <strong className="block font-bold text-slate-100 truncate w-4/5">
                              {getShiftTargetLabel(shift)}
                            </strong>
                            <span className="text-[11px] opacity-80 block mt-0.5">
                              {shiftStart.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              -{" "}
                              {shiftEnd.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <div className="text-[11px] font-semibold mt-1 flex items-center gap-1 opacity-90">
                              <span>👥</span>
                              <span>
                                {acceptedCount}/{shift.requiredCarers} accepted
                                {pendingAcceptanceCount > 0 && ` · ${pendingAcceptanceCount} pending`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Weekly Hours */}
        <div className="roster-no-print p-5 rounded-2xl bg-slate-900/70 border border-slate-800/85 shadow-2xl space-y-4 h-fit">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>📊</span>
              <span>Weekly Hours</span>
            </h3>
            {highlightedCarerIds.length > 0 && (
              <button
                onClick={() => setHighlightedCarerIds([])}
                className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
              >
                Clear Filter
              </button>
            )}
          </div>

          <div className="space-y-3.5">
            {displayedCarers.map((carer) => {
              const hoursWorked = calculateCarerWeeklyHours(carer.id);
              const maxHours = carer.maxWeeklyHours || 40;
              const percentage = Math.min((hoursWorked / maxHours) * 100, 100);
              const isOvertime = hoursWorked > maxHours;

              return (
                <div key={carer.id} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-300">
                      {carer.firstName} {carer.lastName}
                    </span>
                    <span
                      className={
                        isOvertime
                          ? "text-rose-400 font-bold"
                          : "text-slate-400"
                      }
                    >
                      {hoursWorked} / {maxHours} hrs
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        isOvertime
                          ? "bg-rose-500"
                          : percentage >= 80
                            ? "bg-amber-500"
                            : "bg-blue-500"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showDuplicateModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="duplicate-week-title"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="duplicate-week-title" className="text-lg font-bold">Duplicate displayed week</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Source: {startOfWeek.toLocaleDateString()} – {endOfWeek.toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                aria-label="Close duplicate week dialog"
                className="rounded-md border border-slate-700 px-2.5 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <label className="space-y-1.5 text-sm">
                <span className="block font-medium text-slate-300">Target week starts</span>
                <input
                  type="date"
                  value={duplicateTargetDate}
                  min={formatDateInput(new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 7))}
                  onChange={(event) => {
                    setDuplicateTargetDate(event.target.value);
                    setDuplicatePreview(null);
                    setDuplicateResolutions({});
                  }}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white [color-scheme:dark]"
                />
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={duplicateKeepCarers}
                  onChange={(event) => {
                    setDuplicateKeepCarers(event.target.checked);
                    setDuplicatePreview(null);
                    setDuplicateResolutions({});
                  }}
                  className="h-4 w-4 accent-teal-600"
                />
                Copy carer assignments
              </label>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Copies remain Draft. Published or assigned target shifts are protected and cannot be replaced.
            </p>

            {duplicateError && (
              <p role="alert" className="mt-4 rounded-md border border-rose-800 bg-rose-950/50 px-3 py-2 text-sm text-rose-200">
                {duplicateError}
              </p>
            )}

            {duplicatePreview === null ? (
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={handlePreviewDuplicateWeek}
                  disabled={duplicateLoading || !duplicateTargetDate}
                  className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {duplicateLoading ? "Checking overlaps…" : "Check overlaps"}
                </button>
              </div>
            ) : (
              <>
                <div className="mt-5 flex items-center justify-between gap-3 border-y border-slate-800 py-3 text-sm">
                  <p className="text-slate-300">
                    {duplicatePreview.length} source {duplicatePreview.length === 1 ? "shift" : "shifts"}; {duplicatePreview.filter((shift) => shift.conflicts.length > 0).length} overlap {duplicatePreview.filter((shift) => shift.conflicts.length > 0).length === 1 ? "decision" : "decisions"} required.
                  </p>
                  <button
                    type="button"
                    onClick={handlePreviewDuplicateWeek}
                    disabled={duplicateLoading}
                    className="shrink-0 rounded-md border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                  >
                    Refresh preview
                  </button>
                </div>

                {duplicatePreview.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">No shifts were found in the displayed source week.</p>
                ) : (
                  <div className="mt-3 max-h-[45vh] space-y-3 overflow-y-auto pr-1">
                    {duplicatePreview.map((preview) => {
                      const sourceShift = shifts.find((shift) => shift.id === preview.sourceShiftId);
                      const allConflictsReplaceable = preview.conflicts.every((conflict) => conflict.canReplace);
                      return (
                        <article key={preview.sourceShiftId} className="rounded-lg border border-slate-800 bg-slate-950 p-3 sm:p-4">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h4 className="text-sm font-semibold text-white">
                                {sourceShift ? getShiftTargetLabel(sourceShift) : `Shift #${preview.sourceShiftId}`}
                              </h4>
                              <p className="mt-1 text-xs text-slate-400">
                                Copy to {new Date(preview.targetStartTime).toLocaleString()} – {new Date(preview.targetEndTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            {duplicateKeepCarers && sourceShift && sourceShift.carerAssignments.length > 0 && (
                              <span className="text-xs text-teal-300">
                                {sourceShift.carerAssignments.length} carer assignment{sourceShift.carerAssignments.length === 1 ? "" : "s"} copied
                              </span>
                            )}
                          </div>

                          {preview.conflicts.length > 0 && (
                            <div className="mt-3 border-t border-slate-800 pt-3">
                              <p className="text-xs font-semibold uppercase text-amber-200">Overlapping target shifts</p>
                              <ul className="mt-2 space-y-2">
                                {preview.conflicts.map((conflict) => (
                                  <li key={conflict.shiftId} className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
                                    <span className="text-slate-300">
                                      Shift #{conflict.shiftId} · {new Date(conflict.startTime).toLocaleString()}–{new Date(conflict.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {getShiftStatusLabel(conflict.status)}
                                      {conflict.hasAssignments ? " · assigned" : ""}
                                    </span>
                                    {conflict.reason && !conflict.canReplace && (
                                      <span className="text-amber-300">{conflict.reason}</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                              <label className="mt-3 block space-y-1.5 text-sm">
                                <span className="font-medium text-slate-300">Decision for this copied shift</span>
                                <select
                                  value={duplicateResolutions[preview.sourceShiftId] ?? ""}
                                  onChange={(event) => setDuplicateResolutions((current) => ({
                                    ...current,
                                    [preview.sourceShiftId]: event.target.value as DuplicateConflictAction,
                                  }))}
                                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                                >
                                  <option value="">Choose an action</option>
                                  <option value="KeepExisting">Keep existing and skip this copy</option>
                                  {allConflictsReplaceable && (
                                    <option value="UseCopy">Use copy and replace unassigned Draft shift(s)</option>
                                  )}
                                </select>
                              </label>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}

                {duplicatePreview.length > 0 && (
                  <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-400">
                      {duplicatePreview.length - duplicatePreview.filter((shift) => duplicateResolutions[shift.sourceShiftId] === "KeepExisting").length} copies · {new Set(duplicatePreview.filter((shift) => duplicateResolutions[shift.sourceShiftId] === "UseCopy").flatMap((shift) => shift.conflicts.map((conflict) => conflict.shiftId))).size} Draft replacements
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDuplicateModal(false)}
                        className="rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleDuplicateWeek}
                        disabled={duplicateLoading || duplicatePreview.some((shift) => shift.conflicts.length > 0 && !duplicateResolutions[shift.sourceShiftId])}
                        className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {duplicateLoading ? "Duplicating…" : "Duplicate week"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <h3 className="text-lg font-bold text-white">Create New Shift</h3>
            <form onSubmit={handleCreateShift} className="space-y-4">
              {renderTargetSelector()}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                  min={isSuperAdminMode ? undefined : minShiftStart}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs [color-scheme:dark]"
                />
              </div>

              {isSuperAdminMode && createStartIsPast && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-amber-200">
                    Reason for creating a past shift
                  </label>
                  <textarea
                    required
                    minLength={5}
                    maxLength={500}
                    rows={2}
                    value={pastShiftOverrideReason}
                    onChange={(event) => setPastShiftOverrideReason(event.target.value)}
                    placeholder="Explain why this past shift must be added"
                    className="w-full rounded-xl border border-amber-700/60 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500"
                  />
                  <p className="mt-1 text-[11px] text-amber-200/80">
                    This reason is stored in the Super Admin audit trail.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  End Time
                </label>
                <input
                  type="datetime-local"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Carers Required
                </label>
                <input
                  type="number"
                  min="1"
                  value={formRequiredCarers}
                  onChange={(e) =>
                    setFormRequiredCarers(Number(e.target.value))
                  }
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                />
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="createIsDraft"
                  checked={formIsDraft}
                  onChange={(e) => setFormIsDraft(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-slate-950 border-slate-800 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="createIsDraft"
                  className="text-xs font-semibold text-slate-300"
                >
                  Save as Draft (Invisible to Carers)
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Handover Notes
                </label>
                <textarea
                  placeholder="Optional notes..."
                  value={formHandoverNotes}
                  onChange={(e) => setFormHandoverNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Save Shift
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHIFT DETAILS MODAL */}
      {selectedShift && !showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Shift Details
                {(selectedShift.status === 0 ||
                  selectedShift.status === "Draft") && (
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] uppercase font-bold tracking-wider">
                    Draft
                  </span>
                )}
              </h3>
              <div className="flex gap-2">
                {(selectedShift.status === 0 || selectedShift.status === "Draft") && (
                  <button
                    type="button"
                    onClick={handlePublishShift}
                    disabled={publishingShiftId === selectedShift.id}
                    className="rounded-lg border border-blue-500/40 bg-blue-500/20 px-2.5 py-1 text-xs font-medium text-blue-200 enabled:cursor-pointer enabled:hover:bg-blue-500/30 disabled:cursor-wait disabled:opacity-60"
                  >
                    {publishingShiftId === selectedShift.id ? "Publishing…" : "Publish this shift"}
                  </button>
                )}
                <button
                  onClick={openEditModal}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium cursor-pointer"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={handleDeleteShift}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium cursor-pointer"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-300 bg-slate-950/50 p-3.5 rounded-xl border border-slate-800">
              <p>
                <strong className="text-white">Client:</strong>{" "}
                {getShiftTargetLabel(selectedShift)}
              </p>
              <p>
                <strong className="text-white">Time:</strong>{" "}
                {new Date(selectedShift.startTime).toLocaleString()} -{" "}
                {new Date(selectedShift.endTime).toLocaleString()}
              </p>
              {selectedShift.handoverNotes && (
                <p>
                  <strong className="text-white">Notes:</strong>{" "}
                  {selectedShift.handoverNotes}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Carer Assignments (
                  {selectedShift.carerAssignments?.length ?? 0} /{" "}
                  {selectedShift.requiredCarers})
                </h4>
                {selectedShift.carerAssignments &&
                  selectedShift.carerAssignments.length > 0 && (
                    <button
                      onClick={handleUnassignAll}
                      className="text-[11px] text-rose-400 font-semibold cursor-pointer hover:underline"
                    >
                      Unassign All
                    </button>
                  )}
              </div>

              <div className="space-y-2">
                {Array.from({
                  length: Math.max(
                    selectedShift.requiredCarers,
                    selectedShift.carerAssignments?.length ?? 0,
                  ),
                }).map(
                  (_, index) => {
                    const assignment = selectedShift.carerAssignments?.[index];

                    return (
                      <div
                        key={index}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="w-14 text-slate-400 font-medium shrink-0">
                          Slot {index + 1}:
                        </span>

                        {assignment ? (
                          <div className="flex-1 flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200">
                            <span className="font-semibold">
                              {assignment.carerName}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] text-slate-400">
                                {assignment.status === 0 ? "Awaiting acceptance" :
                                  assignment.status === 5 ? "Accepted" :
                                    assignment.status === 1 ? "Clocked in" :
                                      assignment.status === 2 ? "Completed" : "Assigned"}
                              </span>
                              <button
                                type="button"
                                onClick={() => openReplaceCarer(assignment)}
                                className="text-teal-300 hover:text-teal-200 font-semibold"
                              >
                                Replace
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUnassignSingleCarer(assignment.carerId)}
                                disabled={assignment.status === 1 || Boolean(assignment.actualStartTime)}
                                title={assignment.status === 1 || assignment.actualStartTime
                                  ? "Clocked-in assignments cannot be removed; use Replace to add cover."
                                  : "Remove assignment"}
                                className="text-rose-400 hover:text-rose-300 font-bold px-1 enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ) : (
                          <select
                            onChange={(e) =>
                              e.target.value &&
                              handleAssignSlot(Number(e.target.value))
                            }
                            defaultValue=""
                            className="flex-1 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300"
                          >
                            <option
                              value=""
                              disabled
                              className="bg-slate-900 text-slate-400"
                            >
                              Select Carer to Assign...
                            </option>
                            {carers
                              .filter(
                                (c) =>
                                  !selectedShift.carerAssignments?.some(
                                    (a) => a.carerId === c.id,
                                  ),
                              )
                              .sort((a, b) => {
                                const aIsPref = preferredCarerIds.includes(
                                  a.id,
                                );
                                const bIsPref = preferredCarerIds.includes(
                                  b.id,
                                );
                                const aIsOptOut = optedOutCarerIds.includes(
                                  a.id,
                                );
                                const bIsOptOut = optedOutCarerIds.includes(
                                  b.id,
                                );

                                if (aIsPref && !bIsPref) return -1;
                                if (!aIsPref && bIsPref) return 1;
                                if (aIsOptOut && !bIsOptOut) return 1;
                                if (!aIsOptOut && bIsOptOut) return -1;
                                return 0;
                              })
                              .map((carer) => {
                                const isPreferred = preferredCarerIds.includes(
                                  carer.id,
                                );
                                const isOptOut = optedOutCarerIds.includes(
                                  carer.id,
                                );
                                return (
                                  <option
                                    key={carer.id}
                                    value={carer.id}
                                    className="bg-slate-900 text-slate-200"
                                  >
                                    {isPreferred
                                      ? "⭐ "
                                      : isOptOut
                                        ? "⚠️ "
                                        : ""}
                                    {carer.firstName} {carer.lastName}{" "}
                                    {isPreferred
                                      ? "(Preferred)"
                                      : isOptOut
                                        ? "(Opted Out)"
                                        : ""}
                                  </option>
                                );
                              })}
                          </select>
                        )}
                      </div>
                    );
                  },
                )}
              </div>

              <section aria-labelledby="replacement-history-heading" className="border-t border-slate-800 pt-3">
                <h4 id="replacement-history-heading" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Replacement history
                </h4>
                {replacementHistoryError ? (
                  <p role="alert" className="mt-2 text-xs text-rose-300">{replacementHistoryError}</p>
                ) : replacementHistory.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">No replacements recorded.</p>
                ) : (
                  <ol className="mt-2 space-y-2">
                    {replacementHistory.map((entry) => (
                      <li key={entry.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
                        <p className="font-semibold text-white">
                          {entry.outgoingCarer} replaced by {entry.replacementCarer}
                        </p>
                        <p className="mt-1">
                          {new Date(entry.replacedAt).toLocaleString()} by {entry.replacedBy}
                          {entry.outgoingCarerHadClockedIn ? " · outgoing carer had clocked in" : " · before clock-in"}
                        </p>
                        <p className="mt-1 wrap-break-word text-slate-400">{entry.reason}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>

            <button
              onClick={() => setSelectedShift(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer mt-2"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {replacementTarget && selectedShift && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="replace-carer-title"
            onSubmit={handleReplaceCarer}
            className="w-full max-w-lg space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl sm:p-6"
          >
            <div>
              <h3 id="replace-carer-title" className="text-lg font-bold">Replace {replacementTarget.carerName}</h3>
              <p className="mt-1 text-sm text-slate-400">
                {replacementTarget.actualStartTime || replacementTarget.status === 1
                  ? "This carer has clocked in. Their assignment and clock times will remain in the record; the replacement will be added as extra cover."
                  : "The current assignment will be replaced, and the change will be recorded in shift history."}
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="replacement-carer" className="block text-sm font-medium text-slate-300">
                Replacement carer
              </label>
              <select
                id="replacement-carer"
                value={replacementCarerId}
                onChange={(event) => setReplacementCarerId(event.target.value)}
                required
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
              >
                <option value="">Select a carer</option>
                {carers
                  .filter((carer) => !selectedShift.carerAssignments.some(
                    (assignment) => assignment.carerId === carer.id,
                  ))
                  .map((carer) => {
                    const candidate = candidateCarers.find((item) => item.carerId === carer.id);
                    return (
                      <option key={carer.id} value={carer.id}>
                        {carer.firstName} {carer.lastName}
                        {candidate?.hasOptedOut ? " (opted out)" : ""}
                        {candidate?.hasOverlappingShift ? " (overlapping shift)" : ""}
                        {candidate && !candidate.hasRequiredCompetencies ? " (missing competencies)" : ""}
                      </option>
                    );
                  })}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="replacement-reason" className="block text-sm font-medium text-slate-300">
                Reason
              </label>
              <textarea
                id="replacement-reason"
                value={replacementReason}
                onChange={(event) => setReplacementReason(event.target.value)}
                minLength={5}
                maxLength={500}
                rows={3}
                required
                className="w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-500"
                placeholder="Briefly explain why this shift assignment is changing"
              />
              <p className="text-right text-xs text-slate-500">{replacementReason.length}/500</p>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setReplacementTarget(null)}
                className="rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!replacementCarerId || replacementReason.trim().length < 5}
                className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Record replacement
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Edit Shift</h3>
            <form onSubmit={handleUpdateShift} className="space-y-4">
              {renderTargetSelector()}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  End Time
                </label>
                <input
                  type="datetime-local"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Carers Required
                </label>
                <input
                  type="number"
                  min="1"
                  value={formRequiredCarers}
                  onChange={(e) =>
                    setFormRequiredCarers(Number(e.target.value))
                  }
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                />
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="editIsDraft"
                  checked={formIsDraft}
                  onChange={(e) => setFormIsDraft(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-slate-950 border-slate-800 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="editIsDraft"
                  className="text-xs font-semibold text-slate-300"
                >
                  Keep as Draft (Invisible to Carers)
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Handover Notes
                </label>
                <textarea
                  placeholder="Optional notes..."
                  value={formHandoverNotes}
                  onChange={(e) => setFormHandoverNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
