import { useState } from "react";
import AdminObservations from "./AdminObservations";
import AdminCompetencies from "./AdminCompetencies";

export default function CompetenciesAndObservations() {
  const [activeTab, setActiveTab] = useState<"competencies" | "observations">(
    "competencies",
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-slate-900 dark:text-slate-100 font-sans">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 shadow-lg dark:shadow-2xl backdrop-blur-md">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            Quality, Standards & Governance
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Competencies & Practical Assessments
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm">
            Manage required staff clinical skills and log practical field
            observations.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-slate-950/80 border border-slate-800/80 p-1.5 rounded-xl gap-1 shrink-0">
          <button
            onClick={() => setActiveTab("competencies")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "competencies"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            🛡️ Skill Competencies
          </button>
          <button
            onClick={() => setActiveTab("observations")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "observations"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            📋 Practical Observations
          </button>
        </div>
      </div>

      {/* TAB 1: COMPETENCY MANAGEMENT */}
      {activeTab === "competencies" && <AdminCompetencies />}

      {/* TAB 2: PRACTICAL OBSERVATIONS */}
      {activeTab === "observations" && <AdminObservations />}
    </div>
  );
}
