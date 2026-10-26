import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";

interface Competency {
  id: number;
  name: string;
  description: string;
  qualifiedStaffCount?: number;
  demandingClientsCount?: number;
}

interface CompetencyDetails {
  id: number;
  name: string;
  description: string;
  qualifiedStaff: Array<{
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  }>;
  demandingClients: Array<{
    id: number;
    firstName: string;
    lastName: string;
    postcode: string;
  }>;
  allServiceUsers: Array<{
    id: number;
    firstName: string;
    lastName: string;
    postcode: string;
  }>;
}

export default function AdminCompetencies() {
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  // Form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  // Modal state
  const [selectedDetails, setSelectedDetails] =
    useState<CompetencyDetails | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [selectedServiceUserId, setSelectedServiceUserId] =
    useState<string>("");

  useEffect(() => {
    fetchCompetencies();
  }, []);

  const fetchCompetencies = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/competencies");
      if (res.ok) {
        const data = await res.json();
        setCompetencies(data);
      } else {
        setError("Failed to load competencies.");
      }
    } catch {
      setError("An error occurred loading competencies.");
    } finally {
      setLoading(false);
    }
  };

  const openCompetencyModal = async (id: number) => {
    setModalLoading(true);
    try {
      const res = await apiFetch(`/api/competencies/${id}/details`);
      if (res.ok) {
        const data = await res.json();
        setSelectedDetails(data);
      } else {
        setError("Failed to load competency details.");
      }
    } catch {
      setError("An error occurred loading competency details.");
    } finally {
      setModalLoading(false);
    }
  };

  const handleAddServiceUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDetails || !selectedServiceUserId) return;

    try {
      const res = await apiFetch(
        `/api/competencies/${selectedDetails.id}/service-users`,
        {
          method: "POST",
          body: JSON.stringify({
            serviceUserId: Number(selectedServiceUserId),
          }),
        },
      );

      if (res.ok) {
        setSelectedServiceUserId("");
        openCompetencyModal(selectedDetails.id);
        fetchCompetencies();
      } else {
        const data = await res.json();
        setError(data.message || "Failed to assign service user requirement.");
      }
    } catch {
      setError("An error occurred assigning service user requirement.");
    }
  };

  const handleRemoveServiceUser = async (serviceUserId: number) => {
    if (!selectedDetails) return;
    if (
      !confirm("Are you sure you want to remove this service user requirement?")
    )
      return;

    try {
      const res = await apiFetch(
        `/api/competencies/${selectedDetails.id}/service-users/${serviceUserId}`,
        {
          method: "DELETE",
        },
      );

      if (res.ok) {
        openCompetencyModal(selectedDetails.id);
        fetchCompetencies();
      } else {
        setError("Failed to remove service user requirement.");
      }
    } catch {
      setError("An error occurred removing service user requirement.");
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setEditingId(null);
  };

  const handleEdit = (comp: Competency) => {
    setEditingId(comp.id);
    setName(comp.name);
    setDescription(comp.description);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this competency?")) return;
    try {
      const res = await apiFetch(`/api/competencies/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSuccess("Competency deleted.");
        fetchCompetencies();
      } else {
        setError("Failed to delete competency.");
      }
    } catch {
      setError("An error occurred deleting competency.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError("");
    setSuccess("");

    const isEditing = editingId !== null;
    const url = isEditing
      ? `/api/competencies/${editingId}`
      : "/api/competencies";
    const method = isEditing ? "PUT" : "POST";

    try {
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify({ name, description }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to save competency.");
      }

      setSuccess(isEditing ? "Competency updated!" : "Competency created!");
      resetForm();
      fetchCompetencies();
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 text-slate-100">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <h1 className="text-xl font-bold text-white">Competency Governance</h1>
        <span className="text-xs text-slate-400">
          Total: {competencies.length}
        </span>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Panel */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl h-fit space-y-4">
          <h2 className="text-sm font-bold text-white">
            {editingId !== null ? "Edit Competency" : "Create Competency"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Title *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. PEG Feeding"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Outline clinical standards..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl text-xs transition disabled:opacity-50"
              >
                {submitting
                  ? "Saving..."
                  : editingId !== null
                    ? "Update"
                    : "Create"}
              </button>
              {editingId !== null && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-xs"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Competencies List */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Loading competencies...
            </div>
          ) : competencies.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">
              No competencies registered.
            </div>
          ) : (
            competencies.map((comp) => (
              <div
                key={comp.id}
                className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex justify-between items-start gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                      ID #{comp.id}
                    </span>
                    <h3 className="text-sm font-bold text-white">
                      {comp.name}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    {comp.description || "No description provided."}
                  </p>
                  <div className="flex gap-4 text-[11px] text-slate-500 pt-1">
                    <button
                      onClick={() => openCompetencyModal(comp.id)}
                      className="hover:text-blue-400 transition text-left"
                    >
                      👤 {comp.qualifiedStaffCount ?? 0} Qualified Staff (View)
                    </button>
                    <button
                      onClick={() => openCompetencyModal(comp.id)}
                      className="hover:text-blue-400 transition text-left"
                    >
                      🏥 {comp.demandingClientsCount ?? 0} Clients Requiring
                      (View)
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openCompetencyModal(comp.id)}
                    className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-600/20 rounded-lg text-xs font-semibold"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => handleEdit(comp)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(comp.id)}
                    className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-semibold"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Details & Assignment Modal */}
      {selectedDetails && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-6 text-slate-100">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                  Competency Details
                </span>
                <h2 className="text-lg font-bold text-white mt-1">
                  {selectedDetails.name}
                </h2>
                <p className="text-xs text-slate-400">
                  {selectedDetails.description}
                </p>
              </div>
              <button
                onClick={() => setSelectedDetails(null)}
                className="text-slate-400 hover:text-white text-sm bg-slate-800 px-3 py-1 rounded-lg"
              >
                ✕ Close
              </button>
            </div>

            {modalLoading ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Loading details...
              </div>
            ) : (
              <div className="space-y-6">
                {/* Service Users Requiring Competency Section */}
                <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Service Users Requiring This Competency (
                    {selectedDetails.demandingClients.length})
                  </h3>

                  {/* Assign Form */}
                  <form
                    onSubmit={handleAddServiceUser}
                    className="flex gap-2 items-center"
                  >
                    <select
                      value={selectedServiceUserId}
                      onChange={(e) => setSelectedServiceUserId(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">
                        -- Assign a Service User Requirement --
                      </option>
                      {selectedDetails.allServiceUsers
                        .filter(
                          (su) =>
                            !selectedDetails.demandingClients.some(
                              (dc) => dc.id === su.id,
                            ),
                        )
                        .map((su) => (
                          <option key={su.id} value={su.id}>
                            {su.firstName} {su.lastName} ({su.postcode})
                          </option>
                        ))}
                    </select>
                    <button
                      type="submit"
                      disabled={!selectedServiceUserId}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition disabled:opacity-50"
                    >
                      Add Requirement
                    </button>
                  </form>

                  {selectedDetails.demandingClients.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-2">
                      No service users currently require this competency.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedDetails.demandingClients.map((su) => (
                        <div
                          key={su.id}
                          className="flex justify-between items-center bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-xs"
                        >
                          <div>
                            <span className="font-bold text-white">
                              {su.firstName} {su.lastName}
                            </span>
                            <span className="text-slate-400 ml-2">
                              Postcode: {su.postcode}
                            </span>
                          </div>
                          <button
                            onClick={() => handleRemoveServiceUser(su.id)}
                            className="text-rose-400 hover:text-rose-300 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20 text-[10px]"
                          >
                            Remove Requirement
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Qualified Staff Section */}
                <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Qualified Staff Members (
                    {selectedDetails.qualifiedStaff.length})
                  </h3>
                  {selectedDetails.qualifiedStaff.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-2">
                      No staff members are currently qualified for this
                      competency.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedDetails.qualifiedStaff.map((staff) => (
                        <div
                          key={staff.id}
                          className="flex justify-between items-center bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-xs"
                        >
                          <div>
                            <span className="font-bold text-white">
                              {staff.firstName} {staff.lastName}
                            </span>
                            <span className="text-slate-400 ml-2">
                              {staff.email}
                            </span>
                          </div>
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">
                            Qualified
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
