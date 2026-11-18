import React, { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useData } from '../context/DataContext';
import { formatServicePriceLabel } from '../lib/finance';
import { resolveCategorySlug } from '../data/catalogue/categories';
import { trackInteraction } from '../lib/perfMonitor';
import { ServiceGridSkeleton } from '../components/common/SkeletonLoaders';
import { AppCardStatusBadge } from '../components/common/AppCardStatusBadge';
import { getServiceCardTheme } from '../lib/cardColors';
import { API_SATHI_POWERED_SERVICES } from '../data/apiSathiServices';
import { Service } from '../types';
import {
  Search,
  SlidersHorizontal,
  ArrowRight,
  CreditCard,
  Building2,
  Landmark,
  BadgePercent,
  Utensils,
  ShieldCheck,
  Globe,
  ScrollText,
  FolderLock,
  FileSpreadsheet,
  Store,
  ReceiptText,
  FileText,
  X,
  PackageCheck,
  Download,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';

interface ServicesPageProps {
  initialCategory?: string;
  onNavigate: (route: string, param?: string) => void;
  onApplyForService: (service: Service) => void;
}

const ITEMS_PER_PAGE = 18;

export const ServicesPage: React.FC<ServicesPageProps> = ({
  initialCategory = 'all',
  onNavigate,
  onApplyForService,
}) => {
  const { lang, t } = useLanguage();
  const { services, categories, packages } = useData();

  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>(resolveCategorySlug(initialCategory));
  const [selectedSubcat, setSelectedSubcat] = useState<string>('all');
  const [productTypeFilter, setProductTypeFilter] = useState<string>('all');
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('popular');
  const [page, setPage] = useState<number>(1);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  useEffect(() => {
    setSelectedCat(resolveCategorySlug(initialCategory));
    setProductTypeFilter('all');
    setSelectedSubcat('all');
    setPage(1);
  }, [initialCategory]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedCat, selectedSubcat, productTypeFilter, deliveryTypeFilter, priceRange, sortBy]);

  const activeServices = useMemo(() => {
    const base = services.filter((s) => s.published !== false);
    const existingSlugs = new Set(base.map((s) => s.slug.toLowerCase()));
    const extraInstant = API_SATHI_POWERED_SERVICES.filter(
      (s) => !existingSlugs.has(s.slug.toLowerCase())
    );
    return [...base, ...extraInstant];
  }, [services]);

  const activeCategoryConfig = useMemo(
    () => categories.find((c) => c.slug === selectedCat),
    [categories, selectedCat]
  );

  const availableSubcategories = useMemo(() => {
    if (activeCategoryConfig?.subcategories?.length) {
      return activeCategoryConfig.subcategories;
    }
    if (selectedCat === 'all' || selectedCat === 'packages') return [];
    const set = new Set<string>();
    activeServices
      .filter((s) => s.category === selectedCat && s.subcategory)
      .forEach((s) => set.add(s.subcategory!));
    return Array.from(set);
  }, [activeCategoryConfig, activeServices, selectedCat]);

  const filteredServices = useMemo(() => {
    const q = search.toLowerCase().trim();
    return activeServices
      .filter((s) => {
        const matchCategory =
          selectedCat === 'all'
            ? true
            : selectedCat === 'packages'
            ? s.category === 'packages' || s.productType === 'compliance_package'
            : s.category === selectedCat;

        const matchSubcat =
          selectedSubcat === 'all' ||
          (s.subcategory || '').toLowerCase() === selectedSubcat.toLowerCase();

        const isInstantVerification =
          s.integrationType === 'api_setu' && s.billingUnit === 'verification';

        const matchProductType =
          productTypeFilter === 'all'
            ? true
            : productTypeFilter === 'instant_verification'
            ? isInstantVerification
            : (s.productType || 'service') === productTypeFilter;

        const matchDeliveryType =
          deliveryTypeFilter === 'all' ||
          (s.deliveryType || 'assisted') === deliveryTypeFilter;

        const matchSearch =
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.shortDesc.toLowerCase().includes(q) ||
          (s.nameHi && s.nameHi.includes(q)) ||
          (s.subcategory && s.subcategory.toLowerCase().includes(q)) ||
          (s.focusKeyword && s.focusKeyword.toLowerCase().includes(q)) ||
          s.slug.toLowerCase().includes(q);

        let matchPrice = true;
        if (priceRange === 'under-500') matchPrice = !s.isCustomQuote && s.serviceCharge < 500;
        else if (priceRange === '500-1500')
          matchPrice = !s.isCustomQuote && s.serviceCharge >= 500 && s.serviceCharge <= 1500;
        else if (priceRange === '1500-5000')
          matchPrice = !s.isCustomQuote && s.serviceCharge > 1500 && s.serviceCharge <= 5000;
        else if (priceRange === 'above-5000')
          matchPrice = !s.isCustomQuote && s.serviceCharge > 5000;
        else if (priceRange === 'custom')
          matchPrice = Boolean(s.isCustomQuote || s.pricingType === 'custom');

        return (
          matchCategory &&
          matchSubcat &&
          matchProductType &&
          matchDeliveryType &&
          matchSearch &&
          matchPrice
        );
      })
      .sort((a, b) => {
        if (sortBy === 'popular') return (b.popular ? 1 : 0) - (a.popular ? 1 : 0);
        if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
        if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
        if (sortBy === 'price-asc') {
          const ap = a.isCustomQuote ? Number.MAX_SAFE_INTEGER : a.serviceCharge;
          const bp = b.isCustomQuote ? Number.MAX_SAFE_INTEGER : b.serviceCharge;
          return ap - bp;
        }
        if (sortBy === 'price-desc') return b.serviceCharge - a.serviceCharge;
        return 0;
      });
  }, [
    activeServices,
    selectedCat,
    selectedSubcat,
    productTypeFilter,
    deliveryTypeFilter,
    search,
    priceRange,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredServices.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedServices = filteredServices.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const resetAllFilters = () => {
    setSearch('');
    setSelectedCat('all');
    setSelectedSubcat('all');
    setProductTypeFilter('all');
    setDeliveryTypeFilter('all');
    setPriceRange('all');
    setSortBy('popular');
    setPage(1);
  };

  const renderIcon = (name: string, colorClass = 'text-[#FF671F] group-hover:text-white') => {
    const iconCls = `w-3.5 h-3.5 sm:w-4 sm:h-4 transition ${colorClass}`;
    switch (name) {
      case 'CreditCard':
      case 'FilePenLine':
        return <CreditCard className={iconCls} />;
      case 'Building2':
      case 'Building':
        return <Building2 className={iconCls} />;
      case 'Landmark':
        return <Landmark className={iconCls} />;
      case 'BadgePercent':
      case 'Award':
        return <BadgePercent className={iconCls} />;
      case 'Utensils':
        return <Utensils className={iconCls} />;
      case 'ShieldCheck':
        return <ShieldCheck className={iconCls} />;
      case 'Globe':
        return <Globe className={iconCls} />;
      case 'ScrollText':
        return <ScrollText className={iconCls} />;
      case 'FolderLock':
        return <FolderLock className={iconCls} />;
      case 'FileSpreadsheet':
        return <FileSpreadsheet className={iconCls} />;
      case 'Store':
        return <Store className={iconCls} />;
      case 'ReceiptText':
      case 'Receipt':
        return <ReceiptText className={iconCls} />;
      default:
        return <FileText className={iconCls} />;
    }
  };

  const pageTitle =
    selectedCat === 'packages'
      ? 'Startup & Business Compliance Packages'
      : selectedCat === 'digital-products'
      ? 'Downloadable Digital Products, Templates & Toolkits'
      : activeCategoryConfig
      ? activeCategoryConfig.name
      : 'Digital Services & Online Registration Marketplace';

  const pageDescription =
    selectedCat === 'packages'
      ? 'Cost-saving bundled documentation packages for startups, MSMEs, freelancers, and growing enterprises.'
      : selectedCat === 'digital-products'
      ? 'Instant-access Excel spreadsheets, GST invoice books, HR/legal templates, and startup kits with verified checkout.'
      : activeCategoryConfig
      ? activeCategoryConfig.description
      : 'Discover all assisted digital application services, downloadable business toolkits, and compliance packages across India.';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-orange-50/85 via-white to-sky-50/75 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/35 p-6 sm:p-8 rounded-2xl border border-orange-200/70 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF671F] uppercase tracking-wider">
              <span>Official Catalogue</span>
              <span>·</span>
              <span>{activeServices.length} Services, Instant Checks, Products &amp; Packages</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {pageTitle}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {pageDescription}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('verifications')}
              className="px-4 py-2.5 rounded-xl bg-[#138808] hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shadow-xs cursor-pointer transition"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Instant Verifications Hub (13)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Selection Menu Cards: Services / Digital Products / Kits & Packages */}
      {(() => {
        const assistedCount = activeServices.filter((s) => (s.productType || 'service') === 'service').length;
        const digitalCount = activeServices.filter(
          (s) => s.productType === 'digital_product' || s.category === 'digital-products'
        ).length;
        const kitsCount = activeServices.filter(
          (s) => s.category === 'packages' || s.productType === 'compliance_package'
        ).length || packages.length;

        const modeCards = [
          {
            id: 'all',
            title: lang === 'hi' ? 'सभी कैटलॉग' : 'All Catalogue',
            subtitle: lang === 'hi' ? 'सेवाएं, उत्पाद व किट्स' : 'Full marketplace directory',
            count: activeServices.length,
            icon: Layers,
            active: selectedCat === 'all' && productTypeFilter === 'all',
            idleClass:
              'bg-gradient-to-br from-orange-50/85 via-white to-amber-50/55 dark:from-orange-950/30 dark:via-slate-900 dark:to-slate-900 border-orange-200/80 dark:border-orange-900/50 hover:border-[#FF671F]',
            activeClass:
              'bg-gradient-to-br from-[#FF671F] to-orange-600 text-white border-[#FF671F] shadow-md shadow-orange-500/20',
            iconIdle: 'bg-orange-100 dark:bg-orange-950/70 text-[#E55B1B] dark:text-orange-400',
            onSelect: () => {
              setSelectedCat('all');
              setProductTypeFilter('all');
              setSelectedSubcat('all');
              trackInteraction('catalogue', 'mode_card', 'all', 'services');
            },
          },
          {
            id: 'service',
            title: lang === 'hi' ? 'सहायक सेवाएं' : 'Assisted Services',
            subtitle: lang === 'hi' ? 'पैन, जीएसटी, लाइसेंस आवेदन' : 'PAN, GST & Govt filings',
            count: assistedCount,
            icon: FileText,
            active: selectedCat === 'all' && productTypeFilter === 'service',
            idleClass:
              'bg-gradient-to-br from-sky-50/85 via-white to-blue-50/55 dark:from-sky-950/30 dark:via-slate-900 dark:to-slate-900 border-sky-200/80 dark:border-sky-900/50 hover:border-sky-500',
            activeClass:
              'bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-blue-600 shadow-md shadow-blue-600/20',
            iconIdle: 'bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-400',
            onSelect: () => {
              setSelectedCat('all');
              setProductTypeFilter('service');
              setSelectedSubcat('all');
              trackInteraction('catalogue', 'mode_card', 'service', 'services');
            },
          },
          {
            id: 'digital-products',
            title: lang === 'hi' ? 'डिजिटल उत्पाद' : 'Digital Products',
            subtitle: lang === 'hi' ? 'तुरंत डाउनलोड टेम्पलेट्स' : 'Instant download toolkits',
            count: digitalCount,
            icon: FileSpreadsheet,
            active: selectedCat === 'digital-products' || productTypeFilter === 'digital_product',
            idleClass:
              'bg-gradient-to-br from-teal-50/85 via-white to-cyan-50/55 dark:from-teal-950/30 dark:via-slate-900 dark:to-slate-900 border-teal-200/80 dark:border-teal-900/50 hover:border-teal-500',
            activeClass:
              'bg-gradient-to-br from-teal-600 to-cyan-600 text-white border-teal-600 shadow-md shadow-teal-600/20',
            iconIdle: 'bg-teal-100 dark:bg-teal-950/70 text-teal-700 dark:text-teal-400',
            onSelect: () => {
              setSelectedCat('digital-products');
              setProductTypeFilter('all');
              setSelectedSubcat('all');
              trackInteraction('catalogue', 'mode_card', 'digital-products', 'services');
            },
          },
          {
            id: 'packages',
            title: lang === 'hi' ? 'किट्स और पैकेज' : 'Kits & Packages',
            subtitle: lang === 'hi' ? 'बंडल स्टार्टअप व टैक्स किट' : 'Bundled compliance savings',
            count: kitsCount,
            icon: PackageCheck,
            active: selectedCat === 'packages' || productTypeFilter === 'compliance_package',
            idleClass:
              'bg-gradient-to-br from-emerald-50/85 via-white to-teal-50/55 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 border-emerald-200/80 dark:border-emerald-900/50 hover:border-[#138808]',
            activeClass:
              'bg-gradient-to-br from-emerald-600 to-[#138808] text-white border-emerald-600 shadow-md shadow-emerald-600/20',
            iconIdle: 'bg-emerald-100 dark:bg-emerald-950/70 text-[#138808] dark:text-emerald-400',
            onSelect: () => {
              setSelectedCat('packages');
              setProductTypeFilter('all');
              setSelectedSubcat('all');
              trackInteraction('catalogue', 'mode_card', 'packages', 'services');
            },
          },
        ];

        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {modeCards.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={card.onSelect}
                  className={`app-card rounded-xl sm:rounded-2xl border p-2.5 sm:p-3.5 text-left flex flex-col justify-between gap-2 cursor-pointer transition-all ${
                    card.active ? card.activeClass : card.idleClass
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 transition ${
                        card.active ? 'bg-white/20 text-white' : card.iconIdle
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <span
                      className={`text-[10px] sm:text-xs font-mono font-bold tabular-nums px-2 py-0.5 rounded-md ${
                        card.active
                          ? 'bg-white/20 text-white'
                          : 'bg-white/90 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/75 dark:border-slate-700'
                      }`}
                    >
                      {card.count}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`text-[11px] sm:text-sm font-bold truncate ${
                        card.active ? 'text-white' : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {card.title}
                    </div>
                    <div
                      className={`text-[9.5px] sm:text-[11px] truncate ${
                        card.active ? 'text-white/85' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {card.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by service name, tag, or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#FF671F]"
          />
        </div>

        {/* Filters Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
          <select
            value={productTypeFilter}
            onChange={(e) => setProductTypeFilter(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#FF671F]"
          >
            <option value="all">All Types</option>
            <option value="instant_verification">Instant API Verifications (13)</option>
            <option value="service">Assisted Services</option>
            <option value="digital_product">Digital Downloads</option>
            <option value="compliance_package">Value Packages</option>
            <option value="api_product">B2B &amp; APIs</option>
          </select>

          <select
            value={deliveryTypeFilter}
            onChange={(e) => setDeliveryTypeFilter(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#FF671F]"
          >
            <option value="all">All Delivery Modes</option>
            <option value="online">Online Self / Guided</option>
            <option value="assisted">Assisted Desk Filing</option>
            <option value="digital_download">Instant Digital Download</option>
            <option value="hybrid">Hybrid Consultation</option>
            <option value="api">Partner / B2B API</option>
          </select>

          <select
            value={priceRange}
            onChange={(e) => setPriceRange(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#FF671F]"
          >
            <option value="all">All Prices</option>
            <option value="under-500">Under ₹500</option>
            <option value="500-1500">₹500 – ₹1,500</option>
            <option value="1500-5000">₹1,500 – ₹5,000</option>
            <option value="above-5000">Above ₹5,000</option>
            <option value="custom">Custom Quote</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#FF671F]"
          >
            <option value="popular">Most Popular First</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="name-asc">Alphabetical (A – Z)</option>
            <option value="name-desc">Alphabetical (Z – A)</option>
          </select>

          <button
            type="button"
            onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
            className="lg:hidden flex items-center gap-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>Portfolios</span>
          </button>
        </div>
      </div>

      {/* Android / Tablet Horizontal Category Selection Cards */}
      <div className="lg:hidden flex items-stretch gap-2 overflow-x-auto scrollbar-none pb-1.5 -mx-1 px-1">
        <button
          type="button"
          onClick={() => {
            setSelectedCat('all');
            setProductTypeFilter('all');
            setSelectedSubcat('all');
            trackInteraction('catalogue', 'chip_select', 'all', 'services');
          }}
          className={`app-block min-w-[118px] p-2.5 rounded-xl border text-left flex flex-col justify-between gap-1.5 shrink-0 transition cursor-pointer ${
            selectedCat === 'all' && productTypeFilter === 'all'
              ? 'bg-[#FF671F] text-white border-[#FF671F] shadow-sm'
              : 'bg-gradient-to-br from-orange-50/80 via-white to-amber-50/50 dark:from-slate-900 dark:to-slate-900 border-orange-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-100'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span
              className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                selectedCat === 'all' && productTypeFilter === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-orange-100 dark:bg-orange-950/60 text-[#FF671F]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
            </span>
            <span
              className={`text-[10px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded ${
                selectedCat === 'all' && productTypeFilter === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {activeServices.length}
            </span>
          </div>
          <span className="text-[11px] font-bold truncate">All Portfolios</span>
        </button>

        {categories.map((c) => {
          const count = activeServices.filter((s) => s.category === c.slug).length;
          const theme = getServiceCardTheme(c.slug);
          const isSelected = selectedCat === c.slug;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setSelectedCat(c.slug);
                setProductTypeFilter('all');
                setSelectedSubcat('all');
                trackInteraction('catalogue', 'chip_select', c.slug, 'services');
              }}
              className={`app-block min-w-[138px] max-w-[160px] p-2.5 rounded-xl border text-left flex flex-col justify-between gap-1.5 shrink-0 transition cursor-pointer ${
                isSelected
                  ? 'bg-[#FF671F] text-white border-[#FF671F] shadow-sm'
                  : `${theme.card} text-slate-800 dark:text-slate-100`
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span
                  className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-white/20 border-white/20 text-white' : theme.iconBox
                  }`}
                >
                  {renderIcon(c.iconName, isSelected ? 'text-white' : theme.iconColor)}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-white/85 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {count}
                </span>
              </div>
              <span className="text-[11px] font-bold truncate">
                {lang === 'hi' ? c.nameHi : c.name}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => {
            setSelectedCat('packages');
            setProductTypeFilter('all');
            setSelectedSubcat('all');
            trackInteraction('catalogue', 'chip_select', 'packages', 'services');
          }}
          className={`app-block min-w-[126px] p-2.5 rounded-xl border text-left flex flex-col justify-between gap-1.5 shrink-0 transition cursor-pointer ${
            selectedCat === 'packages'
              ? 'bg-[#138808] text-white border-[#138808] shadow-sm'
              : 'bg-gradient-to-br from-emerald-50/85 via-white to-teal-50/50 dark:from-emerald-950/30 dark:to-slate-900 border-emerald-200/80 dark:border-emerald-900/50 text-slate-800 dark:text-slate-100'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span
              className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                selectedCat === 'packages'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-100 dark:bg-emerald-950/70 text-[#138808] dark:text-emerald-400'
              }`}
            >
              <PackageCheck className="w-3.5 h-3.5" />
            </span>
            <span
              className={`text-[10px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded ${
                selectedCat === 'packages'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/85 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {packages.length}
            </span>
          </div>
          <span className="text-[11px] font-bold truncate">Kits &amp; Packages</span>
        </button>
      </div>

      {/* Subcategory Selection Cards */}
      {availableSubcategories.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          <button
            type="button"
            onClick={() => setSelectedSubcat('all')}
            className={`app-block px-3 py-2 rounded-xl border text-left text-[11px] sm:text-xs font-bold transition cursor-pointer truncate ${
              selectedSubcat === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs'
                : 'bg-white/90 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-[#FF671F]'
            }`}
          >
            All Subcategories
          </button>
          {availableSubcategories.map((sub) => (
            <button
              key={sub}
              type="button"
              onClick={() => setSelectedSubcat(sub)}
              className={`app-block px-3 py-2 rounded-xl border text-left text-[11px] sm:text-xs font-semibold transition cursor-pointer truncate ${
                selectedSubcat === sub
                  ? 'bg-[#FF671F] text-white border-[#FF671F] shadow-xs'
                  : 'bg-gradient-to-r from-slate-50/90 to-white dark:from-slate-900 dark:to-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-[#FF671F]'
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      )}

      {/* Main Layout: Portfolio Selection Cards Sidebar + Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Desktop Portfolio Selection Cards Sidebar (3 cols) */}
        <div className="hidden lg:block lg:col-span-3 bg-white/85 dark:bg-slate-900/90 backdrop-blur-xs p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-2 sticky top-24">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1.5 py-1 flex items-center justify-between">
            <span>Selection Menu</span>
            <span className="font-mono text-[10px] text-[#FF671F]">8 Portfolios</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedCat('all');
              setProductTypeFilter('all');
              setSelectedSubcat('all');
            }}
            className={`app-block w-full text-left p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between gap-2 cursor-pointer ${
              selectedCat === 'all' && productTypeFilter === 'all'
                ? 'bg-gradient-to-r from-[#FF671F] to-orange-500 text-white border-[#FF671F] shadow-sm'
                : 'bg-gradient-to-r from-orange-50/75 via-white to-amber-50/45 dark:from-slate-800/80 dark:to-slate-900 border-orange-200/75 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-[#FF671F]'
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span
                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                  selectedCat === 'all' && productTypeFilter === 'all'
                    ? 'bg-white/20 text-white'
                    : 'bg-orange-100 dark:bg-orange-950/70 text-[#FF671F]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
              </span>
              <span className="truncate">All Catalogue Items</span>
            </span>
            <span
              className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded ${
                selectedCat === 'all' && productTypeFilter === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700'
              }`}
            >
              {activeServices.length}
            </span>
          </button>

          {categories.map((c) => {
            const count = activeServices.filter((s) => s.category === c.slug).length;
            const theme = getServiceCardTheme(c.slug);
            const isSelected = selectedCat === c.slug;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelectedCat(c.slug);
                  setProductTypeFilter('all');
                  setSelectedSubcat('all');
                }}
                className={`app-block w-full text-left p-2.5 rounded-xl border text-xs font-semibold transition flex items-center justify-between gap-2 cursor-pointer group ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#FF671F] to-orange-500 text-white border-[#FF671F] shadow-sm'
                    : `${theme.card} text-slate-800 dark:text-slate-100`
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition ${
                      isSelected ? 'bg-white/20 border-white/20 text-white' : theme.iconBox
                    }`}
                  >
                    {renderIcon(c.iconName, isSelected ? 'text-white' : theme.iconColor)}
                  </span>
                  <span className="truncate">{lang === 'hi' ? c.nameHi : c.name}</span>
                </span>
                <span
                  className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded shrink-0 ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-white/90 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          <div className="pt-2 mt-1 border-t border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setSelectedCat('packages');
                setProductTypeFilter('all');
                setSelectedSubcat('all');
              }}
              className={`app-block w-full text-left p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between gap-2 cursor-pointer ${
                selectedCat === 'packages'
                  ? 'bg-gradient-to-r from-emerald-600 to-[#138808] text-white border-[#138808] shadow-sm'
                  : 'bg-gradient-to-r from-emerald-50/85 via-white to-teal-50/55 dark:from-emerald-950/30 dark:to-slate-900 border-emerald-200/80 dark:border-emerald-900/50 text-[#138808] dark:text-emerald-400 hover:border-[#138808]'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                    selectedCat === 'packages'
                      ? 'bg-white/20 text-white'
                      : 'bg-emerald-100 dark:bg-emerald-950/70 text-[#138808] dark:text-emerald-400'
                  }`}
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                </span>
                <span className="truncate">Kits &amp; Value Packages</span>
              </span>
              <span
                className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded shrink-0 ${
                  selectedCat === 'packages'
                    ? 'bg-white/20 text-white'
                    : 'bg-white/90 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-900/50'
                }`}
              >
                {packages.length}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Category Selection Cards Drawer */}
        {mobileFilterOpen && (
          <div className="lg:hidden p-3.5 bg-white/95 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-white">
              <span>Select Portfolio Card</span>
              <button type="button" onClick={() => setMobileFilterOpen(false)} className="text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedCat('all');
                  setProductTypeFilter('all');
                  setSelectedSubcat('all');
                  setMobileFilterOpen(false);
                }}
                className={`p-2.5 rounded-xl border text-left text-xs font-bold flex items-center justify-between gap-1.5 cursor-pointer ${
                  selectedCat === 'all' && productTypeFilter === 'all'
                    ? 'bg-[#FF671F] text-white border-[#FF671F]'
                    : 'bg-orange-50/75 dark:bg-slate-800 border-orange-200/75 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                }`}
              >
                <span className="truncate">All Items</span>
                <span className="text-[10px] font-mono">{activeServices.length}</span>
              </button>
              {categories.map((c) => {
                const count = activeServices.filter((s) => s.category === c.slug).length;
                const theme = getServiceCardTheme(c.slug);
                const isSelected = selectedCat === c.slug;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCat(c.slug);
                      setProductTypeFilter('all');
                      setSelectedSubcat('all');
                      setMobileFilterOpen(false);
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-[#FF671F] text-white border-[#FF671F]'
                        : `${theme.card} text-slate-800 dark:text-slate-100`
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="text-[10px] font-mono shrink-0">{count}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setSelectedCat('packages');
                  setProductTypeFilter('all');
                  setSelectedSubcat('all');
                  setMobileFilterOpen(false);
                }}
                className={`col-span-2 p-2.5 rounded-xl border text-left text-xs font-bold flex items-center justify-between gap-1.5 cursor-pointer ${
                  selectedCat === 'packages'
                    ? 'bg-[#138808] text-white border-[#138808]'
                    : 'bg-emerald-50/85 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-900/50 text-[#138808] dark:text-emerald-400'
                }`}
              >
                <span>Kits &amp; Value Packages</span>
                <span className="text-[10px] font-mono">{packages.length}</span>
              </button>
            </div>
          </div>
        )}

        {/* Services Grid (9 cols) */}
        <div className="lg:col-span-9 space-y-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Showing{' '}
              <strong className="text-slate-800 dark:text-white">
                {paginatedServices.length}
              </strong>{' '}
              of <strong className="text-slate-800 dark:text-white">{filteredServices.length}</strong>{' '}
              matching items (Page {currentPage} of {totalPages})
            </span>
            {(selectedCat !== 'all' ||
              selectedSubcat !== 'all' ||
              productTypeFilter !== 'all' ||
              deliveryTypeFilter !== 'all' ||
              priceRange !== 'all' ||
              search.trim() !== '') && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-[#FF671F] hover:underline font-semibold cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>

          {services.length === 0 ? (
            <ServiceGridSkeleton count={6} />
          ) : paginatedServices.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
              <p className="text-sm font-bold text-slate-800 dark:text-white">No matching services found</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Try modifying your search or clearing active filters.
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="mt-3 bg-[#FF671F] text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
              >
                View All Services
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 lg:gap-5 tabular-nums">
              {paginatedServices.map((service) => {
                const isDigital = service.productType === 'digital_product';
                const isPkg = service.productType === 'compliance_package' || service.category === 'packages';
                const isInstantApi =
                  service.integrationType === 'api_setu' && service.billingUnit === 'verification';
                const isQuote = Boolean(service.isCustomQuote || service.pricingType === 'custom');
                const theme = getServiceCardTheme(service.category, service.productType);

                return (
                  <div
                    key={service.id}
                    className={`app-card rounded-xl sm:rounded-2xl border shadow-2xs hover:shadow-md flex flex-col justify-between overflow-hidden group ${theme.card}`}
                  >
                    <div className="p-2.5 sm:p-4 lg:p-5 space-y-1.5 sm:space-y-2.5">
                      <div className="flex items-center justify-between gap-1">
                        <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl border flex items-center justify-center shrink-0 transition ${theme.iconBox}`}>
                          {renderIcon(service.iconName, theme.iconColor)}
                        </div>
                        <AppCardStatusBadge service={service} lang={lang} />
                      </div>

                      <div>
                        <div className={`text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider truncate ${theme.categoryLabel}`}>
                          {service.subcategory || service.category.replace(/-/g, ' ')}
                        </div>
                        <h3 className="text-[11px] sm:text-sm lg:text-base font-bold text-slate-900 dark:text-white group-hover:text-[#FF671F] transition line-clamp-1 leading-tight">
                          <button
                            type="button"
                            onClick={() => {
                              trackInteraction('catalogue', 'inspect_service', service.slug, 'services');
                              onNavigate('service-detail', service.slug);
                            }}
                            className="text-left w-full truncate cursor-pointer"
                          >
                            {service.name}
                          </button>
                        </h3>
                        {service.nameHi && (
                          <div className="text-[9.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{service.nameHi}</div>
                        )}
                      </div>

                      <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-snug sm:leading-relaxed">
                        {lang === 'hi' && service.shortDescHi ? service.shortDescHi : service.shortDesc}
                      </p>

                      <div className={`pt-1.5 sm:pt-2 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 sm:gap-1 text-xs ${theme.divider}`}>
                        <div>
                          <span className="text-[8.5px] sm:text-[10px] text-slate-500 dark:text-slate-400 block">
                            {isQuote ? 'Pricing Model' : isDigital ? 'Digital Pack' : isInstantApi ? 'Instant Check' : 'Fee'}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white text-[11px] sm:text-sm font-mono">
                            {formatServicePriceLabel(service)}
                          </span>
                          {service.govtFees > 0 && (
                            <span className="hidden sm:inline text-[10px] text-slate-500 dark:text-slate-400 ml-1">(+₹{service.govtFees})</span>
                          )}
                        </div>

                        <div className="sm:text-right">
                          <span className="hidden sm:block text-[10px] text-slate-500 dark:text-slate-400">Timeline</span>
                          <span className="text-[9.5px] sm:text-[11px] font-semibold text-[#138808] dark:text-emerald-400 line-clamp-1">
                            {service.estimatedTime}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={`border-t px-2.5 sm:px-4 lg:px-5 py-1.5 sm:py-2.5 flex items-center justify-between gap-1 ${theme.footer}`}>
                      <button
                        type="button"
                        onClick={() => {
                          trackInteraction('catalogue', 'view_details', service.slug, 'services');
                          onNavigate('service-detail', service.slug);
                        }}
                        className="text-[10px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-[#FF671F] dark:hover:text-orange-400 hover:underline underline-offset-2 cursor-pointer truncate"
                      >
                        <span className="hidden sm:inline">{t('common.viewDetails')}</span>
                        <span className="sm:hidden">Details</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          trackInteraction('catalogue', 'apply_click', service.slug, 'services');
                          if (isQuote || isPkg || isDigital || isInstantApi) {
                            onNavigate('service-detail', service.slug);
                          } else {
                            onApplyForService(service);
                          }
                        }}
                        className={`text-white text-[10px] sm:text-xs font-bold px-2 py-1 sm:px-3 sm:py-1.5 rounded-md sm:rounded-lg shadow-2xs hover:shadow-xs transition flex items-center gap-0.5 sm:gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                          isPkg || isInstantApi
                            ? 'bg-[#138808] hover:bg-emerald-700'
                            : 'bg-[#FF671F] hover:bg-[#E55B1B]'
                        }`}
                      >
                        {isDigital && <Download className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                        <span>
                          {isDigital
                            ? 'Buy'
                            : isInstantApi
                            ? 'Verify'
                            : isPkg
                            ? 'Bundle'
                            : isQuote
                            ? 'Quote'
                            : t('common.applyNow')}
                        </span>
                        {!isDigital && <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] sm:text-xs font-semibold disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setPage(pageNum)}
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-[11px] sm:text-xs font-bold font-mono cursor-pointer transition ${
                      pageNum === currentPage
                        ? 'bg-[#FF671F] text-white'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-[#FF671F]'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] sm:text-xs font-semibold disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
