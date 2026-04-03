// client/src/pages/ResidentDashboard.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, logout } from "../utils/auth";
import { fetchResidentComplaints, submitComplaint } from "../services/complaintService";
import { fetchFacilities, createFacilityBooking, fetchResidentBookings } from "../services/facilityService";
import { getNotices } from "../services/noticeService";
import { fetchEvents } from "../services/eventService";
import { fetchResidentMaintenance } from "../services/maintenanceService";
import { fetchPendingVisitors, decideVisitor } from "../services/visitorService";
import ResidentPayments from "../components/ResidentPayments";
import NotificationBell from "../components/NotificationBell";
import api from "../services/api";

const TABS = ["Overview", "Complaints", "Visitors", "Facilities", "Notices", "Events", "Maintenance"];


const compactInput = {
  width: "100%", padding: "8px 12px", borderRadius: 9,
  border: "1.5px solid #e2e8f0", fontSize: 12, outline: "none",
  boxSizing: "border-box", fontFamily: "inherit",
};
const labelStyle = { fontSize: 10, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 };


const to12hr = (t) => {
  if (!t) return "—";
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
};
const fmtSlot = (start, end) => start ? `${to12hr(start)}${end ? " – " + to12hr(end) : ""}` : "—";

// ─── Payment Modal (Compact + Reliable Admin Sync) ────────────────────────────
const PaymentModal = ({ booking, facility, onClose, onSuccess, onPaymentComplete }) => {
  const [tab, setTab] = useState("card");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [upiId, setUpiId] = useState("");
  const [step, setStep] = useState("details");
  const [processingMsg, setProcessingMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [syncWarning, setSyncWarning] = useState("");

  const amount = parseFloat(booking?.total_amount || facility?.booking_fee || 0);
  const txnId = "TXN" + Date.now().toString().slice(-8);

  const formatCard = (val) => val.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const formatExpiry = (val) => { const d = val.replace(/\D/g, "").slice(0, 4); return d.length >= 3 ? d.slice(0, 2) + "/" + d.slice(2) : d; };

  const validate = () => {
    const e = {};
    if (tab === "card") {
      if (!cardName.trim()) e.cardName = "Name required";
      if (cardNumber.replace(/\s/g, "").length < 16) e.cardNumber = "Enter valid 16-digit number";
      if (!cardExpiry || cardExpiry.length < 5) e.cardExpiry = "Enter valid MM/YY";
      if (cardCvv.length < 3) e.cardCvv = "Enter 3-digit CVV";
    } else {
      if (!upiId.trim()) e.upiId = "UPI ID required";
      else if (!upiId.includes("@")) e.upiId = "Enter valid UPI ID (e.g. name@gpay)";
    }
    return e;
  };

  const handlePay = () => {
    const e = validate();
    if (Object.keys(e).length) { setFieldErrors(e); return; }
    setStep("processing");
    setSyncWarning("");
    const msgs = tab === "upi"
      ? ["Sending UPI request...", "Awaiting confirmation...", "Verifying transaction..."]
      : ["Contacting payment network...", "Verifying card details...", "Authorising transaction..."];
    let i = 0;
    setProcessingMsg(msgs[0]);
    const iv = setInterval(() => {
      i++;
      if (i < msgs.length) { setProcessingMsg(msgs[i]); }
      else {
        clearInterval(iv);
        
        onPaymentComplete?.(booking?.id, tab);
        if (booking?.id) {
          api.put(`/facility-bookings/${booking.id}/mark-paid`, {
            payment_method: tab.toUpperCase(),
            amount,
            transaction_id: txnId,
          })
            .then(() => setStep("success"))
            .catch(() => {
              setSyncWarning("Receipt saved. Admin will confirm payment shortly.");
              setStep("success");
            });
        } else {
          setStep("success");
        }
      }
    }, 900);
  };

  const fieldErr = (key) => fieldErrors[key]
    ? <div style={{ fontSize: 10, color: "#ef4444", marginTop: 3 }}>{fieldErrors[key]}</div>
    : null;
  const inputErr = (key) => ({
    ...compactInput,
    borderColor: fieldErrors[key] ? "#fca5a5" : "#e2e8f0",
    background: fieldErrors[key] ? "#fef2f2" : "white",
  });

  const receiptDate = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const methodLabel = tab === "upi" ? "UPI — " + upiId : "Card";

  const printReceipt = () => {
    const w = window.open("", "_blank", "width=480,height=640");
    w.document.write(`<html><head><title>Payment Receipt</title>
      <style>
        body{font-family:'Segoe UI',sans-serif;margin:0;padding:24px;background:#fff;color:#1e1b4b}
        .header{text-align:center;border-bottom:2px dashed #c7d2fe;padding-bottom:16px;margin-bottom:16px}
        .society{font-size:18px;font-weight:800;color:#312e81}
        .subtitle{font-size:11px;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;margin-top:2px}
        .badge{display:inline-block;margin:10px auto 0;background:#d1fae5;color:#065f46;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700}
        .amount-box{text-align:center;margin:14px 0}
        .amount-label{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px}
        .amount-value{font-size:30px;font-weight:800;color:#312e81;margin-top:2px}
        .txn{text-align:center;font-family:monospace;font-size:12px;color:#6366f1;background:#eef2ff;padding:6px 14px;border-radius:6px;margin:10px 0}
        .receipt-box{background:#f8faff;border:1.5px solid #e0e7ff;border-radius:10px;padding:14px;margin-bottom:14px}
        .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:12px}
        .row:last-child{border-bottom:none}
        .label{color:#64748b}
        .value{font-weight:700;color:#1e1b4b;text-align:right;max-width:55%}
        .footer{text-align:center;font-size:10px;color:#94a3b8;border-top:1px dashed #e2e8f0;padding-top:12px;margin-top:12px}
        @media print{body{padding:12px}}
      </style>
      </head><body>
      <div class="header">
        <div class="society">🏢 SmartSociety</div>
        <div class="subtitle">Facility Booking Receipt</div>
        <div class="badge">✓ Payment Confirmed</div>
      </div>
      <div class="amount-box">
        <div class="amount-label">Amount Paid</div>
        <div class="amount-value">₹${amount.toFixed(2)}</div>
      </div>
      <div class="txn">TXN ID: ${txnId}</div>
      <div class="receipt-box">
        <div class="row"><span class="label">Facility</span><span class="value">${facility?.name || booking?.facility_name || "—"}</span></div>
        <div class="row"><span class="label">Booking Date</span><span class="value">${booking?.booking_date || "—"}</span></div>
        <div class="row"><span class="label">Time Slot</span><span class="value">${fmtSlot(booking?.start_time, booking?.end_time)}</span></div>
        <div class="row"><span class="label">Booking ID</span><span class="value">#${booking?.id || "—"}</span></div>
        <div class="row"><span class="label">Method</span><span class="value">${methodLabel}</span></div>
        <div class="row"><span class="label">Date</span><span class="value">${receiptDate}</span></div>
        <div class="row"><span class="label">Status</span><span class="value">✓ Paid</span></div>
      </div>
      <div class="footer">Computer-generated receipt • SmartSociety ${new Date().getFullYear()}</div>
      <br/><div style="text-align:center">
        <button onclick="window.print()" style="padding:8px 24px;background:#6366f1;color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">🖨 Print</button>
      </div>
    </body></html>`);
    w.document.close();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,15,40,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 18, width: "100%", maxWidth: 400, boxShadow: "0 24px 80px rgba(0,0,0,0.25)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#1e1b4b,#312e81)", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 2 }}>Secure Payment</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "white" }}>{facility?.name || booking?.facility_name}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>Amount Due</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "white" }}>₹{amount.toFixed(2)}</div>
            </div>
            {step !== "processing" && (
              <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", width: 28, height: 28, borderRadius: "50%", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            )}
          </div>
        </div>

        <div style={{ padding: "16px 18px" }}>

          {/* PROCESSING */}
          {step === "processing" && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <style>{`@keyframes rdspin { to { transform: rotate(360deg); } }`}</style>
              <div style={{ position: "relative", width: 56, height: 56, margin: "0 auto 14px" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", border: "3px solid #e0e7ff", borderTop: "3px solid #6366f1", animation: "rdspin 0.9s linear infinite", position: "absolute" }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>💳</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1e1b4b", marginBottom: 4 }}>Processing Payment</div>
              <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 500, minHeight: 18 }}>{processingMsg}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 8 }}>Please do not close this window</div>
            </div>
          )}

          {/* SUCCESS + RECEIPT */}
          {step === "success" && (
            <div>
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg,#10b981,#059669)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", fontSize: 24, color: "white", fontWeight: 800, boxShadow: "0 6px 18px rgba(16,185,129,0.3)" }}>✓</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#065f46", marginBottom: 3 }}>Payment Successful!</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>Your booking is confirmed.</div>
                {syncWarning && <div style={{ marginTop: 6, fontSize: 10, color: "#d97706", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "4px 8px" }}>⚠ {syncWarning}</div>}
              </div>

              {/* Receipt card */}
              <div style={{ border: "1.5px solid #e0e7ff", borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
                <div style={{ background: "linear-gradient(135deg,#1e1b4b,#312e81)", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "1px" }}>SmartSociety</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "white", marginTop: 1 }}>Facility Booking Receipt</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>Amount Paid</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "white" }}>₹{amount.toFixed(2)}</div>
                  </div>
                </div>
                <div style={{ background: "#eef2ff", padding: "5px 14px", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #e0e7ff" }}>
                  <span style={{ fontSize: 10, color: "#6366f1" }}>TXN ID</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#312e81", fontFamily: "monospace" }}>{txnId}</span>
                </div>
                {[
                  ["Facility", facility?.name || booking?.facility_name || "—"],
                  ["Date", booking?.booking_date || "—"],
                  ["Slot", fmtSlot(booking?.start_time, booking?.end_time)],
                  ["Booking ID", `#${booking?.id || "—"}`],
                  ["Method", methodLabel],
                  ["Status", "✓ Paid"],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 14px", borderBottom: "1px solid #f8faff" }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#1e1b4b", textAlign: "right", maxWidth: "60%" }}>{val}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={printReceipt} style={{ flex: 1, padding: "9px", borderRadius: 10, border: "1.5px solid #c7d2fe", background: "#eef2ff", color: "#4338ca", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🖨 Print</button>
                <button onClick={() => { onSuccess?.(); onClose(); }} style={{ flex: 1, padding: "9px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Done ✓</button>
              </div>
              <div style={{ textAlign: "center", marginTop: 8, fontSize: 10, color: "#94a3b8" }}>Computer-generated receipt • SmartSociety</div>
            </div>
          )}

          {/* PAYMENT DETAILS — Card + UPI only */}
          {step === "details" && (
            <>
              {/* Tab switcher */}
              <div style={{ display: "flex", gap: 3, marginBottom: 16, background: "#f1f5f9", borderRadius: 9, padding: 3 }}>
                {[{ key: "card", label: "💳 Card" }, { key: "upi", label: "📱 UPI" }].map(m => (
                  <button key={m.key} onClick={() => { setTab(m.key); setFieldErrors({}); }}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: tab === m.key ? "white" : "transparent", color: tab === m.key ? "#6366f1" : "#64748b", boxShadow: tab === m.key ? "0 1px 4px rgba(99,102,241,0.15)" : "none", transition: "all 0.15s" }}>
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Card form */}
              {tab === "card" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>Cardholder Name</label>
                    <input value={cardName} onChange={e => { setCardName(e.target.value); setFieldErrors(p => ({ ...p, cardName: "" })); }} placeholder="Full name on card" style={inputErr("cardName")} />
                    {fieldErr("cardName")}
                  </div>
                  <div>
                    <label style={labelStyle}>Card Number</label>
                    <input value={cardNumber} onChange={e => { setCardNumber(formatCard(e.target.value)); setFieldErrors(p => ({ ...p, cardNumber: "" })); }} placeholder="•••• •••• •••• ••••" maxLength={19} style={{ ...inputErr("cardNumber"), letterSpacing: "1.5px", fontFamily: "monospace" }} />
                    {fieldErr("cardNumber")}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={labelStyle}>Expiry</label>
                      <input value={cardExpiry} onChange={e => { setCardExpiry(formatExpiry(e.target.value)); setFieldErrors(p => ({ ...p, cardExpiry: "" })); }} placeholder="MM/YY" maxLength={5} style={inputErr("cardExpiry")} />
                      {fieldErr("cardExpiry")}
                    </div>
                    <div>
                      <label style={labelStyle}>CVV</label>
                      <input value={cardCvv} onChange={e => { setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 3)); setFieldErrors(p => ({ ...p, cardCvv: "" })); }} placeholder="•••" maxLength={3} type="password" style={inputErr("cardCvv")} />
                      {fieldErr("cardCvv")}
                    </div>
                  </div>
                </div>
              )}

              {/* UPI form */}
              {tab === "upi" && (
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>UPI ID</label>
                  <input value={upiId} onChange={e => { setUpiId(e.target.value); setFieldErrors(p => ({ ...p, upiId: "" })); }} placeholder="yourname@gpay / name@paytm" style={inputErr("upiId")} />
                  {fieldErr("upiId")}
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    {[{ label: "GPay", bg: "#e8f5e9", e: "🟢" }, { label: "PhonePe", bg: "#ede9fe", e: "🟣" }, { label: "Paytm", bg: "#e0f2fe", e: "🔵" }, { label: "BHIM", bg: "#fef9c3", e: "🟡" }].map(a => (
                      <div key={a.label} onClick={() => setUpiId(prev => prev.includes("@") ? prev : prev + "@" + a.label.toLowerCase())}
                        style={{ flex: 1, padding: "6px 2px", borderRadius: 8, background: a.bg, textAlign: "center", cursor: "pointer" }}>
                        <div style={{ fontSize: 16 }}>{a.e}</div>
                        <div style={{ fontSize: 9, fontWeight: 600, color: "#475569", marginTop: 1 }}>{a.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={handlePay} style={{ width: "100%", padding: "11px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 8 }}>
                Pay ₹{amount.toFixed(2)} →
              </button>
              <div style={{ textAlign: "center", fontSize: 10, color: "#94a3b8" }}>🔒 Simulated demo — no real transaction will occur</div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};


const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 10,
  border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none",
  boxSizing: "border-box", fontFamily: "inherit",
};

// ─── Facility Card Component ───────────────────────────────────────────────────
const FacilityCard = ({ facility, onBook, isRemoved }) => {
  const fee = parseFloat(facility.booking_fee || 0);
  const isFree = fee === 0;

  return (
    <div style={{
      borderRadius: 16,
      border: isRemoved ? "1.5px dashed #cbd5e1" : "1.5px solid #e0e7ff",
      background: isRemoved ? "#f8fafc" : "white",
      overflow: "hidden",
      opacity: isRemoved ? 0.72 : 1,
      transition: "box-shadow 0.2s",
      boxShadow: isRemoved ? "none" : "0 2px 12px rgba(99,102,241,0.07)",
    }}>
      <div style={{ height: 4, background: isRemoved ? "#cbd5e1" : isFree ? "linear-gradient(90deg, #10b981, #06b6d4)" : "linear-gradient(90deg, #6366f1, #8b5cf6)" }} />
      <div style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: isRemoved ? "#94a3b8" : "#1e1b4b", lineHeight: 1.3 }}>{facility.name}</div>
          {isRemoved ? (
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: "#fee2e2", color: "#991b1b", whiteSpace: "nowrap", flexShrink: 0 }}>🚫 Unavailable</span>
          ) : (
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: isFree ? "#d1fae5" : "#e0e7ff", color: isFree ? "#065f46" : "#3730a3", whiteSpace: "nowrap", flexShrink: 0 }}>{isFree ? "FREE" : `₹${fee}`}</span>
          )}
        </div>
        {facility.description && <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10, lineHeight: 1.5 }}>{facility.description}</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {facility.location && <span style={{ fontSize: 11, color: "#6366f1", background: "#eef2ff", padding: "3px 9px", borderRadius: 20 }}>📍 {facility.location}</span>}
          {facility.capacity && <span style={{ fontSize: 11, color: "#0891b2", background: "#ecfeff", padding: "3px 9px", borderRadius: 20 }}>👥 Cap: {facility.capacity}</span>}
          {facility.available_from && <span style={{ fontSize: 11, color: "#7c3aed", background: "#f5f3ff", padding: "3px 9px", borderRadius: 20 }}>🕐 {to12hr(facility.available_from)} – {to12hr(facility.available_to)}</span>}
          {!isRemoved && (
            <span style={{ fontSize: 11, color: facility.booking_mode === "instant" ? "#059669" : "#d97706", background: facility.booking_mode === "instant" ? "#ecfdf5" : "#fffbeb", padding: "3px 9px", borderRadius: 20 }}>
              {facility.booking_mode === "instant" ? "⚡ Instant Confirm" : "⏳ Admin Approval"}
            </span>
          )}
        </div>
        {isRemoved ? (
          <div style={{ padding: "10px 12px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#991b1b", marginBottom: 2 }}>Currently Unavailable</div>
            {facility.removed_reason && <div style={{ fontSize: 11, color: "#b91c1c" }}>{facility.removed_reason}</div>}
          </div>
        ) : (
          <button onClick={() => onBook(facility)} style={{ width: "100%", padding: "11px", borderRadius: 11, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "opacity 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >Book Now</button>
        )}
      </div>
    </div>
  );
};

// ─── Booking Form Modal ────────────────────────────────────────────────────────
const BookingModal = ({ facility, userId, onClose, onBooked }) => {
  const [form, setForm] = useState({ booking_date: "", start_time: "", end_time: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [createdBooking, setCreatedBooking] = useState(null);

  const fee = parseFloat(facility.booking_fee || 0);
  const hasFee = fee > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.booking_date) { setError("Please select a booking date."); return; }
    try {
      setSubmitting(true); setError("");
      const res = await createFacilityBooking({ facility_id: facility.id, resident_id: userId, total_amount: fee, booking_fee: fee, ...form });
      const booking = res?.booking || res;
      setCreatedBooking({ ...booking, total_amount: fee });
      const isInstant = facility.booking_mode === "instant";
      if (hasFee && isInstant) {
        setShowPayment(true);
      } else {
        onBooked?.();
        onClose();
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create booking.");
    } finally {
      setSubmitting(false);
    }
  };

  if (showPayment && createdBooking) {
    return <PaymentModal booking={createdBooking} facility={facility} onClose={onClose} onSuccess={onBooked} />;
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,15,40,0.55)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 440, boxShadow: "0 24px 80px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", padding: "22px 26px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 3 }}>Booking Request</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "white" }}>{facility.name}</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", width: 34, height: 34, borderRadius: "50%", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        <div style={{ padding: "12px 26px", background: "#f0f4ff", borderBottom: "1px solid #e0e7ff", display: "flex", gap: 16, flexWrap: "wrap" }}>
          {facility.available_from && <span style={{ fontSize: 12, color: "#6366f1" }}>🕐 {facility.available_from} – {facility.available_to}</span>}
          {facility.location && <span style={{ fontSize: 12, color: "#6366f1" }}>📍 {facility.location}</span>}
          <span style={{ fontSize: 12, color: hasFee ? "#7c3aed" : "#059669", fontWeight: 700 }}>{hasFee ? `₹${fee} booking fee` : "Free to book"}</span>
          <span style={{ fontSize: 12, color: facility.booking_mode === "instant" ? "#059669" : "#d97706", fontWeight: 600 }}>
            {facility.booking_mode === "instant" ? (hasFee ? "⚡ Instant — pay now" : "⚡ Instant confirmation") : "⏳ Admin approval required — pay after approval"}
          </span>
        </div>
        <div style={{ padding: "22px 26px" }}>
          {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 14px", borderRadius: 10, fontSize: 12, marginBottom: 16 }}>{error}</div>}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Booking Date <span style={{ color: "#ef4444" }}>*</span></label>
              <input type="date" value={form.booking_date} onChange={e => setForm(p => ({ ...p, booking_date: e.target.value }))} required style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Start Time</label>
                <input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>End Time</label>
                <input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            {hasFee && (
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "#f5f3ff", border: "1px solid #e9d5ff", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>💳</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#6d28d9" }}>Payment required: ₹{fee.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: "#7c3aed" }}>
                    {facility.booking_mode === "instant" ? "You'll choose online or offline payment on the next screen." : "Payment will be required after admin approves your booking."}
                  </div>
                </div>
              </div>
            )}
            <button type="submit" disabled={submitting} style={{ padding: "13px", borderRadius: 12, border: "none", background: submitting ? "#a5b4fc" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              {submitting ? "Booking..." : hasFee && facility.booking_mode === "instant" ? "Confirm & Pay →" : "Submit Booking Request"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ─── Main Resident Dashboard ───────────────────────────────────────────────────
const ResidentDashboard = () => {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Overview");

  const [complaints, setComplaints] = useState([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [complaintsError, setComplaintsError] = useState("");
  const [complaintForm, setComplaintForm] = useState({ title: "", description: "", category: "General", priority: "Medium" });
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);

  const [allFacilities, setAllFacilities] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [facilityLoading, setFacilityLoading] = useState(false);
  const [facilityError, setFacilityError] = useState("");

  const [bookingModal, setBookingModal] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);
  const [facilityTab, setFacilityTab] = useState("available");

  const [notices, setNotices] = useState([]);
  const [noticesLoading, setNoticesLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [maintenanceInvoices, setMaintenanceInvoices] = useState([]);
  const [mLoading, setMLoading] = useState(false);
  const [mError, setMError] = useState("");
  const [pendingVisitors, setPendingVisitors] = useState([]);
  const [visitorLoading, setVisitorLoading] = useState(false);
  const [visitorError, setVisitorError] = useState("");

  useEffect(() => { if (!user) navigate("/login"); }, [user, navigate]);

  const displayName = user?.name || user?.fullName || user?.email || "Resident";
  const handleLogout = () => { logout(); navigate("/login"); };

  const loadComplaints = async () => {
    if (!user?.id) return;
    try { setComplaintsLoading(true); setComplaintsError(""); const data = await fetchResidentComplaints(user.id); setComplaints(Array.isArray(data) ? data : data.complaints || []); } catch (err) { setComplaintsError(err?.response?.data?.message || "Failed to load complaints."); } finally { setComplaintsLoading(false); }
  };

  const loadFacilitiesAndBookings = async () => {
    if (!user?.id) return;
    try {
      setFacilityLoading(true); setFacilityError("");

      // Fetch active facilities, inactive facilities, and bookings in parallel
      const [activeFacRes, inactiveFacRes, b] = await Promise.all([
        fetchFacilities(),                   // GET /facilities  (active only, public)
        api.get("/facilities/inactive"),     // GET /facilities/inactive (authenticated)
        fetchResidentBookings(user.id),
      ]);

      const activeFacs   = Array.isArray(activeFacRes)        ? activeFacRes        : activeFacRes?.facilities   || [];
      const inactiveFacs = Array.isArray(inactiveFacRes.data) ? inactiveFacRes.data : [];
      const bookingsList = Array.isArray(b) ? b : b.bookings || [];

      setAllFacilities([...activeFacs, ...inactiveFacs]);
      setBookings(bookingsList);
    } catch (err) {
      setFacilityError(err?.response?.data?.message || "Failed to load facilities.");
    } finally { setFacilityLoading(false); }
  };

  const loadNotices = async () => {
  try {
    setNoticesLoading(true);
    console.log("Full user object:", user); // ← add this
    console.log("Fetching notices with user id:", user?.id);
    const data = await getNotices("residents", user?.id);
    console.log("Notices received:", data);
    setNotices(Array.isArray(data) ? data : data.notices || []);
  } catch (err) {
    console.error("Notice fetch error:", err);
  } finally {
    setNoticesLoading(false);
  }
};

  const loadEvents = async () => {
    try { setEventsLoading(true); const data = await fetchEvents("upcoming"); setEvents(Array.isArray(data) ? data : data.events || []); } catch (err) {} finally { setEventsLoading(false); }
  };

  const loadPendingVisitors = async () => {
    if (!user?.id) return;
    try {
      setVisitorLoading(true);
      setVisitorError("");

      // ✅ FIX: Ensure user.id is passed as a plain number/string (not an object)
      const residentId = user.id;
      console.log("🔍 Fetching pending visitors for residentId:", residentId, typeof residentId);

      const data = await fetchPendingVisitors(residentId);
      console.log("✅ Pending visitors response:", data);

      setPendingVisitors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("❌ Visitor fetch error:", err?.response?.status, err?.response?.data);

      // ✅ FIX: Show a more specific error so you know if it's a 403 vs 500
      const status = err?.response?.status;
      if (status === 403) {
        setVisitorError("Access denied (403) — resident ID mismatch. Check your login token.");
      } else if (status === 401) {
        setVisitorError("Not authenticated (401) — please log out and back in.");
      } else {
        setVisitorError(`Failed to load pending visitors (${status || "network error"})`);
      }
    } finally {
      setVisitorLoading(false);
    }
  };

  const loadResidentMaintenance = async () => {
    if (!user?.id) return;
    try { setMLoading(true); setMError(""); const data = await fetchResidentMaintenance(user.id); setMaintenanceInvoices(Array.isArray(data) ? data : data.invoices || []); } catch (err) { setMError(err?.response?.data?.message || "Failed to load maintenance."); } finally { setMLoading(false); }
  };

  useEffect(() => {
    loadComplaints();
    loadFacilitiesAndBookings();
    loadNotices();
    loadEvents();
    loadResidentMaintenance();
    loadPendingVisitors();

    // ✅ FIX: Poll for new visitors every 15 seconds automatically
    const visitorPollInterval = setInterval(() => {
      loadPendingVisitors();
    }, 15000);

    return () => clearInterval(visitorPollInterval); // cleanup on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeFacilities = allFacilities.filter(f => f.is_active);
  const removedFacilities = allFacilities.filter(f => !f.is_active);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentInvoice = maintenanceInvoices.find(inv => Number(inv.month) === currentMonth && Number(inv.year) === currentYear) || null;

  const formatDate = (d) => { try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); } catch { return d; } };

  const handleComplaintSubmit = async (e) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!complaintForm.title.trim() || !complaintForm.description.trim()) { setComplaintsError("Title and description are required."); return; }
    try { setComplaintSubmitting(true); setComplaintsError(""); await submitComplaint({ ...complaintForm, resident_id: user.id }); setComplaintForm({ title: "", description: "", category: "General", priority: "Medium" }); await loadComplaints(); } catch (err) { setComplaintsError(err?.response?.data?.message || "Failed to submit complaint."); } finally { setComplaintSubmitting(false); }
  };

  const handleVisitorDecision = async (gateLogId, status) => {
    try {
      // ✅ FIX: Send lowercase — backend's normalizedStatus = status.toLowerCase()
      await decideVisitor(gateLogId, { status: status.toLowerCase(), approved_by: user.id });
      setPendingVisitors(prev => prev.filter(v => v.gate_log_id !== gateLogId));
    } catch (err) {
      console.error("❌ Visitor decision error:", err?.response?.data);
      alert("Failed to update visitor status: " + (err?.response?.data?.message || err.message));
    }
  };

  const handleBookFacility = (facility) => { setBookingModal(facility); };
  const handleBookingSuccess = () => { loadFacilitiesAndBookings(); setBookingModal(null); };

  const handlePayNow = (booking) => {
    const fid = booking.facility_id || booking.facilityId || booking.facility?.id;
    const matchedFac = allFacilities.find(f =>
      (fid && String(f.id) === String(fid)) ||
      (booking.facility_name && f.name?.toLowerCase() === booking.facility_name?.toLowerCase())
    );
    const adminFee = matchedFac ? parseFloat(matchedFac.booking_fee || 0) : 0;
    const resolvedAmount = adminFee > 0 ? adminFee : parseFloat(booking.total_amount || booking.booking_fee || booking.amount || 0);
    const facility = matchedFac || { name: booking.facility_name, booking_fee: resolvedAmount };
    setPaymentModal({ booking: { ...booking, total_amount: resolvedAmount }, facility });
  };

  const tabIcons = { Overview: "⚡", Complaints: "📋", Visitors: "🔔", Facilities: "🏢", Notices: "📢", Events: "🎉", Maintenance: "💰" };
  const tabBadges = { Visitors: pendingVisitors.length, Complaints: complaints.filter(c => c.status?.toLowerCase() === "open").length };

  const statusColor = (s) => {
    const l = (s || "").toLowerCase();
    if (l === "resolved" || l === "closed" || l === "approved" || l === "paid") return { bg: "#d1fae5", color: "#065f46" };
    if (l === "in progress" || l === "pending" || l === "unpaid") return { bg: "#fef3c7", color: "#92400e" };
    if (l === "rejected" || l === "overdue" || l === "cancelled") return { bg: "#fee2e2", color: "#991b1b" };
    return { bg: "#f1f5f9", color: "#475569" };
  };

  const StatusBadge = ({ status }) => {
    const s = statusColor(status);
    return <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: s.bg, color: s.color }}>{status || "Open"}</span>;
  };

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: "linear-gradient(135deg, #f0f4ff 0%, #fafbff 50%, #f0f7ff 100%)", minHeight: "100vh" }}>

      {bookingModal && <BookingModal facility={bookingModal} userId={user?.id} onClose={() => setBookingModal(null)} onBooked={handleBookingSuccess} />}
      {paymentModal && (
        <PaymentModal
          booking={paymentModal.booking}
          facility={paymentModal.facility}
          onClose={() => setPaymentModal(null)}
          onPaymentComplete={(bookingId) => {
            // Immediately update local state so Pay Now disappears without waiting for API reload
            setBookings(prev => prev.map(bk =>
              String(bk.id) === String(bookingId)
                ? { ...bk, payment_status: "paid" }
                : bk
            ));
          }}
          onSuccess={() => { setPaymentModal(null); }}
        />
      )}

      {/* ── Top Nav ── */}
      <div style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(99,102,241,0.1)", position: "sticky", top: 0, zIndex: 50, padding: "0 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏢</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1e1b4b", letterSpacing: "-0.3px" }}>SmartSociety</div>
              <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Resident Portal</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 2, background: "#f1f5f9", borderRadius: 12, padding: 4 }}>
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ position: "relative", padding: "6px 14px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.2s", background: activeTab === tab ? "white" : "transparent", color: activeTab === tab ? "#6366f1" : "#64748b", boxShadow: activeTab === tab ? "0 1px 8px rgba(99,102,241,0.15)" : "none" }}>
                <span style={{ marginRight: 4 }}>{tabIcons[tab]}</span>{tab}
                {tabBadges[tab] > 0 && <span style={{ position: "absolute", top: 2, right: 2, background: "#ef4444", color: "white", borderRadius: "50%", width: 14, height: 14, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{tabBadges[tab]}</span>}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <NotificationBell />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1e1b4b" }}>{displayName}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{user?.email}</div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 14 }}>{displayName[0]?.toUpperCase()}</div>
            <button onClick={handleLogout} style={{ padding: "7px 16px", borderRadius: 9, border: "1.5px solid #fecaca", background: "white", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Logout</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px" }}>

        {activeTab === "Overview" && (
          <div>
            <div style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)", borderRadius: 20, padding: "32px 36px", marginBottom: 24, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
              <div style={{ position: "relative" }}>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 6, letterSpacing: "1px", textTransform: "uppercase" }}>Good day 👋</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: "white", letterSpacing: "-0.5px", marginBottom: 8 }}>Welcome, {displayName}!</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.75)" }}>Manage your home, track complaints, book amenities — all in one place.</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Total Complaints", value: complaints.length, icon: "📋", color: "#6366f1", bg: "#eef2ff" },
                { label: "Pending Visitors", value: pendingVisitors.length, icon: "🔔", color: "#f59e0b", bg: "#fffbeb" },
                { label: "My Bookings", value: bookings.length, icon: "🏢", color: "#10b981", bg: "#ecfdf5" },
                { label: "This Month Bill", value: currentInvoice ? `₹${Number(currentInvoice.amount).toLocaleString("en-IN")}` : "--", icon: "💰", color: "#8b5cf6", bg: "#f5f3ff" },
              ].map(stat => (
                <div key={stat.label} style={{ background: "white", borderRadius: 16, padding: "20px 22px", boxShadow: "0 1px 12px rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.04)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6, fontWeight: 500 }}>{stat.label}</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                    </div>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: stat.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{stat.icon}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: "white", borderRadius: 16, padding: "22px 24px", marginBottom: 24, boxShadow: "0 1px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.5px" }}>Quick Actions</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                  { label: "Raise Complaint", tab: "Complaints", color: "#6366f1", bg: "#eef2ff" },
                  { label: "Book Facility", tab: "Facilities", color: "#10b981", bg: "#ecfdf5" },
                  { label: "View Notices", tab: "Notices", color: "#f59e0b", bg: "#fffbeb" },
                  { label: "Check Events", tab: "Events", color: "#06b6d4", bg: "#ecfeff" },
                  { label: "Pay Maintenance", tab: "Maintenance", color: "#8b5cf6", bg: "#f5f3ff" },
                  { label: "Visitor Approvals", tab: "Visitors", color: "#ef4444", bg: "#fef2f2" },
                ].map(a => (
                  <button key={a.label} onClick={() => setActiveTab(a.tab)} style={{ padding: "10px 18px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: a.color, background: a.bg }}>{a.label}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: "white", borderRadius: 16, padding: "22px 24px", boxShadow: "0 1px 12px rgba(0,0,0,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1e1b4b" }}>📢 Latest Notices</div>
                  <button onClick={() => setActiveTab("Notices")} style={{ fontSize: 11, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>View all →</button>
                </div>
                {noticesLoading ? <p style={{ fontSize: 12, color: "#94a3b8" }}>Loading...</p> : notices.length === 0 ? <p style={{ fontSize: 12, color: "#94a3b8" }}>No notices yet.</p> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {notices.slice(0, 3).map(n => (
                      <div key={n.id} style={{ padding: "10px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 2 }}>{n.title}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{n.message?.slice(0, 70)}{n.message?.length > 70 ? "..." : ""}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ background: "white", borderRadius: 16, padding: "22px 24px", boxShadow: "0 1px 12px rgba(0,0,0,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1e1b4b" }}>🎉 Upcoming Events</div>
                  <button onClick={() => setActiveTab("Events")} style={{ fontSize: 11, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>View all →</button>
                </div>
                {eventsLoading ? <p style={{ fontSize: 12, color: "#94a3b8" }}>Loading...</p> : events.length === 0 ? <p style={{ fontSize: 12, color: "#94a3b8" }}>No upcoming events.</p> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {events.slice(0, 3).map(ev => (
                      <div key={ev.id} style={{ padding: "10px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 2 }}>{ev.title}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>📅 {ev.event_date}{ev.location ? ` • 📍 ${ev.location}` : ""}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "Complaints" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ background: "white", borderRadius: 16, padding: "24px", boxShadow: "0 1px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1e1b4b", marginBottom: 4 }}>📋 Raise a Complaint</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 20 }}>Submit a new issue for resolution</div>
              {complaintsError && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 14px", borderRadius: 10, fontSize: 12, marginBottom: 16 }}>{complaintsError}</div>}
              <form onSubmit={handleComplaintSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Title</label><input type="text" value={complaintForm.title} onChange={e => setComplaintForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Water leakage in bathroom" required style={inputStyle} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Description</label><textarea value={complaintForm.description} onChange={e => setComplaintForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Describe your issue in detail..." required style={{ ...inputStyle, resize: "vertical" }} /></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div><label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Category</label><select value={complaintForm.category} onChange={e => setComplaintForm(p => ({ ...p, category: e.target.value }))} style={inputStyle}>{["General", "Plumbing", "Electrical", "Security", "Maintenance"].map(c => <option key={c}>{c}</option>)}</select></div>
                  <div><label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Priority</label><select value={complaintForm.priority} onChange={e => setComplaintForm(p => ({ ...p, priority: e.target.value }))} style={inputStyle}>{["Low", "Medium", "High"].map(c => <option key={c}>{c}</option>)}</select></div>
                </div>
                <button type="submit" disabled={complaintSubmitting} style={{ padding: "12px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: complaintSubmitting ? 0.7 : 1 }}>{complaintSubmitting ? "Submitting..." : "Submit Complaint"}</button>
              </form>
            </div>
            <div style={{ background: "white", borderRadius: 16, padding: "24px", boxShadow: "0 1px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1e1b4b" }}>My Complaints</div>
                <button onClick={loadComplaints} style={{ fontSize: 11, color: "#6366f1", background: "#eef2ff", border: "none", cursor: "pointer", fontWeight: 600, padding: "5px 12px", borderRadius: 8 }}>Refresh</button>
              </div>
              {complaintsLoading ? <p style={{ fontSize: 12, color: "#94a3b8" }}>Loading...</p> : complaints.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px" }}><div style={{ fontSize: 40, marginBottom: 10 }}>📭</div><div style={{ fontSize: 13, color: "#94a3b8" }}>No complaints raised yet</div></div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 420, overflowY: "auto" }}>
                  {complaints.map(c => (
                    <div key={c.id} style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid #f1f5f9", background: "#fafbff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{c.title}</div>
                        <StatusBadge status={c.status || "Open"} />
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{c.description?.slice(0, 90)}{c.description?.length > 90 ? "..." : ""}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>{c.category} • {c.priority} priority</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "Visitors" && (
          <div style={{ background: "white", borderRadius: 16, padding: "24px", boxShadow: "0 1px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1e1b4b" }}>🔔 Pending Visitor Approvals</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Approve or reject visitors waiting at the gate</div>
              </div>
              <button onClick={loadPendingVisitors} style={{ fontSize: 11, color: "#6366f1", background: "#eef2ff", border: "none", cursor: "pointer", fontWeight: 600, padding: "7px 14px", borderRadius: 9 }}>Refresh</button>
            </div>
            {visitorLoading ? <p style={{ fontSize: 12, color: "#94a3b8" }}>Loading visitors...</p> : visitorError ? <p style={{ fontSize: 12, color: "#ef4444" }}>{visitorError}</p> : pendingVisitors.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🚪</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 4 }}>No pending visitors</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>You'll be notified when someone arrives</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
                {pendingVisitors.map(v => (
                  <div key={v.gate_log_id} style={{ padding: "18px 20px", borderRadius: 14, border: "1.5px solid #e0e7ff", background: "linear-gradient(135deg, #fafbff, #f0f4ff)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 16 }}>{v.name?.[0]?.toUpperCase()}</div>
                      <div><div style={{ fontSize: 14, fontWeight: 700, color: "#1e1b4b" }}>{v.name}</div><div style={{ fontSize: 11, color: "#64748b" }}>{v.purpose || v.email || "Visitor"}</div></div>
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 14 }}>🕐 Entry: {new Date(v.entry_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}{v.phone && <span> • 📞 {v.phone}</span>}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleVisitorDecision(v.gate_log_id, "APPROVED")} style={{ flex: 1, padding: "9px", borderRadius: 9, border: "none", background: "linear-gradient(135deg, #10b981, #059669)", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✓ Approve</button>
                      <button onClick={() => handleVisitorDecision(v.gate_log_id, "REJECTED")} style={{ flex: 1, padding: "9px", borderRadius: 9, border: "none", background: "linear-gradient(135deg, #ef4444, #dc2626)", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✕ Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "Facilities" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1e1b4b" }}>🏢 Society Facilities</div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>Browse and book available amenities</div>
              </div>
              <button onClick={loadFacilitiesAndBookings} style={{ fontSize: 12, color: "#6366f1", background: "#eef2ff", border: "none", cursor: "pointer", fontWeight: 600, padding: "8px 16px", borderRadius: 10 }}>↺ Refresh</button>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                { label: "Available", value: activeFacilities.length, color: "#10b981", bg: "#ecfdf5" },
                { label: "Unavailable", value: removedFacilities.length, color: "#ef4444", bg: "#fef2f2" },
                { label: "My Bookings", value: bookings.length, color: "#6366f1", bg: "#eef2ff" },
                { label: "Pending Payment", value: bookings.filter(b => { const bf = allFacilities.find(f => String(f.id) === String(b.facility_id || b.facilityId) || f.name?.toLowerCase() === b.facility_name?.toLowerCase()); const fee = bf ? parseFloat(bf.booking_fee||0) : parseFloat(b.total_amount||0); return (b.status||"").toLowerCase() === "approved" && (b.payment_status||"").toLowerCase() !== "paid" && fee > 0; }).length, color: "#d97706", bg: "#fffbeb" },
              ].map(s => (
                <div key={s.label} style={{ padding: "12px 18px", borderRadius: 12, background: s.bg, display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</span>
                  <span style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 12, padding: 4, width: "fit-content", marginBottom: 22 }}>
              {[
                { key: "available", label: `✅ Available (${activeFacilities.length})` },
                { key: "removed", label: `🚫 Unavailable (${removedFacilities.length})` },
                { key: "mybookings", label: `📅 My Bookings (${bookings.length})` },
              ].map(t => (
                <button key={t.key} onClick={() => setFacilityTab(t.key)} style={{ padding: "8px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: facilityTab === t.key ? "white" : "transparent", color: facilityTab === t.key ? "#6366f1" : "#64748b", boxShadow: facilityTab === t.key ? "0 1px 8px rgba(99,102,241,0.15)" : "none", transition: "all 0.15s" }}>{t.label}</button>
              ))}
            </div>

            {facilityError && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "12px 16px", borderRadius: 12, fontSize: 13, marginBottom: 18 }}>{facilityError}</div>}
            {facilityLoading && <div style={{ textAlign: "center", padding: "60px" }}><div style={{ fontSize: 14, color: "#94a3b8" }}>Loading facilities...</div></div>}

            {!facilityLoading && facilityTab === "available" && (
              activeFacilities.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px", background: "white", borderRadius: 16 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🏗️</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>No facilities available right now</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                  {activeFacilities.map(f => <FacilityCard key={f.id} facility={f} onBook={handleBookFacility} isRemoved={false} />)}
                </div>
              )
            )}

            {!facilityLoading && facilityTab === "removed" && (
              removedFacilities.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px", background: "white", borderRadius: 16 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>All facilities are currently active</div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 18px", background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 14, marginBottom: 18 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>⚠️</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>These facilities are temporarily unavailable</div>
                      <div style={{ fontSize: 12, color: "#a16207", marginTop: 2 }}>Disabled by admin. Cannot be booked until restored.</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                    {removedFacilities.map(f => <FacilityCard key={f.id} facility={f} onBook={() => {}} isRemoved={true} />)}
                  </div>
                </>
              )
            )}

            {!facilityLoading && facilityTab === "mybookings" && (
              bookings.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px", background: "white", borderRadius: 16 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 4 }}>No bookings yet</div>
                  <button onClick={() => setFacilityTab("available")} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>Browse Facilities →</button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {bookings.map(b => {
                    const fid = b.facility_id || b.facilityId || b.facility?.id;
                    const matchedFacility = allFacilities.find(f =>
                      (fid && String(f.id) === String(fid)) ||
                      (b.facility_name && f.name?.toLowerCase() === b.facility_name?.toLowerCase())
                    );
                    const adminFee = matchedFacility ? parseFloat(matchedFacility.booking_fee || 0) : 0;
                    const fee = adminFee > 0 ? adminFee : parseFloat(b.total_amount || b.booking_fee || b.amount || 0);
                    const bookingStatus = (b.status || "").toLowerCase();
                    const payStatus = (b.payment_status || "").toLowerCase();
                    const isPendingPayment = bookingStatus === "approved" && payStatus !== "paid" && fee > 0;
                    const displayFee = fee;
                    const payStatusStyles = statusColor(payStatus === "paid" ? "paid" : "unpaid");
                    return (
                      <div key={b.id} style={{ background: "white", borderRadius: 16, padding: "18px 22px", boxShadow: "0 1px 12px rgba(0,0,0,0.06)", border: isPendingPayment ? "1.5px solid #fde68a" : "1px solid #f1f5f9" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "#1e1b4b", marginBottom: 4 }}>{b.facility_name || "Facility"}</div>
                            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>📅 {b.booking_date}{b.start_time ? ` • 🕐 ${fmtSlot(b.start_time, b.end_time)}` : ""}</div>
                            {b.facility_location && <div style={{ fontSize: 11, color: "#94a3b8" }}>📍 {b.facility_location}</div>}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                            <StatusBadge status={b.status || "Pending"} />
                            {displayFee > 0 && (
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: payStatusStyles.bg, color: payStatusStyles.color }}>
                                {payStatus === "paid" ? "✓ Paid" : "⚠ Unpaid"} — ₹{displayFee.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                        {isPendingPayment && (
                          <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12 }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>💳 Payment Pending</div>
                              <div style={{ fontSize: 11, color: "#a16207" }}>Your booking is approved! Complete payment to confirm.</div>
                            </div>
                            <button onClick={() => handlePayNow({ ...b, total_amount: displayFee, _resolvedFee: displayFee })} style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                              Pay Now →
                            </button>
                          </div>
                        )}
                        {payStatus === "paid" && displayFee > 0 && (
                          <div style={{ marginTop: 10 }}>
                            <button onClick={() => {
                              const receiptDate = b.payment_date
                                ? new Date(b.payment_date).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                                : new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
                              const w = window.open("", "_blank", "width=480,height=680");
                              w.document.write(`<html><head><title>Payment Receipt</title>
                                <style>
                                  body{font-family:'Segoe UI',sans-serif;margin:0;padding:24px;background:#fff;color:#1e1b4b}
                                  .header{text-align:center;border-bottom:2px dashed #c7d2fe;padding-bottom:16px;margin-bottom:16px}
                                  .society{font-size:18px;font-weight:800;color:#312e81}
                                  .subtitle{font-size:11px;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;margin-top:2px}
                                  .badge{display:inline-block;margin:10px auto 0;background:#d1fae5;color:#065f46;padding:3px 14px;border-radius:20px;font-size:11px;font-weight:700}
                                  .amount-box{text-align:center;margin:16px 0}
                                  .amount-label{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px}
                                  .amount-value{font-size:32px;font-weight:800;color:#312e81;margin-top:2px}
                                  .receipt-box{background:#f8faff;border:1.5px solid #e0e7ff;border-radius:10px;padding:14px;margin-bottom:14px}
                                  .row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:12px}
                                  .row:last-child{border-bottom:none}
                                  .label{color:#64748b}
                                  .value{font-weight:700;color:#1e1b4b;text-align:right;max-width:55%}
                                  .footer{text-align:center;font-size:10px;color:#94a3b8;border-top:1px dashed #e2e8f0;padding-top:12px;margin-top:12px}
                                  .btn{padding:8px 24px;background:#6366f1;color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}
                                  @media print{.btn{display:none}body{padding:12px}}
                                </style>
                              </head><body>
                                <div class="header">
                                  <div class="society">🏢 SmartSociety</div>
                                  <div class="subtitle">Facility Booking Receipt</div>
                                  <div class="badge">✓ Payment Confirmed</div>
                                </div>
                                <div class="amount-box">
                                  <div class="amount-label">Amount Paid</div>
                                  <div class="amount-value">₹${displayFee.toFixed(2)}</div>
                                </div>
                                <div class="receipt-box">
                                  <div class="row"><span class="label">Facility</span><span class="value">${b.facility_name || "—"}</span></div>
                                  <div class="row"><span class="label">Booking Date</span><span class="value">${b.booking_date || "—"}</span></div>
                                  <div class="row"><span class="label">Time Slot</span><span class="value">${fmtSlot(b.start_time, b.end_time)}</span></div>
                                  <div class="row"><span class="label">Booking ID</span><span class="value">#${b.id}</span></div>
                                  <div class="row"><span class="label">Location</span><span class="value">${b.facility_location || "—"}</span></div>
                                  <div class="row"><span class="label">Payment Date</span><span class="value">${receiptDate}</span></div>
                                  <div class="row"><span class="label">Status</span><span class="value">✓ Paid</span></div>
                                </div>
                                <div class="footer">Computer-generated receipt • SmartSociety ${new Date().getFullYear()}</div>
                                <br/><div style="text-align:center">
                                  <button class="btn" onclick="window.print()">🖨 Print / Save as PDF</button>
                                </div>
                              </body></html>`);
                              w.document.close();
                            }} style={{ width: "100%", padding: "8px", borderRadius: 10, border: "1.5px solid #c7d2fe", background: "#eef2ff", color: "#4338ca", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                              🧾 Download / Print Receipt
                            </button>
                          </div>
                        )}
                        {bookingStatus === "pending" && (
                          <div style={{ marginTop: 10, fontSize: 11, color: "#7c3aed", background: "#f5f3ff", padding: "8px 12px", borderRadius: 9 }}>
                            ⏳ Awaiting admin approval. You'll be notified once confirmed.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        )}

        {activeTab === "Notices" && (
          <div style={{ background: "white", borderRadius: 16, padding: "24px", boxShadow: "0 1px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1e1b4b", marginBottom: 20 }}>📢 Society Notices</div>
            {noticesLoading ? <p style={{ fontSize: 12, color: "#94a3b8" }}>Loading...</p> : notices.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px" }}><div style={{ fontSize: 48, marginBottom: 12 }}>📭</div><div style={{ fontSize: 14, color: "#94a3b8" }}>No notices available</div></div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
                {notices.map(n => (
                  <div key={n.id} style={{ padding: "18px 20px", borderRadius: 14, border: "1px solid #f1f5f9", background: n.priority === "High" ? "linear-gradient(135deg, #fef2f2, #fff)" : "linear-gradient(135deg, #f8faff, #fff)", borderLeft: `4px solid ${n.priority === "High" ? "#ef4444" : n.priority === "Medium" ? "#f59e0b" : "#6366f1"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1e1b4b" }}>{n.title}</div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: n.priority === "High" ? "#fee2e2" : n.priority === "Medium" ? "#fef3c7" : "#e0e7ff", color: n.priority === "High" ? "#991b1b" : n.priority === "Medium" ? "#92400e" : "#3730a3" }}>{n.priority || "Low"}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>{n.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "Events" && (
          <div style={{ background: "white", borderRadius: 16, padding: "24px", boxShadow: "0 1px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1e1b4b", marginBottom: 20 }}>🎉 Upcoming Events</div>
            {eventsLoading ? <p style={{ fontSize: 12, color: "#94a3b8" }}>Loading...</p> : events.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px" }}><div style={{ fontSize: 48, marginBottom: 12 }}>🗓️</div><div style={{ fontSize: 14, color: "#94a3b8" }}>No upcoming events</div></div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
                {events.map(ev => (
                  <div key={ev.id} style={{ padding: "20px", borderRadius: 14, background: "linear-gradient(135deg, #f5f3ff, #faf5ff)", border: "1px solid #e9d5ff" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1e1b4b", marginBottom: 8 }}>{ev.title}</div>
                    {ev.description && <div style={{ fontSize: 12, color: "#475569", marginBottom: 10, lineHeight: 1.5 }}>{ev.description}</div>}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "#7c3aed", background: "#ede9fe", padding: "3px 10px", borderRadius: 20 }}>📅 {ev.event_date}</span>
                      {ev.start_time && <span style={{ fontSize: 11, color: "#7c3aed", background: "#ede9fe", padding: "3px 10px", borderRadius: 20 }}>🕐 {fmtSlot(ev.start_time, ev.end_time)}</span>}
                      {ev.location && <span style={{ fontSize: 11, color: "#7c3aed", background: "#ede9fe", padding: "3px 10px", borderRadius: 20 }}>📍 {ev.location}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "Maintenance" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ background: currentInvoice ? "linear-gradient(135deg, #1e1b4b, #312e81)" : "linear-gradient(135deg, #374151, #1f2937)", borderRadius: 16, padding: "24px 28px", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Current Month ({currentMonth}/{currentYear})</div>
                {currentInvoice ? (
                  <>
                    <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-1px" }}>₹{Number(currentInvoice.amount).toLocaleString("en-IN")}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 4 }}>Due: {formatDate(currentInvoice.due_date)}</div>
                    <span style={{ display: "inline-block", marginTop: 8, padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: currentInvoice.status?.toLowerCase() === "paid" ? "#d1fae5" : currentInvoice.status?.toLowerCase() === "overdue" ? "#fee2e2" : "#fef3c7", color: currentInvoice.status?.toLowerCase() === "paid" ? "#065f46" : currentInvoice.status?.toLowerCase() === "overdue" ? "#991b1b" : "#92400e" }}>{currentInvoice.status}</span>
                  </>
                ) : mLoading ? (
                  <div style={{ fontSize: 18, color: "rgba(255,255,255,0.5)" }}>Loading...</div>
                ) : (
                  <div style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", marginTop: 6 }}>No bill generated for this month yet</div>
                )}
              </div>
              <div style={{ fontSize: 64, opacity: 0.2 }}>💰</div>
            </div>
            <div style={{ background: "white", borderRadius: 16, padding: "24px", boxShadow: "0 1px 12px rgba(0,0,0,0.06)" }}>
              <ResidentPayments />
            </div>
            <div style={{ background: "white", borderRadius: 16, padding: "24px", boxShadow: "0 1px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1e1b4b", marginBottom: 16 }}>Payment History</div>
              {mLoading ? <p style={{ fontSize: 12, color: "#94a3b8" }}>Loading...</p> : maintenanceInvoices.length === 0 ? (
                <p style={{ fontSize: 12, color: "#94a3b8" }}>No invoices yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {maintenanceInvoices.map(inv => (
                    <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderRadius: 12, border: "1px solid #f1f5f9", background: "#fafbff" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{inv.month}/{inv.year} • ₹{Number(inv.amount).toLocaleString("en-IN")}</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Due: {formatDate(inv.due_date)}{inv.paid_on ? ` • Paid: ${formatDate(inv.paid_on)}` : ""}</div>
                      </div>
                      <StatusBadge status={inv.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ResidentDashboard;