import React, { useEffect, useState, useRef } from "react";
import { apiFetch } from "../utils/api";
import { authStorage } from "../utils/auth";

// --- Interfaces ---
interface SystemMessage {
  id: string;
  category: number;
  title: string;
  details: string;
  timestamp: string;
  relatedId?: number;
  severity: "danger" | "warning" | "info";
}

interface Broadcast {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  archivedAt?: string | null;
  adminName: string;
}

interface DirectMessage {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  createdAt: string;
  isRead: boolean;
  archivedAt?: string | null;
}

interface User {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
  email: string;
}

export default function AdminMessages() {
  // Main Top-Level Tab State
  const [mainTab, setMainTab] = useState<"audit" | "broadcasts" | "direct">(
    "audit",
  );
  const currentUser = authStorage.getUser();
  const [showArchivedMessages, setShowArchivedMessages] = useState(false);

  // ================= 1. AUDIT FEED STATE =================
  const [auditMessages, setAuditMessages] = useState<SystemMessage[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [auditFilter, setAuditFilter] = useState<string>("ALL");
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>("");

  // ================= 2. BROADCAST STATE =================
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(false);
  const [submittingBroadcast, setSubmittingBroadcast] = useState(false);

  // ================= 3. DIRECT CHAT STATE =================
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [chatMessages, setChatMessages] = useState<DirectMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ----------------------------------------------------
  // API Fetch Functions
  // ----------------------------------------------------

  // Fetch Audit Logs
  const fetchAuditMessages = async () => {
    setLoadingAudit(true);
    try {
      const res = await apiFetch("/api/messages/admin/feed");
      if (res.ok) {
        const data = await res.json();
        setAuditMessages(data);
      }
    } catch (err) {
      console.error("Failed to fetch audit feed logs", err);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Fetch Broadcasts
  const fetchBroadcasts = async (includeArchived = showArchivedMessages) => {
    setLoadingBroadcasts(true);
    try {
      const res = await apiFetch(`/api/messages/broadcasts?includeArchived=${includeArchived}`);
      if (res.ok) {
        const data = await res.json();
        setBroadcasts(data);
      }
    } catch (err) {
      console.error("Failed to load broadcasts", err);
    } finally {
      setLoadingBroadcasts(false);
    }
  };

  // Fetch Carer / Staff List
  const fetchUsers = async () => {
    try {
      const res = await apiFetch("/api/users/active");
      if (res.ok) {
        const data: User[] = await res.json();
        // Exclude current admin from direct messaging list
        const otherUsers = data.filter((u) => u.id !== currentUser?.id);
        setUsers(otherUsers);
        if (otherUsers.length > 0 && !selectedUser) {
          setSelectedUser(otherUsers[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load users", err);
    }
  };

  // Fetch Direct Chat Conversation
  const fetchChat = async (userId: number, includeArchived = showArchivedMessages) => {
    setLoadingChat(true);
    try {
      const res = await apiFetch(`/api/messages/direct/${userId}?includeArchived=${includeArchived}`);
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data);
      }
    } catch (err) {
      console.error("Failed to load chat history", err);
    } finally {
      setLoadingChat(false);
    }
  };

  // ----------------------------------------------------
  // Effects
  // ----------------------------------------------------

  useEffect(() => {
    fetchAuditMessages();
    fetchBroadcasts();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUser && mainTab === "direct") {
      fetchChat(selectedUser.id);
    }
  }, [selectedUser, mainTab]);

  useEffect(() => {
    if (mainTab === "direct") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, mainTab]);

  // ----------------------------------------------------
  // Event Handlers
  // ----------------------------------------------------

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSubmittingBroadcast(true);
    try {
      const res = await apiFetch("/api/messages/broadcasts", {
        method: "POST",
        body: JSON.stringify({ title, content }),
      });

      if (res.ok) {
        setTitle("");
        setContent("");
        await fetchBroadcasts();
      }
    } catch (err) {
      alert("Failed to send broadcast announcement.");
    } finally {
      setSubmittingBroadcast(false);
    }
  };

  const handleSendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !messageInput.trim()) return;

    const textToSend = messageInput.trim();
    setMessageInput("");

    try {
      const res = await apiFetch("/api/messages/direct", {
        method: "POST",
        body: JSON.stringify({
          receiverId: selectedUser.id,
          content: textToSend,
        }),
      });

      if (res.ok) {
        await fetchChat(selectedUser.id);
      }
    } catch (err) {
      alert("Failed to send message.");
    }
  };

  const handleToggleArchived = async () => {
    const includeArchived = !showArchivedMessages;
    setShowArchivedMessages(includeArchived);
    await fetchBroadcasts(includeArchived);
    if (selectedUser) await fetchChat(selectedUser.id, includeArchived);
  };

  // ----------------------------------------------------
  // Helpers for Audit Feed
  // ----------------------------------------------------

  const filteredAuditMessages = auditMessages.filter((msg) => {
    if (auditFilter === "PAYSLIP" && msg.category !== 0) return false;
    if (
      auditFilter === "ATTENDANCE" &&
      msg.category !== 1 &&
      msg.category !== 2
    )
      return false;
    if (auditFilter === "HANDOVER" && msg.category !== 3 && msg.category !== 4)
      return false;

    if (auditSearchQuery.trim()) {
      const q = auditSearchQuery.toLowerCase();
      return (
        msg.title.toLowerCase().includes(q) ||
        msg.details.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "danger":
        return "bg-rose-500/10 border-rose-500/20 text-rose-400";
      case "warning":
        return "bg-amber-500/10 border-amber-500/20 text-amber-400";
      default:
        return "bg-blue-500/10 border-blue-500/20 text-blue-400";
    }
  };

  const getCategoryLabel = (category: number) => {
    switch (category) {
      case 0:
        return "📄 Payslip Issue";
      case 1:
        return "⏱️ Clock-In (>15m)";
      case 2:
        return "⏱️ Clock-Out (>15m)";
      case 3:
      case 4:
        return "📝 Handover Note";
      default:
        return "🔔 Alert";
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Admin Communication & Audit Hub
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Monitor system audit logs, broadcast company notices, or communicate
            directly with staff
          </p>
        </div>

        {/* Primary Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl self-start lg:self-auto">
          <button
            onClick={() => setMainTab("audit")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              mainTab === "audit"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            📊 System Audit Feed
          </button>
          <button
            onClick={() => setMainTab("broadcasts")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              mainTab === "broadcasts"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            📢 Broadcasting
          </button>
          <button
            onClick={() => setMainTab("direct")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              mainTab === "direct"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            💬 1-to-1 Direct Chat
          </button>
        </div>
        {(currentUser?.role === "Admin" || currentUser?.role === "Manager") && mainTab !== "audit" && (
          <button type="button" onClick={() => void handleToggleArchived()} className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800">
            {showArchivedMessages ? "Hide archived" : "Include archived"}
          </button>
        )}
      </div>

      {/* ================= TAB 1: AUDIT & SYSTEM LOGS ================= */}
      {mainTab === "audit" && (
        <div className="space-y-6">
          {/* Audit Sub-Controls */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 backdrop-blur-md">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: "ALL", label: "All Messages" },
                { id: "PAYSLIP", label: "Payslip Issues" },
                { id: "ATTENDANCE", label: "Attendance (±15m)" },
                { id: "HANDOVER", label: "Handover Notes" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setAuditFilter(tab.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    auditFilter === tab.id
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search messages or staff..."
                value={auditSearchQuery}
                onChange={(e) => setAuditSearchQuery(e.target.value)}
                className="w-full md:w-64 rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <button
                onClick={fetchAuditMessages}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer shrink-0"
                title="Refresh logs"
              >
                🔄
              </button>
            </div>
          </div>

          {/* Audit Feed List */}
          {loadingAudit ? (
            <div className="h-64 rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse" />
          ) : filteredAuditMessages.length === 0 ? (
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-8 text-center text-slate-400 text-xs sm:text-sm">
              No system messages or alerts found for this filter.
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredAuditMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="space-y-2 max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${getSeverityBadge(
                          msg.severity,
                        )}`}
                      >
                        {getCategoryLabel(msg.category)}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {new Date(msg.timestamp).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-white">
                      {msg.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {msg.details}
                    </p>
                  </div>

                  {msg.relatedId && (
                    <div className="self-start shrink-0">
                      <span className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400">
                        ID #{msg.relatedId}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: BROADCASTING ================= */}
      {mainTab === "broadcasts" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Broadcast Form */}
          <div className="lg:col-span-1 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl backdrop-blur-md space-y-4 h-fit">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>📣</span> New Broadcast Notice
            </h2>
            <form onSubmit={handleSendBroadcast} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Title / Subject
                </label>
                <input
                  type="text"
                  placeholder="e.g. Schedule Update, Policy Change"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Message Content
                </label>
                <textarea
                  placeholder="Write announcement details..."
                  rows={5}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <button
                type="submit"
                disabled={submittingBroadcast}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition cursor-pointer disabled:opacity-50"
              >
                {submittingBroadcast ? "Publishing..." : "Send Broadcast"}
              </button>
            </form>
          </div>

          {/* Broadcast Feed */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>📋</span> Published Announcements
            </h2>

            {loadingBroadcasts ? (
              <div className="h-64 rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse" />
            ) : broadcasts.length === 0 ? (
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-8 text-center text-slate-400 text-xs sm:text-sm">
                No broadcasts published yet.
              </div>
            ) : (
              <div className="space-y-3.5">
                {broadcasts.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-2xl backdrop-blur-md space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full border text-[11px] font-semibold bg-blue-500/10 border-blue-500/20 text-blue-400">
                        📢 {b.adminName}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {b.archivedAt ? `Archived ${new Date(b.archivedAt).toLocaleString()}` : new Date(b.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white">
                      {b.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {b.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 3: DIRECT CHAT ================= */}
      {mainTab === "direct" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[min(650px,calc(100dvh-11rem))] min-h-90 rounded-2xl border border-slate-800/80 bg-slate-900/70 overflow-hidden shadow-2xl backdrop-blur-md">
          {/* User Sidebar */}
          <div className="md:col-span-1 border-r border-slate-800/80 overflow-y-auto divide-y divide-slate-800/50">
            <div className="p-4 bg-slate-950/40 border-b border-slate-800/80">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Staff & Carers ({users.length})
              </h3>
            </div>

            {users.map((u) => {
              const isSelected = selectedUser?.id === u.id;
              return (
                <div
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`p-4 transition cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? "bg-blue-600/20 border-l-4 border-blue-500 text-white"
                      : "hover:bg-slate-800/50 text-slate-300"
                  }`}
                >
                  <div>
                    <h4 className="text-sm font-semibold">
                      {u.firstName} {u.lastName}
                    </h4>
                    <p className="text-[11px] text-slate-400">{u.role}</p>
                  </div>
                  <span className="text-xs">💬</span>
                </div>
              );
            })}
          </div>

          {/* Chat Window */}
          <div className="md:col-span-2 flex flex-col justify-between bg-slate-950/30">
            {selectedUser ? (
              <>
                {/* Active User Header */}
                <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {selectedUser.firstName} {selectedUser.lastName}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {selectedUser.email}
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold">
                    Direct Message
                  </span>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingChat ? (
                    <div className="text-center text-slate-500 text-xs py-8">
                      Loading messages...
                    </div>
                  ) : chatMessages.length === 0 ? (
                    <div className="text-center text-slate-500 text-xs py-12">
                      No message history with {selectedUser.firstName}. Say
                      hello! 👋
                    </div>
                  ) : (
                    chatMessages.map((msg) => {
                      const isMe = msg.senderId === currentUser?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${
                            isMe ? "items-end" : "items-start"
                          }`}
                        >
                          <div
                            className={`max-w-xs sm:max-w-md px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                              isMe
                                ? "bg-blue-600 text-white rounded-br-none"
                                : "bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/60"
                            }`}
                          >
                            {msg.content}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono mt-1 px-1">
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {msg.archivedAt && " · Archived"}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Message Input Box */}
                <form
                  onSubmit={handleSendDirectMessage}
                  className="p-3 border-t border-slate-800/80 bg-slate-900/80 flex items-center gap-2"
                >
                  <input
                    type="text"
                    placeholder={`Message ${selectedUser.firstName}...`}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    Send ➔
                  </button>
                </form>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                Select a staff member from the list to start chatting.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
