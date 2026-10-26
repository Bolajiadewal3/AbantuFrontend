import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";

interface Carer {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
}

interface ObservationHistoryItem {
  id: number;
  title: string;
  category: string;
  supervisorName: string;
  location: string;
  dateConducted: string;
  nextDueDate: string;
  isCompetent: boolean;
  detailedNotes: string;
  isOverdue: boolean;
}

interface UpcomingObservationItem {
  id: number;
  carerName: string;
  title: string;
  category: string;
  dateConducted: string;
  nextDueDate: string;
  daysRemaining: number;
}

// Replace the TS enum with a const object assertion
export const ObservationCategory = {
  MovingAndHandling: 0,
  MedicationAdministration: 1,
  InfectionControl: 2,
  PersonalCare: 3,
  CatheterAndStomaCare: 4,
  DysphagiaAndFeeding: 5,
  GeneralClinical: 6,
} as const;

export type ObservationCategory =
  (typeof ObservationCategory)[keyof typeof ObservationCategory];

const CATEGORY_LABELS: Record<number, string> = {
  [ObservationCategory.MovingAndHandling]: "Moving & Handling",
  [ObservationCategory.MedicationAdministration]: "Medication Administration",
  [ObservationCategory.InfectionControl]: "Infection Control",
  [ObservationCategory.PersonalCare]: "Personal Care",
  [ObservationCategory.CatheterAndStomaCare]: "Catheter & Stoma Care",
  [ObservationCategory.DysphagiaAndFeeding]: "Dysphagia & Feeding",
  [ObservationCategory.GeneralClinical]: "General Clinical",
};

export default function AdminObservations() {
  const [carers, setCarers] = useState<Carer[]>([]);
  const [selectedCarerId, setSelectedCarerId] = useState<number | "">("");
  const [carerHistory, setCarerHistory] = useState<ObservationHistoryItem[]>(
    [],
  );
  const [upcomingObservations, setUpcomingObservations] = useState<
    UpcomingObservationItem[]
  >([]);

  const [activeTab, setActiveTab] = useState<"record" | "history" | "upcoming">(
    "record",
  );
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  const [competencies, setCompetencies] = useState<
    { id: number; name: string }[]
  >([]);

  // Form State
  const [carerId, setCarerId] = useState<number | "">("");
  const [category, setCategory] = useState<ObservationCategory>(
    ObservationCategory.MovingAndHandling,
  );
  const [title, setTitle] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [dateConducted, setDateConducted] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [validityMonths, setValidityMonths] = useState<number>(12);
  const [isCompetent, setIsCompetent] = useState<boolean>(true);
  const [detailedNotes, setDetailedNotes] = useState<string>("");
  const [linkedCompetencyId, setLinkedCompetencyId] = useState<number | "">("");

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setError("");
    try {
      const [carersRes, upcomingRes, compRes] = await Promise.all([
        apiFetch("/api/users/active"),
        apiFetch("/api/observations/upcoming?days=30"),
        apiFetch("/api/competencies"), // Fetch master competency framework list
      ]);

      if (carersRes.ok) {
        const users: Carer[] = await carersRes.json();
        setCarers(users.filter((u) => u.role === "Carer"));
      }
      if (upcomingRes.ok) setUpcomingObservations(await upcomingRes.json());
      if (compRes.ok) setCompetencies(await compRes.json());
    } catch {
      setError("Failed to load initial observation data.");
    }
  };

  const loadCarerHistory = async (targetCarerId: number) => {
    try {
      const historyRes = await apiFetch(
        `/api/observations/carer/${targetCarerId}`,
      );
      if (historyRes.ok) {
        setCarerHistory(await historyRes.json());
      }
    } catch (err) {
      setError("Failed to fetch carer observation history.");
    }
  };

  const handleSelectCarerForHistory = (id: number) => {
    setSelectedCarerId(id);
    loadCarerHistory(id);
  };

  const handleSubmitObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carerId) {
      alert("Please select a carer.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccessMessage("");

    const payload = {
      carerId: Number(carerId),
      category: Number(category),
      title,
      location,
      dateConducted: new Date(dateConducted).toISOString(),
      validityMonths: Number(validityMonths),
      isCompetent,
      detailedNotes,
      linkedCompetencyId:
        linkedCompetencyId !== "" ? Number(linkedCompetencyId) : null,
    };

    try {
      const res = await apiFetch("/api/observations", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to record observation.");
      }

      setSuccessMessage("Practical observation recorded successfully!");

      // Reset form fields
      setTitle("");
      setLocation("");
      setDetailedNotes("");
      setLinkedCompetencyId("");
      setIsCompetent(true);

      // Refresh upcoming observations list
      const upcomingRes = await apiFetch("/api/observations/upcoming?days=30");
      if (upcomingRes.ok) setUpcomingObservations(await upcomingRes.json());

      if (selectedCarerId === Number(carerId)) {
        await loadCarerHistory(Number(carerId));
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while submitting.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-slate-900 dark:text-slate-100 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 shadow-lg dark:shadow-2xl backdrop-blur-md">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            Quality & Compliance
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Practical Field Observations
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm">
            Evaluate carer competency during on-site assessments and clinical
            practice audits.
          </p>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex bg-slate-950/80 border border-slate-800/80 p-1.5 rounded-xl gap-1 shrink-0">
          <button
            onClick={() => setActiveTab("record")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "record"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            + Log Observation
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "history"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Carer History
          </button>
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "upcoming"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Upcoming Audits</span>
            {upcomingObservations.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                {upcomingObservations.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
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

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs sm:text-sm font-medium flex items-center gap-3">
          <svg
            className="w-5 h-5 text-emerald-400 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

      {/* TAB 1: RECORD NEW OBSERVATION FORM */}
      {activeTab === "record" && (
        <section className="p-6 sm:p-8 rounded-2xl bg-slate-900/70 border border-slate-800/85 shadow-2xl backdrop-blur-md space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-800/80 pb-4">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Record Practical Evaluation
              </h2>
              <p className="text-xs text-slate-400">
                Complete supervisor evaluation checklist and pass/fail signoff.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmitObservation} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Carer Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                  Carer / Employee <span className="text-rose-400">*</span>
                </label>
                <select
                  value={carerId}
                  onChange={(e) => setCarerId(Number(e.target.value))}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option
                    value=""
                    disabled
                    className="bg-slate-900 text-slate-400"
                  >
                    Select Carer...
                  </option>
                  {carers.map((carer) => (
                    <option
                      key={carer.id}
                      value={carer.id}
                      className="bg-slate-900 text-slate-200"
                    >
                      {carer.firstName} {carer.lastName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Observation Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                  Observation Category <span className="text-rose-400">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(Number(e.target.value) as ObservationCategory)
                  }
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option
                      key={value}
                      value={value}
                      className="bg-slate-900 text-slate-200"
                    >
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Evaluation Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                  Evaluation Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Practical Hoist & Sling Assessment"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                  Location / Setting
                </label>
                <input
                  type="text"
                  placeholder="e.g. Client Home #102 or Training Suite"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              {/* Date Conducted */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                  Date Conducted <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={dateConducted}
                  onChange={(e) => setDateConducted(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 [color-scheme:dark]"
                />
              </div>

              {/* Validity Duration */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                  Validity Period (Months)
                </label>
                <input
                  type="number"
                  min="1"
                  max="36"
                  value={validityMonths}
                  onChange={(e) => setValidityMonths(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>

            {/* Linked Framework Competency */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                Linked Master Competency (Optional)
              </label>
              <select
                value={linkedCompetencyId}
                onChange={(e) =>
                  setLinkedCompetencyId(
                    e.target.value ? Number(e.target.value) : "",
                  )
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="">-- None (Standalone Assessment) --</option>
                {competencies.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Practical Signoff Toggle (Pass / Fail) */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <span className="text-sm font-bold text-white block">
                  Practical Competency Assessment Result
                </span>
                <span className="text-xs text-slate-400">
                  Mark whether the carer demonstrated full compliance and
                  competence during the evaluation.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsCompetent(true)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isCompetent
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400/50"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  ✓ Pass / Competent
                </button>
                <button
                  type="button"
                  onClick={() => setIsCompetent(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    !isCompetent
                      ? "bg-rose-600 text-white shadow-lg shadow-rose-600/30 ring-2 ring-rose-400/50"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  ✕ Fail / Needs Retraining
                </button>
              </div>
            </div>

            {/* Detailed Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                Detailed Observation Notes & Supervisor Feedback
              </label>
              <textarea
                rows={4}
                placeholder="Document specific observations, strengths demonstrated, or corrective action points..."
                value={detailedNotes}
                onChange={(e) => setDetailedNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-blue-500/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Save & Sign Off Observation"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* TAB 2: CARER OBSERVATION HISTORY */}
      {activeTab === "history" && (
        <section className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/85 space-y-4">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Select Carer to View Audit Log
            </label>
            <select
              value={selectedCarerId}
              onChange={(e) =>
                handleSelectCarerForHistory(Number(e.target.value))
              }
              className="w-full sm:w-80 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="" disabled className="bg-slate-900 text-slate-400">
                Choose a Carer...
              </option>
              {carers.map((carer) => (
                <option
                  key={carer.id}
                  value={carer.id}
                  className="bg-slate-900 text-slate-200"
                >
                  {carer.firstName} {carer.lastName}
                </option>
              ))}
            </select>
          </div>

          {selectedCarerId === "" ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800/85 text-slate-400 text-xs sm:text-sm">
              Please select a carer above to display their observation history.
            </div>
          ) : carerHistory.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800/85 text-slate-400 text-xs sm:text-sm">
              No practical observations logged for this carer yet.
            </div>
          ) : (
            <div className="grid gap-4">
              {carerHistory.map((obs) => (
                <div
                  key={obs.id}
                  className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/85 hover:border-slate-700/80 transition-all flex flex-col md:flex-row md:items-start justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          obs.isCompetent
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                            : "bg-rose-500/10 border-rose-500/20 text-rose-300"
                        }`}
                      >
                        {obs.isCompetent
                          ? "✓ Passed / Competent"
                          : "✕ Failed / Re-evaluation Required"}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-semibold">
                        {obs.category}
                      </span>
                      {obs.isOverdue && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-bold">
                          ⚠️ Overdue Renewal
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-white">
                      {obs.title}
                    </h3>

                    <p className="text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        📍 <strong>Location:</strong> {obs.location || "N/A"}
                      </span>
                      <span>
                        👤 <strong>Supervisor:</strong> {obs.supervisorName}
                      </span>
                      <span>
                        📅 <strong>Conducted:</strong>{" "}
                        {new Date(obs.dateConducted).toLocaleDateString()}
                      </span>
                      <span>
                        🔄 <strong>Next Due:</strong>{" "}
                        {new Date(obs.nextDueDate).toLocaleDateString()}
                      </span>
                    </p>

                    {obs.detailedNotes && (
                      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 mt-2">
                        <strong className="text-slate-200 block mb-1">
                          Supervisor Notes:
                        </strong>
                        {obs.detailedNotes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: UPCOMING / OVERDUE EVALUATIONS */}
      {activeTab === "upcoming" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <svg
                className="w-5 h-5 text-amber-400"
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
              Upcoming Field Assessments (Next 30 Days)
            </h2>
          </div>

          {upcomingObservations.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800/85 text-slate-400 text-xs sm:text-sm">
              No evaluations due in the next 30 days. All staff field
              assessments are up to date!
            </div>
          ) : (
            <div className="grid gap-4">
              {upcomingObservations.map((item) => (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/85 hover:border-slate-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block">
                      {item.category}
                    </span>
                    <h3 className="text-base font-bold text-white">
                      {item.carerName}
                    </h3>
                    <p className="text-xs text-slate-400">{item.title}</p>
                    <p className="text-xs text-slate-500 pt-1">
                      Last Conducted:{" "}
                      {new Date(item.dateConducted).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-300 block">
                        Due Date
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(item.nextDueDate).toLocaleDateString()}
                      </span>
                    </div>
                    <span
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                        item.daysRemaining <= 0
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : item.daysRemaining <= 7
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      }`}
                    >
                      {item.daysRemaining <= 0
                        ? "Overdue"
                        : `${item.daysRemaining} days left`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
