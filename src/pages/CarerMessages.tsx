import React, { useEffect, useState, useRef } from "react";
import { apiFetch } from "../utils/api";
import { authStorage } from "../utils/auth";

interface Broadcast {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  adminName: string;
}

interface DirectMessage {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  createdAt: string;
  isRead: boolean;
}

interface User {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
}

export default function CarerMessages() {
  const [activeTab, setActiveTab] = useState<"broadcasts" | "direct">(
    "broadcasts",
  );
  const currentUser = authStorage.getUser();

  // Broadcasts State
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(false);

  // Direct Chat State
  const [admins, setAdmins] = useState<User[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<User | null>(null);
  const [chatMessages, setChatMessages] = useState<DirectMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchBroadcasts = async () => {
    setLoadingBroadcasts(true);
    try {
      const res = await apiFetch("/api/messages/broadcasts");
      if (res.ok) {
        const data = await res.json();
        setBroadcasts(data);
      }
    } catch (err) {
      console.error("Failed to fetch broadcasts", err);
    } finally {
      setLoadingBroadcasts(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const res = await apiFetch("/api/users/message-contacts");
      if (res.ok) {
        const data: User[] = await res.json();
        const adminUsers = data.filter(
          (u) =>
            (u.role === "Admin" || u.role === "Manager") &&
            u.id !== currentUser?.id,
        );
        setAdmins(adminUsers);
        if (adminUsers.length > 0 && !selectedAdmin) {
          setSelectedAdmin(adminUsers[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load contacts", err);
    }
  };

  const fetchChat = async (userId: number) => {
    setLoadingChat(true);
    try {
      const res = await apiFetch(`/api/messages/direct/${userId}`);
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

  useEffect(() => {
    fetchBroadcasts();
    fetchAdmins();
  }, []);

  useEffect(() => {
    if (selectedAdmin) {
      fetchChat(selectedAdmin.id);
    }
  }, [selectedAdmin]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin || !messageInput.trim()) return;

    const textToSend = messageInput.trim();
    setMessageInput("");

    try {
      const res = await apiFetch("/api/messages/direct", {
        method: "POST",
        body: JSON.stringify({
          receiverId: selectedAdmin.id,
          content: textToSend,
        }),
      });

      if (res.ok) {
        await fetchChat(selectedAdmin.id);
      }
    } catch (err) {
      alert("Failed to send message.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Messages & Broadcasts
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            View announcements and directly contact management
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab("broadcasts")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "broadcasts"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            📢 Announcements
          </button>
          <button
            onClick={() => setActiveTab("direct")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "direct"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            💬 Direct Chat
          </button>
        </div>
      </div>

      {/* TAB 1: BROADCASTS VIEW */}
      {activeTab === "broadcasts" && (
        <div className="space-y-4 max-w-4xl mx-auto">
          {loadingBroadcasts ? (
            <div className="h-64 rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse" />
          ) : broadcasts.length === 0 ? (
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-8 text-center text-slate-400 text-xs sm:text-sm">
              No broadcast announcements posted yet.
            </div>
          ) : (
            broadcasts.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl backdrop-blur-md space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full border text-[11px] font-semibold bg-blue-500/10 border-blue-500/20 text-blue-400">
                    📢 Official Announcement • {b.adminName}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    {new Date(b.createdAt).toLocaleString()}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white">{b.title}</h3>
                <p className="text-xs sm:text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {b.content}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: DIRECT CHAT */}
      {activeTab === "direct" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[min(650px,calc(100dvh-11rem))] min-h-90 rounded-2xl border border-slate-800/80 bg-slate-900/70 overflow-hidden shadow-2xl backdrop-blur-md">
          {/* Contacts Sidebar */}
          <div className="md:col-span-1 border-r border-slate-800/80 overflow-y-auto divide-y divide-slate-800/50">
            <div className="p-4 bg-slate-950/40 border-b border-slate-800/80">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Admin / Management Contacts
              </h3>
            </div>

            {admins.map((admin) => {
              const isSelected = selectedAdmin?.id === admin.id;
              return (
                <div
                  key={admin.id}
                  onClick={() => setSelectedAdmin(admin)}
                  className={`p-4 transition cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? "bg-blue-600/20 border-l-4 border-blue-500 text-white"
                      : "hover:bg-slate-800/50 text-slate-300"
                  }`}
                >
                  <div>
                    <h4 className="text-sm font-semibold">
                      {admin.firstName} {admin.lastName}
                    </h4>
                    <p className="text-[11px] text-slate-400">{admin.role}</p>
                  </div>
                  <span className="text-xs">💬</span>
                </div>
              );
            })}
          </div>

          {/* Chat Panel */}
          <div className="md:col-span-2 flex flex-col justify-between bg-slate-950/30">
            {selectedAdmin ? (
              <>
                {/* Active Header */}
                <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {selectedAdmin.firstName} {selectedAdmin.lastName}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {selectedAdmin.role}
                    </p>
                  </div>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingChat ? (
                    <div className="text-center text-slate-500 text-xs py-8">
                      Loading chat...
                    </div>
                  ) : chatMessages.length === 0 ? (
                    <div className="text-center text-slate-500 text-xs py-12">
                      Send a message to contact {selectedAdmin.firstName}.
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
                    placeholder={`Type message to ${selectedAdmin.firstName}...`}
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
                Select an admin to send a message.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
