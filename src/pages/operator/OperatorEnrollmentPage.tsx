import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { OperatorKycDocument } from '../../types';
import operatorKendraImg from '../../assets/images/operator_kendra_partner_1794560650685.jpg';
import {
  ShieldCheck,
  Building2,
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Upload,
  Lock,
  Clock,
  Landmark,
  MapPin,
  UserCheck,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  fetchApiSathiDigilocker,
  initApiSathiDigilocker,
  verifyWithApiSathi,
  type ApiSathiDigilockerFetchResult,
  type ApiSathiDigilockerInitResult,
  type ApiSathiVerificationResponse,
} from '../../services/apiSathiService';

interface OperatorEnrollmentPageProps {
  onNavigate: (route: string, param?: string) => void;
}

const INDIAN_STATES = [
  'Dadra and Nagar Haveli and Daman and Diu',
  'Gujarat',
  'Maharashtra',
  'Delhi NCR',
  'Karnataka',
  'Tamil Nadu',
  'Uttar Pradesh',
  'Rajasthan',
  'Madhya Pradesh',
  'West Bengal',
  'Telangana',
  'Kerala',
  'Punjab',
  'Haryana',
  'Bihar',
  'Odisha',
  'Assam',
  'Other State / UT',
];

const KYC_DOC_SLOTS: OperatorKycDocument['docType'][] = [
  'PAN Card',
  'Masked Aadhaar / Address Proof',
  'Center Photograph',
  'Cancelled Cheque / Bank Proof',
];

export const OperatorEnrollmentPage: React.FC<OperatorEnrollmentPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { operatorEnrollments, submitOperatorEnrollment } = useData();

  const existingEnrollment = user
    ? operatorEnrollments.find((e) => e.userId === user.id || e.id === user.operatorEnrollmentId)
    : undefined;

  const isAlreadyApproved =
    user?.role === 'operator' ||
    user?.role === 'admin' ||
    user?.role === 'super_admin' ||
    existingEnrollment?.kycStatus === 'Approved';

  const [showResubmitForm, setShowResubmitForm] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Step 1: Center & Profile
  const [fullName, setFullName] = useState(existingEnrollment?.fullName || user?.name || '');
  const [email, setEmail] = useState(existingEnrollment?.email || user?.email || '');
  const [mobile, setMobile] = useState(existingEnrollment?.mobile || user?.mobile || '');
  const [centerName, setCenterName] = useState(existingEnrollment?.centerName || '');
  const [operatingState, setOperatingState] = useState(
    existingEnrollment?.operatingState || 'Dadra and Nagar Haveli and Daman and Diu'
  );
  const [operatingDistrict, setOperatingDistrict] = useState(existingEnrollment?.operatingDistrict || '');
  const [pincode, setPincode] = useState(existingEnrollment?.pincode || '');
  const [centerAddress, setCenterAddress] = useState(existingEnrollment?.centerAddress || '');
  const [experienceYears, setExperienceYears] = useState(existingEnrollment?.experienceYears || '1-3 years');

  // Step 2: Statutory Tax & Payout Bank
  const [panNumber, setPanNumber] = useState(existingEnrollment?.panNumber || '');
  const [aadhaarLast4, setAadhaarLast4] = useState(
    existingEnrollment?.maskedAadhaar ? existingEnrollment.maskedAadhaar.slice(-4) : ''
  );
  const [bankAccountHolder, setBankAccountHolder] = useState(
    existingEnrollment?.bankAccountHolder || user?.name || ''
  );
  const [bankIfsc, setBankIfsc] = useState(existingEnrollment?.bankIfsc || '');
  const [bankAccountNumber, setBankAccountNumber] = useState('');

  // API Sathi live verification helpers for Step 2
  const [panVerifyLoading, setPanVerifyLoading] = useState(false);
  const [panVerifyResult, setPanVerifyResult] = useState<ApiSathiVerificationResponse | null>(null);
  const [ifscLookupLoading, setIfscLookupLoading] = useState(false);
  const [ifscLookupResult, setIfscLookupResult] = useState<ApiSathiVerificationResponse | null>(null);
  const [dlLoading, setDlLoading] = useState(false);
  const [dlInitResult, setDlInitResult] = useState<ApiSathiDigilockerInitResult | null>(null);
  const [dlFetchResult, setDlFetchResult] = useState<ApiSathiDigilockerFetchResult | null>(null);

  const handleInstantPanVerify = async () => {
    const pan = panNumber.trim().toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
      setPanVerifyResult({
        ok: false,
        verified: false,
        outcome: 'ERROR',
        httpStatus: 400,
        message: 'Enter a valid 10-character PAN (e.g. ABCDE1234F) before verifying.',
        callId: null,
      });
      return;
    }
    setPanVerifyLoading(true);
    setPanVerifyResult(null);
    const res = await verifyWithApiSathi('pan-verification-v1', { pan }, true, 'operator_kyc_pan');
    setPanVerifyResult(res);
    const holderName = res.result?.name || res.result?.fullname;
    if (res.verified && holderName && !bankAccountHolder.trim()) {
      setBankAccountHolder(String(holderName));
    }
    setPanVerifyLoading(false);
  };

  const handleLookupIfsc = async () => {
    const ifsc = bankIfsc.trim().toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      setIfscLookupResult({
        ok: false,
        verified: false,
        outcome: 'ERROR',
        httpStatus: 400,
        message: 'Enter a valid 11-character IFSC code (e.g. SBIN0001234).',
        callId: null,
      });
      return;
    }
    setIfscLookupLoading(true);
    setIfscLookupResult(null);
    const res = await verifyWithApiSathi('ifsc-lookup-v1', { ifsc }, true, 'operator_kyc_ifsc');
    setIfscLookupResult(res);
    setIfscLookupLoading(false);
  };

  const handleStartDigilocker = async () => {
    setDlLoading(true);
    setDlFetchResult(null);
    const cleanName = fullName.trim().split(/\s+/);
    const res = await initApiSathiDigilocker({
      mobile: mobile.replace(/\D/g, '').slice(-10) || undefined,
      emailId: email.trim() || undefined,
      firstName: cleanName[0] || undefined,
      lastName: cleanName.slice(1).join(' ') || undefined,
      purpose: 'kyc',
      redirectionUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      consentGiven: true,
    });
    setDlInitResult(res);
    setDlLoading(false);
  };

  const handleFetchDigilocker = async () => {
    if (!dlInitResult?.transactionId) return;
    setDlLoading(true);
    const res = await fetchApiSathiDigilocker(dlInitResult.transactionId);
    setDlFetchResult(res);
    if (res.verified && res.maskedAadhaar) {
      const digits = res.maskedAadhaar.replace(/\D/g, '');
      if (digits.length >= 4) {
        setAadhaarLast4(digits.slice(-4));
      }
    }
    setDlLoading(false);
  };

  // Step 3: Documents & Declaration
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, { fileName: string; fileSize: number }>>(() => {
    const map: Record<string, { fileName: string; fileSize: number }> = {};
    existingEnrollment?.kycDocuments?.forEach((d) => {
      map[d.docType] = { fileName: d.fileName, fileSize: d.fileSize };
    });
    return map;
  });
  const [declarationAccepted, setDeclarationAccepted] = useState(false);

  const handleFileChange = (docType: OperatorKycDocument['docType'], file: File | null) => {
    if (!file) return;
    setUploadedDocs((prev) => ({
      ...prev,
      [docType]: { fileName: file.name, fileSize: file.size },
    }));
  };

  const validateStep1 = () => {
    if (!fullName.trim() || !email.trim() || !mobile.trim() || !centerName.trim() || !operatingDistrict.trim() || !centerAddress.trim()) {
      setErrorMsg('Please complete all center and contact details before continuing.');
      return false;
    }
    if (!/^\d{6}$/.test(pincode.trim())) {
      setErrorMsg('Please enter a valid 6-digit Indian PIN code.');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  const validateStep2 = () => {
    const cleanPan = panNumber.trim().toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(cleanPan)) {
      setErrorMsg('Please enter a valid 10-character PAN number (e.g. ABCDE1234F).');
      return false;
    }
    const digitsOnly = aadhaarLast4.replace(/\D/g, '');
    if (digitsOnly.length < 4) {
      setErrorMsg('Please enter at least the last 4 digits of your Aadhaar (masked storage only).');
      return false;
    }
    const cleanIfsc = bankIfsc.trim().toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
      setErrorMsg('Please enter a valid 11-character Bank IFSC code (e.g. SBIN0001234).');
      return false;
    }
    if (!bankAccountHolder.trim() || bankAccountNumber.trim().length < 6) {
      setErrorMsg('Please provide the bank account holder name and account number (stored masked).');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const missingDocs = KYC_DOC_SLOTS.filter((slot) => !uploadedDocs[slot]);
    if (missingDocs.length > 0) {
      setErrorMsg(`Please attach all required KYC proofs: missing ${missingDocs[0]}.`);
      return;
    }
    if (!declarationAccepted) {
      setErrorMsg('Please confirm the private operator compliance declaration to submit KYC.');
      return;
    }

    setSubmitting(true);
    try {
      const cleanLast4 = aadhaarLast4.replace(/\D/g, '').slice(-4);
      const acctDigits = bankAccountNumber.replace(/\s+/g, '');
      const maskedAcct = `XXXXXX${acctDigits.slice(-4)}`;

      const docsPayload: OperatorKycDocument[] = KYC_DOC_SLOTS.map((docType, idx) => ({
        id: `kycdoc-${Date.now()}-${idx}`,
        docType,
        fileName: uploadedDocs[docType].fileName,
        fileSize: uploadedDocs[docType].fileSize,
        status: 'Submitted',
      }));

      await submitOperatorEnrollment({
        fullName: fullName.trim(),
        email: email.trim(),
        mobile: mobile.trim(),
        centerName: centerName.trim(),
        operatingState,
        operatingDistrict: operatingDistrict.trim(),
        centerAddress: centerAddress.trim(),
        pincode: pincode.trim(),
        panNumber: panNumber.trim().toUpperCase(),
        maskedAadhaar: `XXXX-XXXX-${cleanLast4}`,
        bankAccountHolder: bankAccountHolder.trim(),
        bankIfsc: bankIfsc.trim().toUpperCase(),
        maskedBankAccount: maskedAcct,
        experienceYears,
        kycDocuments: docsPayload,
      });

      setSubmittedSuccess(true);
      setShowResubmitForm(false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to submit KYC dossier. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 p-7 sm:p-10 space-y-5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#FF671F]">
              Digital India Project · Authorized Facilitation Partner Program
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              Operator Partner Enrollment & KYC Verification
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
              Operate a verified assisted-intake desk in your district. Help citizens and local MSMEs submit PAN, GST, Udyam, FSSAI, and compliance dossiers with transparent real-time tracking.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-xs">
            <div>
              <span className="font-bold text-slate-900 block">Assisted Intake</span>
              <span className="text-slate-500">Collect citizen applications locally</span>
            </div>
            <div>
              <span className="font-bold text-slate-900 block">Masked KYC Vault</span>
              <span className="text-slate-500">DPDP-compliant verification</span>
            </div>
            <div>
              <span className="font-bold text-slate-900 block">Operator Desk</span>
              <span className="text-slate-500">Unlocked upon Admin approval</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 relative min-h-[240px] bg-slate-100">
          <img
            src={operatorKendraImg}
            alt="Digital service partner desk assisting citizen applicant"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Unauthenticated Gate */}
      {!user && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4 shadow-xs max-w-2xl mx-auto">
          <Lock className="w-8 h-8 text-[#FF671F] mx-auto" />
          <h2 className="text-xl font-black text-slate-900">Sign In or Create an Account to Begin Operator KYC</h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Every Operator Partner dossier is tied to your verified Firebase account for zero-trust auditability. Create an account or sign in to submit your KYC documents.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onNavigate('register')}
              className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold text-xs px-6 py-3 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <span>Create Operator Account</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('login')}
              className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs px-6 py-3 rounded-xl transition cursor-pointer"
            >
              Existing User Sign In
            </button>
          </div>
        </div>
      )}

      {/* Existing Enrollment Status Card */}
      {user && (existingEnrollment || isAlreadyApproved) && !showResubmitForm && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Operator KYC Verification Dossier
              </div>
              <h2 className="text-xl font-black text-slate-900 mt-1">
                {existingEnrollment?.centerName || `${user.name} Operations Center`}
              </h2>
              {existingEnrollment && (
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  Dossier ID: {existingEnrollment.id} · Updated {new Date(existingEnrollment.updatedAt).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isAlreadyApproved ? (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[#138808] text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>KYC Approved · Operator Active</span>
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold border ${
                    existingEnrollment?.kycStatus === 'Rejected'
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : existingEnrollment?.kycStatus === 'Resubmission Required'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-blue-50 border-blue-200 text-blue-700'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>{existingEnrollment?.kycStatus || user.kycStatus || 'KYC Submitted'}</span>
                </span>
              )}
            </div>
          </div>

          {submittedSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#138808] shrink-0" />
              <span>Your Operator KYC application has been recorded in Firestore and queued for Admin Compliance Review.</span>
            </div>
          )}

          {existingEnrollment?.adminRemarks && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 space-y-1">
              <span className="font-bold uppercase tracking-wider text-[10px] text-amber-700 block">
                Compliance Desk Remarks
              </span>
              <p className="font-medium">{existingEnrollment.adminRemarks}</p>
            </div>
          )}

          {existingEnrollment && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Authorized Applicant</span>
                <span className="font-bold text-slate-900">{existingEnrollment.fullName}</span>
                <span className="block text-slate-500">{existingEnrollment.mobile}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Center Location</span>
                <span className="font-bold text-slate-900">
                  {existingEnrollment.operatingDistrict}, {existingEnrollment.operatingState}
                </span>
                <span className="block text-slate-500">PIN: {existingEnrollment.pincode}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Statutory Verification</span>
                <span className="font-mono font-bold text-slate-900 block">PAN: {existingEnrollment.panNumber}</span>
                <span className="font-mono text-slate-500 block">
                  Aadhaar: {existingEnrollment.maskedAadhaar} · Bank: {existingEnrollment.maskedBankAccount}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {isAlreadyApproved ? (
              <button
                onClick={() => onNavigate('operator')}
                className="bg-[#138808] hover:bg-emerald-700 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>Open Operator Processing Desk</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <p className="text-xs text-slate-500">
                Operator Desk privileges are granted automatically once an Administrator verifies and approves your KYC proofs.
              </p>
            )}

            {existingEnrollment &&
              (existingEnrollment.kycStatus === 'Resubmission Required' ||
                existingEnrollment.kycStatus === 'Rejected' ||
                existingEnrollment.kycStatus === 'KYC Submitted') && (
                <button
                  onClick={() => setShowResubmitForm(true)}
                  className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Update / Resubmit KYC Details</span>
                </button>
              )}
          </div>
        </div>
      )}

      {/* Multi-Step KYC Wizard */}
      {user && (!existingEnrollment || showResubmitForm) && !isAlreadyApproved && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          {/* Progress Steps Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-lg font-black text-slate-900">Complete Your Partner KYC Dossier</h2>
              <p className="text-xs text-slate-500">
                All statutory numbers are masked prior to database storage in accordance with DPDP Act guidelines.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold">
              {[
                { num: 1, label: 'Center Profile' },
                { num: 2, label: 'Tax & Bank' },
                { num: 3, label: 'KYC Proofs' },
              ].map((item) => (
                <button
                  key={item.num}
                  type="button"
                  onClick={() => {
                    if (item.num < step) setStep(item.num as 1 | 2 | 3);
                  }}
                  className={`px-3 py-1.5 rounded-lg border transition ${
                    step === item.num
                      ? 'bg-[#FF671F] border-[#FF671F] text-white'
                      : step > item.num
                      ? 'bg-emerald-50 border-emerald-200 text-[#138808] cursor-pointer'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                >
                  {item.num}. {item.label}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmitKyc} className="space-y-6 text-xs">
            {/* STEP 1 */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Authorized Signatory Full Name *</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:border-[#FF671F] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Service Center / Business Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Samarvani Digital Seva Kendra"
                      value={centerName}
                      onChange={(e) => setCenterName(e.target.value)}
                      required
                      className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:border-[#FF671F] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Registered Email *</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:border-[#FF671F] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Mobile Number *</label>
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      required
                      className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:border-[#FF671F] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">State / Union Territory *</label>
                    <select
                      value={operatingState}
                      onChange={(e) => setOperatingState(e.target.value)}
                      className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:border-[#FF671F] focus:outline-none"
                    >
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">District / City *</label>
                      <input
                        type="text"
                        placeholder="Silvassa"
                        value={operatingDistrict}
                        onChange={(e) => setOperatingDistrict(e.target.value)}
                        required
                        className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:border-[#FF671F] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">PIN Code *</label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="396230"
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                        required
                        className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono focus:bg-white focus:border-[#FF671F] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Full Physical Shop / Office Address *</label>
                    <input
                      type="text"
                      placeholder="Shop/Office No., Building, Landmark, Road"
                      value={centerAddress}
                      onChange={(e) => setCenterAddress(e.target.value)}
                      required
                      className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:border-[#FF671F] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Consultancy Experience</label>
                    <select
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                      className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:border-[#FF671F] focus:outline-none"
                    >
                      <option value="Under 1 year">Under 1 year</option>
                      <option value="1-3 years">1 – 3 years</option>
                      <option value="3-5 years">3 – 5 years</option>
                      <option value="5+ years">5+ years</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      if (validateStep1()) setStep(2);
                    }}
                    className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-6 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Continue to Statutory & Bank Details</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-semibold text-slate-700">PAN Card Number *</label>
                      <button
                        type="button"
                        onClick={handleInstantPanVerify}
                        disabled={panVerifyLoading || panNumber.trim().length < 10}
                        className="text-[11px] font-bold text-[#FF671F] hover:text-[#E55B1B] cursor-pointer disabled:opacity-50"
                      >
                        {panVerifyLoading ? 'Verifying PAN...' : 'Verify PAN via API Sathi'}
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={10}
                      placeholder="ABCDE1234F"
                      value={panNumber}
                      onChange={(e) => {
                        setPanNumber(e.target.value.toUpperCase());
                        setPanVerifyResult(null);
                      }}
                      required
                      className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono uppercase focus:bg-white focus:border-[#FF671F] focus:outline-none"
                    />
                    {panVerifyResult && (
                      <div
                        className={`mt-1.5 p-2 rounded-lg border text-[11px] space-y-0.5 ${
                          panVerifyResult.verified
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : panVerifyResult.outcome === 'NOT_VERIFIED'
                            ? 'bg-amber-50 border-amber-200 text-amber-900'
                            : 'bg-red-50 border-red-200 text-red-900'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 font-bold">
                          <span>
                            {panVerifyResult.verified
                              ? `PAN Verified${panVerifyResult.result?.name || panVerifyResult.result?.fullname ? ` · ${panVerifyResult.result?.name || panVerifyResult.result?.fullname}` : ''}`
                              : panVerifyResult.outcome === 'NOT_VERIFIED'
                              ? 'PAN record not found (verified: false)'
                              : panVerifyResult.isWalletEmptyError
                              ? 'Verification wallet balance empty — please inform Admin'
                              : panVerifyResult.message}
                          </span>
                          {panVerifyResult.callId && (
                            <span className="font-mono text-[10px]">call_id: {panVerifyResult.callId}</span>
                          )}
                        </div>
                        {panVerifyResult.isSandboxTestKey && (
                          <p className="text-[10px] font-semibold">Sandbox test key active — demo verification data only.</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-semibold text-slate-700">
                        Aadhaar Last 4 Digits (Masked Storage) *
                      </label>
                      <button
                        type="button"
                        onClick={handleStartDigilocker}
                        disabled={dlLoading}
                        className="text-[11px] font-bold text-[#138808] hover:text-emerald-700 cursor-pointer disabled:opacity-50"
                      >
                        {dlLoading ? 'Connecting...' : '2-Step DigiLocker KYC'}
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="e.g. 4812"
                      value={aadhaarLast4}
                      onChange={(e) => setAadhaarLast4(e.target.value.replace(/\D/g, ''))}
                      required
                      className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono focus:bg-white focus:border-[#FF671F] focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Stored as XXXX-XXXX-{aadhaarLast4.padEnd(4, '_')}
                    </span>

                    {dlInitResult && (
                      <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-2">
                        {dlInitResult.ok && dlInitResult.kycUrl ? (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-800">
                                Step 1 ready (tx: {dlInitResult.transactionId})
                              </span>
                              {dlInitResult.callId && (
                                <span className="font-mono text-[10px] text-slate-500">call_id: {dlInitResult.callId}</span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <a
                                href={dlInitResult.kycUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1E293B] text-white font-bold"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Open DigiLocker Link</span>
                              </a>
                              <button
                                type="button"
                                onClick={handleFetchDigilocker}
                                disabled={dlLoading}
                                className="px-2.5 py-1 rounded-lg bg-[#138808] text-white font-bold cursor-pointer disabled:opacity-50"
                              >
                                {dlLoading ? 'Fetching...' : 'I have finished — Fetch Aadhaar'}
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="text-red-700 font-semibold">
                            {dlInitResult.isWalletEmptyError
                              ? 'Verification service temporarily paused (Admin wallet recharge required).'
                              : dlInitResult.message}
                            {dlInitResult.callId && (
                              <span className="block font-mono text-[10px]">call_id: {dlInitResult.callId}</span>
                            )}
                          </div>
                        )}

                        {dlFetchResult && (
                          <div
                            className={`p-2 rounded-lg border ${
                              dlFetchResult.verified
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                : dlFetchResult.notCompleted
                                ? 'bg-amber-50 border-amber-200 text-amber-900'
                                : 'bg-red-50 border-red-200 text-red-900'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 font-bold">
                              <span>
                                {dlFetchResult.verified
                                  ? `Aadhaar Verified (${dlFetchResult.maskedAadhaar || 'Masked'})`
                                  : dlFetchResult.notCompleted
                                  ? 'DigiLocker step not finished yet — complete the link first'
                                  : dlFetchResult.message}
                              </span>
                              {dlFetchResult.callId && (
                                <span className="font-mono text-[10px]">call_id: {dlFetchResult.callId}</span>
                              )}
                            </div>
                            {dlFetchResult.notCompleted && (dlFetchResult.kycUrl || dlInitResult.kycUrl) && (
                              <a
                                href={dlFetchResult.kycUrl || dlInitResult.kycUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-1 font-bold underline"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Retry DigiLocker Consent Link</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bank Account Holder Name *</label>
                    <input
                      type="text"
                      value={bankAccountHolder}
                      onChange={(e) => setBankAccountHolder(e.target.value)}
                      required
                      className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:border-[#FF671F] focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-semibold text-slate-700">Bank IFSC *</label>
                        <button
                          type="button"
                          onClick={handleLookupIfsc}
                          disabled={ifscLookupLoading || bankIfsc.trim().length < 11}
                          className="text-[11px] font-bold text-[#FF671F] hover:text-[#E55B1B] cursor-pointer disabled:opacity-50"
                        >
                          {ifscLookupLoading ? 'Checking...' : 'Lookup'}
                        </button>
                      </div>
                      <input
                        type="text"
                        maxLength={11}
                        placeholder="SBIN0001234"
                        value={bankIfsc}
                        onChange={(e) => {
                          setBankIfsc(e.target.value.toUpperCase());
                          setIfscLookupResult(null);
                        }}
                        required
                        className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono uppercase focus:bg-white focus:border-[#FF671F] focus:outline-none"
                      />
                      {ifscLookupResult && (
                        <div
                          className={`mt-1 p-1.5 rounded-lg border text-[10px] ${
                            ifscLookupResult.verified
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              : 'bg-amber-50 border-amber-200 text-amber-900'
                          }`}
                        >
                          {ifscLookupResult.verified
                            ? `${ifscLookupResult.result?.bank || 'Bank Verified'} — ${ifscLookupResult.result?.branch || ''}`
                            : ifscLookupResult.message}
                          {ifscLookupResult.callId && (
                            <span className="block font-mono">call_id: {ifscLookupResult.callId}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Account Number *</label>
                      <input
                        type="text"
                        placeholder="Last 4 retained"
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value.replace(/\D/g, ''))}
                        required
                        className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono focus:bg-white focus:border-[#FF671F] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (validateStep2()) setStep(3);
                    }}
                    className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-6 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Continue to KYC Documents</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {KYC_DOC_SLOTS.map((slot) => {
                    const current = uploadedDocs[slot];
                    return (
                      <div
                        key={slot}
                        className="p-4 bg-[#F7F8FA] border border-slate-200 rounded-2xl space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{slot} *</span>
                          {current && (
                            <span className="text-[11px] font-bold text-[#138808] flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Attached</span>
                            </span>
                          )}
                        </div>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange(slot, e.target.files?.[0] || null)}
                          className="w-full text-[11px] text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-800 file:text-white file:font-semibold file:cursor-pointer cursor-pointer"
                        />
                        {current && (
                          <div className="text-[11px] text-slate-500 font-mono truncate">
                            {current.fileName} ({Math.max(1, Math.round(current.fileSize / 1024))} KB)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <label className="flex items-start gap-2.5 p-4 bg-[#FFFDF8] border border-[#F1E8D9] rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={declarationAccepted}
                    onChange={(e) => setDeclarationAccepted(e.target.checked)}
                    className="mt-0.5 accent-[#FF671F]"
                  />
                  <span className="text-[11px] text-slate-700 leading-relaxed">
                    I declare that I operate an independent private facilitation center and will never represent Digital India Project or my center as an official government department. I consent to KYC verification under Digital India Project compliance policy.
                  </span>
                </label>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-[#138808] hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{submitting ? 'Submitting KYC Dossier...' : 'Submit Operator KYC Application'}</span>
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
};
