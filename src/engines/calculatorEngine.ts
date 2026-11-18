export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function calculateGst(amount: number, ratePct: number, mode: 'exclusive' | 'inclusive') {
  const rate = ratePct / 100;
  let baseAmount = amount;
  let gstAmount = 0;
  let totalAmount = amount;

  if (mode === 'exclusive') {
    baseAmount = amount;
    gstAmount = amount * rate;
    totalAmount = amount + gstAmount;
  } else {
    baseAmount = amount / (1 + rate);
    gstAmount = amount - baseAmount;
    totalAmount = amount;
  }

  return {
    baseAmount,
    gstAmount,
    cgst: gstAmount / 2,
    sgst: gstAmount / 2,
    igst: gstAmount,
    totalAmount,
  };
}

export function calculateEmi(principal: number, annualRatePct: number, tenureMonths: number) {
  const r = annualRatePct / 12 / 100;
  const n = Math.max(1, Math.round(tenureMonths));
  let emi = 0;
  if (r === 0) {
    emi = principal / n;
  } else {
    const pow = Math.pow(1 + r, n);
    emi = (principal * r * pow) / (pow - 1);
  }
  const totalPayment = emi * n;
  const totalInterest = totalPayment - principal;

  // Yearly amortization snapshot for chart
  const schedule: Array<{ year: number; principalPaid: number; interestPaid: number; balance: number }> = [];
  let balance = principal;
  let yrPrincipal = 0;
  let yrInterest = 0;
  for (let m = 1; m <= n; m++) {
    const interestForMonth = balance * r;
    const principalForMonth = emi - interestForMonth;
    balance = Math.max(0, balance - principalForMonth);
    yrPrincipal += principalForMonth;
    yrInterest += interestForMonth;
    if (m % 12 === 0 || m === n) {
      schedule.push({
        year: Math.ceil(m / 12),
        principalPaid: Math.round(yrPrincipal),
        interestPaid: Math.round(yrInterest),
        balance: Math.round(balance),
      });
      yrPrincipal = 0;
      yrInterest = 0;
    }
  }

  return { emi, totalPayment, totalInterest, schedule };
}

export function calculateSip(monthlyAmount: number, annualReturnPct: number, years: number) {
  const n = Math.max(1, Math.round(years * 12));
  const i = annualReturnPct / 12 / 100;
  const futureValue =
    i === 0
      ? monthlyAmount * n
      : monthlyAmount * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
  const invested = monthlyAmount * n;
  const wealthGain = futureValue - invested;

  const yearly: Array<{ year: number; invested: number; totalValue: number }> = [];
  for (let y = 1; y <= years; y++) {
    const m = y * 12;
    const fv =
      i === 0
        ? monthlyAmount * m
        : monthlyAmount * ((Math.pow(1 + i, m) - 1) / i) * (1 + i);
    yearly.push({
      year: y,
      invested: Math.round(monthlyAmount * m),
      totalValue: Math.round(fv),
    });
  }

  return { invested, wealthGain, futureValue, yearly };
}

export function calculateFd(principal: number, ratePct: number, years: number, compoundsPerYear = 4) {
  const n = compoundsPerYear;
  const r = ratePct / 100;
  const maturity = principal * Math.pow(1 + r / n, n * years);
  return {
    principal,
    maturity,
    interestEarned: maturity - principal,
  };
}

export function calculateRd(monthlyDeposit: number, ratePct: number, months: number) {
  const r = ratePct / 400; // quarterly rate
  let maturity = 0;
  for (let m = 0; m < months; m++) {
    const quartersRemaining = (months - m) / 3;
    maturity += monthlyDeposit * Math.pow(1 + r, quartersRemaining);
  }
  const invested = monthlyDeposit * months;
  return { invested, maturity, interestEarned: maturity - invested };
}

export function calculateIncomeTaxIndia(grossIncome: number, deductions80C: number) {
  // New Regime (FY 2025-26/2026-27 standard deduction 75,000 + rebate up to 12L taxable)
  const taxableNew = Math.max(0, grossIncome - 75000);
  let newTax = 0;
  if (taxableNew > 1200000) {
    const slabs = [
      [400000, 0],
      [400000, 0.05],
      [400000, 0.1],
      [400000, 0.15],
      [400000, 0.2],
      [400000, 0.25],
      [Infinity, 0.3],
    ];
    let rem = taxableNew;
    for (const [cap, rate] of slabs) {
      const chunk = Math.min(rem, cap);
      newTax += chunk * rate;
      rem -= chunk;
      if (rem <= 0) break;
    }
  }
  const newTaxWithCess = newTax * 1.04;

  // Old Regime (50,000 std deduction + 80C)
  const taxableOld = Math.max(0, grossIncome - 50000 - Math.min(150000, deductions80C));
  let oldTax = 0;
  if (taxableOld > 500000) {
    if (taxableOld > 250000) oldTax += Math.min(250000, taxableOld - 250000) * 0.05;
    if (taxableOld > 500000) oldTax += Math.min(500000, taxableOld - 500000) * 0.2;
    if (taxableOld > 1000000) oldTax += (taxableOld - 1000000) * 0.3;
  }
  const oldTaxWithCess = oldTax * 1.04;

  return {
    taxableNew,
    newTaxWithCess,
    taxableOld,
    oldTaxWithCess,
    recommended: newTaxWithCess <= oldTaxWithCess ? 'New Tax Regime' : 'Old Tax Regime',
  };
}

export function calculateAgeBreakdown(dobStr: string, asOfStr: string) {
  const dob = new Date(dobStr);
  const asOf = new Date(asOfStr);
  if (Number.isNaN(dob.getTime()) || Number.isNaN(asOf.getTime()) || dob > asOf) {
    return null;
  }
  let years = asOf.getFullYear() - dob.getFullYear();
  let months = asOf.getMonth() - dob.getMonth();
  let days = asOf.getDate() - dob.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(asOf.getFullYear(), asOf.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const totalDays = Math.floor((asOf.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24));
  return { years, months, days, totalDays };
}

export const LAND_UNITS_SQFT: Record<string, { label: string; sqFt: number }> = {
  sqft: { label: 'Square Feet (Sq.Ft)', sqFt: 1 },
  sqm: { label: 'Square Meter (Sq.M)', sqFt: 10.76391 },
  sqyd: { label: 'Square Yard / Vaar / Gaj', sqFt: 9 },
  guntha: { label: 'Guntha / Gunta', sqFt: 1089 },
  acre: { label: 'Acre (एकड़)', sqFt: 43560 },
  hectare: { label: 'Hectare (हेक्टेयर)', sqFt: 107639.104 },
  vigha_guj: { label: 'Vigha (Gujarat Standard 16 Guntha)', sqFt: 17424 },
  bigha_up: { label: 'Pucca Bigha (UP / Rajasthan / Bihar)', sqFt: 27225 },
  bigha_mp: { label: 'Bigha (MP / Standard 12000 Sq.Ft)', sqFt: 12000 },
};

export function convertLandArea(value: number, fromUnit: string) {
  const base = LAND_UNITS_SQFT[fromUnit] || LAND_UNITS_SQFT.sqft;
  const totalSqFt = value * base.sqFt;
  return Object.entries(LAND_UNITS_SQFT).map(([key, meta]) => ({
    key,
    label: meta.label,
    value: totalSqFt / meta.sqFt,
  }));
}
