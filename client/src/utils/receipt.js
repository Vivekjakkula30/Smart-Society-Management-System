// client/src/utils/receipt.js
// Client-side PDF receipt generation using browser's print API (no external library needed)

export const generateReceiptPdf = (payment, user) => {
  const receiptNumber = payment.receipt_number || `RCPT-${payment.id}-${Date.now()}`;
  const residentName = user?.name || user?.fullName || "Resident";
  const residentId = user?.id || "-";
  const date = payment.payment_date
    ? new Date(payment.payment_date).toLocaleDateString("en-IN", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN", {
        day: "2-digit", month: "long", year: "numeric",
      });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Receipt - ${receiptNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; background: #fff; }
        .header { text-align: center; margin-bottom: 32px; border-bottom: 2px solid #4f46e5; padding-bottom: 20px; }
        .header h1 { font-size: 26px; color: #4f46e5; font-weight: 800; letter-spacing: 1px; }
        .header p { font-size: 13px; color: #64748b; margin-top: 4px; }
        .badge { display: inline-block; background: #d1fae5; color: #065f46; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 8px; }
        .receipt-box { border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; margin-bottom: 24px; }
        .receipt-title { font-size: 13px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
        .row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
        .row .label { color: #64748b; }
        .row .value { font-weight: 600; color: #1e293b; }
        .amount-row { background: #f8fafc; border-radius: 8px; padding: 14px 16px; margin-top: 8px; }
        .amount-row .label { font-size: 15px; font-weight: 700; color: #1e293b; }
        .amount-row .value { font-size: 20px; font-weight: 800; color: #4f46e5; }
        .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 32px; border-top: 1px dashed #e2e8f0; padding-top: 16px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🏢 Smart Society</h1>
        <p>Society Management System</p>
        <div class="badge">✓ Payment Confirmed</div>
      </div>

      <div class="receipt-box">
        <div class="receipt-title">Receipt Details</div>
        <div class="row"><span class="label">Resident Name</span><span class="value">${residentName}</span></div>
        <div class="row"><span class="label">Resident ID</span><span class="value">${residentId}</span></div>
        <div class="row"><span class="label">Receipt Number</span><span class="value">${receiptNumber}</span></div>
        <div class="row"><span class="label">Payment Date</span><span class="value">${date}</span></div>
        <div class="row"><span class="label">Payment Method</span><span class="value">${payment.payment_method || "Offline"}</span></div>
        ${payment.transaction_id ? `<div class="row"><span class="label">Transaction ID</span><span class="value">${payment.transaction_id}</span></div>` : ""}
        <div class="row amount-row"><span class="label">Amount Paid</span><span class="value">₹${Number(payment.amount).toLocaleString("en-IN")}</span></div>
      </div>

      ${payment.invoice_month || payment.invoice_year ? `
      <div class="receipt-box">
        <div class="receipt-title">Invoice Details</div>
        ${payment.invoice_month ? `<div class="row"><span class="label">Billing Period</span><span class="value">${payment.invoice_month}/${payment.invoice_year}</span></div>` : ""}
        ${payment.invoice_amount ? `<div class="row"><span class="label">Invoice Amount</span><span class="value">₹${Number(payment.invoice_amount).toLocaleString("en-IN")}</span></div>` : ""}
      </div>
      ` : ""}

      <div class="footer">
        <p>This is a computer-generated receipt. No signature required.</p>
        <p style="margin-top:4px;">Smart Society Management • Generated on ${new Date().toLocaleString("en-IN")}</p>
      </div>
    </body>
    </html>
  `;

  // Open in new window and trigger print (saves as PDF)
  const win = window.open("", "_blank", "width=700,height=900");
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
};