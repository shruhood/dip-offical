import React, { useState } from 'react';
import { Download, Plus, Trash2, Printer } from 'lucide-react';
import type { ToolDefinition } from '../../../types/tool';
import { DOCUMENT_CHECKLISTS } from '../../../data/toolPlans';
import { generateBusinessPdf, generateCardPng, type LineItem } from '../../../engines/businessDocEngine';
import { createPaginatedTextPdf } from '../../../engines/pdfEngine';
import { useToolTray } from '../../../context/ToolTrayContext';

export const BusinessDocWorkspace: React.FC<{ tool: ToolDefinition }> = ({ tool }) => {
  const { recordToolUsage } = useToolTray();
  const docType = (tool.presetConfig?.docType as string) || (tool.presetConfig?.kind as string) || 'invoice';

  // Checklist generator state
  const [selectedChecklistId, setSelectedChecklistId] = useState(DOCUMENT_CHECKLISTS[0].id);

  // Invoice / Receipt / Document form state
  const [docNumber, setDocNumber] = useState(`BW-${new Date().getFullYear()}-104`);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [senderName, setSenderName] = useState('Digital Tools Tray Service Desk');
  const [senderGstin, setSenderGstin] = useState('24AABCU9603R1ZM');
  const [senderAddress, setSenderAddress] = useState('Station Road, Ahmedabad, Gujarat');
  const [senderPhone, setSenderPhone] = useState('+91 98765 43210');
  const [recipientName, setRecipientName] = useState('Ramesh Kumar');
  const [recipientAddress, setRecipientAddress] = useState('Sector 14, Gandhinagar');
  const [subject, setSubject] = useState('Application for Document Verification / Service');
  const [bodyText, setBodyText] = useState(
    docType === 'self-declaration'
      ? 'I, Ramesh Kumar, resident of Sector 14, Gandhinagar, hereby declare that all information and supporting documents submitted by me are true and correct to the best of my knowledge and belief.'
      : docType === 'affidavit'
      ? 'I, Ramesh Kumar, aged 28 years, Indian citizen, do hereby solemnly affirm and state on oath as under:\n1. That my residential address mentioned above is true and accurate.\n2. That this affidavit is submitted for official verification purposes.'
      : 'Respected Sir/Madam,\n\nWith reference to the subject cited above, I kindly request you to process my application along with the enclosed self-attested documents.\n\nThanking you,\nYours faithfully.'
  );
  const [interState, setInterState] = useState(false);
  const [items, setItems] = useState<LineItem[]>([
    { description: 'Document Scanning & Form Assistance', qty: 1, rate: 100, gstPct: 18 },
    { description: 'Passport Photo Print Sheet (4x6)', qty: 1, rate: 50, gstPct: 18 },
  ]);
  const [cardPreview, setCardPreview] = useState<{ url: string; filename: string } | null>(null);

  if (tool.engineId === 'document-checklist') {
    const active = DOCUMENT_CHECKLISTS.find((c) => c.id === selectedChecklistId) || DOCUMENT_CHECKLISTS[0];
    const exportChecklist = async () => {
      const lines = [
        active.title,
        `Department: ${active.department}`,
        '----------------------------------------',
        ...active.items.map(
          (it, i) => `${i + 1}. [${it.required ? 'REQUIRED' : 'OPTIONAL'}] ${it.doc} — ${it.notes}`
        ),
        '',
        'Note: Verify latest state/central portal circular before final submission.',
      ];
      const res = await createPaginatedTextPdf(lines.join('\n'), `${active.id}-checklist.pdf`, active.title);
      const url = URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      await recordToolUsage({
        toolSlug: tool.slug,
        toolName: tool.name,
        status: 'completed',
        inputSummary: active.title,
        outputSummary: res.filename,
      });
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {DOCUMENT_CHECKLISTS.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => setSelectedChecklistId(tpl.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                selectedChecklistId === tpl.id
                  ? 'border-[#F5C542] bg-[#F5C542]/15'
                  : 'border-[#EAEAEA] dark:border-[#2C2C27]'
              }`}
            >
              {tpl.title}
            </button>
          ))}
        </div>

        <div className="p-5 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-[#FAFAF7] dark:bg-[#121210] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-bold text-base">{active.title}</h3>
              <p className="text-xs text-[#707070]">{active.department}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] text-xs font-semibold cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={exportChecklist}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#F5C542] text-[#252525] text-xs font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
          <div className="divide-y divide-[#EAEAEA] dark:divide-[#2C2C27]">
            {active.items.map((item) => (
              <label key={item.doc} className="flex items-start gap-3 py-2.5 text-sm cursor-pointer">
                <input type="checkbox" className="mt-1 accent-[#F5C542]" />
                <div>
                  <div className="font-medium text-[#252525] dark:text-[#F4F3EE]">
                    {item.doc}{' '}
                    <span className="text-xs text-[#707070]">
                      · {item.required ? 'Mandatory' : 'If applicable'}
                    </span>
                  </div>
                  <div className="text-xs text-[#707070]">{item.notes}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (docType === 'business-card' || docType === 'id-card' || docType === 'certificate') {
    const handleRenderCard = async () => {
      const out = await generateCardPng({
        kind: docType,
        title: recipientName,
        subtitle: subject,
        org: senderName,
        phone: senderPhone,
        email: 'support@digitalindiaproject.com',
        address: senderAddress,
      });
      if (cardPreview) URL.revokeObjectURL(cardPreview.url);
      setCardPreview({ url: out.url, filename: out.filename });
      await recordToolUsage({
        toolSlug: tool.slug,
        toolName: tool.name,
        status: 'completed',
        inputSummary: `${senderName} / ${recipientName}`,
        outputSummary: out.filename,
      });
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="block text-xs text-[#707070] mb-1">Organization / Institute</label><input type="text" value={senderName} onChange={(e) => setSenderName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
          <div><label className="block text-xs text-[#707070] mb-1">{docType === 'certificate' ? 'Recipient Name' : 'Holder Name'}</label><input type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
          <div><label className="block text-xs text-[#707070] mb-1">{docType === 'certificate' ? 'Course / Achievement' : 'Role / Designation'}</label><input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
          <div><label className="block text-xs text-[#707070] mb-1">Phone</label><input type="text" value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
        </div>
        <button
          type="button"
          onClick={handleRenderCard}
          className="px-5 py-2.5 rounded-lg bg-[#F5C542] hover:bg-[#FFD65A] text-[#252525] font-semibold text-sm cursor-pointer"
        >
          Render High-Res Design
        </button>
        {cardPreview && (
          <div className="space-y-3">
            <img src={cardPreview.url} alt="Generated card" className="max-w-lg w-full rounded-xl border border-[#EAEAEA]" />
            <a
              href={cardPreview.url}
              download={cardPreview.filename}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#252525] text-white text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PNG</span>
            </a>
          </div>
        )}
      </div>
    );
  }

  const isBillingDoc = [
    'invoice',
    'gst-invoice',
    'quotation',
    'receipt',
    'challan',
    'po',
    'print-receipt',
    'service-bill',
  ].includes(docType);

  const subtotal = items.reduce((s, it) => s + it.qty * it.rate, 0);
  const taxTotal = items.reduce((s, it) => s + (it.qty * it.rate * it.gstPct) / 100, 0);

  const handleDownloadPdf = async () => {
    const res = await generateBusinessPdf({
      docType,
      docNumber,
      date,
      senderName,
      senderGstin: docType === 'gst-invoice' ? senderGstin : undefined,
      senderAddress,
      senderPhone,
      recipientName,
      recipientAddress,
      subject: isBillingDoc ? undefined : subject,
      bodyText: isBillingDoc ? undefined : bodyText,
      items: isBillingDoc ? items : undefined,
      interState,
    });
    const url = URL.createObjectURL(res.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
    await recordToolUsage({
      toolSlug: tool.slug,
      toolName: tool.name,
      status: 'completed',
      inputSummary: `${docNumber} · ${recipientName}`,
      outputSummary: res.filename,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div><label className="block text-xs text-[#707070] mb-1">Document No.</label><input type="text" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
        <div><label className="block text-xs text-[#707070] mb-1">Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
        <div><label className="block text-xs text-[#707070] mb-1">From (Business / Centre)</label><input type="text" value={senderName} onChange={(e) => setSenderName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="block text-xs text-[#707070] mb-1">Sender Address</label><input type="text" value={senderAddress} onChange={(e) => setSenderAddress(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
        <div><label className="block text-xs text-[#707070] mb-1">To (Customer / Authority)</label><input type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
      </div>

      {docType === 'gst-invoice' && (
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-64">
            <label className="block text-xs text-[#707070] mb-1">Sender GSTIN</label>
            <input type="text" value={senderGstin} onChange={(e) => setSenderGstin(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm font-mono" />
          </div>
          <label className="inline-flex items-center gap-2 text-xs mt-4 cursor-pointer">
            <input type="checkbox" checked={interState} onChange={(e) => setInterState(e.target.checked)} />
            <span>Inter-State Supply (IGST instead of CGST+SGST)</span>
          </label>
        </div>
      )}

      {isBillingDoc ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#707070]">Line Items</span>
            <button
              type="button"
              onClick={() => setItems([...items, { description: 'Service Item', qty: 1, rate: 50, gstPct: 18 }])}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#252525] dark:text-[#F5C542] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Item
            </button>
          </div>
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <input
                type="text"
                value={item.description}
                onChange={(e) => {
                  const next = [...items];
                  next[idx].description = e.target.value;
                  setItems(next);
                }}
                className="col-span-5 px-2.5 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-xs"
              />
              <input
                type="number"
                value={item.qty}
                onChange={(e) => {
                  const next = [...items];
                  next[idx].qty = Number(e.target.value);
                  setItems(next);
                }}
                className="col-span-2 px-2.5 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-xs tabular-nums"
              />
              <input
                type="number"
                value={item.rate}
                onChange={(e) => {
                  const next = [...items];
                  next[idx].rate = Number(e.target.value);
                  setItems(next);
                }}
                className="col-span-2 px-2.5 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-xs tabular-nums"
              />
              <input
                type="number"
                value={item.gstPct}
                onChange={(e) => {
                  const next = [...items];
                  next[idx].gstPct = Number(e.target.value);
                  setItems(next);
                }}
                className="col-span-2 px-2.5 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-xs tabular-nums"
              />
              <button
                type="button"
                onClick={() => setItems(items.filter((_, i) => i !== idx))}
                className="col-span-1 p-2 text-[#F06455] cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="p-4 rounded-xl bg-[#FAFAF7] dark:bg-[#121210] border border-[#EAEAEA] dark:border-[#2C2C27] flex flex-wrap justify-between text-sm tabular-nums">
            <span>Subtotal: ₹{subtotal.toFixed(2)}</span>
            <span>Tax: ₹{taxTotal.toFixed(2)}</span>
            <span className="font-bold">Grand Total: ₹{(subtotal + taxTotal).toFixed(2)}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div><label className="block text-xs text-[#707070] mb-1">Subject / Title</label><input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
          <div><label className="block text-xs text-[#707070] mb-1">Document Content</label><textarea rows={7} value={bodyText} onChange={(e) => setBodyText(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
        </div>
      )}

      <button
        type="button"
        onClick={handleDownloadPdf}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#F5C542] hover:bg-[#FFD65A] text-[#252525] font-semibold text-sm cursor-pointer"
      >
        <Download className="w-4 h-4" />
        <span>Generate & Download A4 PDF</span>
      </button>
    </div>
  );
};
