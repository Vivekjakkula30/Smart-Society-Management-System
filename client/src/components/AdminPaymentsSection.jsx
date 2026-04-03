// client/src/components/AdminPaymentsSection.jsx
import React, { useEffect, useState } from "react";
import { fetchAllPayments, createPayment, markInvoicePaid } from "../services/paymentService";
import { fetchAllMaintenance } from "../services/maintenanceService";
import { fetchAllResidents } from "../services/residentService";

const PAYMENT_METHODS = ["Offline", "Online", "Cash", "Cheque", "UPI", "Bank Transfer"];

const validateForm = (form) => {
  const errors = {};
  if (!form.resident_id) errors.resident_id = "Please select a resident.";
  if (!form.amount) errors.amount = "Amount is required.";
  else if (isNaN(Number(form.amount)) || Number(form.amount) <= 0)
    errors.amount = "Amount must be greater than 0.";
  if (!form.payment_method) errors.payment_method = "Payment method is required.";
  return errors;
};

export default function AdminPaymentsSection({ residents: propResidents }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [residents, setResidents] = useState(propResidents || []);
  const [residentsLoading, setResidentsLoading] = useState(false);

  const [form, setForm] = useState({
    maintenance_invoice_id: "",
    resident_id: "",
    amount: "",
    payment_method: "Offline",
    notes: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [formTouched, setFormTouched] = useState({});

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [markingPaid, setMarkingPaid] = useState(null);

  // ── Loaders ──────────────────────────────────────────────────────────────

  const loadResidents = async () => {
    // Use prop if already provided by parent (AdminDashboard)
    if (propResidents && propResidents.length > 0) {
      setResidents(propResidents);
      return;
    }
    try {
      setResidentsLoading(true);
      const data = await fetchAllResidents();
      const list = Array.isArray(data) ? data : data.residents || [];
      setResidents(list.filter((r) => r.is_active));
    } catch (err) {
      console.warn("Could not load residents for payments dropdown:", err);
    } finally {
      setResidentsLoading(false);
    }
  };

  const loadPayments = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await fetchAllPayments();
      setPayments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  const loadInvoices = async () => {
    try {
      const data = await fetchAllMaintenance({});
      setInvoices(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Load invoices failed", err);
    }
  };

  useEffect(() => {
    loadResidents();
    loadPayments();
    loadInvoices();
    
  }, []);

  // Sync if parent passes updated residents later
  useEffect(() => {
    if (propResidents && propResidents.length > 0) setResidents(propResidents);
  }, [propResidents]);

  // ── When a invoice is selected, auto-fill resident + amount ──────────────
  const handleInvoiceSelect = (e) => {
    const invoiceId = e.target.value;
    const invoice = invoices.find((i) => String(i.id) === String(invoiceId));
    setForm((prev) => ({
      ...prev,
      maintenance_invoice_id: invoiceId,
      resident_id: invoice ? String(invoice.resident_id) : prev.resident_id,
      amount: invoice ? String(invoice.amount) : prev.amount,
    }));
    // Re-validate touched fields
    if (Object.keys(formTouched).length > 0) {
      setFormErrors(validateForm({
        ...form,
        maintenance_invoice_id: invoiceId,
        resident_id: invoice ? String(invoice.resident_id) : form.resident_id,
        amount: invoice ? String(invoice.amount) : form.amount,
      }));
    }
  };

  // ── Form field change ─────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (formTouched[name]) {
      setFormErrors(validateForm({ ...form, [name]: value }));
    }
  };

  const handleBlur = (field) => {
    setFormTouched((prev) => ({ ...prev, [field]: true }));
    setFormErrors(validateForm(form));
  };

  const resetForm = () => {
    setForm({ maintenance_invoice_id: "", resident_id: "", amount: "", payment_method: "Offline", notes: "" });
    setFormErrors({});
    setFormTouched({});
    setError("");
    setSuccess("");
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");

    // Touch all required fields
    const allTouched = { resident_id: true, amount: true, payment_method: true };
    setFormTouched(allTouched);
    const errors = validateForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      const payload = {
        maintenance_invoice_id: form.maintenance_invoice_id || null,
        resident_id: Number(form.resident_id),
        amount: Number(form.amount),
        payment_method: form.payment_method,
        notes: form.notes,
      };
      const res = await createPayment(payload);
      setSuccess(res.message || "Payment recorded successfully");
      resetForm();
      await loadPayments();
      await loadInvoices();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to create payment");
    }
  };

  // ── Mark invoice paid ─────────────────────────────────────────────────────
  const handleMarkPaid = async (payment) => {
    const invoiceId = payment.invoice_id;
    if (!invoiceId) {
      alert("This payment has no linked invoice to mark as paid.");
      return;
    }
    if (!window.confirm(`Mark invoice #${invoiceId} as paid?`)) return;

    const invoice = invoices.find((i) => Number(i.id) === Number(invoiceId));
    const resident_id = invoice ? invoice.resident_id : payment.resident_id;
    const amount = invoice ? invoice.amount : payment.amount;

    if (!resident_id || !amount) {
      alert("Could not determine resident or amount. Please refresh and try again.");
      return;
    }

    try {
      setMarkingPaid(invoiceId);
      const res = await markInvoicePaid(invoiceId, {
        invoiceId,
        resident_id: Number(resident_id),
        amount: Number(amount),
        payment_method: "Offline",
      });
      setSuccess(res.message || "Invoice marked as paid!");
      await loadPayments();
      await loadInvoices();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Failed to mark as paid");
    } finally {
      setMarkingPaid(null);
    }
  };

  // ── Download receipt ──────────────────────────────────────────────────────
  const handleDownload = async (paymentId) => {
    try {
      const token = localStorage.getItem("token");
      const apiBase = process.env.REACT_APP_API_URL || "http://localhost:5000";
      const res = await fetch(`${apiBase}/api/payments/receipt/${paymentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || "Failed to download receipt");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${paymentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
      alert("Failed to download receipt");
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const fieldClass = (hasError) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
      hasError ? "border-red-400 bg-red-50" : "border-slate-200"
    }`;

  const residentLabel = (id) => {
    const r = residents.find((res) => String(res.id) === String(id));
    return r
      ? `${r.full_name || r.email}${r.flat_number ? ` (Flat ${r.flat_number}${r.block_name ? `, ${r.block_name}` : ""})` : ""}`
      : `Resident #${id}`;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Record Payment Form ─────────────────────────────────────────── */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
        <h4 className="text-base font-semibold text-slate-900 mb-1">Record Payment</h4>
        <p className="text-xs text-slate-400 mb-4">
          Fields marked <span className="text-red-500">*</span> are required. Optionally link to an unpaid invoice to auto-fill details.
        </p>

        {error   && <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}
        {success && <div className="mb-3 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-lg text-sm">{success}</div>}

        <form onSubmit={handleCreate} noValidate className="space-y-4">

          {/* Link to invoice (optional) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Link to Invoice <span className="text-slate-400 font-normal">(optional — auto-fills resident &amp; amount)</span>
            </label>
            <select
              name="maintenance_invoice_id"
              value={form.maintenance_invoice_id}
              onChange={handleInvoiceSelect}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">— No invoice link —</option>
              {invoices
                .filter((inv) => inv.status !== "paid")
                .map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    #{inv.id} • {inv.month}/{inv.year} • Rs.{inv.amount} •{" "}
                    {residents.find((r) => String(r.id) === String(inv.resident_id))?.full_name || `Resident ${inv.resident_id}`}
                  </option>
                ))}
            </select>
          </div>

          {/* Resident dropdown */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Resident <span className="text-red-500">*</span>
            </label>
            <select
              name="resident_id"
              value={form.resident_id}
              onChange={handleChange}
              onBlur={() => handleBlur("resident_id")}
              className={fieldClass(formTouched.resident_id && formErrors.resident_id)}
              disabled={residentsLoading}
            >
              <option value="">
                {residentsLoading ? "Loading residents..." : "— Select Resident —"}
              </option>
              {residents.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name || r.email}
                  {r.flat_number ? ` (Flat ${r.flat_number}${r.block_name ? `, ${r.block_name}` : ""})` : ""}
                </option>
              ))}
            </select>
            {formTouched.resident_id && formErrors.resident_id && (
              <p className="mt-1 text-xs text-red-500">{formErrors.resident_id}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Amount (Rs.) <span className="text-red-500">*</span>
              </label>
              <input
                type="number" step="0.01" name="amount" value={form.amount}
                onChange={handleChange} onBlur={() => handleBlur("amount")}
                placeholder="5000.00"
                className={fieldClass(formTouched.amount && formErrors.amount)}
              />
              {formTouched.amount && formErrors.amount && (
                <p className="mt-1 text-xs text-red-500">{formErrors.amount}</p>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <select
                name="payment_method" value={form.payment_method}
                onChange={handleChange} onBlur={() => handleBlur("payment_method")}
                className={fieldClass(formTouched.payment_method && formErrors.payment_method)}
              >
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              {formTouched.payment_method && formErrors.payment_method && (
                <p className="mt-1 text-xs text-red-500">{formErrors.payment_method}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text" name="notes" value={form.notes}
              onChange={handleChange}
              placeholder="e.g. March maintenance payment"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
            >
              Record Payment
            </button>
            <button
              type="button" onClick={resetForm}
              className="px-6 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* ── Payments List ───────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900">Recent Payments</h4>
          <button
            onClick={() => { loadPayments(); loadInvoices(); }}
            className="text-indigo-600 text-xs hover:underline"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto mb-2"></div>
            <p className="text-slate-500 text-sm">Loading payments...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-500 text-sm font-medium">No payment records yet</p>
            <p className="text-slate-400 text-xs mt-1">Use the form above to record a payment</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  {["#", "Resident", "Amount", "Method", "Invoice", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => {
                  const linkedInvoice = invoices.find((i) => Number(i.id) === Number(p.invoice_id));
                  const isUnpaid = linkedInvoice ? linkedInvoice.status !== "paid" : false;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs text-slate-400">#{p.id}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-sm font-medium text-slate-900">
                          {p.resident_name || residentLabel(p.resident_id)}
                        </p>
                        {p.resident_id && (
                          <p className="text-xs text-slate-400">ID: {p.resident_id}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-slate-900">
                        Rs.{parseFloat(p.amount || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {p.payment_method || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                        {p.invoice_id ? (
                          <span className="flex items-center gap-1">
                            #{p.invoice_id}
                            {linkedInvoice && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${linkedInvoice.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                {linkedInvoice.status}
                              </span>
                            )}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {p.invoice_id && isUnpaid && (
                            <button
                              onClick={() => handleMarkPaid(p)}
                              disabled={markingPaid === p.invoice_id}
                              className="px-2 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                            >
                              {markingPaid === p.invoice_id ? "Marking..." : "Mark Paid"}
                            </button>
                          )}
                          {p.invoice_id && !isUnpaid && linkedInvoice && (
                            <span className="text-emerald-600 text-xs font-semibold">✓ Paid</span>
                          )}
                          <button
                            onClick={() => handleDownload(p.id)}
                            className="px-2 py-1 text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded text-xs transition-colors"
                          >
                            Receipt
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}