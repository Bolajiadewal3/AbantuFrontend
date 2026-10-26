import { useState } from "react";
import RosterBasic from "./RosterBasic";
import RosterCalendar from "./RosterCalendar";
import PreferredCarersManager from "./PreferredCarers";
import OptedOutCarersManager from "./OptedOutCarers";

export default function RosterPage() {
  const [view, setView] = useState<
    "list" | "calendar" | "preferences" | "opt-outs"
  >(() => (window.matchMedia("(max-width: 639px)").matches ? "list" : "calendar"));

  return (
    <div className="min-h-[100dvh] w-full bg-slate-950 text-slate-100 font-sans antialiased relative overflow-x-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[350px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-[500px] h-[400px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 relative z-10 space-y-6">
        {/* Top Header & Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Shift Management
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Schedule shifts, manage assignments, and configure carer
              preferences.
            </p>
          </div>

          {/* View Toggle Buttons */}
          <div className="grid w-full max-w-md grid-cols-2 gap-1.5 rounded-2xl border border-slate-800/80 bg-slate-900/80 p-1.5 backdrop-blur-md sm:inline-flex sm:w-auto sm:grid-cols-none sm:items-center sm:self-auto">
            <button
              onClick={() => setView("list")}
              className={`flex min-h-10 items-center justify-center gap-2 rounded-xl px-2 py-2 text-[11px] font-semibold transition-all duration-200 cursor-pointer sm:px-4 sm:text-sm ${
                view === "list"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <span>📋</span>
              <span>List View</span>
            </button>

            <button
              onClick={() => setView("calendar")}
              className={`flex min-h-10 items-center justify-center gap-2 rounded-xl px-2 py-2 text-[11px] font-semibold transition-all duration-200 cursor-pointer sm:px-4 sm:text-sm ${
                view === "calendar"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <span>📅</span>
              <span>Calendar View</span>
            </button>

            <button
              onClick={() => setView("preferences")}
              className={`flex min-h-10 items-center justify-center gap-2 rounded-xl px-2 py-2 text-[11px] font-semibold transition-all duration-200 cursor-pointer sm:px-4 sm:text-sm ${
                view === "preferences"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <span>⭐</span>
              <span>Preferred Carers</span>
            </button>

            <button
              onClick={() => setView("opt-outs")}
              className={`flex min-h-10 items-center justify-center gap-2 rounded-xl px-2 py-2 text-[11px] font-semibold transition-all duration-200 cursor-pointer sm:px-4 sm:text-sm ${
                view === "opt-outs"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <span>🚫</span>
              <span>Opted Out Carers</span>
            </button>
          </div>
        </div>

        {/* Render Selected View */}
        <div className="pt-2">
          {view === "list" && <RosterBasic />}
          {view === "calendar" && <RosterCalendar />}
          {view === "preferences" && <PreferredCarersManager />}
          {view === "opt-outs" && <OptedOutCarersManager />}
        </div>
      </div>
    </div>
  );
}
