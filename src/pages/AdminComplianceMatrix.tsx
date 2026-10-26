import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/api";

interface MatrixRecord {
  carerId: number;
  carerName: string;
  courseTitle: string;
  isExternal: boolean;
  issuer: string | null;
  status: number;
  completedAt: string | null;
  expiresAt: string | null;
  isCourseValid: boolean;
  practicalObservation: {
    title: string;
    category: number;
    isCompetent: boolean;
    dateConducted: string;
    nextDueDate: string;
    isObservationValid: boolean;
  } | null;
}

const STATUS_LABELS: Record<number, { label: string; style: string }> = {
  0: { label: "Not Enrolled", style: "bg-slate-800 text-slate-400" },
  1: {
    label: "Enrolled",
    style: "bg-blue-500/10 border-blue-500/30 text-blue-400",
  },
  2: {
    label: "In Progress",
    style: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  },
  3: {
    label: "Passed",
    style: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  },
  4: {
    label: "Failed",
    style: "bg-rose-500/10 border-rose-500/30 text-rose-400",
  },
  5: {
    label: "Expired",
    style: "bg-rose-500/20 border-rose-500/40 text-rose-300",
  },
};

export default function AdminComplianceMatrix() {
  const navigate = useNavigate();
  const [matrix, setMatrix] = useState<MatrixRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  useEffect(() => {
    fetchMatrix();
  }, []);

  const fetchMatrix = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/courses/admin/compliance-matrix");
      if (res.ok) {
        const data = await res.json();
        setMatrix(data);
      } else {
        setErrorMsg("Failed to load compliance matrix.");
      }
    } catch {
      setErrorMsg("Network error loading matrix.");
    } finally {
      setLoading(false);
    }
  };

  const filteredMatrix = matrix.filter((item) => {
    const matchesSearch =
      item.carerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.courseTitle.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterStatus === "COMPLIANT") {
      return (
        matchesSearch &&
        item.isCourseValid &&
        (!item.practicalObservation ||
          item.practicalObservation.isObservationValid)
      );
    }
    if (filterStatus === "NON_COMPLIANT") {
      return (
        matchesSearch &&
        (!item.isCourseValid ||
          (item.practicalObservation &&
            !item.practicalObservation.isObservationValid))
      );
    }

    return matchesSearch;
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 p-4 sm:p-8 bg-slate-950 text-slate-100 min-h-screen">
      {/* Screen-Only Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl print:hidden">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            CQC Audit Readiness
          </span>
          <h1 className="text-2xl font-extrabold text-white">
            Staff E-Learning & Observation Matrix
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time verification combining online theory completions and
            practical field evaluations.
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => navigate("/elearning/dashboard")}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            ← Back to Dashboard
          </button>
          <button
            onClick={fetchMatrix}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            ↻ Refresh Data
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            🖨️ Print CQC Matrix
          </button>
        </div>
      </div>

      {/* Screen-Only Filters */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-slate-900/60 border border-slate-800 rounded-2xl text-xs print:hidden">
        <input
          type="text"
          placeholder="Search by Carer Name or Course Title..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500/50"
        />

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="ALL">All Compliance Records</option>
          <option value="COMPLIANT">Fully Compliant Only</option>
          <option value="NON_COMPLIANT">Requires Attention / Expired</option>
        </select>
      </div>

      {/* Printable Header Notice (Only displays when printed) */}
      <div className="hidden print:block mb-6 text-black">
        <h1 className="text-xl font-bold border-b-2 border-black pb-1">
          CareApp CQC Compliance Audit Summary
        </h1>
        <p className="text-xs text-gray-600 mt-1">
          Generated: {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* Main Matrix Table */}
      {loading ? (
        <div className="p-8 text-center text-slate-500 text-xs">
          Loading compliance data...
        </div>
      ) : errorMsg ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          {errorMsg}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur-md print:border-black print:bg-white print:text-black">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold print:bg-gray-100 print:text-black print:border-black">
                <th className="p-3.5">Carer Name</th>
                <th className="p-3.5">Course / Module Title</th>
                <th className="p-3.5">Theory Status</th>
                <th className="p-3.5">Theory Expiry</th>
                <th className="p-3.5">Practical Field Observation</th>
                <th className="p-3.5 text-center">CQC Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 print:divide-gray-300">
              {filteredMatrix.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    No matching records found.
                  </td>
                </tr>
              ) : (
                filteredMatrix.map((item, idx) => {
                  const statusInfo =
                    STATUS_LABELS[item.status] || STATUS_LABELS[0];
                  const obs = item.practicalObservation;

                  const isFullyCompliant =
                    item.isCourseValid && (!obs || obs.isObservationValid);

                  return (
                    <tr
                      key={idx}
                      className="hover:bg-slate-800/30 transition print:hover:bg-transparent"
                    >
                      <td className="p-3.5 font-bold text-white print:text-black">
                        {item.carerName || `Carer #${item.carerId}`}
                      </td>
                      <td className="p-3.5 text-slate-300 print:text-black">
                        <div className="font-medium">{item.courseTitle}</div>
                        {item.isExternal && (
                          <div className="text-[10px] text-emerald-400 mt-0.5 flex items-center gap-1">
                            <span className="bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-semibold">
                              External
                            </span>
                            <span>Issuer: {item.issuer}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-lg border font-semibold text-[10px] ${statusInfo.style} print:border-none print:p-0 print:text-black`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400 print:text-black">
                        {item.expiresAt
                          ? new Date(item.expiresAt).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td className="p-3.5">
                        {obs ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-200 print:text-black">
                              {obs.title}
                            </div>
                            <div className="text-[10px] text-slate-400 print:text-gray-600">
                              Passed:{" "}
                              {new Date(obs.dateConducted).toLocaleDateString()}{" "}
                              | Due:{" "}
                              {new Date(obs.nextDueDate).toLocaleDateString()}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">
                            No Observation Required
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        {isFullyCompliant ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 print:bg-none print:text-black">
                            ✓ Compliant
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 print:bg-none print:text-black">
                            ⚠️ Action Due
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
