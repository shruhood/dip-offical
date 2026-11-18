import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
  GUEST_AUDIENCE_PROFILES,
  GuestAudienceKey,
} from '../../lib/roleLandingConfig';
import { buildUrlForRoute } from '../../lib/siteUrls';
import { trackInteraction } from '../../lib/perfMonitor';
import { AppCardStatusBadge, DynamicBadgeTheme } from '../common/AppCardStatusBadge';
import {
  User,
  Handshake,
  UserCheck,
  Building2,
  CheckCircle2,
  ArrowRight,
  FileCheck2,
} from 'lucide-react';

interface GuestAudienceShowcaseProps {
  onNavigate: (route: string, param?: string) => void;
}

const AUDIENCE_ORDER: GuestAudienceKey[] = ['customer', 'partner', 'operator', 'business'];

const AUDIENCE_SELECTOR_META: Record<
  GuestAudienceKey,
  { subtitleEn: string; subtitleHi: string; badgeLabel: string; badgeLabelHi: string; badgeTheme: DynamicBadgeTheme }
> = {
  customer: {
    subtitleEn: 'Self-service filing & tracking',
    subtitleHi: 'स्व-सेवा आवेदन व ट्रैकिंग',
    badgeLabel: 'Popular',
    badgeLabelHi: 'लोकप्रिय',
    badgeTheme: 'instant',
  },
  partner: {
    subtitleEn: '15–20% partner commission',
    subtitleHi: '15–20% पार्टनर कमीशन',
    badgeLabel: 'Hot',
    badgeLabelHi: 'हॉट',
    badgeTheme: 'hot',
  },
  operator: {
    subtitleEn: 'Walk-in CSC center desk',
    subtitleHi: 'वॉक-इन सुविधा केंद्र डेस्क',
    badgeLabel: 'New',
    badgeLabelHi: 'नया',
    badgeTheme: 'new',
  },
  business: {
    subtitleEn: 'Bulk API Setu & KYB',
    subtitleHi: 'बल्क API सेतु व KYB',
    badgeLabel: 'B2B API',
    badgeLabelHi: 'B2B API',
    badgeTheme: 'api',
  },
};

function renderAudienceIcon(key: GuestAudienceKey, className = 'w-4 h-4') {
  switch (key) {
    case 'customer':
      return <User className={className} />;
    case 'partner':
      return <Handshake className={className} />;
    case 'operator':
      return <UserCheck className={className} />;
    case 'business':
      return <Building2 className={className} />;
  }
}

export const GuestAudienceShowcase: React.FC<GuestAudienceShowcaseProps> = ({ onNavigate }) => {
  const { lang } = useLanguage();
  const [selectedAudience, setSelectedAudience] = useState<GuestAudienceKey>('customer');

  const profile = GUEST_AUDIENCE_PROFILES[selectedAudience];

  const handleLink = (e: React.MouseEvent, route: string, param?: string) => {
    e.preventDefault();
    trackInteraction('home', 'audience_cta', `${selectedAudience}:${route}`, 'home');
    onNavigate(route, param);
  };

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
      <div className="bg-gradient-to-br from-white via-orange-50/35 to-sky-50/45 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-8 lg:p-10 shadow-xs space-y-8">
        {/* Centered Header + Centered Role Blocks */}
        <div className="space-y-6 border-b border-slate-200 dark:border-slate-800 pb-7">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-[#FF671F]">
              {lang === 'hi' ? 'अपना खाता प्रकार चुनें' : 'Custom Workspace by User Type'}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight text-balance">
              {lang === 'hi'
                ? 'हर उपयोगकर्ता के लिए समर्पित डिजिटल पोर्टल'
                : 'Select Your Role to Preview Everything You Get'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl mx-auto">
              {lang === 'hi'
                ? 'नागरिक, पार्टनर एजेंट, ऑपरेटर केंद्र या B2B एंटरप्राइज चुनें और अपनी आवश्यक सुविधाएं देखें।'
                : 'Choose whether you are applying for yourself, enrolling as an authorized Partner or Operator Desk, or integrating B2B APIs.'}
            </p>
          </div>

          <div
            role="tablist"
            aria-label="User Account Type Selector"
            className="max-w-4xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5"
          >
            {AUDIENCE_ORDER.map((key) => {
              const item = GUEST_AUDIENCE_PROFILES[key];
              const meta = AUDIENCE_SELECTOR_META[key];
              const active = key === selectedAudience;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSelectedAudience(key);
                    trackInteraction('home', 'audience_role_select', key, 'home');
                  }}
                  className={`app-card rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 border text-center flex flex-col items-center justify-between gap-1.5 sm:gap-2 cursor-pointer ${
                    active
                      ? 'bg-[#FFF9F5] dark:bg-orange-950/30 border-[#FF671F] ring-1 ring-[#FF671F]/25 shadow-sm'
                      : 'bg-[#F7F8FA] dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-[#FF671F]/60'
                  }`}
                >
                  <div className="w-full flex items-center justify-between gap-1">
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        active
                          ? 'bg-[#FF671F] text-white'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {renderAudienceIcon(key, 'w-3.5 h-3.5 sm:w-4 sm:h-4')}
                    </div>
                    <AppCardStatusBadge
                      label={lang === 'hi' ? meta.badgeLabelHi : meta.badgeLabel}
                      theme={meta.badgeTheme}
                    />
                  </div>

                  <div className="w-full space-y-0.5 text-center">
                    <div
                      className={`text-[11px] sm:text-sm font-bold line-clamp-1 ${
                        active ? 'text-[#FF671F]' : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {lang === 'hi' ? item.labelHi : item.label}
                    </div>
                    <div className="text-[9.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                      {lang === 'hi' ? meta.subtitleHi : meta.subtitleEn}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Centered Role Preview Stage */}
        <div className="max-w-5xl mx-auto space-y-7">
          {/* Centered Role Value Proposition */}
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#138808] dark:text-emerald-400">
              {lang === 'hi' ? profile.eyebrowHi : profile.eyebrow}
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight text-balance">
              {lang === 'hi' ? profile.headlineHi : profile.headline}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {lang === 'hi' ? profile.summaryHi : profile.summary}
            </p>
          </div>

          {/* Centered 3 Role Highlights */}
          <div className="max-w-3xl mx-auto grid grid-cols-3 gap-2 sm:gap-3.5 tabular-nums text-center">
            {profile.highlights.map((h, i) => {
              const highlightPalette = [
                'bg-orange-50/80 dark:bg-orange-950/30 border-orange-200/80 dark:border-orange-900/50',
                'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-900/50',
                'bg-sky-50/80 dark:bg-sky-950/30 border-sky-200/80 dark:border-sky-900/50',
              ][i % 3];
              return (
              <div
                key={i}
                className={`app-block p-2.5 sm:p-4 rounded-2xl border ${highlightPalette}`}
              >
                <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
                  {lang === 'hi' ? h.labelHi : h.label}
                </div>
                <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-0.5 truncate">
                  {h.value}
                </div>
              </div>
              );
            })}
          </div>

          {/* Centered Included Capabilities 2x2 Grid */}
          <div className="max-w-4xl mx-auto grid grid-cols-2 gap-2.5 sm:gap-4">
            {profile.includedNeeds.map((feat, idx) => {
              const capPalette = [
                'bg-gradient-to-br from-blue-50/75 via-white to-sky-50/45 dark:from-blue-950/25 dark:via-slate-950 dark:to-slate-900 border-blue-200/75 dark:border-blue-900/45',
                'bg-gradient-to-br from-emerald-50/75 via-white to-teal-50/45 dark:from-emerald-950/25 dark:via-slate-950 dark:to-slate-900 border-emerald-200/75 dark:border-emerald-900/45',
                'bg-gradient-to-br from-amber-50/75 via-white to-orange-50/45 dark:from-amber-950/25 dark:via-slate-950 dark:to-slate-900 border-amber-200/75 dark:border-amber-900/45',
                'bg-gradient-to-br from-violet-50/75 via-white to-indigo-50/45 dark:from-violet-950/25 dark:via-slate-950 dark:to-slate-900 border-violet-200/75 dark:border-violet-900/45',
              ][idx % 4];
              return (
              <div
                key={idx}
                className={`app-card p-3.5 sm:p-4 rounded-2xl border space-y-1.5 ${capPalette}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold text-slate-900 dark:text-white min-w-0">
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF671F] shrink-0" />
                    <span className="line-clamp-1">{lang === 'hi' ? feat.titleHi : feat.title}</span>
                  </div>
                  {idx === 0 && (
                    <AppCardStatusBadge
                      contextKey={selectedAudience}
                      label={lang === 'hi' ? 'मुख्य' : 'Included'}
                      theme={selectedAudience === 'partner' ? 'hot' : selectedAudience === 'operator' ? 'new' : 'instant'}
                    />
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-snug sm:leading-relaxed line-clamp-3">
                  {lang === 'hi' ? feat.detailHi : feat.detail}
                </p>
              </div>
              );
            })}
          </div>

          {/* Centered Prerequisites Checklist & Direct Conversion CTAs */}
          <div className="max-w-4xl mx-auto bg-gradient-to-br from-orange-50/55 via-[#FFFDF9] to-emerald-50/55 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/60 text-[#138808] dark:text-emerald-400 flex items-center justify-center">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {lang === 'hi' ? 'शुरू करने के लिए तैयार रखें' : 'Ready to Onboard'}
                </div>
                <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'hi' ? 'आवश्यक विवरण व दस्तावेज़' : 'What You Need to Get Started'}
                </div>
              </div>
            </div>

            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 border-y border-slate-200/80 dark:border-slate-800 py-4">
              {profile.onboardingDocs.map((doc, idx) => (
                <li
                  key={idx}
                  className="app-block flex items-start gap-2.5 p-3 rounded-xl bg-white/90 dark:bg-slate-900 border border-slate-200/75 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed"
                >
                  <span className="font-mono font-bold text-[#FF671F] shrink-0">
                    0{idx + 1}
                  </span>
                  <span>{lang === 'hi' ? doc.hi : doc.en}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
              <a
                href={buildUrlForRoute(profile.primaryCta.route, profile.primaryCta.param)}
                onClick={(e) => handleLink(e, profile.primaryCta.route, profile.primaryCta.param)}
                className="w-full sm:w-auto min-w-[180px] sm:min-w-[210px] bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold text-xs sm:text-sm px-4 py-2 sm:px-5 sm:py-3 rounded-lg sm:rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap"
              >
                <span>{lang === 'hi' ? profile.primaryCta.labelHi : profile.primaryCta.label}</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </a>

              <a
                href={buildUrlForRoute(profile.secondaryCta.route, profile.secondaryCta.param)}
                onClick={(e) => handleLink(e, profile.secondaryCta.route, profile.secondaryCta.param)}
                className="w-full sm:w-auto min-w-[170px] sm:min-w-[190px] bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm px-4 py-2 sm:px-5 sm:py-3 rounded-lg sm:rounded-xl transition flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap"
              >
                <span>{lang === 'hi' ? profile.secondaryCta.labelHi : profile.secondaryCta.label}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
