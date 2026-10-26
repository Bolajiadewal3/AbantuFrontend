import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/api";

interface AdminAddExternalCertProps {
  users?: { id: number; name: string }[];
  competencies?: { id: number; name: string }[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function AdminAddExternalCert({
  users: initialUsers = [],
  competencies: initialCompetencies = [],
  onSuccess,
  onCancel,
}: AdminAddExternalCertProps) {
  const navigate = useNavigate();

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate("/elearning/dashboard");
    }
  };

  const [users, setUsers] =
    useState<{ id: number; name: string }[]>(initialUsers);
  const [competencies, setCompetencies] =
    useState<{ id: number; name: string }[]>(initialCompetencies);

  const [userId, setUserId] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [issuer, setIssuer] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [linkedCompetencyId, setLinkedCompetencyId] = useState<number | "">("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const promises = [];
        if (initialUsers.length === 0) {
          promises.push(
            apiFetch("/api/users/active")
              .then((res) => (res.ok ? res.json() : []))
              .then((data) =>
                setUsers(
                  data.map((u: any) => ({
                    id: u.id,
                    name: `${u.firstName || ""} ${u.lastName || u.name || ""}`.trim(),
                  })),
                ),
              ),
          );
        }
        if (initialCompetencies.length === 0) {
          promises.push(
            apiFetch("/api/competencies")
              .then((res) => (res.ok ? res.json() : []))
              .then((data) => setCompetencies(data)),
          );
        }
        await Promise.all(promises);
      } catch {
        setErrorMsg("Failed to load dropdown selection options.");
      }
    };
    loadData();
  }, []); // Changed from [initialUsers, initialCompetencies] to []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!userId || !title || !issuer || !issueDate || !expiryDate) {
      setErrorMsg("Please fill in all mandatory fields.");
      return;
    }

    setLoading(true);

    const payload = {
      userId: Number(userId),
      title,
      issuer,
      issueDate: new Date(issueDate).toISOString(),
      expiryDate: new Date(expiryDate).toISOString(),
      documentUrl,
      linkedCompetencyId:
        linkedCompetencyId !== "" ? Number(linkedCompetencyId) : null,
    };

    try {
      const res = await apiFetch("/api/courses/external-certificate", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccessMsg("External certificate successfully logged and verified!");
        setTitle("");
        setIssuer("");
        setDocumentUrl("");
        if (onSuccess) onSuccess();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.message || "Failed to add external certificate.");
      }
    } catch {
      setErrorMsg("Network error occurred while submitting certificate.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl text-slate-100">
      <div className="border-b border-slate-800 pb-4 mb-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
          Prior Learning & External Training
        </span>
        <h2 className="text-xl font-bold text-white">
          Record Third-Party Certificate
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Log certificates issued by external bodies (e.g. St John Ambulance,
          Red Cross, NVQ) to satisfy staff compliance records.
        </p>
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

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-slate-300 mb-1">
              Select Carer / Staff Member *
            </label>
            <select
              value={userId}
              onChange={(e) =>
                setUserId(e.target.value ? Number(e.target.value) : "")
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/50"
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
              Linked Competency (Optional)
            </label>
            <select
              value={linkedCompetencyId}
              onChange={(e) =>
                setLinkedCompetencyId(
                  e.target.value ? Number(e.target.value) : "",
                )
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">-- No Competency Link --</option>
              {competencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block font-medium text-slate-300 mb-1">
              Certificate Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Level 3 First Aid at Work"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">
              Issuing Organization *
            </label>
            <input
              type="text"
              placeholder="e.g. Red Cross / St John Ambulance"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">
              Document URL / PDF Link
            </label>
            <input
              type="text"
              placeholder="https://storage.careapp.com/certs/doc123.pdf"
              value={documentUrl}
              onChange={(e) => setDocumentUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">
              Issue Date *
            </label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">
              Expiry Date *
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Saving..." : "Verify & Save Record"}
          </button>
        </div>
      </form>
    </div>
  );
}
