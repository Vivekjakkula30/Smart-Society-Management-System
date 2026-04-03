// client/src/pages/SecurityDashboard.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, logout } from "../utils/auth";
import { addVisitorEntry, fetchTodayVisitors, markVisitorExit } from "../services/visitorService";
import { fetchResidentsList } from "../services/residentService";
import { fetchUnreadCount } from "../services/notificationService";
import api from "../services/api";

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 10,
  border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none",
  boxSizing: "border-box", fontFamily: "inherit", background: "white",
};

const SecurityDashboard = () => {
  const user = getCurrentUser();
  const navigate = useNavigate();

  useEffect(() => { if (!user || user.role !== "security") navigate("/login"); }, [user, navigate]);

  const [residents, setResidents]   = useState([]);
  const [visitors, setVisitors]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState("");
  const [activeTab, setActiveTab]   = useState("log");
  const [formData, setFormData]     = useState({ name: "", phone: "", purpose: "", resident_id: "" });
  const [unreadCount, setUnreadCount] = useState(0);
  const [clock, setClock]           = useState(new Date());

  
  const todayStr = new Date().toISOString().slice(0, 10);
  const [reportFrom, setReportFrom]         = useState(todayStr);
  const [reportTo, setReportTo]             = useState(todayStr);
  const [reportData, setReportData]         = useState([]);
  const [reportLoading, setReportLoading]   = useState(false);
  const [reportError, setReportError]       = useState("");
  const [reportGenerated, setReportGenerated] = useState(false);

  useEffect(() => { loadResidents(); loadTodayVisitors(); loadUnreadCount(); }, []);
  useEffect(() => { const i = setInterval(loadUnreadCount, 30000); return () => clearInterval(i); }, []);
  useEffect(() => { const t = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(t); }, []);

  const loadUnreadCount  = async () => { try { const c = await fetchUnreadCount(); setUnreadCount(c || 0); } catch {} };
  const loadResidents    = async () => { try { const d = await fetchResidentsList(); setResidents(Array.isArray(d) ? d : []); } catch {} };
  const loadTodayVisitors = async () => {
    try { setLoading(true); setError(""); const d = await fetchTodayVisitors(); setVisitors(Array.isArray(d) ? d : []); }
    catch { setError("Failed to load visitors"); } finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setSuccess("");
    if (!formData.name || !formData.resident_id) { setError("Visitor name and resident are required"); return; }
    try {
      await addVisitorEntry(formData);
      setSuccess("Visitor entry logged successfully!");
      setFormData({ name: "", phone: "", purpose: "", resident_id: "" });
      loadTodayVisitors(); setActiveTab("today");
    } catch (err) { setError(err?.response?.data?.message || "Failed to add visitor"); }
  };

  const handleExit = async (gateLogId) => {
    try { await markVisitorExit(gateLogId); loadTodayVisitors(); } catch { alert("Failed to mark exit"); }
  };
  const handleLogout = () => { logout(); navigate("/login"); };

 
  const generateReport = async () => {
    if (!reportFrom || !reportTo) { setReportError("Please select both dates."); return; }
    if (reportFrom > reportTo) { setReportError("From date cannot be after To date."); return; }
    try {
      setReportLoading(true); setReportError(""); setReportGenerated(false);
      const res = await api.get(`/visitors/report?from=${reportFrom}&to=${reportTo}`);
      setReportData(Array.isArray(res.data) ? res.data : []);
      setReportGenerated(true);
    } catch (err) { setReportError(err?.response?.data?.message || "Failed to generate report."); }
    finally { setReportLoading(false); }
  };

 
  const fmtTime = (dt) => dt ? new Date(dt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
  const fmtDate = (dt) => dt ? new Date(dt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const fmtDateShort = (dt) => dt ? new Date(dt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";
  const flatStr = (v) => v.flat_number ? `${v.block_name ? `Block ${v.block_name} – ` : ""}Flat ${v.flat_number}` : "";

  const approved = reportData.filter(v => v.status?.toLowerCase() === "approved").length;
  const rejected = reportData.filter(v => v.status?.toLowerCase() === "rejected").length;
  const exited   = reportData.filter(v => v.status?.toLowerCase() === "exited").length;
  const pending  = reportData.filter(v => v.status?.toLowerCase() === "pending").length;

  
  const handlePrint = () => {
    const fromLabel = fmtDate(reportFrom + "T00:00:00");
    const toLabel   = fmtDate(reportTo   + "T00:00:00");
    const generatedAt = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const sColor = (s) => { const l=(s||"").toLowerCase(); if(l==="approved")return"#065f46"; if(l==="rejected")return"#991b1b"; if(l==="exited")return"#475569"; return"#92400e"; };
    const sBg    = (s) => { const l=(s||"").toLowerCase(); if(l==="approved")return"#d1fae5"; if(l==="rejected")return"#fee2e2"; if(l==="exited")return"#f1f5f9"; return"#fef3c7"; };

    const rows = reportData.map((v, i) => `
      <tr style="background:${i%2===0?"#fff":"#f8faff"}">
        <td>${i+1}</td>
        <td><strong>${v.name||"—"}</strong>${v.phone ? `<br/><small>📞 ${v.phone}</small>` : ""}</td>
        <td>${v.purpose||"—"}</td>
        <td>${v.resident_name||"—"}${v.flat_number ? `<br/><small style="color:#6366f1">${flatStr(v)}</small>` : ""}</td>
        <td>${fmtDateShort(v.entry_time)}</td>
        <td>${fmtTime(v.entry_time)}</td>
        <td>${fmtTime(v.exit_time)}</td>
        <td><span style="background:${sBg(v.status)};color:${sColor(v.status)};padding:2px 9px;border-radius:20px;font-size:10px;font-weight:700">${(v.status||"").toUpperCase()}</span></td>
        <td>${v.logged_by||"—"}</td>
      </tr>`).join("");

    const w = window.open("", "_blank", "width=1100,height=800");
    w.document.write(`<html><head><title>Visitor Report – SmartSociety</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Segoe UI',sans-serif;background:#fff;color:#1e1b4b;padding:28px}
      .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #e0e7ff}
      .logo{font-size:20px;font-weight:800;color:#312e81}
      .logo span{font-size:11px;display:block;font-weight:400;color:#94a3b8;margin-top:2px;letter-spacing:1px;text-transform:uppercase}
      .rtitle h2{font-size:16px;font-weight:700;text-align:right}.rtitle p{font-size:11px;color:#64748b;text-align:right;margin-top:3px}
      .stats{display:flex;gap:10px;margin-bottom:20px}
      .stat{flex:1;padding:12px;border-radius:10px;text-align:center}
      .stat .v{font-size:24px;font-weight:800}.stat .l{font-size:10px;margin-top:1px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      thead tr{background:linear-gradient(135deg,#1e1b4b,#312e81);color:white}
      thead th{padding:10px 11px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
      tbody td{padding:9px 11px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
      small{font-size:10px;color:#94a3b8}
      .footer{margin-top:20px;padding-top:14px;border-top:1px dashed #e0e7ff;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}
      @media print{
        body{padding:14px}
        .no-print{display:none!important}
        thead tr,tbody tr,.stat{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      }
    </style></head><body>
    <div class="hdr">
      <div><div class="logo">🏢SmartSociety<span>Security — Visitor Report</span></div></div>
      <div class="rtitle"><h2>Visitor Report</h2><p>${fromLabel} → ${toLabel}</p><p>Generated: ${generatedAt}</p></div>
    </div>
    <div class="stats">
      <div class="stat" style="background:#eef2ff"><div class="v" style="color:#6366f1">${reportData.length}</div><div class="l" style="color:#6366f1">Total</div></div>
      <div class="stat" style="background:#d1fae5"><div class="v" style="color:#059669">${approved}</div><div class="l" style="color:#059669">Approved</div></div>
      <div class="stat" style="background:#f1f5f9"><div class="v" style="color:#475569">${exited}</div><div class="l" style="color:#475569">Exited</div></div>
      <div class="stat" style="background:#fef3c7"><div class="v" style="color:#92400e">${pending}</div><div class="l" style="color:#92400e">Pending</div></div>
      <div class="stat" style="background:#fee2e2"><div class="v" style="color:#991b1b">${rejected}</div><div class="l" style="color:#991b1b">Rejected</div></div>
    </div>
    ${reportData.length === 0
      ? `<div style="text-align:center;padding:40px;color:#94a3b8">📭 No visitors found for this date range.</div>`
      : `<table>
          <thead><tr>
            <th>#</th><th>Visitor</th><th>Purpose</th><th>Visiting Resident</th>
            <th>Date</th><th>Entry</th><th>Exit</th><th>Status</th><th>Logged By</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`}
    <div class="footer">
      <span>SmartSociety — Computer Generated Report</span>
      <span>Total Records: ${reportData.length}</span>
    </div>
    <br/>
    <div class="no-print" style="text-align:center;margin-top:14px">
      <button onclick="window.print()" style="padding:10px 28px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">
        🖨 Print / Save as PDF
      </button>
    </div>
  </body></html>`);
    w.document.close();
  };

  const pendingCount = visitors.filter(v => v.status === "pending").length;
  const exitedCount  = visitors.filter(v => v.status === "exited").length;
  const activeCount  = visitors.filter(v => v.status === "approved" && !v.exit_time).length;
  const timeStr = clock.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const dateStr = clock.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const statusConfig = {
    pending:  { bg: "#fef3c7", color: "#92400e", dot: "#f59e0b", label: "Pending"  },
    approved: { bg: "#d1fae5", color: "#065f46", dot: "#10b981", label: "Approved" },
    exited:   { bg: "#f1f5f9", color: "#475569", dot: "#94a3b8", label: "Exited"   },
    rejected: { bg: "#fee2e2", color: "#991b1b", dot: "#ef4444", label: "Rejected" },
  };
  const getStatus = (s) => statusConfig[(s || "").toLowerCase()] || statusConfig.pending;
  const displayName = user?.name || user?.fullName || user?.email || "Security";

  const NAV_ITEMS = [
    { id: "log",     icon: "➕", label: "Log Visitor",       badge: 0               },
    { id: "today",   icon: "📋", label: "Today's Log",       badge: visitors.length  },
    { id: "pending", icon: "⏳", label: "Awaiting Approval", badge: pendingCount     },
    { id: "report",  icon: "📊", label: "Visitor Report",    badge: 0               },
  ];

  // ── Sidebar ──
  const Sidebar = () => (
    <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 256, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(20px)", borderRight: "1px solid rgba(99,102,241,0.1)", display: "flex", flexDirection: "column", zIndex: 50, boxShadow: "2px 0 20px rgba(99,102,241,0.06)" }}>
      <div style={{ padding: "24px 20px", borderBottom: "1px solid rgba(99,102,241,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🏢</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1e1b4b" }}>SmartSociety</div>
            <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px" }}>Security Portal</div>
          </div>
        </div>
        <div style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: 12, padding: "12px 16px" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "white", fontVariantNumeric: "tabular-nums" }}>{timeStr}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>{dateStr}</div>
        </div>
      </div>
      <nav style={{ padding: "16px 12px", flex: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", padding: "0 8px", marginBottom: 8 }}>Navigation</div>
        {NAV_ITEMS.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderRadius: 11, border: "none", cursor: "pointer", marginBottom: 4, background: activeTab === item.id ? "linear-gradient(135deg,#eef2ff,#e0e7ff)" : "transparent", color: activeTab === item.id ? "#6366f1" : "#64748b", boxShadow: activeTab === item.id ? "0 1px 8px rgba(99,102,241,0.12),inset 0 0 0 1.5px rgba(99,102,241,0.15)" : "none", transition: "all 0.15s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</span>
            </div>
            {item.badge > 0 && <span style={{ background: activeTab === item.id ? "#6366f1" : "#e0e7ff", color: activeTab === item.id ? "#fff" : "#4338ca", borderRadius: 20, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>{item.badge}</span>}
          </button>
        ))}
        <div style={{ marginTop: 8 }}>
          <button onClick={() => navigate("/notifications")} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderRadius: 11, border: "none", cursor: "pointer", background: "transparent", color: "#64748b", transition: "all 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = "#eef2ff"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 16 }}>🔔</span><span style={{ fontSize: 13, fontWeight: 600 }}>Notifications</span></div>
            {unreadCount > 0 && <span style={{ background: "#ef4444", color: "#fff", borderRadius: 20, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>{unreadCount > 9 ? "9+" : unreadCount}</span>}
          </button>
        </div>
      </nav>
      <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(99,102,241,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "white" }}>{displayName[0].toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>Security Staff</div>
          </div>
        </div>
        <button onClick={handleLogout} style={{ width: "100%", padding: "9px", borderRadius: 10, border: "1.5px solid #fecaca", background: "white", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
          onMouseLeave={e => e.currentTarget.style.background = "white"}>🚪 Logout</button>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", background: "linear-gradient(135deg,#f0f4ff 0%,#fafbff 50%,#f0f7ff 100%)", minHeight: "100vh" }}>
      <Sidebar />
      <div style={{ marginLeft: 256, padding: "28px 32px" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
          {[
            { label: "Total Today",      value: visitors.length, icon: "👥", color: "#6366f1", bg: "#eef2ff", border: "rgba(99,102,241,0.15)"  },
            { label: "Pending Approval", value: pendingCount,    icon: "⏳", color: "#f59e0b", bg: "#fffbeb", border: "rgba(245,158,11,0.15)"  },
            { label: "Currently Inside", value: activeCount,     icon: "✅", color: "#059669", bg: "#ecfdf5", border: "rgba(5,150,105,0.15)"   },
            { label: "Exited",           value: exitedCount,     icon: "🚪", color: "#64748b", bg: "#f8fafc", border: "rgba(100,116,139,0.15)" },
          ].map(s => (
            <div key={s.label} style={{ background: "white", borderRadius: 16, padding: "20px 22px", boxShadow: "0 1px 12px rgba(0,0,0,0.06)", border: `1px solid ${s.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div><div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6, fontWeight: 500 }}>{s.label}</div><div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div></div>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{s.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── LOG ── */}
        {activeTab === "log" && (
          <div>
            <div style={{ background: "linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#06b6d4 100%)", borderRadius: 20, padding: "28px 32px", marginBottom: 24, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -30, right: -30, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
              <div style={{ position: "relative" }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 6, letterSpacing: "1px", textTransform: "uppercase" }}>Gate Entry 🛡️</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "white", marginBottom: 6 }}>Log New Visitor</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>Record every visitor at the gate for security & resident notification.</div>
              </div>
            </div>
            {error   && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "12px 16px", borderRadius: 12, fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>}
            {success && <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", padding: "12px 16px", borderRadius: 12, fontSize: 13, marginBottom: 16 }}>✅ {success}</div>}
            <div style={{ background: "white", borderRadius: 20, padding: "28px", boxShadow: "0 1px 12px rgba(0,0,0,0.06)", maxWidth: 640 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1e1b4b", marginBottom: 4 }}>Visitor Details</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 22 }}>Fill in the visitor's information to log entry</div>
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Visitor Name <span style={{ color: "#ef4444" }}>*</span></label>
                    <input type="text" placeholder="Enter full name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Phone Number</label>
                    <input type="tel" placeholder="9876543210" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Purpose of Visit</label>
                  <input type="text" placeholder="e.g. Delivery, Guest, Electrician..." value={formData.purpose} onChange={e => setFormData(p => ({ ...p, purpose: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Visiting Resident <span style={{ color: "#ef4444" }}>*</span></label>
                  <select value={formData.resident_id} onChange={e => setFormData(p => ({ ...p, resident_id: e.target.value }))} required style={{ ...inputStyle, color: formData.resident_id ? "#1e293b" : "#94a3b8" }}>
                    <option value="">— Select Resident —</option>
                    {residents.map(r => <option key={r.id} value={r.id}>{r.full_name}{r.flat_number ? ` — Flat ${r.block_name||""}-${r.flat_number}` : ""}</option>)}
                  </select>
                </div>
                <button type="submit" style={{ padding: "13px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.opacity="0.88"} onMouseLeave={e => e.currentTarget.style.opacity="1"}>🛡️ Submit Visitor Entry</button>
              </form>
            </div>
          </div>
        )}

        {/* ── TODAY ── */}
        {activeTab === "today" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1e1b4b" }}>📋 Today's Visitor Log</div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{visitors.length} visitor{visitors.length !== 1 ? "s" : ""} recorded today</div>
              </div>
              <button onClick={loadTodayVisitors} style={{ fontSize: 12, color: "#6366f1", background: "#eef2ff", border: "1.5px solid rgba(99,102,241,0.2)", cursor: "pointer", fontWeight: 600, padding: "8px 16px", borderRadius: 10 }}>↺ Refresh</button>
            </div>
            {loading ? <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8" }}>Loading...</div>
            : visitors.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px", background: "white", borderRadius: 20, boxShadow: "0 1px 12px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 52, marginBottom: 14 }}>🚪</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#374151" }}>No visitors today</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {visitors.map(v => {
                  const sc = getStatus(v.status);
                  return (
                    <div key={v.gate_log_id} style={{ background: "white", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 1px 12px rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.04)" }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#c7d2fe,#a5b4fc)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, color: "#4338ca", flexShrink: 0 }}>{(v.name||"V")[0].toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 3 }}>{v.name}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 7 }}>
                          {v.phone   && <span>📞 {v.phone}</span>}
                          {v.purpose && <span>🎯 {v.purpose}</span>}
                          <span>🕐 In: {fmtTime(v.entry_time)}</span>
                          {v.exit_time && <span>🚪 Out: {fmtTime(v.exit_time)}</span>}
                        </div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f0f4ff", border: "1px solid #e0e7ff", borderRadius: 8, padding: "4px 10px" }}>
                          <span style={{ fontSize: 11 }}>🏠</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#4338ca" }}>{v.resident_name || "Unknown"}</span>
                          {v.flat_number && <><span style={{ fontSize: 10, color: "#a5b4fc" }}>•</span><span style={{ fontSize: 11, color: "#6366f1" }}>{flatStr(v)}</span></>}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                        <span style={{ background: sc.bg, color: sc.color, padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot, display: "inline-block" }} />{sc.label}
                        </span>
                        {v.status === "approved" && !v.exit_time && (
                          <button onClick={() => handleExit(v.gate_log_id)} style={{ padding: "6px 14px", borderRadius: 9, border: "1.5px solid #a7f3d0", background: "#ecfdf5", color: "#059669", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Mark Exit</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── PENDING ── */}
        {activeTab === "pending" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1e1b4b" }}>⏳ Awaiting Approval</div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{pendingCount} visitor{pendingCount !== 1 ? "s" : ""} waiting at gate</div>
              </div>
              <button onClick={loadTodayVisitors} style={{ fontSize: 12, color: "#6366f1", background: "#eef2ff", border: "1.5px solid rgba(99,102,241,0.2)", cursor: "pointer", fontWeight: 600, padding: "8px 16px", borderRadius: 10 }}>↺ Refresh</button>
            </div>
            {visitors.filter(v => v.status === "pending").length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px", background: "white", borderRadius: 20, boxShadow: "0 1px 12px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 52, marginBottom: 14 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#374151" }}>All clear! No visitors waiting.</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
                {visitors.filter(v => v.status === "pending").map(v => (
                  <div key={v.gate_log_id} style={{ background: "white", borderRadius: 18, padding: "20px", position: "relative", boxShadow: "0 1px 12px rgba(0,0,0,0.06)", border: "1.5px solid rgba(99,102,241,0.15)" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg,#6366f1,#8b5cf6)", borderRadius: "18px 18px 0 0" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, marginTop: 4 }}>
                      <div style={{ width: 46, height: 46, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, color: "white" }}>{(v.name||"V")[0].toUpperCase()}</div>
                      <div><div style={{ fontSize: 15, fontWeight: 700, color: "#1e1b4b" }}>{v.name}</div><div style={{ fontSize: 11, color: "#64748b" }}>{v.purpose||"Visitor"}</div></div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#64748b", marginBottom: 14 }}>
                      {v.phone && <div>📞 {v.phone}</div>}
                      <div>🕐 Arrived: {fmtTime(v.entry_time)}</div>
                      {v.resident_name && (
                        <div style={{ marginTop: 4, display: "inline-flex", alignItems: "center", gap: 6, background: "#f0f4ff", border: "1px solid #e0e7ff", borderRadius: 8, padding: "4px 10px" }}>
                          <span>🏠</span><span style={{ fontWeight: 600, color: "#4338ca" }}>{v.resident_name}</span>
                          {v.flat_number && <><span style={{ color: "#a5b4fc" }}>•</span><span style={{ color: "#6366f1" }}>{flatStr(v)}</span></>}
                        </div>
                      )}
                    </div>
                    <div style={{ padding: "10px 14px", borderRadius: 10, background: "#eef2ff", border: "1px solid rgba(99,102,241,0.2)", fontSize: 11, color: "#4338ca", fontWeight: 600 }}>⏳ Waiting for resident approval...</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REPORT TAB ── */}
        {activeTab === "report" && (
          <div>
            {/* Hero */}
            <div style={{ background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 60%,#4338ca 100%)", borderRadius: 20, padding: "28px 32px", marginBottom: 24, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -30, right: -30, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
              <div style={{ position: "relative" }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 6, letterSpacing: "1px", textTransform: "uppercase" }}>Security Analytics 📊</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "white", marginBottom: 6 }}>Visitor Report</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Filter by date range, preview the report, then download as PDF.</div>
              </div>
            </div>

            {/* Date filter */}
            <div style={{ background: "white", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 12px rgba(0,0,0,0.06)", marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1e1b4b", marginBottom: 16 }}>📅 Select Date Range</div>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>From</label>
                  <input type="date" value={reportFrom} max={todayStr} onChange={e => { setReportFrom(e.target.value); setReportGenerated(false); }} style={inputStyle} />
                </div>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>To</label>
                  <input type="date" value={reportTo} max={todayStr} onChange={e => { setReportTo(e.target.value); setReportGenerated(false); }} style={inputStyle} />
                </div>
                {/* Quick filters */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { label: "Today",       from: todayStr, to: todayStr },
                    { label: "Last 7 Days", from: new Date(Date.now()-6*86400000).toISOString().slice(0,10), to: todayStr },
                    { label: "This Month",  from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10), to: todayStr },
                  ].map(q => (
                    <button key={q.label} onClick={() => { setReportFrom(q.from); setReportTo(q.to); setReportGenerated(false); }}
                      style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e0e7ff", background: "#f0f4ff", color: "#4338ca", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                      {q.label}
                    </button>
                  ))}
                </div>
                <button onClick={generateReport} disabled={reportLoading}
                  style={{ padding: "10px 24px", borderRadius: 11, border: "none", background: reportLoading ? "#a5b4fc" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", fontSize: 13, fontWeight: 700, cursor: reportLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                  {reportLoading ? "Loading..." : "Generate →"}
                </button>
              </div>
              {reportError && <div style={{ marginTop: 12, fontSize: 12, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px" }}>⚠️ {reportError}</div>}
            </div>

            {/* Preview + Download button */}
            {reportGenerated && (
              <div style={{ background: "white", borderRadius: 16, boxShadow: "0 1px 12px rgba(0,0,0,0.06)", overflow: "hidden" }}>
                {/* Table toolbar */}
                <div style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1e1b4b" }}>{reportData.length} visitor{reportData.length !== 1 ? "s" : ""} found</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                      {fmtDate(reportFrom+"T00:00:00")}{reportFrom !== reportTo ? ` → ${fmtDate(reportTo+"T00:00:00")}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {/* Status summary */}
                    {[
                      { label: "Approved", count: approved, bg: "#d1fae5", color: "#065f46" },
                      { label: "Exited",   count: exited,   bg: "#f1f5f9", color: "#475569" },
                      { label: "Pending",  count: pending,  bg: "#fef3c7", color: "#92400e" },
                      { label: "Rejected", count: rejected, bg: "#fee2e2", color: "#991b1b" },
                    ].map(s => (
                      <span key={s.label} style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: s.bg, color: s.color }}>{s.label}: {s.count}</span>
                    ))}
                    {/* PDF download button only */}
                    <button onClick={handlePrint} title="Print or save as PDF"
                      style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#1e1b4b,#312e81)", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                      🖨 PDF
                    </button>
                  </div>
                </div>

                {reportData.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 20px" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>No visitors found for this period</div>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "linear-gradient(135deg,#1e1b4b,#312e81)" }}>
                          {["#","Visitor","Purpose","Visiting Resident","Date","Entry","Exit","Status","Logged By"].map(h => (
                            <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "white", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((v, i) => {
                          const sc = getStatus(v.status);
                          return (
                            <tr key={v.gate_log_id || i} style={{ background: i%2===0 ? "white" : "#f8faff", borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "12px 14px", color: "#94a3b8", fontWeight: 600 }}>{i+1}</td>
                              <td style={{ padding: "12px 14px" }}>
                                <div style={{ fontWeight: 700, color: "#1e293b" }}>{v.name||"—"}</div>
                                {v.phone && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>📞 {v.phone}</div>}
                              </td>
                              <td style={{ padding: "12px 14px", color: "#64748b" }}>{v.purpose||"—"}</td>
                              <td style={{ padding: "12px 14px" }}>
                                <div style={{ fontWeight: 600, color: "#1e293b" }}>{v.resident_name||"—"}</div>
                                {v.flat_number && <div style={{ fontSize: 11, color: "#6366f1", marginTop: 2 }}>{flatStr(v)}</div>}
                              </td>
                              <td style={{ padding: "12px 14px", color: "#64748b", whiteSpace: "nowrap" }}>{fmtDateShort(v.entry_time)}</td>
                              <td style={{ padding: "12px 14px", color: "#64748b", whiteSpace: "nowrap" }}>{fmtTime(v.entry_time)}</td>
                              <td style={{ padding: "12px 14px", color: "#64748b", whiteSpace: "nowrap" }}>{fmtTime(v.exit_time)}</td>
                              <td style={{ padding: "12px 14px" }}>
                                <span style={{ background: sc.bg, color: sc.color, padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc.dot, display: "inline-block" }} />{sc.label}
                                </span>
                              </td>
                              <td style={{ padding: "12px 14px", color: "#64748b" }}>{v.logged_by||"—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityDashboard;