import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { formatServicePriceLabel } from '../lib/finance';
import { Service } from '../types';
import {
  FileText,
  Upload,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Clock,
  Info,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface PublicInfoProps {
  mode: 'how-it-works' | 'pricing';
  onNavigate: (route: string, param?: string) => void;
  onApplyForService: (service: Service) => void;
}

const PRICING_PER_PAGE = 20;

export const PublicInfoPage: React.FC<PublicInfoProps> = ({
  mode,
  onNavigate,
  onApplyForService,
}) => {
  const { services, categories } = useData();
  const [pricingSearch, setPricingSearch] = useState('');
  const [pricingCat, setPricingCat] = useState('all');
  const [pricingPage, setPricingPage] = useState(1);

  const filteredPricingServices = useMemo(() => {
    const q = pricingSearch.toLowerCase().trim();
    return services.filter((s) => {
      if (s.published === false) return false;
      const matchCat =
        pricingCat === 'all'
          ? true
          : pricingCat === 'packages'
          ? s.category === 'packages' || s.productType === 'compliance_package'
          : s.category === pricingCat;
      const matchQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.shortDesc.toLowerCase().includes(q) ||
        (s.subcategory && s.subcategory.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  }, [services, pricingCat, pricingSearch]);

  const totalPricingPages = Math.max(1, Math.ceil(filteredPricingServices.length / PRICING_PER_PAGE));
  const safePage = Math.min(pricingPage, totalPricingPages);
  const paginatedPricingServices = filteredPricingServices.slice(
    (safePage - 1) * PRICING_PER_PAGE,
    safePage * PRICING_PER_PAGE
  );

  if (mode === 'how-it-works') {
    const steps = [
      {
        num: '01',
        title: 'Choose Service & Filing Mode',
        desc: 'Select from citizen, tax, business, or compliance services. Apply online yourself or visit an Authorized Operator / Partner desk.',
        icon: FileText,
      },
      {
        num: '02',
        title: 'Dynamic Form & Document Upload',
        desc: 'Fill bilingual guided fields and upload clear PDF/JPG documents directly to private encrypted R2 cloud storage.',
        icon: Upload,
      },
      {
        num: '03',
        title: 'Verification & Transparent Checkout',
        desc: 'Pay government fees plus a clearly itemized private facilitation charge via Cashfree with an instant invoice.',
        icon: ShieldCheck,
      },
      {
        num: '04',
        title: 'Live Tracking & Final Certificate',
        desc: 'Follow every 14-stage compliance milestone in real time and download your completed certificate from your vault.',
        icon: CheckCircle2,
      },
    ];

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#FF671F]">
            Transparent Digital Facilitation
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            How Digital India Project Works
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            A structured 4-step workflow built for accuracy, private document security, and zero guesswork.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((st) => {
            const Icon = st.icon;
            return (
              <div
                key={st.num}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-[#FF671F]">STEP {st.num}</span>
                  <Icon className="w-5 h-5 text-[#138808]" />
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">{st.title}</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{st.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="p-6 bg-[#FFFDF8] dark:bg-slate-900 border border-[#F1E8D9] dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              Ready to submit an application or verify an existing ID?
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Explore all services with upfront fee breakdowns and SLA timelines.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('services')}
              className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <span>Browse Services</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('track')}
              className="border border-slate-300 dark:border-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer"
            >
              Track Status
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#FF671F]">
            Itemized Fee Schedule ({filteredPricingServices.length} Active Items)
          </span>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white mt-1">
            Transparent Service Charges &amp; Statutory Fees
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Every payment separates official statutory government fees and 3rd-party charges from Digital India Project&apos;s private documentation &amp; compliance fee.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search fee schedule..."
            value={pricingSearch}
            onChange={(e) => {
              setPricingSearch(e.target.value);
              setPricingPage(1);
            }}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#FF671F]"
          />
        </div>
      </div>

      {/* Category Filter Strip */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setPricingCat('all');
            setPricingPage(1);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
            pricingCat === 'all'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          All Categories
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => {
              setPricingCat(cat.slug);
              setPricingPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              pricingCat === cat.slug
                ? 'bg-[#FF671F] text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {cat.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setPricingCat('packages');
            setPricingPage(1);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
            pricingCat === 'packages'
              ? 'bg-[#138808] text-white'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[#138808]'
          }`}
        >
          Packages
        </button>
      </div>

      <div className="p-4 bg-[#FFFDF8] dark:bg-slate-900 border border-[#F1E8D9] dark:border-slate-800 rounded-xl flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
        <Info className="w-4 h-4 text-[#FF671F] shrink-0 mt-0.5" />
        <span>
          <strong>Private Facilitation Disclaimer:</strong> Digital India Project is an independent private consultancy. We charge a transparent professional fee; statutory government fees and 3rd-party charges (stamp duty, courier, notary, token, portal challans) apply at actuals where applicable.
        </span>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left tabular-nums">
            <thead className="bg-slate-50 dark:bg-slate-800/70 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Service / Product</th>
                <th className="p-4">Category</th>
                <th className="p-4">Est. Timeline</th>
                <th className="p-4">Professional Fee</th>
                <th className="p-4">Govt / 3rd-Party Fee</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedPricingServices.map((srv) => (
                <tr key={srv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="p-4">
                    <button
                      type="button"
                      onClick={() => onNavigate('service-detail', srv.slug)}
                      className="font-bold text-slate-900 dark:text-white hover:text-[#FF671F] text-left cursor-pointer"
                    >
                      {srv.name}
                    </button>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                      {srv.shortDesc}
                    </div>
                  </td>
                  <td className="p-4 text-[11px] text-slate-500 dark:text-slate-400 capitalize whitespace-nowrap">
                    {srv.category.replace(/-/g, ' ')}
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#138808]" />
                      {srv.estimatedTime}
                    </span>
                  </td>
                  <td className="p-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {formatServicePriceLabel(srv)}
                  </td>
                  <td className="p-4 font-mono text-slate-500 whitespace-nowrap">
                    {srv.govtFees + (srv.thirdPartyFees || 0) > 0
                      ? `₹${srv.govtFees + (srv.thirdPartyFees || 0)}`
                      : 'Actuals / ₹0'}
                  </td>
                  <td className="p-4 text-right whitespace-nowrap">
                    {srv.isCustomQuote ? (
                      <button
                        type="button"
                        onClick={() => onNavigate('service-detail', srv.slug)}
                        className="border border-[#FF671F] text-[#FF671F] hover:bg-orange-50 font-bold px-3.5 py-1.5 rounded-lg text-xs cursor-pointer"
                      >
                        Request Quote
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onApplyForService(srv)}
                        className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-3.5 py-1.5 rounded-lg text-xs cursor-pointer"
                      >
                        Apply Now
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPricingPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Page {safePage} of {totalPricingPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPricingPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <button
              type="button"
              disabled={safePage >= totalPricingPages}
              onClick={() => setPricingPage((p) => Math.min(totalPricingPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
