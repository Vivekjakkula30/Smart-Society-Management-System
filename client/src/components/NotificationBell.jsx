// src/components/NotificationBell.jsx
// Drop-in bell icon with unread badge for your Navbar

import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchUnreadCount,
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notificationService";

// ── icon helpers ──────────────────────────────────────────────────────────────
const typeIcon = (type) => {
  const map = {
    visitor_request:  "🔔",
    visitor_approved: "✅",
    visitor_rejected: "❌",
    maintenance_new:  "🔧",
    maintenance_update:"🔧",
    notice:           "📢",
    payment_reminder: "💳",
    payment_received: "💰",
    general:          "📣",
  };
  return map[type] || "🔔";
};

const timeAgo = (dateStr) => {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)   return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// ── component ─────────────────────────────────────────────────────────────────
const NotificationBell = () => {
  const [open, setOpen]           = useState(false);
  const [unreadCount, setUnread]  = useState(0);
  const [notifications, setList]  = useState([]);
  const [loading, setLoading]     = useState(false);
  const dropdownRef               = useRef(null);
  const navigate                  = useNavigate();

  // Poll unread count every 30 seconds
  useEffect(() => {
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const loadUnread = async () => {
    try {
      const count = await fetchUnreadCount();
      setUnread(count);
    } catch {}
  };

  const handleOpen = async () => {
    setOpen(prev => !prev);
    if (!open) {
      setLoading(true);
      try {
        const data = await fetchNotifications(1, 10);
        setList(data.notifications || []);
      } catch {}
      finally { setLoading(false); }
    }
  };

  const handleRead = async (n) => {
    if (!n.is_read) {
      await markNotificationRead(n.id);
      setList(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
      setUnread(prev => Math.max(0, prev - 1));
    }
    setOpen(false);
    navigate("/notifications");
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    setList(prev => prev.map(x => ({ ...x, is_read: true })));
    setUnread(0);
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        style={{
          position: "relative",
          background: open ? "#fff7ed" : "transparent",
          border: open ? "1px solid #fed7aa" : "1px solid transparent",
          borderRadius: 10,
          width: 40,
          height: 40,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          transition: "all 0.15s",
        }}
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: "absolute",
            top: 4,
            right: 4,
            background: "#ef4444",
            color: "#fff",
            borderRadius: "50%",
            width: 16,
            height: 16,
            fontSize: 9,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          right: 0,
          width: 360,
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
          zIndex: 1000,
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
              Notifications
              {unreadCount > 0 && (
                <span style={{ marginLeft: 8, background: "#ef4444", color: "#fff", borderRadius: 20, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                style={{ fontSize: 11, color: "#ea580c", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Loading...</div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: "48px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🔕</div>
                <div style={{ fontSize: 13, color: "#94a3b8" }}>No notifications yet</div>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleRead(n)}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "12px 16px",
                    cursor: "pointer",
                    background: n.is_read ? "#fff" : "#fff7ed",
                    borderBottom: "1px solid #f8fafc",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                  onMouseLeave={e => e.currentTarget.style.background = n.is_read ? "#fff" : "#fff7ed"}
                >
                  <div style={{ fontSize: 22, flexShrink: 0, width: 36, height: 36, background: "#f1f5f9", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {typeIcon(n.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: n.is_read ? 500 : 700, color: "#1e293b", marginBottom: 2 }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {n.message}
                    </div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>{timeAgo(n.created_at)}</div>
                  </div>
                  {!n.is_read && (
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ea580c", flexShrink: 0, marginTop: 6 }} />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            onClick={() => { setOpen(false); navigate("/notifications"); }}
            style={{ padding: "12px", textAlign: "center", borderTop: "1px solid #f1f5f9", fontSize: 12, fontWeight: 600, color: "#ea580c", cursor: "pointer" }}
          >
            View all notifications →
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;