"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { sendIsmInvite } from "@/lib/instituteSalesManager/ismInviteActions";
import {
  UserPlus,
  Loader2,
  X,
  Search,
  Send,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Clock,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface UserResult {
  id: string;
  name: string | null;
  username: string;
  email: string;
  image: string | null;
  role: string;
  alreadyAssigned: boolean;
}

export interface PendingInviteItem {
  id: string;
  message: string | null;
  createdAt: Date | string;
  user: { name: string | null; email: string; image: string | null };
}

interface Props {
  instituteId: string;
  pendingInvites: PendingInviteItem[];
}

export default function IsmManageClient({ instituteId, pendingInvites }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [showMessage, setShowMessage] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [showPending, setShowPending] = useState(pendingInvites.length > 0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showFeedback(type: "success" | "error", msg: string) {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  }

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      setSearchDone(false);
      setSelectedUser(null);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.trim().length < 2) {
        setResults([]);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const res = await fetch(
            `/api/ism/search-users?q=${encodeURIComponent(value.trim())}&instituteId=${instituteId}`
          );
          const data = await res.json();
          setResults(data.users || []);
          setSearchDone(true);
        } catch {
          setResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 350);
    },
    [instituteId]
  );

  function selectUser(user: UserResult) {
    setSelectedUser(user);
    setQuery(user.name || user.username);
    setResults([]);
    setSearchDone(false);
  }

  async function handleSendInvite() {
    if (!selectedUser) return;
    startTransition(async () => {
      const res = await sendIsmInvite(selectedUser.id, instituteId, inviteMessage || undefined);
      if (res.success) {
        showFeedback("success", res.message || "Invite sent!");
        setSelectedUser(null);
        setQuery("");
        setInviteMessage("");
        setShowMessage(false);
        router.refresh();
      } else {
        showFeedback("error", res.error || "Failed to send invite.");
      }
    });
  }

  const roleColor = (role: string) => {
    if (role === "INSTITUTE_SALES_MANAGER") return "bg-violet-100 text-violet-800";
    if (role === "ADMIN") return "bg-red-100 text-red-700";
    if (role === "INSTITUTE_MANAGER") return "bg-amber-100 text-amber-700";
    return "bg-slate-100 text-slate-600";
  };

  return (
    <div className="space-y-5">
      {/* Feedback toast */}
      {feedback && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-bold animate-in slide-in-from-top-2 ${
            feedback.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl overflow-hidden">
          <button
            onClick={() => setShowPending(!showPending)}
            className="w-full flex items-center justify-between p-5 text-left"
          >
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-amber-600" />
              <span className="font-bold text-amber-900">
                {pendingInvites.length} Pending Invite{pendingInvites.length > 1 ? "s" : ""} (awaiting acceptance)
              </span>
            </div>
            {showPending ? (
              <ChevronUp className="w-4 h-4 text-amber-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-amber-600" />
            )}
          </button>

          {showPending && (
            <div className="border-t border-amber-200 divide-y divide-amber-100">
              {pendingInvites.map((inv: PendingInviteItem) => (
                <div key={inv.id} className="flex items-center gap-3 px-5 py-3">
                  {inv.user.image ? (
                    <img src={inv.user.image} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-amber-200 text-amber-800 font-bold text-sm flex items-center justify-center shrink-0">
                      {inv.user.name?.[0] || "?"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900 truncate">{inv.user.name || inv.user.email}</p>
                    <p className="text-xs text-slate-500 truncate">{inv.user.email}</p>
                  </div>
                  <div className="ml-auto shrink-0 flex items-center gap-1.5 text-[10px] text-amber-700 font-bold bg-amber-100 px-2.5 py-1 rounded-full">
                    <Clock className="w-3 h-3" /> Pending
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add ISM Card */}
      <div className="bg-white border border-violet-200 rounded-3xl p-6 space-y-4">
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
            <UserPlus className="w-5 h-5 text-violet-600" /> Send ISM Invite
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Search any user by name, <span className="font-mono">@username</span>, or email. An invite will be sent — they must accept before being added.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name, @username, or email..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setResults([]);
                setSearchDone(false);
                setSelectedUser(null);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {query.trim().length >= 2 && !selectedUser && (
          <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 shadow-sm">
            {isSearching && (
              <div className="p-4 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Searching...
              </div>
            )}
            {!isSearching && searchDone && results.length === 0 && (
              <div className="p-4 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> No users found for "{query}"
              </div>
            )}
            {!isSearching &&
              results.map((user: UserResult) => (
                <button
                  key={user.id}
                  onClick={() => !user.alreadyAssigned && selectUser(user)}
                  disabled={user.alreadyAssigned}
                  className="w-full flex items-center justify-between p-4 gap-3 hover:bg-slate-50 transition text-left disabled:opacity-60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {user.image ? (
                      <img src={user.image} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-700 font-extrabold text-sm flex items-center justify-center shrink-0">
                        {user.name?.[0] || user.username[0] || "?"}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 truncate">
                        {user.name || "Unknown"}{" "}
                        <span className="font-normal text-slate-400 text-xs">@{user.username}</span>
                      </p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      <span className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${roleColor(user.role)}`}>
                        {user.role.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {user.alreadyAssigned ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 font-bold bg-green-50 border border-green-200 px-2.5 py-1 rounded-xl">
                        <CheckCircle2 className="w-3 h-3" /> In Team
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-violet-700 font-bold bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-xl">
                        <Send className="w-3 h-3" /> Select
                      </span>
                    )}
                  </div>
                </button>
              ))}
          </div>
        )}

        {/* Selected user — compose invite */}
        {selectedUser && (
          <div className="border border-violet-200 rounded-2xl overflow-hidden bg-violet-50/50">
            <div className="flex items-center gap-3 p-4 border-b border-violet-100">
              {selectedUser.image ? (
                <img src={selectedUser.image} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-violet-200 text-violet-800 font-extrabold text-sm flex items-center justify-center shrink-0">
                  {selectedUser.name?.[0] || selectedUser.username[0] || "?"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-slate-900">{selectedUser.name || selectedUser.username}</p>
                <p className="text-xs text-slate-500">{selectedUser.email}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedUser.role !== "INSTITUTE_SALES_MANAGER" && (
              <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-start gap-2 text-xs text-amber-800">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  This user has the <strong>{selectedUser.role.replace(/_/g, " ")}</strong> role. Their role will be automatically upgraded to <strong>INSTITUTE SALES MANAGER</strong> when they accept.
                </span>
              </div>
            )}

            <div className="p-4 space-y-3">
              <button
                onClick={() => setShowMessage(!showMessage)}
                className="text-xs text-violet-700 font-bold flex items-center gap-1.5 hover:underline"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                {showMessage ? "Remove message" : "Add a personal message (optional)"}
              </button>

              {showMessage && (
                <textarea
                  rows={2}
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder="Write a message to the invitee (e.g., 'We'd love to have you on our sales team...')"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none bg-white"
                />
              )}

              <button
                onClick={handleSendInvite}
                disabled={isPending}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 shadow-sm"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Invite to {selectedUser.name || selectedUser.username}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
