import React, { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { authStorage } from "../utils/auth";

interface StaffMember {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

interface Payslip {
  id: number;
  userId: number;
  carerName?: string | null;
  payPeriodStart: string;
  payPeriodEnd: string;
  grossPay: number;
  netPay: number;
  hasDispute: boolean;
  disputeStatus: "None" | "Open" | "Resolved";
  disputeFeedback?: string;
  disputeSubmittedAt?: string;
  disputeResolution?: string;
  disputeResolvedAt?: string;
  createdAt: string;
}

export default function Payslips() {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin Upload Form State
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [grossPay, setGrossPay] = useState("");
  const [netPay, setNetPay] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Dispute Modal State
  const [disputeId, setDisputeId] = useState<number | null>(null);
  const [disputeText, setDisputeText] = useState("");
  const [resolveDisputeId, setResolveDisputeId] = useState<number | null>(null);
  const [resolutionText, setResolutionText] = useState("");

  const user = authStorage.getUser();
  const isAdmin = user?.role === "Admin" || user?.role === "Manager";
  const currentUserId = user?.id;

  const fetchData = useCallback(async () => {
    try {
      if (isAdmin) {
        const [payslipsRes, usersRes] = await Promise.all([
          apiFetch("/api/payslips/admin/all"),
          apiFetch("/api/users/active"),
        ]);
        if (payslipsRes.ok) setPayslips(await payslipsRes.json());
        if (usersRes.ok) setStaffList(await usersRes.json());
      } else if (currentUserId) {
        const payslipsRes = await apiFetch("/api/payslips/my-payslips");
        if (payslipsRes.ok) {
          const data = await payslipsRes.json();
          setPayslips(data);
        }
      }
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, isAdmin]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !periodStart || !periodEnd || !file) {
      alert("Please fill in all required fields and select a PDF file.");
      return;
    }

    const formData = new FormData();
    formData.append("userId", selectedUserId);
    formData.append("start", periodStart);
    formData.append("end", periodEnd);
    formData.append("grossPay", grossPay || "0");
    formData.append("netPay", netPay || "0");
    formData.append("file", file);

    try {
      const res = await apiFetch("/api/payslips/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setSelectedUserId("");
        setPeriodStart("");
        setPeriodEnd("");
        setGrossPay("");
        setNetPay("");
        setFile(null);
        await fetchData();
      } else {
        alert("Failed to upload payslip. Check server logs.");
      }
    } catch (err) {
      console.error("Failed uploading payslip", err);
    }
  };

  const handleDownload = async (id: number, userName?: string) => {
    try {
      const res = await apiFetch(`/api/payslips/${id}/download`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Payslip_${userName || "Statement"}_${id}.pdf`;
        a.click();
      }
    } catch (err) {
      console.error("Download failed", err);
    }
  };

  const submitDispute = async (id: number) => {
    if (!disputeText.trim()) {
      alert("Please enter feedback explaining the dispute.");
      return;
    }
    try {
      const res = await apiFetch(`/api/payslips/${id}/dispute`, {
        method: "POST",
        body: JSON.stringify({ feedback: disputeText }),
      });

      if (res.ok) {
        setDisputeId(null);
        setDisputeText("");
        await fetchData();
      }
    } catch (err) {
      console.error("Dispute submission failed", err);
    }
  };

  const resolveDispute = async () => {
    if (!resolveDisputeId || !resolutionText.trim()) return;

    try {
      const res = await apiFetch(`/api/payslips/${resolveDisputeId}/dispute`, {
        method: "PATCH",
        body: JSON.stringify({ resolution: resolutionText.trim() }),
      });

      if (res.ok) {
        setResolveDisputeId(null);
        setResolutionText("");
        await fetchData();
      } else {
        const body = await res.json().catch(() => null);
        alert(body?.message || "Failed to resolve the dispute.");
      }
    } catch (err) {
      console.error("Dispute resolution failed", err);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-2 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Payslips & Payroll
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-400">
          {isAdmin
            ? "Select a staff member to assign and upload monthly PDF payslips"
            : "View, download your payslips, or report payroll errors"}
        </p>
      </div>

      {/* Admin Upload Form */}
      {isAdmin && (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl backdrop-blur-md">
          <h3 className="mb-4 text-base font-bold text-white">
            Upload & Assign Payslip
          </h3>
          <form
            onSubmit={handleUpload}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Select Carer / Staff Member *
              </label>
              <select
                required
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs sm:text-sm text-white focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
              >
                <option value="">-- Choose Staff Member --</option>
                {staffList.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.firstName} {member.lastName} ({member.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Pay Period Start *
              </label>
              <input
                type="date"
                required
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs sm:text-sm text-white focus:ring-2 focus:ring-blue-500/50 focus:outline-none [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Pay Period End *
              </label>
              <input
                type="date"
                required
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs sm:text-sm text-white focus:ring-2 focus:ring-blue-500/50 focus:outline-none [color-scheme:dark]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Gross Pay (£)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={grossPay}
                onChange={(e) => setGrossPay(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs sm:text-sm text-white focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Net Pay (£)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={netPay}
                onChange={(e) => setNetPay(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs sm:text-sm text-white focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                PDF Document *
              </label>
              <input
                type="file"
                accept="application/pdf"
                required
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-950/50 file:text-blue-400 hover:file:bg-blue-900/50 cursor-pointer"
              />
            </div>

            <div className="md:col-span-2 mt-2">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-blue-500/20 active:scale-[0.99] transition-all cursor-pointer"
              >
                Upload & Send Payslip
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payslips List */}
      {loading ? (
        <div className="h-48 rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse" />
      ) : (
        <div className="flex flex-col gap-3">
          {payslips.length === 0 ? (
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 text-slate-400 text-xs sm:text-sm">
              No payslips found.
            </div>
          ) : (
            payslips.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-2xl backdrop-blur-md"
              >
                <div>
                  {isAdmin && item.carerName && (
                    <span className="mr-2 inline-block rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-200 border border-slate-700">
                      👤 {item.carerName}
                    </span>
                  )}

                  <h4 className="mt-1 text-sm sm:text-base font-bold text-white">
                    Period: {new Date(item.payPeriodStart).toLocaleDateString()}{" "}
                    — {new Date(item.payPeriodEnd).toLocaleDateString()}
                  </h4>

                  <div className="mt-1 text-xs text-slate-400">
                    Net Pay:{" "}
                    <strong className="text-emerald-400">
                      £{item.netPay.toFixed(2)}
                    </strong>{" "}
                    (Gross: £{item.grossPay.toFixed(2)})
                  </div>

                  {item.hasDispute && (
                    <div className="mt-3 max-w-2xl space-y-2 rounded-lg border border-rose-800/50 bg-rose-950/20 p-3 text-xs">
                      <p className="font-semibold text-rose-300">
                        Payslip dispute: {item.disputeStatus}
                        {item.disputeSubmittedAt && ` · ${new Date(item.disputeSubmittedAt).toLocaleDateString()}`}
                      </p>
                      <p className="text-slate-300">Carer report: {item.disputeFeedback}</p>
                      {item.disputeStatus === "Resolved" && item.disputeResolution && (
                        <p className="text-emerald-300">Payroll response: {item.disputeResolution}</p>
                      )}
                      {isAdmin && item.disputeStatus === "Open" && (
                        <button
                          type="button"
                          onClick={() => {
                            setResolveDisputeId(item.id);
                            setResolutionText("");
                          }}
                          className="rounded-lg border border-emerald-800 bg-emerald-950/50 px-3 py-2 font-semibold text-emerald-300 hover:bg-emerald-900/60"
                        >
                          Resolve dispute
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2.5 self-start sm:self-auto">
                  <button
                    onClick={() =>
                      handleDownload(item.id, item.carerName ?? undefined)
                    }
                    className="rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition cursor-pointer"
                  >
                    📄 Download PDF
                  </button>
                  {!isAdmin && !item.hasDispute && (
                    <button
                      onClick={() => setDisputeId(item.id)}
                      className="rounded-xl border border-rose-900/50 bg-rose-950/40 px-3.5 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-900/60 transition cursor-pointer"
                    >
                      Flag Issue
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Dispute Modal */}
      {disputeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-3">
              Flag Payslip Discrepancy
            </h3>
            <textarea
              rows={4}
              placeholder="Detail your query regarding tax, hours, or pay rates..."
              value={disputeText}
              onChange={(e) => setDisputeText(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-white focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2.5">
              <button
                onClick={() => setDisputeId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => submitDispute(disputeId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-500/20 transition cursor-pointer"
              >
                Submit Issue
              </button>
            </div>
          </div>
        </div>
      )}

      {resolveDisputeId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="resolve-dispute-title"
            className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl sm:p-6"
          >
            <div>
              <h2 id="resolve-dispute-title" className="text-lg font-bold text-white">
                Resolve payslip dispute
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Your response will be saved with this payslip and shown to the Carer.
              </p>
            </div>
            <label className="block space-y-2 text-sm font-medium text-slate-200">
              Resolution response
              <textarea
                autoFocus
                required
                maxLength={2000}
                rows={5}
                value={resolutionText}
                onChange={(event) => setResolutionText(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResolveDisputeId(null)}
                className="min-h-10 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!resolutionText.trim()}
                onClick={resolveDispute}
                className="min-h-10 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark resolved
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
