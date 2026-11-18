import React, { useEffect, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Download } from 'lucide-react';
import type { ToolDefinition } from '../../../types/tool';
import type { ToolExportShortcut } from '../../../lib/converterExport';
import { useToolTray } from '../../../context/ToolTrayContext';
import {
  calculateAgeBreakdown,
  calculateEmi,
  calculateFd,
  calculateGst,
  calculateIncomeTaxIndia,
  calculateRd,
  calculateSip,
  convertLandArea,
  formatInr,
  LAND_UNITS_SQFT,
} from '../../../engines/calculatorEngine';
import { createPaginatedTextPdf } from '../../../engines/pdfEngine';

const DEFAULT_AMOUNTS: Record<string, number> = {
  gst: 10000,
  emi: 500000,
  sip: 5000,
  'income-tax': 1400000,
  tds: 50000,
  fd: 100000,
  rd: 5000,
  'simple-interest': 50000,
  'compound-interest': 50000,
  salary: 600000,
  pf: 25000,
  gratuity: 40000,
  discount: 2500,
};

const DEFAULT_RATES: Record<string, number> = {
  gst: 18,
  emi: 9.5,
  sip: 12,
  fd: 7.1,
  rd: 6.8,
  'simple-interest': 8.5,
  'compound-interest': 9,
  discount: 15,
};

export const CalculatorWorkspace: React.FC<{
  tool: ToolDefinition;
  onRegisterExportShortcut?: (shortcut: ToolExportShortcut | null) => void;
}> = ({ tool, onRegisterExportShortcut }) => {
  const { recordToolUsage } = useToolTray();
  const calcType = (tool.presetConfig?.calcType as string) || (tool.engineId === 'print-calculator' ? 'print' : 'gst');
  const latestExportRef = useRef<() => Promise<void> | void>(() => {});

  // Shared calculator states
  const [amount, setAmount] = useState(() => DEFAULT_AMOUNTS[calcType] ?? 10000);
  const [rate, setRate] = useState(() => DEFAULT_RATES[calcType] ?? 10);
  const [gstMode, setGstMode] = useState<'exclusive' | 'inclusive'>('exclusive');
  const [tenureMonths, setTenureMonths] = useState(36);
  const [years, setYears] = useState(10);
  const [deduction80c, setDeduction80c] = useState(150000);
  const [tdsSection, setTdsSection] = useState<'194C_ind' | '194C_co' | '194J' | '194I' | '194H'>('194J');
  const [dob, setDob] = useState('1998-05-15');
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [pctA, setPctA] = useState(425);
  const [pctB, setPctB] = useState(500);
  const [landVal, setLandVal] = useState(1);
  const [landUnit, setLandUnit] = useState('acre');

  // Print & Photocopy calculator states
  const [pagesCount, setPagesCount] = useState(40);
  const [copiesCount, setCopiesCount] = useState(2);
  const [isColor, setIsColor] = useState(false);
  const [isDuplex, setIsDuplex] = useState(true);
  const [bindingCost, setBindingCost] = useState(25);

  useEffect(() => {
    setAmount(DEFAULT_AMOUNTS[calcType] ?? 10000);
    setRate(DEFAULT_RATES[calcType] ?? 10);
  }, [calcType, tool.slug]);

  const exportSummaryPdf = async (lines: string[]) => {
    const res = await createPaginatedTextPdf(lines.join('\n'), `${tool.slug}-summary.pdf`, tool.name);
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
      inputSummary: calcType.toUpperCase(),
      outputSummary: res.filename,
    });
  };

  latestExportRef.current = async () => {
    if (calcType === 'land') {
      const conversions = convertLandArea(landVal, landUnit);
      await exportSummaryPdf([
        `Tool: ${tool.name}`,
        `Source Area: ${landVal} ${LAND_UNITS_SQFT[landUnit]?.label || landUnit}`,
        ...conversions.map((c) => `${c.label}: ${c.value.toFixed(4)}`),
      ]);
      return;
    }
    await exportSummaryPdf([`Tool: ${tool.name}`, `Generated on ${new Date().toLocaleDateString('en-IN')}`]);
  };

  useEffect(() => {
    onRegisterExportShortcut?.({
      ready: true,
      onExport: () => latestExportRef.current(),
    });
    return () => {
      onRegisterExportShortcut?.(null);
    };
  }, [onRegisterExportShortcut, tool.slug]);

  if (calcType === 'gst') {
    const res = calculateGst(amount, rate, gstMode);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#707070] mb-1">Amount (INR)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#707070] mb-1">GST Slab (%)</label>
            <select
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-white dark:bg-[#1B1B18]"
            >
              {[3, 5, 12, 18, 28].map((r) => (
                <option key={r} value={r}>{r}% GST</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#707070] mb-1">Calculation Mode</label>
            <select
              value={gstMode}
              onChange={(e) => setGstMode(e.target.value as 'exclusive' | 'inclusive')}
              className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-white dark:bg-[#1B1B18]"
            >
              <option value="exclusive">Add GST (Exclusive)</option>
              <option value="inclusive">Remove GST (Inclusive MRP)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Net Base Price', val: formatInr(res.baseAmount) },
            { label: `CGST (${rate / 2}%)`, val: formatInr(res.cgst) },
            { label: `SGST (${rate / 2}%)`, val: formatInr(res.sgst) },
            { label: `IGST (${rate}%)`, val: formatInr(res.igst) },
            { label: 'Gross Total', val: formatInr(res.totalAmount), highlight: true },
          ].map((card) => (
            <div
              key={card.label}
              className={`p-4 rounded-xl border ${
                card.highlight
                  ? 'border-[#F5C542] bg-[#F5C542]/10'
                  : 'border-[#EAEAEA] dark:border-[#2C2C27] bg-[#FAFAF7] dark:bg-[#121210]'
              }`}
            >
              <div className="text-xs text-[#707070]">{card.label}</div>
              <div className="text-lg font-bold text-[#252525] dark:text-[#F4F3EE] mt-1 tabular-nums">
                {card.val}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            exportSummaryPdf([
              `Tool: ${tool.name}`,
              `Mode: ${gstMode} (${rate}% GST)`,
              `Net Base Price: ${formatInr(res.baseAmount)}`,
              `CGST: ${formatInr(res.cgst)}`,
              `SGST: ${formatInr(res.sgst)}`,
              `IGST: ${formatInr(res.igst)}`,
              `Gross Total: ${formatInr(res.totalAmount)}`,
            ])
          }
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] text-xs font-semibold cursor-pointer hover:border-[#F5C542]"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download Calculation PDF</span>
        </button>
      </div>
    );
  }

  if (calcType === 'emi') {
    const res = calculateEmi(amount, rate, tenureMonths);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#707070] mb-1">Loan Principal (INR)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#707070] mb-1">Interest Rate (% p.a.)</label>
            <input
              type="number"
              step={0.1}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#707070] mb-1">Tenure (Months)</label>
            <input
              type="number"
              min={1}
              max={360}
              value={tenureMonths}
              onChange={(e) => setTenureMonths(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-[#F5C542] bg-[#F5C542]/10">
            <div className="text-xs text-[#707070]">Monthly EMI</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{formatInr(res.emi)}</div>
          </div>
          <div className="p-4 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-[#FAFAF7] dark:bg-[#121210]">
            <div className="text-xs text-[#707070]">Total Interest</div>
            <div className="text-xl font-bold tabular-nums mt-1">{formatInr(res.totalInterest)}</div>
          </div>
          <div className="p-4 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-[#FAFAF7] dark:bg-[#121210]">
            <div className="text-xs text-[#707070]">Total Repayment</div>
            <div className="text-xl font-bold tabular-nums mt-1">{formatInr(res.totalPayment)}</div>
          </div>
        </div>

        <div className="h-64 w-full border border-[#EAEAEA] dark:border-[#2C2C27] rounded-xl p-4 bg-white dark:bg-[#1B1B18]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={res.schedule}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="year" tickFormatter={(v) => `Yr ${v}`} fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Area type="monotone" dataKey="balance" stroke="#F06455" fill="#F06455" fillOpacity={0.18} name="Remaining Balance" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <button
          type="button"
          onClick={() =>
            exportSummaryPdf([
              `Tool: ${tool.name}`,
              `Principal: ${formatInr(amount)} | Rate: ${rate}% | Tenure: ${tenureMonths} months`,
              `Monthly EMI: ${formatInr(res.emi)}`,
              `Total Interest: ${formatInr(res.totalInterest)}`,
              `Total Repayment: ${formatInr(res.totalPayment)}`,
            ])
          }
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] text-xs font-semibold cursor-pointer hover:border-[#F5C542]"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download EMI Schedule PDF</span>
        </button>
      </div>
    );
  }

  if (calcType === 'sip') {
    const res = calculateSip(amount, rate, years);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-[#707070] mb-1">Monthly SIP (INR)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs text-[#707070] mb-1">Expected Return (% p.a.)</label>
            <input
              type="number"
              step={0.5}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs text-[#707070] mb-1">Duration (Years)</label>
            <input
              type="number"
              min={1}
              max={40}
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-[#FAFAF7] dark:bg-[#121210]">
            <div className="text-xs text-[#707070]">Invested Amount</div>
            <div className="text-xl font-bold tabular-nums mt-1">{formatInr(res.invested)}</div>
          </div>
          <div className="p-4 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-[#FAFAF7] dark:bg-[#121210]">
            <div className="text-xs text-[#707070]">Est. Wealth Gain</div>
            <div className="text-xl font-bold text-[#16A34A] tabular-nums mt-1">{formatInr(res.wealthGain)}</div>
          </div>
          <div className="p-4 rounded-xl border border-[#F5C542] bg-[#F5C542]/10">
            <div className="text-xs text-[#707070]">Projected Value</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{formatInr(res.futureValue)}</div>
          </div>
        </div>

        <div className="h-64 w-full border border-[#EAEAEA] dark:border-[#2C2C27] rounded-xl p-4 bg-white dark:bg-[#1B1B18]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={res.yearly}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="year" tickFormatter={(v) => `Yr ${v}`} fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Area type="monotone" dataKey="totalValue" stroke="#F5C542" fill="#F5C542" fillOpacity={0.25} name="Projected Value" />
              <Area type="monotone" dataKey="invested" stroke="#707070" fill="#707070" fillOpacity={0.12} name="Invested" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (calcType === 'income-tax') {
    const tax = calculateIncomeTaxIndia(amount, deduction80c);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#707070] mb-1">Annual Gross Income (INR)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs text-[#707070] mb-1">80C / Old Regime Deductions (INR)</label>
            <input
              type="number"
              value={deduction80c}
              onChange={(e) => setDeduction80c(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent tabular-nums"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-[#F5C542] bg-[#F5C542]/10">
            <div className="text-xs text-[#707070]">New Regime Tax (incl. 4% Cess)</div>
            <div className="text-xl font-bold tabular-nums mt-1">{formatInr(tax.newTaxWithCess)}</div>
          </div>
          <div className="p-4 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-[#FAFAF7] dark:bg-[#121210]">
            <div className="text-xs text-[#707070]">Old Regime Tax (incl. 4% Cess)</div>
            <div className="text-xl font-bold tabular-nums mt-1">{formatInr(tax.oldTaxWithCess)}</div>
          </div>
          <div className="p-4 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-[#FAFAF7] dark:bg-[#121210]">
            <div className="text-xs text-[#707070]">Lower Tax Option</div>
            <div className="text-base font-bold text-[#16A34A] mt-1">{tax.recommended}</div>
          </div>
        </div>
      </div>
    );
  }

  if (calcType === 'tds') {
    const tdsRates: Record<typeof tdsSection, { label: string; pct: number }> = {
      '194C_ind': { label: '194C Contractor (Individual/HUF) — 1%', pct: 1 },
      '194C_co': { label: '194C Contractor (Company) — 2%', pct: 2 },
      '194J': { label: '194J Professional Fees — 10%', pct: 10 },
      '194I': { label: '194I Rent (Land/Building) — 10%', pct: 10 },
      '194H': { label: '194H Commission / Brokerage — 5%', pct: 5 },
    };
    const pct = tdsRates[tdsSection].pct;
    const tdsAmt = (amount * pct) / 100;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#707070] mb-1">Gross Payment (INR)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent tabular-nums" />
          </div>
          <div>
            <label className="block text-xs text-[#707070] mb-1">TDS Section</label>
            <select value={tdsSection} onChange={(e) => setTdsSection(e.target.value as typeof tdsSection)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-white dark:bg-[#1B1B18]">
              {Object.entries(tdsRates).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27]"><div className="text-xs text-[#707070]">TDS Deducted ({pct}%)</div><div className="text-xl font-bold tabular-nums mt-1">{formatInr(tdsAmt)}</div></div>
          <div className="p-4 rounded-xl border border-[#F5C542] bg-[#F5C542]/10"><div className="text-xs text-[#707070]">Net Payable</div><div className="text-xl font-bold tabular-nums mt-1">{formatInr(amount - tdsAmt)}</div></div>
        </div>
      </div>
    );
  }

  if (calcType === 'age') {
    const age = calculateAgeBreakdown(dob, asOf);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <div>
            <label className="block text-xs text-[#707070] mb-1">Date of Birth</label>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent" />
          </div>
          <div>
            <label className="block text-xs text-[#707070] mb-1">Age as on Cutoff Date</label>
            <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent" />
          </div>
        </div>
        {age ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-[#F5C542] bg-[#F5C542]/10"><div className="text-xs text-[#707070]">Years</div><div className="text-2xl font-bold tabular-nums">{age.years}</div></div>
            <div className="p-4 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27]"><div className="text-xs text-[#707070]">Months</div><div className="text-2xl font-bold tabular-nums">{age.months}</div></div>
            <div className="p-4 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27]"><div className="text-xs text-[#707070]">Days</div><div className="text-2xl font-bold tabular-nums">{age.days}</div></div>
            <div className="p-4 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27]"><div className="text-xs text-[#707070]">Total Days</div><div className="text-2xl font-bold tabular-nums">{age.totalDays.toLocaleString()}</div></div>
          </div>
        ) : (
          <p className="text-sm text-[#F06455]">Cutoff date must be after Date of Birth.</p>
        )}
      </div>
    );
  }

  if (calcType === 'land') {
    const conversions = convertLandArea(landVal, landUnit);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <div>
            <label className="block text-xs text-[#707070] mb-1">Area Value</label>
            <input type="number" step="any" value={landVal} onChange={(e) => setLandVal(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent tabular-nums" />
          </div>
          <div>
            <label className="block text-xs text-[#707070] mb-1">From Unit</label>
            <select value={landUnit} onChange={(e) => setLandUnit(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-white dark:bg-[#1B1B18]">
              {Object.entries(LAND_UNITS_SQFT).map(([k, u]) => <option key={k} value={k}>{u.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {conversions.map((c) => (
            <div key={c.key} className="p-3.5 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-[#FAFAF7] dark:bg-[#121210]">
              <div className="text-xs text-[#707070]">{c.label}</div>
              <div className="text-lg font-bold tabular-nums mt-0.5">{c.value.toFixed(4)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (calcType === 'print') {
    const perPageRate = isColor ? 10 : 2;
    const sheetsNeeded = isDuplex ? Math.ceil(pagesCount / 2) : pagesCount;
    const printCost = pagesCount * copiesCount * perPageRate;
    const total = printCost + bindingCost * copiesCount;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-[#707070] mb-1">Pages per Document</label>
            <input type="number" min={1} value={pagesCount} onChange={(e) => setPagesCount(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent tabular-nums" />
          </div>
          <div>
            <label className="block text-xs text-[#707070] mb-1">Number of Copies</label>
            <input type="number" min={1} value={copiesCount} onChange={(e) => setCopiesCount(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent tabular-nums" />
          </div>
          <div>
            <label className="block text-xs text-[#707070] mb-1">Binding / Lamination (INR)</label>
            <input type="number" min={0} value={bindingCost} onChange={(e) => setBindingCost(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent tabular-nums" />
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="inline-flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={isColor} onChange={(e) => setIsColor(e.target.checked)} /> Color Print (₹10/pg vs ₹2 B&W)</label>
            <label className="inline-flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={isDuplex} onChange={(e) => setIsDuplex(e.target.checked)} /> Double-Sided (Duplex)</label>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27]"><div className="text-xs text-[#707070]">Sheets Required</div><div className="text-xl font-bold tabular-nums">{sheetsNeeded * copiesCount} sheets</div></div>
          <div className="p-4 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27]"><div className="text-xs text-[#707070]">Print Charge</div><div className="text-xl font-bold tabular-nums">{formatInr(printCost)}</div></div>
          <div className="p-4 rounded-xl border border-[#F5C542] bg-[#F5C542]/10"><div className="text-xs text-[#707070]">Customer Bill Total</div><div className="text-2xl font-bold tabular-nums">{formatInr(total)}</div></div>
        </div>
      </div>
    );
  }

  // Remaining deterministic financial/math calculators (FD, RD, Simple/Compound Interest, Salary, PF, Gratuity, Percentage, Discount)
  let cards: Array<{ label: string; value: string; highlight?: boolean }> = [];
  if (calcType === 'fd') {
    const fd = calculateFd(amount, rate, years);
    cards = [
      { label: 'Deposit Principal', value: formatInr(fd.principal) },
      { label: 'Interest Earned', value: formatInr(fd.interestEarned) },
      { label: 'Maturity Amount', value: formatInr(fd.maturity), highlight: true },
    ];
  } else if (calcType === 'rd') {
    const rd = calculateRd(amount, rate, years * 12);
    cards = [
      { label: 'Total Deposited', value: formatInr(rd.invested) },
      { label: 'Interest Earned', value: formatInr(rd.interestEarned) },
      { label: 'Maturity Value', value: formatInr(rd.maturity), highlight: true },
    ];
  } else if (calcType === 'simple-interest') {
    const si = (amount * rate * years) / 100;
    cards = [
      { label: 'Principal', value: formatInr(amount) },
      { label: 'Simple Interest', value: formatInr(si) },
      { label: 'Total Value', value: formatInr(amount + si), highlight: true },
    ];
  } else if (calcType === 'compound-interest') {
    const ci = calculateFd(amount, rate, years, 1);
    cards = [
      { label: 'Principal', value: formatInr(ci.principal) },
      { label: 'Compound Interest', value: formatInr(ci.interestEarned) },
      { label: 'Maturity Value', value: formatInr(ci.maturity), highlight: true },
    ];
  } else if (calcType === 'salary') {
    const monthlyGross = amount / 12;
    const basic = monthlyGross * 0.45;
    const empPf = Math.min(1800, basic * 0.12);
    const pt = 200;
    const inHand = monthlyGross - empPf - pt;
    cards = [
      { label: 'Monthly Gross', value: formatInr(monthlyGross) },
      { label: 'EPF + Prof. Tax', value: formatInr(empPf + pt) },
      { label: 'Est. Monthly In-Hand', value: formatInr(inHand), highlight: true },
    ];
  } else if (calcType === 'pf') {
    const monthlyContrib = amount * 0.12 * 2;
    const res = calculateSip(monthlyContrib, 8.25, years);
    cards = [
      { label: 'Monthly Combined PF', value: formatInr(monthlyContrib) },
      { label: 'Total Contributed', value: formatInr(res.invested) },
      { label: 'Projected EPF Corpus (8.25%)', value: formatInr(res.futureValue), highlight: true },
    ];
  } else if (calcType === 'gratuity') {
    const gratuity = (15 * amount * years) / 26;
    cards = [
      { label: 'Last Basic + DA', value: formatInr(amount) },
      { label: 'Completed Years', value: `${years} yrs` },
      { label: 'Statutory Gratuity', value: formatInr(gratuity), highlight: true },
    ];
  } else if (calcType === 'percentage') {
    const pct = pctB > 0 ? (pctA / pctB) * 100 : 0;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
          <div><label className="block text-xs text-[#707070] mb-1">Obtained / Part Value</label><input type="number" value={pctA} onChange={(e) => setPctA(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent tabular-nums" /></div>
          <div><label className="block text-xs text-[#707070] mb-1">Total / Maximum Value</label><input type="number" value={pctB} onChange={(e) => setPctB(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent tabular-nums" /></div>
        </div>
        <div className="p-5 rounded-xl border border-[#F5C542] bg-[#F5C542]/10 max-w-sm">
          <div className="text-xs text-[#707070]">Percentage Score</div>
          <div className="text-3xl font-bold tabular-nums mt-1">{pct.toFixed(2)}%</div>
        </div>
      </div>
    );
  } else {
    // discount
    const discAmt = (amount * rate) / 100;
    cards = [
      { label: 'Marked Price', value: formatInr(amount) },
      { label: `Discount (${rate}%)`, value: formatInr(discAmt) },
      { label: 'Final Price', value: formatInr(amount - discAmt), highlight: true },
    ];
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-[#707070] mb-1">Amount / Salary / Principal (INR)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent tabular-nums" />
        </div>
        <div>
          <label className="block text-xs text-[#707070] mb-1">Rate / Discount (%)</label>
          <input type="number" step="0.1" value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent tabular-nums" />
        </div>
        <div>
          <label className="block text-xs text-[#707070] mb-1">Years / Tenure</label>
          <input type="number" min={1} max={50} value={years} onChange={(e) => setYears(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent tabular-nums" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`p-4 rounded-xl border ${
              c.highlight
                ? 'border-[#F5C542] bg-[#F5C542]/10'
                : 'border-[#EAEAEA] dark:border-[#2C2C27] bg-[#FAFAF7] dark:bg-[#121210]'
            }`}
          >
            <div className="text-xs text-[#707070]">{c.label}</div>
            <div className="text-xl font-bold tabular-nums mt-1">{c.value}</div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          exportSummaryPdf([
            `Tool: ${tool.name}`,
            ...cards.map((c) => `${c.label}: ${c.value}`),
          ])
        }
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] text-xs font-semibold cursor-pointer hover:border-[#F5C542]"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Download Calculation PDF</span>
      </button>
    </div>
  );
};
