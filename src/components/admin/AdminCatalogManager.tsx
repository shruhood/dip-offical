import React, { useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import {
  CheckCircle2,
  Database,
  DollarSign,
  Edit,
  Eye,
  EyeOff,
  LayoutGrid,
  List,
  PlusCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from '../../services/firebase';
import {
  calculateOrderTotalsPaise,
  formatServicePriceLabel,
  fromPaise,
} from '../../lib/finance';
import { mapCatalogServiceToFirestoreRecord } from '../../lib/catalogueSync';
import { uploadFileToR2 } from '../../services/backendApi';
import type {
  AvailabilityStatus,
  BillingUnit,
  DigitalAssetMeta,
  DynamicFieldType,
  IntegrationType,
  PricingType,
  RequiredDocument,
  Service,
  ServiceDeliveryType,
  ServiceFormField,
} from '../../types';
import {
  AdminCategoriesPanel,
  AdminCouponsPanel,
  AdminDigitalOrdersPanel,
  AdminImportExportPanel,
  AdminQuoteRequestsPanel,
} from './CatalogCmsPanels';

function slugifyServiceName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const ALL_FIELD_TYPES: { value: DynamicFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone / Mobile' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown Select' },
  { value: 'multiselect', label: 'Multi-Select' },
  { value: 'radio', label: 'Radio Options' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'textarea', label: 'Long Textarea' },
  { value: 'file', label: 'Document Upload' },
];

type CatalogSubTab =
  | 'items'
  | 'coupons'
  | 'categories'
  | 'digital_orders'
  | 'quotes'
  | 'import_export';

export const AdminCatalogManager: React.FC = () => {
  const { user } = useAuth();
  const {
    services,
    categories,
    coupons,
    digitalOrders,
    quoteRequests,
    importReports,
    businessSettings,
    createOrUpdateService,
    toggleServicePublished,
    deleteService,
    saveCoupon,
    deleteCoupon,
    saveCategory,
    updateQuoteRequestStatus,
    importCatalogue,
    syncCatalogueServicesToDatabase,
  } = useData();

  const [catalogSubTab, setCatalogSubTab] = useState<CatalogSubTab>('items');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState('all');
  const [catalogTypeFilter, setCatalogTypeFilter] = useState('all');
  const [catalogStatusFilter, setCatalogStatusFilter] = useState<'all' | 'published' | 'unpublished'>('all');
  const [catalogPage, setCatalogPage] = useState(1);

  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [syncingFirestore, setSyncingFirestore] = useState(false);
  const [firestoreCount, setFirestoreCount] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Quick Pricing Modal State
  const [pricingTarget, setPricingTarget] = useState<Service | null>(null);
  const [priceServiceCharge, setPriceServiceCharge] = useState(0);
  const [priceGovtFees, setPriceGovtFees] = useState(0);
  const [priceThirdPartyFees, setPriceThirdPartyFees] = useState(0);
  const [priceUrgentFee, setPriceUrgentFee] = useState(0);
  const [priceDiscountInr, setPriceDiscountInr] = useState(0);
  const [priceTaxRateBps, setPriceTaxRateBps] = useState(1800);
  const [pricePartnerInr, setPricePartnerInr] = useState<string>('');
  const [pricePricingType, setPricePricingType] = useState<PricingType>('fixed');
  const [priceBillingUnit, setPriceBillingUnit] = useState<BillingUnit>('one_time');
  const [priceGovtNote, setPriceGovtNote] = useState('');
  const [priceCustomQuote, setPriceCustomQuote] = useState(false);
  const [savingQuickPrice, setSavingQuickPrice] = useState(false);

  // Full Create / Edit Service & Product Modal State
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [srvName, setSrvName] = useState('');
  const [srvNameHi, setSrvNameHi] = useState('');
  const [srvSlug, setSrvSlug] = useState('');
  const [srvCategory, setSrvCategory] = useState(categories[0]?.slug || 'personal');
  const [srvSubcategory, setSrvSubcategory] = useState('');
  const [srvProductType, setSrvProductType] = useState<
    'service' | 'digital_product' | 'api_product' | 'compliance_package'
  >('service');
  const [srvIntegrationType, setSrvIntegrationType] = useState<IntegrationType>('manual_assistance');
  const [srvAvailability, setSrvAvailability] = useState<AvailabilityStatus>('Live');
  const [srvCharge, setSrvCharge] = useState(499);
  const [srvGovtFee, setSrvGovtFee] = useState(0);
  const [srvThirdPartyFee, setSrvThirdPartyFee] = useState(0);
  const [srvUrgentFee, setSrvUrgentFee] = useState(0);
  const [srvDiscountInr, setSrvDiscountInr] = useState(0);
  const [srvPricingType, setSrvPricingType] = useState<PricingType>('fixed');
  const [srvBillingUnit, setSrvBillingUnit] = useState<BillingUnit>('one_time');
  const [srvDeliveryType, setSrvDeliveryType] = useState<ServiceDeliveryType>('online');
  const [srvTaxRateBps, setSrvTaxRateBps] = useState(1800);
  const [srvSlaHours, setSrvSlaHours] = useState(72);
  const [srvEstTime, setSrvEstTime] = useState('3 - 5 Working Days');
  const [srvShortDesc, setSrvShortDesc] = useState('');
  const [srvFullDesc, setSrvFullDesc] = useState('');
  const [srvB2bSupported, setSrvB2bSupported] = useState(true);
  const [srvPopular, setSrvPopular] = useState(false);
  const [srvPublished, setSrvPublished] = useState(true);
  const [srvIsCustomQuote, setSrvIsCustomQuote] = useState(false);
  const [srvGovtFeeNote, setSrvGovtFeeNote] = useState('');
  const [srvIncludedIdsText, setSrvIncludedIdsText] = useState('');
  const [srvExclusionsText, setSrvExclusionsText] = useState('');
  const [srvPackageSavings, setSrvPackageSavings] = useState(0);
  const [srvRegulatedNotice, setSrvRegulatedNotice] = useState('');
  const [srvSeoTitle, setSrvSeoTitle] = useState('');
  const [srvSeoDescription, setSrvSeoDescription] = useState('');
  const [srvAssetFormat, setSrvAssetFormat] = useState('PDF / XLSX');
  const [srvAssetSize, setSrvAssetSize] = useState('350 KB');
  const [srvAssetVersion, setSrvAssetVersion] = useState('v1.0');
  const [srvAssetPreview, setSrvAssetPreview] = useState('');
  const [srvAssetR2FileId, setSrvAssetR2FileId] = useState('');
  const [srvAssetR2Key, setSrvAssetR2Key] = useState('');
  const [srvAssetGeneratorKey, setSrvAssetGeneratorKey] = useState('');
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [srvEligibilityText, setSrvEligibilityText] = useState(
    'Indian Resident / Valid Business Entity\nValid PAN and Aadhaar Proof'
  );
  const [srvRequiredDocs, setSrvRequiredDocs] = useState<RequiredDocument[]>([]);
  const [srvFormFields, setSrvFormFields] = useState<ServiceFormField[]>([]);
  const [srvFaqs, setSrvFaqs] = useState<{ question: string; answer: string }[]>([]);
  const [newFaqQuestion, setNewFaqQuestion] = useState('');
  const [newFaqAnswer, setNewFaqAnswer] = useState('');
  const [newDocName, setNewDocName] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<ServiceFormField['type']>('text');
  const [savingServiceModal, setSavingServiceModal] = useState(false);

  const showNotice = (msg: string) => {
    setErrorMsg(null);
    setNotice(msg);
    setTimeout(() => setNotice(null), 4500);
  };

  const filteredCatalog = useMemo(() => {
    return services.filter((s) => {
      const matchCat =
        catalogCategoryFilter === 'all'
          ? true
          : catalogCategoryFilter === 'packages'
          ? s.productType === 'compliance_package'
          : s.category === catalogCategoryFilter;
      const matchType =
        catalogTypeFilter === 'all' ? true : (s.productType || 'service') === catalogTypeFilter;
      const matchStatus =
        catalogStatusFilter === 'all'
          ? true
          : catalogStatusFilter === 'published'
          ? s.published !== false
          : s.published === false;
      const q = catalogSearch.trim().toLowerCase();
      if (!q) return matchCat && matchType && matchStatus;
      return (
        matchCat &&
        matchType &&
        matchStatus &&
        (s.name.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q) ||
          (s.subcategory || '').toLowerCase().includes(q) ||
          s.shortDesc.toLowerCase().includes(q))
      );
    });
  }, [services, catalogCategoryFilter, catalogTypeFilter, catalogStatusFilter, catalogSearch]);

  const CATALOG_PAGE_SIZE = viewMode === 'table' ? 25 : 18;
  const catalogTotalPages = Math.max(1, Math.ceil(filteredCatalog.length / CATALOG_PAGE_SIZE));
  const safeCatalogPage = Math.min(catalogPage, catalogTotalPages);
  const visibleCatalog = filteredCatalog.slice(
    (safeCatalogPage - 1) * CATALOG_PAGE_SIZE,
    safeCatalogPage * CATALOG_PAGE_SIZE
  );

  const publishedCount = useMemo(
    () => services.filter((s) => s.published !== false).length,
    [services]
  );

  const quickPricePreview = useMemo(() => {
    return calculateOrderTotalsPaise({
      serviceChargeInr: Number(priceServiceCharge) || 0,
      govtFeesInr: Number(priceGovtFees) || 0,
      thirdPartyFeesInr: Number(priceThirdPartyFees) || 0,
      urgentFeeInr: Number(priceUrgentFee) || 0,
      discountInr: Number(priceDiscountInr) || 0,
      taxRateBps: Number(priceTaxRateBps) || 0,
    });
  }, [
    priceServiceCharge,
    priceGovtFees,
    priceThirdPartyFees,
    priceUrgentFee,
    priceDiscountInr,
    priceTaxRateBps,
  ]);

  const handleVerifyFirestoreCollection = async () => {
    setSyncingFirestore(true);
    setErrorMsg(null);
    try {
      const snap = await getDocs(collection(db, 'services'));
      setFirestoreCount(snap.size);
      showNotice(`Verified ${snap.size} live document(s) in Firestore "services" collection.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to query Firestore services collection.');
    } finally {
      setSyncingFirestore(false);
    }
  };

  const handleSyncCatalogToFirestore = async () => {
    setSyncingFirestore(true);
    setErrorMsg(null);
    try {
      const res = await syncCatalogueServicesToDatabase();
      const syncedTotal = res.createdCount + res.updatedCount;
      setFirestoreCount(res.totalProcessed || services.length);
      showNotice(
        `Synced ${res.totalProcessed} catalog services (${res.createdCount} created, ${res.updatedCount} updated, ${res.skippedCount} unchanged).`
      );
      void syncedTotal;
    } catch (err: any) {
      setErrorMsg(err?.message || 'Catalog synchronization failed.');
    } finally {
      setSyncingFirestore(false);
    }
  };

  const handleTogglePublish = async (s: Service) => {
    setBusyId(s.id);
    setErrorMsg(null);
    try {
      const nextPublished = s.published === false;
      const updated: Service = {
        ...s,
        published: nextPublished,
        availability: nextPublished ? 'Live' : 'Unavailable',
        updatedAt: new Date().toISOString(),
      };
      await toggleServicePublished(s.id);
      if (auth.currentUser) {
        try {
          const cleanPayload = mapCatalogServiceToFirestoreRecord(updated, {
            existing: s,
            nowIso: new Date().toISOString(),
            preserveExistingCustomizations: false,
            forceRefreshSeo: false,
          });
          await setDoc(doc(db, 'services', cleanPayload.id), cleanPayload);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `services/${s.id}`);
        }
      }
      showNotice(
        `${nextPublished ? 'Published' : 'Unpublished'} "${s.name}" in live Firestore catalog.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update publication status.');
    } finally {
      setBusyId(null);
    }
  };

  const handleOpenQuickPrice = (s: Service) => {
    setPricingTarget(s);
    setPriceServiceCharge(Number(s.serviceCharge || 0));
    setPriceGovtFees(Number(s.govtFees || 0));
    setPriceThirdPartyFees(Number(s.thirdPartyFees || 0));
    setPriceUrgentFee(Number(s.urgentFee || 0));
    setPriceDiscountInr(Number(s.discountInr || 0));
    setPriceTaxRateBps(s.taxRateBps ?? businessSettings.defaultTaxRateBps ?? 1800);
    setPricePartnerInr(s.partnerPriceInr !== undefined ? String(s.partnerPriceInr) : '');
    setPricePricingType(s.pricingType || (s.isCustomQuote ? 'custom' : 'fixed'));
    setPriceBillingUnit(s.billingUnit || 'one_time');
    setPriceGovtNote(s.govtFeeNote || '');
    setPriceCustomQuote(Boolean(s.isCustomQuote));
  };

  const handleSaveQuickPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pricingTarget) return;
    setSavingQuickPrice(true);
    setErrorMsg(null);
    try {
      const updated: Service = {
        ...pricingTarget,
        serviceCharge: Math.max(0, Number(priceServiceCharge) || 0),
        govtFees: Math.max(0, Number(priceGovtFees) || 0),
        thirdPartyFees: Math.max(0, Number(priceThirdPartyFees) || 0),
        urgentFee: Math.max(0, Number(priceUrgentFee) || 0),
        discountInr: Math.max(0, Number(priceDiscountInr) || 0),
        taxRateBps: Math.max(0, Number(priceTaxRateBps) || 0),
        partnerPriceInr:
          pricePartnerInr.trim() !== '' ? Math.max(0, Number(pricePartnerInr) || 0) : undefined,
        pricingType: pricePricingType,
        billingUnit: priceBillingUnit,
        govtFeeNote: priceGovtNote.trim() || undefined,
        isCustomQuote: priceCustomQuote || pricePricingType === 'custom',
        updatedAt: new Date().toISOString(),
      };
      await createOrUpdateService(updated);
      setPricingTarget(null);
      showNotice(`Saved updated INR pricing & GST breakdown for "${updated.name}".`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to save updated pricing.');
    } finally {
      setSavingQuickPrice(false);
    }
  };

  const handleConfirmDelete = async (s: Service) => {
    setBusyId(s.id);
    setErrorMsg(null);
    try {
      await deleteService(s.id);
      if (auth.currentUser) {
        try {
          await deleteDoc(doc(db, 'services', s.id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `services/${s.id}`);
        }
      }
      setPendingDeleteId(null);
      showNotice(`Deleted "${s.name}" from Firestore catalog.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete catalog item.');
    } finally {
      setBusyId(null);
    }
  };

  const handleOpenNewServiceModal = () => {
    setEditingServiceId(null);
    setSrvName('');
    setSrvNameHi('');
    setSrvSlug('');
    setSrvCategory(categories[0]?.slug || 'personal');
    setSrvSubcategory('');
    setSrvProductType('service');
    setSrvIntegrationType('manual_assistance');
    setSrvAvailability('Live');
    setSrvCharge(499);
    setSrvGovtFee(0);
    setSrvThirdPartyFee(0);
    setSrvUrgentFee(0);
    setSrvDiscountInr(0);
    setSrvPricingType('fixed');
    setSrvBillingUnit('one_time');
    setSrvDeliveryType('online');
    setSrvTaxRateBps(businessSettings.defaultTaxRateBps ?? 1800);
    setSrvSlaHours(72);
    setSrvEstTime('3 - 5 Working Days');
    setSrvShortDesc('');
    setSrvFullDesc('');
    setSrvB2bSupported(true);
    setSrvPopular(false);
    setSrvPublished(true);
    setSrvIsCustomQuote(false);
    setSrvGovtFeeNote('');
    setSrvIncludedIdsText('');
    setSrvExclusionsText('');
    setSrvPackageSavings(0);
    setSrvRegulatedNotice('');
    setSrvSeoTitle('');
    setSrvSeoDescription('');
    setSrvAssetFormat('PDF / XLSX');
    setSrvAssetSize('350 KB');
    setSrvAssetVersion('v1.0');
    setSrvAssetPreview('');
    setSrvAssetR2FileId('');
    setSrvAssetR2Key('');
    setSrvAssetGeneratorKey('');
    setSrvEligibilityText('Indian Citizen or Registered Business\nValid Mobile & Email Verification');
    setSrvRequiredDocs([
      {
        id: `doc-req-${Date.now()}`,
        name: 'Identity Proof (PAN / Aadhaar Masked)',
        description: 'Clear scanned PDF or JPG copy',
        mandatory: true,
        allowedFormats: ['pdf', 'jpg', 'png'],
        maxSizeMB: 5,
      },
    ]);
    setSrvFormFields([
      {
        id: 'full_name',
        label: 'Full Applicant Name',
        type: 'text',
        required: true,
        placeholder: 'As printed on official ID',
      },
      {
        id: 'contact_mobile',
        label: 'Mobile Number',
        type: 'tel',
        required: true,
        placeholder: '+91 98765 43210',
      },
    ]);
    setSrvFaqs([
      {
        question: 'Is Digital India Project a government portal?',
        answer:
          'No. Digital India Project is a private online services and documentation consultancy firm serving clients across India.',
      },
    ]);
    setNewFaqQuestion('');
    setNewFaqAnswer('');
    setServiceModalOpen(true);
  };

  const handleOpenEditServiceModal = (s: Service) => {
    setEditingServiceId(s.id);
    setSrvName(s.name);
    setSrvNameHi(s.nameHi || '');
    setSrvSlug(s.slug);
    setSrvCategory(s.category);
    setSrvSubcategory(s.subcategory || '');
    setSrvProductType(s.productType || 'service');
    setSrvIntegrationType(s.integrationType || 'manual_assistance');
    setSrvAvailability(s.availability || 'Live');
    setSrvCharge(s.serviceCharge);
    setSrvGovtFee(s.govtFees);
    setSrvThirdPartyFee(s.thirdPartyFees || 0);
    setSrvUrgentFee(s.urgentFee || 0);
    setSrvDiscountInr(s.discountInr || 0);
    setSrvPricingType(s.pricingType || (s.isCustomQuote ? 'custom' : 'fixed'));
    setSrvBillingUnit(s.billingUnit || 'one_time');
    setSrvDeliveryType(
      s.deliveryType || (s.productType === 'digital_product' ? 'digital_download' : 'online')
    );
    setSrvTaxRateBps(s.taxRateBps ?? businessSettings.defaultTaxRateBps ?? 1800);
    setSrvSlaHours(s.slaHours ?? 72);
    setSrvEstTime(s.estimatedTime);
    setSrvShortDesc(s.shortDesc);
    setSrvFullDesc(s.fullDesc || s.shortDesc);
    setSrvB2bSupported(Boolean(s.b2bSupported));
    setSrvPopular(Boolean(s.popular));
    setSrvPublished(s.published !== false);
    setSrvIsCustomQuote(Boolean(s.isCustomQuote));
    setSrvGovtFeeNote(s.govtFeeNote || '');
    setSrvIncludedIdsText((s.includedServiceIds || []).join(', '));
    setSrvExclusionsText((s.exclusions || []).join('\n'));
    setSrvPackageSavings(s.packageSavingsInr || 0);
    setSrvRegulatedNotice(s.regulatedNotice || '');
    setSrvSeoTitle(s.seoTitle || '');
    setSrvSeoDescription(s.seoDescription || '');
    setSrvAssetFormat(s.digitalAsset?.fileFormat || 'PDF / XLSX');
    setSrvAssetSize(s.digitalAsset?.fileSizeLabel || '350 KB');
    setSrvAssetVersion(s.digitalAsset?.version || 'v1.0');
    setSrvAssetPreview(s.digitalAsset?.previewSummary || '');
    setSrvAssetR2FileId(s.digitalAsset?.r2FileId || '');
    setSrvAssetR2Key(s.digitalAsset?.r2ObjectKey || '');
    setSrvAssetGeneratorKey(s.digitalAsset?.generatorKey || '');
    setSrvEligibilityText((s.eligibility || []).join('\n'));
    setSrvRequiredDocs(s.requiredDocs || []);
    setSrvFormFields(s.formFields || []);
    setSrvFaqs(s.faqs || []);
    setNewFaqQuestion('');
    setNewFaqAnswer('');
    setServiceModalOpen(true);
  };

  const handleUploadDigitalAssetFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAsset(true);
    try {
      const kb = Math.max(1, Math.round(file.size / 1024));
      setSrvAssetSize(kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);
      const ext = file.name.split('.').pop()?.toUpperCase();
      if (ext) setSrvAssetFormat(ext);

      const res = await uploadFileToR2({
        file,
        bucket: 'generated_files',
        documentCategory: 'digital_product_asset',
      });
      if (res.ok && res.data) {
        const fid = String(res.data.fileId || res.data.id || '');
        const key = String(res.data.r2ObjectKey || res.data.objectKey || `generated_files/${file.name}`);
        setSrvAssetR2FileId(fid);
        setSrvAssetR2Key(key);
        showNotice(`Uploaded digital asset "${file.name}" to R2 storage.`);
      } else {
        setSrvAssetR2Key(`generated_files/${slugifyServiceName(srvSlug || file.name)}-${file.name}`);
        showNotice(`Recorded digital asset metadata for "${file.name}".`);
      }
    } finally {
      setUploadingAsset(false);
    }
  };

  const handleSaveServiceModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvName.trim()) return;
    setSavingServiceModal(true);
    setErrorMsg(null);
    try {
      const existing = editingServiceId
        ? services.find((s) => s.id === editingServiceId)
        : undefined;
      const finalId = editingServiceId || `srv-${Date.now()}`;
      const finalSlug = srvSlug.trim() || slugifyServiceName(srvName);
      const parsedIncludedIds = srvIncludedIdsText
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      const parsedExclusions = srvExclusionsText
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean);

      const digitalAsset: DigitalAssetMeta | undefined =
        srvProductType === 'digital_product' || srvAssetR2Key || srvAssetGeneratorKey
          ? {
              fileFormat: srvAssetFormat.trim() || 'PDF / XLSX',
              fileSizeLabel: srvAssetSize.trim() || '350 KB',
              version: srvAssetVersion.trim() || 'v1.0',
              previewSummary: srvAssetPreview.trim() || srvShortDesc.trim(),
              r2FileId: srvAssetR2FileId.trim() || existing?.digitalAsset?.r2FileId,
              r2ObjectKey: srvAssetR2Key.trim() || existing?.digitalAsset?.r2ObjectKey,
              generatorKey: srvAssetGeneratorKey.trim() || existing?.digitalAsset?.generatorKey || finalSlug,
              includedFiles: existing?.digitalAsset?.includedFiles,
              usageInstructions: existing?.digitalAsset?.usageInstructions,
              downloadPolicy: existing?.digitalAsset?.downloadPolicy,
            }
          : existing?.digitalAsset;

      const payload: Service = {
        ...existing,
        id: finalId,
        slug: finalSlug,
        name: srvName.trim(),
        nameHi: srvNameHi.trim() || srvName.trim(),
        category: srvCategory,
        subcategory: srvSubcategory.trim() || existing?.subcategory,
        productType: srvProductType,
        shortDesc: srvShortDesc.trim(),
        shortDescHi: existing?.shortDescHi || srvShortDesc.trim(),
        fullDesc: srvFullDesc.trim() || srvShortDesc.trim(),
        iconName:
          srvProductType === 'api_product'
            ? 'ShieldCheck'
            : srvProductType === 'digital_product'
            ? 'FileSpreadsheet'
            : srvProductType === 'compliance_package'
            ? 'PackageCheck'
            : srvCategory === 'tax-compliance'
            ? 'Landmark'
            : srvCategory === 'business-registration'
            ? 'Building2'
            : 'FileText',
        serviceCharge: Math.max(0, Number(srvCharge) || 0),
        govtFees: Math.max(0, Number(srvGovtFee) || 0),
        thirdPartyFees: Math.max(0, Number(srvThirdPartyFee) || 0),
        urgentFee: Math.max(0, Number(srvUrgentFee) || 0),
        discountInr: Math.max(0, Number(srvDiscountInr) || 0),
        pricingType: srvPricingType,
        billingUnit: srvBillingUnit,
        deliveryType: srvDeliveryType,
        taxRateBps: Math.max(0, Number(srvTaxRateBps) || 0),
        govtFeeNote: srvGovtFeeNote.trim() || existing?.govtFeeNote,
        slaHours: Number(srvSlaHours) || 72,
        formVersion: (existing?.formVersion || 1) + (existing ? 1 : 0),
        published: srvPublished,
        estimatedTime: srvEstTime.trim() || '3 - 5 Working Days',
        popular: srvPopular,
        featured: existing?.featured ?? srvPopular,
        isCustomQuote: srvIsCustomQuote || srvPricingType === 'custom',
        includedServiceIds: parsedIncludedIds.length > 0 ? parsedIncludedIds : undefined,
        exclusions: parsedExclusions.length > 0 ? parsedExclusions : undefined,
        packageSavingsInr: Number(srvPackageSavings) > 0 ? Number(srvPackageSavings) : undefined,
        regulatedNotice: srvRegulatedNotice.trim() || undefined,
        seoTitle: srvSeoTitle.trim() || existing?.seoTitle,
        seoDescription: srvSeoDescription.trim() || existing?.seoDescription,
        digitalAsset,
        integrationType: srvIntegrationType,
        availability: srvPublished ? srvAvailability : 'Unavailable',
        b2bSupported: srvB2bSupported,
        eligibility: srvEligibilityText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        requiredDocs: srvRequiredDocs,
        processSteps:
          existing?.processSteps || [
            { title: 'Submit Details & Docs', desc: 'Complete online intake and attach required proofs.' },
            { title: 'Verification & Review', desc: 'Compliance desk checks spellings and eligibility.' },
            { title: 'Filing & Issuance', desc: 'Dossier submitted and tracking updated to completion.' },
          ],
        faqs: srvFaqs
          .filter((f) => f.question.trim() && f.answer.trim())
          .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() })),
        formFields: srvFormFields,
        updatedAt: new Date().toISOString(),
      };

      await createOrUpdateService(payload);
      setServiceModalOpen(false);
      showNotice(
        editingServiceId
          ? `Updated "${payload.name}" (v${payload.formVersion}) in Firestore catalog.`
          : `Added "${payload.name}" to live Firestore catalog.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to save service record.');
    } finally {
      setSavingServiceModal(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Service, Digital Product &amp; Package Catalogue Manager
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {services.length} total items · {publishedCount} published · {services.length - publishedCount} unpublished
            {firestoreCount !== null ? ` · ${firestoreCount} docs in Firestore` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={syncingFirestore}
            onClick={handleVerifyFirestoreCollection}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#FF671F] font-semibold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Database className="w-3.5 h-3.5 text-[#138808]" />
            <span>{syncingFirestore ? 'Checking...' : 'Verify Firestore'}</span>
          </button>

          <button
            type="button"
            disabled={syncingFirestore}
            onClick={handleSyncCatalogToFirestore}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#FF671F] font-semibold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#FF671F] ${syncingFirestore ? 'animate-spin' : ''}`} />
            <span>Sync Catalog</span>
          </button>

          <button
            type="button"
            onClick={handleOpenNewServiceModal}
            className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Service / Product</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { id: 'items', label: `Catalog Items (${services.length})` },
          { id: 'coupons', label: `Promo Coupons (${coupons.length})` },
          { id: 'categories', label: `Categories (${categories.length})` },
          { id: 'digital_orders', label: `Digital Orders (${digitalOrders.length})` },
          { id: 'quotes', label: `Quote Inquiries (${quoteRequests.length})` },
          { id: 'import_export', label: 'Import & Export' },
        ].map((sub) => (
          <button
            key={sub.id}
            type="button"
            onClick={() => setCatalogSubTab(sub.id as CatalogSubTab)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              catalogSubTab === sub.id
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {sub.label}
          </button>
        ))}
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#138808] shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs font-semibold text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="underline font-bold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {catalogSubTab === 'items' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
            <div className="md:col-span-4 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search title, slug, subcategory..."
                value={catalogSearch}
                onChange={(e) => {
                  setCatalogSearch(e.target.value);
                  setCatalogPage(1);
                }}
                className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-slate-900 dark:text-white"
              />
            </div>

            <select
              value={catalogCategoryFilter}
              onChange={(e) => {
                setCatalogCategoryFilter(e.target.value);
                setCatalogPage(1);
              }}
              className="md:col-span-3 bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="all">All 8 Categories ({services.length})</option>
              <option value="packages">Compliance Packages</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>

            <select
              value={catalogTypeFilter}
              onChange={(e) => {
                setCatalogTypeFilter(e.target.value);
                setCatalogPage(1);
              }}
              className="md:col-span-2 bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="all">All Types</option>
              <option value="service">Services</option>
              <option value="digital_product">Digital Products</option>
              <option value="compliance_package">Packages</option>
              <option value="api_product">API Products</option>
            </select>

            <select
              value={catalogStatusFilter}
              onChange={(e) => {
                setCatalogStatusFilter(e.target.value as any);
                setCatalogPage(1);
              }}
              className="md:col-span-2 bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="all">All Status</option>
              <option value="published">Published Only</option>
              <option value="unpublished">Unpublished Only</option>
            </select>

            <div className="md:col-span-1 flex items-center justify-end gap-1">
              <button
                type="button"
                aria-label="Grid View"
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg border cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                    : 'bg-[#F7F8FA] dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Table View"
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg border cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                    : 'bg-[#F7F8FA] dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {viewMode === 'table' ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-bold">Service / Product</th>
                    <th className="px-3 py-3 font-bold">Category</th>
                    <th className="px-3 py-3 font-bold text-right">Prof. Fee</th>
                    <th className="px-3 py-3 font-bold text-right">Govt Fee</th>
                    <th className="px-3 py-3 font-bold text-right">GST</th>
                    <th className="px-3 py-3 font-bold text-right">Est. Total</th>
                    <th className="px-3 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                  {visibleCatalog.map((s) => {
                    const rowTotals = calculateOrderTotalsPaise({
                      serviceChargeInr: s.serviceCharge,
                      govtFeesInr: s.govtFees || 0,
                      thirdPartyFeesInr: s.thirdPartyFees || 0,
                      discountInr: s.discountInr || 0,
                      taxRateBps: s.taxRateBps ?? 1800,
                    });
                    const isPublished = s.published !== false;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 dark:text-white">{s.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">/{s.slug}</div>
                        </td>
                        <td className="px-3 py-3 capitalize text-slate-600 dark:text-slate-300">
                          {s.category.replace(/-/g, ' ')}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                          {s.isCustomQuote ? 'Quote' : `₹${s.serviceCharge}`}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-slate-600 dark:text-slate-300">
                          ₹{(s.govtFees || 0) + (s.thirdPartyFees || 0)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-slate-500">
                          {((s.taxRateBps ?? 1800) / 100).toFixed(0)}%
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {s.isCustomQuote ? formatServicePriceLabel(s) : `₹${fromPaise(rowTotals.totalPaise)}`}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            disabled={busyId === s.id}
                            onClick={() => handleTogglePublish(s)}
                            className={`px-2 py-1 rounded-lg font-bold text-[11px] cursor-pointer whitespace-nowrap ${
                              isPublished
                                ? 'bg-emerald-50 text-[#138808] dark:bg-emerald-950/50 dark:text-emerald-300'
                                : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {isPublished ? 'Published' : 'Unpublished'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenQuickPrice(s)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-[#138808] hover:bg-emerald-50 dark:hover:bg-slate-800 cursor-pointer"
                              title="Edit Pricing & GST"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditServiceModal(s)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-[#FF671F] hover:bg-orange-50 dark:hover:bg-slate-800 cursor-pointer"
                              title="Edit Full Listing"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {pendingDeleteId === s.id ? (
                              <button
                                type="button"
                                onClick={() => handleConfirmDelete(s)}
                                className="px-2 py-1 rounded-lg bg-red-600 text-white font-bold text-[10px] cursor-pointer"
                              >
                                Confirm
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPendingDeleteId(s.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 cursor-pointer"
                                title="Delete Listing"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleCatalog.map((s) => {
                const cardTotals = calculateOrderTotalsPaise({
                  serviceChargeInr: s.serviceCharge,
                  govtFeesInr: s.govtFees || 0,
                  thirdPartyFeesInr: s.thirdPartyFees || 0,
                  discountInr: s.discountInr || 0,
                  taxRateBps: s.taxRateBps ?? 1800,
                });
                const isPublished = s.published !== false;
                return (
                  <div
                    key={s.id}
                    className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-3 text-xs flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-[#FF671F]">
                            {s.productType === 'api_product'
                              ? 'API Product'
                              : s.productType === 'compliance_package'
                              ? 'Compliance Package'
                              : s.productType === 'digital_product'
                              ? 'Digital Download'
                              : 'Digital Service'}{' '}
                            · {s.availability}
                          </div>
                          <h3 className="font-bold text-slate-900 dark:text-white text-sm mt-0.5 truncate">
                            {s.name}
                          </h3>
                          <span className="text-[10px] text-slate-400 capitalize block truncate">
                            {s.category.replace(/-/g, ' ')}
                            {s.subcategory ? ` · ${s.subcategory}` : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenQuickPrice(s)}
                            className="text-slate-500 hover:text-[#138808] p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-slate-800 cursor-pointer"
                            title="Quick Edit Pricing"
                          >
                            <SlidersHorizontal className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditServiceModal(s)}
                            className="text-slate-500 hover:text-[#FF671F] p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                            title="Edit Service / Product"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {pendingDeleteId === s.id ? (
                            <button
                              type="button"
                              disabled={busyId === s.id}
                              onClick={() => handleConfirmDelete(s)}
                              className="px-2 py-1 rounded-lg bg-red-600 text-white font-bold text-[10px] cursor-pointer"
                            >
                              Delete?
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPendingDeleteId(s.id)}
                              className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-slate-800 cursor-pointer"
                              title="Delete Service"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 border-y border-slate-100 dark:border-slate-800 py-2 tabular-nums">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Prof. Fee</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                            {s.isCustomQuote ? 'Quote' : `₹${s.serviceCharge}`}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Govt / 3P</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                            ₹{(s.govtFees || 0) + (s.thirdPartyFees || 0)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Incl. GST</span>
                          <span className="font-mono font-bold text-[#138808] dark:text-emerald-400">
                            {s.isCustomQuote ? formatServicePriceLabel(s) : `₹${fromPaise(cardTotals.totalPaise)}`}
                          </span>
                        </div>
                      </div>

                      <p className="text-slate-600 dark:text-slate-400 line-clamp-2 text-[11px]">
                        {s.shortDesc}
                      </p>
                    </div>

                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>
                        {s.formFields.length} Fields · {s.deliveryType || 'online'} · v{s.formVersion || 1}
                      </span>
                      <button
                        type="button"
                        disabled={busyId === s.id}
                        onClick={() => handleTogglePublish(s)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold cursor-pointer transition ${
                          isPublished
                            ? 'bg-emerald-50 text-[#138808] dark:bg-emerald-950/50 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {isPublished ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span>{isPublished ? 'Published' : 'Unpublished'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {catalogTotalPages > 1 && (
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs tabular-nums">
              <span className="text-slate-500 dark:text-slate-400">
                Showing {(safeCatalogPage - 1) * CATALOG_PAGE_SIZE + 1}–
                {Math.min(safeCatalogPage * CATALOG_PAGE_SIZE, filteredCatalog.length)} of{' '}
                {filteredCatalog.length} items
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safeCatalogPage <= 1}
                  onClick={() => setCatalogPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold disabled:opacity-40 cursor-pointer"
                >
                  Prev
                </button>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {safeCatalogPage} / {catalogTotalPages}
                </span>
                <button
                  type="button"
                  disabled={safeCatalogPage >= catalogTotalPages}
                  onClick={() => setCatalogPage((p) => Math.min(catalogTotalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {catalogSubTab === 'coupons' && (
        <AdminCouponsPanel
          coupons={coupons}
          categories={categories}
          onSaveCoupon={saveCoupon}
          onDeleteCoupon={deleteCoupon}
          onNotify={showNotice}
        />
      )}

      {catalogSubTab === 'categories' && (
        <AdminCategoriesPanel
          categories={categories}
          services={services}
          onSaveCategory={saveCategory}
          onNotify={showNotice}
        />
      )}

      {catalogSubTab === 'digital_orders' && (
        <AdminDigitalOrdersPanel digitalOrders={digitalOrders} />
      )}

      {catalogSubTab === 'quotes' && (
        <AdminQuoteRequestsPanel
          quoteRequests={quoteRequests}
          onUpdateStatus={updateQuoteRequestStatus}
          onNotify={showNotice}
        />
      )}

      {catalogSubTab === 'import_export' && (
        <AdminImportExportPanel
          services={services}
          importReports={importReports}
          actorName={user?.name}
          onImportCatalogue={importCatalogue}
          onSyncCatalogueToDb={syncCatalogueServicesToDatabase}
          onNotify={showNotice}
        />
      )}

      {/* Quick Pricing Editor Modal */}
      {pricingTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF671F]">
                  Pricing &amp; Statutory Breakdown Editor
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                  {pricingTarget.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPricingTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickPrice} className="space-y-3.5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Professional Fee (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={priceServiceCharge}
                    onChange={(e) => setPriceServiceCharge(Number(e.target.value))}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Govt / Statutory Fee (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={priceGovtFees}
                    onChange={(e) => setPriceGovtFees(Number(e.target.value))}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    3rd-Party Fee (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={priceThirdPartyFees}
                    onChange={(e) => setPriceThirdPartyFees(Number(e.target.value))}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Urgent Fee (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={priceUrgentFee}
                    onChange={(e) => setPriceUrgentFee(Number(e.target.value))}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Catalog Discount (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={priceDiscountInr}
                    onChange={(e) => setPriceDiscountInr(Number(e.target.value))}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    GST Rate (bps, 1800=18%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={2800}
                    step={100}
                    value={priceTaxRateBps}
                    onChange={(e) => setPriceTaxRateBps(Number(e.target.value))}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pricing Mode
                  </label>
                  <select
                    value={pricePricingType}
                    onChange={(e) => setPricePricingType(e.target.value as PricingType)}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="starting">Starting From</option>
                    <option value="custom">Custom Quote</option>
                    <option value="free">Free</option>
                    <option value="commission">Commission</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Billing Unit
                  </label>
                  <select
                    value={priceBillingUnit}
                    onChange={(e) => setPriceBillingUnit(e.target.value as BillingUnit)}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2"
                  >
                    <option value="one_time">One-Time</option>
                    <option value="month">Per Month</option>
                    <option value="year">Per Year</option>
                    <option value="page">Per Page</option>
                    <option value="application">Per App</option>
                    <option value="document">Per Doc</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    B2B Partner Rate (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Auto if blank"
                    value={pricePartnerInr}
                    onChange={(e) => setPricePartnerInr(e.target.value)}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Government Fee Transparency Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Statutory NSDL challan ₹107 paid at actuals"
                  value={priceGovtNote}
                  onChange={(e) => setPriceGovtNote(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={priceCustomQuote}
                  onChange={(e) => setPriceCustomQuote(e.target.checked)}
                  className="accent-[#FF671F]"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Custom Scope Quotation Workflow
                </span>
              </label>

              {/* Live Itemized Total Preview */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1.5 font-mono tabular-nums">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400">
                  Customer Checkout Preview (with Urgent off baseline / Urgent on top)
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-slate-600 dark:text-slate-300">Professional Fee (net):</span>
                  <span>₹{fromPaise(quickPricePreview.serviceFeePaise - quickPricePreview.discountPaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-slate-600 dark:text-slate-300">Govt Statutory Fee:</span>
                  <span>₹{fromPaise(quickPricePreview.govtFeePaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-slate-600 dark:text-slate-300">
                    GST ({((Number(priceTaxRateBps) || 0) / 100).toFixed(0)}%):
                  </span>
                  <span>₹{fromPaise(quickPricePreview.taxPaise)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 pt-1.5">
                  <span className="font-sans">Total Payable Estimate:</span>
                  <span>₹{fromPaise(quickPricePreview.totalPaise)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPricingTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingQuickPrice}
                  className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-5 py-2 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {savingQuickPrice ? 'Saving...' : 'Save Pricing to Firestore'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Create / Edit Service & Product Modal */}
      {serviceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full p-6 sm:p-7 space-y-5 shadow-2xl text-xs max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  {editingServiceId
                    ? 'Edit Service / Digital Product / Package'
                    : 'Add New Service / Product'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Saved directly to Firestore services collection and synchronized across B2C, B2B Portal, and Operator Intake.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setServiceModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveServiceModal} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Service / Product Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Shop & Establishment Registration"
                    value={srvName}
                    onChange={(e) => {
                      setSrvName(e.target.value);
                      if (!editingServiceId) setSrvSlug(slugifyServiceName(e.target.value));
                    }}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Hindi Subtitle
                  </label>
                  <input
                    type="text"
                    placeholder="शॉप एवं स्थापना पंजीकरण"
                    value={srvNameHi}
                    onChange={(e) => setSrvNameHi(e.target.value)}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    URL Slug *
                  </label>
                  <input
                    type="text"
                    value={srvSlug}
                    onChange={(e) => setSrvSlug(slugifyServiceName(e.target.value))}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Product Classification
                  </label>
                  <select
                    value={srvProductType}
                    onChange={(e) => setSrvProductType(e.target.value as any)}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  >
                    <option value="service">Digital Assisted Service</option>
                    <option value="digital_product">Downloadable Digital Product</option>
                    <option value="compliance_package">Business Compliance Package</option>
                    <option value="api_product">API Setu Verification Product</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={srvCategory}
                    onChange={(e) => setSrvCategory(e.target.value)}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.slug}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Subcategory
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PAN & Identity"
                    value={srvSubcategory}
                    onChange={(e) => setSrvSubcategory(e.target.value)}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Pricing Mode
                    </label>
                    <select
                      value={srvPricingType}
                      onChange={(e) => setSrvPricingType(e.target.value as PricingType)}
                      className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2"
                    >
                      <option value="fixed">Fixed</option>
                      <option value="starting">Starting From</option>
                      <option value="custom">Custom Quote</option>
                      <option value="free">Free</option>
                      <option value="commission">Commission</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Billing Unit
                    </label>
                    <select
                      value={srvBillingUnit}
                      onChange={(e) => setSrvBillingUnit(e.target.value as BillingUnit)}
                      className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2"
                    >
                      <option value="one_time">One-Time</option>
                      <option value="month">Per Month</option>
                      <option value="year">Per Year</option>
                      <option value="page">Per Page</option>
                      <option value="application">Per App</option>
                      <option value="document">Per Doc</option>
                      <option value="verification">Per Verify</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Delivery Mode
                    </label>
                    <select
                      value={srvDeliveryType}
                      onChange={(e) => setSrvDeliveryType(e.target.value as ServiceDeliveryType)}
                      className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2"
                    >
                      <option value="online">Online</option>
                      <option value="assisted">Assisted Desk</option>
                      <option value="digital_download">Instant Download</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="api">API</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Integration
                    </label>
                    <select
                      value={srvIntegrationType}
                      onChange={(e) => setSrvIntegrationType(e.target.value as IntegrationType)}
                      className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2"
                    >
                      <option value="manual_assistance">Assisted Desk</option>
                      <option value="api_setu">API Setu</option>
                      <option value="digilocker">DigiLocker</option>
                      <option value="external_portal">Statutory Portal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Status
                    </label>
                    <select
                      value={srvAvailability}
                      onChange={(e) => setSrvAvailability(e.target.value as AvailabilityStatus)}
                      className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2"
                    >
                      <option value="Live">Live</option>
                      <option value="Manual">Manual</option>
                      <option value="Coming Soon">Coming Soon</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Prof. Fee (₹) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={srvCharge}
                      onChange={(e) => setSrvCharge(Number(e.target.value))}
                      className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Govt Fee (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={srvGovtFee}
                      onChange={(e) => setSrvGovtFee(Number(e.target.value))}
                      className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      3rd Party (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={srvThirdPartyFee}
                      onChange={(e) => setSrvThirdPartyFee(Number(e.target.value))}
                      className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Discount (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={srvDiscountInr}
                      onChange={(e) => setSrvDiscountInr(Number(e.target.value))}
                      className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Urgent Fee (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={srvUrgentFee}
                      onChange={(e) => setSrvUrgentFee(Number(e.target.value))}
                      className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      GST (bps)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={2800}
                      step={100}
                      value={srvTaxRateBps}
                      onChange={(e) => setSrvTaxRateBps(Number(e.target.value))}
                      className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Est. Time
                    </label>
                    <input
                      type="text"
                      value={srvEstTime}
                      onChange={(e) => setSrvEstTime(e.target.value)}
                      className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Government Fee Transparency Note
                </label>
                <input
                  type="text"
                  placeholder="Optional clarification shown in customer pricing breakdown"
                  value={srvGovtFeeNote}
                  onChange={(e) => setSrvGovtFeeNote(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
              </div>

              {srvProductType === 'digital_product' && (
                <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-2xl space-y-3">
                  <div className="font-bold text-slate-800 dark:text-slate-100">
                    Digital Download Asset Configuration (R2 Bucket: generated_files)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      placeholder="File format (e.g. XLSX / PDF)"
                      value={srvAssetFormat}
                      onChange={(e) => setSrvAssetFormat(e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                    />
                    <input
                      type="text"
                      placeholder="Version (e.g. v2.1)"
                      value={srvAssetVersion}
                      onChange={(e) => setSrvAssetVersion(e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                    />
                    <input
                      type="text"
                      placeholder="Size (e.g. 420 KB)"
                      value={srvAssetSize}
                      onChange={(e) => setSrvAssetSize(e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      placeholder="R2 Object Key (optional)"
                      value={srvAssetR2Key}
                      onChange={(e) => setSrvAssetR2Key(e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-[11px]"
                    />
                    <label className="bg-white dark:bg-slate-900 border border-dashed border-emerald-400 rounded-xl px-3 py-2 font-semibold text-emerald-700 dark:text-emerald-300 cursor-pointer text-center">
                      {uploadingAsset ? 'Uploading to R2...' : 'Upload Digital Product File to R2'}
                      <input type="file" onChange={handleUploadDigitalAssetFile} className="hidden" />
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="Preview summary of files & templates inside download..."
                    value={srvAssetPreview}
                    onChange={(e) => setSrvAssetPreview(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>
              )}

              {srvProductType === 'compliance_package' && (
                <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 rounded-2xl space-y-2.5">
                  <div className="font-bold text-slate-800 dark:text-slate-100">Package Bundle Configuration</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Included Service IDs (comma separated)
                      </label>
                      <input
                        type="text"
                        placeholder="udyam-registration, gst-registration, website-design"
                        value={srvIncludedIdsText}
                        onChange={(e) => setSrvIncludedIdsText(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Bundle Savings (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={srvPackageSavings}
                        onChange={(e) => setSrvPackageSavings(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Exclusions (one per line)
                    </label>
                    <textarea
                      rows={2}
                      value={srvExclusionsText}
                      onChange={(e) => setSrvExclusionsText(e.target.value)}
                      placeholder="Statutory government fees paid on actuals"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Short Description *
                </label>
                <input
                  type="text"
                  value={srvShortDesc}
                  onChange={(e) => setSrvShortDesc(e.target.value)}
                  required
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Overview &amp; Scope
                </label>
                <textarea
                  rows={2}
                  value={srvFullDesc}
                  onChange={(e) => setSrvFullDesc(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SEO Meta Title
                  </label>
                  <input
                    type="text"
                    placeholder="Leave blank for automatic title"
                    value={srvSeoTitle}
                    onChange={(e) => setSrvSeoTitle(e.target.value)}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Regulated / CA-Advocate Notice (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Prepared / certified via empanelled professionals where applicable"
                    value={srvRegulatedNotice}
                    onChange={(e) => setSrvRegulatedNotice(e.target.value)}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  SEO Meta Description
                </label>
                <input
                  type="text"
                  value={srvSeoDescription}
                  onChange={(e) => setSrvSeoDescription(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Eligibility Criteria (One per line)
                </label>
                <textarea
                  rows={2}
                  value={srvEligibilityText}
                  onChange={(e) => setSrvEligibilityText(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
              </div>

              {/* Required Documents & Form Fields Builders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                  <span className="font-bold text-slate-800 dark:text-slate-100 block">
                    Required Documents ({srvRequiredDocs.length})
                  </span>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {srvRequiredDocs.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between bg-white dark:bg-slate-900 px-2.5 py-1 rounded border border-slate-100 dark:border-slate-800"
                      >
                        <span className="truncate">{d.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setSrvRequiredDocs((prev) => prev.filter((x) => x.id !== d.id))
                          }
                          className="text-red-500 hover:text-red-700 font-bold ml-2 cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Add doc requirement..."
                      value={newDocName}
                      onChange={(e) => setNewDocName(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newDocName.trim()) return;
                        setSrvRequiredDocs((prev) => [
                          ...prev,
                          {
                            id: `doc-req-${Date.now()}`,
                            name: newDocName.trim(),
                            description: 'Clear PDF or JPG copy',
                            mandatory: true,
                            allowedFormats: ['pdf', 'jpg', 'png'],
                            maxSizeMB: 5,
                          },
                        ]);
                        setNewDocName('');
                      }}
                      className="bg-slate-800 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                  <span className="font-bold text-slate-800 dark:text-slate-100 block">
                    Application Form Fields ({srvFormFields.length})
                  </span>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {srvFormFields.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between bg-white dark:bg-slate-900 px-2.5 py-1 rounded border border-slate-100 dark:border-slate-800"
                      >
                        <span className="truncate">
                          {f.label} <em className="text-slate-400">({f.type})</em>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSrvFormFields((prev) => prev.filter((x) => x.id !== f.id))
                          }
                          className="text-red-500 hover:text-red-700 font-bold ml-2 cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Field label..."
                      value={newFieldLabel}
                      onChange={(e) => setNewFieldLabel(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1"
                    />
                    <select
                      value={newFieldType}
                      onChange={(e) => setNewFieldType(e.target.value as any)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 py-1"
                    >
                      {ALL_FIELD_TYPES.map((ft) => (
                        <option key={ft.value} value={ft.value}>
                          {ft.value}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newFieldLabel.trim()) return;
                        setSrvFormFields((prev) => [
                          ...prev,
                          {
                            id:
                              slugifyServiceName(newFieldLabel).replace(/-/g, '_') ||
                              `f_${Date.now()}`,
                            label: newFieldLabel.trim(),
                            type: newFieldType,
                            required: true,
                          },
                        ]);
                        setNewFieldLabel('');
                      }}
                      className="bg-slate-800 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Structured Service FAQs */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2.5">
                <span className="font-bold text-slate-800 dark:text-slate-100 block">
                  Structured FAQs — Auto FAQPage JSON-LD ({srvFaqs.length})
                </span>
                {srvFaqs.length > 0 && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {srvFaqs.map((faq, idx) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between gap-2 bg-white dark:bg-slate-900 px-2.5 py-2 rounded border border-slate-100 dark:border-slate-800"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">
                            {faq.question}
                          </div>
                          <div className="text-[11px] text-slate-500 line-clamp-2">{faq.answer}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSrvFaqs((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 font-bold shrink-0 cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                  <input
                    type="text"
                    placeholder="FAQ Question..."
                    value={newFaqQuestion}
                    onChange={(e) => setNewFaqQuestion(e.target.value)}
                    className="md:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5"
                  />
                  <input
                    type="text"
                    placeholder="Clear concise FAQ Answer..."
                    value={newFaqAnswer}
                    onChange={(e) => setNewFaqAnswer(e.target.value)}
                    className="md:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newFaqQuestion.trim() || !newFaqAnswer.trim()) return;
                      setSrvFaqs((prev) => [
                        ...prev,
                        { question: newFaqQuestion.trim(), answer: newFaqAnswer.trim() },
                      ]);
                      setNewFaqQuestion('');
                      setNewFaqAnswer('');
                    }}
                    className="md:col-span-2 bg-slate-800 text-white font-bold px-2.5 py-1.5 rounded-lg cursor-pointer"
                  >
                    Add FAQ
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={srvPublished}
                    onChange={(e) => setSrvPublished(e.target.checked)}
                    className="accent-[#138808]"
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    Published (Visible in Marketplace &amp; Sitemap)
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={srvB2bSupported}
                    onChange={(e) => setSrvB2bSupported(e.target.checked)}
                    className="accent-[#FF671F]"
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    Available for B2B Bulk / Partners
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={srvPopular}
                    onChange={(e) => setSrvPopular(e.target.checked)}
                    className="accent-[#FF671F]"
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    Mark as Popular Listing
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={srvIsCustomQuote}
                    onChange={(e) => setSrvIsCustomQuote(e.target.checked)}
                    className="accent-[#FF671F]"
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    Custom Quote Workflow (Requires Scoping)
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setServiceModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingServiceModal}
                  className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-6 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {savingServiceModal
                    ? 'Saving...'
                    : editingServiceId
                    ? 'Save Updated Service'
                    : 'Publish New Service / Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
