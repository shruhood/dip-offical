import React, { useEffect, useState } from 'react';
import { ShieldAlert, FileText, Lock, Scale, AlertCircle, ShieldCheck, FileDown } from 'lucide-react';

interface LegalPageProps {
  initialSection?: string;
  onNavigate?: (route: string, param?: string) => void;
}

function normalizeLegalSection(raw?: string): string {
  const s = (raw || 'disclaimer').toLowerCase().trim();
  if (s === 'digital-products') return 'digital-product-policy';
  if (s === 'data-protection-policy') return 'data-protection';
  return s;
}

export const LegalPage: React.FC<LegalPageProps> = ({ initialSection = 'disclaimer', onNavigate }) => {
  const [section, setSection] = useState(normalizeLegalSection(initialSection));

  useEffect(() => {
    setSection(normalizeLegalSection(initialSection));
  }, [initialSection]);

  const selectSection = (id: string) => {
    setSection(id);
    if (onNavigate) {
      onNavigate('legal', id);
    }
  };

  const navItems = [
    { id: 'disclaimer', label: 'Statutory Business Disclaimer', icon: ShieldAlert },
    { id: 'privacy', label: 'Privacy Policy (DPDP & OAuth)', icon: Lock },
    { id: 'data-protection', label: 'Data Protection & Security Policy', icon: ShieldCheck },
    { id: 'terms', label: 'Terms & Conditions', icon: FileText },
    { id: 'refund', label: 'Refund & Cancellation Policy', icon: Scale },
    { id: 'digital-product-policy', label: 'Digital Product & Licensing Policy', icon: FileDown },
    { id: 'grievance', label: 'Grievance Redressal Mechanism', icon: AlertCircle },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sidebar Nav */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-1.5 lg:sticky lg:top-24">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
            Legal &amp; Compliance Desk
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectSection(item.id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer ${
                  section === item.id
                    ? 'bg-[#FF671F] text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Pane */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-10 shadow-xs space-y-6 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          {/* DISCLAIMER */}
          {section === 'disclaimer' && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-[#FF671F] uppercase tracking-wider">
                Statutory Notice
              </span>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                Official Business Disclaimer
              </h1>

              <div className="p-4 bg-[#FFFDF8] dark:bg-slate-800/70 border-2 border-[#FFC928]/50 rounded-xl space-y-2">
                <p className="font-bold text-slate-900 dark:text-white text-sm">
                  "Digital India Project is a privately operated digital services and online registration assistance provider. We are not a government department or government-owned entity. Government registrations, applications and approvals are subject to the rules, verification and decisions of the respective authorities."
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">1. Nature of Our Services</h3>
                <p>
                  Digital India Project (digitalindiaproject.com) is operated by an independent private entity registered under the laws of India. We act strictly as an online technology facilitator and documentation advisory firm. We assist users by preparing, reviewing, formatting, and submitting registration applications on various statutory and commercial portals.
                </p>

                <h3 className="font-bold text-slate-900 dark:text-white text-sm">2. Non-Affiliation with Government Bodies</h3>
                <p>
                  We are not an authorized department or organ of the Government of India, State Governments, or Municipal Corporations. Users can choose to file applications directly on official government portals (e.g. incometax.gov.in, gst.gov.in, udyamregistration.gov.in, foscos.fssai.gov.in) at zero facilitation fee or by paying only applicable statutory fees. Our fee is charged solely for our professional consultancy, document review, and filing support services.
                </p>

                <h3 className="font-bold text-slate-900 dark:text-white text-sm">3. No Guarantee of Approval</h3>
                <p>
                  We do not guarantee or promise the final approval, grant, or issuance of any certificate, license, or registration. The decision to grant or reject an application lies exclusively with the jurisdictional government officer or statutory authority.
                </p>
              </div>
            </div>
          )}

          {/* PRIVACY POLICY */}
          {section === 'privacy' && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-[#FF671F] uppercase tracking-wider">
                Data Protection · Last Updated November 2026
              </span>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                Privacy &amp; Data Protection Policy — Digital India Project
              </h1>

              <p>
                Digital India Project (<strong>https://digitalindiaproject.com</strong>) respects the confidentiality and privacy of every applicant and registered user. This Privacy Policy explains how we collect, store, use, and safeguard personal, business, and Google account data in compliance with the Information Technology Act, 2000, the Digital Personal Data Protection (DPDP) Act, 2023, and the Google API Services User Data Policy.
              </p>

              <h3 className="font-bold text-slate-900 dark:text-white text-sm">1. Information We Collect</h3>
              <p>
                To provide registration assistance and account authentication, we collect information submitted directly by you, including applicant name, father&apos;s/spouse&apos;s name, date of birth, mobile number, email address, residential and business addresses, PAN number, Aadhaar reference (with first 8 digits masked wherever applicable), and supporting KYC/utility documents uploaded for application preparation.
              </p>

              <h3 className="font-bold text-slate-900 dark:text-white text-sm">2. Google Sign-In &amp; Google User Data (OAuth 2.0 Limited Use)</h3>
              <p>
                When you choose to sign in using Google on <strong>https://digitalindiaproject.com</strong>, we request only your basic identity profile (full name, verified email address, and profile avatar) to authenticate your Digital India Project account, prevent unauthorized access, and display your Citizen, Partner, Operator, or Enterprise dashboard.
              </p>
              <p>
                If you explicitly connect optional Google Workspace tools from the Workspace Hub, read/write access (Drive, Gmail, Forms, or Tasks) runs strictly inside your active authenticated session only upon your explicit button action and confirmation. We do <strong>not</strong> sell, rent, or transfer Google user data to third parties, advertisers, data brokers, or unrelated AI training pipelines. Digital India Project&apos;s use and transfer of information received from Google APIs adheres strictly to the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#FF671F] font-semibold hover:underline"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </p>

              <h3 className="font-bold text-slate-900 dark:text-white text-sm">3. Storage, Encryption &amp; Private Cloud Infrastructure</h3>
              <p>
                Uploaded KYC documents and application records are stored within private, encrypted object vaults (Cloudflare R2) and protected databases (Cloudflare D1 &amp; Cloud Firestore). Access is strictly role-governed and restricted to verified operations personnel assigned to your application.
              </p>

              <h3 className="font-bold text-slate-900 dark:text-white text-sm">4. Data Retention, Deletion &amp; Revoking Consent</h3>
              <p>
                You may revoke Google account permissions at any time from your Google Account Security Permissions page or request permanent deletion of your profile and stored documents by emailing{' '}
                <a href="mailto:support@digitalindiaproject.com" className="text-[#FF671F] font-semibold hover:underline">
                  support@digitalindiaproject.com
                </a>{' '}
                or{' '}
                <a href="mailto:allindiadigitalseva@gmail.com" className="text-[#FF671F] font-semibold hover:underline">
                  allindiadigitalseva@gmail.com
                </a>
                . Verified deletion requests are completed within 7 working days, subject to statutory billing/audit retention rules.
              </p>
            </div>
          )}

          {/* TERMS & CONDITIONS */}
          {section === 'terms' && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-[#FF671F] uppercase tracking-wider">
                User Agreement
              </span>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                Terms and Conditions of Service — Digital India Project
              </h1>

              <p>
                By accessing <strong>https://digitalindiaproject.com</strong>, signing in via Google or email credentials, or submitting any service request, you agree to be bound by these Terms and Conditions.
              </p>

              <h3 className="font-bold text-slate-900 dark:text-white text-sm">1. User Representations &amp; Account Security</h3>
              <p>
                You represent and warrant that all information, declarations, and scanned documents supplied by you are true, complete, and legally authentic. You are responsible for maintaining the confidentiality of your account credentials and Google OAuth sessions. Submitting forged, counterfeit, or misleading documents will result in immediate termination of service.
              </p>

              <h3 className="font-bold text-slate-900 dark:text-white text-sm">2. Scope of Facilitation</h3>
              <p>
                Digital India Project agrees to provide application drafting, document audit, and filing assistance as an independent private technology consultancy. Our responsibility concludes upon the submission of your application to the relevant statutory portal and transmission of the official acknowledgment or issued certificate to your dashboard.
              </p>

              <h3 className="font-bold text-slate-900 dark:text-white text-sm">3. Fees, Payments &amp; Statutory Charges</h3>
              <p>
                All service facilitation fees, government statutory charges, and applicable GST are itemized clearly prior to checkout via Cashfree Payments. Refunds are governed strictly by our Refund &amp; Cancellation Policy.
              </p>
            </div>
          )}

          {/* REFUND & CANCELLATION */}
          {section === 'refund' && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-[#FF671F] uppercase tracking-wider">
                Payments Policy
              </span>
              <h1 className="text-2xl font-black text-slate-900">
                Refund & Cancellation Policy
              </h1>

              <p>
                We maintain a transparent and customer-centric refund policy:
              </p>

              <h3 className="font-bold text-slate-900 text-sm">1. Cancellation Prior to Processing</h3>
              <p>
                If a cancellation request is received within 24 hours of payment and our operations desk has not commenced drafting or document verification, you are eligible for a 100% full refund credited back to your original payment source via Cashfree within 5 to 7 working days.
              </p>

              <h3 className="font-bold text-slate-900 dark:text-white text-sm">2. Deductions for Incurred Statutory Charges</h3>
              <p>
                Once an application has been reviewed and filed on official government or Certifying Authority portals, statutory government fees (e.g. PAN card fee of ₹107, DSC crypto-token costs) are non-refundable by the government and cannot be refunded.
              </p>

              <h3 className="font-bold text-slate-900 dark:text-white text-sm">3. Downloadable Digital Products</h3>
              <p>
                Due to the immediate digital nature of downloadable templates, spreadsheets, and startup kits, purchases of downloadable digital products are non-refundable once the file download URL has been accessed, except in cases of duplicate payment or verified technical corruption where a replacement file will be issued promptly.
              </p>
            </div>
          )}

          {/* DATA PROTECTION & SECURITY */}
          {section === 'data-protection' && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-[#FF671F] uppercase tracking-wider">
                DPDP Act, 2023 &amp; Infosec
              </span>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                Data Protection &amp; Information Security Policy
              </h1>

              <p>
                Digital India Project implements technical, organizational, and role-based safeguards aligned with India&apos;s Digital Personal Data Protection (DPDP) Act, 2023 and Section 43A of the Information Technology Act, 2000.
              </p>

              <h3 className="font-bold text-slate-900 dark:text-white text-sm">1. Purpose Limitation &amp; Aadhaar Masking</h3>
              <p>
                Identity numbers and KYC records are collected exclusively to prepare the exact registration, tax return, or compliance filing authorized by the user. Applicants are encouraged to upload Masked Aadhaar copies; full biometric details are never stored on our servers.
              </p>

              <h3 className="font-bold text-slate-900 dark:text-white text-sm">2. Encrypted Storage &amp; RBAC Isolation</h3>
              <p>
                All customer uploads reside in private object buckets (Cloudflare R2) with TLS 1.3 encryption in transit, private signed retrieval routes, and strict role-based access control isolating customer records across Citizen, Partner, Operator, Manager, and Admin scopes.
              </p>

              <h3 className="font-bold text-slate-900 dark:text-white text-sm">3. Breach Notification &amp; Erasure Rights</h3>
              <p>
                You may request export, correction, or erasure of non-statutory personal data at any time via{' '}
                <a href="mailto:support@digitalindiaproject.com" className="text-[#FF671F] font-semibold hover:underline">
                  support@digitalindiaproject.com
                </a>.
              </p>
            </div>
          )}

          {/* DIGITAL PRODUCT POLICY */}
          {section === 'digital-product-policy' && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-[#FF671F] uppercase tracking-wider">
                Templates, Spreadsheets &amp; Toolkits
              </span>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                Digital Product &amp; Licensing Policy
              </h1>

              <p>
                Digital India Project distributes downloadable digital products including GST billing templates, business accounting workbooks, compliance calendars, affidavit formats, resume packs, and startup starter kits.
              </p>

              <h3 className="font-bold text-slate-900 dark:text-white text-sm">1. Single-Entity Usage Licence</h3>
              <p>
                Each digital product purchase grants a non-exclusive, non-transferable single-business/personal licence to edit, customize, and print the files for your internal business or individual use. Public redistribution, commercial resale, or hosting our templates on third-party marketplaces is prohibited unless expressly agreed under an Enterprise/Partner White-Label plan.
              </p>

              <h3 className="font-bold text-slate-900 dark:text-white text-sm">2. Verified Access &amp; Protected Downloads</h3>
              <p>
                Download links are protected by server-side payment and account authorization. After completing Cashfree checkout, your files remain accessible inside your Customer Dashboard under &ldquo;Digital Downloads&rdquo;.
              </p>

              <h3 className="font-bold text-slate-900 dark:text-white text-sm">3. Informational Template Disclaimer</h3>
              <p>
                Legal, HR, and tax templates are standardized drafts provided for operational convenience and do not constitute formal legal or Chartered Accountant representation. Businesses with complex statutory requirements should seek individualized CA/CS/Advocate review.
              </p>
            </div>
          )}

          {/* GRIEVANCE REDRESSAL */}
          {section === 'grievance' && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-[#FF671F] uppercase tracking-wider">
                Customer Escalation
              </span>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                Grievance Redressal Mechanism
              </h1>

              <p>
                In compliance with the Consumer Protection (E-Commerce) Rules, 2020, we have designated a dedicated Grievance Officer to address any service concerns or escalation:
              </p>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5 text-xs">
                <div><strong>Designation:</strong> Grievance Redressal Officer</div>
                <div><strong>Company:</strong> Digital India Project (Private Enterprise)</div>
                <div><strong>GSTIN:</strong> <span className="font-mono font-semibold">26EXIPK0151F1ZQ</span> · <strong>UDYAM:</strong> <span className="font-mono font-semibold">UDYAM-DD-03-0009994</span> · <strong>D-U-N-S:</strong> <span className="font-mono font-semibold">308198649</span></div>
                <div><strong>Address:</strong> Sunflower Building, Nano City, Samarvani, Silvassa, Dadra and Nagar Haveli and Daman and Diu – 396230</div>
                <div><strong>Helpline Phone:</strong> <a href="tel:+917777941227" className="text-[#FF671F] underline">+91 77779 41227</a></div>
                <div><strong>Email:</strong> <a href="mailto:grievance@digitalindiaproject.com" className="text-[#FF671F] underline">grievance@digitalindiaproject.com</a></div>
                <div><strong>Response Window:</strong> Acknowledged within 48 hours; resolved within 30 days.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
