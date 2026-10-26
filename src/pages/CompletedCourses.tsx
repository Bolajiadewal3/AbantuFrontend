import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/api";

interface CompletedCourse {
  id: number;
  title: string;
  completedAt: string;
  expiresAt: string;
  certificateUrl?: string;
  score?: number;
}

export default function CompletedCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CompletedCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/api/courses");
        if (res.ok) {
          const data = await res.json();
          // Filter to Passed / Completed status (3)
          setCourses(data.filter((c: any) => c.status === 3));
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
        Loading training records...
      </div>
    );

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-teal-400">
            Achieved Compliance
          </span>
          <h1 className="text-2xl font-bold text-white">
            ✅ Completed Courses
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Review your completed courses and download verified certificates.
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
          No completed courses recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-semibold">
                <th className="p-4">Course Title</th>
                <th className="p-4">Completed Date</th>
                <th className="p-4">Valid Until</th>
                <th className="p-4 text-right">Certificate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {courses.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-4 font-bold text-white">{item.title}</td>
                  <td className="p-4 text-slate-300">
                    {new Date(item.completedAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-slate-300">
                    {item.expiresAt
                      ? new Date(item.expiresAt).toLocaleDateString()
                      : "Indefinite"}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() =>
                        item.certificateUrl &&
                        window.open(item.certificateUrl, "_blank")
                      }
                      className="px-3 py-1.5 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-300 hover:bg-teal-500/20 font-semibold text-xs transition"
                    >
                      📄 Download Certificate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
