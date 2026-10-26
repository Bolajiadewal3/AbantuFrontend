import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { authStorage } from "../utils/auth";

type LeaveRequest = {
  id: number;
  carerId: number;
  carerName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  createdAt: string;
  reviewedAt?: string | null;
  reviewResponse?: string | null;
};

type ShiftDeclineRequest = {
  id: number;
  shiftId: number;
  carerId: number;
  carerName: string;
  startTime: string;
  endTime: string;
  reason: string;
  status: string;
  createdAt: string;
  reviewResponse?: string | null;
};

type PendingRequests = {
  leaveRequests: LeaveRequest[];
  shiftDeclineRequests: ShiftDeclineRequest[];
};

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  return body?.message || `Request failed (${response.status}).`;
}

function statusClass(status: string) {
  switch (status) {
    case "Approved": return "border-emerald-800 bg-emerald-950/40 text-emerald-300";
    case "Rejected": return "border-rose-800 bg-rose-950/40 text-rose-300";
    default: return "border-amber-800 bg-amber-950/40 text-amber-300";
  }
}

export default function CarerRequests() {
  const role = authStorage.getUser()?.role;
  const canReview = role === "Admin" || role === "Manager";
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [declineRequests, setDeclineRequests] = useState<ShiftDeclineRequest[]>([]);
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [reviewResponses, setReviewResponses] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<PendingRequests>({ leaveRequests: [], shiftDeclineRequests: [] });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (canReview) {
        const response = await apiFetch("/api/admin/carer-requests/pending");
        if (!response.ok) throw new Error(await readError(response));
        setPending(await response.json());
      } else {
        const [leaveResponse, declineResponse] = await Promise.all([
          apiFetch("/api/carer-requests/leave"),
          apiFetch("/api/carer-requests/shift-declines"),
        ]);
        if (!leaveResponse.ok) throw new Error(await readError(leaveResponse));
        if (!declineResponse.ok) throw new Error(await readError(declineResponse));
        setLeaveRequests(await leaveResponse.json());
        setDeclineRequests(await declineResponse.json());
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load requests.");
    } finally {
      setLoading(false);
    }
  }, [canReview]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const submitLeaveRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch("/api/carer-requests/leave", {
        method: "POST",
        body: JSON.stringify({ startDate: leaveStart, endDate: leaveEnd, reason: leaveReason }),
      });
      if (!response.ok) throw new Error(await readError(response));
      setLeaveStart("");
      setLeaveEnd("");
      setLeaveReason("");
      setMessage("Leave request sent for Admin/Manager review.");
      await loadRequests();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit leave request.");
    } finally {
      setSubmitting(false);
    }
  };

  const reviewRequest = async (kind: "leave" | "shift-declines", id: number, approve: boolean) => {
    const key = `${kind}:${id}`;
    const responseText = reviewResponses[key]?.trim() ?? "";
    if (responseText.length < 3) {
      setError("Enter a short response before approving or rejecting a request.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch(`/api/admin/carer-requests/${kind}/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ approve, response: responseText }),
      });
      if (!response.ok) throw new Error(await readError(response));
      setMessage(approve ? "Request approved." : "Request rejected.");
      setReviewResponses((current) => ({ ...current, [key]: "" }));
      await loadRequests();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not review request.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateResponse = (key: string, value: string) =>
    setReviewResponses((current) => ({ ...current, [key]: value }));

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="border-b border-slate-200 pb-4 dark:border-slate-800">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {canReview ? "Carer Requests" : "My Requests"}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {canReview
            ? "Review leave requests and requests to decline assigned shifts."
            : "Request leave, request approval to decline an assigned shift, and see decisions."}
        </p>
      </header>

      {error && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-300">{error}</p>}
      {message && <p role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-3 text-sm text-emerald-300">{message}</p>}

      {!canReview && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Request leave</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Approved leave is not granted until overlapping assigned shifts are resolved.</p>
          </div>
          <form onSubmit={submitLeaveRequest} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-200">
              First day
              <input required type="date" value={leaveStart} onChange={(event) => setLeaveStart(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-200">
              Last day
              <input required type="date" min={leaveStart || undefined} value={leaveEnd} onChange={(event) => setLeaveEnd(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
              Reason
              <textarea required minLength={3} maxLength={1000} rows={3} value={leaveReason} onChange={(event) => setLeaveReason(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-950" />
            </label>
            <button type="submit" disabled={submitting} className="min-h-10 justify-self-start rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
              {submitting ? "Submitting..." : "Submit leave request"}
            </button>
          </form>
        </section>
      )}

      {loading ? (
        <p className="py-6 text-sm text-slate-500 dark:text-slate-400">Loading requests...</p>
      ) : canReview ? (
        <div className="space-y-8">
          <RequestReviewList
            title="Leave requests"
            emptyMessage="No pending leave requests."
            kind="leave"
            requests={pending.leaveRequests}
            responseValues={reviewResponses}
            submitting={submitting}
            onResponseChange={updateResponse}
            onReview={reviewRequest}
          />
          <RequestReviewList
            title="Shift-decline requests"
            emptyMessage="No pending shift-decline requests."
            kind="shift-declines"
            requests={pending.shiftDeclineRequests}
            responseValues={reviewResponses}
            submitting={submitting}
            onResponseChange={updateResponse}
            onReview={reviewRequest}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <RequestHistory title="Leave request history" emptyMessage="No leave requests yet." items={leaveRequests.map((request) => ({
            id: request.id,
            dateLabel: `${request.startDate} to ${request.endDate}`,
            reason: request.reason,
            status: request.status,
            reviewResponse: request.reviewResponse,
          }))} />
          <RequestHistory title="Shift-decline request history" emptyMessage="No shift-decline requests yet." items={declineRequests.map((request) => ({
            id: request.id,
            dateLabel: `Shift #${request.shiftId} · ${new Date(request.startTime).toLocaleString()}`,
            reason: request.reason,
            status: request.status,
            reviewResponse: request.reviewResponse,
          }))} />
        </div>
      )}
    </main>
  );
}

type ReviewKind = "leave" | "shift-declines";

function RequestReviewList<T extends LeaveRequest | ShiftDeclineRequest>({
  title,
  emptyMessage,
  kind,
  requests,
  responseValues,
  submitting,
  onResponseChange,
  onReview,
}: {
  title: string;
  emptyMessage: string;
  kind: ReviewKind;
  requests: T[];
  responseValues: Record<string, string>;
  submitting: boolean;
  onResponseChange: (key: string, value: string) => void;
  onReview: (kind: ReviewKind, id: number, approve: boolean) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title} <span className="text-slate-500">({requests.length})</span></h2>
      {requests.length === 0 ? (
        <p className="rounded-lg border border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">{emptyMessage}</p>
      ) : requests.map((request) => {
        const key = `${kind}:${request.id}`;
        const dateLabel = "startDate" in request
          ? `${request.startDate} to ${request.endDate}`
          : `Shift #${request.shiftId} · ${new Date(request.startTime).toLocaleString()}`;
        return (
          <article key={key} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{request.carerName} · {dateLabel}</h3>
              <span className="text-xs text-slate-500">Requested {new Date(request.createdAt).toLocaleDateString()}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{request.reason}</p>
            <label className="block space-y-1 text-xs font-medium text-slate-700 dark:text-slate-200">
              Response to Carer
              <textarea rows={2} maxLength={2000} value={responseValues[key] ?? ""} onChange={(event) => onResponseChange(key, event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-950" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={submitting} onClick={() => onReview(kind, request.id, true)} className="min-h-9 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">Approve</button>
              <button type="button" disabled={submitting} onClick={() => onReview(kind, request.id, false)} className="min-h-9 rounded-lg bg-rose-700 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50">Reject</button>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function RequestHistory({
  title,
  emptyMessage,
  items,
}: {
  title: string;
  emptyMessage: string;
  items: { id: number; dateLabel: string; reason: string; status: string; reviewResponse?: string | null }[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
      {items.length === 0 ? (
        <p className="rounded-lg border border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">{emptyMessage}</p>
      ) : items.map((item) => (
        <article key={item.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{item.dateLabel}</h3>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(item.status)}`}>{item.status}</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">{item.reason}</p>
          {item.reviewResponse && <p className="border-t border-slate-200 pt-2 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200">Response: {item.reviewResponse}</p>}
        </article>
      ))}
    </section>
  );
}