import { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { useNavigate } from "react-router-dom";

interface ExpiringCourse {
  id: number;
  title: string;
  expiresAt: string;
  daysRemaining: number;
}

export default function UpcomingExpiration({
  onSelectCourse,
}: {
  onSelectCourse?: (id: number) => void;
}) {
  const navigate = useNavigate();

  const handleSelect = (id: number) => {
    if (onSelectCourse) {
      onSelectCourse(id);
    } else {
      navigate(`/elearning/courses/${id}`);
    }
  };
  const [courses, setCourses] = useState<ExpiringCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/api/courses");
        if (res.ok) {
          const data = await res.json();
          const now = new Date().getTime();

          const expiring = data
            .filter((c: any) => {
              if (c.status !== 3 || !c.expiresAt) return false;
              const expTime = new Date(c.expiresAt).getTime();
              const days = Math.ceil((expTime - now) / (1000 * 3600 * 24));
              return days <= 60; // Expiring in <= 60 days
            })
            .map((c: any) => ({
              id: c.id,
              title: c.title,
              expiresAt: c.expiresAt,
              daysRemaining: Math.ceil(
                (new Date(c.expiresAt).getTime() - now) / (1000 * 3600 * 24),
              ),
            }));

          setCourses(expiring);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading)
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        Checking expiration schedules...
      </div>
    );

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Renewal Notice
          </span>
          <h1 className="text-2xl font-bold text-white">
            ⚠️ Upcoming Expiration
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Courses nearing expiry. Renew now to maintain CQC compliance.
          </p>
        </div>
        <button
          onClick={() => navigate("/elearning/dashboard")}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
        >
          ← Back to Dashboard
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-xs">
          All certifications are up to date!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {courses.map((item) => (
            <div
              key={item.id}
              className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between"
            >
              <div className="space-y-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Expires in {item.daysRemaining} days
                </span>
                <h3 className="text-base font-bold text-white">{item.title}</h3>
                <p className="text-xs text-slate-400">
                  Due for renewal before{" "}
                  {new Date(item.expiresAt).toLocaleDateString()}
                </p>
              </div>

              <button
                onClick={() => handleSelect(item.id)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer"
              >
                Renew Course
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
