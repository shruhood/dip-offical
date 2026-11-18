import React from 'react';
import {
  MapPin,
  Phone,
  Mail,
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
  Clock,
  Building2,
  Sparkles,
} from 'lucide-react';
import { Service } from '../types';
import { useData } from '../context/DataContext';
import { TARGET_LOCATIONS } from '../data/catalogue/locations';
import { formatServicePriceLabel } from '../lib/finance';
import { buildUrlForRoute } from '../lib/siteUrls';

interface LocationPageProps {
  citySlug: string;
  onNavigate: (route: string, param?: string) => void;
  onApplyForService: (service: Service) => void;
}

export const LocationPage: React.FC<LocationPageProps> = ({
  citySlug,
  onNavigate,
  onApplyForService,
}) => {
  const { services, businessSettings } = useData();
  const normalizedSlug = (citySlug || 'silvassa').trim().toLowerCase();
  const location =
    TARGET_LOCATIONS.find((l) => l.slug === normalizedSlug) || TARGET_LOCATIONS[0];

  const highlightedServices = location.highlightedServiceSlugs
    .map((slug) => services.find((s) => s.slug === slug && s.published !== false))
    .filter((s): s is Service => Boolean(s));

  const fallbackServices =
    highlightedServices.length > 0
      ? highlightedServices
      : services.filter((s) => s.published !== false && s.popular).slice(0, 6);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
      {/* City Breadcrumb & Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="hover:text-[#FF671F] font-medium cursor-pointer"
          >
            Home
          </button>
          <span>/</span>
          <span>Regional Service Desks</span>
          <span>/</span>
          <span className="font-bold text-slate-900 dark:text-white">{location.name}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {TARGET_LOCATIONS.map((loc) => (
            <a
              key={loc.slug}
              href={buildUrlForRoute('location', loc.slug)}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                onNavigate('location', loc.slug);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                loc.slug === location.slug
                  ? 'bg-[#FF671F] text-white shadow-2xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-[#FF671F]'
              }`}
            >
              {loc.name}
            </a>
          ))}
        </div>
      </div>

      {/* Hero Banner */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-10 shadow-xs grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-8 space-y-4">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#FF671F]">
            <MapPin className="w-4 h-4 shrink-0" />
            <span>
              {location.regionTitle} · {location.stateOrUt}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            {location.headline}
          </h1>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
            {location.summary}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {location.industrialAndCitizenFocus.map((point, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-3"
              >
                <CheckCircle2 className="w-4 h-4 text-[#138808] shrink-0 mt-0.5" />
                <span>{point}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('services', 'all')}
              className="px-5 py-2.5 rounded-xl bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
            >
              <span>Browse All {services.filter((s) => s.published !== false).length} Services</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('packages')}
              className="px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-[#138808] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-bold hover:bg-emerald-100 transition cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>View Startup &amp; Compliance Packages</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('contact')}
              className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:border-[#FF671F] transition cursor-pointer"
            >
              Request Local Desk Callback
            </button>
          </div>
        </div>

        {/* Local Office Info Card */}
        <div className="lg:col-span-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
            <Building2 className="w-4 h-4 text-[#FF671F]" />
            <span>Regional Coordination Desk</span>
          </div>

          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            {location.localOfficeNote}
          </p>

          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-[#FF671F] mt-0.5 shrink-0" />
              <span>{businessSettings.registeredAddress}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-[#138808] shrink-0" />
              <a
                href={`tel:${businessSettings.supportPhone.replace(/\s+/g, '')}`}
                className="font-semibold hover:text-[#FF671F]"
              >
                {businessSettings.supportPhone}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-[#FF671F] shrink-0" />
              <a
                href={`mailto:${businessSettings.supportEmail}`}
                className="hover:text-[#FF671F] break-all"
              >
                {businessSettings.supportEmail}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Mon – Sat: 9:30 AM – 7:00 PM IST</span>
            </div>
          </div>

          <div className="p-3 bg-[#FFFDF8] dark:bg-slate-900 border border-[#F1E8D9] dark:border-slate-700 rounded-xl text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
            <div className="flex items-center gap-1 font-bold text-[#FF671F]">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>Private Consultancy Disclosure</span>
            </div>
            <p>
              Digital India Project is a private online services firm, not a government body. Official approvals rest exclusively with jurisdictional statutory authorities.
            </p>
          </div>
        </div>
      </section>

      {/* Top Services for this Location */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#138808]">
              Most Requested in {location.name}
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Popular Documentation &amp; Compliance Services
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('services', 'all')}
            className="text-xs font-bold text-[#FF671F] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Explore Full 8-Category Catalogue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {fallbackServices.map((srv) => (
            <div
              key={srv.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs hover:border-[#FF671F]/60 transition flex flex-col justify-between gap-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-[#FF671F]">
                    {srv.subcategory || srv.category.replace(/-/g, ' ')}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {srv.estimatedTime}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                  <button
                    type="button"
                    onClick={() => onNavigate('service-detail', srv.slug)}
                    className="text-left hover:text-[#FF671F] transition cursor-pointer"
                  >
                    {srv.name}
                  </button>
                </h3>

                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                  {srv.shortDesc}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    Professional Fee
                  </div>
                  <div className="text-base font-black text-slate-900 dark:text-white font-mono tabular-nums">
                    {formatServicePriceLabel(srv)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('service-detail', srv.slug)}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#FF671F] cursor-pointer"
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    onClick={() => onApplyForService(srv)}
                    className="px-3.5 py-2 rounded-lg bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
