// client/src/components/ResidentPayments.jsx
import React, { useEffect, useState } from "react";
import { fetchResidentMaintenance } from "../services/maintenanceService";
import { fetchResidentPayments, createPayment } from "../services/paymentService";
import { getCurrentUser } from "../utils/auth";
import { generateReceiptPdf } from "../utils/receipt";

export default function ResidentPayments() {
  const user = getCurrentUser();
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const inv = await fetchResidentMaintenance(user.id);
      setInvoices(Array.isArray(inv) ? inv : []);
      const p = await fetchResidentPayments(user.id);
      setPayments(Array.isArray(p) ? p : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Format date nicely
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const handleOfflinePay = async (invoice) => {
    if (!window.confirm(`Record offline payment of ₹${invoice.amount} for ${invoice.month}/${invoice.year}?`)) return;
    setProcessingId(invoice.id);
    setMessage("");
    try {
      const res = await createPayment({
        invoice_id: invoice.id,
        resident_id: user.id,
        amount: invoice.amount,
        payment_method: "Offline",
        notes: "Recorded by resident (cash/cheque)",
      });
      setMessage("✅ Offline payment recorded successfully!");
      await load();
    } catch (err) {
      console.error(err);
      setMessage("❌ " + (err?.response?.data?.message || "Failed to record payment"));
    } finally {
      setProcessingId(null);
    }
  };

  // Dummy online payment — simulates a payment gateway
  const handleOnlinePay = async (invoice) => {
    setProcessingId(invoice.id);
    setMessage("");

    // Simulate gateway loading
    const confirmed = window.confirm(
      `💳 Online Payment\n\nAmount: ₹${invoice.amount}\nPeriod: ${invoice.month}/${invoice.year}\n\nClick OK to simulate payment success.`
    );

    if (!confirmed) {
      setProcessingId(null);
      return;
    }

    try {
      // Simulate processing delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const res = await createPayment({
        invoice_id: invoice.id,
        resident_id: user.id,
        amount: invoice.amount,
        payment_method: "Online",
        transaction_id: transactionId,
        notes: "Online payment (simulated)",
      });

      setMessage(`✅ Online payment successful! Transaction ID: ${transactionId}`);
      await load();
    } catch (err) {
      console.error(err);
      setMessage("❌ " + (err?.response?.data?.message || "Online payment failed"));
    } finally {
      setProcessingId(null);
    }
  };

  const handleDownloadReceipt = (payment) => {
    generateReceiptPdf(payment, user);
  };

  const unpaidInvoices = invoices.filter(
    (inv) => inv.status === "unpaid" || inv.status === "Unpaid" || inv.status === "overdue" || inv.status === "Overdue"
  );

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-800">Maintenance & Payments</h3>

      {message && (
        <div className={`text-xs px-3 py-2 rounded-lg ${
          message.startsWith("✅") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-500">Loading...</p>
      ) : (
        <>
          {/* Unpaid Invoices */}
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">This Month</div>
            {unpaidInvoices.length === 0 ? (
              <p className="text-xs text-slate-500 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
                🎉 No unpaid invoices!
              </p>
            ) : (
              unpaidInvoices.map((inv) => (
                <div key={inv.id} className="border border-slate-200 rounded-xl p-3 mb-2 flex justify-between items-center gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      ₹{Number(inv.amount).toLocaleString("en-IN")}
                    </div>
                    <div className="text-xs text-slate-500">
                      Due: {formatDate(inv.due_date)} • {inv.month}/{inv.year}
                    </div>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      inv.status?.toLowerCase() === "overdue"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {inv.status}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOfflinePay(inv)}
                      disabled={processingId === inv.id}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-emerald-700 transition"
                    >
                      {processingId === inv.id ? "Processing..." : "Mark Paid (Offline)"}
                    </button>
                    <button
                      onClick={() => handleOnlinePay(inv)}
                      disabled={processingId === inv.id}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-indigo-700 transition"
                    >
                      {processingId === inv.id ? "Processing..." : "Pay Online"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Payment History */}
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Payments</div>
            {payments.length === 0 ? (
              <p className="text-xs text-slate-500">No payments recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="border border-slate-200 rounded-xl p-3 flex justify-between items-center">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        ₹{Number(p.amount).toLocaleString("en-IN")} • {p.payment_method}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDate(p.payment_date)}
                        {p.transaction_id ? ` • TXN: ${p.transaction_id}` : ""}
                      </div>
                      {p.receipt_number && (
                        <div className="text-xs text-slate-400">Receipt: {p.receipt_number}</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDownloadReceipt(p)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium transition"
                    >
                      📄 Download Receipt
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}