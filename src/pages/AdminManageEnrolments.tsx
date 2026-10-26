import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/api";

interface AdminManageEnrolmentsProps {
  users?: { id: number; name: string }[];
  courses?: {
    id: number;
    title: string;
    description?: string;
    validityMonths?: number;
  }[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface ComplianceMatrixRow {
  carerId: number;
  carerName: string;
  courseTitle: string;
  status: number; // 0: NotEnrolled, 1: Enrolled, 2: InProgress, 3: Passed, 4: Failed, 5: Expired
  expiresAt?: string;
}

export default function AdminManageEnrolments({
  users: initialUsers = [],
  courses: initialCourses = [],
  onSuccess,
  onCancel,
}: AdminManageEnrolmentsProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    "table" | "matrix" | "single" | "mass"
  >("table");

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate("/elearning/dashboard");
    }
  };

  const [users, setUsers] =
    useState<{ id: number; name: string }[]>(initialUsers);
  const [courses, setCourses] = useState<any[]>(initialCourses);
  const [matrixData, setMatrixData] = useState<ComplianceMatrixRow[]>([]);

  // Single Enrolment State
  const [userId, setUserId] = useState<number | "">("");
  const [singleCourseId, setSingleCourseId] = useState<number | "">("");
  const [dueDate, setDueDate] = useState<string>("");

  // Mass Enrolment State
  const [massCourseId, setMassCourseId] = useState<number | "">("");
  const [massDueDate, setMassDueDate] = useState<string>("");
  const [reEnrolAll, setReEnrolAll] = useState<boolean>(false);

  // Table Filter State
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [usersRes, coursesRes, matrixRes] = await Promise.all([
          initialUsers.length === 0
            ? apiFetch("/api/users/active")
            : Promise.resolve(null),
          initialCourses.length === 0
            ? apiFetch("/api/courses")
            : Promise.resolve(null),
          apiFetch("/api/courses/admin/compliance-matrix"),
        ]);

        if (usersRes && usersRes.ok) {
          const data = await usersRes.json();
          setUsers(
            data.map((u: any) => ({
              id: u.id,
              name: `${u.firstName || ""} ${u.lastName || u.name || ""}`.trim(),
            })),
          );
        }

        if (coursesRes && coursesRes.ok) {
          const data = await coursesRes.json();
          setCourses(data);
        }

        if (matrixRes.ok) {
          const data = await matrixRes.json();
          setMatrixData(data);
        }
      } catch {
        setErrorMsg("Failed to load enrolment management data.");
      }
    };
    loadData();
  }, [initialCourses.length, initialUsers.length]);

  const handleSingleEnrol = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!userId || !singleCourseId) {
      setErrorMsg("Please select both a carer and a course.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch("/api/courses/enrol", {
        method: "POST",
        body: JSON.stringify({
          userId: Number(userId),
          courseId: Number(singleCourseId),
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        }),
      });

      if (res.ok) {
        setSuccessMsg("Carer enrolled successfully!");
        setUserId("");
        setSingleCourseId("");
        setDueDate("");
        if (onSuccess) onSuccess();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.message || "Failed to enrol carer.");
      }
    } catch {
      setErrorMsg("Network error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleMassEnrol = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!massCourseId) {
      setErrorMsg("Please select a training course for mass enrolment.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch("/api/courses/mass-enrol", {
        method: "POST",
        body: JSON.stringify({
          courseId: Number(massCourseId),
          dueDate: massDueDate ? new Date(massDueDate).toISOString() : null,
          reEnrolAll,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(data.message || "Mass enrolment completed successfully!");
        setMassCourseId("");
        setMassDueDate("");
        setReEnrolAll(false);
        if (onSuccess) onSuccess();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.message || "Failed to execute mass enrolment.");
      }
    } catch {
      setErrorMsg("Network error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // Unique list of all course titles for the matrix columns
  const uniqueCourseTitles = Array.from(
    new Set(
      courses.map((c) => c.title).concat(matrixData.map((m) => m.courseTitle)),
    ),
  );
  const uniqueCarers = Array.from(
    new Set(matrixData.map((m) => m.carerName)),
  ).sort();

  const getCellStatus = (carerName: string, courseTitle: string) => {
    const record = matrixData.find(
      (m) => m.carerName === carerName && m.courseTitle === courseTitle,
    );
    if (!record)
      return { color: "bg-slate-800 text-slate-500", label: "Not Enrolled" };
    switch (record.status) {
      case 3: // Passed
        return {
          color: "bg-emerald-500/20 border border-emerald-500 text-emerald-300",
          label: "Passed",
        };
      case 2: // InProgress
        return {
          color: "bg-amber-500/20 border border-amber-500 text-amber-300",
          label: "In Progress",
        };
      case 1: // Enrolled
        return {
          color: "bg-indigo-500/20 border border-indigo-500 text-indigo-300",
          label: "Enrolled",
        };
      case 4: // Failed
        return {
          color: "bg-rose-500/20 border border-rose-500 text-rose-300",
          label: "Failed",
        };
      case 5: // Expired
        return {
          color: "bg-orange-500/20 border border-orange-500 text-orange-300",
          label: "Expired",
        };
      default:
        return { color: "bg-slate-800 text-slate-500", label: "Not Enrolled" };
    }
  };

  const filteredCourses = courses.filter((c) => {
    if (statusFilter === "ALL") return true;
    return c.status?.toString() === statusFilter;
  });

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-100 shadow-xl sm:p-6">
      <div className="mb-6 flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
            Staff Training & Compliance
          </span>
          <h2 className="text-xl font-bold text-white">
            Manage Course Enrolments
          </h2>
        </div>
        <button
          onClick={handleCancel}
          className="min-h-9 self-start rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 cursor-pointer"
        >
          Close / Return
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 grid grid-cols-2 gap-2 border-b border-slate-800 pb-3 text-xs font-medium sm:flex sm:flex-wrap">
        <button
          onClick={() => setActiveTab("table")}
          className={`min-h-10 w-full rounded-xl px-2 py-2 transition cursor-pointer sm:w-auto sm:px-4 ${
            activeTab === "table"
              ? "bg-indigo-600 text-white font-bold"
              : "bg-slate-950 text-slate-400 hover:text-white"
          }`}
        >
          Courses Status Table
        </button>
        <button
          onClick={() => setActiveTab("matrix")}
          className={`min-h-10 w-full rounded-xl px-2 py-2 transition cursor-pointer sm:w-auto sm:px-4 ${
            activeTab === "matrix"
              ? "bg-indigo-600 text-white font-bold"
              : "bg-slate-950 text-slate-400 hover:text-white"
          }`}
        >
          Compliance Matrix
        </button>
        <button
          onClick={() => setActiveTab("single")}
          className={`min-h-10 w-full rounded-xl px-2 py-2 transition cursor-pointer sm:w-auto sm:px-4 ${
            activeTab === "single"
              ? "bg-indigo-600 text-white font-bold"
              : "bg-slate-950 text-slate-400 hover:text-white"
          }`}
        >
          Assign Single Carer
        </button>
        <button
          onClick={() => setActiveTab("mass")}
          className={`min-h-10 w-full rounded-xl px-2 py-2 transition cursor-pointer sm:w-auto sm:px-4 ${
            activeTab === "mass"
              ? "bg-indigo-600 text-white font-bold"
              : "bg-slate-950 text-slate-400 hover:text-white"
          }`}
        >
          Mass Enrolment
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
          {successMsg}
        </div>
      )}

      {/* TAB 1: COURSES TABLE VIEW */}
      {activeTab === "table" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-slate-400">
              Filter courses by status:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white sm:w-auto"
            >
              <option value="ALL">All Statuses</option>
              <option value="3">Passed</option>
              <option value="2">In Progress</option>
              <option value="1">Enrolled</option>
              <option value="5">Expired</option>
            </select>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Course Title</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Validity</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredCourses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-500">
                      No courses found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredCourses.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-medium text-white">{c.title}</td>
                      <td className="p-3 text-slate-400 truncate max-w-xs">
                        {c.description || "N/A"}
                      </td>
                      <td className="p-3 text-slate-300">
                        {c.validityMonths
                          ? `${c.validityMonths} months`
                          : "Lifetime"}
                      </td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {c.status !== undefined
                            ? [
                                "Not Enrolled",
                                "Enrolled",
                                "In Progress",
                                "Passed",
                                "Failed",
                                "Expired",
                              ][c.status]
                            : "Active"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: COMPLIANCE MATRIX VIEW */}
      {activeTab === "matrix" && (
        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3 min-w-[150px]">Carer Name</th>
                {uniqueCourseTitles.map((title, idx) => {
                  const abbr =
                    title.length > 15 ? title.substring(0, 12) + "..." : title;
                  return (
                    <th
                      key={idx}
                      title={title}
                      className="p-3 text-center cursor-help truncate max-w-[120px]"
                    >
                      {abbr}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {uniqueCarers.length === 0 ? (
                <tr>
                  <td
                    colSpan={uniqueCourseTitles.length + 1}
                    className="p-6 text-center text-slate-500"
                  >
                    No compliance records available.
                  </td>
                </tr>
              ) : (
                uniqueCarers.map((carer, cIdx) => (
                  <tr key={cIdx} className="hover:bg-slate-800/40">
                    <td className="p-3 font-medium text-white whitespace-nowrap">
                      {carer}
                    </td>
                    {uniqueCourseTitles.map((title, tIdx) => {
                      const cell = getCellStatus(carer, title);
                      return (
                        <td key={tIdx} className="p-2 text-center">
                          <span
                            title={`${carer} - ${title}: ${cell.label}`}
                            className={`inline-block px-2 py-1 rounded-md text-[10px] font-bold ${cell.color}`}
                          >
                            {cell.label.substring(0, 3)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: SINGLE ENROLMENT MODAL / VIEW */}
      {activeTab === "single" && (
        <form
          onSubmit={handleSingleEnrol}
          className="space-y-4 text-xs max-w-xl mx-auto"
        >
          <div>
            <label className="block font-medium text-slate-300 mb-1">
              Select Carer *
            </label>
            <select
              value={userId}
              onChange={(e) =>
                setUserId(e.target.value ? Number(e.target.value) : "")
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            >
              <option value="">-- Choose Carer --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">
              Select Training Course *
            </label>
            <select
              value={singleCourseId}
              onChange={(e) =>
                setSingleCourseId(e.target.value ? Number(e.target.value) : "")
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            >
              <option value="">-- Choose Course --</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">
              Completion Due Date (Optional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Assigning..." : "Assign Course to Staff"}
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: MASS ENROLMENT VIEW */}
      {activeTab === "mass" && (
        <form
          onSubmit={handleMassEnrol}
          className="space-y-4 text-xs max-w-xl mx-auto"
        >
          <div>
            <label className="block font-medium text-slate-300 mb-1">
              Select Training Course for Mass Enrolment *
            </label>
            <select
              value={massCourseId}
              onChange={(e) =>
                setMassCourseId(e.target.value ? Number(e.target.value) : "")
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            >
              <option value="">-- Choose Course --</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">
              Completion Due Date (Optional)
            </label>
            <input
              type="date"
              value={massDueDate}
              onChange={(e) => setMassDueDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl">
            <input
              type="checkbox"
              id="reEnrolToggle"
              checked={reEnrolAll}
              onChange={(e) => setReEnrolAll(e.target.checked)}
              className="w-4 h-4 accent-indigo-500 cursor-pointer"
            />
            <label
              htmlFor="reEnrolToggle"
              className="text-slate-300 cursor-pointer"
            >
              <span className="font-semibold text-white block">
                Re-enrol everyone (Ignore active competencies)
              </span>
              By default, mass enrolment targets only staff without an active
              competency matching this course.
            </label>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold transition disabled:opacity-50 cursor-pointer"
            >
              {loading
                ? "Processing Mass Enrolment..."
                : "Execute Mass Enrolment"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
