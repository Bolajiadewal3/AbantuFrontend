import { useState, useEffect } from "react";
import CarerShifts from "./CarerShifts";
import { apiFetch } from "../utils/api";
import { authStorage } from "../utils/auth";

interface Shift {
  id: number;
  clientId: number | null;
  locationId: number | null;
  locationName?: string;
  locationServiceUsers?: Array<{ id: number; firstName: string; lastName: string; preferredName?: string }>;
  startTime: string;
  endTime: string;
  status: number | string;
  carerAssignments?: Array<{ carerId: number }>;
}

export default function CarerDashboard() {
  const [upcomingShift, setUpcomingShift] = useState<Shift | null>(null);
  const [loadingShift, setLoadingShift] = useState(true);

  const currentUser = authStorage.getUser();

  useEffect(() => {
    const fetchUpcomingShift = async () => {
      try {
        const res = await apiFetch("/api/shifts");
        if (res.ok) {
          const allShifts: Shift[] = await res.json();
          const now = new Date();

          // 1. Filter shifts assigned to current carer
          // 2. Filter shifts where startTime is in the future
          // 3. Sort by nearest start time
          const nextShift = allShifts
            .filter((s) =>
              s.carerAssignments?.some((a) => a.carerId === currentUser?.id),
            )
            .filter((s) => s.status === 1 || s.status === "Scheduled")
            .filter((s) => new Date(s.startTime) > now)
            .sort(
              (a, b) =>
                new Date(a.startTime).getTime() -
                new Date(b.startTime).getTime(),
            )[0];

          setUpcomingShift(nextShift || null);
        }
      } catch (err) {
        console.error("Failed to fetch upcoming shift:", err);
      } finally {
        setLoadingShift(false);
      }
    };

    fetchUpcomingShift();
  }, [currentUser?.id]);

  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden bg-white font-sans antialiased text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[350px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-[500px] h-[400px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 relative z-10 space-y-6">
        {/* Header Section */}
        <div className="border-b border-slate-200 pb-6 dark:border-slate-800/80">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Carer Portal
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            Manage shifts, log attendance, and review client handovers.
          </p>
        </div>

        {/* UPCOMING SHIFT SUMMARY CARD */}
        {!loadingShift && upcomingShift && (
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-blue-200 bg-linear-to-r from-blue-50 to-white p-5 shadow-sm dark:border-blue-800/50 dark:from-blue-950/60 dark:to-slate-900 dark:shadow-xl md:flex-row md:items-center">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
                🚨 Next Scheduled Shift
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {upcomingShift.locationId != null
                  ? `Location: ${upcomingShift.locationName ?? `#${upcomingShift.locationId}`}`
                  : `Service User #${upcomingShift.clientId}`}
              </h2>
              {upcomingShift.locationId != null && (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Service users: {upcomingShift.locationServiceUsers?.length
                    ? upcomingShift.locationServiceUsers.map((serviceUser) => serviceUser.preferredName || `${serviceUser.firstName} ${serviceUser.lastName}`).join(", ")
                    : "None currently assigned"}
                </p>
              )}
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {new Date(upcomingShift.startTime).toLocaleString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                –{" "}
                {new Date(upcomingShift.endTime).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        )}

        {/* Main View Component */}
        <div className="pt-2">
          <CarerShifts />
        </div>
      </div>
    </div>
  );
}
