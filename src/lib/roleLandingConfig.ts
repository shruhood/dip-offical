import { UserRole } from '../types';
import { normalizeRole } from './rbac';

export type LandingRoleKey =
  | 'guest'
  | 'customer'
  | 'operator'
  | 'manager'
  | 'partner'
  | 'business'
  | 'admin';

export type GuestAudienceKey = 'customer' | 'partner' | 'operator' | 'business';

export interface RoleToolkitAction {
  id: string;
  title: string;
  titleHi: string;
  description: string;
  descriptionHi: string;
  route: string;
  param?: string;
  featured?: boolean;
  iconName:
    | 'LayoutDashboard'
    | 'FileText'
    | 'FolderLock'
    | 'ReceiptText'
    | 'Clock'
    | 'UserCheck'
    | 'PlusCircle'
    | 'Briefcase'
    | 'Users'
    | 'AlertTriangle'
    | 'BarChart3'
    | 'Handshake'
    | 'Wallet'
    | 'Building2'
    | 'Key'
    | 'FileSpreadsheet'
    | 'Play'
    | 'Settings'
    | 'ShieldAlert'
    | 'Layers';
}

export interface RoleLandingProfile {
  roleKey: LandingRoleKey;
  eyebrow: string;
  eyebrowHi: string;
  headline: string;
  headlineHi: string;
  subheadline: string;
  subheadlineHi: string;
  primaryCta: {
    label: string;
    labelHi: string;
    route: string;
    param?: string;
  };
  secondaryCta: {
    label: string;
    labelHi: string;
    route: string;
    param?: string;
  };
  checklistTitle: string;
  checklistTitleHi: string;
  essentialsChecklist: { en: string; hi: string }[];
  toolkit: RoleToolkitAction[];
}

export interface GuestAudienceProfile {
  key: GuestAudienceKey;
  label: string;
  labelHi: string;
  eyebrow: string;
  eyebrowHi: string;
  headline: string;
  headlineHi: string;
  summary: string;
  summaryHi: string;
  highlights: { label: string; labelHi: string; value: string }[];
  includedNeeds: { title: string; titleHi: string; detail: string; detailHi: string }[];
  onboardingDocs: { en: string; hi: string }[];
  primaryCta: {
    label: string;
    labelHi: string;
    route: string;
    param?: string;
  };
  secondaryCta: {
    label: string;
    labelHi: string;
    route: string;
    param?: string;
  };
}

export const GUEST_AUDIENCE_PROFILES: Record<GuestAudienceKey, GuestAudienceProfile> = {
  customer: {
    key: 'customer',
    label: 'Citizen / Individual',
    labelHi: 'नागरिक / व्यक्तिगत',
    eyebrow: 'SELF-SERVICE CITIZEN DESK',
    eyebrowHi: 'स्व-सेवा नागरिक डेस्क',
    headline: 'File PAN, Aadhaar Updates, Gazette & Registrations Online',
    headlineHi: 'पैन, आधार अपडेट, गजट और पंजीकरण ऑनलाइन जमा करें',
    summary:
      'Guided application forms in English & Hindi, encrypted document storage, transparent fee split, and live status alerts without office visits.',
    summaryHi:
      'अंग्रेजी व हिंदी में आसान फॉर्म, सुरक्षित दस्तावेज़ वॉल्ट, पारदर्शी शुल्क विवरण और लाइव स्टेटस ट्रैकिंग।',
    highlights: [
      { label: 'Service Scope', labelHi: 'सेवा दायरा', value: 'PAN · GST · Udyam · Gazette · FSSAI' },
      { label: 'Fee Policy', labelHi: 'शुल्क नीति', value: 'Clear Govt + Desk Split' },
      { label: 'Payments', labelHi: 'भुगतान', value: 'UPI · NetBanking · Cards' },
    ],
    includedNeeds: [
      {
        title: 'Save & Resume Drafts',
        titleHi: 'ड्राफ्ट सेव व पुनः शुरू करें',
        detail: 'Pause any multi-step application and pick up cleanly from your dashboard.',
        detailHi: 'किसी भी आवेदन को बीच में सेव करके कभी भी पूरा करें।',
      },
      {
        title: 'Encrypted Document Vault',
        titleHi: 'सुरक्षित दस्तावेज़ वॉल्ट',
        detail: 'Upload identity & address proofs once and re-upload corrections inline.',
        detailHi: 'पहचान और पता प्रमाण एक बार अपलोड करें व सुधार सीधे भेजें।',
      },
      {
        title: 'GST Invoices & Certificates',
        titleHi: 'जीएसटी रसीद व प्रमाणपत्र',
        detail: 'Download payment receipts and final issued deliverables in one portal.',
        detailHi: 'पेमेंट रसीद और अंतिम प्रमाणपत्र एक ही पोर्टल से डाउनलोड करें।',
      },
      {
        title: 'Real-Time Application Tracker',
        titleHi: 'लाइव आवेदन ट्रैकर',
        detail: 'Track every stage from submission to authority issuance by DIP ID.',
        detailHi: 'DIP आईडी से हर चरण की लाइव स्थिति देखें।',
      },
    ],
    onboardingDocs: [
      { en: 'Email ID & Active Mobile Number', hi: 'ईमेल आईडी और सक्रिय मोबाइल नंबर' },
      { en: 'Aadhaar / PAN / Address Proof as per service', hi: 'सेवा के अनुसार आधार / पैन / पता प्रमाण' },
      { en: 'UPI / NetBanking for Cashfree checkout', hi: 'भुगतान हेतु यूपीआई / नेटबैंकिंग' },
    ],
    primaryCta: {
      label: 'Create Citizen Account',
      labelHi: 'नागरिक खाता बनाएं',
      route: 'register',
      param: 'customer',
    },
    secondaryCta: {
      label: 'Browse All Services',
      labelHi: 'सभी सेवाएं देखें',
      route: 'services',
    },
  },
  partner: {
    key: 'partner',
    label: 'Partner / Referral Agent',
    labelHi: 'पार्टनर / रेफरल एजेंट',
    eyebrow: 'AUTHORIZED PARTNER NETWORK',
    eyebrowHi: 'अधिकृत पार्टनर नेटवर्क',
    headline: 'Assist Clients in Your Area & Track Automated Commissions',
    headlineHi: 'अपने क्षेत्र के ग्राहकों की मदद करें और कमीशन कमाएं',
    summary:
      'Onboard as an Individual Agent or CSC Franchise Partner. File assisted applications with customer consent, manage client CRM, and request bank payouts.',
    summaryHi:
      'व्यक्तिगत एजेंट या केंद्र पार्टनर के रूप में जुड़ें, ग्राहक सहमति से आवेदन करें और सीधे बैंक पेआउट पाएं।',
    highlights: [
      { label: 'Standard Share', labelHi: 'मानक हिस्सा', value: '15% Service Fee' },
      { label: 'CSC Kendra Tier', labelHi: 'केंद्र टियर', value: '20% Service Fee' },
      { label: 'Settlement Mode', labelHi: 'पेआउट मोड', value: 'Direct Bank / UPI Transfer' },
    ],
    includedNeeds: [
      {
        title: 'Assisted Client Filing Flow',
        titleHi: 'ग्राहक सहायक आवेदन प्रवाह',
        detail: 'Submit applications on behalf of walk-in or referred customers with audit consent.',
        detailHi: 'ग्राहक की सहमति के साथ सीधे आवेदन सबमिट करें।',
      },
      {
        title: 'Dedicated Referral Code & Directory',
        titleHi: 'रेफरल कोड व ग्राहक सूची',
        detail: 'Manage repeat customers and attribute referrals automatically to your ledger.',
        detailHi: 'रेफरल कोड शेयर करें और हर ग्राहक का रिकॉर्ड रखें।',
      },
      {
        title: 'Minor-Currency Commission Ledger',
        titleHi: 'पारदर्शी कमीशन लेजर',
        detail: 'View rule-matched earnings, TDS deductions, and settled payout references.',
        detailHi: 'कमाई, टीडीएस और पेआउट रेफरेंस की सटीक जानकारी देखें।',
      },
      {
        title: 'Live Ticket & Correction Alerts',
        titleHi: 'त्वरित सुधार अलर्ट',
        detail: 'Receive instant notifications whenever an applicant needs document re-upload.',
        detailHi: 'दस्तावेज़ सुधार आवश्यक होने पर तुरंत सूचना पाएं।',
      },
    ],
    onboardingDocs: [
      { en: 'PAN Card & Business / Trade Name', hi: 'पैन कार्ड और व्यवसाय / केंद्र का नाम' },
      { en: 'District, State & PIN Code Details', hi: 'जिला, राज्य और पिन कोड विवरण' },
      { en: 'Bank Account & IFSC for Commission Payouts', hi: 'कमीशन हेतु बैंक खाता व IFSC' },
    ],
    primaryCta: {
      label: 'Join Partner Program',
      labelHi: 'पार्टनर बनें',
      route: 'register',
      param: 'partner',
    },
    secondaryCta: {
      label: 'Open Partner Portal',
      labelHi: 'पार्टनर पोर्टल खोलें',
      route: 'partner',
    },
  },
  operator: {
    key: 'operator',
    label: 'Operator / CSC Center',
    labelHi: 'ऑपरेटर / सुविधा केंद्र',
    eyebrow: 'DISTRICT FACILITATION DESK',
    eyebrowHi: 'जिला सुविधा केंद्र डेस्क',
    headline: 'Operate a Verified Digital Service Desk for Walk-In Citizens',
    headlineHi: 'वॉक-इन नागरिकों के लिए सत्यापित डिजिटल सुविधा केंद्र चलाएं',
    summary:
      'Complete digital KYC verification to process assigned applications, verify identity proofs, issue walk-in receipts, and deliver certificates.',
    summaryHi:
      'KYC सत्यापन पूरा करें, असाइन किए गए आवेदनों की जांच करें और वॉक-इन नागरिकों के लिए आवेदन दर्ज करें।',
    highlights: [
      { label: 'Verification SLA', labelHi: 'सत्यापन लक्ष्य', value: '72h Guided Target' },
      { label: 'Intake Mode', labelHi: 'प्रवेश मोड', value: 'Walk-In + Digital Queue' },
      { label: 'Document QC', labelHi: 'दस्तावेज़ जांच', value: 'Inline Verify / Re-upload' },
    ],
    includedNeeds: [
      {
        title: 'Assigned & Unassigned Work Queue',
        titleHi: 'असाइन व नई कार्य कतार',
        detail: 'Pick pending submissions, check 72h SLA timers, and prioritize urgent cases.',
        detailHi: 'लंबित आवेदन चुनें और समय-सीमा के भीतर पूरा करें।',
      },
      {
        title: 'Inline Document Verification',
        titleHi: 'दस्तावेज़ सत्यापन व सुधार अनुरोध',
        detail: 'Approve clear proofs or trigger customer re-upload requests with remarks.',
        detailHi: 'सही दस्तावेज़ स्वीकृत करें या स्पष्ट टिप्पणी के साथ पुनः अपलोड मांगें।',
      },
      {
        title: 'Walk-In Citizen Intake Desk',
        titleHi: 'वॉक-इन नागरिक पंजीकरण डेस्क',
        detail: 'Register citizens directly at your center counter with instant tracking IDs.',
        detailHi: 'काउंटर पर आए नागरिकों का तुरंत पंजीकरण और रसीद जनरेट करें।',
      },
      {
        title: 'Deliverable Upload & Completion',
        titleHi: 'अंतिम प्रमाणपत्र अपलोड',
        detail: 'Upload issued certificates cleanly to close workflow stages with audit trail.',
        detailHi: 'तैयार प्रमाणपत्र अपलोड करके आवेदन सफलतापूर्वक पूरा करें।',
      },
    ],
    onboardingDocs: [
      { en: 'Operator PAN & Masked Aadhaar Card', hi: 'ऑपरेटर पैन और मास्क्ड आधार कार्ड' },
      { en: 'Center Photograph & District Address', hi: 'केंद्र की फोटो और जिला पता' },
      { en: 'Bank Account Proof for Settlement Verification', hi: 'सत्यापन हेतु बैंक खाता प्रमाण' },
    ],
    primaryCta: {
      label: 'Enroll Operator Center',
      labelHi: 'ऑपरेटर पंजीकरण करें',
      route: 'operator-enroll',
    },
    secondaryCta: {
      label: 'Register Operator Account',
      labelHi: 'ऑपरेटर खाता बनाएं',
      route: 'register',
      param: 'operator',
    },
  },
  business: {
    key: 'business',
    label: 'B2B Enterprise & API',
    labelHi: 'B2B एंटरप्राइज व API',
    eyebrow: 'ENTERPRISE KYB & API SETU',
    eyebrowHi: 'एंटरप्राइज KYB और API सेतु',
    headline: 'Verify GSTIN, PAN & Udyam in Bulk + Managed Corporate Filings',
    headlineHi: 'बल्क में GSTIN, PAN, Udyam सत्यापन और कॉर्पोरेट सेवाएं',
    summary:
      'Built for CA firms, fintech onboarding teams, and registered companies requiring API playground testing, CSV bulk verification, and GST compliance filings.',
    summaryHi:
      'CA फर्म, फिनटेक टीम और कंपनियों के लिए बल्क CSV सत्यापन, API प्लेग्राउंड और कॉर्पोरेट अनुपालन।',
    highlights: [
      { label: 'API Endpoints', labelHi: 'API एंडपॉइंट', value: 'GSTIN · PAN · Udyam · MCA' },
      { label: 'Bulk Processing', labelHi: 'बल्क प्रोसेसिंग', value: 'CSV Batch Verification' },
      { label: 'Compliance', labelHi: 'अनुपालन', value: 'GSTIN 26EXIPK0151F1ZQ Ready' },
    ],
    includedNeeds: [
      {
        title: 'Live API Setu Playground',
        titleHi: 'लाइव API सेतु प्लेग्राउंड',
        detail: 'Test real-time GSTIN, PAN, and Udyam verification payloads directly in browser.',
        detailHi: 'ब्राउज़र से सीधे GSTIN, PAN और Udyam सत्यापन टेस्ट करें।',
      },
      {
        title: 'Bulk CSV Batch Processor',
        titleHi: 'बल्क CSV वेरिफिकेशन',
        detail: 'Upload vendor or merchant spreadsheets and export clean verification reports.',
        detailHi: 'वेंडर डेटा CSV अपलोड करें और सत्यापन रिपोर्ट डाउनलोड करें।',
      },
      {
        title: 'API Keys & Webhook Secrets',
        titleHi: 'API कुंजी व वेबहुक',
        detail: 'Manage sandbox/production keys and inspect authenticated audit logs.',
        detailHi: 'API कुंजी प्रबंधित करें और ऑडिट लॉग ट्रैक करें।',
      },
      {
        title: 'Managed B2B Compliance Orders',
        titleHi: 'कॉर्पोरेट पंजीकरण ऑर्डर',
        detail: 'Initiate GST, FSSAI, Shop Act, and Company filings for branch offices.',
        detailHi: 'कंपनी शाखाओं के लिए GST, FSSAI और शॉप एक्ट आवेदन करें।',
      },
    ],
    onboardingDocs: [
      { en: 'Registered Company / Firm Legal Name', hi: 'पंजीकृत कंपनी / फर्म का नाम' },
      { en: 'Official Work Email & Authorized Signatory Contact', hi: 'आधिकारिक ईमेल व संपर्क नंबर' },
      { en: 'GSTIN / Incorporation Proof for Production API Quota', hi: 'उत्पादन API हेतु GSTIN / निगमन प्रमाण' },
    ],
    primaryCta: {
      label: 'Open Business Account',
      labelHi: 'बिज़नेस खाता खोलें',
      route: 'register',
      param: 'business',
    },
    secondaryCta: {
      label: 'Explore Enterprise Portal',
      labelHi: 'एंटरप्राइज पोर्टल देखें',
      route: 'b2b',
    },
  },
};

const ROLE_LANDING_PROFILES: Record<Exclude<LandingRoleKey, 'guest'>, RoleLandingProfile> = {
  customer: {
    roleKey: 'customer',
    eyebrow: 'CITIZEN PORTAL · PERSONAL WORKSPACE',
    eyebrowHi: 'नागरिक पोर्टल · व्यक्तिगत कार्यक्षेत्र',
    headline: 'Everything You Need for Your Applications & Certificates',
    headlineHi: 'आपके आवेदनों और प्रमाणपत्रों के लिए हर आवश्यक सुविधा',
    subheadline:
      'Resume saved drafts, respond to document requests, download GST invoices, and start new digital registrations from one personal desk.',
    subheadlineHi:
      'सेव किए गए ड्राफ्ट पूरे करें, दस्तावेज़ अपलोड करें, जीएसटी रसीद डाउनलोड करें और नया आवेदन शुरू करें।',
    primaryCta: {
      label: 'Open My Dashboard',
      labelHi: 'मेरा डैशबोर्ड खोलें',
      route: 'dashboard',
      param: 'overview',
    },
    secondaryCta: {
      label: 'Browse Services',
      labelHi: 'सेवाएं देखें',
      route: 'services',
    },
    checklistTitle: 'Your Citizen Action Checklist',
    checklistTitleHi: 'नागरिक कार्य सूची',
    essentialsChecklist: [
      { en: 'Review applications marked Documents or Correction Required', hi: 'लंबित दस्तावेज़ सुधार अनुरोधों की जांच करें' },
      { en: 'Resume any partially filled drafts before starting fresh filings', hi: 'अधूरे सेव किए गए ड्राफ्ट को पहले पूरा करें' },
      { en: 'Keep Aadhaar, PAN & latest address proof ready in Document Vault', hi: 'दस्तावेज़ वॉल्ट में आधार, पैन व पता प्रमाण तैयार रखें' },
    ],
    toolkit: [
      {
        id: 'cust-overview',
        title: 'Citizen Command Overview',
        titleHi: 'नागरिक डैशबोर्ड अवलोकन',
        description: 'Live status counters, saved drafts, and notifications in one view.',
        descriptionHi: 'लाइव स्थिति, ड्राफ्ट और सूचनाएं एक ही स्थान पर।',
        route: 'dashboard',
        param: 'overview',
        featured: true,
        iconName: 'LayoutDashboard',
      },
      {
        id: 'cust-apps',
        title: 'My Applications',
        titleHi: 'मेरे आवेदन',
        description: 'Inspect stage timeline, remarks, and download issued certificates.',
        descriptionHi: 'आवेदन चरण और अंतिम प्रमाणपत्र देखें।',
        route: 'dashboard',
        param: 'applications',
        iconName: 'FileText',
      },
      {
        id: 'cust-docs',
        title: 'Document Vault & Re-Upload',
        titleHi: 'दस्तावेज़ वॉल्ट',
        description: 'Securely store proofs and submit requested corrections directly.',
        descriptionHi: 'दस्तावेज़ सुरक्षित रखें व सुधार अपलोड करें।',
        route: 'dashboard',
        param: 'documents',
        iconName: 'FolderLock',
      },
      {
        id: 'cust-payments',
        title: 'Payments & GST Receipts',
        titleHi: 'भुगतान व जीएसटी रसीद',
        description: 'Download itemized fee receipts and request eligible refunds.',
        descriptionHi: 'फीस रसीद डाउनलोड करें व रिफंड ट्रैक करें।',
        route: 'dashboard',
        param: 'payments',
        iconName: 'ReceiptText',
      },
      {
        id: 'cust-track',
        title: 'Track by DIP ID',
        titleHi: 'DIP आईडी से ट्रैक करें',
        description: 'Check live SLA progress for any portal or center-filed submission.',
        descriptionHi: 'किसी भी आवेदन की लाइव स्थिति जांचें।',
        route: 'track',
        iconName: 'Clock',
      },
      {
        id: 'cust-support',
        title: 'Support Tickets',
        titleHi: 'सहायता टिकट',
        description: 'Message operations staff directly in English or Hindi.',
        descriptionHi: 'सहायता टीम से सीधे संवाद करें।',
        route: 'dashboard',
        param: 'support',
        iconName: 'Briefcase',
      },
    ],
  },
  operator: {
    roleKey: 'operator',
    eyebrow: 'OPERATOR WORKBENCH · WALK-IN & VERIFICATION DESK',
    eyebrowHi: 'ऑपरेटर कार्यक्षेत्र · वॉक-इन और सत्यापन डेस्क',
    headline: 'Process Citizen Queues, Verify Proofs & Register Walk-Ins',
    headlineHi: 'नागरिक कतार, दस्तावेज़ सत्यापन और वॉक-इन पंजीकरण प्रबंधित करें',
    subheadline:
      'All intake tools, verification controls, KYC compliance status, and workspace resources organized for your facilitation center.',
    subheadlineHi:
      'आपके सुविधा केंद्र के लिए सभी आवेदन, दस्तावेज़ जांच और KYC अनुपालन उपकरण एक साथ।',
    primaryCta: {
      label: 'Open Operator Desk',
      labelHi: 'ऑपरेटर डेस्क खोलें',
      route: 'operator',
      param: 'queue',
    },
    secondaryCta: {
      label: 'Start Walk-In Intake',
      labelHi: 'वॉक-इन आवेदन शुरू करें',
      route: 'operator',
      param: 'intake',
    },
    checklistTitle: 'Operator Shift Checklist',
    checklistTitleHi: 'ऑपरेटर कार्य सूची',
    essentialsChecklist: [
      { en: 'Verify uploaded identity proofs cleanly before moving status to Processing', hi: 'प्रोसेसिंग से पहले सभी पहचान दस्तावेज़ों की स्पष्ट जांच करें' },
      { en: 'Prioritize applications approaching or exceeding the 72h SLA window', hi: '72 घंटे की समय-सीमा के करीब आवेदनों को प्राथमिकता दें' },
      { en: 'Ensure Operator Center KYC remains Approved to access full intake queues', hi: 'पूर्ण कार्य कतार हेतु अपना ऑपरेटर KYC स्वीकृत रखें' },
    ],
    toolkit: [
      {
        id: 'op-queue',
        title: 'Active Processing Queue',
        titleHi: 'सक्रिय कार्य कतार',
        description: 'Filter assigned & unassigned applications, verify docs, and update stages.',
        descriptionHi: 'असाइन आवेदनों की जांच व चरण अपडेट करें।',
        route: 'operator',
        param: 'queue',
        featured: true,
        iconName: 'FileText',
      },
      {
        id: 'op-intake',
        title: 'Walk-In Citizen Intake',
        titleHi: 'वॉक-इन नागरिक पंजीकरण',
        description: 'Capture citizen form details and proof directly at your desk.',
        descriptionHi: 'केंद्र काउंटर से तुरंत नया आवेदन दर्ज करें।',
        route: 'operator',
        param: 'intake',
        iconName: 'PlusCircle',
      },
      {
        id: 'op-kyc',
        title: 'My Operator KYC Status',
        titleHi: 'मेरा ऑपरेटर KYC',
        description: 'View center approval remarks, PAN/Aadhaar status, or update bank proof.',
        descriptionHi: 'अपनी KYC स्थिति और केंद्र विवरण देखें।',
        route: 'operator-enroll',
        iconName: 'UserCheck',
      },
      {
        id: 'op-services',
        title: 'Service Fee & Doc Checklists',
        titleHi: 'सेवा शुल्क व दस्तावेज़ सूची',
        description: 'Reference exact govt fees and required documents for walk-in queries.',
        descriptionHi: 'ग्राहकों को सटीक शुल्क और आवश्यक दस्तावेज़ बताएं।',
        route: 'services',
        iconName: 'Layers',
      },
      {
        id: 'op-workspace',
        title: 'Workspace Productivity Hub',
        titleHi: 'वर्कस्पेस हब',
        description: 'Access connected operational files, mail, and center calendar tools.',
        descriptionHi: 'कनेक्टेड फाइल्स, ईमेल और शेड्यूल टूल्स खोलें।',
        route: 'workspace',
        iconName: 'Briefcase',
      },
      {
        id: 'op-track',
        title: 'Public Status Lookup',
        titleHi: 'स्टेटस लुकअप',
        description: 'Quickly verify receipt status for walk-in applicants by DIP ID.',
        descriptionHi: 'DIP आईडी से तुरंत आवेदन स्थिति जांचें।',
        route: 'track',
        iconName: 'Clock',
      },
    ],
  },
  manager: {
    roleKey: 'manager',
    eyebrow: 'OPERATIONS COMMAND · SLA & TEAM GOVERNANCE',
    eyebrowHi: 'ऑपरेशंस कमांड · SLA और टीम प्रबंधन',
    headline: 'Balance Operator Workloads, Clear Overdue SLAs & Audit Teams',
    headlineHi: 'कार्यभार संतुलित करें, SLA अलर्ट हल करें और टीम का ऑडिट करें',
    subheadline:
      'Monitor unassigned bottlenecks across centers, bulk-assign dossiers to approved operators, oversee partner approvals, and resolve escalations.',
    subheadlineHi:
      'सभी केंद्रों के लंबित आवेदनों की निगरानी करें, ऑपरेटर आवंटित करें और एस्केलेशन हल करें।',
    primaryCta: {
      label: 'Open SLA Queue',
      labelHi: 'SLA कतार खोलें',
      route: 'manager',
      param: 'sla',
    },
    secondaryCta: {
      label: 'Assign Operators',
      labelHi: 'ऑपरेटर आवंटित करें',
      route: 'manager',
      param: 'assign',
    },
    checklistTitle: 'Manager Operations Priorities',
    checklistTitleHi: 'मैनेजर प्राथमिकता सूची',
    essentialsChecklist: [
      { en: 'Assign unassigned applications before the 72-hour SLA deadline breaches', hi: '72 घंटे की SLA सीमा से पहले अनअसाइन आवेदन आवंटित करें' },
      { en: 'Monitor active operator load balance across districts', hi: 'विभिन्न जिलों में ऑपरेटर कार्यभार की जांच करें' },
      { en: 'Respond to escalated support tickets and review partner submissions', hi: 'एस्केलेटेड टिकट व पार्टनर आवेदनों की समीक्षा करें' },
    ],
    toolkit: [
      {
        id: 'mgr-sla',
        title: 'SLA & Escalation Monitor',
        titleHi: 'SLA और एस्केलेशन मॉनिटर',
        description: 'Spot overdue submissions first and advance stalled application stages.',
        descriptionHi: 'समय-सीमा पार आवेदनों को पहले पहचानें व आगे बढ़ाएं।',
        route: 'manager',
        param: 'sla',
        featured: true,
        iconName: 'AlertTriangle',
      },
      {
        id: 'mgr-assign',
        title: 'Bulk Operator Assignment',
        titleHi: 'बल्क ऑपरेटर आवंटन',
        description: 'Route unassigned backlog dossiers to Approved KYC operators.',
        descriptionHi: 'लंबित आवेदनों को सत्यापित ऑपरेटरों को सौंपें।',
        route: 'manager',
        param: 'assign',
        iconName: 'Users',
      },
      {
        id: 'mgr-partners',
        title: 'Partner Network Oversight',
        titleHi: 'पार्टनर नेटवर्क निगरानी',
        description: 'Inspect partner approval pipelines and assisted submission quality.',
        descriptionHi: 'पार्टनर आवेदन गुणवत्ता और अनुमोदन की जांच करें।',
        route: 'manager',
        param: 'partners',
        iconName: 'Handshake',
      },
      {
        id: 'mgr-tickets',
        title: 'Customer Escalation Tickets',
        titleHi: 'ग्राहक सहायता टिकट',
        description: 'Resolve flagged support queries directly with audit remarks.',
        descriptionHi: 'ग्राहक सहायता प्रश्नों का समाधान दर्ज करें।',
        route: 'manager',
        param: 'tickets',
        iconName: 'FileText',
      },
      {
        id: 'mgr-reports',
        title: 'Channel & SLA Analytics',
        titleHi: 'चैनल व SLA रिपोर्ट्स',
        description: 'Break down volume by Web B2C, Operator, Partner, and B2B.',
        descriptionHi: 'हर चैनल के प्रदर्शन और पूर्णता दर की रिपोर्ट देखें।',
        route: 'manager',
        param: 'reports',
        iconName: 'BarChart3',
      },
      {
        id: 'mgr-opdesk',
        title: 'Operator Processing Desk',
        titleHi: 'ऑपरेटर डेस्क प्रीव्यू',
        description: 'Step into direct document QC whenever escalation support is needed.',
        descriptionHi: 'आवश्यक होने पर सीधे दस्तावेज़ सत्यापन करें।',
        route: 'operator',
        param: 'queue',
        iconName: 'UserCheck',
      },
    ],
  },
  partner: {
    roleKey: 'partner',
    eyebrow: 'PARTNER CONSOLE · ASSISTED FILING & PAYOUTS',
    eyebrowHi: 'पार्टनर कंसोल · सहायक आवेदन व पेआउट',
    headline: 'File for Clients, Share Your Referral Code & Settle Commissions',
    headlineHi: 'ग्राहकों के लिए आवेदन करें, रेफरल साझा करें और कमीशन प्राप्त करें',
    subheadline:
      'Complete partner onboarding, maintain your customer book, submit assisted applications with digital consent, and withdraw verified earnings.',
    subheadlineHi:
      'पार्टनर केवाईसी पूरा करें, ग्राहक जोड़ें और सत्यापित कमीशन बैंक में ट्रांसफर करें।',
    primaryCta: {
      label: 'Open Partner Desk',
      labelHi: 'पार्टनर डेस्क खोलें',
      route: 'partner',
      param: 'overview',
    },
    secondaryCta: {
      label: 'Open Commission Wallet',
      labelHi: 'कमीशन वॉलेट खोलें',
      route: 'partner',
      param: 'wallet',
    },
    checklistTitle: 'Partner Growth & Payout Checklist',
    checklistTitleHi: 'पार्टनर कार्य सूची',
    essentialsChecklist: [
      { en: 'Submit PAN, district, and bank IFSC onboarding if KYC is still pending', hi: 'यदि KYC बाकी है तो पैन व बैंक विवरण दर्ज करें' },
      { en: 'Record explicit applicant consent for every assisted application', hi: 'हर सहायक आवेदन में ग्राहक की सहमति अवश्य दर्ज करें' },
      { en: 'Track settled commission ledger entries before initiating payout requests', hi: 'निकासी से पहले कमीशन लेजर की जांच करें' },
    ],
    toolkit: [
      {
        id: 'part-overview',
        title: 'Partner Overview & Onboarding',
        titleHi: 'पार्टनर अवलोकन व केवाईसी',
        description: 'Check approval status, copy referral code, and view active commission tiers.',
        descriptionHi: 'रेफरल कोड कॉपी करें और स्वीकृति स्थिति देखें।',
        route: 'partner',
        param: 'overview',
        featured: true,
        iconName: 'Handshake',
      },
      {
        id: 'part-customers',
        title: 'My Customer Directory',
        titleHi: 'मेरे ग्राहक',
        description: 'Add walk-in or referred citizens and launch assisted filings in one click.',
        descriptionHi: 'ग्राहकों का विवरण सहेजें और तुरंत आवेदन शुरू करें।',
        route: 'partner',
        param: 'customers',
        iconName: 'Users',
      },
      {
        id: 'part-apps',
        title: 'Assisted Applications Tracker',
        titleHi: 'सहायक आवेदन स्थिति',
        description: 'Monitor approval progress and respond quickly to document re-upload alerts.',
        descriptionHi: 'ग्राहकों के आवेदनों की लाइव स्थिति देखें।',
        route: 'partner',
        param: 'applications',
        iconName: 'FileText',
      },
      {
        id: 'part-wallet',
        title: 'Commission Wallet & Settlements',
        titleHi: 'कमीशन वॉलेट व निकासी',
        description: 'Review TDS-adjusted earnings ledger and submit bank payout requests.',
        descriptionHi: 'कमाई का विवरण देखें और बैंक ट्रांसफर अनुरोध भेजें।',
        route: 'partner',
        param: 'wallet',
        iconName: 'Wallet',
      },
      {
        id: 'part-notifs',
        title: 'Partner Alerts & Updates',
        titleHi: 'पार्टनर सूचनाएं',
        description: 'Stay updated on KYC review outcomes and payout UTR confirmations.',
        descriptionHi: 'KYC और पेआउट की सभी ताज़ा सूचनाएं देखें।',
        route: 'partner',
        param: 'notifications',
        iconName: 'AlertTriangle',
      },
      {
        id: 'part-services',
        title: 'Service Catalog & Commission Fit',
        titleHi: 'सेवा सूची व शुल्क',
        description: 'Browse all supported citizen and business services with exact pricing.',
        descriptionHi: 'सभी सेवाओं की शुल्क सूची देखें।',
        route: 'services',
        iconName: 'Layers',
      },
    ],
  },
  business: {
    roleKey: 'business',
    eyebrow: 'B2B ENTERPRISE CONSOLE · KYB & API SETU',
    eyebrowHi: 'B2B एंटरप्राइज कंसोल · KYB और API सेतु',
    headline: 'Run Real-Time Verifications, Bulk CSV Checks & Corporate Filings',
    headlineHi: 'रियल-टाइम सत्यापन, बल्क CSV जांच और कॉर्पोरेट आवेदन चलाएं',
    subheadline:
      'Access the interactive GSTIN/PAN/Udyam API Playground, run CSV verification jobs, manage API keys, and submit managed enterprise compliance orders.',
    subheadlineHi:
      'API प्लेग्राउंड में GSTIN/PAN/Udyam जांचें, बल्क CSV चलाएं और कंपनी पंजीकरण सबमिट करें।',
    primaryCta: {
      label: 'Open B2B Console',
      labelHi: 'B2B कंसोल खोलें',
      route: 'b2b',
      param: 'overview',
    },
    secondaryCta: {
      label: 'Launch API Playground',
      labelHi: 'API प्लेग्राउंड खोलें',
      route: 'b2b',
      param: 'playground',
    },
    checklistTitle: 'Enterprise Readiness Checklist',
    checklistTitleHi: 'एंटरप्राइज कार्य सूची',
    essentialsChecklist: [
      { en: 'Test GSTIN, PAN, and Udyam API Setu endpoints inside the browser playground', hi: 'प्लेग्राउंड में GSTIN, PAN व Udyam API टेस्ट करें' },
      { en: 'Upload properly formatted CSV files for bulk vendor KYB checks', hi: 'बल्क जांच हेतु सही फॉर्मेट वाली CSV अपलोड करें' },
      { en: 'Keep API keys and webhook secrets rotated and restricted to production hosts', hi: 'API कुंजी व वेबहुक सीक्रेट सुरक्षित रखें' },
    ],
    toolkit: [
      {
        id: 'b2b-overview',
        title: 'Enterprise Order & KYB Overview',
        titleHi: 'एंटरप्राइज ऑर्डर अवलोकन',
        description: 'Initiate B2B compliance filings and view corporate account readiness.',
        descriptionHi: 'कंपनी अनुपालन ऑर्डर शुरू करें और खाता स्थिति देखें।',
        route: 'b2b',
        param: 'overview',
        featured: true,
        iconName: 'Building2',
      },
      {
        id: 'b2b-playground',
        title: 'API Setu Live Playground',
        titleHi: 'API सेतु प्लेग्राउंड',
        description: 'Verify GSTIN, PAN, and Udyam entities with structured JSON response preview.',
        descriptionHi: 'GSTIN, PAN और Udyam का लाइव सत्यापन करें।',
        route: 'b2b',
        param: 'playground',
        iconName: 'Play',
      },
      {
        id: 'b2b-bulk',
        title: 'Bulk CSV Batch Verify',
        titleHi: 'बल्क CSV वेरिफिकेशन',
        description: 'Process high-volume vendor lists and download verified batch results.',
        descriptionHi: 'बल्क वेंडर डेटा अपलोड कर परिणाम डाउनलोड करें।',
        route: 'b2b',
        param: 'bulk',
        iconName: 'FileSpreadsheet',
      },
      {
        id: 'b2b-keys',
        title: 'API Keys & Webhook Security',
        titleHi: 'API कुंजी व वेबहुक',
        description: 'Inspect credentials, webhook URL configuration, and rotation controls.',
        descriptionHi: 'API कुंजी और वेबहुक सेटिंग्स देखें।',
        route: 'b2b',
        param: 'apikeys',
        iconName: 'Key',
      },
      {
        id: 'b2b-history',
        title: 'Verification Audit Logs',
        titleHi: 'वेरिफिकेशन ऑडिट लॉग',
        description: 'Trace request timestamps, entity identifiers, and status codes.',
        descriptionHi: 'सभी API अनुरोधों का रिकॉर्ड देखें।',
        route: 'b2b',
        param: 'history',
        iconName: 'FileText',
      },
      {
        id: 'b2b-services',
        title: 'Business Compliance Catalog',
        titleHi: 'बिज़नेस सेवा सूची',
        description: 'Browse GST, Company Incorporation, Trademark, IEC & FSSAI services.',
        descriptionHi: 'GST, कंपनी निगमन, ट्रेडमार्क और FSSAI सेवाएं देखें।',
        route: 'services',
        param: 'business-registration',
        iconName: 'Layers',
      },
    ],
  },
  admin: {
    roleKey: 'admin',
    eyebrow: 'SUPER ADMIN CONTROL PLANE · DIGITAL INDIA PROJECT',
    eyebrowHi: 'सुपर एडमिन कंट्रोल पैनल · डिजिटल इंडिया प्रोजेक्ट',
    headline: 'Govern Multi-Channel Operations, KYC Approvals, Catalog & Tax',
    headlineHi: 'सभी चैनल, KYC अनुमोदन, सेवा कैटलॉग और टैक्स सेटिंग्स नियंत्रित करें',
    subheadline:
      'Central command for operator & partner onboarding, commission & refund settlements, dynamic JSON form schemas, RBAC permissions, and verified business settings.',
    subheadlineHi:
      'ऑपरेटर/पार्टनर स्वीकृति, कमीशन सेटलमेंट, सेवा फॉर्म बिल्डर और जीएसटी सेटिंग्स का पूर्ण नियंत्रण।',
    primaryCta: {
      label: 'Open Admin Console',
      labelHi: 'एडमिन कंसोल खोलें',
      route: 'admin',
      param: 'overview',
    },
    secondaryCta: {
      label: 'Review Pending Applications',
      labelHi: 'आवेदन कतार देखें',
      route: 'admin',
      param: 'applications',
    },
    checklistTitle: 'Administrator Governance Checklist',
    checklistTitleHi: 'एडमिन कार्य सूची',
    essentialsChecklist: [
      { en: 'Approve or reject queued Operator & Partner KYC dossiers promptly', hi: 'लंबित ऑपरेटर व पार्टनर KYC की समीक्षा करें' },
      { en: 'Audit Settlement & Refund queues with UTR payout references', hi: 'UTR संदर्भ के साथ पेआउट व रिफंड कतार सत्यापित करें' },
      { en: 'Keep GSTIN 26EXIPK0151F1ZQ, UDYAM & D-U-N-S synced in Settings', hi: 'सेटिंग्स में GSTIN, UDYAM और D-U-N-S विवरण अद्यतन रखें' },
    ],
    toolkit: [
      {
        id: 'adm-overview',
        title: 'Platform Operations Overview',
        titleHi: 'प्लेटफॉर्म अवलोकन',
        description: 'Real-time metrics across Web, Operator, Partner, and B2B intake channels.',
        descriptionHi: 'सभी चैनलों के लाइव आंकड़े और राजस्व सारांश।',
        route: 'admin',
        param: 'overview',
        featured: true,
        iconName: 'ShieldAlert',
      },
      {
        id: 'adm-apps',
        title: 'All Channel Applications',
        titleHi: 'सभी आवेदन प्रबंधित करें',
        description: 'Assign operators, advance workflow stages, and review uploaded proofs.',
        descriptionHi: 'ऑपरेटर आवंटित करें व आवेदन स्थिति अपडेट करें।',
        route: 'admin',
        param: 'applications',
        iconName: 'FileText',
      },
      {
        id: 'adm-kyc',
        title: 'Operators & Partners KYC',
        titleHi: 'ऑपरेटर व पार्टनर KYC',
        description: 'Review identity/bank proofs, set commission rules, and process payouts.',
        descriptionHi: 'KYC स्वीकृत करें, कमीशन नियम बनाएं और पेआउट दें।',
        route: 'admin',
        param: 'operators',
        iconName: 'UserCheck',
      },
      {
        id: 'adm-services',
        title: 'Services & Dynamic Form Builder',
        titleHi: 'सेवा और फॉर्म बिल्डर',
        description: 'Publish new services, configure fees, and design 16-type conditional schemas.',
        descriptionHi: 'नई सेवाएं जोड़ें व डायनामिक फॉर्म संपादित करें।',
        route: 'admin',
        param: 'services',
        iconName: 'Layers',
      },
      {
        id: 'adm-settings',
        title: 'Settings, RBAC & Integrations',
        titleHi: 'सेटिंग्स, RBAC व इंटीग्रेशन',
        description: 'Configure GST/Udyam/DUNS invoicing, role permissions, Cashfree & AI keys.',
        descriptionHi: 'टैक्स सेटिंग्स, भूमिका अनुमति और पेमेंट गेटवे जांचें।',
        route: 'admin',
        param: 'settings',
        iconName: 'Settings',
      },
      {
        id: 'adm-workspace',
        title: 'Workspace Hub & SLA Desk',
        titleHi: 'वर्कस्पेस और SLA डेस्क',
        description: 'Jump directly into Workspace tools or Manager SLA escalations.',
        descriptionHi: 'वर्कस्पेस टूल्स या मैनेजर SLA डेस्क खोलें।',
        route: 'workspace',
        iconName: 'Briefcase',
      },
    ],
  },
};

export function getLandingProfileForRole(
  role?: UserRole | string | null,
  isAuthenticated: boolean = false
): RoleLandingProfile | null {
  if (!isAuthenticated || !role) {
    return null;
  }
  const normalized = normalizeRole(role);
  if (normalized === 'super_admin' || normalized === 'admin') {
    return ROLE_LANDING_PROFILES.admin;
  }
  return ROLE_LANDING_PROFILES[normalized] || ROLE_LANDING_PROFILES.customer;
}
