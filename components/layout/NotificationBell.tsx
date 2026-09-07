"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import { formatNotificationTime } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  message?: string | null;
  entityId?: string | null;
  referenceId?: string | null;
  actionUrl?: string | null;
  isRead: boolean;
  createdAt: string;
}

const POLL_INTERVAL = 30_000; // 30 seconds

const TYPE_EMOJI: Record<string, string> = {
  SYSTEM: "🔔",
  MEMBERSHIP: "🏫",
  MESSAGE: "💬",
  REVIEW: "⭐",
  REWARD: "🎁",
  ALERT: "⚠️",
};

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Poll unread count
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/v2/notifications/unread-count");
        if (res.ok) {
          const data = await res.json();
          setCount(data.count ?? 0);
        }
      } catch {
        // ignore network errors
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Load notifications when popover opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/v2/notifications")
      .then((r) => r.json())
      .then((data) => setNotifications(data.notifications ?? []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const markAllRead = async () => {
    await fetch("/api/v2/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setCount(0);
  };

  const markOneRead = async (id: string) => {
    await fetch("/api/v2/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setCount((c) => Math.max(0, c - 1));
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white leading-none">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute right-0 top-11 z-[200] w-80 rounded-2xl border border-slate-200 bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="font-semibold text-slate-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {count > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
                >
                  <CheckCheck className="size-3.5" /> Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-sm text-slate-400">
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                No notifications yet.
              </div>
            ) : (
              notifications.slice(0, 8).map((n) => {
                const targetUrl =
                  n.type === "MESSAGE" && n.entityId
                    ? `/chat/${n.entityId}`
                    : n.actionUrl || null;

                const content = (
                  <div
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${
                      !n.isRead ? "bg-amber-50/50" : ""
                    }`}
                  >
                    <span className="mt-0.5 text-base shrink-0">
                      {TYPE_EMOJI[n.type] ?? "🔔"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.isRead ? "font-semibold text-slate-900" : "text-slate-700"}`}>
                        {n.title}
                      </p>
                      {n?.message && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                          {n.message}
                        </p>
                      )}
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-slate-400 flex items-center gap-1">
                        <span>{timeAgo(n.createdAt)}</span>
                        <span>•</span>
                        <span>{formatNotificationTime(n.createdAt)}</span>
                      </p>
                    </div>
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          markOneRead(n.id);
                        }}
                        className="shrink-0 p-1 text-slate-300 hover:text-emerald-500"
                        title="Mark read"
                      >
                        <Check className="size-3.5" />
                      </button>
                    )}
                  </div>
                );

                if (targetUrl) {
                  return (
                    <Link
                      key={n.id}
                      href={targetUrl}
                      onClick={() => {
                        if (!n.isRead) markOneRead(n.id);
                        setOpen(false);
                      }}
                      className="block"
                    >
                      {content}
                    </Link>
                  );
                }

                return <div key={n.id}>{content}</div>;
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-4 py-3 text-center">
            <Link
              href="/notifications"
              className="text-xs font-semibold text-amber-700 hover:text-amber-800"
              onClick={() => setOpen(false)}
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return "Just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
