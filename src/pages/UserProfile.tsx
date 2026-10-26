import { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { authStorage } from "../utils/auth";

interface UserProfileData {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function UserProfile() {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const localUser = authStorage.getUser();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!localUser?.id) return;
      try {
        const res = await apiFetch(`/api/users/${localUser.id}`);
        if (res.ok) {
          setProfile(await res.json());
        }
      } catch (err) {
        console.error("Failed to load profile", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [localUser?.id]);

  if (loading) {
    return (
      <div className="h-48 rounded-2xl bg-slate-900/50 border border-slate-800 animate-pulse" />
    );
  }

  if (!profile) {
    return (
      <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 text-slate-400 text-xs">
        Profile details could not be loaded.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl rounded-2xl bg-slate-900/70 border border-slate-800/80 p-6 shadow-2xl backdrop-blur-md space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">
          Saved Personal Information
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Your registered system credentials and account details.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <span className="text-slate-400 font-medium">First Name</span>
          <p className="text-sm font-bold text-white">{profile.firstName}</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <span className="text-slate-400 font-medium">Last Name</span>
          <p className="text-sm font-bold text-white">{profile.lastName}</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1 sm:col-span-2">
          <span className="text-slate-400 font-medium">Email Address</span>
          <p className="text-sm font-bold text-white">{profile.email}</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <span className="text-slate-400 font-medium">Assigned Role</span>
          <p className="text-sm font-bold text-blue-400">{profile.role}</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <span className="text-slate-400 font-medium">Account Status</span>
          <p className="text-sm font-bold text-emerald-400">
            {profile.isActive ? "Active Staff Member" : "Inactive"}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1 sm:col-span-2">
          <span className="text-slate-400 font-medium">Account Created On</span>
          <p className="text-sm font-semibold text-slate-300">
            {new Date(profile.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
