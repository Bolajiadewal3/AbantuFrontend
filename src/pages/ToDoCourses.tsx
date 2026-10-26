import { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { useNavigate } from "react-router-dom";

interface CourseItem {
  id: number;
  title: string;
  description: string;
  estimatedMinutes: number;
  status: number; // 1=Enrolled, 2=InProgress
  dueDate?: string;
  categoryName?: string;
}

export default function ToDoCourses({
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
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/api/courses");
        if (res.ok) {
          const data = await res.json();
          // Filter to Enrolled (1) or In Progress (2)
          setCourses(
            data.filter((c: CourseItem) => c.status === 1 || c.status === 2),
          );
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
        Loading mandatory training...
      </div>
    );

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Action Required
          </span>
          <h1 className="text-2xl font-bold text-white">📚 To Do Courses</h1>
          <p className="text-xs text-slate-400 mt-1">
            Modules assigned to you that require completion.
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
          🎉 You're all caught up! No pending courses.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course) => (
            <div
              key={course.id}
              className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition"
            >
              <div className="space-y-2">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {course.status === 2 ? "In Progress" : "Assigned"}
                </span>
                <h3 className="text-lg font-bold text-white">{course.title}</h3>
                <p className="text-xs text-slate-400 line-clamp-2">
                  {course.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  ⏱️ {course.estimatedMinutes || 20} mins
                </span>
                <button
                  onClick={() => handleSelect(course.id)}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                >
                  {course.status === 2 ? "Continue" : "Start Course"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
