import { useState, type FormEvent } from "react";
import { apiFetch } from "../utils/api";

type ImportRecordType = "Carer" | "ServiceUser";
type ImportRowAction = "Create" | "Update" | "Skip";

interface DataImportFieldDifference {
  field: string;
  existingValue: string;
  incomingValue: string;
}

interface DataImportCandidate {
  id: number;
  displayName: string;
  matchReason: string;
  similarityPercent: number;
  differences: DataImportFieldDifference[];
}

interface DataImportPreviewRow {
  rowNumber: number;
  status: string;
  incomingValues: Record<string, string>;
  errors: string[];
  candidates: DataImportCandidate[];
}

interface DataImportPreview {
  previewId: string;
  recordType: ImportRecordType;
  expiresAt: string;
  rows: DataImportPreviewRow[];
}

interface RowDecision {
  action: ImportRowAction;
  targetId?: number;
  fieldsToUpdate: string[];
}

interface CommitResultRow {
  rowNumber: number;
  action: ImportRowAction;
  status: string;
  recordId: number | null;
  message: string | null;
}

interface CommitResult {
  importBatchId: string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  rows: CommitResultRow[];
}

function getErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === "object" && body !== null && "message" in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

function initialDecision(row: DataImportPreviewRow): RowDecision {
  return {
    action: row.errors.length > 0 || row.candidates.length > 0 ? "Skip" : "Create",
    fieldsToUpdate: [],
  };
}

export default function AdminDataImport() {
  const [recordType, setRecordType] = useState<ImportRecordType>("Carer");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DataImportPreview | null>(null);
  const [decisions, setDecisions] = useState<Record<number, RowDecision>>({});
  const [result, setResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handlePreview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError("Choose a CSV or XLSX file first.");
      return;
    }

    setIsLoading(true);
    setError("");
    setPreview(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("recordType", recordType);
      form.append("file", file);
      const response = await apiFetch("/api/admin/data-imports/preview", {
        method: "POST",
        body: form,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body, "Could not preview this file."));

      const nextPreview = body as DataImportPreview;
      setPreview(nextPreview);
      setDecisions(Object.fromEntries(nextPreview.rows.map(row => [row.rowNumber, initialDecision(row)])));
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Could not preview this file.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateDecision = (rowNumber: number, decision: RowDecision) => {
    setDecisions(current => ({ ...current, [rowNumber]: decision }));
  };

  const handleChoiceChange = (row: DataImportPreviewRow, value: string) => {
    if (value === "create") {
      updateDecision(row.rowNumber, { action: "Create", fieldsToUpdate: [] });
      return;
    }
    if (value.startsWith("update:")) {
      const targetId = Number(value.slice("update:".length));
      updateDecision(row.rowNumber, { action: "Update", targetId, fieldsToUpdate: [] });
      return;
    }
    updateDecision(row.rowNumber, { action: "Skip", fieldsToUpdate: [] });
  };

  const toggleField = (row: DataImportPreviewRow, field: string, checked: boolean) => {
    const decision = decisions[row.rowNumber] ?? initialDecision(row);
    const fieldsToUpdate = checked
      ? [...decision.fieldsToUpdate, field]
      : decision.fieldsToUpdate.filter(value => value !== field);
    updateDecision(row.rowNumber, { ...decision, fieldsToUpdate });
  };

  const handleCommit = async () => {
    if (!preview) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/admin/data-imports/commit", {
        method: "POST",
        body: JSON.stringify({
          previewId: preview.previewId,
          decisions: preview.rows.map(row => ({ rowNumber: row.rowNumber, ...decisions[row.rowNumber] })),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body, "Could not commit this import."));
      setResult(body as CommitResult);
      setPreview(null);
    } catch (commitError) {
      setError(commitError instanceof Error ? commitError.message : "Could not commit this import.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8">
      <header className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">Administration</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">Spreadsheet import</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Preview every row before applying changes. Similar names are suggestions only; no record is merged or overwritten automatically.
        </p>
      </header>

      <div className="grid gap-4 border-b border-slate-200 pb-5 sm:grid-cols-2 dark:border-slate-800">
        <section>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Carer columns</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400"><strong>Required:</strong> First Name, Last Name, Email</p>
          <p className="text-sm text-slate-600 dark:text-slate-400"><strong>Optional:</strong> Max Weekly Hours</p>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Service-user columns</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400"><strong>Required:</strong> First Name, Last Name, Postcode</p>
          <p className="text-sm text-slate-600 dark:text-slate-400"><strong>Optional:</strong> Address Details, Care Plan Summary</p>
        </section>
        <p className="text-sm text-slate-600 sm:col-span-2 dark:text-slate-400">
          Password columns are rejected. Carers created by import receive a password-reset email. Matching records are suggestions only; no overwrite is automatic.
        </p>
      </div>

      {error && <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{error}</p>}

      <form onSubmit={handlePreview} className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end dark:border-slate-800">
        <div className="space-y-1">
          <label htmlFor="import-record-type" className="block text-sm font-medium text-slate-700 dark:text-slate-200">Records</label>
          <select id="import-record-type" value={recordType} onChange={event => setRecordType(event.target.value as ImportRecordType)} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            <option value="Carer">Carers</option>
            <option value="ServiceUser">Service users</option>
          </select>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <label htmlFor="import-file" className="block text-sm font-medium text-slate-700 dark:text-slate-200">CSV or XLSX file (max 5 MiB, 500 rows)</label>
          <input id="import-file" type="file" accept=".csv,.xlsx" onChange={event => { setFile(event.target.files?.[0] ?? null); setPreview(null); setResult(null); }} className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-medium dark:text-slate-200 dark:file:bg-slate-800" />
        </div>
        <button type="submit" disabled={!file || isLoading} className="h-10 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
          {isLoading ? "Previewing..." : "Preview import"}
        </button>
      </form>

      {preview && (
        <section className="space-y-4" aria-label="Import preview">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Preview · {preview.rows.length} rows</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Preview expires {new Date(preview.expiresAt).toLocaleTimeString()}.</p>
            </div>
            <button type="button" onClick={() => void handleCommit()} disabled={isLoading} className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
              {isLoading ? "Importing..." : "Apply selected decisions"}
            </button>
          </div>

          {preview.rows.map(row => {
            const decision = decisions[row.rowNumber] ?? initialDecision(row);
            const candidate = row.candidates.find(item => item.id === decision.targetId);
            const choice = decision.action === "Update" ? `update:${decision.targetId}` : decision.action.toLowerCase();
            return (
              <article key={row.rowNumber} className="space-y-3 border-b border-slate-200 py-4 dark:border-slate-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">Row {row.rowNumber} · {row.status}</h3>
                    <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
                      {Object.entries(row.incomingValues).filter(([, value]) => value).map(([field, value]) => (
                        <div key={field} className="flex gap-1"><dt className="font-medium">{field}:</dt><dd>{value}</dd></div>
                      ))}
                    </dl>
                  </div>
                  <label className="space-y-1 text-sm">
                    <span className="block font-medium text-slate-700 dark:text-slate-200">Decision</span>
                    <select aria-label={`Decision for row ${row.rowNumber}`} disabled={row.errors.length > 0} value={choice} onChange={event => handleChoiceChange(row, event.target.value)} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                      <option value="skip">Skip</option>
                      {row.errors.length === 0 && <option value="create">Create new</option>}
                      {row.errors.length === 0 && row.candidates.map(item => (
                        <option key={item.id} value={`update:${item.id}`}>Update {item.displayName} · {item.matchReason} · {item.similarityPercent}%</option>
                      ))}
                    </select>
                  </label>
                </div>

                {row.errors.length > 0 && <ul className="list-disc pl-5 text-sm text-rose-700 dark:text-rose-300">{row.errors.map(message => <li key={message}>{message}</li>)}</ul>}

                {decision.action === "Update" && candidate && (
                  <div className="overflow-x-auto rounded-md border border-amber-300 dark:border-amber-900">
                    <p className="p-3 text-sm text-amber-900 dark:text-amber-200">{candidate.matchReason}. Choose exactly which fields to replace.</p>
                    {candidate.differences.length === 0 ? (
                      <p className="px-3 pb-3 text-sm text-slate-600 dark:text-slate-400">No field differences were found; skip this row or create it as a separate record.</p>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-600 dark:bg-slate-950 dark:text-slate-400"><tr><th className="p-2">Update?</th><th className="p-2">Field</th><th className="p-2">Existing</th><th className="p-2">Incoming</th></tr></thead>
                        <tbody>{candidate.differences.map(diff => (
                          <tr key={diff.field} className="border-t border-slate-200 dark:border-slate-800">
                            <td className="p-2"><input type="checkbox" aria-label={`Update ${diff.field} for row ${row.rowNumber}`} checked={decision.fieldsToUpdate.includes(diff.field)} onChange={event => toggleField(row, diff.field, event.target.checked)} /></td>
                            <th scope="row" className="p-2 font-medium">{diff.field}</th>
                            <td className="max-w-72 break-words p-2">{diff.existingValue}</td>
                            <td className="max-w-72 break-words p-2">{diff.incomingValue}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {result && (
        <section aria-label="Import results" className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Import results</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">Created {result.created} · Updated {result.updated} · Skipped {result.skipped} · Failed {result.failed}</p>
          <ul className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {result.rows.map(row => <li key={row.rowNumber} className="py-2 text-sm"><span className="font-medium">Row {row.rowNumber}: {row.status}</span>{row.recordId !== null && ` · Record ${row.recordId}`}{row.message && <span className="ml-2 text-amber-700 dark:text-amber-300">{row.message}</span>}</li>)}
          </ul>
          <p className="break-all text-xs text-slate-500">Import batch {result.importBatchId}</p>
        </section>
      )}
    </main>
  );
}