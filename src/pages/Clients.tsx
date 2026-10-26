import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { apiFetch } from "../utils/api";
import { authStorage } from "../utils/auth";

interface ServiceUser {
  id: number;
  firstName: string;
  lastName: string;
  preferredName: string;
  dateOfBirth: string | null;
  postcode: string;
  addressDetails: string;
  carePlanSummary: string;
  isActive: boolean;
  createdAt: string;
  hasProfilePhoto: boolean;
  requiredCompetencies: string[];
}

interface Location {
  id: number;
  name: string;
  address: string;
  serviceUsers: Pick<ServiceUser, "id" | "firstName" | "lastName" | "preferredName">[];
}

export default function ServiceUsers() {
  const [serviceUsers, setServiceUsers] = useState<ServiceUser[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"service-users" | "locations">("service-users");
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [selectedServiceUsers, setSelectedServiceUsers] = useState<Record<number, number | "">>({});
  const [editingLocationId, setEditingLocationId] = useState<number | null>(null);
  const [locationError, setLocationError] = useState("");
  const [locationSuccess, setLocationSuccess] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<ServiceUser | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [postcode, setPostcode] = useState("");
  const [addressDetails, setAddressDetails] = useState("");
  const [carePlanSummary, setCarePlanSummary] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [preferredName, setPreferredName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [profileError, setProfileError] = useState("");
  const [profilePhotoUrls, setProfilePhotoUrls] = useState<Record<number, string>>({});

  const user = authStorage.getUser();
  const isAdmin = user?.role === "Admin";
  const canManageServiceUsers = isAdmin || user?.role === "Manager";
  const canManageLocations = isAdmin || user?.role === "Manager";

  const fetchServiceUsers = async () => {
    try {
      const res = await apiFetch("/api/serviceusers/active");
      if (res.ok) {
        const data: ServiceUser[] = await res.json();
        setServiceUsers(data);
        const photoEntries = await Promise.all(data.filter((item) => item.hasProfilePhoto).map(async (item) => {
          try {
            const response = await apiFetch(`/api/serviceusers/${item.id}/photo`);
            return response.ok ? [item.id, URL.createObjectURL(await response.blob())] as const : null;
          } catch {
            return null;
          }
        }));
        setProfilePhotoUrls((current) => {
          Object.values(current).forEach((url) => URL.revokeObjectURL(url));
          return Object.fromEntries(photoEntries.filter((entry): entry is readonly [number, string] => entry !== null));
        });
      }
    } catch (err) {
      console.error("Failed to fetch service users", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    if (!canManageLocations) return;
    try {
      const res = await apiFetch("/api/locations");
      if (res.ok) setLocations(await res.json());
    } catch (err) {
      console.error("Failed to fetch locations", err);
    }
  };

  useEffect(() => {
    void fetchServiceUsers();
    void fetchLocations();
    // These initial requests intentionally run once when the page mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => Object.values(profilePhotoUrls).forEach((url) => URL.revokeObjectURL(url)), [profilePhotoUrls]);

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocationError("");
    setLocationSuccess("");
    try {
      const res = await apiFetch(editingLocationId ? `/api/locations/${editingLocationId}` : "/api/locations", {
        method: editingLocationId ? "PUT" : "POST",
        body: JSON.stringify({ name: locationName.trim(), address: locationAddress.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || "Could not save location.");
      setLocationName("");
      setLocationAddress("");
      setEditingLocationId(null);
      setLocationSuccess(editingLocationId ? "Location updated." : "Location created.");
      await fetchLocations();
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : "Failed to create location.");
    }
  };

  const handleAssignServiceUser = async (locationId: number) => {
    const serviceUserId = selectedServiceUsers[locationId];
    if (!serviceUserId) return;
    setLocationError("");
    setLocationSuccess("");
    try {
      const res = await apiFetch(`/api/locations/service-users/${serviceUserId}/location`, {
        method: "PUT",
        body: JSON.stringify({ locationId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || "Failed to move service user.");
      setSelectedServiceUsers((current) => ({ ...current, [locationId]: "" }));
      setLocationSuccess("Service user moved to location.");
      await Promise.all([fetchLocations(), fetchServiceUsers()]);
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : "Failed to assign service user.");
    }
  };

  const handleRemoveServiceUser = async (locationId: number, serviceUserId: number) => {
    setLocationError("");
    setLocationSuccess("");
    try {
      const response = await apiFetch(`/api/locations/${locationId}/remove-user/${serviceUserId}`, { method: "POST" });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || "Could not remove service user from location.");
      setLocationSuccess("Service user removed from location. The service-user record is unchanged.");
      await Promise.all([fetchLocations(), fetchServiceUsers()]);
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : "Could not remove service user.");
    }
  };

  const handleDeleteLocation = async (locationId: number) => {
    setLocationError("");
    setLocationSuccess("");
    try {
      const response = await apiFetch(`/api/locations/${locationId}`, { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || "Could not delete location.");
      setLocationSuccess("Location deleted. Service-user records were retained.");
      await fetchLocations();
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : "Could not delete location.");
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFirstName("");
    setLastName("");
    setPostcode("");
    setAddressDetails("");
    setCarePlanSummary("");
    setIsActive(true);
    setPreferredName("");
    setDateOfBirth("");
    setPhotoFile(null);
    setProfileError("");
    setShowModal(true);
  };

  const openEditModal = (su: ServiceUser) => {
    setEditingUser(su);
    setFirstName(su.firstName);
    setLastName(su.lastName);
    setPostcode(su.postcode);
    setAddressDetails(su.addressDetails);
    setCarePlanSummary(su.carePlanSummary);
    setIsActive(su.isActive);
    setPreferredName(su.preferredName || "");
    setDateOfBirth(su.dateOfBirth || "");
    setPhotoFile(null);
    setProfileError("");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      firstName,
      lastName,
      preferredName,
      dateOfBirth: dateOfBirth || null,
      postcode,
      addressDetails,
      carePlanSummary,
      isActive,
    };
    const url = editingUser
      ? `/api/serviceusers/${editingUser.id}`
      : "/api/serviceusers";
    const method = editingUser ? "PUT" : "POST";

    try {
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const savedUser: ServiceUser = await res.json();
        if (photoFile) {
          const content = new FormData();
          content.append("file", photoFile);
          const photoResponse = await apiFetch(`/api/serviceusers/${savedUser.id}/photo`, { method: "POST", body: content });
          if (!photoResponse.ok) {
            const details = await photoResponse.json().catch(() => null);
            setProfileError(details?.message || "Profile saved, but the photo could not be uploaded.");
            return;
          }
        }
        setShowModal(false);
        await fetchServiceUsers();
      } else {
        const details = await res.json().catch(() => null);
        setProfileError(details?.message || "Could not save service-user profile.");
      }
    } catch (err) {
      console.error("Error saving service user:", err);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {activeTab === "service-users" ? "Service Users" : "Locations"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {activeTab === "service-users" ? "Manage service-user profiles and care plan summaries." : "Create locations and assign service users to them."}
          </p>
        </div>

        {canManageServiceUsers && activeTab === "service-users" && (
          <button
            onClick={openCreateModal}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-blue-500/20 active:scale-[0.99] transition-all cursor-pointer self-start sm:self-auto"
          >
            + Add Service User
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab("service-users")}
          aria-selected={activeTab === "service-users"}
          role="tab"
          className={`px-4 py-2 text-sm font-semibold border-b-2 ${activeTab === "service-users" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-slate-500 dark:text-slate-400"}`}
        >
          Service Users
        </button>
        {canManageLocations && (
          <button
            type="button"
            onClick={() => setActiveTab("locations")}
            aria-selected={activeTab === "locations"}
            role="tab"
            className={`px-4 py-2 text-sm font-semibold border-b-2 ${activeTab === "locations" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-slate-500 dark:text-slate-400"}`}
          >
            Locations
          </button>
        )}
      </div>

      {activeTab === "service-users" && (loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {serviceUsers.map((su) => (
            <div
              key={su.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/70 p-5 shadow-sm dark:shadow-2xl backdrop-blur-md transition-all hover:border-slate-300 dark:hover:border-slate-700/80"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {su.preferredName || `${su.firstName} ${su.lastName}`}
                  </h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      su.isActive
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                    }`}
                  >
                    {su.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>

                {profilePhotoUrls[su.id] && (
                  <img src={profilePhotoUrls[su.id]} alt={`Profile of ${su.preferredName || su.firstName}`} className="mt-3 size-20 rounded-md border border-slate-200 object-cover dark:border-slate-700" />
                )}

                <div className="mt-3 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  {(su.preferredName || su.dateOfBirth) && (
                    <p><strong>Legal name:</strong> {su.firstName} {su.lastName}</p>
                  )}
                  {su.dateOfBirth && <p><strong>Date of birth:</strong> {new Date(`${su.dateOfBirth}T00:00:00`).toLocaleDateString()}</p>}
                  <p>
                    📍 <strong>Postcode:</strong> {su.postcode}
                  </p>
                  <p>
                    🏠 <strong>Address:</strong> {su.addressDetails}
                  </p>
                </div>

                {su.requiredCompetencies.length > 0 && (
                  <p className="mt-3 text-xs text-slate-600 dark:text-slate-300"><strong>Required competencies:</strong> {su.requiredCompetencies.join(", ")}</p>
                )}

                <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/60 p-3">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    Care Plan Summary
                  </span>
                  <div className="text-xs text-slate-700 dark:text-slate-300 prose prose-invert max-w-none">
                    {su.carePlanSummary ? (
                      <ReactMarkdown>{su.carePlanSummary}</ReactMarkdown>
                    ) : (
                      "No care plan details recorded."
                    )}
                  </div>
                </div>
              </div>

              {canManageServiceUsers && (
                <div className="mt-4 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                  <button
                    onClick={() => openEditModal(su)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/80 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Edit Details & Plan
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* Edit / Create Modal */}
      {activeTab === "service-users" && showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              {editingUser ? "Edit Service User" : "Add New Service User"}
            </h3>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Preferred name</label>
                  <input type="text" maxLength={100} value={preferredName} onChange={(event) => setPreferredName(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-950/80 dark:text-white sm:text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Date of birth</label>
                  <input type="date" max={new Date().toISOString().slice(0, 10)} value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-950/80 dark:text-white sm:text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">
                  Postcode *
                </label>
                <input
                  type="text"
                  required
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">
                  Address Details
                </label>
                <input
                  type="text"
                  value={addressDetails}
                  onChange={(e) => setAddressDetails(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">
                  Care Plan Summary (Markdown)
                </label>
                <textarea
                  rows={4}
                  value={carePlanSummary}
                  onChange={(e) => setCarePlanSummary(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Profile photo (PNG, JPEG, or WebP; up to 5 MiB)</label>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-200 file:px-3 file:py-2 file:text-xs file:font-semibold dark:text-slate-300 dark:file:bg-slate-800 dark:file:text-slate-100" />
                {editingUser?.hasProfilePhoto && !photoFile && <p className="mt-1 text-xs text-slate-500">A profile photo is already saved. Select a new image to replace it.</p>}
              </div>

              {profileError && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{profileError}</p>}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label
                  htmlFor="isActive"
                  className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white cursor-pointer"
                >
                  Active Service User
                </label>
              </div>

              <div className="mt-3 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition cursor-pointer"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === "locations" && canManageLocations && (
        <section className="space-y-6">
          <form onSubmit={handleCreateLocation} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-5 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editingLocationId ? "Edit Location" : "Add New Location"}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Location name *</label>
                <input required value={locationName} onChange={(e) => setLocationName(e.target.value)} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Address *</label>
                <input required value={locationAddress} onChange={(e) => setLocationAddress(e.target.value)} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-white" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">{editingLocationId ? "Save Location" : "Create Location"}</button>
              {editingLocationId && <button type="button" onClick={() => { setEditingLocationId(null); setLocationName(""); setLocationAddress(""); }} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Cancel</button>}
            </div>
          </form>

          {locationError && <p role="alert" className="text-sm text-rose-500">{locationError}</p>}
          {locationSuccess && <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">{locationSuccess}</p>}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((location) => {
              return (
                <article key={location.id} className="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-5">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{location.name}</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{location.address}</p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => { setEditingLocationId(location.id); setLocationName(location.name); setLocationAddress(location.address); setLocationError(""); setLocationSuccess(""); }} className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Edit</button>
                      <button type="button" onClick={() => void handleDeleteLocation(location.id)} className="rounded-md border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:text-rose-300">Delete location</button>
                    </div>
                  </div>
                  <div>
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Assigned service users</h4>
                    {location.serviceUsers.length ? (
                      <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                        {location.serviceUsers.map((serviceUser) => <li key={serviceUser.id} className="flex items-center justify-between gap-2"><span>{serviceUser.preferredName || `${serviceUser.firstName} ${serviceUser.lastName}`}</span><button type="button" onClick={() => void handleRemoveServiceUser(location.id, serviceUser.id)} className="text-xs font-semibold text-rose-700 hover:underline dark:text-rose-300">Remove</button></li>)}
                      </ul>
                    ) : <p className="text-sm text-slate-500">No service users assigned.</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Move a service user here</label>
                    <select value={selectedServiceUsers[location.id] ?? ""} onChange={(e) => setSelectedServiceUsers((current) => ({ ...current, [location.id]: e.target.value ? Number(e.target.value) : "" }))} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-white">
                      <option value="">Select a service user...</option>
                      {serviceUsers.filter((serviceUser) => serviceUser.isActive && !location.serviceUsers.some((assigned) => assigned.id === serviceUser.id)).map((serviceUser) => <option key={serviceUser.id} value={serviceUser.id}>{serviceUser.preferredName || `${serviceUser.firstName} ${serviceUser.lastName}`}</option>)}
                    </select>
                    <button type="button" disabled={!selectedServiceUsers[location.id]} onClick={() => handleAssignServiceUser(location.id)} className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">Move Service User</button>
                  </div>
                </article>
              );
            })}
          </div>
          {locations.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500">No locations yet. Create one above to start assigning service users.</p>}
        </section>
      )}
    </div>
  );
}
