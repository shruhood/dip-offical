import React, { useState, useMemo } from 'react';
import { Service, ServiceFormField, Application } from '../../types';
import { useData, ApplicationDraft } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { CashfreeModal } from '../payment/CashfreeModal';
import { isFieldVisible, validateFormSubmission, evaluateCondition } from '../../lib/formEngine';
import { calculateOrderTotalsPaise, fromPaise } from '../../lib/finance';
import { generateDigitalProductPayload } from '../../data/catalogue/digitalGenerators';
import { auth } from '../../services/firebase';
import { downloadAuthorizedDigitalProduct, uploadFileToR2 } from '../../services/backendApi';
import {
  CheckCircle2,
  Upload,
  ArrowRight,
  ArrowLeft,
  FileText,
  Check,
  Save,
  Download,
  Info,
  Plus,
  Trash2,
  AlertCircle,
  X,
} from 'lucide-react';

interface ApplicationWizardProps {
  initialService?: Service;
  initialDraft?: ApplicationDraft;
  assistedPartnerId?: string;
  assistedApplicantName?: string;
  onSuccess: (app: Application) => void;
  onCancel: () => void;
}

export const ApplicationWizard: React.FC<ApplicationWizardProps> = ({
  initialService,
  initialDraft,
  assistedPartnerId,
  assistedApplicantName,
  onSuccess,
  onCancel,
}) => {
  const { services, createApplication, saveDraft, validateCoupon, businessSettings, apiIntegrations } = useData();
  const { user, role } = useAuth();
  const { lang } = useLanguage();
  const cashfreeIntegration = apiIntegrations.find((i) => i.code === 'cashfree');
  const preferredCashfreeMode: 'sandbox' | 'production' =
    cashfreeIntegration?.environment === 'production' ? 'production' : 'sandbox';

  const isStaffAssistedDefault =
    Boolean(assistedPartnerId) || role === 'operator' || role === 'partner';

  const [selectedService] = useState<Service>(initialService || services[0]);
  const [currentStep, setCurrentStep] = useState<number>(initialDraft ? 2 : 1);
  const [filingMode, setFilingMode] = useState<'self' | 'assisted'>(
    initialDraft?.filingMode || (isStaffAssistedDefault ? 'assisted' : 'self')
  );
  const [referralCodeUsed, setReferralCodeUsed] = useState<string>(
    initialDraft?.formData?.referralCodeUsed || user?.referredByCode || ''
  );
  const [assistedConsentConfirmed, setAssistedConsentConfirmed] = useState<boolean>(false);

  const [formData, setFormData] = useState<Record<string, any>>(() => {
    if (initialDraft?.formData) return initialDraft.formData;
    return {
      full_name: assistedApplicantName || (filingMode === 'self' ? user?.name || '' : ''),
      userEmail: filingMode === 'self' ? user?.email || '' : '',
      userMobile: filingMode === 'self' ? user?.mobile || '' : '',
    };
  });

  const [uploadedFiles, setUploadedFiles] = useState<
    Record<string, { file: File; name: string; size: number }>
  >({});
  const [declarationConsent, setDeclarationConsent] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [stepError, setStepError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [submittedApp, setSubmittedApp] = useState<Application | null>(null);
  const [draftSavedMsg, setDraftSavedMsg] = useState(false);
  const [urgentProcessing, setUrgentProcessing] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCouponCode, setAppliedCouponCode] = useState('');
  const [couponFeedback, setCouponFeedback] = useState<string | null>(null);

  const steps = [
    { num: 1, title: 'Instructions' },
    { num: 2, title: 'Applicant Details' },
    { num: 3, title: 'Upload Documents' },
    { num: 4, title: 'Review & Consent' },
    { num: 5, title: 'Payment & Confirm' },
  ];

  const couponResult = useMemo(() => {
    if (!appliedCouponCode) return null;
    const baseSub = selectedService.serviceCharge + (urgentProcessing ? selectedService.urgentFee || 0 : 0);
    return validateCoupon(appliedCouponCode, baseSub, selectedService.category);
  }, [appliedCouponCode, selectedService, urgentProcessing, validateCoupon]);

  const appliedDiscountInr = couponResult?.valid ? couponResult.discountInr : 0;

  const taxRateBps = selectedService.taxRateBps ?? businessSettings.defaultTaxRateBps ?? 1800;
  const pricing = useMemo(
    () =>
      calculateOrderTotalsPaise({
        serviceChargeInr: selectedService.serviceCharge,
        govtFeesInr: selectedService.govtFees,
        thirdPartyFeesInr: selectedService.thirdPartyFees || 0,
        urgentFeeInr: urgentProcessing ? selectedService.urgentFee || 0 : 0,
        additionalChargeInr: selectedService.additionalCharge || 0,
        discountInr: appliedDiscountInr,
        taxRateBps,
        taxInclusive: selectedService.taxInclusive,
      }),
    [selectedService, urgentProcessing, appliedDiscountInr, taxRateBps]
  );

  const visibleFormFields = useMemo(
    () => selectedService.formFields.filter((f) => isFieldVisible(f, formData)),
    [selectedService.formFields, formData]
  );

  const visibleRequiredDocs = useMemo(
    () => selectedService.requiredDocs.filter((d) => evaluateCondition(d.showIf, formData)),
    [selectedService.requiredDocs, formData]
  );

  const handleFieldChange = (fieldId: string, val: any) => {
    setFormData((prev) => ({ ...prev, [fieldId]: val }));
    if (formErrors[fieldId]) {
      setFormErrors((prev) => {
        const copy = { ...prev };
        delete copy[fieldId];
        return copy;
      });
    }
  };

  const handleFileUpload = (docId: string, file: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setStepError(`File "${file.name}" exceeds the 10 MB Cloudflare Free-Plan per-file upload limit.`);
      return;
    }
    setStepError(null);
    setUploadedFiles((prev) => ({
      ...prev,
      [docId]: {
        file,
        name: file.name,
        size: file.size,
      },
    }));
  };

  const validateStep2 = () => {
    const res = validateFormSubmission(selectedService.formFields, formData, lang === 'hi' ? 'hi' : 'en');
    const errors = { ...res.errors };

    if (!formData.userMobile || String(formData.userMobile).replace(/\D/g, '').length < 10) {
      errors.userMobile = 'Valid 10-digit applicant mobile number is required';
    }
    if (!formData.userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(formData.userEmail))) {
      errors.userEmail = 'Valid applicant email address is required';
    }
    if (filingMode === 'assisted' && !assistedConsentConfirmed) {
      errors._assistedConsent = 'Please confirm applicant authorization for assisted filing.';
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      setStepError('Please complete all highlighted required fields before continuing.');
      return false;
    }
    setStepError(null);
    return true;
  };

  const validateStep3 = () => {
    const missingDocs: string[] = [];
    visibleRequiredDocs.forEach((doc) => {
      if (doc.mandatory && !uploadedFiles[doc.id]) {
        missingDocs.push(doc.name);
      }
    });

    if (missingDocs.length > 0) {
      setStepError(`Please upload mandatory documents: ${missingDocs.join(', ')}`);
      return false;
    }
    setStepError(null);
    return true;
  };

  const handleNext = () => {
    setStepError(null);
    if (currentStep === 1) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (validateStep2()) setCurrentStep(3);
    } else if (currentStep === 3) {
      if (validateStep3()) setCurrentStep(4);
    } else if (currentStep === 4) {
      if (!declarationConsent) {
        setStepError('Please accept the declaration and private services consent checkbox.');
        return;
      }
      setShowPaymentModal(true);
    }
  };

  const handleBack = () => {
    setStepError(null);
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSaveDraft = () => {
    saveDraft({
      id: initialDraft?.id,
      serviceSlug: selectedService.slug,
      serviceName: selectedService.name,
      userId: user?.id || 'guest',
      filingMode,
      formData: { ...formData, referralCodeUsed },
    });
    setDraftSavedMsg(true);
    setTimeout(() => setDraftSavedMsg(false), 3500);
  };

  const handlePaymentSuccess = async (paymentDetails: {
    orderId: string;
    cfPaymentId: string;
    amount: number;
    paymentMethod: string;
    paidAt?: string;
    bankReference?: string;
    verifiedByGateway?: boolean;
  }) => {
    setShowPaymentModal(false);

    const isSignedIn = Boolean(auth.currentUser);
    const docsToSave = await Promise.all(
      Object.entries(uploadedFiles).map(async ([docId, docObj]) => {
        const docDef = selectedService.requiredDocs.find((d) => d.id === docId);
        let fileUrl = '#stored-vault';
        let fileId: string | undefined;
        let logicalBucket: string | undefined;
        let r2ObjectKey: string | undefined;

        if (isSignedIn) {
          try {
            const uploadRes = await uploadFileToR2({
              file: docObj.file,
              bucket: 'documents',
              documentCategory: docDef?.name || 'Application Document',
              customerId: user?.id,
            });
            if (uploadRes.ok && uploadRes.data) {
              fileId = uploadRes.data.id;
              logicalBucket = uploadRes.data.logicalBucket || 'documents';
              r2ObjectKey = uploadRes.data.objectKey;
              fileUrl = uploadRes.data.downloadEndpoint || `/api/storage/files/${uploadRes.data.id}/signed-url`;
            }
          } catch {
            // Preserve submission even if local preview runs without Worker binding
          }
        }

        return {
          documentType: docDef?.name || 'Document',
          fileName: docObj.name,
          fileSize: docObj.size,
          mimeType: docObj.file.type || 'application/pdf',
          fileUrl,
          fileId,
          logicalBucket,
          r2ObjectKey,
        };
      })
    );

    const sourceChannel =
      assistedPartnerId || role === 'partner'
        ? 'partner_assisted'
        : role === 'operator' && filingMode === 'assisted'
        ? 'operator_assisted'
        : role === 'business'
        ? 'b2b_portal'
        : 'web_b2c';

    const newApp = await createApplication(selectedService.slug, formData, docsToSave, {
      sourceChannel,
      filingMode,
      userId: user?.id,
      collectedByUid: filingMode === 'assisted' ? user?.id : undefined,
      partnerId: assistedPartnerId || user?.partnerId,
      referralCodeUsed: referralCodeUsed || undefined,
      assistedConsentRecorded: filingMode === 'assisted' ? assistedConsentConfirmed : undefined,
      businessId: user?.businessId,
      applicantName: formData.full_name || assistedApplicantName,
      draftIdToRemove: initialDraft?.id,
      paymentDetails: {
        ...paymentDetails,
        urgentProcessing,
        urgentFee: urgentProcessing ? selectedService.urgentFee || 0 : 0,
        couponCode: appliedCouponCode || undefined,
        discountAmount: appliedDiscountInr,
      },
    });
    setSubmittedApp(newApp);
    setCurrentStep(5);
  };

  const handleApplyWizardCoupon = () => {
    const clean = couponInput.trim().toUpperCase();
    if (!clean) {
      setAppliedCouponCode('');
      setCouponFeedback(null);
      return;
    }
    const baseSub = selectedService.serviceCharge + (urgentProcessing ? selectedService.urgentFee || 0 : 0);
    const res = validateCoupon(clean, baseSub, selectedService.category);
    if (res.valid) {
      setAppliedCouponCode(clean);
      setCouponFeedback(res.message || `Applied: -₹${res.discountInr}`);
    } else {
      setAppliedCouponCode('');
      setCouponFeedback(res.message || 'Invalid coupon code');
    }
  };

  const handleDownloadDigitalPackStep5 = async () => {
    const generated = generateDigitalProductPayload(
      selectedService.digitalAsset?.generatorKey || selectedService.slug,
      selectedService.slug,
      selectedService.name
    );
    await downloadAuthorizedDigitalProduct({
      slug: selectedService.slug,
      orderId: submittedApp?.payment?.orderId,
      fallbackFileName: generated.fileName,
      fallbackGenerator: () => generated,
    });
  };

  const renderDynamicField = (field: ServiceFormField) => {
    const label = lang === 'hi' && field.labelHi ? field.labelHi : field.label;

    if (field.type === 'heading') {
      return (
        <div key={field.id} className="md:col-span-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <h4 className="text-xs font-black uppercase tracking-wider text-[#FF671F]">{label}</h4>
          {field.helpText && <p className="text-[11px] text-slate-500 mt-0.5">{field.helpText}</p>}
        </div>
      );
    }

    if (field.type === 'info') {
      return (
        <div
          key={field.id}
          className="md:col-span-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2"
        >
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{field.helpText || label}</span>
        </div>
      );
    }

    const isWide =
      field.type === 'textarea' ||
      field.type === 'address' ||
      field.type === 'repeater' ||
      field.type === 'consent';

    return (
      <div key={field.id} className={isWide ? 'md:col-span-2' : ''}>
        {field.type !== 'consent' && (
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {label} {field.required && <span className="text-red-500">*</span>}
          </label>
        )}

        {(field.type === 'text' || field.type === 'email' || field.type === 'tel' || field.type === 'number' || field.type === 'date') && (
          <input
            type={field.type}
            placeholder={field.placeholder || ''}
            value={formData[field.id] ?? ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs focus:bg-white dark:focus:bg-slate-900 focus:border-[#FF671F] focus:outline-none"
          />
        )}

        {field.type === 'textarea' && (
          <textarea
            rows={3}
            placeholder={field.placeholder || ''}
            value={formData[field.id] ?? ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#FF671F]"
          />
        )}

        {field.type === 'select' && (
          <select
            value={formData[field.id] ?? ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#FF671F]"
          >
            <option value="">-- Select an option --</option>
            {field.options?.map((opt, i) => (
              <option key={i} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )}

        {field.type === 'radio' && (
          <div className="flex flex-wrap gap-3 pt-1">
            {field.options?.map((opt, i) => (
              <label key={i} className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name={field.id}
                  value={opt}
                  checked={formData[field.id] === opt}
                  onChange={() => handleFieldChange(field.id, opt)}
                  className="text-[#FF671F]"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        )}

        {(field.type === 'checkbox' || field.type === 'multiselect') && field.options?.length ? (
          <div className="flex flex-wrap gap-3 pt-1">
            {field.options.map((opt, i) => {
              const currentArr = Array.isArray(formData[field.id]) ? formData[field.id] : [];
              const isChecked = currentArr.includes(opt);
              return (
                <label key={i} className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) handleFieldChange(field.id, [...currentArr, opt]);
                      else handleFieldChange(field.id, currentArr.filter((x: string) => x !== opt));
                    }}
                    className="text-[#FF671F] rounded"
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>
        ) : field.type === 'checkbox' ? (
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={Boolean(formData[field.id])}
              onChange={(e) => handleFieldChange(field.id, e.target.checked)}
              className="text-[#FF671F] rounded"
            />
            <span>{field.helpText || label}</span>
          </label>
        ) : null}

        {field.type === 'consent' && (
          <label className="flex items-start gap-2.5 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(formData[field.id])}
              onChange={(e) => handleFieldChange(field.id, e.target.checked)}
              className="mt-0.5 text-[#FF671F] rounded"
            />
            <span className="text-slate-700 dark:text-slate-300">
              <strong>{label}:</strong> {field.helpText || 'Applicant confirms accuracy of submitted details.'}
            </span>
          </label>
        )}

        {field.type === 'address' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
            <input
              type="text"
              placeholder="House / Street / Landmark *"
              value={formData[field.id]?.line1 || ''}
              onChange={(e) =>
                handleFieldChange(field.id, { ...(formData[field.id] || {}), line1: e.target.value })
              }
              className="sm:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs"
            />
            <input
              type="text"
              placeholder="City / District *"
              value={formData[field.id]?.city || ''}
              onChange={(e) =>
                handleFieldChange(field.id, { ...(formData[field.id] || {}), city: e.target.value })
              }
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="State *"
                value={formData[field.id]?.state || ''}
                onChange={(e) =>
                  handleFieldChange(field.id, { ...(formData[field.id] || {}), state: e.target.value })
                }
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs"
              />
              <input
                type="text"
                maxLength={6}
                placeholder="PIN *"
                value={formData[field.id]?.pincode || ''}
                onChange={(e) =>
                  handleFieldChange(field.id, { ...(formData[field.id] || {}), pincode: e.target.value })
                }
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono"
              />
            </div>
          </div>
        )}

        {field.type === 'repeater' && (
          <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
            {(Array.isArray(formData[field.id]) ? formData[field.id] : [{}]).map((row: any, rIdx: number, allRows: any[]) => (
              <div key={rIdx} className="flex flex-wrap items-center gap-2">
                {(field.subFields || [{ id: 'entry', label: 'Details', type: 'text', required: true }]).map((sf) => (
                  <input
                    key={sf.id}
                    type={sf.type === 'select' ? 'text' : sf.type}
                    placeholder={sf.label}
                    value={row[sf.id] || ''}
                    onChange={(e) => {
                      const next = [...allRows];
                      next[rIdx] = { ...row, [sf.id]: e.target.value };
                      handleFieldChange(field.id, next);
                    }}
                    className="flex-1 min-w-[140px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                ))}
                {allRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = allRows.filter((_, i) => i !== rIdx);
                      handleFieldChange(field.id, next);
                    }}
                    className="p-1.5 text-red-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const curr = Array.isArray(formData[field.id]) ? formData[field.id] : [{}];
                handleFieldChange(field.id, [...curr, {}]);
              }}
              className="text-[11px] font-bold text-[#FF671F] inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Entry</span>
            </button>
          </div>
        )}

        {field.type === 'file' && (
          <input
            type="file"
            onChange={(e) => handleFieldChange(field.id, e.target.files?.[0]?.name || '')}
            className="w-full text-xs text-slate-600 dark:text-slate-300"
          />
        )}

        {field.helpText && field.type !== 'consent' && (
          <p className="text-[10px] text-slate-400 mt-1">{field.helpText}</p>
        )}
        {formErrors[field.id] && <p className="text-[11px] text-red-500 mt-1">{formErrors[field.id]}</p>}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[84vh] flex flex-col">
      <div className="bg-gradient-to-r from-[#FFFDF8] via-white to-[#F7F8FA] dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 px-4 py-3 border-b border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#FF671F] uppercase tracking-wider">
              <span>{filingMode === 'assisted' ? 'Assisted Partner Filing' : 'Self-Service Portal'}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500 font-normal">v{selectedService.formVersion || 1}</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5 truncate">
              {lang === 'hi' && selectedService.nameHi ? selectedService.nameHi : selectedService.name}
            </h2>
            <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2.5 tabular-nums">
              <span>Fee: <strong className="text-slate-800 dark:text-slate-200">₹{selectedService.serviceCharge}</strong></span>
              {selectedService.govtFees > 0 && (
                <span>Govt: <strong className="text-slate-800 dark:text-slate-200">₹{selectedService.govtFees}</strong></span>
              )}
              <span>Total: <strong className="text-[#138808]">₹{fromPaise(pricing.totalPaise).toLocaleString('en-IN')}</strong></span>
              <span>ETA: <strong className="text-[#138808]">{selectedService.estimatedTime}</strong></span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Close application popup"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {steps.map((st) => (
            <div
              key={st.num}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                currentStep === st.num
                  ? 'bg-[#FF671F] text-white font-bold'
                  : currentStep > st.num
                  ? 'bg-[#EAF7EC] text-[#138808]'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {currentStep > st.num ? <Check className="w-2.5 h-2.5" /> : <span>{st.num}</span>}
              <span className="hidden sm:inline">{st.title}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1">
        {stepError && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{stepError}</span>
          </div>
        )}

        {/* STEP 1 */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="bg-[#FFFDF8] dark:bg-slate-800/60 border border-[#F1E8D9] dark:border-slate-700 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-[#FF671F] font-bold text-sm">
                <Info className="w-4 h-4 shrink-0" />
                <span>Important Instructions Before Applying</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{selectedService.fullDesc}</p>
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 pt-1">
                <div className="font-semibold text-slate-800 dark:text-white">Eligibility Criteria:</div>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  {selectedService.eligibility.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                Documents Required in Step 3
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {selectedService.requiredDocs.map((doc) => (
                  <div key={doc.id} className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs space-y-1">
                    <div className="font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                      <span>{doc.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${doc.mandatory ? 'text-red-600 bg-red-50' : 'text-slate-500 bg-slate-200'}`}>
                        {doc.mandatory ? 'Mandatory' : 'Optional'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">{doc.description}</p>
                    <div className="text-[10px] text-slate-400">
                      {doc.allowedFormats.join(', ').toUpperCase()} · Max {doc.maxSizeMB}MB
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Applicant Details & Service-Specific Information
                </h3>
                <p className="text-xs text-slate-500">Conditional questions update dynamically based on your answers.</p>
              </div>

              <div className="flex items-center gap-2">
                {(role === 'operator' || role === 'partner' || role === 'manager' || role === 'admin' || role === 'super_admin') && (
                  <select
                    value={filingMode}
                    onChange={(e) => setFilingMode(e.target.value as 'self' | 'assisted')}
                    className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold"
                  >
                    <option value="self">Self Filing</option>
                    <option value="assisted">Assisted Customer Filing</option>
                  </select>
                )}

                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="text-xs text-slate-700 dark:text-slate-200 flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-[#FF671F]" />
                  <span>Save Draft</span>
                </button>
              </div>
            </div>

            {draftSavedMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Application draft saved to your account. Resume anytime from your Dashboard.</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Applicant Contact Mobile Number *
                </label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={formData.userMobile || ''}
                  onChange={(e) => handleFieldChange('userMobile', e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#FF671F]"
                />
                {formErrors.userMobile && <p className="text-[11px] text-red-500 mt-1">{formErrors.userMobile}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address for Updates & Invoices *
                </label>
                <input
                  type="email"
                  placeholder="applicant@example.com"
                  value={formData.userEmail || ''}
                  onChange={(e) => handleFieldChange('userEmail', e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#FF671F]"
                />
                {formErrors.userEmail && <p className="text-[11px] text-red-500 mt-1">{formErrors.userEmail}</p>}
              </div>

              {visibleFormFields.map((field) => renderDynamicField(field))}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Partner Referral Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="REF-..."
                  value={referralCodeUsed}
                  onChange={(e) => setReferralCodeUsed(e.target.value.toUpperCase())}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono uppercase"
                />
              </div>
            </div>

            {filingMode === 'assisted' && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs space-y-1">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assistedConsentConfirmed}
                    onChange={(e) => setAssistedConsentConfirmed(e.target.checked)}
                    className="mt-0.5 text-[#FF671F]"
                  />
                  <span>
                    <strong>Assisted Filing Applicant Consent:</strong> I confirm that the physical applicant has reviewed these details and authorized me to submit & pay on their behalf.
                  </span>
                </label>
                {formErrors._assistedConsent && <p className="text-red-600">{formErrors._assistedConsent}</p>}
              </div>
            )}
          </div>
        )}

        {/* STEP 3 */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Upload Verification Documents</h3>
              <p className="text-xs text-slate-500">Private encrypted R2 cloud storage · PDF, JPG, PNG supported.</p>
            </div>

            <div className="space-y-3">
              {visibleRequiredDocs.map((doc) => {
                const uploaded = uploadedFiles[doc.id];
                return (
                  <div
                    key={doc.id}
                    className={`p-4 rounded-xl border transition ${
                      uploaded
                        ? 'border-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{doc.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${doc.mandatory ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                            {doc.mandatory ? 'Mandatory' : 'Optional'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">{doc.description}</p>
                      </div>

                      <div className="shrink-0">
                        {uploaded ? (
                          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-emerald-300 px-3 py-1.5 rounded-lg text-xs">
                            <CheckCircle2 className="w-4 h-4 text-[#138808]" />
                            <span className="font-semibold truncate max-w-[140px]">{uploaded.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setUploadedFiles((prev) => {
                                  const copy = { ...prev };
                                  delete copy[doc.id];
                                  return copy;
                                });
                              }}
                              className="text-red-500 text-[11px] font-bold ml-1 cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <label className="cursor-pointer bg-[#F7F8FA] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5">
                            <Upload className="w-3.5 h-3.5 text-[#FF671F]" />
                            <span>Select File</span>
                            <input
                              type="file"
                              accept={doc.allowedFormats.map((f) => `.${f}`).join(',')}
                              onChange={(e) => handleFileUpload(doc.id, e.target.files?.[0] || null)}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 4 */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Review Summary & Fee Breakdown</h3>
              <p className="text-xs text-slate-500">Verify all entries before Cashfree checkout.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs tabular-nums">
              <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                <span className="font-bold text-slate-800 dark:text-white text-[13px]">Applicant & Filing Mode</span>
                <div className="space-y-1 text-slate-600 dark:text-slate-300">
                  <div>Service: <strong className="text-slate-900 dark:text-white">{selectedService.name}</strong></div>
                  <div>Filing Mode: <strong className="capitalize text-slate-900 dark:text-white">{filingMode}</strong></div>
                  <div>Mobile: <strong className="text-slate-900 dark:text-white">{formData.userMobile}</strong></div>
                  <div>Email: <strong className="text-slate-900 dark:text-white">{formData.userEmail}</strong></div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2.5">
                <span className="font-bold text-slate-800 dark:text-white text-[13px]">Itemized Payment Summary</span>
                <div className="space-y-1 text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span>Facilitation Service Charge:</span>
                    <span className="font-mono">₹{selectedService.serviceCharge}</span>
                  </div>
                  {selectedService.govtFees > 0 && (
                    <div className="flex justify-between">
                      <span>Statutory Govt Fee:</span>
                      <span className="font-mono">₹{selectedService.govtFees}</span>
                    </div>
                  )}
                  {(selectedService.thirdPartyFees || 0) > 0 && (
                    <div className="flex justify-between">
                      <span>3rd-Party Portal / Stamp Fee:</span>
                      <span className="font-mono">₹{selectedService.thirdPartyFees}</span>
                    </div>
                  )}
                  {urgentProcessing && (selectedService.urgentFee || 0) > 0 && (
                    <div className="flex justify-between text-[#FF671F]">
                      <span>Priority / Urgent Processing:</span>
                      <span className="font-mono">+₹{selectedService.urgentFee}</span>
                    </div>
                  )}
                  {appliedDiscountInr > 0 && (
                    <div className="flex justify-between text-[#138808]">
                      <span>Coupon ({appliedCouponCode}):</span>
                      <span className="font-mono">-₹{appliedDiscountInr}</span>
                    </div>
                  )}
                  {pricing.taxPaise > 0 && (
                    <div className="flex justify-between">
                      <span>GST ({(taxRateBps / 100).toFixed(0)}%):</span>
                      <span className="font-mono">₹{fromPaise(pricing.taxPaise)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 pt-1 text-sm">
                    <span>Total Due:</span>
                    <span className="text-[#138808] font-mono">₹{fromPaise(pricing.totalPaise).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {(selectedService.urgentFee || 0) > 0 && (
                  <label className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700 cursor-pointer">
                    <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={urgentProcessing}
                        onChange={(e) => setUrgentProcessing(e.target.checked)}
                        className="accent-[#FF671F]"
                      />
                      <span>Add Priority / Urgent Processing</span>
                    </span>
                    <span className="font-mono font-bold text-[#FF671F]">+₹{selectedService.urgentFee}</span>
                  </label>
                )}

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Promo coupon (e.g. DIGITAL10)"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs uppercase"
                    />
                    <button
                      type="button"
                      onClick={handleApplyWizardCoupon}
                      className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-lg text-[11px] cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                  {couponFeedback && (
                    <div className={`text-[11px] font-semibold ${couponResult?.valid ? 'text-[#138808]' : 'text-red-600'}`}>
                      {couponFeedback}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 text-xs">
              <span className="font-bold text-slate-800 dark:text-white">Attached Documents ({Object.keys(uploadedFiles).length})</span>
              <div className="flex flex-wrap gap-2 pt-1">
                {Object.entries(uploadedFiles).map(([id, doc]) => (
                  <span key={id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-md text-[11px] flex items-center gap-1.5">
                    <FileText className="w-3 h-3 text-[#138808]" />
                    <span>{doc.name}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="p-4 bg-[#FFFDF8] dark:bg-slate-800/60 border border-[#F1E8D9] dark:border-slate-700 rounded-xl">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={declarationConsent}
                  onChange={(e) => setDeclarationConsent(e.target.checked)}
                  className="mt-1 text-[#FF671F] rounded"
                />
                <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  <strong>Declaration & Private Consultancy Consent:</strong> I confirm all submitted information and proofs are genuine. I understand Digital India Project is a private facilitation company (not a government department) and authorize it to prepare and file this application.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* STEP 5 */}
        {currentStep === 5 && submittedApp && (
          <div className="py-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-[#EAF7EC] text-[#138808] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#138808]">
                Application Confirmed & Invoice Issued
              </span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                Application ID: <span className="text-[#FF671F] font-mono">{submittedApp.id}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Invoice #{submittedApp.payment.invoiceNumber} generated for {submittedApp.userEmail}.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {selectedService.productType === 'digital_product' && (
                <button
                  type="button"
                  onClick={() => void handleDownloadDigitalPackStep5()}
                  className="bg-[#138808] hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-6 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Digital Asset Now</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onSuccess(submittedApp)}
                className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold text-xs py-2.5 px-6 rounded-lg cursor-pointer"
              >
                Go to Workspace
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs py-2.5 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        )}

        {currentStep < 5 && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="text-xs font-semibold text-slate-600 dark:text-slate-300 px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <button type="button" onClick={onCancel} className="text-xs font-semibold text-slate-500 px-3 py-1.5 cursor-pointer">
                Cancel
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold text-xs py-2 px-5 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span>{currentStep === 4 ? 'Proceed to Payment' : 'Continue'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <CashfreeModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        serviceId={selectedService.id}
        serviceSlug={selectedService.slug}
        serviceName={selectedService.name}
        serviceCharge={selectedService.serviceCharge}
        govtFees={selectedService.govtFees}
        thirdPartyFees={selectedService.thirdPartyFees || 0}
        urgentFee={urgentProcessing ? selectedService.urgentFee || 0 : 0}
        urgentProcessing={urgentProcessing}
        couponCode={appliedCouponCode || undefined}
        discountAmount={appliedDiscountInr}
        additionalCharge={selectedService.additionalCharge || 0}
        taxAmount={fromPaise(pricing.taxPaise)}
        taxRateBps={taxRateBps}
        applicantId={user?.id}
        applicantName={formData.full_name || 'Valued Applicant'}
        applicantEmail={formData.userEmail || 'applicant@example.com'}
        applicantMobile={formData.userMobile || '+91 98765 43210'}
        preferredMode={preferredCashfreeMode}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
};
