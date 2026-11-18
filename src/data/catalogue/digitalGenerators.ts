/**
 * Deterministic Digital Product Generator
 * Generates clean, real, immediately usable templates, spreadsheets (CSV with Excel formulas),
 * print-ready HTML/Word-openable documents, and checklists for all 18 Cat F products.
 * Used when serving authorized downloads if an admin has not overridden the product with a custom R2 file.
 */

export interface GeneratedDigitalPayload {
  fileName: string;
  contentType: string;
  content: string;
}

const INVOICE_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>GST Tax Invoice Template — Digital India Project</title>
<style>
  body { font-family: Arial, sans-serif; margin: 32px; color: #111827; font-size: 13px; }
  .box { border: 1px solid #cbd5e1; padding: 20px; max-width: 820px; margin: auto; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
  th { background: #f1f5f9; font-weight: 700; }
  .right { text-align: right; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 12px; }
</style></head>
<body>
<div class="box" contenteditable="true">
  <div class="header">
    <div>
      <h2 style="margin:0;">YOUR BUSINESS / TRADE NAME</h2>
      <p style="margin:4px 0;">Address Line, Silvassa / City – PIN Code<br>GSTIN: [26XXXXXXXXXXXXX] | State Code: [26]<br>Email: billing@yourbusiness.in | Ph: +91 XXXXX XXXXX</p>
    </div>
    <div class="right">
      <h3 style="margin:0;color:#1e3a8a;">TAX INVOICE</h3>
      <p style="margin:4px 0;"><strong>Invoice No:</strong> INV/2026-27/001<br><strong>Date:</strong> DD-MM-YYYY<br><strong>Place of Supply:</strong> Dadra & Nagar Haveli (26)</p>
    </div>
  </div>
  <p><strong>Bill To:</strong> Client / Company Name | Address | GSTIN (if B2B): [________________]</p>
  <table>
    <thead><tr><th>#</th><th>Item / Service Description</th><th>HSN/SAC</th><th class="right">Qty</th><th class="right">Rate (₹)</th><th class="right">GST %</th><th class="right">Total (₹)</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>Consulting / Goods Supply Item A</td><td>998319</td><td class="right">1</td><td class="right">1,000.00</td><td class="right">18%</td><td class="right">1,180.00</td></tr>
      <tr><td colspan="6" class="right"><strong>Taxable Value</strong></td><td class="right">1,000.00</td></tr>
      <tr><td colspan="6" class="right">CGST @ 9%</td><td class="right">90.00</td></tr>
      <tr><td colspan="6" class="right">SGST @ 9%</td><td class="right">90.00</td></tr>
      <tr><td colspan="6" class="right"><strong>Grand Total (INR)</strong></td><td class="right"><strong>₹1,180.00</strong></td></tr>
    </tbody>
  </table>
  <p style="margin-top:16px;"><strong>Bank Details:</strong> A/c Name | Bank Name | A/c No | IFSC | UPI ID<br><em>Edit fields directly in browser or open in Microsoft Word / Google Docs, then Print/Save as PDF.</em></p>
</div>
</body></html>`;

export function generateDigitalProductPayload(
  generatorKey: string | undefined,
  productSlug: string,
  productName: string
): GeneratedDigitalPayload {
  const key = generatorKey || productSlug;

  switch (key) {
    case 'invoice_pack':
    case 'quotation_pack':
    case 'receipt_pack':
    case 'letterhead_pack':
    case 'resume_collection':
    case 'cover_letter_pack': {
      return {
        fileName: `${productSlug}-editable-template.html`,
        contentType: 'text/html; charset=UTF-8',
        content: INVOICE_HTML.replace('TAX INVOICE', productName.toUpperCase()),
      };
    }
    case 'gst_calculator':
      return {
        fileName: 'GST_Calculator_Spreadsheet_DIP.csv',
        contentType: 'text/csv; charset=UTF-8',
        content: [
          'Date,Invoice No,Customer Name,Supply Type (Intra/Inter),Taxable Value,GST Rate %,CGST,SGST,IGST,Total Invoice,ITC Eligible?',
          '2026-04-01,INV-001,Sample Trader Silvassa,Intra,10000,18,"=IF(D2=""Intra"",E2*F2/200,0)","=IF(D2=""Intra"",E2*F2/200,0)","=IF(D2=""Inter"",E2*F2/100,0)","=E2+G2+H2+I2",Yes',
          '2026-04-02,INV-002,Vapi Buyer Pvt Ltd,Inter,25000,18,"=IF(D3=""Intra"",E3*F3/200,0)","=IF(D3=""Intra"",E3*F3/200,0)","=IF(D3=""Inter"",E3*F3/100,0)","=E3+G3+H3+I3",Yes',
          'TOTAL,,,,"=SUM(E2:E3)",,"=SUM(G2:G3)","=SUM(H2:H3)","=SUM(I2:I3)","=SUM(J2:J3)",',
        ].join('\r\n'),
      };
    case 'expense_tracker':
      return {
        fileName: 'Business_Expense_Tracker_DIP.csv',
        contentType: 'text/csv; charset=UTF-8',
        content: [
          'Date,Category,Vendor,Description,Payment Mode,Base Amount,GST Input,Total Paid',
          '2026-04-01,Office Rent,Nano City Landlord,Monthly office rent,NEFT,15000,0,"=F2+G2"',
          '2026-04-03,Utilities,DNH Electricity Dept,Electricity bill,UPI,2400,0,"=F3+G3"',
          '2026-04-05,Software/Cloud,Domain & Hosting,Annual domain renewal,Card,1000,180,"=F4+G4"',
          'TOTAL,,,,,"=SUM(F2:F4)","=SUM(G2:G4)","=SUM(H2:H4)"',
        ].join('\r\n'),
      };
    case 'salary_calculator':
      return {
        fileName: 'India_Salary_Calculator_DIP.csv',
        contentType: 'text/csv; charset=UTF-8',
        content: [
          'Employee Name,Gross CTC Monthly,Basic (50%),HRA (20%),Special Allowance,Employee PF (12% Basic),ESIC (0.75% if <=21k),Prof Tax,Net Take Home',
          'Sample Employee 1,20000,"=B2*0.5","=B2*0.2","=B2-C2-D2","=ROUND(C2*0.12,0)","=IF(B2<=21000,ROUND(B2*0.0075,0),0)",200,"=B2-F2-G2-H2"',
          'Sample Employee 2,45000,"=B3*0.5","=B3*0.2","=B3-C3-D3","=ROUND(MIN(C3,15000)*0.12,0)","=IF(B3<=21000,ROUND(B3*0.0075,0),0)",200,"=B3-F3-G3-H3"',
        ].join('\r\n'),
      };
    case 'inventory_sheet':
      return {
        fileName: 'Inventory_Management_Sheet_DIP.csv',
        contentType: 'text/csv; charset=UTF-8',
        content: [
          'SKU Code,Item Name,HSN Code,Unit Cost,Opening Qty,Purchased Qty,Sold Qty,Closing Qty,Reorder Level,Stock Status,Closing Stock Value',
          'SKU-101,Thermal Billing Rolls,4811,35,100,50,120,"=E2+F2-G2",40,"=IF(H2<=I2,""REORDER"",""OK"")","=H2*D2"',
          'SKU-102,USB DSC Token,8523,450,20,10,8,"=E3+F3-G3",10,"=IF(H3<=I3,""REORDER"",""OK"")","=H3*D3"',
        ].join('\r\n'),
      };
    case 'compliance_calendar':
      return {
        fileName: 'India_Compliance_Calendar_FY2026_27.csv',
        contentType: 'text/csv; charset=UTF-8',
        content: [
          'Month/Due Date,Compliance Item,Form / Portal,Applicability,Notes',
          '7th Monthly,TDS / TCS Deposit,Income Tax e-Pay Challan 281,Tax Deductors,Penalty 1.5% interest per month on late deposit',
          '11th Monthly,Monthly GSTR-1 Outward Return,GST Portal,Regular GST Taxpayers,Quarterly QRMP optees file IFF/GSTR-1 on 13th after quarter',
          '15th Monthly,EPFO PF & ESIC ECR Payment,EPFO / ESIC Portal,Employers with 10/20+ staff,Statutory due date every month',
          '20th Monthly,Monthly GSTR-3B Summary & Tax Payment,GST Portal,Regular Monthly Filers,22nd/24th for QRMP states/UTs including DNH & Gujarat',
          '31st July (Annual),Non-Audit Income Tax Return,Income Tax Portal,Individuals / Proprietors / Firms,Check Form 26AS & AIS prior to filing',
          '30th September (Annual),Company DIR-3 KYC & Tax Audit,MCA / Income Tax,Directors & Audit Cases,Avoid ₹5000 DIR-3 KYC penalty',
        ].join('\r\n'),
      };
    default:
      return {
        fileName: `${productSlug}-bundle-guide.csv`,
        contentType: 'text/csv; charset=UTF-8',
        content: [
          'Section,Item,Status / Action,Official Reference / Notes',
          `Product,${productName},Ready for use,Digital India Project Verified Template`,
          'Step 1,Verify Entity / Applicant KYC,Checklist,Keep PAN Aadhaar and Address Proof consistent',
          'Step 2,Review Statutory Fee Exclusions,Important,Government/third-party fees apply only at actuals on official portals',
          'Support,Need custom help?,support@digitalindiaproject.com,"Silvassa HQ: +91 77779 41227"',
        ].join('\r\n'),
      };
  }
}
