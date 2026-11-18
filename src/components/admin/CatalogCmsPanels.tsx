import React, { useRef, useState } from 'react';
import {
  CatalogueImportReport,
  CouponRecord,
  CustomQuoteRequest,
  DigitalProductOrder,
  Service,
  ServiceCategory,
} from '../../types';
import {
  exportCatalogueToCsv,
  exportCatalogueToJson,
} from '../../lib/catalogueImporter';
import { importCatalogueToBackend } from '../../services/backendApi';
import {
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  FolderKanban,
  MessageSquareQuote,
  PackageCheck,
  Plus,
  RefreshCw,
  Tag,
  Trash2,
  Upload,
} from 'lucide-react';

interface CouponsPanelProps {
  coupons: CouponRecord[];
  categories: ServiceCategory[];
  onSaveCoupon: (coupon: CouponRecord) => void;
  onDeleteCoupon: (couponId: string) => void;
  onNotify: (msg: string) => void;
}

export const AdminCouponsPanel: React.FC<CouponsPanelProps> = ({
  coupons,
  categories,
  onSaveCoupon,
  onDeleteCoupon,
  onNotify,
}) => {
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountAmountInr, setDiscountAmountInr] = useState(100);
  const [discountPercentPct, setDiscountPercentPct] = useState(10);
  const [maxDiscountInr, setMaxDiscountInr] = useState(300);
  const [minOrderAmountInr, setMinOrderAmountInr] = useState(499);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [validUntil, setValidUntil] = useState('2027-12-31');
  const [usageLimit, setUsageLimit] = useState(500);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;

    const record: CouponRecord = {
      id: `cpn_${cleanCode.toLowerCase()}_${Date.now().toString(36)}`,
      code: cleanCode,
      description:
        description.trim() ||
        (discountType === 'percentage'
          ? `${discountPercentPct}% off professional facilitation fees`
          : `₹${discountAmountInr} instant discount on eligible orders`),
      discountType,
      discountAmountInr: discountType === 'fixed' ? Math.max(0, Number(discountAmountInr) || 0) : 0,
      discountPercentBps: discountType === 'percentage' ? Math.max(0, Math.round((Number(discountPercentPct) || 0) * 100)) : 0,
      maxDiscountInr: discountType === 'percentage' && maxDiscountInr > 0 ? Number(maxDiscountInr) : undefined,
      minOrderAmountInr: Math.max(0, Number(minOrderAmountInr) || 0),
      applicableCategories: selectedCategories.length > 0 ? selectedCategories : undefined,
      validUntil: validUntil ? `${validUntil}T23:59:59Z` : undefined,
      usageLimit: usageLimit > 0 ? Number(usageLimit) : undefined,
      usedCount: 0,
      isActive: true,
    };

    onSaveCoupon(record);
    setCode('');
    setDescription('');
    setSelectedCategories([]);
    onNotify(`Created promo coupon "${record.code}".`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <form
        onSubmit={handleCreate}
        className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3.5 text-xs"
      >
        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
          <Tag className="w-4 h-4 text-[#FF671F]" />
          <span>Create Promo Coupon</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Coupon Code *</label>
            <input
              type="text"
              required
              placeholder="e.g. SILVASSA150"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono uppercase"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Discount Type</label>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'fixed' | 'percentage')}
              className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
            >
              <option value="fixed">Fixed INR (₹)</option>
              <option value="percentage">Percentage (%)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
          <input
            type="text"
            placeholder="Flat ₹150 off for Vapi & Silvassa MSME filings"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {discountType === 'fixed' ? (
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Discount (₹)</label>
              <input
                type="number"
                min={1}
                value={discountAmountInr}
                onChange={(e) => setDiscountAmountInr(Number(e.target.value))}
                className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 font-mono"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Percent (%)</label>
                <input
                  type="number"
                  min={1}
                  max={80}
                  value={discountPercentPct}
                  onChange={(e) => setDiscountPercentPct(Number(e.target.value))}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Max Cap (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={maxDiscountInr}
                  onChange={(e) => setMaxDiscountInr(Number(e.target.value))}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 font-mono"
                />
              </div>
            </>
          )}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Min Order (₹)</label>
            <input
              type="number"
              min={0}
              value={minOrderAmountInr}
              onChange={(e) => setMinOrderAmountInr(Number(e.target.value))}
              className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Valid Until</label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Usage Limit</label>
            <input
              type="number"
              min={1}
              value={usageLimit}
              onChange={(e) => setUsageLimit(Number(e.target.value))}
              className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Applicable Categories (leave empty for all categories)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => {
              const checked = selectedCategories.includes(cat.slug);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() =>
                    setSelectedCategories((prev) =>
                      prev.includes(cat.slug) ? prev.filter((s) => s !== cat.slug) : [...prev, cat.slug]
                    )
                  }
                  className={`px-2 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                    checked
                      ? 'bg-[#FF671F] text-white border-[#FF671F]'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {cat.name.split('&')[0].trim()}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Save Promo Coupon</span>
        </button>
      </form>

      <div className="lg:col-span-7 space-y-3">
        {coupons.map((cpn) => (
          <div
            key={cpn.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-sm text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-lg">
                  {cpn.code}
                </span>
                <span
                  className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                    cpn.isActive
                      ? 'bg-emerald-50 text-[#138808] dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {cpn.isActive ? 'Active' : 'Paused'}
                </span>
                <span className="text-[11px] font-bold text-[#FF671F]">
                  {cpn.discountType === 'percentage'
                    ? `${(cpn.discountPercentBps / 100).toFixed(0)}% OFF${cpn.maxDiscountInr ? ` (up to ₹${cpn.maxDiscountInr})` : ''}`
                    : `₹${cpn.discountAmountInr} OFF`}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">{cpn.description}</p>
              <div className="text-[10px] text-slate-400 flex flex-wrap gap-3">
                <span>Min Order: ₹{cpn.minOrderAmountInr}</span>
                <span>Used: {cpn.usedCount}{cpn.usageLimit ? ` / ${cpn.usageLimit}` : ''}</span>
                <span>
                  Scope:{' '}
                  {cpn.applicableCategories && cpn.applicableCategories.length > 0
                    ? cpn.applicableCategories.join(', ')
                    : 'All Categories'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onSaveCoupon({ ...cpn, isActive: !cpn.isActive });
                  onNotify(`${cpn.isActive ? 'Paused' : 'Activated'} coupon "${cpn.code}".`);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                {cpn.isActive ? 'Pause' : 'Activate'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteCoupon(cpn.id);
                  onNotify(`Deleted coupon "${cpn.code}".`);
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                title="Delete coupon"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface CategoriesPanelProps {
  categories: ServiceCategory[];
  services: Service[];
  onSaveCategory: (category: ServiceCategory) => void;
  onNotify: (msg: string) => void;
}

export const AdminCategoriesPanel: React.FC<CategoriesPanelProps> = ({
  categories,
  services,
  onSaveCategory,
  onNotify,
}) => {
  const [editingCat, setEditingCat] = useState<ServiceCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catNameHi, setCatNameHi] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catSubs, setCatSubs] = useState('');

  const startEdit = (cat: ServiceCategory) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatNameHi(cat.nameHi || '');
    setCatDesc(cat.description);
    setCatSubs((cat.subcategories || []).join(', '));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCat) return;
    onSaveCategory({
      ...editingCat,
      name: catName.trim() || editingCat.name,
      nameHi: catNameHi.trim() || editingCat.nameHi,
      description: catDesc.trim() || editingCat.description,
      subcategories: catSubs
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    onNotify(`Updated category "${catName.trim() || editingCat.name}".`);
    setEditingCat(null);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((cat) => {
          const itemCount = services.filter((s) => s.category === cat.slug).length;
          return (
            <div
              key={cat.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2.5 text-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {cat.categoryCode || cat.slug}
                    </span>
                    <span className="font-bold text-[#138808] text-[11px]">{itemCount} items</span>
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm mt-1">{cat.name}</h4>
                  <p className="text-[11px] text-slate-500">{cat.nameHi}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onSaveCategory({ ...cat, isActive: cat.isActive === false })
                    }
                    className={`px-2.5 py-1 rounded-lg font-bold text-[10px] cursor-pointer ${
                      cat.isActive !== false
                        ? 'bg-emerald-50 text-[#138808] dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                    }`}
                  >
                    {cat.isActive !== false ? 'Active' : 'Hidden'}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(cat)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-[11px]">{cat.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {(cat.subcategories || []).map((sub) => (
                  <span
                    key={sub}
                    className="px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-600 dark:text-slate-300"
                  >
                    {sub}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {editingCat && (
        <form
          onSubmit={handleSave}
          className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-3 text-xs"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-[#FF671F]" />
              <span>Edit Category: {editingCat.slug}</span>
            </h4>
            <button
              type="button"
              onClick={() => setEditingCat(null)}
              className="text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Display Name</label>
              <input
                type="text"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                required
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Hindi Subtitle</label>
              <input
                type="text"
                value={catNameHi}
                onChange={(e) => setCatNameHi(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Description</label>
            <textarea
              rows={2}
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Subcategories (comma separated)</label>
            <input
              type="text"
              value={catSubs}
              onChange={(e) => setCatSubs(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="submit"
              className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-4 py-2 rounded-xl cursor-pointer"
            >
              Save Category
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

interface DigitalOrdersPanelProps {
  digitalOrders: DigitalProductOrder[];
}

export const AdminDigitalOrdersPanel: React.FC<DigitalOrdersPanelProps> = ({
  digitalOrders,
}) => {
  if (digitalOrders.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-xs space-y-2">
        <PackageCheck className="w-8 h-8 text-slate-300 mx-auto" />
        <p className="font-bold text-slate-800 dark:text-white">No digital product orders recorded yet</p>
        <p className="text-slate-500">
          When customers purchase instant templates, Excel GST trackers, or Startup Toolkits, authorized download receipts appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden text-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/70 text-[11px] text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Order ID</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Paid</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Downloads</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {digitalOrders.map((ord) => (
              <tr key={ord.id}>
                <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{ord.orderId}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-900 dark:text-white">{ord.productName}</div>
                  <div className="text-[10px] text-slate-400">
                    {ord.fileFormat} · {ord.version}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800 dark:text-slate-200">{ord.userName}</div>
                  <div className="text-[10px] text-slate-400">{ord.userEmail}</div>
                </td>
                <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                  ₹{ord.amountPaid.toLocaleString('en-IN')}
                  {ord.couponCode && (
                    <span className="block text-[10px] text-emerald-600 font-normal">{ord.couponCode}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#138808] font-bold text-[10px]">
                    {ord.paymentStatus}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono">{ord.downloadCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface QuoteRequestsPanelProps {
  quoteRequests: CustomQuoteRequest[];
  onUpdateStatus: (
    quoteId: string,
    status: CustomQuoteRequest['status'],
    quotedAmountInr?: number,
    adminNotes?: string
  ) => void;
  onNotify: (msg: string) => void;
}

export const AdminQuoteRequestsPanel: React.FC<QuoteRequestsPanelProps> = ({
  quoteRequests,
  onUpdateStatus,
  onNotify,
}) => {
  const [quoteAmounts, setQuoteAmounts] = useState<Record<string, string>>({});
  const [quoteNotes, setQuoteNotes] = useState<Record<string, string>>({});

  if (quoteRequests.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-xs space-y-2">
        <MessageSquareQuote className="w-8 h-8 text-slate-300 mx-auto" />
        <p className="font-bold text-slate-800 dark:text-white">No custom quote inquiries yet</p>
        <p className="text-slate-500">
          Inquiries submitted on Custom Software, AI Chatbots, White-Label Portals, or Enterprise packages appear here for scoping.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {quoteRequests.map((q) => (
        <div
          key={q.id}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 text-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-[#FF671F]">{q.id}</span>
                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold text-[10px]">
                  {q.status}
                </span>
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm mt-1">{q.serviceName}</h4>
              <p className="text-[11px] text-slate-500">
                {q.contactName} {q.companyName ? `(${q.companyName})` : ''} · {q.contactEmail} · {q.contactMobile}
              </p>
            </div>
            {q.quotedAmountInr && (
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Quoted Fee</span>
                <span className="font-mono font-black text-sm text-[#138808]">
                  ₹{q.quotedAmountInr.toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </div>

          <p className="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-3 text-slate-700 dark:text-slate-300 leading-relaxed">
            {q.requirementsSummary}
            {q.budgetRange ? ` (Budget range: ${q.budgetRange})` : ''}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
            <input
              type="number"
              min={0}
              placeholder={q.quotedAmountInr ? String(q.quotedAmountInr) : 'Quoted fee (INR)'}
              value={quoteAmounts[q.id] ?? ''}
              onChange={(e) => setQuoteAmounts((prev) => ({ ...prev, [q.id]: e.target.value }))}
              className="sm:col-span-3 bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
            />
            <input
              type="text"
              placeholder={q.adminNotes || 'Scope / timeline remarks...'}
              value={quoteNotes[q.id] ?? ''}
              onChange={(e) => setQuoteNotes((prev) => ({ ...prev, [q.id]: e.target.value }))}
              className="sm:col-span-5 bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
            />
            <div className="sm:col-span-4 flex flex-wrap gap-1.5 justify-end">
              {(['In Review', 'Quoted', 'Converted', 'Closed'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    const amt = quoteAmounts[q.id] ? Number(quoteAmounts[q.id]) : q.quotedAmountInr;
                    const note = quoteNotes[q.id]?.trim() || q.adminNotes;
                    onUpdateStatus(q.id, st, amt, note);
                    onNotify(`Quote ${q.id} marked as ${st}.`);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg font-bold text-[10px] border cursor-pointer ${
                    q.status === st
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

interface ImportExportPanelProps {
  services: Service[];
  importReports: CatalogueImportReport[];
  actorName?: string;
  onImportCatalogue: (
    rawInput: string | Service[],
    formatHint?: 'json' | 'csv' | 'system_sync'
  ) => Promise<CatalogueImportReport>;
  onSyncCatalogueToDb?: (options?: {
    includePackages?: boolean;
    dryRun?: boolean;
    forceRefreshSeo?: boolean;
  }) => Promise<CatalogueImportReport>;
  onNotify: (msg: string) => void;
}

export const AdminImportExportPanel: React.FC<ImportExportPanelProps> = ({
  services,
  importReports,
  actorName,
  onImportCatalogue,
  onSyncCatalogueToDb,
  onNotify,
}) => {
  const [payloadText, setPayloadText] = useState('');
  const [formatHint, setFormatHint] = useState<'json' | 'csv'>('csv');
  const [importing, setImporting] = useState(false);
  const [syncingDb, setSyncingDb] = useState(false);
  const [latestReport, setLatestReport] = useState<CatalogueImportReport | null>(
    importReports[0] || null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const triggerDownload = (content: string, fileName: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunImport = async (raw: string, hint: 'json' | 'csv') => {
    if (!raw.trim()) return;
    setImporting(true);
    try {
      const report = await onImportCatalogue(raw, hint);
      // Best-effort sync to D1/Worker backend when signed in as Admin
      await importCatalogueToBackend({
        rawInput: raw,
        formatHint: hint,
        actorName: actorName || 'Admin',
      }).catch(() => null);
      setLatestReport(report);
      onNotify(
        `Idempotent import finished: ${report.createdCount} created, ${report.updatedCount} updated, ${report.skippedCount} skipped.`
      );
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const detectedFormat: 'json' | 'csv' = file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv';
    setFormatHint(detectedFormat);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setPayloadText(text);
    };
    reader.readAsText(file);
  };

  const handleDbSync = async (dryRun: boolean) => {
    if (!onSyncCatalogueToDb) return;
    setSyncingDb(true);
    try {
      const report = await onSyncCatalogueToDb({
        includePackages: true,
        dryRun,
        forceRefreshSeo: true,
      });
      setLatestReport(report);
      onNotify(
        dryRun
          ? `Dry-run preview: ${report.totalProcessed} catalog services checked (+${report.createdCount} new, ~${report.updatedCount} updates, ${report.skippedCount} skipped).`
          : `Idempotent Services DB & SEO sync complete: +${report.createdCount} created, ~${report.updatedCount} updated, ${report.skippedCount} skipped.`
      );
    } catch (err: any) {
      onNotify(err?.message || 'Unable to execute Services DB sync.');
    } finally {
      setSyncingDb(false);
    }
  };

  return (
    <div className="space-y-5 text-xs">
      {onSyncCatalogueToDb && (
        <div className="bg-gradient-to-r from-[#0A2540] to-[#0B4A2D] text-white rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1 max-w-2xl">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              Admin-Only Idempotent Services Schema &amp; SEO Sync
            </div>
            <h4 className="text-sm sm:text-base font-black text-white">
              Sync All 145 Services &amp; Structured SEO Data to Existing Database
            </h4>
            <p className="text-white/80 text-xs leading-relaxed">
              Iterates through every catalog item, injects canonical <code className="font-mono text-emerald-200">seoData.ts</code> metadata, matches existing <code className="font-mono text-emerald-200">/services</code> &amp; D1 records by <code className="font-mono text-emerald-200">id</code>/<code className="font-mono text-emerald-200">slug</code> without creating duplicates, and skips unchanged entries cleanly.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              disabled={syncingDb}
              onClick={() => handleDbSync(true)}
              className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/25 font-bold cursor-pointer disabled:opacity-50"
            >
              {syncingDb ? 'Checking...' : 'Preview Dry-Run'}
            </button>
            <button
              type="button"
              disabled={syncingDb}
              onClick={() => handleDbSync(false)}
              className="px-4 py-2.5 rounded-xl bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncingDb ? 'animate-spin' : ''}`} />
              <span>{syncingDb ? 'Syncing DB...' : 'Run Idempotent DB Sync'}</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <Download className="w-4 h-4 text-[#138808]" />
            <span>Export Current Catalogue ({services.length} items)</span>
          </h4>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Download the full live catalogue in CSV or JSON format. Existing IDs and canonical slugs are preserved so edits re-import idempotently without creating duplicates.
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="button"
              onClick={() =>
                triggerDownload(
                  exportCatalogueToCsv(services),
                  `dip-catalogue-${new Date().toISOString().slice(0, 10)}.csv`,
                  'text/csv;charset=utf-8'
                )
              }
              className="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-[#138808] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() =>
                triggerDownload(
                  exportCatalogueToJson(services),
                  `dip-catalogue-${new Date().toISOString().slice(0, 10)}.json`,
                  'application/json;charset=utf-8'
                )
              }
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <FileJson className="w-4 h-4" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-[#FF671F]" />
            <span>Idempotent Bulk Import</span>
          </h4>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Matches records by <code className="font-mono">id</code> or <code className="font-mono">slug</code>. Updates fees, metadata, and publishing status safely while preserving existing form schemas and document rules.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Load CSV / JSON File</span>
            </button>
            <select
              value={formatHint}
              onChange={(e) => setFormatHint(e.target.value as 'json' | 'csv')}
              className="bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold"
            >
              <option value="csv">CSV Format</option>
              <option value="json">JSON Format</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
        <label className="block font-bold text-slate-800 dark:text-slate-200">
          Paste CSV / JSON Catalogue Payload
        </label>
        <textarea
          rows={6}
          value={payloadText}
          onChange={(e) => setPayloadText(e.target.value)}
          placeholder="id,slug,name,category,serviceCharge,govtFees&#10;pan-card,pan-card,New PAN Card Application,personal,199,107"
          className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 font-mono text-[11px]"
        />
        <div className="flex justify-end">
          <button
            type="button"
            disabled={importing || !payloadText.trim()}
            onClick={() => handleRunImport(payloadText, formatHint)}
            className="bg-[#FF671F] hover:bg-[#E55B1B] disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl cursor-pointer flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            <span>{importing ? 'Importing...' : 'Run Idempotent Import'}</span>
          </button>
        </div>
      </div>

      {(latestReport || importReports.length > 0) && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#138808]" />
            <span>Import Audit Reports</span>
          </h4>
          <div className="space-y-2">
            {(latestReport ? [latestReport, ...importReports.filter((r) => r.id !== latestReport.id)] : importReports)
              .slice(0, 6)
              .map((rep) => (
                <div
                  key={rep.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">
                      {rep.sourceFormat.toUpperCase()} Import by {rep.actorName} ·{' '}
                      <span className="font-mono text-[10px] text-slate-500">
                        {new Date(rep.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {rep.errors.length > 0 && (
                      <div className="text-red-600 text-[11px] mt-1">{rep.errors.slice(0, 3).join(' | ')}</div>
                    )}
                    {rep.warnings.length > 0 && (
                      <div className="text-amber-600 text-[11px] mt-1">{rep.warnings.join(' | ')}</div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-mono font-bold shrink-0">
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#138808]">+{rep.createdCount} new</span>
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700">~{rep.updatedCount} upd</span>
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700">{rep.skippedCount} skip</span>
                    {rep.errorsCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-red-50 text-red-700">{rep.errorsCount} err</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
