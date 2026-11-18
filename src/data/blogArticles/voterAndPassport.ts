import { BlogPost } from '../../types';

export const VOTER_AND_PASSPORT_BLOGS: BlogPost[] = [
  // ==========================================
  // 3. VOTER ID CARD — ARTICLES 21 TO 28
  // Official Portal: https://voters.eci.gov.in/
  // ==========================================
  {
    id: 'blog-021-apply-new-voter-id-online',
    slug: 'how-to-apply-for-a-new-voter-id-card-online',
    title: 'How to Apply for a New Voter ID Card Online',
    titleHi: 'नए वोटर आईडी कार्ड (Form 6) के लिए ऑनलाइन आवेदन कैसे करें',
    excerpt:
      'Step-by-step ECI Form 6 registration guide on voters.eci.gov.in for Indian citizens aged 18+—including required documents, EPIC tracking, and free card dispatch.',
    excerptHi:
      'voters.eci.gov.in पर फॉर्म 6 भरकर नया मतदाता पहचान पत्र बनवाने, दस्तावेज़ अपलोड करने और मुफ्त कार्ड पाने की पूरी प्रक्रिया।',
    content: `## Who Can Apply Using Form 6
Under Election Commission of India (ECI) rules, any Indian citizen who has attained **18 years of age** on the qualifying date (**1st January, 1st April, 1st July, or 1st October**) and ordinarily resides in an assembly constituency can apply for fresh enrolment using **Form 6** at zero fee.

## Required Documents for Form 6
- **One Passport-Size Color Photograph** (white/light background, clear front face)
- **Age Proof (if aged 18–21):** Birth Certificate, Aadhaar Card, PAN Card, Driving Licence, Class 10/12 Marksheet, or Indian Passport
- **Ordinary Residence Proof:** Electricity/Water/Gas Bill (at least 1 year old or latest), Aadhaar Card, Current Bank/Post Office Passbook, Passport, or Registered Rent/Sale Deed

## Step-by-Step Online Application on Voters' Service Portal
1. Visit the official ECI portal at https://voters.eci.gov.in/ and click **Sign Up** (or **Login**) using your active mobile number and OTP.
2. Select **New Registration for General Electors → Fill Form 6**.
3. Choose your **State, District, and Assembly/Parliamentary Constituency**.
4. Enter personal details (First Name, Surname, Relative's Name & Relationship Type—Father/Mother/Husband), Gender, Mobile, and Aadhaar (optional but speeds linkage).
5. Enter your complete present ordinary residence address, upload self-attested Age & Address proofs plus your photograph, and complete the declaration that you are not already enrolled in any other constituency.
6. Verify the **Form 6 Preview** carefully and click **Submit** to receive your unique **Reference ID** (e.g., *S12345678901234*).

## Verification & Card Delivery Timeline
A Booth Level Officer (**BLO**) typically verifies your residence within **15 to 30 days**. Upon approval by the Electoral Registration Officer (ERO), your **EPIC Number** is generated and the PVC Voter ID dispatches free via India Post Speed Post.`,
    category: 'Voter ID Card',
    tags: ['Voter ID', 'Form 6', 'ECI Portal', 'New Elector'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Citizen Services Advisor',
    publishedAt: '2026-10-30T10:00:00Z',
    updatedAt: '2026-10-30T10:00:00Z',
    readingTimeMinutes: 4,
    relatedServiceSlug: 'digilocker-document-retrieval',
    seoTitle: 'Apply for New Voter ID Card Online (Form 6) — ECI Guide',
    seoDescription:
      'Learn how to apply for a new Voter ID card online via https://voters.eci.gov.in/ Form 6, required age & residence proofs, BLO check, and free EPIC dispatch.',
    focusKeyword: 'new Voter ID card online',
    faqItems: [
      {
        question: 'What are the four qualifying dates for new Voter ID eligibility?',
        answer:
          'ECI recognizes 1st January, 1st April, 1st July, and 1st October each year—so citizens turning 18 during the year do not need to wait until the next January.',
      },
      {
        question: 'Is there any fee for Form 6 Voter ID registration?',
        answer:
          'No. Filing Form 6 on https://voters.eci.gov.in/ and receiving your physical EPIC card via post are completely free of charge.',
      },
    ],
  },
  {
    id: 'blog-022-download-digital-voter-id-e-epic',
    slug: 'how-to-download-digital-voter-id-e-epic',
    title: 'How to Download Digital Voter ID (e-EPIC)',
    titleHi: 'डिजिटल वोटर आईडी कार्ड (e-EPIC) ऑनलाइन डाउनलोड कैसे करें',
    excerpt:
      'Download the official QR-secured digital e-EPIC PDF from voters.eci.gov.in using your EPIC Number or Form Reference Number—and link a missing mobile via Form 8.',
    excerptHi:
      'EPIC नंबर या रेफरेंस नंबर की सहायता से आधिकारिक डिजिटल वोटर आईडी (e-EPIC PDF) तुरंत डाउनलोड करने की सरल प्रक्रिया जानें।',
    content: `## Legal Status of Digital e-EPIC
The **e-EPIC** (Electronic Electoral Photo Identity Card) is an official, non-editable, tamper-proof PDF version of your Voter ID carrying two digitally signed QR codes (serial/part metadata and encrypted demographic details). It is valid at polling booths and KYC counters nationwide.

## Prerequisites for Instant Download
- Your **EPIC Number** (10-character Voter ID code) or your recent **Form 6 Reference Number**
- A **unique mobile number linked to your electoral roll entry** (for OTP security)

## Step-by-Step e-EPIC Download Steps
1. Visit https://voters.eci.gov.in/ and log into your registered citizen account.
2. Click **e-EPIC Download** on the dashboard.
3. Choose **EPIC Number** or **Form Reference Number**, select your **State**, enter the number carefully, and click **Search**.
4. Confirm your displayed Elector Name, Relative Name, and Assembly Constituency, then click **Send OTP**.
5. Enter the 6-digit OTP received on your registered mobile number and click **Download e-EPIC** to save the official PDF immediately.

## What If Portal Says "Mobile Number Not Registered / Not Unique"?
If no mobile number is linked—or the same mobile number is shared by multiple family members—you cannot download e-EPIC directly until a unique mobile is linked:
1. On https://voters.eci.gov.in/, click **Fill Form 8 → Correction of Entries in Existing Electoral Roll**.
2. Tick **Mobile Number** under correction options, verify your current unique mobile via OTP, and submit—ECI updates e-EPIC access automatically once Form 8 clears.`,
    category: 'Voter ID Card',
    tags: ['e-EPIC', 'Digital Voter ID', 'Download Voter ID', 'ECI'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Citizen Services Advisor',
    publishedAt: '2026-10-29T18:00:00Z',
    updatedAt: '2026-10-29T18:00:00Z',
    readingTimeMinutes: 3,
    relatedServiceSlug: 'digilocker-document-retrieval',
    seoTitle: 'How to Download Digital Voter ID (e-EPIC) PDF Online',
    seoDescription:
      'Download your QR-signed digital Voter ID (e-EPIC) from https://voters.eci.gov.in/ using EPIC or Reference number, and fix missing mobile errors via Form 8.',
    focusKeyword: 'download digital Voter ID e-EPIC',
    faqItems: [
      {
        question: 'Can I carry e-EPIC on my phone to cast my vote?',
        answer:
          'Yes. Either a printed copy or digital e-EPIC shown via official Voter Helpline/DigiLocker/downloaded PDF is recognized by ECI alongside standard verification guidelines.',
      },
    ],
  },
  {
    id: 'blog-023-correct-name-in-voter-id',
    slug: 'how-to-correct-name-in-voter-id',
    title: 'How to Correct Name in Voter ID',
    titleHi: 'वोटर आईडी कार्ड में नाम या स्पेलिंग कैसे सुधारें (Form 8)',
    excerpt:
      'Fix spelling mistakes in your name, surname, relative name, age/DOB, or photograph on your Voter ID online using ECI Form 8 without fee.',
    excerptHi:
      'voters.eci.gov.in पर फॉर्म 8 भरकर अपने वोटर आईडी कार्ड में नाम, उपनाम, अभिभावक का नाम या फोटो ऑनलाइन ठीक करने की विधि।',
    content: `## Unified Form 8 Replaces Legacy Form 8A & Correction Forms
The Election Commission of India consolidated all voter record updates into a single **Form 8** on https://voters.eci.gov.in/. Whether your English spelling is wrong or regional language transliteration needs fixing, Form 8 updates the electoral roll cleanly without cancelling your existing EPIC number.

## Documents Required for Name Correction
- **For Minor Spelling / Alignment:** Aadhaar Card, Indian Passport, PAN Card, or Class 10 Board Certificate showing the correct spelling
- **For Full Name Change / Surname Change after Marriage:** Registered Marriage Certificate or Official Gazette Notification + Photo ID

## Step-by-Step Form 8 Correction Workflow
1. Log into https://voters.eci.gov.in/ and click **Fill Form 8** under Services.
2. Select **Self** (if your EPIC is linked to your profile) or **Other Elector** and enter your **EPIC Number**, then verify the pre-fetched assembly details.
3. Choose the second radio option: **Correction of Entries in Existing Electoral Roll**.
4. Under Part C, tick up to four fields you wish to fix (for example: **Name**, **Gender**, **DOB/Age**, **Relation Name**, or **Photo**).
5. Enter the **exact corrected First Name and Surname** in English and inspect the auto-converted regional script below it carefully.
6. Upload your valid supporting ID proof PDF/JPG, enter Aadhaar (optional), complete the declaration, and **Submit** to generate an ARN Reference ID.

## Approval & Reprint Delivery
Once your constituency BLO/ERO verifies the proof (usually 15–30 days), the updated name reflects in the voter list and you can download the corrected **e-EPIC** immediately.`,
    category: 'Voter ID Card',
    tags: ['Voter ID Correction', 'Form 8', 'ECI', 'Name Spelling'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Citizen Services Advisor',
    publishedAt: '2026-10-29T12:00:00Z',
    updatedAt: '2026-10-29T12:00:00Z',
    readingTimeMinutes: 3,
    relatedServiceSlug: 'gazette-name-change',
    seoTitle: 'How to Correct Name in Voter ID Online Using ECI Form 8',
    seoDescription:
      'Step-by-step instructions to fix name spelling, relative name, DOB, or photo in your Voter ID online using Form 8 on https://voters.eci.gov.in/.',
    focusKeyword: 'correct name in Voter ID',
    faqItems: [
      {
        question: 'How many fields can I correct in a single Voter ID Form 8 application?',
        answer:
          'ECI permits modifying up to four (4) demographic/entry fields in one Form 8 submission, such as Name, Relative Name, DOB/Age, and Photo.',
      },
    ],
  },
  {
    id: 'blog-024-change-address-in-voter-id',
    slug: 'how-to-change-address-in-voter-id',
    title: 'How to Change Address in Voter ID',
    titleHi: 'वोटर आईडी कार्ड में पता (Address) ऑनलाइन कैसे बदलें',
    excerpt:
      'Shifted residence within the same constituency or city? Update your Voter ID address and polling booth online via Form 8 on voters.eci.gov.in.',
    excerptHi:
      'नए घर या शहर में शिफ्ट होने पर फॉर्म 8 के ज़रिए अपने वोटर आईडी कार्ड का पता और मतदान केंद्र ऑनलाइन बदलने की पूरी जानकारी।',
    content: `## Same-Constituency vs Constituency Shift Explained
Under ECI Form 8, selecting **"Shifting of Residence"** automatically handles both situations:
- **Within Same Assembly Constituency:** Keeps you in the same constituency while moving your name to the new polling station part nearest your current house.
- **Outside Assembly Constituency (Within Same State):** Automatically deletes your old polling booth entry and transfers your existing **EPIC Number** to the new constituency roll.

## Valid Address Proofs Accepted by ECI
Upload one clear scan (under 2 MB) in your name (or parent/spouse name where permitted by local ERO):
- Latest Water / Electricity / Gas connection bill (at least 1 year or recent official billing)
- Aadhaar Card showing updated residential address
- Current Passbook of Nationalized / Scheduled Bank or Post Office
- Indian Passport or Revenue Department land-owning record / Registered Rent/Lease Deed

## Step-by-Step Address Change on Voters' Portal
1. Log into https://voters.eci.gov.in/ and click **Fill Form 8**.
2. Enter your **EPIC Number** (or select *Self*) and choose **Shifting of Residence → Within Assembly Constituency** or **Outside Assembly Constituency**.
3. Pick your new **State, District, and Assembly Constituency** from the drop-downs.
4. Type your complete new House/Building No., Street/Mohalla, Town/Village, Post Office, PIN Code, and Tehsil carefully.
5. Select your address proof type from the drop-down, upload the scan, verify preview, and submit for your Reference ID.

## BLO Verification Reminder
Keep a copy of your uploaded address proof ready at your new home; the local Booth Level Officer may conduct a brief physical residence confirmation before approving the shift.`,
    category: 'Voter ID Card',
    tags: ['Voter ID Address', 'Shifting Residence', 'Form 8', 'Polling Station'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Citizen Services Advisor',
    publishedAt: '2026-10-28T18:00:00Z',
    updatedAt: '2026-10-28T18:00:00Z',
    readingTimeMinutes: 3,
    relatedServiceSlug: 'digilocker-document-retrieval',
    seoTitle: 'How to Change Address in Voter ID Online — ECI Form 8 Guide',
    seoDescription:
      'Shift your Voter ID address and polling booth online within or outside your constituency via https://voters.eci.gov.in/ Form 8 with valid address proof.',
    focusKeyword: 'change address in Voter ID',
    faqItems: [
      {
        question: 'Do I get a new EPIC number when changing my Voter ID address?',
        answer:
          'When shifting via Form 8, ECI preserves your existing EPIC number while updating your polling station address and issuing an updated card.',
      },
    ],
  },
  {
    id: 'blog-025-transfer-voter-id-to-another-state',
    slug: 'how-to-transfer-voter-id-to-another-state',
    title: 'How to Transfer Voter ID to Another State',
    titleHi: 'वोटर आईडी कार्ड को एक राज्य से दूसरे राज्य में ट्रांसफर कैसे करें',
    excerpt:
      'Relocated across Indian states for work or marriage? Transfer your Voter ID registration cleanly to your new state using Form 8 without duplicate voter penalties.',
    excerptHi:
      'नौकरी या विवाह के बाद दूसरे राज्य में शिफ्ट होने पर पुराने वोटर आईडी कार्ड को नए राज्य की मतदाता सूची में ऑनलाइन ट्रांसफर करने का तरीका।',
    content: `## Why You Must Transfer Instead of Applying Afresh with Form 6
Under **Section 31 of the Representation of the People Act, 1950**, holding active voter registrations in two different states simultaneously is a punishable offence. Whenever you permanently move from one state to another (e.g., Uttar Pradesh to Maharashtra or Bihar to Delhi), always file **Form 8 (Shifting of Residence Outside Constituency)** rather than a fresh Form 6.

## How Inter-State Transfer Works Automatically
When you submit Form 8 selecting your **new State and Assembly Constituency**:
1. Your new state's Electoral Registration Officer (ERO) verifies your new residential address proof and BLO visit.
2. Once approved, ECI's centralized **ERONET** platform automatically strikes off your name from your previous state's electoral roll and adds you to the new state's roll—retaining your existing EPIC history cleanly.

## Step-by-Step Inter-State Transfer Filing
1. Log into https://voters.eci.gov.in/ using your mobile OTP.
2. Select **Fill Form 8**, choose **Other Elector / Self**, and enter your **existing EPIC Number**.
3. Pick **Shifting of Residence → Outside Assembly Constituency**.
4. In the destination drop-down, select your **New State**, **New District**, and **New Assembly Constituency**.
5. Enter your new residential address completely, upload valid Proof of Residence (Updated Aadhaar, Registered Rent Agreement, Utility Bill, or Bank Passbook), and submit.

## Timeline Before Elections
Submit inter-state transfers at least **30 to 45 days before election notification** in your new state so your name appears in the final electoral roll supplement in time to vote.`,
    category: 'Voter ID Card',
    tags: ['Transfer Voter ID', 'Inter-State EPIC', 'ERONET', 'Form 8'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Citizen Services Advisor',
    publishedAt: '2026-10-28T12:00:00Z',
    updatedAt: '2026-10-28T12:00:00Z',
    readingTimeMinutes: 3,
    relatedServiceSlug: 'digilocker-document-retrieval',
    seoTitle: 'Transfer Voter ID to Another State Online — Inter-State Form 8',
    seoDescription:
      'Transfer your Voter ID card across Indian states online using Form 8 on https://voters.eci.gov.in/ without losing history or creating duplicate voter entries.',
    focusKeyword: 'transfer Voter ID to another state',
    faqItems: [
      {
        question: 'Do I need to cancel my old state Voter ID separately before transferring?',
        answer:
          'No. Using Form 8 (Shifting of Residence Outside Constituency) automatically triggers deletion from your old state roll once your new state ERO approves the transfer.',
      },
    ],
  },
  {
    id: 'blog-026-check-name-in-voter-list',
    slug: 'how-to-check-your-name-in-the-voter-list',
    title: 'How to Check Your Name in the Voter List',
    titleHi: 'वोटर लिस्ट (मतदाता सूची) में अपना नाम ऑनलाइन कैसे चेक करें',
    excerpt:
      'Verify whether your name is active in the current ECI Electoral Roll using EPIC Number, Personal Details, or Mobile Number—plus find your exact Polling Booth.',
    excerptHi:
      'EPIC नंबर, नाम या मोबाइल नंबर के माध्यम से वोटर लिस्ट में अपना नाम, भाग संख्या और मतदान केंद्र (Polling Station) ऑनलाइन खोजें।',
    content: `## Why Verifying Before Polling Day Is Crucial
Even if you hold a physical Voter ID card issued years ago, names can sometimes be marked shifted or deleted during Special Summary Revisions (SSR) if a family moved or BLO verification missed your residence. Checking the live **Electoral Roll** confirms your voting eligibility and exact **Polling Station address**.

## Three Ways to Search the Live Electoral Roll
1. Open the official ECI search portal via https://voters.eci.gov.in/ and click **Search in Electoral Roll** (opens *electoralsearch.eci.gov.in*).
2. **Option A — Search by EPIC (Fastest):** Choose your **State**, type your 10-character **EPIC Number**, solve Captcha, and click **Search**.
3. **Option B — Search by Details:** If you do not have your EPIC handy, select your **State**, **Language**, **First Name**, **Relative's Name**, **DOB/Age**, **Gender**, and **District/Assembly**.
4. **Option C — Search by Mobile:** Select your State and enter the mobile number linked via Form 6/8, then verify OTP.

## Details Shown in Your Search Result
Click **View Details** next to your matched record to inspect:
- **Part Number & Serial Number** (helpful for quick desk lookup on election day)
- **Assembly & Parliamentary Constituency**
- **Exact Polling Station Name & Address**
- **BLO, ERO & DEO Contact Information**

## Name Missing from the Roll?
If search returns zero results despite holding an old card, download your PDF draft roll from **Download Electoral Roll** on https://voters.eci.gov.in/ or file a fresh **Form 6** immediately before electoral roll freezing.`,
    category: 'Voter ID Card',
    tags: ['Voter List Check', 'Electoral Roll', 'Polling Booth', 'EPIC Search'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Citizen Services Advisor',
    publishedAt: '2026-10-27T18:00:00Z',
    updatedAt: '2026-10-27T18:00:00Z',
    readingTimeMinutes: 3,
    relatedServiceSlug: 'digilocker-document-retrieval',
    seoTitle: 'How to Check Your Name in Voter List & Find Polling Booth',
    seoDescription:
      'Check if your name is active in India’s ECI Voter List using EPIC number, name details, or mobile OTP on https://voters.eci.gov.in/ and view your polling booth.',
    focusKeyword: 'check name in voter list',
    faqItems: [
      {
        question: 'Can I vote if I have a Voter ID card but my name is not in the Electoral Roll?',
        answer:
          'No. Only citizens whose names appear in the active Electoral Roll on polling day are permitted to cast a vote—so always check your status ahead of elections.',
      },
    ],
  },
  {
    id: 'blog-027-voter-id-for-first-time-voters',
    slug: 'how-to-apply-for-voter-id-for-first-time-voters',
    title: 'How to Apply for Voter ID for First-Time Voters',
    titleHi: 'पहली बार वोट देने वाले युवा (17–18 वर्ष) वोटर आईडी कैसे बनवाएं',
    excerpt:
      'Turned 17+ or 18 recently? Learn ECI’s advance application rule for first-time young voters, college hostel proof rules, and Form 6 filing tips.',
    excerptHi:
      '17 वर्ष से अधिक उम्र के युवा एडवांस में फॉर्म 6 कैसे भर सकते हैं—प्रूफ, कॉलेज छात्रावास नियम और ई-ईपिक की पूरी गाइड।',
    content: `## ECI Advance Registration Rule for 17+ Youth
Under Election Commission reforms, Indian youth aged **17 years and above** no longer have to wait until turning 18 to submit **Form 6**. You can file your **advance Form 6 application** right after turning 17; ECI automatically enrols your name in the upcoming quarterly roll update (Jan 1, Apr 1, Jul 1, or Oct 1) immediately following your 18th birthday.

## Best Documents for College Students & First-Time Voters
- **Age Proof:** Class 10 Board Marksheet/Certificate, Birth Certificate, Aadhaar Card, or Indian Passport
- **Address Proof (Living with Parents):** Even if utility bills or property deeds are in your father's/mother's name, ECI allows uploading your Aadhaar or parent's bill along with family linkage confirmation
- **Students Living in Hostels:** Students residing at university hostels can register either at their permanent home constituency or at the hostel address by submitting a **Bonafide Hostel Certificate** signed by the college Warden/Dean (attached with Form 6)

## Step-by-Step Filing Guide
1. Visit https://voters.eci.gov.in/ (or download the official **Voter Helpline App** on Android/iOS).
2. Create an account using your personal mobile number so future **e-EPIC downloads** stay tied to your phone.
3. Click **Fill Form 6**, enter your details matching your Class 10 Certificate and Aadhaar, upload your photo, age proof, and residence proof, and submit.
4. Keep the Reference ID saved to track BLO verification and receive your first Voter ID card at home free of cost.`,
    category: 'Voter ID Card',
    tags: ['First Time Voter', '17+ Voter Registration', 'Form 6', 'Student Voter ID'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Citizen Services Advisor',
    publishedAt: '2026-10-27T12:00:00Z',
    updatedAt: '2026-10-27T12:00:00Z',
    readingTimeMinutes: 3,
    relatedServiceSlug: 'academic-marksheet-verification',
    seoTitle: 'First-Time Voter ID Guide — 17+ Advance Form 6 & Hostel Rules',
    seoDescription:
      'Complete ECI Form 6 registration guide for first-time 17–18 year old voters and college students on https://voters.eci.gov.in/, including hostel address rules.',
    focusKeyword: 'Voter ID for first-time voters',
    faqItems: [
      {
        question: 'Can a 17-year-old submit Form 6 before their 18th birthday?',
        answer:
          'Yes. Citizens aged 17+ can apply in advance on https://voters.eci.gov.in/, and ECI activates the registration in the quarterly qualifying roll after they turn 18.',
      },
    ],
  },
  {
    id: 'blog-028-track-voter-id-application-status',
    slug: 'how-to-track-voter-id-application-status',
    title: 'How to Track Voter ID Application Status',
    titleHi: 'वोटर आईडी आवेदन का स्टेटस ऑनलाइन कैसे ट्रैक करें',
    excerpt:
      'Check live progress of your Form 6 or Form 8 Voter ID application from Submitted to BLO Appointed, Field Verified, and EPIC Generated on voters.eci.gov.in.',
    excerptHi:
      'रेफरेंस नंबर की मदद से फॉर्म 6 या फॉर्म 8 के BLO वेरिफिकेशन, ERO स्वीकृति और EPIC जनरेट होने की लाइव स्थिति चेक करें।',
    content: `## Stages in the ECI Voter ID Approval Pipeline
After submitting Form 6 or Form 8, your application progresses through five transparent milestones:
1. **Submitted** — Application received by the ECI portal
2. **BLO Appointed** — Assigned to your ward/village Booth Level Officer
3. **Field Verified** — BLO completed document & residence verification
4. **ERO Decision (Accepted / Rejected)** — Electoral Registration Officer approves entry
5. **EPIC Generated** — Voter ID number issued and queued for e-EPIC PDF + Speed Post printing

## Step-by-Step Online Status Tracking
1. Open https://voters.eci.gov.in/ and sign in with your registered mobile credentials.
2. Click **Track Application Status** on the home screen.
3. Paste your complete **Reference Number** (e.g., *S1024...*), select your **State** from the dropdown, and click **Submit**.
4. Expand the **Timeline Accordion** to view exact timestamps and BLO remarks.

## Handling Delays or "Rejected" Status
- If status stays on **BLO Appointed** for more than 30 days, click **Book a Call with BLO** inside https://voters.eci.gov.in/ or contact your district **1950 Voter Helpline**.
- If marked **Rejected**, check the remark (typically *Blurry photo*, *Insufficient residence proof*, or *Applicant absent during BLO visit*) and submit a clean fresh Form 6/8 with clear PDF/JPG uploads.`,
    category: 'Voter ID Card',
    tags: ['Track Voter ID', 'Reference Number', 'BLO Verification', '1950 Helpline'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Citizen Services Advisor',
    publishedAt: '2026-10-26T18:00:00Z',
    updatedAt: '2026-10-26T18:00:00Z',
    readingTimeMinutes: 3,
    relatedServiceSlug: 'digilocker-document-retrieval',
    seoTitle: 'Track Voter ID Application Status Online — BLO & EPIC Stages',
    seoDescription:
      'Track your Voter ID Form 6 or Form 8 status on https://voters.eci.gov.in/ using your Reference ID, understand BLO milestones, and resolve delays via 1950.',
    focusKeyword: 'track Voter ID application status',
    faqItems: [
      {
        question: 'What is the official toll-free Voter Helpline number in India?',
        answer:
          'Dial 1950 from any mobile or landline (prefix your state STD code if needed) to reach ECI election support desks.',
      },
    ],
  },

  // ==========================================
  // 4. PASSPORT — ARTICLES 29 TO 36
  // Official Portal: https://www.passportindia.gov.in/
  // ==========================================
  {
    id: 'blog-029-apply-new-indian-passport-online',
    slug: 'how-to-apply-for-a-new-indian-passport-online',
    title: 'How to Apply for a New Indian Passport Online',
    titleHi: 'नए भारतीय पासपोर्ट (Fresh Passport) के लिए ऑनलाइन आवेदन कैसे करें',
    excerpt:
      'End-to-end Passport Seva guide to registering on passportindia.gov.in, choosing Normal vs Tatkaal & ECNR, paying ₹1,500 fee, PSK visit, and Police Verification.',
    excerptHi:
      'passportindia.gov.in पर रजिस्ट्रेशन, ऑनलाइन फॉर्म भरने, ₹1,500 शुल्क भुगतान, PSK अपॉइंटमेंट और पुलिस सत्यापन की संपूर्ण मार्गदर्शिका।',
    content: `## Normal Fresh Passport Overview
Issued by the Ministry of External Affairs (MEA), a regular 36-page Indian **Ordinary Passport** carries 10-year validity for adults (5 years or until age 18 for minors) and costs **₹1,500** under the Normal scheme (60-page jumbo booklet costs ₹2,000).

## Official Application Portal
Always apply strictly through the official MEA portal at https://www.passportindia.gov.in/ (or the mPassport Seva app). Beware of lookalike unofficial websites charging excess service fees.

## Step-by-Step Fresh Passport Application
1. Visit https://www.passportindia.gov.in/ and click **New User Registration**. Pick your nearest **Passport Office (RPO)**, enter your details, and verify your email link.
2. Log in and select **Apply for Fresh Passport / Re-issue of Passport**.
3. Choose **Fresh Passport**, **Normal** (or *Tatkaal*), and **36 Pages**.
4. Fill in personal particulars (ensure Name, Parents' Names, and DOB match your Class 10/Birth/Aadhaar originals **letter-for-letter**), Non-ECR eligibility, Present & Permanent Residential Address, and Emergency Contact.
5. Verify the preview carefully—major spelling mistakes after fee submission can require extra clarification at PSK.
6. Click **Pay and Schedule Appointment**, choose your nearest **PSK (Passport Seva Kendra)** or **POPSK (Post Office PSK)** slot, pay **₹1,500** online, and print your **Application Receipt**.

## PSK Appointment & Police Verification
Carry all **original documents** (plus self-attested copies; DigiLocker verified originals are also supported) to the PSK/POPSK 15 minutes before your slot for live photo, biometrics, and Counter A/B/C verification. Local Police Verification follows to confirm your current address prior to Speed Post dispatch.`,
    category: 'Passport',
    tags: ['New Passport', 'Passport Seva', 'PSK Appointment', 'ECNR'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Legal & Travel Compliance Counsel',
    publishedAt: '2026-10-26T12:00:00Z',
    updatedAt: '2026-10-26T12:00:00Z',
    readingTimeMinutes: 4,
    relatedServiceSlug: 'gazette-name-change',
    seoTitle: 'Apply for a New Indian Passport Online — 2026 Passport Seva Guide',
    seoDescription:
      'Complete guide to applying for a fresh Indian passport on https://www.passportindia.gov.in/: fees (₹1,500), ECNR rules, PSK appointment, and Police Verification.',
    focusKeyword: 'apply for new Indian passport',
    faqItems: [
      {
        question: 'What is ECNR (Non-ECR) eligibility for an Indian Passport?',
        answer:
          'Citizens who have passed Class 10 (Matriculation) or higher, taxpayers, government servants, or those aged 50+ automatically qualify for Non-ECR status—requiring no emigration clearance stamp for employment abroad.',
      },
      {
        question: 'Do I need to carry physical passport photographs to the PSK?',
        answer:
          'No for adults/older children—Passport Seva Kendras capture live digital photographs on-site. Carry 2 white-background photos only for infants/children under 4 years.',
      },
    ],
  },
  {
    id: 'blog-030-documents-required-for-passport',
    slug: 'documents-required-for-passport-application',
    title: 'Documents Required for Passport Application',
    titleHi: 'पासपोर्ट बनवाने के लिए जरूरी दस्तावेज़ों की पूरी लिस्ट (2026)',
    excerpt:
      'Check the exact MEA list of Address Proof, Date of Birth Proof, Non-ECR eligibility certificates, and Minor Annexure D/C documents before your PSK appointment.',
    excerptHi:
      'नए पासपोर्ट या नवीनीकरण के लिए पते का प्रमाण, जन्मतिथि प्रमाण, Non-ECR सर्टिफिकेट और नाबालिगों के Annexure की सटीक सूची।',
    content: `## Mandatory Document Categories for Fresh Passport
Passport Seva Kendras check three primary eligibility pillars at **Counter A**—always carry **originals** along with one set of self-attested photocopies (or verified DigiLocker records).

## 1. Proof of Present Residential Address (Any One)
- **Aadhaar Card** (printed letter, e-Aadhaar, or PVC card)
- Water / Electricity / Landline / Postpaid Mobile Bill (note: two bills spanning 1 year earlier and latest month if relying solely on utility bills in some RPOs; check PSK document advisor)
- **Voter ID (EPIC)** or **Registered Rent Agreement** (minimum 1 year stay at current address)
- Photo Passbook of running Bank Account (Scheduled Public/Private/Regional Rural Banks)
- Income Tax Assessment Order or Parent's Passport copy (for minors)

## 2. Proof of Date of Birth (Mandatory for All Applicants)
- **Birth Certificate** issued by Municipal Authority / Registrar of Births & Deaths (compulsory under new rules for applicants born on or after **01-10-2023**)
- **Transfer / School Leaving / Matriculation (Class 10) Certificate** from a recognized board showing DOB
- **PAN Card** or **Driving Licence** (acceptable DOB proofs alongside standard checks)

## 3. Non-ECR (ECNR) Documentary Proof
Upload and carry your **Class 10 (Matriculation) or Higher Degree Certificate** to receive **ECNR** status; otherwise your passport carries an *ECR* stamp unless exempted by age (50+) or income tax status.

## 4. Minor Passport Special Annexures
- **Annexure D:** Joint declaration signed by both parents (mandatory for applicants under 18)
- **Annexure C:** Required only if one parent cannot sign due to separation, absence abroad, or single-parent custody
- **Both Parents' Original Passports** (if held) or Aadhaar/ID proofs`,
    category: 'Passport',
    tags: ['Passport Documents', 'Address Proof', 'Non-ECR', 'Annexure D'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Legal & Travel Compliance Counsel',
    publishedAt: '2026-10-25T18:00:00Z',
    updatedAt: '2026-10-25T18:00:00Z',
    readingTimeMinutes: 4,
    relatedServiceSlug: 'academic-marksheet-verification',
    seoTitle: 'Documents Required for Indian Passport Application — MEA List',
    seoDescription:
      'Complete MEA checklist of Address Proof, Birth/10th DOB Proof, Non-ECR eligibility docs, and Minor Annexure D/C for https://www.passportindia.gov.in/.',
    focusKeyword: 'documents required for passport',
    faqItems: [
      {
        question: 'If I lived at my current address for less than 1 year, what extra detail is needed?',
        answer:
          'You must declare all previous addresses lived at during the last 12 months in the Passport form; Police Verification may occur at both current and previous locations.',
      },
    ],
  },
  {
    id: 'blog-031-apply-for-passport-renewal',
    slug: 'how-to-apply-for-passport-renewal',
    title: 'How to Apply for Passport Renewal',
    titleHi: 'पासपोर्ट रिन्यूअल (Re-issue) ऑनलाइन आवेदन कैसे करें',
    excerpt:
      'Renew an expired, soon-to-expire (within 1 year), damaged, or page-exhausted Indian passport online on passportindia.gov.in under Re-issue of Passport.',
    excerptHi:
      'एक्सपायर होने वाले, पन्ने भर चुके या पुराने पासपोर्ट को Re-issue कैटेगरी में ऑनलाइन रिन्यू कराने की पूरी प्रक्रिया और शुल्क जानें।',
    content: `## When Should You Apply for Passport Re-Issue?
In India, passport "renewal" is officially termed **Re-issue of Passport**. You can apply for re-issue anytime:
- Up to **1 year before expiry**, or within **3 years after expiry** without fresh Police Verification hassles (when address/particulars remain unchanged)
- Immediately if visa pages are exhausted, booklet is damaged, or appearance changed drastically (e.g., child to adult)

## Documents Required for Re-Issue
- **Original Old Passport** along with self-attested copies of the first two and last two pages (including ECR/Non-ECR and observation pages)
- **Address Proof** (only if your present residential address differs from the one printed on the old passport)
- **Old Class 10 Certificate** (if updating from ECR to Non-ECR)

## Step-by-Step Re-Issue Application Steps
1. Log into https://www.passportindia.gov.in/ and select **Apply for Fresh Passport / Re-issue of Passport**.
2. Choose **Re-issue of Passport** and tick the exact reason(s): *Validity Expired / Due to Expire within 3 years*, *Exhaustion of Pages*, *Change in Existing Personal Particulars*, or *Damaged Passport*.
3. Enter your **Previous Passport Number, Date of Issue, Expiry Date, and Place of Issue** accurately.
4. Pay the fee (**₹1,500** Normal / **₹3,500** Tatkaal for 36 pages) and book your PSK slot.
5. At PSK, your old passport is stamped **"Cancelled"** and returned to you on the spot (valid visas inside the old passport remain usable alongside the new booklet!).

## Police Verification Rule for Re-Issue
If you apply before or within 3 years of expiry with **no change in address or name**, MEA generally processes re-issue on a **No / Post-Police Verification** basis, speeding up delivery to 5–7 working days.`,
    category: 'Passport',
    tags: ['Passport Renewal', 'Re-issue Passport', 'Expired Passport', 'Passport Seva'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Legal & Travel Compliance Counsel',
    publishedAt: '2026-10-25T12:00:00Z',
    updatedAt: '2026-10-25T12:00:00Z',
    readingTimeMinutes: 3,
    relatedServiceSlug: 'gazette-name-change',
    seoTitle: 'How to Apply for Passport Renewal (Re-issue) Online in India',
    seoDescription:
      'Step-by-step guide to renewing an expired, full-page, or damaged Indian passport via Re-issue on https://www.passportindia.gov.in/, fees, and Police Verification rules.',
    focusKeyword: 'passport renewal online',
    faqItems: [
      {
        question: 'Are valid visas in my old passport cancelled during renewal?',
        answer:
          'No. The PSK stamps "Cancelled" on the cover/bio page without defacing valid visas—you simply carry both the old passport (with visa) and the new passport when travelling.',
      },
    ],
  },
  {
    id: 'blog-032-correct-personal-details-in-passport',
    slug: 'how-to-correct-personal-details-in-passport',
    title: 'How to Correct Personal Details in Passport',
    titleHi: 'पासपोर्ट में नाम, जन्मतिथि, पता या जीवनसाथी का नाम कैसे सुधारें',
    excerpt:
      'Amend name spelling, add spouse name after marriage, update residential address, or fix DOB errors on your Indian passport via Re-issue on passportindia.gov.in.',
    excerptHi:
      'पासपोर्ट में नाम बदलने, विवाह के बाद पति/पत्नी का नाम जोड़ने, पता या जन्मतिथि सुधारने के नियम और दस्तावेज़ जानें।',
    content: `## Always File Under "Re-issue" With Change of Particulars
Any modification to an issued Indian passport requires applying for **Re-issue of Passport** on https://www.passportindia.gov.in/ and checking **"Change in Existing Personal Particulars"**—handwritten corrections or endorsements are no longer pasted into old booklets.

## Required Proofs by Modification Type
- **Full Name Change / Substantial Spelling Revision:** Clippings from **two daily newspapers** (one English/local + one at permanent residence) AND an **Official Gazette Notification** (plus two supporting public ID documents in the new name—Aadhaar, PAN, Voter ID)
- **Minor Typo Fix (e.g., missed space or obvious clerical error):** Original Class 10 Certificate, Birth Certificate, and Aadhaar/PAN showing correct spelling
- **Adding Spouse Name After Marriage:** Registered **Marriage Certificate** (or joint affidavit/spouse passport copy where applicable per current MEA guidelines); **no Gazette needed** just to adopt a married surname if Marriage Certificate + updated Aadhaar/ID are provided
- **Deleting Spouse Name After Divorce:** Certified **Divorce Decree** from a Family Court
- **Address Update:** Aadhaar Card, Utility Bill, Bank Passbook, or Registered Rent Agreement

## Filing & PSK Inspection Process
1. Choose **Re-issue of Passport → Change in Existing Personal Particulars** on https://www.passportindia.gov.in/.
2. Tick exact boxes (*Given Name / Surname*, *Spouse Name*, *Address*, *Date of Birth*, etc.), enter old passport details, pay **₹1,500**, and book PSK.
3. Carry your old passport, Gazette/Marriage Certificate/Divorce Decree originals, and updated Aadhaar/PAN to the PSK. Need Gazette preparation first? File via https://digitalindiaproject.com/services/gazette-name-change.`,
    category: 'Passport',
    tags: ['Passport Correction', 'Spouse Name', 'Gazette Passport', 'Re-issue'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Legal & Travel Compliance Counsel',
    publishedAt: '2026-10-24T18:00:00Z',
    updatedAt: '2026-10-24T18:00:00Z',
    readingTimeMinutes: 4,
    relatedServiceSlug: 'gazette-name-change',
    seoTitle: 'Correct Name, Spouse, DOB or Address in Indian Passport',
    seoDescription:
      'Step-by-step MEA Re-issue process to change name via Gazette, add spouse name after marriage, or update DOB/address on https://www.passportindia.gov.in/.',
    focusKeyword: 'correct personal details in passport',
    faqItems: [
      {
        question: 'Is a Gazette notification required to add my husband or wife’s name on my passport?',
        answer:
          'No. Adding a spouse’s name or adopting a married surname requires a Marriage Certificate (plus updated ID if surname changed)—full Gazette is required only for unrelated or major name changes.',
      },
    ],
  },
  {
    id: 'blog-033-book-a-passport-appointment',
    slug: 'how-to-book-a-passport-appointment',
    title: 'How to Book a Passport Appointment',
    titleHi: 'पासपोर्ट सेवा केंद्र (PSK/POPSK) का अपॉइंटमेंट कैसे बुक करें और रीशेड्यूल करें',
    excerpt:
      'Reserve or reschedule your PSK / POPSK appointment slot on passportindia.gov.in, check earliest slot availability before paying, and avoid the 3-reschedule lockout.',
    excerptHi:
      'passportindia.gov.in पर अपने नजदीकी PSK या POPSK केंद्र की सबसे जल्दी उपलब्ध तारीख कैसे देखें, शुल्क भुगतान करें और अपॉइंटमेंट रीशेड्यूल करें।',
    content: `## Checking Earliest Available Slots Before Applying
Before locking a location, visit https://www.passportindia.gov.in/ → **Appointment Availability Status**, select your **Passport Office (RPO)**, and view live earliest dates across all nearby **PSK** (Passport Seva Kendra) and **POPSK** (Post Office PSK) centres. Often a nearby POPSK has appointments 2–3 weeks earlier than a metro PSK.

## Step-by-Step Slot Booking Workflow
1. Log into https://www.passportindia.gov.in/ and click **View Saved/Submitted Applications**.
2. Select your submitted application radio button and click **Pay and Schedule Appointment**.
3. Pick Online Payment (UPI / Net Banking / Card) or SBI Challan.
4. Once payment confirms, choose your preferred **PSK/POPSK centre** from the dropdown, pick an available **green date** on the calendar, and solve Captcha.
5. Click **Book Appointment**—immediately download/print the **Application Receipt** containing your Appointment Date, Batch Time, and Reporting Gate.

## Rescheduling & Cancellation Rules (Strict MEA Limit)
- Applicants are permitted to **reschedule or cancel an appointment at most twice/thrice within 1 year** of the first booking.
- Exhausting your reschedule limit voids your paid fee, requiring a fresh payment.
- Always reschedule at least **1 day prior** if you are missing an original document—never waste a reschedule slot lightly.`,
    category: 'Passport',
    tags: ['Passport Appointment', 'PSK Slot', 'POPSK', 'Reschedule Passport'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Legal & Travel Compliance Counsel',
    publishedAt: '2026-10-24T12:00:00Z',
    updatedAt: '2026-10-24T12:00:00Z',
    readingTimeMinutes: 3,
    relatedServiceSlug: 'pan-card',
    seoTitle: 'Book & Reschedule Passport Seva Appointment (PSK/POPSK)',
    seoDescription:
      'Check live PSK/POPSK slot availability, pay the passport fee, book your appointment on https://www.passportindia.gov.in/, and understand MEA reschedule limits.',
    focusKeyword: 'book passport appointment',
    faqItems: [
      {
        question: 'Can I choose any PSK or POPSK inside my Regional Passport Office jurisdiction?',
        answer:
          'Yes. You can select any PSK or POPSK falling under your residential RPO jurisdiction—even in a neighboring district if dates are earlier.',
      },
    ],
  },
  {
    id: 'blog-034-check-passport-application-status',
    slug: 'how-to-check-passport-application-status',
    title: 'How to Check Passport Application Status',
    titleHi: 'पासपोर्ट आवेदन और पुलिस वेरिफिकेशन स्टेटस ऑनलाइन कैसे चेक करें',
    excerpt:
      'Track your passport printing, Police Verification progress, and India Post Speed Post delivery using your 15-character File Number on passportindia.gov.in.',
    excerptHi:
      '15-अंकीय File Number और जन्मतिथि से अपने पासपोर्ट आवेदन, पुलिस वेरिफिकेशन और स्पीड पोस्ट डिलीवरी की लाइव स्थिति जांचें।',
    content: `## Where to Find Your 15-Character File Number
Upon completing your PSK Counter C check, the centre issues an **Acknowledgement Letter** displaying your **File Number** (for example: *DL1062548912326*), which differs from your online ARN. Keep this File Number handy for every tracking check.

## Step-by-Step Status Tracking
1. Visit https://www.passportindia.gov.in/ and click **Track Application Status** on the left sidebar.
2. Select **Application Type: Passport / PCC / IC / GEP**.
3. Enter your **15-character File Number** and **Date of Birth** (DD/MM/YYYY), then click **Track Status**.
4. You can also track inside the **mPassport Seva** mobile app or via SMS alerts sent by MEA.

## Understanding Passport Seva Status Messages
- **Police Verification Report is pending / under review at SP Office:** Visit or wait for your local Police Station (Thana) verification call; carry your two neighbors' witness info and original address proof.
- **Police Verification Report has been submitted (Clear):** RPO is finalizing booklet approval.
- **Passport printing has been initiated / Passport has been printed:** Booklet is printed at centralized press and moving to lamination/dispatch.
- **Passport has been dispatched via Speed Post:** Copy the **PPXXXXXXXXXIN** tracking ID displayed to monitor India Post delivery—personal handover (or authorized family with authority letter + ID) is required at doorstep.`,
    category: 'Passport',
    tags: ['Track Passport Status', 'File Number', 'Police Verification', 'Speed Post'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Legal & Travel Compliance Counsel',
    publishedAt: '2026-10-23T18:00:00Z',
    updatedAt: '2026-10-23T18:00:00Z',
    readingTimeMinutes: 3,
    relatedServiceSlug: 'digilocker-document-retrieval',
    seoTitle: 'Track Indian Passport Application & Police Verification Status',
    seoDescription:
      'Check live passport printing, Police Verification report status, and Speed Post dispatch tracking using your 15-digit File Number on https://www.passportindia.gov.in/.',
    focusKeyword: 'check passport application status',
    faqItems: [
      {
        question: 'What if Police Verification stays pending for over 3 weeks?',
        answer:
          'Visit your local police station Passport Cell politely with your PSK acknowledgement slip and original address proof, or contact your Regional Passport Office grievance desk.',
      },
    ],
  },
  {
    id: 'blog-035-apply-for-tatkaal-passport',
    slug: 'how-to-apply-for-tatkaal-passport',
    title: 'How to Apply for Tatkaal Passport',
    titleHi: 'तत्काल पासपोर्ट (Tatkaal Passport) ऑनलाइन कैसे बनवाएं — 3 दिन में डिलीवरी',
    excerpt:
      'Need an Indian passport urgently within 1 to 3 working days? Check Tatkaal eligibility, extra ₹2,000 fee, mandatory 3-document rule, and Post-Police Verification.',
    excerptHi:
      'आपातकालीन विदेश यात्रा के लिए 1–3 दिन में तत्काल पासपोर्ट बनवाने के लिए जरूरी 3 दस्तावेज़, ₹3,500 शुल्क और पात्रता नियम जानें।',
    content: `## Normal vs Tatkaal Speed & Fee Difference
Under the **Tatkaal Scheme**, approved passports dispatch within **1 to 3 working days** after your PSK appointment because Police Verification happens **after** passport issuance (*Post-Police Verification*).
- **Tatkaal Fresh / Re-issue Fee (36 pages):** ₹1,500 Normal fee + **₹2,000** Tatkaal charge = **₹3,500 total** (note: most PSKs collect ₹1,500 online and the remaining ₹2,000 in cash/UPI at the PSK counter once Tatkaal eligibility clears).

## Strict Three-Document Verification Rule
To qualify for Tatkaal without a Verification Certificate, applicants generally must present **any three (3)** original photo IDs/documents from the MEA Tatkaal list (matching name/DOB cleanly):
- **Aadhaar Card** (with UIDAI QR/OTP verification)
- **PAN Card**
- **Voter ID Card (EPIC)**
- **Indian Driving Licence** or **Bank/Post Office Passbook**
- **Class 10 / Educational Certificate**, **Ration Card**, **Pension Document**, or **Existing Passport** (for re-issue)

## Step-by-Step Tatkaal Application
1. Visit https://www.passportindia.gov.in/ and fill Fresh/Re-issue form choosing **Type of Application: Tatkaal**.
2. Pay ₹1,500 online and select a **Tatkaal-enabled PSK** slot (Tatkaal quotas release daily and fill fast).
3. Carry all **3+ verified original documents** to the PSK; once the Granting Officer validates Tatkaal eligibility, pay the ₹2,000 balance at the counter.

## Who Cannot Apply Under Tatkaal?
Applicants seeking major name changes, damaged/lost passports beyond normal bounds, foreign-born/repatriated citizens, or adverse police history cases are routinely converted from Tatkaal to Normal at the PSK.`,
    category: 'Passport',
    tags: ['Tatkaal Passport', 'Urgent Passport', '3 Documents Rule', 'MEA'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Legal & Travel Compliance Counsel',
    publishedAt: '2026-10-23T12:00:00Z',
    updatedAt: '2026-10-23T12:00:00Z',
    readingTimeMinutes: 4,
    relatedServiceSlug: 'pan-card',
    seoTitle: 'Apply for Tatkaal Passport Online — ₹3,500 Fee & 3 Docs Rule',
    seoDescription:
      'Get an urgent Indian passport in 1–3 working days under Tatkaal via https://www.passportindia.gov.in/. Check the 3-document requirement, ₹3,500 fee, and exclusions.',
    focusKeyword: 'Tatkaal passport',
    faqItems: [
      {
        question: 'When is the ₹2,000 Tatkaal fee paid?',
        answer:
          'You pay the standard ₹1,500 online while booking the slot and pay the additional ₹2,000 Tatkaal charge at the PSK cash/UPI counter once your documents pass Tatkaal screening.',
      },
    ],
  },
  {
    id: 'blog-036-download-passport-application-receipt',
    slug: 'how-to-download-passport-application-receipt',
    title: 'How to Download Passport Application Receipt',
    titleHi: 'पासपोर्ट आवेदन और अपॉइंटमेंट रसीद (Receipt) दोबारा कैसे डाउनलोड करें',
    excerpt:
      'Forgot to save your Passport Seva ARN Payment & Appointment Receipt? Download or re-send the SMS appointment slip anytime from passportindia.gov.in.',
    excerptHi:
      'पासपोर्ट सेवा पोर्टल से अपनी ARN पेमेंट और PSK अपॉइंटमेंट रसीद दोबारा PDF में डाउनलोड करने और SMS प्राप्त करने का तरीका।',
    content: `## Why You Need the Appointment Receipt (or Official SMS)
At your PSK or POPSK security gate, officials verify your **Application Reference Number (ARN)**, **Batch Time**, and **Payment Status** before allowing entry. While MEA now accepts the **official mPassport Seva appointment SMS** at most centres, carrying a printed **Application Receipt** prevents gate delays.

## Step-by-Step Steps to Re-Download Receipt
1. Visit https://www.passportindia.gov.in/ and log into your account using the **exact User ID** used when applying.
2. Click **View Saved/Submitted Applications**.
3. Select the radio button beside your submitted application and click **Print Application Receipt** at the bottom toolbar.
4. Click **Print Application Receipt** again on the summary page or press *Ctrl+P → Save as PDF* to store a crisp copy on your phone.
5. You can also click **Get Appointment SMS** on the same screen to receive an instant SMS confirmation on your registered mobile.

## What If You Need the Complete Submitted Form PDF?
From the same **View Saved/Submitted Applications** toolbar, click **Print Application Form** to download the full multi-page application dossier (note: PSK counters no longer demand the full form printout if you hold the Receipt/ARN, though keeping a copy helps double-check spelling).`,
    category: 'Passport',
    tags: ['Passport Receipt', 'ARN Slip', 'Print Appointment', 'PSK Entry'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Legal & Travel Compliance Counsel',
    publishedAt: '2026-10-22T18:00:00Z',
    updatedAt: '2026-10-22T18:00:00Z',
    readingTimeMinutes: 3,
    relatedServiceSlug: 'digilocker-document-retrieval',
    seoTitle: 'Download Passport Application & Appointment Receipt Online',
    seoDescription:
      'Re-download your Passport Seva ARN payment and PSK appointment receipt PDF or trigger an official appointment SMS from https://www.passportindia.gov.in/.',
    focusKeyword: 'download passport application receipt',
    faqItems: [
      {
        question: 'Is a printed Passport Application Receipt compulsory at the PSK gate?',
        answer:
          'Most PSKs accept the official appointment SMS from Passport Seva alongside your original ID, though carrying the printed Application Receipt ensures smooth scanning at all counters.',
      },
    ],
  },
];
