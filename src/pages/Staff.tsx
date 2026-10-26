import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { authStorage } from "../utils/auth";

interface StaffMember {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
}

export default function Staff() {
  const currentUser = authStorage.getUser();
  const isAdmin = currentUser?.role === "Admin";
  const isSuperAdmin = authStorage.isSuperAdmin();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [offboardingStaff, setOffboardingStaff] = useState<StaffMember | null>(null);
  const [offboardingReason, setOffboardingReason] = useState("");
  const [offboardingError, setOffboardingError] = useState("");
  const [offboardingBusy, setOffboardingBusy] = useState(false);

  // Registration Modal State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newStaff, setNewStaff] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "Carer",
  });

  // Edit Modal State
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [passwordResetTargetEmail, setPasswordResetTargetEmail] = useState<string | null>(null);
  const [passwordResetSending, setPasswordResetSending] = useState(false);
  const [passwordResetMessage, setPasswordResetMessage] = useState("");
  const [passwordResetError, setPasswordResetError] = useState("");

  const fetchStaff = async () => {
    try {
      const res = await apiFetch("/api/users/active");
      if (res.ok) {
        const data = await res.json();
        setStaff(data);
      }
    } catch (err) {
      console.error("Failed to fetch staff list", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify(newStaff),
      });

      if (res.ok) {
        setShowRegisterModal(false);
        setNewStaff({
          firstName: "",
          lastName: "",
          email: "",
          password: "",
          role: "Carer",
        });
        fetchStaff();
      }
    } catch (err) {
      console.error("Registration error", err);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    try {
      const res = await apiFetch(`/api/users/${editingStaff.id}`, {
        method: "PUT",
        body: JSON.stringify(editingStaff),
      });

      if (res.ok) {
        setEditingStaff(null);
        fetchStaff();
      } else {
        const errorData = await res.json();
        alert(errorData.message || "Failed to update staff member.");
      }
    } catch (err) {
      console.error("Update error", err);
    }
  };

  const handleSendPasswordResetLink = async () => {
    if (!passwordResetTargetEmail || !window.confirm(`Send a one-time password reset link to ${passwordResetTargetEmail}?`)) {
      return;
    }

    setPasswordResetSending(true);
    setPasswordResetMessage("");
    setPasswordResetError("");
    try {
      const response = await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: passwordResetTargetEmail }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setPasswordResetError(body?.message || "Could not request a password reset email.");
        return;
      }

      setPasswordResetMessage(body?.message || "If an active account matches, a reset link will be sent shortly.");
    } catch {
      setPasswordResetError("Could not request a password reset email.");
    } finally {
      setPasswordResetSending(false);
    }
  };

  const toggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      const res = await apiFetch(`/api/users/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (res.ok) fetchStaff();
    } catch (err) {
      console.error("Status update error", err);
    }
  };

  const handleOffboard = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!offboardingStaff || offboardingReason.trim().length < 10) return;
    setOffboardingBusy(true);
    setOffboardingError("");
    try {
      const response = await apiFetch(`/api/users/${offboardingStaff.id}/offboard`, {
        method: "POST",
        body: JSON.stringify({ reason: offboardingReason.trim() }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setOffboardingError(body?.message || "Could not offboard this Admin account.");
        return;
      }
      setOffboardingStaff(null);
      setOffboardingReason("");
      await fetchStaff();
    } catch {
      setOffboardingError("Could not offboard this Admin account. Check your connection and try again.");
    } finally {
      setOffboardingBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Staff Directory
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Manage carer accounts and portal permissions
          </p>
        </div>
        <button
          onClick={() => setShowRegisterModal(true)}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-blue-500/20 active:scale-[0.99] transition-all cursor-pointer self-start sm:self-auto"
        >
          + Register New Staff
        </button>
      </div>

      {loading ? (
        <div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 animate-pulse" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/70 shadow-sm dark:shadow-2xl backdrop-blur-md">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3.5">Name</th>
                <th className="px-5 py-3.5">Email</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-xs sm:text-sm">
              {staff.map((member) => (
                <tr
                  key={member.id}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition"
                >
                  <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">
                    {member.firstName} {member.lastName}
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                    {member.email}
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {member.role}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`font-semibold ${
                        member.isActive
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-500"
                      }`}
                    >
                      {member.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-4 flex items-center gap-2">
                    {member.role !== "Admin" && (
                      <>
                        <button
                          onClick={() => {
                            setEditingStaff({ ...member });
                            setPasswordResetTargetEmail(member.role === "Carer" ? member.email : null);
                            setPasswordResetMessage("");
                            setPasswordResetError("");
                          }}
                          className="rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/80 px-3 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => toggleStatus(member.id, member.isActive)}
                          className={`rounded-xl border px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                            member.isActive
                              ? "border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                          }`}
                        >
                          {member.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </>
                    )}
                    {member.role === "Admin" && isSuperAdmin && member.isActive && member.id !== currentUser?.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setOffboardingStaff(member);
                          setOffboardingReason("");
                          setOffboardingError("");
                        }}
                        className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-500/20 dark:text-rose-300"
                      >
                        Offboard Admin
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for Registering Staff */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              Register New Staff
            </h2>
            <form onSubmit={handleRegister} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="First Name"
                required
                value={newStaff.firstName}
                onChange={(e) =>
                  setNewStaff({ ...newStaff, firstName: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Last Name"
                required
                value={newStaff.lastName}
                onChange={(e) =>
                  setNewStaff({ ...newStaff, lastName: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
              />
              <input
                type="email"
                placeholder="Email Address"
                required
                value={newStaff.email}
                onChange={(e) =>
                  setNewStaff({ ...newStaff, email: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
              />
              <input
                type="password"
                placeholder="Initial Password"
                required
                value={newStaff.password}
                onChange={(e) =>
                  setNewStaff({ ...newStaff, password: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
              />
              <select
                value={newStaff.role}
                onChange={(e) =>
                  setNewStaff({ ...newStaff, role: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
              >
                <option value="Carer">Carer</option>
                <option value="Manager">Manager</option>
                {isAdmin && <option value="Admin">Admin</option>}
              </select>
              {passwordResetMessage && <output className="mt-3 block text-xs text-emerald-700 dark:text-emerald-300">{passwordResetMessage}</output>}
              {passwordResetError && <p role="alert" className="mt-3 text-xs text-rose-700 dark:text-rose-300">{passwordResetError}</p>}
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2.5">
                {isAdmin && passwordResetTargetEmail && (
                  <button
                    type="button"
                    onClick={handleSendPasswordResetLink}
                    disabled={passwordResetSending}
                    className="mr-auto rounded-xl border border-amber-300 px-4 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-50 disabled:cursor-wait disabled:opacity-50 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/40"
                  >
                    {passwordResetSending ? "Sending..." : "Send reset link"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Editing Staff */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              Edit Staff Member
            </h2>
            <form onSubmit={handleUpdate} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  required
                  value={editingStaff.firstName}
                  onChange={(e) =>
                    setEditingStaff({
                      ...editingStaff,
                      firstName: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  required
                  value={editingStaff.lastName}
                  onChange={(e) =>
                    setEditingStaff({
                      ...editingStaff,
                      lastName: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={editingStaff.email}
                  onChange={(e) =>
                    setEditingStaff({ ...editingStaff, email: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Role
                </label>
                <select
                  value={editingStaff.role}
                  onChange={(e) =>
                    setEditingStaff({ ...editingStaff, role: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                >
                  <option value="Carer">Carer</option>
                  <option value="Manager">Manager</option>
                  {isAdmin && <option value="Admin">Admin</option>}
                </select>
              </div>

              <div className="mt-3 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {offboardingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <form onSubmit={handleOffboard} role="dialog" aria-modal="true" aria-labelledby="offboard-admin-title" className="w-full max-w-lg space-y-4 rounded-lg border border-rose-800/60 bg-slate-900 p-5 text-white shadow-2xl">
            <div>
              <h2 id="offboard-admin-title" className="text-lg font-bold">Offboard Admin account</h2>
              <p className="mt-1 text-sm text-slate-300">{offboardingStaff.firstName} {offboardingStaff.lastName} will lose access immediately. This action is recorded in the Super Admin audit trail.</p>
            </div>
            <label className="block space-y-1.5 text-sm font-medium text-slate-200">
              Reason
              <textarea required minLength={10} maxLength={500} rows={4} value={offboardingReason} onChange={(event) => setOffboardingReason(event.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-950 p-3 text-white" placeholder="State the approved offboarding reason" />
            </label>
            {offboardingError && <p role="alert" className="text-sm text-rose-300">{offboardingError}</p>}
            <div className="flex justify-end gap-2 border-t border-slate-700 pt-3">
              <button type="button" disabled={offboardingBusy} onClick={() => setOffboardingStaff(null)} className="rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200">Cancel</button>
              <button type="submit" disabled={offboardingBusy || offboardingReason.trim().length < 10} className="rounded-md bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50">{offboardingBusy ? "Offboarding..." : "Confirm offboarding"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
