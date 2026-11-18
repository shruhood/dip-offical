import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';

export interface LineItem {
  description: string;
  hsn?: string;
  qty: number;
  rate: number;
  gstPct: number;
}

export interface BusinessDocPayload {
  docType: string;
  docNumber: string;
  date: string;
  senderName: string;
  senderGstin?: string;
  senderAddress: string;
  senderPhone?: string;
  recipientName: string;
  recipientGstin?: string;
  recipientAddress: string;
  subject?: string;
  bodyText?: string;
  items?: LineItem[];
  interState?: boolean;
  notes?: string;
}

export async function generateBusinessPdf(payload: BusinessDocPayload): Promise<{
  blob: Blob;
  filename: string;
}> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage(PageSizes.A4);
  const { width, height } = page.getSize();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  const clean = (s: string) => (s || '').replace(/[^\x20-\x7E]/g, ' ');
  const margin = 42;
  let y = height - 48;

  // Top Header Band
  page.drawRectangle({
    x: 0,
    y: height - 92,
    width,
    height: 92,
    color: rgb(0.96, 0.77, 0.26), // BakeWeb #F5C542
  });

  page.drawText(clean(payload.senderName || 'BakeWeb Business Services'), {
    x: margin,
    y: height - 42,
    size: 18,
    font: bold,
    color: rgb(0.14, 0.14, 0.14),
  });
  page.drawText(
    clean(`${payload.senderAddress || ''} ${payload.senderPhone ? `| Ph: ${payload.senderPhone}` : ''}`),
    {
      x: margin,
      y: height - 60,
      size: 9.5,
      font: regular,
      color: rgb(0.2, 0.2, 0.2),
    }
  );
  if (payload.senderGstin) {
    page.drawText(clean(`GSTIN: ${payload.senderGstin}`), {
      x: margin,
      y: height - 74,
      size: 9.5,
      font: bold,
      color: rgb(0.18, 0.18, 0.18),
    });
  }

  const titleMap: Record<string, string> = {
    invoice: 'INVOICE',
    'gst-invoice': 'TAX INVOICE',
    quotation: 'QUOTATION / ESTIMATE',
    receipt: 'PAYMENT RECEIPT',
    challan: 'DELIVERY CHALLAN',
    po: 'PURCHASE ORDER',
    'salary-slip': 'PAYSLIP / SALARY SLIP',
    experience: 'EXPERIENCE CERTIFICATE',
    'offer-letter': 'OFFER OF EMPLOYMENT',
    resignation: 'RESIGNATION LETTER',
    letterhead: 'OFFICIAL LETTERHEAD',
    certificate: 'CERTIFICATE OF COMPLETION',
    'print-receipt': 'PRINT & COPY RECEIPT',
    'service-bill': 'CUSTOMER SERVICE BILL',
    resume: 'CURRICULUM VITAE / BIODATA',
  };

  const docTitle = titleMap[payload.docType] || 'OFFICIAL DOCUMENT';
  const titleW = bold.widthOfTextAtSize(docTitle, 14);
  page.drawText(docTitle, {
    x: width - margin - titleW,
    y: height - 42,
    size: 14,
    font: bold,
    color: rgb(0.14, 0.14, 0.14),
  });
  page.drawText(clean(`Ref: ${payload.docNumber}  |  Date: ${payload.date}`), {
    x: width - margin - 180,
    y: height - 60,
    size: 9.5,
    font: regular,
    color: rgb(0.2, 0.2, 0.2),
  });

  y = height - 122;

  // Recipient block
  page.drawText(clean(`To: ${payload.recipientName || 'Customer / Applicant'}`), {
    x: margin,
    y,
    size: 11,
    font: bold,
    color: rgb(0.14, 0.14, 0.14),
  });
  y -= 16;
  if (payload.recipientAddress) {
    page.drawText(clean(payload.recipientAddress), {
      x: margin,
      y,
      size: 10,
      font: regular,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= 14;
  }
  if (payload.recipientGstin) {
    page.drawText(clean(`Recipient GSTIN: ${payload.recipientGstin}`), {
      x: margin,
      y,
      size: 9.5,
      font: regular,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= 16;
  }

  y -= 10;

  // If itemized billing table exists
  if (payload.items && payload.items.length > 0) {
    page.drawRectangle({
      x: margin,
      y: y - 18,
      width: width - margin * 2,
      height: 22,
      color: rgb(0.94, 0.94, 0.92),
    });

    page.drawText('Description', { x: margin + 8, y: y - 11, size: 9.5, font: bold });
    page.drawText('Qty', { x: 300, y: y - 11, size: 9.5, font: bold });
    page.drawText('Rate (INR)', { x: 350, y: y - 11, size: 9.5, font: bold });
    page.drawText('GST %', { x: 430, y: y - 11, size: 9.5, font: bold });
    page.drawText('Total', { x: 490, y: y - 11, size: 9.5, font: bold });
    y -= 34;

    let subtotal = 0;
    let totalTax = 0;

    for (const item of payload.items) {
      const base = item.qty * item.rate;
      const tax = (base * item.gstPct) / 100;
      subtotal += base;
      totalTax += tax;

      page.drawText(clean(item.description).slice(0, 40), {
        x: margin + 8,
        y,
        size: 9.5,
        font: regular,
      });
      page.drawText(String(item.qty), { x: 304, y, size: 9.5, font: regular });
      page.drawText(item.rate.toFixed(2), { x: 350, y, size: 9.5, font: regular });
      page.drawText(`${item.gstPct}%`, { x: 434, y, size: 9.5, font: regular });
      page.drawText((base + tax).toFixed(2), { x: 490, y, size: 9.5, font: bold });

      page.drawLine({
        start: { x: margin, y: y - 6 },
        end: { x: width - margin, y: y - 6 },
        thickness: 0.5,
        color: rgb(0.88, 0.88, 0.88),
      });
      y -= 22;
    }

    y -= 10;
    const grandTotal = subtotal + totalTax;
    page.drawText(`Subtotal: INR ${subtotal.toFixed(2)}`, { x: 360, y, size: 10, font: regular });
    y -= 16;
    if (payload.interState) {
      page.drawText(`IGST: INR ${totalTax.toFixed(2)}`, { x: 360, y, size: 10, font: regular });
      y -= 16;
    } else {
      page.drawText(`CGST + SGST: INR ${(totalTax / 2).toFixed(2)} + ${(totalTax / 2).toFixed(2)}`, {
        x: 360,
        y,
        size: 10,
        font: regular,
      });
      y -= 16;
    }
    page.drawText(`Grand Total: INR ${grandTotal.toFixed(2)}`, {
      x: 360,
      y,
      size: 12.5,
      font: bold,
      color: rgb(0.14, 0.14, 0.14),
    });
    y -= 28;
  }

  // Body prose for letters, certificates, resumes, affidavits
  if (payload.subject) {
    page.drawText(clean(`Subject: ${payload.subject}`), {
      x: margin,
      y,
      size: 11,
      font: bold,
    });
    y -= 22;
  }

  if (payload.bodyText) {
    const paragraphs = clean(payload.bodyText).split(/\r?\n/);
    const maxW = width - margin * 2;
    for (const para of paragraphs) {
      if (!para.trim()) {
        y -= 10;
        continue;
      }
      const words = para.split(/\s+/);
      let line = '';
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (regular.widthOfTextAtSize(next, 10.5) <= maxW) {
          line = next;
        } else {
          page.drawText(line, { x: margin, y, size: 10.5, font: regular });
          y -= 15;
          line = word;
        }
      }
      if (line) {
        page.drawText(line, { x: margin, y, size: 10.5, font: regular });
        y -= 16;
      }
    }
  }

  if (payload.notes) {
    y -= 14;
    page.drawText(clean(`Notes: ${payload.notes}`), {
      x: margin,
      y,
      size: 9.5,
      font: regular,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  page.drawText('Authorized Signatory', {
    x: width - margin - 115,
    y: 78,
    size: 10,
    font: bold,
  });
  page.drawLine({
    start: { x: width - margin - 140, y: 92 },
    end: { x: width - margin, y: 92 },
    thickness: 0.75,
    color: rgb(0.4, 0.4, 0.4),
  });

  page.drawText('Generated via Digital Tools Tray (BakeWeb · DIGITAL INDIA PROJECT)', {
    x: margin,
    y: 36,
    size: 8.5,
    font: regular,
    color: rgb(0.55, 0.55, 0.55),
  });

  const saved = await pdf.save();
  return {
    blob: new Blob([new Uint8Array(saved)], { type: 'application/pdf' }),
    filename: `${payload.docType}_${payload.docNumber || 'document'}.pdf`,
  };
}

export async function generateCardPng(options: {
  kind: 'business-card' | 'id-card' | 'certificate';
  title: string;
  subtitle: string;
  org: string;
  phone: string;
  email: string;
  address: string;
}): Promise<{ blob: Blob; url: string; filename: string }> {
  const canvas = document.createElement('canvas');
  canvas.width = options.kind === 'certificate' ? 1400 : 1050;
  canvas.height = options.kind === 'certificate' ? 990 : 600;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Clean BakeWeb accent frame
  ctx.fillStyle = '#F5C542';
  ctx.fillRect(0, 0, canvas.width, options.kind === 'certificate' ? 32 : 24);
  ctx.fillStyle = '#252525';
  ctx.fillRect(0, canvas.height - 18, canvas.width, 18);

  if (options.kind === 'certificate') {
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 6;
    ctx.strokeRect(36, 54, canvas.width - 72, canvas.height - 104);
    ctx.fillStyle = '#252525';
    ctx.textAlign = 'center';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('CERTIFICATE OF ACHIEVEMENT', canvas.width / 2, 220);
    ctx.font = '26px sans-serif';
    ctx.fillStyle = '#707070';
    ctx.fillText('This certificate is proudly presented to', canvas.width / 2, 310);
    ctx.font = 'bold 64px sans-serif';
    ctx.fillStyle = '#252525';
    ctx.fillText(options.title || 'Recipient Name', canvas.width / 2, 420);
    ctx.font = '28px sans-serif';
    ctx.fillStyle = '#555555';
    ctx.fillText(options.subtitle || 'For successfully completing the training program', canvas.width / 2, 510);
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(options.org || 'BakeWeb Skill Centre', canvas.width / 2, 740);
  } else {
    ctx.fillStyle = '#FAFAF7';
    ctx.fillRect(0, 24, 340, canvas.height - 42);
    ctx.fillStyle = '#252525';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(options.org || 'Digital Seva Kendra', 48, 130);
    ctx.fillStyle = '#F06455';
    ctx.fillRect(48, 152, 80, 5);

    ctx.fillStyle = '#252525';
    ctx.font = 'bold 46px sans-serif';
    ctx.fillText(options.title || 'Aarav Patel', 390, 175);
    ctx.fillStyle = '#707070';
    ctx.font = '28px sans-serif';
    ctx.fillText(options.subtitle || 'Authorized Operator', 390, 225);

    ctx.fillStyle = '#252525';
    ctx.font = '24px sans-serif';
    ctx.fillText(`Phone: ${options.phone || '+91 98765 43210'}`, 390, 340);
    ctx.fillText(`Email: ${options.email || 'desk@ibakeweb.in'}`, 390, 390);
    ctx.fillText(`Address: ${options.address || 'Ahmedabad, Gujarat'}`, 390, 440);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Card render failed'))), 'image/png');
  });
  return {
    blob,
    url: URL.createObjectURL(blob),
    filename: `${options.kind}.png`,
  };
}
