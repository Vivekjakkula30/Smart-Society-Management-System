// client/src/pages/AdminDashboard.js
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, logout } from "../utils/auth";
import AdminPaymentsSection from "../components/AdminPaymentsSection";
import api from "../services/api";
import NotificationBell from "../components/NotificationBell";

import { fetchAllComplaints, updateComplaintStatus } from "../services/complaintService";
import { getNotices, createNotice, updateNotice, deleteNotice } from "../services/noticeService";
import { fetchEvents, createEvent, updateEvent, deleteEvent } from "../services/eventService";
import { fetchAllFacilityBookings, updateFacilityBookingStatus } from "../services/facilityService";
import { fetchAllMaintenance, generateMaintenanceInvoice, markInvoicePaid } from "../services/maintenanceService";
import { fetchAllResidents, deactivateResident, activateResident } from "../services/residentService";
import { fetchAllPayments } from "../services/paymentService";

// ─── Convert 24-hour "HH:MM" → 12-hour "H:MM AM/PM" ──────────────────────────
const to12hr = (t) => {
  if (!t) return "—";
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
};
const fmtSlot = (start, end) =>
  start ? `${to12hr(start)}${end ? " – " + to12hr(end) : ""}` : "—";

const STATUS_OPTIONS = ["open", "in progress", "resolved", "closed"];
const BOOKING_STATUS_OPTIONS = ["pending", "approved", "rejected", "cancelled"];

const PANELS = {
  OVERVIEW: "overview",
  COMPLAINTS: "complaints",
  NOTICES: "notices",
  EVENTS: "events",
  FACILITIES: "facilities",
  MAINTENANCE: "maintenance",
  RESIDENTS: "residents",
  PAYMENTS: "payments",
};

const isValidMonth = (value) => {
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12;
};
const isValidYear = (value) => {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100;
};

const parseTimeToMinutes = (t) => {
  if (!t) return null;
  const match24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const h = parseInt(match24[1], 10), m = parseInt(match24[2], 10);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return h * 60 + m;
  }
  const match12 = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return h * 60 + m;
  }
  return null;
};
const isValidTimeFormat = (t) => parseTimeToMinutes(t) !== null;

const validateEventForm = (ev) => {
  const errors = {};
  const title = (ev.title || "").trim();
  const description = (ev.description || "").trim();
  const location = (ev.location || "").trim();
  const startTime = (ev.start_time || "").trim();
  const endTime = (ev.end_time || "").trim();
  if (!title) errors.title = "Event title is required.";
  else if (title.length < 3) errors.title = "Title must be at least 3 characters.";
  else if (title.length > 120) errors.title = "Title cannot exceed 120 characters.";
  if (!ev.event_date) errors.event_date = "Event date is required.";
  if (description.length > 500) errors.description = "Description cannot exceed 500 characters.";
  if (location.length > 120) errors.location = "Location cannot exceed 120 characters.";
  if (startTime && !isValidTimeFormat(startTime)) errors.start_time = "Use format HH:MM (e.g. 09:00) or H:MM AM/PM.";
  if (endTime && !isValidTimeFormat(endTime)) errors.end_time = "Use format HH:MM (e.g. 18:00) or H:MM AM/PM.";
  if (startTime && endTime && !errors.start_time && !errors.end_time) {
    if (parseTimeToMinutes(endTime) <= parseTimeToMinutes(startTime)) errors.end_time = "End time must be after start time.";
  }
  if ((startTime && !endTime) || (!startTime && endTime)) {
    if (!errors.start_time && !errors.end_time) errors.end_time = "Please provide both start and end time.";
  }
  return errors;
};

const validateNoticeForm = (notice) => {
  const errors = {};
  const title = (notice.title || "").trim();
  const message = (notice.message || "").trim();
  if (!title) errors.title = "Title is required.";
  else if (title.length < 3) errors.title = "Title must be at least 3 characters.";
  else if (title.length > 120) errors.title = "Title cannot exceed 120 characters.";
  if (!message) errors.message = "Message is required.";
  else if (message.length < 5) errors.message = "Message must be at least 5 characters.";
  else if (message.length > 2000) errors.message = "Message cannot exceed 2000 characters.";
  if (notice.audience === "specific_resident" && (!notice.specific_resident_ids || notice.specific_resident_ids.length === 0))
    errors.specific_resident_ids = "Please select at least one resident.";
  const validTill = (notice.valid_till || "").trim();
  if (validTill && Number.isNaN(new Date(validTill).getTime())) errors.valid_till = "Please select a valid expiry date.";
  return errors;
};

const validateMaintenanceForm = (form) => {
  const errors = {};
  if (!form.month) errors.month = "Month is required.";
  else if (!isValidMonth(form.month)) errors.month = "Month must be between 1 and 12.";
  if (!form.year) errors.year = "Year is required.";
  else if (!isValidYear(form.year)) errors.year = "Year must be between 2000 and 2100.";
  if (!form.amount) errors.amount = "Amount is required.";
  else if (isNaN(Number(form.amount)) || Number(form.amount) <= 0) errors.amount = "Amount must be greater than 0.";
  if (!form.due_date) errors.due_date = "Due date is required.";
  return errors;
};

// ─── Shared field class helper ─────────────────────────────────────────────────
const fieldClass = (hasError) =>
  `w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${hasError ? "border-red-400 bg-red-50" : "border-slate-200"}`;

// ─── Nav items ─────────────────────────────────────────────────────────────────
const navItems = [
  { id: PANELS.OVERVIEW,    label: "Overview",     },
  { id: PANELS.COMPLAINTS,  label: "Complaints",   },
  { id: PANELS.NOTICES,     label: "Notices",      },
  { id: PANELS.EVENTS,      label: "Events",       },
  { id: PANELS.FACILITIES,  label: "Facilities",   },
  { id: PANELS.MAINTENANCE, label: "Maintenance",  },
  { id: PANELS.RESIDENTS,   label: "Residents",    },
  { id: PANELS.PAYMENTS,    label: "Payments",     },
];

const AdminDashboard = () => {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [activePanel, setActivePanel] = useState(PANELS.OVERVIEW);
  const [recentActivity, setRecentActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => { if (!user) navigate("/login"); }, [user, navigate]);
  const displayName = user?.name || user?.fullName || user?.email || "Admin";

  // Complaints
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [updateMessage, setUpdateMessage] = useState("");
  const [updateError, setUpdateError] = useState("");
  const [complaintFilter, setComplaintFilter] = useState("all");
  const [complaintSearch, setComplaintSearch] = useState("");
  const [expandedComplaint, setExpandedComplaint] = useState(null);
  const [complaintView, setComplaintView] = useState("table");

  // Notices
  const [notices, setNotices] = useState([]);
  const [noticesLoading, setNoticesLoading] = useState(false);
  const [noticesError, setNoticesError] = useState("");
  const [noticeFormErrors, setNoticeFormErrors] = useState({});
  const [noticeTouched, setNoticeTouched] = useState({});
  const [noticeTab, setNoticeTab] = useState("current");
  const [newNotice, setNewNotice] = useState({ title: "", message: "", audience: "all", specific_resident_ids: [], priority: "Low", valid_till: "" });
  const [noticeSubmitting, setNoticeSubmitting] = useState(false);
  const [editingNoticeId, setEditingNoticeId] = useState(null);
  const [residentSearch, setResidentSearch] = useState("");
  const noticeFormRef = useRef(null);

  // Events
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [eventFieldErrors, setEventFieldErrors] = useState({});
  const [eventTouched, setEventTouched] = useState({});
  const [newEvent, setNewEvent] = useState({ title: "", description: "", location: "", event_date: "", start_time: "", end_time: "" });
  const [eventSubmitting, setEventSubmitting] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [eventTab, setEventTab] = useState("upcoming");
  const eventsFormRef = useRef(null);

  // Facility bookings
  const [facilityBookings, setFacilityBookings] = useState([]);
  const [fbLoading, setFbLoading] = useState(false);
  const [fbError, setFbError] = useState("");
  const [fbUpdatingId, setFbUpdatingId] = useState(null);
  const [fbUpdateMessage, setFbUpdateMessage] = useState("");
  const [fbUpdateError, setFbUpdateError] = useState("");

  // Facilities management
  const [allFacilities, setAllFacilities] = useState([]);
  const [facilitiesTab, setFacilitiesTab] = useState("bookings");
  const [facilityFormData, setFacilityFormData] = useState({ name: "", description: "", location: "", capacity: "", available_from: "", available_to: "", booking_fee: "" });
  const [editingFacilityId, setEditingFacilityId] = useState(null);
  const [facilityFormError, setFacilityFormError] = useState("");
  const [facilityFormMessage, setFacilityFormMessage] = useState("");
  const [facilitySubmitting, setFacilitySubmitting] = useState(false);
  const [facilityReport, setFacilityReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [payingId, setPayingId] = useState(null);

  // Maintenance
  const [maintenanceInvoices, setMaintenanceInvoices] = useState([]);
  const [mFilters, setMFilters] = useState({ month: "", year: "", status: "" });
  const [mLoading, setMLoading] = useState(false);
  const [mError, setMError] = useState("");
  const [mMessage, setMMessage] = useState("");
  const [mForm, setMForm] = useState({ resident_id: "", month: "", year: "", amount: "", due_date: "", notes: "" });
  const [mFormErrors, setMFormErrors] = useState({});
  const [mFormTouched, setMFormTouched] = useState({});
  const [mSubmitting, setMSubmitting] = useState(false);

  // Residents
  const [residents, setResidents] = useState([]);
  const [residentsLoading, setResidentsLoading] = useState(false);
  const [residentsError, setResidentsError] = useState("");
  const [residentsMessage, setResidentsMessage] = useState("");
  const [residentsTab, setResidentsTab] = useState("active");
  const [residentSearchQuery, setResidentSearchQuery] = useState("");
  const [removingResidentId, setRemovingResidentId] = useState(null);

  // Payments
  const [paymentsOverview, setPaymentsOverview] = useState([]);
  const [paymentsOverviewLoading, setPaymentsOverviewLoading] = useState(false);
  const [paymentTotals, setPaymentTotals] = useState({ completed: 0, pending: 0, failed: 0 });
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [paymentsKey, setPaymentsKey] = useState(0);

  // ─── Loaders ───────────────────────────────────────────────────────────────
  const loadRecentActivity = async () => {
    try {
      setActivityLoading(true);
      const res = await api.get("/dashboard/recent-activity");
      setRecentActivity(Array.isArray(res.data) ? res.data : []);
    } catch (err) { console.error("Error loading recent activity:", err); }
    finally { setActivityLoading(false); }
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  const loadComplaints = async () => {
    try {
      setLoading(true); setLoadError("");
      const data = await fetchAllComplaints();
      const list = Array.isArray(data) ? data : data.complaints || [];
      setComplaints(list.map((c) => {
        const isResolved = ["resolved", "closed"].includes((c.status || "").toLowerCase());
        return { ...c, resolved_at: c.resolved_at || (isResolved ? c.updated_at || null : null) };
      }));
    } catch (err) { setLoadError(err?.response?.data?.message || "Failed to load complaints."); }
    finally { setLoading(false); }
  };

  const loadNotices = async () => {
    try {
      setNoticesLoading(true); setNoticesError("");
      const data = await getNotices("admins");
      setNotices(Array.isArray(data) ? data : data.notices || []);
    } catch (err) { setNoticesError(err?.response?.data?.message || "Failed to load notices."); }
    finally { setNoticesLoading(false); }
  };

  const loadEvents = async () => {
    try {
      setEventsLoading(true); setEventsError("");
      const data = await fetchEvents("all");
      setEvents(Array.isArray(data) ? data : data.events || []);
    } catch (err) { setEventsError(err?.response?.data?.message || "Failed to load events."); }
    finally { setEventsLoading(false); }
  };

  const loadFacilityBookings = async () => {
    try {
      setFbLoading(true); setFbError("");
      const data = await fetchAllFacilityBookings();
      setFacilityBookings(Array.isArray(data) ? data : data.bookings || []);
    } catch (err) { setFbError(err?.response?.data?.message || "Failed to load facility bookings."); }
    finally { setFbLoading(false); }
  };

  const loadAllFacilities = async () => {
    try {
      const res = await api.get("/facilities/all");
      setAllFacilities(Array.isArray(res.data) ? res.data : []);
    } catch (err) { console.error("Failed to load facilities", err); }
  };

  const loadFacilityReport = async () => {
    try {
      setReportLoading(true);
      const res = await api.get("/facility-bookings/reports");
      setFacilityReport(res.data);
    } catch (err) { console.error("Failed to load facility report", err); }
    finally { setReportLoading(false); }
  };

  const loadMaintenanceInvoices = async () => {
    const hasFilterMonth = String(mFilters.month || "").trim() !== "";
    const hasFilterYear = String(mFilters.year || "").trim() !== "";
    if (hasFilterMonth && !isValidMonth(mFilters.month)) { setMError("Filter month must be between 1 and 12."); return; }
    if (hasFilterYear && !isValidYear(mFilters.year)) { setMError("Filter year must be between 2000 and 2100."); return; }
    try {
      setMLoading(true); setMError(""); setMMessage("");
      const data = await fetchAllMaintenance(mFilters);
      setMaintenanceInvoices(Array.isArray(data) ? data : data.invoices || []);
    } catch (err) { setMError(err?.response?.data?.message || "Failed to load maintenance invoices."); }
    finally { setMLoading(false); }
  };

  const loadResidents = async () => {
    try {
      setResidentsLoading(true); setResidentsError("");
      let data;
      try { data = await fetchAllResidents(); }
      catch {
        try { const res = await api.get("/admin/residents"); data = res.data; }
        catch { const res = await api.get("/residents"); data = res.data; }
      }
      setResidents(Array.isArray(data) ? data : data.residents || []);
    } catch (err) { setResidentsError(err?.response?.data?.message || "Failed to load residents."); }
    finally { setResidentsLoading(false); }
  };

  const loadPaymentsOverview = async () => {
    try {
      setPaymentsOverviewLoading(true);
      const [paymentsData, invoicesData] = await Promise.all([fetchAllPayments(), fetchAllMaintenance({})]);
      const payments = Array.isArray(paymentsData) ? paymentsData : [];
      const invoices = Array.isArray(invoicesData) ? invoicesData : [];
      setPaymentsOverview(payments);
      const totals = { completed: 0, pending: 0, failed: 0 };
      const paidInvoices = invoices.filter(inv => inv.status === "paid");
      totals.completed = paidInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
      const pendingInvoices = invoices.filter(inv => inv.status === "unpaid" || inv.status === "overdue");
      totals.pending = pendingInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
      const failedPayments = payments.filter(p => (p.status || "").toLowerCase() === "failed");
      totals.failed = failedPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      setPaymentTotals(totals);
      setPendingCount(pendingInvoices.length);
      setFailedCount(failedPayments.length);
    } catch (err) { console.error("Failed to load payments overview:", err); }
    finally { setPaymentsOverviewLoading(false); }
  };

  useEffect(() => {
    loadComplaints(); loadNotices(); loadEvents();
    loadFacilityBookings(); loadAllFacilities(); loadFacilityReport();
    loadMaintenanceInvoices(); loadResidents(); loadRecentActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activePanel === PANELS.PAYMENTS) loadPaymentsOverview();
  }, [activePanel]);

  // ─── Derived ───────────────────────────────────────────────────────────────
  const openCount = complaints.filter((c) => (c.status || "").toLowerCase() === "open").length;
  const inProgressCount = complaints.filter((c) => (c.status || "").toLowerCase() === "in progress").length;
  const resolvedCount = complaints.filter((c) => ["resolved", "closed"].includes((c.status || "").toLowerCase())).length;
  const pendingBookings = facilityBookings.filter((b) => (b.status || "").toLowerCase() === "pending").length;

  const today = new Date(new Date().toDateString());
  const upcomingEvents = events.filter((e) => e.event_date && new Date(e.event_date) >= today);
  const pastEvents = events.filter((e) => e.event_date && new Date(e.event_date) < today);
  const displayedEvents = eventTab === "upcoming" ? upcomingEvents : pastEvents;

  const isNoticeExpired = (n) => n.valid_till && new Date(n.valid_till) < new Date();
  const currentNotices = notices.filter((n) => !isNoticeExpired(n));
  const previousNotices = notices.filter((n) => isNoticeExpired(n));
  const displayedNotices = noticeTab === "current" ? currentNotices : previousNotices;

  const activeResidentsList = residents.filter((r) => r.is_active);

  const filteredResidents = residents.filter(
    (r) =>
      (r.full_name || "").toLowerCase().includes(residentSearch.toLowerCase()) ||
      (r.flat_number || "").toLowerCase().includes(residentSearch.toLowerCase()) ||
      (r.block_name || "").toLowerCase().includes(residentSearch.toLowerCase())
  );
  const toggleResidentSelection = (residentId) => {
    setNewNotice((prev) => {
      const ids = prev.specific_resident_ids || [];
      return { ...prev, specific_resident_ids: ids.includes(residentId) ? ids.filter((id) => id !== residentId) : [...ids, residentId] };
    });
    setNoticeTouched((prev) => ({ ...prev, specific_resident_ids: true }));
  };
  const getSelectedResidentNames = () =>
    residents.filter((r) => (newNotice.specific_resident_ids || []).includes(r.resident_table_id)).map((r) => r.full_name || r.email).join(", ");

  // ─── Complaint handlers ───────────────────────────────────────────────────
  const handleStatusChange = async (complaintId, newStatus) => {
    if (!STATUS_OPTIONS.includes(newStatus)) { setUpdateError("Invalid status."); return; }
    try {
      setUpdatingId(complaintId); setUpdateError(""); setUpdateMessage("");
      const response = await updateComplaintStatus(complaintId, newStatus);
      const serverComplaint = response?.complaint || null;
      setUpdateMessage("Complaint status updated successfully");
      setComplaints((prev) => prev.map((c) => {
        if (c.id !== complaintId) return c;
        const isNowResolved = ["resolved", "closed"].includes(newStatus.toLowerCase());
        return { ...c, status: newStatus, resolved_at: serverComplaint?.resolved_at || (isNowResolved ? new Date().toISOString() : null) };
      }));
    } catch (err) { setUpdateError(err?.response?.data?.message || "Failed to update status."); }
    finally { setUpdatingId(null); }
  };

  const renderStatusBadge = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "resolved" || s === "closed") return <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px]">Resolved</span>;
    if (s === "in progress") return <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px]">In Progress</span>;
    return <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-[11px]">Open</span>;
  };

  // ─── Facility booking handlers ─────────────────────────────────────────────
  const isBookingLocked = (b) => {
    const s = (b.status || "").toLowerCase();
    return s === "approved" || s === "rejected" || s === "cancelled";
  };

  const handleBookingStatusChange = async (bookingId, newStatus) => {
    if (!BOOKING_STATUS_OPTIONS.includes(newStatus)) { setFbUpdateError("Invalid status."); return; }
    try {
      setFbUpdatingId(bookingId); setFbUpdateError(""); setFbUpdateMessage("");
      await updateFacilityBookingStatus(bookingId, newStatus);
      setFbUpdateMessage("Booking status updated successfully");
      setFacilityBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status: newStatus } : b));
    } catch (err) { setFbUpdateError(err?.response?.data?.message || "Failed to update booking status."); }
    finally { setFbUpdatingId(null); }
  };

  const handleMarkBookingPaid = async (bookingId) => {
    try {
      setPayingId(bookingId); setFbUpdateError(""); setFbUpdateMessage("");
      await api.put(`/facility-bookings/${bookingId}/mark-paid`);
      setFbUpdateMessage("Payment marked as received");
      setFacilityBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, payment_status: "paid", payment_date: new Date().toISOString() } : b));
    } catch (err) { setFbUpdateError(err?.response?.data?.message || "Failed to mark payment."); }
    finally { setPayingId(null); }
  };

  // ─── Facility handlers ─────────────────────────────────────────────────────
  const handleFacilityFormChange = (e) => { const { name, value } = e.target; setFacilityFormData((prev) => ({ ...prev, [name]: value })); };
  const resetFacilityForm = () => { setFacilityFormData({ name: "", description: "", location: "", capacity: "", available_from: "", available_to: "", booking_fee: "" }); setEditingFacilityId(null); setFacilityFormError(""); };
  const handleFacilitySubmit = async (e) => {
    e.preventDefault();
    if (!facilityFormData.name.trim()) { setFacilityFormError("Facility name is required."); return; }
    try {
      setFacilitySubmitting(true); setFacilityFormError(""); setFacilityFormMessage("");
      if (editingFacilityId) { await api.put(`/facilities/${editingFacilityId}`, facilityFormData); setFacilityFormMessage("Facility updated successfully"); }
      else { await api.post("/facilities", facilityFormData); setFacilityFormMessage("Facility created successfully"); }
      resetFacilityForm(); loadAllFacilities();
    } catch (err) { setFacilityFormError(err?.response?.data?.message || "Failed to save facility."); }
    finally { setFacilitySubmitting(false); }
  };
  const handleToggleFacility = async (id) => {
    try {
      setFacilityFormMessage(""); setFacilityFormError("");
      const res = await api.patch(`/facilities/${id}/toggle-active`);
      setFacilityFormMessage(res.data.message); loadAllFacilities();
    } catch (err) { setFacilityFormError(err?.response?.data?.message || "Failed to toggle facility."); }
  };
  const handleDeleteFacility = async (id) => {
    if (!window.confirm("Permanently delete this facility? This cannot be undone.")) return;
    try {
      setFacilityFormMessage(""); setFacilityFormError("");
      await api.delete(`/facilities/${id}`); setFacilityFormMessage("Facility deleted permanently"); loadAllFacilities();
    } catch (err) { setFacilityFormError(err?.response?.data?.message || "Failed to delete facility."); }
  };
  const handleEditFacility = (f) => {
    setFacilityFormData({ name: f.name || "", description: f.description || "", location: f.location || "", capacity: f.capacity || "", available_from: f.available_from || "", available_to: f.available_to || "", booking_fee: f.booking_fee || "" });
    setEditingFacilityId(f.id); setFacilityFormError(""); setFacilityFormMessage("");
  };

  // ─── Notice handlers ───────────────────────────────────────────────────────
  const handleNoticeFieldChange = (field, value) => {
    setNewNotice((prev) => ({ ...prev, [field]: value }));
    if (noticeTouched[field]) setNoticeFormErrors(validateNoticeForm({ ...newNotice, [field]: value }));
  };
  const handleNoticeBlur = (field) => { setNoticeTouched((prev) => ({ ...prev, [field]: true })); setNoticeFormErrors(validateNoticeForm(newNotice)); };
  const resetNoticeForm = () => { setNewNotice({ title: "", message: "", audience: "all", specific_resident_ids: [], priority: "Low", valid_till: "" }); setEditingNoticeId(null); setNoticeFormErrors({}); setNoticeTouched({}); setResidentSearch(""); };
  const handleNoticeSubmit = async (e) => {
    e.preventDefault();
    setNoticeTouched({ title: true, message: true, specific_resident_ids: true, valid_till: true });
    const errors = validateNoticeForm(newNotice);
    setNoticeFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const payload = { title: newNotice.title.trim(), message: newNotice.message.trim(), audience: newNotice.audience, specific_resident_ids: newNotice.audience === "specific_resident" ? newNotice.specific_resident_ids : [], priority: newNotice.priority, valid_till: (newNotice.valid_till || "").trim() };
    try {
      setNoticeSubmitting(true); setNoticesError(""); setUpdateMessage(""); setUpdateError("");
      if (editingNoticeId) { await updateNotice(editingNoticeId, payload); setUpdateMessage("Notice updated successfully"); }
      else { await createNotice({ ...payload, created_by: user?.id || null }); setUpdateMessage("Notice created successfully"); }
      resetNoticeForm(); loadNotices(); setNoticeTab("current");
    } catch (err) { setNoticesError(err?.response?.data?.message || "Failed to save notice."); }
    finally { setNoticeSubmitting(false); }
  };
  const handleEditNotice = (notice) => {
    setNewNotice({ title: notice.title || "", message: notice.message || "", audience: notice.audience || "all", specific_resident_ids: notice.specific_resident_ids || [], priority: notice.priority || "Low", valid_till: notice.valid_till || "" });
    setEditingNoticeId(notice.id); setNoticeFormErrors({}); setNoticeTouched({}); setUpdateMessage(""); setNoticesError("");
    if (noticeFormRef.current) noticeFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const handleDeleteNotice = async (id) => {
    if (!window.confirm("Delete this notice?")) return;
    try {
      setUpdateMessage(""); setUpdateError("");
      await deleteNotice(id); setUpdateMessage("Notice deleted successfully");
      setNotices((prev) => prev.filter((n) => n.id !== id));
      if (editingNoticeId === id) resetNoticeForm();
    } catch (err) { setNoticesError(err?.response?.data?.message || "Failed to delete notice."); }
  };

  // ─── Event handlers ────────────────────────────────────────────────────────
  const handleEventChange = (e) => {
    const { name, value } = e.target;
    setNewEvent((prev) => ({ ...prev, [name]: value }));
    if (eventTouched[name]) setEventFieldErrors(validateEventForm({ ...newEvent, [name]: value }));
  };
  const handleEventBlur = (name) => { setEventTouched((prev) => ({ ...prev, [name]: true })); setEventFieldErrors(validateEventForm(newEvent)); };
  const resetEventForm = () => { setNewEvent({ title: "", description: "", location: "", event_date: "", start_time: "", end_time: "" }); setEditingEventId(null); setEventFieldErrors({}); setEventTouched({}); setEventsError(""); };
  const handleEventSubmit = async (e) => {
    e.preventDefault();
    const allTouched = { title: true, description: true, location: true, event_date: true, start_time: true, end_time: true };
    setEventTouched(allTouched);
    const errors = validateEventForm(newEvent);
    setEventFieldErrors(errors);
    if (Object.keys(errors).length > 0) { setEventsError("Please fix the errors below before saving."); return; }
    const payload = { title: newEvent.title.trim(), description: newEvent.description.trim(), location: newEvent.location.trim(), event_date: newEvent.event_date.trim(), start_time: newEvent.start_time.trim(), end_time: newEvent.end_time.trim() };
    try {
      setEventSubmitting(true); setEventsError(""); setUpdateMessage(""); setUpdateError("");
      if (editingEventId) { await updateEvent(editingEventId, payload); setUpdateMessage("Event updated successfully"); }
      else { await createEvent({ ...payload, created_by: user?.id || null }); setUpdateMessage("Event created successfully"); }
      resetEventForm(); loadEvents();
    } catch (err) { setEventsError(err?.response?.data?.message || "Failed to save event."); }
    finally { setEventSubmitting(false); }
  };
  const handleEditEvent = (ev) => {
    setNewEvent({ title: ev.title || "", description: ev.description || "", location: ev.location || "", event_date: ev.event_date || "", start_time: ev.start_time || "", end_time: ev.end_time || "" });
    setEditingEventId(ev.id); setEventFieldErrors({}); setEventTouched({}); setUpdateMessage(""); setEventsError("");
    if (eventsFormRef.current) eventsFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const handleDeleteEvent = async (id) => {
    if (!window.confirm("Delete this event?")) return;
    try {
      setUpdateMessage(""); setUpdateError("");
      await deleteEvent(id); setUpdateMessage("Event deleted successfully");
      setEvents((prev) => prev.filter((e) => e.id !== id));
      if (editingEventId === id) resetEventForm();
    } catch (err) { setEventsError(err?.response?.data?.message || "Failed to delete event."); }
  };

  // ─── Maintenance handlers ──────────────────────────────────────────────────
  const handleMaintenanceFilterChange = (e) => { const { name, value } = e.target; setMFilters((prev) => ({ ...prev, [name]: value })); };
  const handleMaintenanceFormChange = (e) => {
    const { name, value } = e.target;
    setMForm((prev) => ({ ...prev, [name]: value }));
    if (mFormTouched[name]) setMFormErrors(validateMaintenanceForm({ ...mForm, [name]: value }));
  };
  const handleMaintenanceBlur = (field) => {
    setMFormTouched((prev) => ({ ...prev, [field]: true }));
    setMFormErrors(validateMaintenanceForm(mForm));
  };
  const resetMaintenanceForm = () => {
    setMForm({ resident_id: "", month: "", year: "", amount: "", due_date: "", notes: "" });
    setMFormErrors({}); setMFormTouched({}); setMError(""); setMMessage("");
  };
  const handleGenerateInvoice = async (e) => {
    e.preventDefault();
    setMError(""); setMMessage("");
    const allTouched = { month: true, year: true, amount: true, due_date: true };
    setMFormTouched(allTouched);
    const errors = validateMaintenanceForm(mForm);
    setMFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    try {
      setMSubmitting(true);
      const res = await generateMaintenanceInvoice({
        resident_id: mForm.resident_id || undefined,
        month: Number(mForm.month), year: Number(mForm.year), amount: Number(mForm.amount),
        due_date: mForm.due_date, notes: mForm.notes.trim(),
      });
      setMMessage(res.message || "Invoice(s) generated successfully");
      resetMaintenanceForm(); await loadMaintenanceInvoices();
    } catch (err) { setMError(err?.response?.data?.message || "Failed to generate invoice(s)."); }
    finally { setMSubmitting(false); }
  };
  const handleMarkInvoicePaid = async (invoiceId) => {
    try {
      setMError(""); setMMessage("");
      const invoice = maintenanceInvoices.find((inv) => inv.id === invoiceId);
      if (!invoice) { setMError("Invoice not found."); return; }
      await markInvoicePaid(invoiceId, { resident_id: invoice.resident_id, amount: invoice.amount, payment_method: "Offline" });
      setMMessage("Invoice marked as paid");
      setMaintenanceInvoices((prev) => prev.map((inv) => inv.id === invoiceId ? { ...inv, status: "paid", paid_on: new Date().toISOString().slice(0, 10) } : inv));
    } catch (err) { setMError(err?.response?.data?.message || "Failed to mark invoice as paid."); }
  };

  // ─── Resident handlers ─────────────────────────────────────────────────────
  const handleRemoveResident = async (id) => {
    if (!window.confirm("Deactivate this resident? They will no longer be able to log in.")) return;
    try {
      setRemovingResidentId(id); setResidentsError(""); setResidentsMessage("");
      await deactivateResident(id);
      setResidentsMessage("Resident deactivated successfully");
      setResidents((prev) => prev.map((r) => r.id === id ? { ...r, is_active: false } : r));
    } catch (err) { setResidentsError(err?.response?.data?.message || "Failed to deactivate resident."); }
    finally { setRemovingResidentId(null); }
  };
  const handleRestoreResident = async (id) => {
    if (!window.confirm("Restore this resident's access?")) return;
    try {
      setRemovingResidentId(id); setResidentsError(""); setResidentsMessage("");
      await activateResident(id);
      setResidentsMessage("Resident restored successfully");
      setResidents((prev) => prev.map((r) => r.id === id ? { ...r, is_active: true } : r));
    } catch (err) { setResidentsError(err?.response?.data?.message || "Failed to restore resident."); }
    finally { setRemovingResidentId(null); }
  };

  // ─── Panel badge counts ────────────────────────────────────────────────────
  const panelBadges = {
    [PANELS.COMPLAINTS]: openCount || 0,
    [PANELS.FACILITIES]: pendingBookings || 0,
  };

  // ─── Panel renderers ───────────────────────────────────────────────────────
  const renderPanel = () => {
    switch (activePanel) {

      // ── OVERVIEW ────────────────────────────────────────────────────────────
      case PANELS.OVERVIEW:
        return (
          <div className="space-y-6">
            {/* Hero banner — mirrors ResidentDashboard style */}
            <div style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #0891b2 100%)", borderRadius: 20, padding: "32px 36px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -50, right: -50, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
              <div style={{ position: "absolute", bottom: -30, left: 200, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
              <div style={{ position: "relative" }}>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginBottom: 6, letterSpacing: "1px", textTransform: "uppercase" }}>Admin Console 🛡️</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "white", letterSpacing: "-0.5px", marginBottom: 6 }}>Welcome back, {displayName}!</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Manage your society efficiently — all tools in one place.</div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Residents", value: residents.length, icon: "👥", color: "#6366f1", bg: "#eef2ff" },
                { label: "Open Complaints", value: openCount, icon: "📋", color: "#f59e0b", bg: "#fffbeb" },
                { label: "Pending Bookings", value: pendingBookings, icon: "🏢", color: "#10b981", bg: "#ecfdf5" },
                { label: "Upcoming Events", value: upcomingEvents.length, icon: "🎉", color: "#8b5cf6", bg: "#f5f3ff" },
              ].map((s) => (
                <div key={s.label} style={{ background: "white", borderRadius: 16, padding: "20px 22px", boxShadow: "0 1px 12px rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.04)" }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6, fontWeight: 500 }}>{s.label}</p>
                      <p style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</p>
                    </div>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{s.icon}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div style={{ background: "white", borderRadius: 16, padding: "22px 24px", boxShadow: "0 1px 12px rgba(0,0,0,0.06)" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.5px" }}>Quick Actions</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Manage Complaints", sub: `${openCount} open`, panel: PANELS.COMPLAINTS, color: "#6366f1", bg: "#eef2ff", icon: "📋" },
                  { label: "Facility Bookings", sub: `${pendingBookings} pending`, panel: PANELS.FACILITIES, color: "#10b981", bg: "#ecfdf5", icon: "🏢" },
                  { label: "Create Notice", sub: `${currentNotices.length} active`, panel: PANELS.NOTICES, color: "#f59e0b", bg: "#fffbeb", icon: "📢" },
                  { label: "Maintenance Bills", sub: "Generate invoices", panel: PANELS.MAINTENANCE, color: "#8b5cf6", bg: "#f5f3ff", icon: "💰" },
                ].map((a) => (
                  <button key={a.label} onClick={() => setActivePanel(a.panel)}
                    style={{ padding: "16px", borderRadius: 12, border: "none", cursor: "pointer", background: a.bg, textAlign: "left", transition: "opacity 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.opacity = "0.82"}
                    onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                  >
                    <div style={{ fontSize: 22, marginBottom: 8 }}>{a.icon}</div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 2 }}>{a.label}</p>
                    <p style={{ fontSize: 11, color: a.color, fontWeight: 600 }}>{a.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div style={{ background: "white", borderRadius: 16, padding: "22px 24px", boxShadow: "0 1px 12px rgba(0,0,0,0.06)" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#1e1b4b", marginBottom: 16 }}>Recent Activity</p>
              {activityLoading ? (
                <div className="text-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div></div>
              ) : recentActivity.length === 0 ? (
                <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "20px 0" }}>No recent activity</p>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((activity, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: "#f8faff", border: "1px solid #f1f5f9" }}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${activity.color}`}></div>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }} className="truncate">{activity.message}</p>
                        <p style={{ fontSize: 11, color: "#94a3b8" }}>{activity.created_at ? new Date(activity.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</p>
                      </div>
                      <span className="text-lg flex-shrink-0">{activity.icon}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      // ── COMPLAINTS ──────────────────────────────────────────────────────────
      case PANELS.COMPLAINTS: {
        const filteredComplaints = complaints.filter((c) => {
          const matchStatus = complaintFilter === "all" || (complaintFilter === "resolved" ? ["resolved", "closed"].includes((c.status || "").toLowerCase()) : (c.status || "").toLowerCase() === complaintFilter);
          const q = complaintSearch.toLowerCase();
          const matchSearch = !q || (c.resident_name || "").toLowerCase().includes(q) || (c.title || "").toLowerCase().includes(q) || (c.category || "").toLowerCase().includes(q) || String(c.id).includes(q);
          return matchStatus && matchSearch;
        });
        const resolvedComplaints = complaints.filter((c) => ["resolved", "closed"].includes((c.status || "").toLowerCase()));
        const avgResolutionMs = resolvedComplaints.length > 0
          ? resolvedComplaints.reduce((sum, c) => { const diff = new Date(c.resolved_at) - new Date(c.created_at); return sum + (Number.isFinite(diff) && diff > 0 ? diff : 0); }, 0) / resolvedComplaints.length : 0;
        const avgDays = avgResolutionMs > 0 ? (avgResolutionMs / (1000 * 60 * 60 * 24)).toFixed(1) : null;
        const formatDate = (dt) => { if (!dt) return "—"; const d = new Date(dt); if (isNaN(d.getTime())) return "—"; return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
        const formatDuration = (createdAt, resolvedAt) => { if (!createdAt || !resolvedAt) return null; const ms = new Date(resolvedAt) - new Date(createdAt); if (ms <= 0) return null; const totalMinutes = Math.floor(ms / 60000); const days = Math.floor(totalMinutes / 1440); const hours = Math.floor((totalMinutes % 1440) / 60); const mins = totalMinutes % 60; if (days > 0) return `${days}d ${hours}h`; if (hours > 0) return `${hours}h ${mins}m`; return `${mins}m`; };
        const priorityBadge = (p) => { const s = (p || "").toLowerCase(); if (s === "high" || s === "urgent") return "bg-red-100 text-red-700"; if (s === "medium") return "bg-amber-100 text-amber-700"; return "bg-slate-100 text-slate-600"; };
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div><h1 className="text-2xl font-bold text-slate-900">Complaints Management</h1><p className="text-slate-500 text-sm">Review, track and report on resident complaints</p></div>
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                  <button onClick={() => setComplaintView("table")} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${complaintView === "table" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Table</button>
                  <button onClick={() => setComplaintView("report")} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${complaintView === "report" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Report</button>
                </div>
                <button onClick={() => { setLoadError(""); setUpdateMessage(""); setUpdateError(""); loadComplaints(); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">Refresh</button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total", value: complaints.length, bg: "#f8faff", border: "#e0e7ff", color: "#6366f1" },
                { label: "Open", value: openCount, bg: "#fffbeb", border: "#fde68a", color: "#f59e0b" },
                { label: "In Progress", value: inProgressCount, bg: "#fff7ed", border: "#fed7aa", color: "#ea580c" },
                { label: "Resolved", value: resolvedCount, bg: "#ecfdf5", border: "#a7f3d0", color: "#059669" },
              ].map((s) => (
                <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 16, padding: "18px 20px" }}>
                  <p style={{ fontSize: 11, color: s.color, fontWeight: 600, marginBottom: 4 }}>{s.label}</p>
                  <p style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
            {updateMessage && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl text-sm">{updateMessage}</div>}
            {updateError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl text-sm">{updateError}</div>}
            {complaintView === "report" && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-5"><p className="text-xs text-slate-500 font-medium mb-1">Avg. Resolution Time</p><p className="text-3xl font-bold text-indigo-700">{avgDays ? `${avgDays}d` : "—"}</p><p className="text-xs text-slate-400 mt-1">across {resolvedComplaints.length} resolved</p></div>
                  <div className="bg-white border border-slate-200 rounded-xl p-5"><p className="text-xs text-slate-500 font-medium mb-1">Resolution Rate</p><p className="text-3xl font-bold text-emerald-700">{complaints.length > 0 ? `${Math.round((resolvedCount / complaints.length) * 100)}%` : "—"}</p><p className="text-xs text-slate-400 mt-1">{resolvedCount} of {complaints.length} resolved</p></div>
                  <div className="bg-white border border-slate-200 rounded-xl p-5"><p className="text-xs text-slate-500 font-medium mb-1">Pending Action</p><p className="text-3xl font-bold text-amber-700">{openCount + inProgressCount}</p><p className="text-xs text-slate-400 mt-1">{openCount} open + {inProgressCount} in progress</p></div>
                </div>
                {(() => {
                  const cats = {}; complaints.forEach((c) => { const cat = c.category || "General"; cats[cat] = (cats[cat] || 0) + 1; });
                  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]); const total = complaints.length || 1;
                  return (
                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <h3 className="text-sm font-semibold text-slate-900 mb-4">Complaints by Category</h3>
                      <div className="space-y-3">
                        {sorted.map(([cat, count]) => (<div key={cat}><div className="flex items-center justify-between mb-1"><span className="text-sm text-slate-700 font-medium">{cat}</span><span className="text-xs text-slate-500">{count}</span></div><div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${(count / total) * 100}%` }} /></div></div>))}
                        {sorted.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No data yet</p>}
                      </div>
                    </div>
                  );
                })()}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-900">Complaint Timeline Report</h3></div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-slate-50"><tr>{["#","Resident","Title","Priority","Received On","Resolved On","Time Taken","Status"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {complaints.map((c) => { const isResolved = ["resolved","closed"].includes((c.status||"").toLowerCase()); const duration = formatDuration(c.created_at, c.resolved_at); return (
                          <tr key={c.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-xs text-slate-500">{c.id}</td>
                            <td className="px-4 py-3"><p className="text-sm font-medium text-slate-900">{c.resident_name||"—"}</p></td>
                            <td className="px-4 py-3 text-sm text-slate-700 max-w-[180px] truncate">{c.title||"Complaint"}</td>
                            <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityBadge(c.priority)}`}>{c.priority||"Normal"}</span></td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-700">{formatDate(c.created_at)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{isResolved ? <span className="text-xs text-emerald-700">{formatDate(c.resolved_at)}</span> : <span className="text-xs text-slate-400 italic">Pending</span>}</td>
                            <td className="px-4 py-3">{duration ? <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">{duration}</span> : <span className="text-xs text-slate-400">—</span>}</td>
                            <td className="px-4 py-3">{renderStatusBadge(c.status)}</td>
                          </tr>
                        );})}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            {complaintView === "table" && (
              <div className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-center">
                  <div className="relative flex-1 min-w-[200px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                    <input type="text" placeholder="Search by name, title, category or ID..." value={complaintSearch} onChange={(e) => setComplaintSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-lg flex-wrap">
                    {[{key:"all",label:"All"},{key:"open",label:"Open"},{key:"in progress",label:"In Progress"},{key:"resolved",label:"Resolved"}].map((f) => (
                      <button key={f.key} onClick={() => setComplaintFilter(f.key)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${complaintFilter === f.key ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                        {f.label} <span className="ml-1 text-slate-400">({f.key==="all"?complaints.length:f.key==="resolved"?resolvedCount:f.key==="in progress"?inProgressCount:openCount})</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {loading ? (<div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div><p className="text-slate-500">Loading complaints...</p></div>)
                  : loadError ? (<div className="p-8 text-center"><p className="text-red-500">{loadError}</p></div>)
                  : filteredComplaints.length === 0 ? (<div className="p-8 text-center"><p className="text-slate-500 font-medium">No complaints found</p></div>)
                  : (
                    <table className="min-w-full">
                      <thead className="bg-slate-50 border-b border-slate-200"><tr>{["#","Resident","Complaint","Category","Priority","Received On","Status","Actions"].map((h) => <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredComplaints.map((c) => {
                          const isResolved = ["resolved","closed"].includes((c.status||"").toLowerCase());
                          const isExpanded = expandedComplaint === c.id;
                          const formatDur = (a, b) => { if (!a||!b) return null; const ms=new Date(b)-new Date(a); if(ms<=0) return null; const m=Math.floor(ms/60000); const d=Math.floor(m/1440); const h=Math.floor((m%1440)/60); const mn=m%60; if(d>0) return `${d}d ${h}h`; if(h>0) return `${h}h ${mn}m`; return `${mn}m`; };
                          const duration = formatDur(c.created_at, c.resolved_at);
                          return (
                            <React.Fragment key={c.id}>
                              <tr className={`hover:bg-slate-50 cursor-pointer ${isExpanded?"bg-indigo-50/40":""}`} onClick={() => setExpandedComplaint(isExpanded?null:c.id)}>
                                <td className="px-5 py-3 text-xs text-slate-500">{c.id}</td>
                                <td className="px-5 py-3 whitespace-nowrap"><p className="text-sm font-medium text-slate-900">{c.resident_name||"—"}</p><p className="text-xs text-slate-400">{c.resident_email||""}</p></td>
                                <td className="px-5 py-3 max-w-[200px]"><p className="text-sm font-medium text-slate-900 truncate">{c.title||"Complaint"}</p><p className="text-xs text-slate-400 truncate">{(c.description||"").slice(0,55)}</p></td>
                                <td className="px-5 py-3 text-sm text-slate-600 whitespace-nowrap">{c.category||"General"}</td>
                                <td className="px-5 py-3 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${(() => { const s=(c.priority||"").toLowerCase(); if(s==="high"||s==="urgent") return "bg-red-100 text-red-700"; if(s==="medium") return "bg-amber-100 text-amber-700"; return "bg-slate-100 text-slate-600"; })()}`}>{c.priority||"Normal"}</span></td>
                                <td className="px-5 py-3 whitespace-nowrap"><p className="text-xs font-medium text-slate-700">{c.created_at?new Date(c.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}):"—"}</p></td>
                                <td className="px-5 py-3 whitespace-nowrap">{renderStatusBadge(c.status)}</td>
                                <td className="px-5 py-3 whitespace-nowrap text-sm" onClick={(e)=>e.stopPropagation()}>
                                  {isResolved ? <span className="px-3 py-1 rounded-lg text-xs bg-gray-100 text-gray-500 border border-gray-200">{c.status} (locked)</span> : (
                                    <select className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" value={(c.status||"open").toLowerCase()} disabled={updatingId===c.id} onChange={(e)=>handleStatusChange(c.id,e.target.value)}>
                                      {STATUS_OPTIONS.map((s)=><option key={s} value={s}>{s}</option>)}
                                    </select>
                                  )}
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr><td colSpan={8} className="px-0 py-0">
                                  <div className="bg-indigo-50/60 border-t border-b border-indigo-100 px-6 py-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                      <div className="md:col-span-2"><p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Full Description</p><p className="text-sm text-slate-700 leading-relaxed">{c.description||"No description."}</p></div>
                                      <div>
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Timeline</p>
                                        <div className="space-y-3">
                                          <div className="flex items-start gap-2"><div className="w-5 h-5 rounded-full bg-indigo-500 flex-shrink-0 mt-0.5"></div><div><p className="text-xs font-semibold text-slate-700">Received</p><p className="text-xs text-slate-500">{c.created_at ? new Date(c.created_at).toLocaleString("en-IN",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—"}</p></div></div>
                                          {["resolved","closed"].includes((c.status||"").toLowerCase()) ? (
                                            <div className="flex items-start gap-2"><div className="w-5 h-5 rounded-full bg-emerald-500 flex-shrink-0 mt-0.5"></div><div><p className="text-xs font-semibold text-emerald-700">Resolved</p><p className="text-xs text-slate-500">{c.resolved_at ? new Date(c.resolved_at).toLocaleString("en-IN",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—"}</p>{duration&&<p className="text-xs font-semibold text-indigo-600 mt-0.5">Time: {duration}</p>}</div></div>
                                          ) : (
                                            <div className="flex items-start gap-2"><div className="w-5 h-5 rounded-full bg-slate-300 flex-shrink-0 mt-0.5"></div><div><p className="text-xs text-slate-400 italic">Awaiting resolution</p></div></div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td></tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      }

      // ── NOTICES ─────────────────────────────────────────────────────────────
      case PANELS.NOTICES:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div><h1 className="text-2xl font-bold text-slate-900">Notice Board Management</h1><p className="text-slate-500 text-sm">Create and manage society notices</p></div>
              <button onClick={() => { setNoticesError(""); setUpdateMessage(""); setUpdateError(""); loadNotices(); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm">Refresh</button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total Notices", value: notices.length, color: "#6366f1", bg: "#eef2ff" },
                { label: "Current Active", value: currentNotices.length, color: "#10b981", bg: "#ecfdf5" },
                { label: "Previous / Expired", value: previousNotices.length, color: "#94a3b8", bg: "#f8fafc" },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 16, padding: "18px 20px", textAlign: "center" }}>
                  <p style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</p>
                  <p style={{ fontSize: 11, color: s.color, fontWeight: 600, marginTop: 4 }}>{s.label}</p>
                </div>
              ))}
            </div>
            {updateMessage && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl text-sm">{updateMessage}</div>}
            <div ref={noticeFormRef} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">{editingNoticeId ? "Edit Notice" : "Create New Notice"}</h3>
              {noticesError && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl text-sm">{noticesError}</div>}
              <form onSubmit={handleNoticeSubmit} noValidate className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Title <span className="text-red-500">*</span></label>
                    <input type="text" value={newNotice.title} onChange={(e)=>handleNoticeFieldChange("title",e.target.value)} onBlur={()=>handleNoticeBlur("title")} placeholder="Notice title (3-120 characters)" className={fieldClass(noticeTouched.title&&noticeFormErrors.title)} />
                    {noticeTouched.title&&noticeFormErrors.title&&<p className="mt-1 text-xs text-red-500">{noticeFormErrors.title}</p>}
                    <p className="mt-1 text-xs text-slate-400 text-right">{newNotice.title.length}/120</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Audience <span className="text-red-500">*</span></label>
                    <select value={newNotice.audience} onChange={(e) => { const val = e.target.value; const updated = { ...newNotice, audience: val, specific_resident_ids: val !== "specific_resident" ? [] : newNotice.specific_resident_ids }; setNewNotice(updated); setNoticeFormErrors(validateNoticeForm(updated)); }} className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="all">All Users</option><option value="residents">Residents Only</option><option value="security">Security Only</option><option value="residents_security">Residents and Security</option><option value="specific_resident">Specific Resident(s)</option><option value="admins">Admins Only</option>
                    </select>
                  </div>
                </div>
                {newNotice.audience==="specific_resident"&&(
                  <div className={`border rounded-xl p-4 bg-slate-50 ${noticeTouched.specific_resident_ids&&noticeFormErrors.specific_resident_ids?"border-red-300":"border-slate-200"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-slate-700">Select Resident(s) <span className="text-red-500">*</span></label>
                      {(newNotice.specific_resident_ids||[]).length>0&&<span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{newNotice.specific_resident_ids.length} selected</span>}
                    </div>
                    <input type="text" placeholder="Search residents..." value={residentSearch} onChange={(e)=>setResidentSearch(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white mb-3"/>
                    <div className="max-h-52 overflow-y-auto space-y-1">
                      {filteredResidents.map((r)=>{const isSel=(newNotice.specific_resident_ids||[]).includes(r.resident_table_id);return(
                        <label key={r.id} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${isSel?"bg-indigo-50 border border-indigo-200":"bg-white border border-transparent hover:bg-slate-100"}`}>
                          <input type="checkbox" checked={isSel} onChange={()=>toggleResidentSelection(r.resident_table_id)} className="accent-indigo-600 w-4 h-4"/>
                          <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-900 truncate">{r.full_name||r.email}</p><p className="text-xs text-slate-500">{[r.flat_number,r.block_name].filter(Boolean).join(" - ")}</p></div>
                          {isSel&&<span className="text-indigo-600 text-sm">✓</span>}
                        </label>
                      );})}
                    </div>
                    {(newNotice.specific_resident_ids||[]).length>0&&<div className="mt-3 pt-3 border-t border-slate-200"><p className="text-xs text-slate-500 mb-1 font-medium">Selected:</p><p className="text-xs text-indigo-700">{getSelectedResidentNames()}</p></div>}
                    {noticeTouched.specific_resident_ids&&noticeFormErrors.specific_resident_ids&&<p className="mt-2 text-xs text-red-500">{noticeFormErrors.specific_resident_ids}</p>}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Message <span className="text-red-500">*</span></label>
                  <textarea value={newNotice.message} onChange={(e)=>handleNoticeFieldChange("message",e.target.value)} onBlur={()=>handleNoticeBlur("message")} rows={4} placeholder="Notice content (5-2000 characters)" className={`${fieldClass(noticeTouched.message&&noticeFormErrors.message)} resize-y`}/>
                  <div className="flex items-center justify-between mt-1">
                    {noticeTouched.message&&noticeFormErrors.message?<p className="text-xs text-red-500">{noticeFormErrors.message}</p>:<span/>}
                    <p className="text-xs text-slate-400">{newNotice.message.length}/2000</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                    <select value={newNotice.priority} onChange={(e)=>handleNoticeFieldChange("priority",e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Valid Till <span className="text-slate-400 font-normal">(optional)</span></label>
                    <input type="date" value={newNotice.valid_till} onChange={(e)=>handleNoticeFieldChange("valid_till",e.target.value)} onBlur={()=>handleNoticeBlur("valid_till")} className={fieldClass(noticeTouched.valid_till&&noticeFormErrors.valid_till)}/>
                    {noticeTouched.valid_till&&noticeFormErrors.valid_till&&<p className="mt-1 text-xs text-red-500">{noticeFormErrors.valid_till}</p>}
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={noticeSubmitting} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium">{noticeSubmitting?(editingNoticeId?"Updating...":"Creating..."):(editingNoticeId?"Update Notice":"Publish Notice")}</button>
                  {editingNoticeId&&<button type="button" onClick={resetNoticeForm} className="px-6 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>}
                </div>
              </form>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold text-slate-900">Notices</h3>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                  <button onClick={()=>setNoticeTab("current")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${noticeTab==="current"?"bg-white text-indigo-700 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>Current ({currentNotices.length})</button>
                  <button onClick={()=>setNoticeTab("previous")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${noticeTab==="previous"?"bg-white text-slate-700 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>Previous ({previousNotices.length})</button>
                </div>
              </div>
              {noticesLoading ? (<div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div></div>)
              : displayedNotices.length === 0 ? (<div className="text-center py-12"><p className="text-slate-500 font-medium">No {noticeTab} notices</p></div>)
              : (
                <div className="space-y-3">
                  {displayedNotices.map((n) => {
                    const priorityStyle = n.priority==="High"?"bg-red-100 text-red-700":n.priority==="Medium"?"bg-amber-100 text-amber-700":"bg-slate-100 text-slate-600";
                    const audienceLabel = {all:"All",residents:"Residents",security:"Security",residents_security:"Res + Sec",specific_resident:"Specific",admins:"Admins"}[n.audience]||n.audience;
                    return (
                      <div key={n.id} className={`border rounded-xl p-4 transition-colors ${noticeTab==="previous"?"border-slate-200 bg-slate-50 opacity-75":"border-slate-200 hover:bg-slate-50"}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              <h4 className="font-semibold text-slate-900 truncate">{n.title}</h4>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityStyle}`}>{n.priority||"Low"}</span>
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{audienceLabel}</span>
                              {noticeTab==="previous"&&<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-600">Expired</span>}
                            </div>
                            <p className="text-slate-600 text-sm leading-relaxed line-clamp-2 mb-2">{n.message}</p>
                            <div className="flex items-center gap-4 flex-wrap">
                              {n.valid_till&&<p className="text-xs text-slate-400">Valid till: {new Date(n.valid_till).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</p>}
                              {n.created_at&&<p className="text-xs text-slate-400">Created: {new Date(n.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</p>}
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button onClick={()=>handleEditNotice(n)} className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors font-medium">Edit</button>
                            <button onClick={()=>handleDeleteNotice(n.id)} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium">Delete</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );

      // ── EVENTS ───────────────────────────────────────────────────────────────
      case PANELS.EVENTS:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div><h1 className="text-2xl font-bold text-slate-900">Events Management</h1><p className="text-slate-500 text-sm">Create and manage community events</p></div>
              <button onClick={() => { setEventsError(""); setUpdateMessage(""); setUpdateError(""); loadEvents(); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm">Refresh</button>
            </div>
            {updateMessage && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl text-sm">{updateMessage}</div>}
            <div ref={eventsFormRef} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">{editingEventId ? "Edit Event" : "Create New Event"}</h3>
              <p className="text-xs text-slate-400 mb-4">Fields marked <span className="text-red-500">*</span> are required</p>
              {eventsError && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl text-sm">{eventsError}</div>}
              <form onSubmit={handleEventSubmit} noValidate className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Event Title <span className="text-red-500">*</span></label>
                    <input type="text" name="title" value={newEvent.title} onChange={handleEventChange} onBlur={() => handleEventBlur("title")} placeholder="e.g. Annual General Meeting" className={fieldClass(eventTouched.title && eventFieldErrors.title)} />
                    <div className="flex items-center justify-between mt-1">{eventTouched.title&&eventFieldErrors.title?<p className="text-xs text-red-500">{eventFieldErrors.title}</p>:<span/>}<p className="text-xs text-slate-400">{newEvent.title.length}/120</p></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Event Date <span className="text-red-500">*</span></label>
                    <input type="date" name="event_date" value={newEvent.event_date} onChange={handleEventChange} onBlur={() => handleEventBlur("event_date")} className={fieldClass(eventTouched.event_date && eventFieldErrors.event_date)} />
                    {eventTouched.event_date&&eventFieldErrors.event_date&&<p className="mt-1 text-xs text-red-500">{eventFieldErrors.event_date}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                    <input type="text" name="start_time" value={newEvent.start_time} onChange={handleEventChange} onBlur={() => handleEventBlur("start_time")} placeholder="09:00 or 9:00 AM" className={fieldClass(eventTouched.start_time && eventFieldErrors.start_time)} />
                    {eventTouched.start_time&&eventFieldErrors.start_time&&<p className="mt-1 text-xs text-red-500">{eventFieldErrors.start_time}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                    <input type="text" name="end_time" value={newEvent.end_time} onChange={handleEventChange} onBlur={() => handleEventBlur("end_time")} placeholder="18:00 or 6:00 PM" className={fieldClass(eventTouched.end_time && eventFieldErrors.end_time)} />
                    {eventTouched.end_time&&eventFieldErrors.end_time&&<p className="mt-1 text-xs text-red-500">{eventFieldErrors.end_time}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                    <input type="text" name="location" value={newEvent.location} onChange={handleEventChange} onBlur={() => handleEventBlur("location")} placeholder="e.g. Clubhouse" className={fieldClass(eventTouched.location && eventFieldErrors.location)} />
                    <div className="flex items-center justify-between mt-1">{eventTouched.location&&eventFieldErrors.location?<p className="text-xs text-red-500">{eventFieldErrors.location}</p>:<span/>}<p className="text-xs text-slate-400">{newEvent.location.length}/120</p></div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea name="description" value={newEvent.description} onChange={handleEventChange} onBlur={() => handleEventBlur("description")} rows={3} placeholder="Event details..." className={`${fieldClass(eventTouched.description && eventFieldErrors.description)} resize-y`} />
                  <div className="flex items-center justify-between mt-1">{eventTouched.description&&eventFieldErrors.description?<p className="text-xs text-red-500">{eventFieldErrors.description}</p>:<span/>}<p className={`text-xs ${newEvent.description.length > 450 ? "text-amber-500 font-medium" : "text-slate-400"}`}>{newEvent.description.length}/500</p></div>
                </div>
                <div className="flex gap-3">
                  <button type="submit" disabled={eventSubmitting} className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors font-medium">{eventSubmitting?(editingEventId?"Updating...":"Creating..."):editingEventId?"Update Event":"Create Event"}</button>
                  {editingEventId&&<button type="button" onClick={resetEventForm} className="px-6 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>}
                </div>
              </form>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold text-slate-900">All Events</h3>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                  <button onClick={() => setEventTab("upcoming")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${eventTab === "upcoming" ? "bg-white text-amber-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Upcoming ({upcomingEvents.length})</button>
                  <button onClick={() => setEventTab("past")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${eventTab === "past" ? "bg-white text-slate-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Past ({pastEvents.length})</button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-5">
                {[
                  { label: "Upcoming", value: upcomingEvents.length, color: "#f59e0b", bg: "#fffbeb" },
                  { label: "Past", value: pastEvents.length, color: "#94a3b8", bg: "#f8fafc" },
                  { label: "Total", value: events.length, color: "#6366f1", bg: "#eef2ff" },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: "16px 18px", textAlign: "center" }}>
                    <p style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</p>
                    <p style={{ fontSize: 11, color: s.color, fontWeight: 600, marginTop: 3 }}>{s.label}</p>
                  </div>
                ))}
              </div>
              {eventsLoading ? (<div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div></div>)
              : displayedEvents.length === 0 ? (<div className="text-center py-12"><p className="text-slate-500 font-medium">No {eventTab} events</p></div>)
              : (
                <div className="space-y-3">
                  {displayedEvents.map((ev) => (
                    <div key={ev.id} style={{ border: "1px solid #f1f5f9", borderRadius: 14, padding: "16px 18px", background: eventTab === "past" ? "#f8fafc" : "#fafbff" }}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-semibold text-slate-900">{ev.title}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${eventTab === "past" ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-700"}`}>{ev.event_date}</span>
                          </div>
                          {ev.description && <p className="text-slate-600 text-sm mb-2 line-clamp-2">{ev.description}</p>}
                          <div className="flex gap-4 text-sm text-slate-500 flex-wrap">
                            {ev.location && <span>📍 {ev.location}</span>}
                            {/* ── AM/PM time display ── */}
                            {ev.start_time && <span>🕐 {fmtSlot(ev.start_time, ev.end_time)}</span>}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button onClick={() => handleEditEvent(ev)} className="px-3 py-1 text-indigo-600 hover:bg-indigo-50 rounded transition-colors text-sm">Edit</button>
                          <button onClick={() => handleDeleteEvent(ev.id)} className="px-3 py-1 text-red-600 hover:bg-red-50 rounded transition-colors text-sm">Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      // ── FACILITIES ───────────────────────────────────────────────────────────
      case PANELS.FACILITIES: {
        const activeFacilities = allFacilities.filter((f) => f.is_active);
        const removedFacilities = allFacilities.filter((f) => !f.is_active);
        const paidBookings = facilityBookings.filter((b) => b.payment_status === "paid").length;
        const unpaidApproved = facilityBookings.filter((b) => b.payment_status === "unpaid" && b.status === "approved").length;
        const statusBadge = (status) => { const s = (status || "").toLowerCase(); if (s === "approved") return "bg-emerald-100 text-emerald-700"; if (s === "rejected") return "bg-red-100 text-red-700"; if (s === "cancelled") return "bg-slate-200 text-slate-700"; return "bg-amber-100 text-amber-700"; };
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div><h1 className="text-2xl font-bold text-slate-900">Facilities Management</h1><p className="text-slate-500 text-sm">Manage facilities, bookings, payments and reports</p></div>
              <button onClick={() => { loadFacilityBookings(); loadAllFacilities(); loadFacilityReport(); setFbUpdateMessage(""); setFbUpdateError(""); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm">Refresh</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: "Active Facilities", value: activeFacilities.length, color: "#10b981", bg: "#ecfdf5" },
                { label: "Removed", value: removedFacilities.length, color: "#94a3b8", bg: "#f8fafc" },
                { label: "Pending Bookings", value: pendingBookings, color: "#f59e0b", bg: "#fffbeb" },
                { label: "Paid", value: paidBookings, color: "#6366f1", bg: "#eef2ff" },
                { label: "Awaiting Payment", value: unpaidApproved, color: "#ef4444", bg: "#fef2f2" },
              ].map((s) => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: "14px 16px", textAlign: "center" }}>
                  <p style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</p>
                  <p style={{ fontSize: 11, color: s.color, fontWeight: 600, marginTop: 3 }}>{s.label}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
              {[{key:"bookings",label:"Bookings"},{key:"manage",label:"Manage Facilities"},{key:"reports",label:"Reports"}].map((t) => (
                <button key={t.key} onClick={() => setFacilitiesTab(t.key)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${facilitiesTab === t.key ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{t.label}</button>
              ))}
            </div>
            {fbUpdateMessage && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl text-sm">{fbUpdateMessage}</div>}
            {fbUpdateError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl text-sm">{fbUpdateError}</div>}
            {fbError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl text-sm">{fbError}</div>}

            {facilitiesTab === "bookings" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
                {fbLoading ? (<div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div></div>)
                : facilityBookings.length === 0 ? (<div className="p-8 text-center"><p className="text-slate-500">No facility bookings found</p></div>)
                : (
                  <table className="min-w-full">
                    <thead className="bg-slate-50"><tr>{["ID","Resident","Facility","Date","Time Slot","Amount","Payment","Status","Actions"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {facilityBookings.map((b) => {
                        const locked = isBookingLocked(b);
                        return (
                          <tr key={b.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{b.id}</td>
                            <td className="px-4 py-3 whitespace-nowrap"><p className="text-sm font-medium text-slate-900">{b.resident_name || "—"}</p><p className="text-xs text-slate-400">{b.resident_email || ""}</p></td>
                            <td className="px-4 py-3"><p className="text-sm font-medium text-slate-900">{b.facility_name || "—"}</p>{b.facility_location && <p className="text-xs text-slate-400">{b.facility_location}</p>}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{b.booking_date || "—"}</td>
                            {/* ── AM/PM time slot ── */}
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{fmtSlot(b.start_time, b.end_time)}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900">Rs.{parseFloat(b.total_amount || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${b.payment_status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>{b.payment_status === "paid" ? "Paid" : "Unpaid"}</span>
                              {b.payment_date && <p className="text-xs text-slate-400 mt-0.5">{new Date(b.payment_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(b.status)}`}>{b.status ? b.status.charAt(0).toUpperCase() + b.status.slice(1) : "Pending"}</span></td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {locked ? (
                                <span className="px-3 py-1 rounded-lg text-xs bg-gray-100 text-gray-500 border border-gray-200">{b.status} (locked)</span>
                              ) : (
                                <div className="flex gap-2 items-center">
                                  <select className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" value={b.status || "pending"} disabled={fbUpdatingId === b.id} onChange={(e) => handleBookingStatusChange(b.id, e.target.value)}>
                                    {BOOKING_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                                  </select>
                                </div>
                              )}
                              {b.payment_status !== "paid" && b.status === "approved" && (
                                <button onClick={() => handleMarkBookingPaid(b.id)} disabled={payingId === b.id} className="mt-1 px-2 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap">{payingId === b.id ? "..." : "Mark Paid"}</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {facilitiesTab === "manage" && (
              <div className="space-y-6">
                {facilityFormMessage && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl text-sm">{facilityFormMessage}</div>}
                {facilityFormError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl text-sm">{facilityFormError}</div>}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">{editingFacilityId ? "Edit Facility" : "Add New Facility"}</h3>
                  <form onSubmit={handleFacilitySubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label className="block text-sm font-medium text-slate-700 mb-1">Name <span className="text-red-500">*</span></label><input type="text" name="name" value={facilityFormData.name} onChange={handleFacilityFormChange} placeholder="e.g. Swimming Pool" className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                      <div><label className="block text-sm font-medium text-slate-700 mb-1">Location</label><input type="text" name="location" value={facilityFormData.location} onChange={handleFacilityFormChange} placeholder="e.g. Block A Ground Floor" className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div><label className="block text-sm font-medium text-slate-700 mb-1">Capacity</label><input type="number" name="capacity" value={facilityFormData.capacity} onChange={handleFacilityFormChange} placeholder="50" className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                      <div><label className="block text-sm font-medium text-slate-700 mb-1">Available From</label><input type="time" name="available_from" value={facilityFormData.available_from} onChange={handleFacilityFormChange} className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                      <div><label className="block text-sm font-medium text-slate-700 mb-1">Available To</label><input type="time" name="available_to" value={facilityFormData.available_to} onChange={handleFacilityFormChange} className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label className="block text-sm font-medium text-slate-700 mb-1">Booking Fee (Rs.)</label><input type="number" step="0.01" name="booking_fee" value={facilityFormData.booking_fee} onChange={handleFacilityFormChange} placeholder="500.00" className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                      <div><label className="block text-sm font-medium text-slate-700 mb-1">Description</label><input type="text" name="description" value={facilityFormData.description} onChange={handleFacilityFormChange} placeholder="Short description" className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                    </div>
                    <div className="flex gap-3">
                      <button type="submit" disabled={facilitySubmitting} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium">{facilitySubmitting ? "Saving..." : editingFacilityId ? "Update Facility" : "Add Facility"}</button>
                      {editingFacilityId && <button type="button" onClick={resetFacilityForm} className="px-6 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>}
                    </div>
                  </form>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Active Facilities ({activeFacilities.length})</h3>
                  {activeFacilities.length === 0 ? (<p className="text-slate-500 text-sm text-center py-6">No active facilities.</p>) : (
                    <div className="space-y-3">
                      {activeFacilities.map((f) => (
                        <div key={f.id} style={{ border: "1px solid #a7f3d0", background: "#f0fdf9", borderRadius: 14, padding: "16px 18px" }}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="font-semibold text-slate-900">{f.name}</h4>
                                {f.booking_fee > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Rs.{f.booking_fee}</span>}
                                {f.capacity && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Cap: {f.capacity}</span>}
                              </div>
                              <div className="flex gap-4 text-xs text-slate-500 flex-wrap">
                                {f.location && <span>📍 {f.location}</span>}
                                {/* ── AM/PM available hours ── */}
                                {f.available_from && <span>🕐 {to12hr(f.available_from)} – {to12hr(f.available_to)}</span>}
                                {f.description && <span>{f.description}</span>}
                                <span>{f.total_bookings || 0} bookings</span>
                              </div>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <button onClick={() => handleEditFacility(f)} className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">Edit</button>
                              <button onClick={() => handleToggleFacility(f.id)} className="px-3 py-1.5 text-sm text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">Remove</button>
                              <button onClick={() => handleDeleteFacility(f.id)} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">Delete</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Removed Facilities ({removedFacilities.length})</h3>
                  {removedFacilities.length === 0 ? (<p className="text-slate-500 text-sm text-center py-6">No removed facilities.</p>) : (
                    <div className="space-y-3">
                      {removedFacilities.map((f) => (
                        <div key={f.id} style={{ border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 14, padding: "16px 18px", opacity: 0.8 }}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="font-semibold text-slate-700">{f.name}</h4>
                                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Removed</span>
                              </div>
                              <div className="flex gap-4 text-xs text-slate-400 flex-wrap">
                                {f.location && <span>📍 {f.location}</span>}
                                {/* ── AM/PM available hours (removed) ── */}
                                {f.available_from && <span>🕐 {to12hr(f.available_from)} – {to12hr(f.available_to)}</span>}
                                <span>{f.total_bookings || 0} bookings on record</span>
                              </div>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <button onClick={() => handleToggleFacility(f.id)} className="px-3 py-1.5 text-sm text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">Restore</button>
                              <button onClick={() => handleDeleteFacility(f.id)} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">Delete</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {facilitiesTab === "reports" && (
              <div className="space-y-6">
                {reportLoading ? (<div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div></div>)
                : facilityReport ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: "Total Collected", value: `Rs.${parseFloat(facilityReport.summary?.total_collected || 0).toFixed(2)}`, color: "#059669", bg: "#ecfdf5" },
                        { label: "Pending Revenue", value: `Rs.${parseFloat(facilityReport.summary?.total_pending || 0).toFixed(2)}`, color: "#d97706", bg: "#fffbeb" },
                        { label: "Total Bookings", value: facilityReport.summary?.total_bookings || 0, color: "#6366f1", bg: "#eef2ff" },
                        { label: "Paid Bookings", value: facilityReport.summary?.paid_count || 0, color: "#0891b2", bg: "#ecfeff" },
                      ].map((s) => (<div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: "18px 20px" }}><p className="text-xs text-slate-500 font-medium mb-1">{s.label}</p><p style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</p></div>))}
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <h3 className="text-sm font-semibold text-slate-900 mb-4">Most Booked Facilities</h3>
                      <div className="space-y-3">
                        {(facilityReport.popularFacilities || []).map((f) => {
                          const max = Math.max(...(facilityReport.popularFacilities || []).map((x) => x.booking_count || 0), 1);
                          return (
                            <div key={f.id}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2"><span className="text-sm font-medium text-slate-800">{f.name}</span>{!f.is_active && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Removed</span>}</div>
                                <div className="flex gap-4 text-xs text-slate-500"><span>{f.booking_count} bookings</span><span className="font-medium text-emerald-700">Rs.{parseFloat(f.revenue || 0).toFixed(2)}</span></div>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${((f.booking_count || 0) / max) * 100}%` }} /></div>
                            </div>
                          );
                        })}
                        {(facilityReport.popularFacilities || []).length === 0 && <p className="text-slate-400 text-sm text-center py-4">No data yet</p>}
                      </div>
                    </div>
                    {(facilityReport.monthlyRevenue || []).length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-xl p-5">
                        <h3 className="text-sm font-semibold text-slate-900 mb-4">Monthly Revenue (Last 6 Months)</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead className="bg-slate-50"><tr>{["Month","Bookings Paid","Revenue"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>)}</tr></thead>
                            <tbody className="divide-y divide-slate-100">
                              {facilityReport.monthlyRevenue.map((row, i) => (<tr key={i} className="hover:bg-slate-50"><td className="px-4 py-3 text-sm font-medium text-slate-900">{row.month}</td><td className="px-4 py-3 text-sm text-slate-700">{row.bookings}</td><td className="px-4 py-3 text-sm font-semibold text-emerald-700">Rs.{parseFloat(row.revenue || 0).toFixed(2)}</td></tr>))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-900">Full Booking History</h3></div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className="bg-slate-50"><tr>{["#","Resident","Facility","Date","Amount","Payment","Status","Booked On"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
                          <tbody className="divide-y divide-slate-100">
                            {facilityBookings.length === 0 ? (<tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">No bookings yet</td></tr>)
                            : facilityBookings.map((b) => (
                              <tr key={b.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 text-xs text-slate-400">{b.id}</td>
                                <td className="px-4 py-3"><p className="text-sm font-medium text-slate-900">{b.resident_name || "—"}</p><p className="text-xs text-slate-400">{b.resident_email || ""}</p></td>
                                <td className="px-4 py-3 text-sm text-slate-700">{b.facility_name || "—"}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">{b.booking_date || "—"}</td>
                                <td className="px-4 py-3 text-sm font-medium text-slate-900">Rs.{parseFloat(b.total_amount || 0).toFixed(2)}</td>
                                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.payment_status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>{b.payment_status === "paid" ? "Paid" : "Unpaid"}</span></td>
                                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(b.status)}`}>{b.status ? b.status.charAt(0).toUpperCase() + b.status.slice(1) : "Pending"}</span></td>
                                <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">{b.created_at ? new Date(b.created_at).toLocaleString("en-IN",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (<div className="text-center py-12"><p className="text-slate-500">No report data available yet.</p></div>)}
              </div>
            )}
          </div>
        );
      }

      // ── MAINTENANCE ──────────────────────────────────────────────────────────
      case PANELS.MAINTENANCE:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div><h1 className="text-2xl font-bold text-slate-900">Maintenance Billing</h1><p className="text-slate-500 text-sm">Generate and manage maintenance invoices</p></div>
              <button onClick={() => { setMError(""); setMMessage(""); loadMaintenanceInvoices(); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm">Refresh</button>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Generate Maintenance Invoice</h3>
              <p className="text-xs text-slate-400 mb-4">Fields marked <span className="text-red-500">*</span> are required. Leave resident empty to generate for all residents.</p>
              {mError && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl text-sm">{mError}</div>}
              {mMessage && <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl text-sm">{mMessage}</div>}
              <form onSubmit={handleGenerateInvoice} noValidate className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Resident <span className="text-slate-400 font-normal">(optional — leave blank for all residents)</span></label>
                  <select name="resident_id" value={mForm.resident_id} onChange={handleMaintenanceFormChange} className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">— All Residents —</option>
                    {activeResidentsList.map((r) => (<option key={r.id} value={r.id}>{r.full_name || r.email}{r.flat_number ? ` (Flat ${r.flat_number}${r.block_name ? `, ${r.block_name}` : ""})` : ""}</option>))}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount (Rs.) <span className="text-red-500">*</span></label>
                    <input type="number" step="0.01" name="amount" value={mForm.amount} onChange={handleMaintenanceFormChange} onBlur={() => handleMaintenanceBlur("amount")} className={fieldClass(mFormTouched.amount && mFormErrors.amount)} placeholder="5000.00"/>
                    {mFormTouched.amount && mFormErrors.amount && <p className="mt-1 text-xs text-red-500">{mFormErrors.amount}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Due Date <span className="text-red-500">*</span></label>
                    <input type="date" name="due_date" value={mForm.due_date} onChange={handleMaintenanceFormChange} onBlur={() => handleMaintenanceBlur("due_date")} className={fieldClass(mFormTouched.due_date && mFormErrors.due_date)}/>
                    {mFormTouched.due_date && mFormErrors.due_date && <p className="mt-1 text-xs text-red-500">{mFormErrors.due_date}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Month <span className="text-red-500">*</span></label>
                    <select name="month" value={mForm.month} onChange={handleMaintenanceFormChange} onBlur={() => handleMaintenanceBlur("month")} className={fieldClass(mFormTouched.month && mFormErrors.month)}>
                      <option value="">Select Month</option>
                      {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (<option key={i+1} value={i+1}>{m}</option>))}
                    </select>
                    {mFormTouched.month && mFormErrors.month && <p className="mt-1 text-xs text-red-500">{mFormErrors.month}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Year <span className="text-red-500">*</span></label>
                    <select name="year" value={mForm.year} onChange={handleMaintenanceFormChange} onBlur={() => handleMaintenanceBlur("year")} className={fieldClass(mFormTouched.year && mFormErrors.year)}>
                      <option value="">Select Year</option>
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (<option key={y} value={y}>{y}</option>))}
                    </select>
                    {mFormTouched.year && mFormErrors.year && <p className="mt-1 text-xs text-red-500">{mFormErrors.year}</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input type="text" name="notes" value={mForm.notes} onChange={handleMaintenanceFormChange} className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Parking + Sinking fund"/>
                </div>
                <div className="flex gap-3">
                  <button type="submit" disabled={mSubmitting} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors font-medium">{mSubmitting ? "Generating..." : "Generate Invoice(s)"}</button>
                  <button type="button" onClick={resetMaintenanceForm} className="px-6 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm">Reset</button>
                </div>
              </form>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Filter Invoices</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-2">Month</label><select name="month" value={mFilters.month} onChange={handleMaintenanceFilterChange} className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"><option value="">All Months</option>{["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (<option key={i+1} value={i+1}>{m}</option>))}</select></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-2">Year</label><select name="year" value={mFilters.year} onChange={handleMaintenanceFilterChange} className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"><option value="">All Years</option>{Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (<option key={y} value={y}>{y}</option>))}</select></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-2">Status</label><select name="status" value={mFilters.status} onChange={handleMaintenanceFilterChange} className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"><option value="">All</option><option value="Unpaid">Unpaid</option><option value="Paid">Paid</option><option value="Overdue">Overdue</option></select></div>
                <div className="flex items-end"><button onClick={loadMaintenanceInvoices} className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">Apply Filters</button></div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
              {mLoading ? (<div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div></div>)
              : maintenanceInvoices.length === 0 ? (<div className="p-8 text-center"><p className="text-slate-500">No maintenance invoices found</p></div>)
              : (
                <table className="min-w-full">
                  <thead className="bg-slate-50"><tr>{["ID","Resident","Period","Amount","Due Date","Status","Paid On","Actions"].map((h) => <th key={h} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>)}</tr></thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {maintenanceInvoices.map((inv) => {
                      const residentObj = residents.find((r) => String(r.id) === String(inv.resident_id));
                      const residentLabel = residentObj ? (residentObj.full_name || residentObj.email) : (inv.resident_id || "—");
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{inv.id}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{residentLabel}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{inv.month}/{inv.year}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">Rs.{inv.amount}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{inv.due_date}</td>
                          <td className="px-6 py-4 whitespace-nowrap"><span className={`px-3 py-1 rounded-full text-xs font-medium ${inv.status === "paid" ? "bg-emerald-100 text-emerald-700" : inv.status === "Overdue" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{inv.status}</span></td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{inv.paid_on || "—"}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{inv.status !== "paid" && <button onClick={() => handleMarkInvoicePaid(inv.id)} className="px-3 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 transition-colors">Mark Paid</button>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );

      // ── RESIDENTS ────────────────────────────────────────────────────────────
      case PANELS.RESIDENTS: {
        const activeResidents = residents.filter((r) => r.is_active);
        const inactiveResidents = residents.filter((r) => !r.is_active);
        const applySearch = (list) => { const q = (residentSearchQuery || "").toLowerCase(); if (!q) return list; return list.filter((r) => (r.full_name || "").toLowerCase().includes(q) || (r.email || "").toLowerCase().includes(q) || (r.flat_number || "").toLowerCase().includes(q) || (r.block_name || "").toLowerCase().includes(q)); };
        const displayList = residentsTab === "active" ? applySearch(activeResidents) : residentsTab === "inactive" ? applySearch(inactiveResidents) : applySearch(residents);
        const joinedByMonth = {}; residents.forEach((r) => { if (!r.created_at) return; const key = new Date(r.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" }); if (!joinedByMonth[key]) joinedByMonth[key] = { added: 0, removed: 0, date: new Date(r.created_at) }; joinedByMonth[key].added += 1; if (!r.is_active) joinedByMonth[key].removed += 1; });
        const monthRows = Object.entries(joinedByMonth).sort((a, b) => b[1].date - a[1].date);
        const formatDate = (d) => { if (!d) return "—"; return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); };
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div><h1 className="text-2xl font-bold text-slate-900">Residents</h1><p className="text-slate-500 text-sm">All society residents registered via sign up</p></div>
              <button onClick={() => { setResidentsError(""); setResidentsMessage(""); loadResidents(); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm">Refresh</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Residents", value: residents.length, color: "#6366f1", bg: "#eef2ff" },
                { label: "Active", value: activeResidents.length, color: "#10b981", bg: "#ecfdf5" },
                { label: "Removed", value: inactiveResidents.length, color: "#ef4444", bg: "#fef2f2" },
                { label: "Joined This Month", value: residents.filter((r) => { if (!r.created_at) return false; const d = new Date(r.created_at), now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length, color: "#f59e0b", bg: "#fffbeb" },
              ].map((s) => (<div key={s.label} style={{ background: s.bg, borderRadius: 16, padding: "18px 20px", textAlign: "center" }}><p style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</p><p style={{ fontSize: 11, color: s.color, fontWeight: 600, marginTop: 4 }}>{s.label}</p></div>))}
            </div>
            {residentsError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl text-sm">{residentsError}</div>}
            {residentsMessage && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl text-sm">{residentsMessage}</div>}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
              {[{key:"active",label:`Active (${activeResidents.length})`},{key:"inactive",label:`Removed (${inactiveResidents.length})`},{key:"report",label:"Report"}].map((t) => (<button key={t.key} onClick={() => setResidentsTab(t.key)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${residentsTab === t.key ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{t.label}</button>))}
            </div>
            {(residentsTab === "active" || residentsTab === "inactive") && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100">
                <div className="p-4 border-b border-slate-100"><input type="text" placeholder="Search by name, email, flat or block..." value={residentSearchQuery} onChange={(e) => setResidentSearchQuery(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/></div>
                {residentsLoading ? (<div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div></div>)
                : displayList.length === 0 ? (<div className="p-8 text-center"><p className="text-slate-500 font-medium">{residentSearchQuery ? "No residents match your search" : residentsTab === "active" ? "No active residents yet" : "No removed residents"}</p></div>)
                : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-slate-50"><tr>{["ID","Name","Email","Phone","Flat","Block","Joined On","Status","Action"].map((h) => (<th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>))}</tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {displayList.map((r) => (
                            <tr key={r.id} className={`hover:bg-slate-50 ${!r.is_active ? "opacity-70" : ""}`}>
                              <td className="px-5 py-3 text-xs text-slate-400">{r.id}</td>
                              <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-slate-900">{r.full_name || "—"}</td>
                              <td className="px-5 py-3 whitespace-nowrap text-sm text-slate-600">{r.email || "—"}</td>
                              <td className="px-5 py-3 whitespace-nowrap text-sm text-slate-600">{r.phone || "—"}</td>
                              <td className="px-5 py-3 whitespace-nowrap text-sm text-slate-600">{r.flat_number || "—"}</td>
                              <td className="px-5 py-3 whitespace-nowrap text-sm text-slate-600">{r.block_name || "—"}</td>
                              <td className="px-5 py-3 whitespace-nowrap text-xs text-slate-500">{formatDate(r.created_at)}</td>
                              <td className="px-5 py-3 whitespace-nowrap"><span className={`px-2 py-1 rounded-full text-xs font-medium ${r.is_active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{r.is_active ? "Active" : "Removed"}</span></td>
                              <td className="px-5 py-3 whitespace-nowrap">
                                {r.is_active ? (<button onClick={() => handleRemoveResident(r.id)} disabled={removingResidentId === r.id} className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-50">{removingResidentId === r.id ? "..." : "Remove"}</button>)
                                : (<button onClick={() => handleRestoreResident(r.id)} disabled={removingResidentId === r.id} className="px-3 py-1 text-sm text-emerald-600 hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-colors disabled:opacity-50">{removingResidentId === r.id ? "..." : "Restore"}</button>)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">Showing {displayList.length} of {residentsTab === "active" ? activeResidents.length : inactiveResidents.length} residents</div>
                  </>
                )}
              </div>
            )}
            {residentsTab === "report" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-5"><p className="text-xs text-slate-500 font-medium mb-1">Total Ever Registered</p><p className="text-3xl font-bold text-indigo-700">{residents.length}</p></div>
                  <div className="bg-white border border-slate-200 rounded-xl p-5"><p className="text-xs text-slate-500 font-medium mb-1">Currently Active</p><p className="text-3xl font-bold text-emerald-700">{activeResidents.length}</p><p className="text-xs text-slate-400 mt-1">{residents.length > 0 ? `${Math.round((activeResidents.length / residents.length) * 100)}% retention` : "—"}</p></div>
                  <div className="bg-white border border-slate-200 rounded-xl p-5"><p className="text-xs text-slate-500 font-medium mb-1">Removed / Inactive</p><p className="text-3xl font-bold text-red-600">{inactiveResidents.length}</p></div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-slate-900 mb-4">Month-wise Resident Activity</h3>
                  {monthRows.length === 0 ? (<p className="text-slate-400 text-sm text-center py-4">No data yet</p>) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full"><thead className="bg-slate-50"><tr>{["Month","New Registrations","Removed","Net Active"].map((h) => (<th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>))}</tr></thead>
                      <tbody className="divide-y divide-slate-100">{monthRows.map(([month, data]) => (<tr key={month} className="hover:bg-slate-50"><td className="px-4 py-3 text-sm font-medium text-slate-900">{month}</td><td className="px-4 py-3 text-sm font-semibold text-emerald-700">+{data.added}</td><td className="px-4 py-3 text-sm font-semibold text-red-600">{data.removed > 0 ? `-${data.removed}` : "—"}</td><td className="px-4 py-3 text-sm font-semibold text-indigo-700">{data.added - data.removed}</td></tr>))}</tbody></table>
                    </div>
                  )}
                </div>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Full Resident History</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Every resident that ever signed up with their current status</p>
                    </div>
                    <input type="text" placeholder="Search..." value={residentSearchQuery} onChange={(e) => setResidentSearchQuery(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"/>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-slate-50"><tr>{["ID","Name","Email","Flat","Block","Joined On","Status"].map((h) => (<th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>))}</tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {displayList.length === 0 ? (
                          <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">No residents match your search</td></tr>
                        ) : displayList.map((r) => (
                          <tr key={r.id} className={`hover:bg-slate-50 ${!r.is_active ? "opacity-60" : ""}`}>
                            <td className="px-4 py-3 text-xs text-slate-400">{r.id}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900">{r.full_name || "—"}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">{r.email || "—"}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">{r.flat_number || "—"}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">{r.block_name || "—"}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">{formatDate(r.created_at)}</td>
                            <td className="px-4 py-3 whitespace-nowrap"><span className={`px-2 py-1 rounded-full text-xs font-medium ${r.is_active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{r.is_active ? "Active" : "Removed"}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">Showing {displayList.length} of {residents.length} total residents</div>
                </div>
              </div>
            )}
          </div>
        );
      }

      // ── PAYMENTS ─────────────────────────────────────────────────────────────
      case PANELS.PAYMENTS:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div><h1 className="text-2xl font-bold text-slate-900">Payments Overview</h1><p className="text-slate-500 text-sm">Monitor payment transactions and financial activities</p></div>
              <button onClick={() => { loadPaymentsOverview(); setPaymentsKey((k) => k + 1); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm">Refresh</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Completed", value: `Rs.${paymentTotals.completed.toFixed(2)}`, color: "#059669", bg: "#ecfdf5" },
                { label: "Pending Invoices", value: pendingCount, color: "#d97706", bg: "#fffbeb" },
                { label: "Failed Payments", value: failedCount, color: "#ef4444", bg: "#fef2f2" },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 16, padding: "20px 22px" }}>
                  <p style={{ fontSize: 11, color: s.color, fontWeight: 600, marginBottom: 4 }}>{s.label}</p>
                  <p style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Payment Management</h3>
              <AdminPaymentsSection key={paymentsKey} residents={activeResidentsList} />
            </div>
          </div>
        );

      default:
        return <div className="text-center py-12"><h2 className="text-xl font-semibold text-slate-900">Panel Not Found</h2></div>;
    }
  };

  // ─── Layout ────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: "linear-gradient(135deg, #f0f4ff 0%, #fafbff 50%, #f0f7ff 100%)", minHeight: "100vh", display: "flex" }}>

      {/* ── Sidebar ── */}
      <div style={{
        width: 240,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(20px)",
        borderRight: "1px solid rgba(99,102,241,0.1)",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh",
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(99,102,241,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: "linear-gradient(135deg, #4f46e5, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🏢</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#1e1b4b", letterSpacing: "-0.3px" }}>SmartSociety</div>
              <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", marginTop: 1 }}>Admin Portal</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 10px", overflowY: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {navItems.map((item) => {
              const isActive = activePanel === item.id;
              const badge = panelBadges[item.id];
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePanel(item.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    borderRadius: 10,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "#4f46e5" : "#64748b",
                    background: isActive ? "linear-gradient(135deg, #eef2ff, #f5f3ff)" : "transparent",
                    boxShadow: isActive ? "0 1px 6px rgba(99,102,241,0.12)" : "none",
                    textAlign: "left",
                    transition: "all 0.15s",
                    position: "relative",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#f8faff"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  {isActive && <div style={{ position: "absolute", left: 0, top: "20%", bottom: "20%", width: 3, borderRadius: 4, background: "linear-gradient(180deg, #4f46e5, #7c3aed)" }} />}
                  <span style={{ fontSize: 17 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {badge > 0 && (
                    <span style={{ background: "#ef4444", color: "white", borderRadius: "50%", minWidth: 18, height: 18, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, padding: "0 4px" }}>{badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* User + Logout */}
        <div style={{ padding: "12px 14px 16px", borderTop: "1px solid rgba(99,102,241,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "#f8faff", marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #4f46e5, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{displayName[0]?.toUpperCase()}</div>
            <div className="min-w-0">
              <p style={{ fontSize: 12, fontWeight: 700, color: "#1e1b4b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</p>
              <p style={{ fontSize: 10, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 9, border: "1.5px solid #fecaca", background: "white", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <span>🚪</span> Logout
          </button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(99,102,241,0.1)", padding: "0 24px", position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 700, color: "#1e1b4b" }}>{navItems.find((item) => item.id === activePanel)?.icon} {navItems.find((item) => item.id === activePanel)?.label || "Dashboard"}</h1>
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <NotificationBell />
              <div style={{ width: 1, height: 28, background: "#e2e8f0" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #4f46e5, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 13 }}>{displayName[0]?.toUpperCase()}</div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#1e1b4b" }}>{displayName}</p>
                  <p style={{ fontSize: 10, color: "#94a3b8" }}>Administrator</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel content */}
        <div style={{ flex: 1, padding: "28px 28px", overflowY: "auto" }}>
          {renderPanel()}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;