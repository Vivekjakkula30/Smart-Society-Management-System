// src/pages/NotificationsPage.jsx
// Full notifications page — all roles see this

import React, { useEffect, useState } from "react";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "../services/notificationService";

// ── helpers ────────────────────────────────────────────────────────────────────
const TYPE_META = {
  visitor_request:   { icon: "🔔", color: "#ea580c", bg: "#fff7ed", label: "Visitor Request" },
  visitor_approved:  { icon: "✅", color: "#059669", bg: "#ecfdf5", label: "Visitor Approved" },
  visitor_rejected:  { icon: "❌", color: "#dc2626", bg: "#fff5f5", label: "Visitor Rejected" },
  maintenance_new:   { icon: "🔧", color: "#6366f1", bg: "#eef2ff", label: "New Maintenance" },
  maintenance_update:{ icon: "🔧", color: "#6366f1", bg: "#eef2ff", label: "Maintenance Update" },
  notice:            { icon: "📢", color: "#0284c7", bg: "#f0f9ff", label: "Notice" },
  payment_reminder:  { icon: "💳", color: "#d97706", bg: "#fffbeb", label: "Payment Reminder" },
  payment_received:  { icon: "💰", color: "#059669", bg: "#ecfdf5", label: "Payment Received" },
  general:           { icon: "📣", color: "#64748b", bg: "#f8fafc", label: "General" },
};

const getMeta = (type) => TYPE_META[type] || { icon: "🔔", color: "#64748b", bg: "#f8fafc", label: "Notification" };

const timeAgo = (dateStr) => {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return "Just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 604800)return `${Math.floor(diff / 86400)} days ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const FILTER_TABS = [
  { key: "all",         label: "All" },
  { key: "visitor",     label: "Visitors" },
  { key: "maintenance", label: "Maintenance" },
  { key: "notice",      label: "Notices" },
  { key: "payment",     label: "Payments" },
];

const matchesFilter = (n, filter) => {
  if (filter === "all") return true;
  return n.type.startsWith(filter);
};

// ── component ──────────────────────────────────────────────────────────────────
const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread]               = useState(0);
  const [loading, setLoading]             = useState(true);
  const [filter, setFilter]               = useState("all");
  const [page, setPage]                   = useState(1);
  const [totalPages, setTotalPages]       = useState(1);

  useEffect(() => { loadNotifications(1); }, []);

  const loadNotifications = async (p = page) => {
    setLoading(true);
    try {
      const data = await fetchNotifications(p, 20);
      setNotifications(data.notifications || []);
      setUnread(data.unread_count || 0);
      setTotalPages(data.total_pages || 1);
      setPage(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (n) => {
    if (n.is_read) return;
    await markNotificationRead(n.id);
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    setUnread(prev => Math.max(0, prev - 1));
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    setNotifications(prev => prev.map(x => ({ ...x, is_read: true })));
    setUnread(0);
  };

  const handleDelete = async (id) => {
    await deleteNotification(id);
    setNotifications(prev => prev.filter(x => x.id !== id));
  };

  const filtered = notifications.filter(n => matchesFilter(n, filter));

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "28px 24px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Page Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", margin: 0 }}>
              Notifications
              {unread > 0 && (
                <span style={{ marginLeft: 10, background: "#ef4444", color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700, verticalAlign: "middle" }}>
                  {unread} new
                </span>
              )}
            </h1>
            <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
              Your activity updates from across the society
            </p>
          </div>
          {unread > 0 && (
            <button
              onClick={handleMarkAll}
              style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid #fed7aa", background: "#fff7ed", color: "#ea580c", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              ✓ Mark all read
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                padding: "7px 16px",
                borderRadius: 20,
                border: "1px solid",
                borderColor: filter === tab.key ? "#ea580c" : "#e2e8f0",
                background: filter === tab.key ? "#fff7ed" : "#fff",
                color: filter === tab.key ? "#ea580c" : "#64748b",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#94a3b8" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
            Loading notifications...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", background: "#fff", borderRadius: 18, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>🔕</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>No notifications</div>
            <div style={{ fontSize: 13, color: "#cbd5e1" }}>You're all caught up!</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(n => {
              const meta = getMeta(n.type);
              return (
                <div
                  key={n.id}
                  onClick={() => handleMarkRead(n)}
                  style={{
                    background: n.is_read ? "#fff" : "#fff7ed",
                    border: `1px solid ${n.is_read ? "#e2e8f0" : "#fed7aa"}`,
                    borderRadius: 14,
                    padding: "16px",
                    display: "flex",
                    gap: 14,
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    transition: "all 0.15s",
                    position: "relative",
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"}
                >
                  {/* Icon */}
                  <div style={{
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    background: meta.bg,
                    border: `1px solid ${meta.color}22`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    flexShrink: 0,
                  }}>
                    {meta.icon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: meta.color,
                          background: meta.bg,
                          padding: "2px 8px",
                          borderRadius: 20,
                          display: "inline-block",
                          marginBottom: 5,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}>
                          {meta.label}
                        </span>
                        <div style={{ fontSize: 14, fontWeight: n.is_read ? 500 : 700, color: "#1e293b", marginBottom: 4 }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                          {n.message}
                        </div>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(n.id); }}
                        title="Delete"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: 14, flexShrink: 0, padding: "2px 4px", borderRadius: 6 }}
                        onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                        onMouseLeave={e => e.currentTarget.style.color = "#cbd5e1"}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>🕐 {timeAgo(n.created_at)}</span>
                      {!n.is_read && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#ea580c", background: "#fff7ed", padding: "1px 8px", borderRadius: 20 }}>
                          New
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 24 }}>
            <button
              disabled={page <= 1}
              onClick={() => loadNotifications(page - 1)}
              style={{ padding: "8px 18px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: page <= 1 ? "#cbd5e1" : "#1e293b", fontSize: 13, fontWeight: 600, cursor: page <= 1 ? "default" : "pointer" }}
            >
              ← Prev
            </button>
            <span style={{ padding: "8px 16px", fontSize: 13, color: "#64748b" }}>
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => loadNotifications(page + 1)}
              style={{ padding: "8px 18px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: page >= totalPages ? "#cbd5e1" : "#1e293b", fontSize: 13, fontWeight: 600, cursor: page >= totalPages ? "default" : "pointer" }}
            >
              Next →
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default NotificationsPage;