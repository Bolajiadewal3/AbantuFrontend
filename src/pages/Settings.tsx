import { useEffect, useState } from "react";
import { useTheme, type ThemeMode } from "../context/ThemeContext";
import { apiFetch } from "../utils/api";
import { authStorage } from "../utils/auth";

type BackupHistoryItem = {
  id: string;
  createdAt: string;
  sizeBytes: number;
  database: string;
  kind: string;
};

type SmtpProvider = "gmail" | "microsoft365";

type SmtpSettingsStatus = {
  provider: SmtpProvider;
  host: string;
  port: number;
  enableSsl: boolean;
  fromAddress: string;
  username: string;
  passwordConfigured: boolean;
};

async function getBackupHistory(signal?: AbortSignal): Promise<BackupHistoryItem[]> {
  const response = await apiFetch("/api/admin/backups", { signal });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(body?.message || `Could not load backups (${response.status}).`);
  }

  return response.json();
}

async function getResponseError(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => null)) as
    | { message?: string }
    | null;
  return new Error(body?.message || `Request failed (${response.status}).`);
}

function formatBackupSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const isAdmin = authStorage.getUser()?.role === "Admin";
  const [savedMessage, setSavedMessage] = useState("");
  const [backups, setBackups] = useState<BackupHistoryItem[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(true);
  const [backupError, setBackupError] = useState("");
  const [backupMessage, setBackupMessage] = useState("");
  const [backupAction, setBackupAction] = useState<"create" | "restore" | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BackupHistoryItem | null>(null);
  const [restoreConfirmation, setRestoreConfirmation] = useState("");
  const [smtpStatus, setSmtpStatus] = useState<SmtpSettingsStatus | null>(null);
  const [smtpForm, setSmtpForm] = useState({
    provider: "gmail" as SmtpProvider,
    fromAddress: "",
    username: "",
    appPassword: "",
  });
  const [smtpRecipient, setSmtpRecipient] = useState(
    () => authStorage.getUser()?.email ?? "",
  );
  const [smtpLoading, setSmtpLoading] = useState(true);
  const [smtpManagedByHost, setSmtpManagedByHost] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpError, setSmtpError] = useState("");
  const [smtpMessage, setSmtpMessage] = useState("");

  useEffect(() => {
    if (!isAdmin) {
      setBackupsLoading(false);
      return;
    }

    const controller = new AbortController();
    void getBackupHistory(controller.signal)
      .then(setBackups)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setBackupError(error instanceof Error ? error.message : "Could not load backups.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBackupsLoading(false);
      });

    return () => controller.abort();
  }, [isAdmin]);

  useEffect(() => {
    const controller = new AbortController();
    void apiFetch("/api/admin/smtp-settings", { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) {
          setSmtpManagedByHost(true);
          return;
        }
        if (!response.ok) throw await getResponseError(response);

        const status = (await response.json()) as SmtpSettingsStatus;
        setSmtpStatus(status);
        setSmtpForm({
          provider: status.provider,
          fromAddress: status.fromAddress,
          username: status.username,
          appPassword: "",
        });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setSmtpError(error instanceof Error ? error.message : "Could not load email settings.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSmtpLoading(false);
      });

    return () => controller.abort();
  }, []);

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    setSavedMessage("Theme updated successfully!");
    setTimeout(() => setSavedMessage(""), 3000);
  };

  const refreshBackups = async () => {
    setBackupsLoading(true);
    try {
      setBackups(await getBackupHistory());
      setBackupError("");
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : "Could not load backups.");
    } finally {
      setBackupsLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setBackupAction("create");
    setBackupError("");
    setBackupMessage("");
    try {
      const response = await apiFetch("/api/admin/backups", { method: "POST" });
      if (!response.ok) throw await getResponseError(response);
      setBackupMessage("Backup created and archive checked.");
      await refreshBackups();
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : "Could not create backup.");
    } finally {
      setBackupAction(null);
    }
  };

  const handleDownloadBackup = async (backup: BackupHistoryItem) => {
    setBackupError("");
    try {
      const response = await apiFetch(`/api/admin/backups/${backup.id}/download`);
      if (!response.ok) throw await getResponseError(response);

      const downloadUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `careapp-backup-${backup.id}.dump`;
      link.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : "Could not download backup.");
    }
  };

  const handleRestoreBackup = async () => {
    if (!restoreTarget || restoreConfirmation !== "RESTORE ACTIVE DATABASE") return;

    setBackupAction("restore");
    setBackupError("");
    setBackupMessage("");
    try {
      const response = await apiFetch(
        `/api/admin/backups/${restoreTarget.id}/restore`,
        {
          method: "POST",
          body: JSON.stringify({ confirmation: restoreConfirmation }),
        },
      );
      if (!response.ok) throw await getResponseError(response);

      const result = (await response.json()) as {
        safetyBackup: BackupHistoryItem;
      };
      setBackupMessage(
        `Restore complete. Current database snapshot saved as ${result.safetyBackup.id.slice(0, 8)}.`,
      );
      setRestoreTarget(null);
      setRestoreConfirmation("");
      await refreshBackups();
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : "Could not restore backup.");
    } finally {
      setBackupAction(null);
    }
  };

  const handleSaveSmtpSettings = async () => {
    setSmtpSaving(true);
    setSmtpError("");
    setSmtpMessage("");
    try {
      const response = await apiFetch("/api/admin/smtp-settings", {
        method: "PUT",
        body: JSON.stringify(smtpForm),
      });
      if (!response.ok) throw await getResponseError(response);

      const status = (await response.json()) as SmtpSettingsStatus;
      setSmtpStatus(status);
      setSmtpForm((current) => ({ ...current, appPassword: "" }));
      setSmtpMessage("Email settings saved to local User Secrets.");
    } catch (error) {
      setSmtpError(error instanceof Error ? error.message : "Could not save email settings.");
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    setSmtpTesting(true);
    setSmtpError("");
    setSmtpMessage("");
    try {
      const response = await apiFetch("/api/admin/smtp-settings/test", {
        method: "POST",
        body: JSON.stringify({ emailAddress: smtpRecipient }),
      });
      if (!response.ok) throw await getResponseError(response);

      const result = (await response.json()) as { message: string };
      setSmtpMessage(result.message);
    } catch (error) {
      setSmtpError(error instanceof Error ? error.message : "Could not send test email.");
    } finally {
      setSmtpTesting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          System Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Customize your portal experience and display preferences.
        </p>
      </div>

      {savedMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm font-medium">
          {savedMessage}
        </div>
      )}

      {/* Theme Preference Card */}
      <section className="p-6 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 shadow-sm dark:shadow-2xl backdrop-blur-md space-y-6">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            Appearance & Theme
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Dark Option */}
          <button
            onClick={() => handleThemeChange("dark")}
            className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between h-32 ${
              theme === "dark"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-slate-900 dark:text-white"
                : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <div className="flex justify-between items-center w-full">
              <span className="text-xl">🌙</span>
              {theme === "dark" && (
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              )}
            </div>
            <div>
              <div className="font-bold text-sm">Dark Theme</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Roster dark glass aesthetic
              </div>
            </div>
          </button>

          {/* Light Option */}
          <button
            onClick={() => handleThemeChange("light")}
            className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between h-32 ${
              theme === "light"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-slate-900 dark:text-white"
                : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <div className="flex justify-between items-center w-full">
              <span className="text-xl">☀️</span>
              {theme === "light" && (
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              )}
            </div>
            <div>
              <div className="font-bold text-sm">Light Theme</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Clean slate background
              </div>
            </div>
          </button>

          {/* System Option */}
          <button
            onClick={() => handleThemeChange("system")}
            className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between h-32 ${
              theme === "system"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-slate-900 dark:text-white"
                : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <div className="flex justify-between items-center w-full">
              <span className="text-xl">💻</span>
              {theme === "system" && (
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              )}
            </div>
            <div>
              <div className="font-bold text-sm">System Default</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Sync with OS preferences
              </div>
            </div>
          </button>
        </div>
      </section>

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/70 sm:p-6">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Password reset email
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Configure the mailbox CareApp uses to send single-use password reset links.
          </p>
        </div>

        {smtpManagedByHost ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
            Email settings are managed by the deployment secret store outside local Development.
          </p>
        ) : smtpLoading ? (
          <p className="py-3 text-sm text-slate-500 dark:text-slate-400">Loading email settings...</p>
        ) : (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveSmtpSettings();
            }}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                Mail provider
                <select
                  value={smtpForm.provider}
                  onChange={(event) =>
                    setSmtpForm((current) => ({
                      ...current,
                      provider: event.target.value as SmtpProvider,
                      appPassword: "",
                    }))
                  }
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="gmail">Gmail</option>
                  <option value="microsoft365">Microsoft 365 / Outlook domain</option>
                </select>
              </label>
              <div className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                <span className="block font-medium text-slate-700 dark:text-slate-200">SMTP connection</span>
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
                  {smtpForm.provider === "gmail" ? "smtp.gmail.com" : "smtp.office365.com"} · port 587 · STARTTLS
                </p>
              </div>
              <label className="space-y-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                Sender email address
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={smtpForm.fromAddress}
                  onChange={(event) => setSmtpForm((current) => ({ ...current, fromAddress: event.target.value }))}
                  placeholder="care@example.com"
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                SMTP account email
                <input
                  required
                  type="email"
                  autoComplete="username"
                  value={smtpForm.username}
                  onChange={(event) => setSmtpForm((current) => ({ ...current, username: event.target.value }))}
                  placeholder="mailbox@example.com"
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
                App password or SMTP credential
                <input
                  type="password"
                  autoComplete="new-password"
                  value={smtpForm.appPassword}
                  onChange={(event) => setSmtpForm((current) => ({ ...current, appPassword: event.target.value }))}
                  placeholder={smtpStatus?.passwordConfigured ? "Saved; leave blank to keep the current credential" : "Paste the provider-generated app password"}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
                <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                  This credential is stored in local .NET User Secrets and is never returned to the browser. Do not use your normal mailbox password or an email one-time code.
                </span>
              </label>
            </div>

            {smtpForm.provider === "gmail" ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gmail generally requires 2-Step Verification and a Google-generated app password. Use the mailbox or an authorized sender alias for the From address.
              </p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Microsoft 365 SMTP AUTH must be enabled for the tenant and mailbox. If your organization blocks password-based SMTP, this sender needs OAuth or Microsoft Graph instead.
              </p>
            )}

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 space-y-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                Send test message to
                <input
                  required
                  type="email"
                  value={smtpRecipient}
                  onChange={(event) => setSmtpRecipient(event.target.value)}
                  placeholder="admin@example.com"
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={handleTestSmtp}
                  disabled={smtpTesting || smtpSaving || !smtpStatus?.passwordConfigured}
                  className="min-h-10 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {smtpTesting ? "Sending..." : "Send test"}
                </button>
                <button
                  type="submit"
                  disabled={smtpSaving || smtpTesting}
                  className="min-h-10 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {smtpSaving ? "Saving..." : "Save email settings"}
                </button>
              </div>
            </div>
          </form>
        )}

        {smtpMessage && <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{smtpMessage}</p>}
        {smtpError && <p role="alert" className="text-sm font-medium text-rose-700 dark:text-rose-400">{smtpError}</p>}
      </section>

      {isAdmin && (
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/70 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Database backups
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              Create verified snapshots, download an archive, or restore a selected backup.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreateBackup}
            disabled={backupAction !== null}
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {backupAction === "create" ? "Creating backup..." : "Create backup"}
          </button>
        </div>

        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          Restoring replaces the active database. CareApp first creates and retains a verified snapshot of the current database; restore stops if that snapshot fails. During restore, this API instance pauses other API requests. For hosted deployments, pause traffic to every other API instance too.
        </div>

        {backupMessage && (
          <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {backupMessage}
          </p>
        )}
        {backupError && (
          <p role="alert" className="text-sm font-medium text-rose-700 dark:text-rose-400">
            {backupError}
          </p>
        )}

        {backupsLoading ? (
          <p className="py-4 text-sm text-slate-500 dark:text-slate-400">Loading backup history...</p>
        ) : backupError ? null : backups.length === 0 ? (
          <p className="py-4 text-sm text-slate-500 dark:text-slate-400">
            No backups found in the configured backup storage.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {backups.map((backup) => (
              <li
                key={backup.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {new Date(backup.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {backup.kind} · {backup.database} · {formatBackupSize(backup.sizeBytes)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 sm:shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleDownloadBackup(backup)}
                    className="min-h-9 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRestoreTarget(backup);
                      setRestoreConfirmation("");
                    }}
                    disabled={backupAction !== null}
                    className="min-h-9 rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                  >
                    Restore...
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {isAdmin && restoreTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && backupAction === null) {
              setRestoreTarget(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="restore-backup-title"
            className="w-full max-w-lg space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-6"
          >
            <div>
              <h2 id="restore-backup-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Restore active database?
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                This will replace <strong>{restoreTarget.database}</strong> with the backup from {new Date(restoreTarget.createdAt).toLocaleString()}.
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                A verified snapshot of the current database will be saved to history first. If that snapshot fails, restore will not proceed.
              </p>
            </div>
            <label className="block space-y-2 text-sm font-medium text-slate-800 dark:text-slate-200">
              Type <span className="font-mono">RESTORE ACTIVE DATABASE</span> to confirm.
              <input
                autoComplete="off"
                value={restoreConfirmation}
                onChange={(event) => setRestoreConfirmation(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                disabled={backupAction === "restore"}
                className="min-h-10 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestoreBackup}
                disabled={backupAction !== null || restoreConfirmation !== "RESTORE ACTIVE DATABASE"}
                className="min-h-10 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {backupAction === "restore" ? "Restoring..." : "Restore database"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
