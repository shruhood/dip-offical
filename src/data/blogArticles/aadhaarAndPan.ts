import { BlogPost } from '../../types';

export const AADHAAR_AND_PAN_BLOGS: BlogPost[] = [
  // ==========================================
  // 1. AADHAAR CARD — ARTICLES 1 TO 10
  // Official Portal: https://uidai.gov.in/
  // ==========================================
  {
    id: 'blog-001-new-aadhaar-card-apply',
    slug: 'how-to-apply-for-a-new-aadhaar-card-in-india',
    title: 'How to Apply for a New Aadhaar Card in India',
    titleHi: 'भारत में नए आधार कार्ड के लिए आवेदन कैसे करें',
    excerpt:
      'Complete 2026 step-by-step guide to booking an Aadhaar enrolment appointment, required POI/POA/DOB documents, biometric capture, and tracking your EID.',
    excerptHi:
      'आधार नामांकन केंद्र पर अपॉइंटमेंट बुक करने, आवश्यक पहचान व पते के दस्तावेज़, बायोमेट्रिक प्रक्रिया और ईआईडी स्टेटस जांचने की पूरी जानकारी।',
    content: `## Why Aadhaar Enrolment Matters for Residents
Issued by the Unique Identification Authority of India (UIDAI), the 12-digit Aadhaar number serves as India's primary digital identity across banking, Direct Benefit Transfer (DBT) subsidies, DigiLocker verification, PAN linking, and passport applications. Fresh enrolment is completely free of cost at any authorized Aadhaar Seva Kendra (ASK).

## Eligibility Criteria for New Aadhaar
- Any resident individual (adult, minor, or newborn) who has stayed in India for 182 days or more in the 12 months preceding enrolment
- Non-Resident Indians (NRIs) holding a valid Indian Passport can enrol immediately upon arrival without waiting 182 days
- Children under 5 years receive a blue **Baal Aadhaar** linked to a parent's biometric credentials without fingerprint or iris capture

## Required Documents Checklist (UIDAI Valid List)
- **Proof of Identity (POI):** Indian Passport, PAN Card, Voter ID, Driving Licence, or Gazette Notification with photograph
- **Proof of Address (POA):** Electricity/Water/Gas bill (within 3 months), Bank Passbook, Ration Card, or Rent Agreement
- **Date of Birth Proof (PDB):** Birth Certificate (mandatory for children born on or after 01-10-2023), SSLC/Class 10 Marksheet, or Passport
- **Head of Family (HoF) Option:** Dependents lacking individual documents can enrol using the HoF relationship document and biometric authentication

## Step-by-Step Enrolment Process via Official Portal
1. Visit the official UIDAI portal at https://uidai.gov.in/ and select **My Aadhaar → Book an Appointment**.
2. Choose your nearest city and authorized Aadhaar Seva Kendra (ASK) or bank/post office enrolment centre.
3. Enter your mobile number, verify the OTP, fill in demographic details, and lock a convenient time slot.
4. Visit the centre with original documents for scanning; the operator captures ten fingerprints, both iris scans, and a live photograph.
5. Review the on-screen preview carefully in both English and your regional language before confirming.
6. Collect the printed **Enrolment Acknowledgement Slip** carrying your 14-digit Enrolment ID (EID) and 14-digit timestamp.

## Fees, Processing Time & Common Mistakes to Avoid
New Aadhaar enrolment is **100% free** under UIDAI regulations. Generation typically takes **15 to 30 days** (up to 90 days in rare quality-check cases). Avoid spelling mismatches between your POI and POA originals, and always verify your mobile number on the preview screen so OTP-based services work smoothly later.`,
    category: 'Aadhaar Card',
    tags: ['Aadhaar Card', 'New Aadhaar', 'UIDAI', 'Baal Aadhaar'],
    status: 'published',
    featured: true,
    authorName: 'Suraj Singh',
    authorRole: 'Identity Compliance Lead',
    publishedAt: '2026-11-14T09:00:00Z',
    updatedAt: '2026-11-14T09:00:00Z',
    readingTimeMinutes: 4,
    relatedServiceSlug: 'pan-card',
    seoTitle: 'How to Apply for a New Aadhaar Card in India — 2026 Guide',
    seoDescription:
      'Step-by-step guide to apply for a new Aadhaar card in India. Check UIDAI documents list, ASK appointment booking, Baal Aadhaar rules, and EID tracking.',
    focusKeyword: 'new Aadhaar card',
    faqItems: [
      {
        question: 'Is there any fee for applying for a new Aadhaar card?',
        answer:
          'No. Fresh Aadhaar enrolment at an authorized Aadhaar Seva Kendra, bank, or post office is completely free under UIDAI guidelines.',
      },
      {
        question: 'Can I apply for a new Aadhaar card completely online without visiting a centre?',
        answer:
          'No. While you can book the appointment online via https://uidai.gov.in/, physical visit to an Aadhaar Seva Kendra is mandatory for biometric and photograph capture.',
      },
    ],
  },
  {
    id: 'blog-002-download-aadhaar-online',
    slug: 'how-to-download-aadhaar-card-online',
    title: 'How to Download Aadhaar Card Online',
    titleHi: 'ऑनलाइन आधार कार्ड (e-Aadhaar) डाउनलोड कैसे करें',
    excerpt:
      'Download your legally valid e-Aadhaar PDF via myAadhaar using Aadhaar number, Enrolment ID, or Virtual ID, plus how to unlock the 8-character password.',
    excerptHi:
      'आधार नंबर, ईआईडी या वर्चुअल आईडी से आधिकारिक e-Aadhaar PDF डाउनलोड करने और 8-अक्षरीय पासवर्ड खोलने की आसान विधि।',
    content: `## Legal Validity of e-Aadhaar PDF
An electronically downloaded **e-Aadhaar** is signed with UIDAI's digital certificate and carries identical legal validity to a physical laminated card across banks, airports, telecom operators, and government offices. Citizens can choose between a standard e-Aadhaar and a **Masked Aadhaar** (which hides the first 8 digits for privacy).

## Prerequisites Before Downloading
- Your 12-digit Aadhaar Number, 28-digit Enrolment ID (EID), or 16-digit Virtual ID (VID)
- An active mobile number registered with UIDAI to receive the 6-digit authentication OTP

## Step-by-Step Download Process on UIDAI myAadhaar
1. Open the official UIDAI portal at https://uidai.gov.in/ and click **Download Aadhaar** under **My Aadhaar** (redirects to https://myaadhaar.uidai.gov.in/).
2. Select your identifier: **Aadhaar Number**, **Enrolment ID Number**, or **Virtual ID**.
3. Enter the 12/28/16-digit number along with the displayed Security Captcha and click **Send OTP**.
4. Enter the 6-digit OTP received on your Aadhaar-linked mobile number.
5. Check the **"Do you want a masked Aadhaar?"** box if you intend to share the PDF for hotel bookings or general KYC where full Aadhaar masking is recommended.
6. Click **Verify & Download** to save the password-protected e-Aadhaar PDF file.

## How to Open Your e-Aadhaar PDF Password
The e-Aadhaar PDF is secured with an **8-character password** combining:
- The **first 4 letters of your name in CAPITAL letters** (exactly as printed on Aadhaar), followed by
- Your **4-digit Year of Birth (YYYY)**.
- Example: If your name is *Ramesh Kumar* and birth year is *1994*, the password is **RAME1994**. If your name is *A. K. Singh*, spaces and dots count—use **A.K.1994** or verify the exact first four characters printed on your slip.

## Common Download Errors & Fixes
If you see "Invalid EID", make sure you enter the 14-digit enrolment number followed by the timestamp in **YYYYMMDDHHMMSS** order (year first, not DDMMYYYY). Always validate the digital signature green tick inside Adobe Reader before printing.`,
    category: 'Aadhaar Card',
    tags: ['e-Aadhaar', 'Download Aadhaar', 'Masked Aadhaar', 'UIDAI'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Identity Compliance Lead',
    publishedAt: '2026-11-13T18:00:00Z',
    updatedAt: '2026-11-13T18:00:00Z',
    readingTimeMinutes: 4,
    relatedServiceSlug: 'digilocker-document-retrieval',
    seoTitle: 'How to Download e-Aadhaar Card Online & Open Password',
    seoDescription:
      'Download e-Aadhaar or Masked Aadhaar online from UIDAI myAadhaar using Aadhaar/EID/VID and learn the exact 8-character PDF password format.',
    focusKeyword: 'download Aadhaar card',
    faqItems: [
      {
        question: 'What is the password for e-Aadhaar PDF?',
        answer:
          'The 8-character password consists of the first four letters of your name in UPPERCASE as on Aadhaar followed by your birth year (YYYY), e.g., ANIT1992.',
      },
      {
        question: 'Can I download Aadhaar without a registered mobile number?',
        answer:
          'No. Online e-Aadhaar download requires OTP verification on your Aadhaar-linked mobile number; otherwise, visit an Aadhaar Seva Kendra to update your mobile first.',
      },
    ],
  },
  {
    id: 'blog-003-update-aadhaar-address-online',
    slug: 'how-to-update-aadhaar-address-online',
    title: 'How to Update Aadhaar Address Online',
    titleHi: 'आधार कार्ड में पता (Address) ऑनलाइन अपडेट कैसे करें',
    excerpt:
      'Learn how to change your residential address in Aadhaar online through the UIDAI myAadhaar portal using valid POA documents or the Head of Family (HoF) route.',
    excerptHi:
      'myAadhaar पोर्टल के माध्यम से पते के प्रमाण या परिवार के मुखिया (HoF) की सहमति से घर बैठे आधार पता बदलने की पूरी प्रक्रिया।',
    content: `## Online Address Update Overview
Unlike biometric, name, or mobile updates that require visiting an Aadhaar Seva Kendra, **residential address updates** can be completed **100% online** on UIDAI's Self-Service Update Portal (myAadhaar) whenever your mobile number is already linked to Aadhaar.

## Accepted Proof of Address (POA) Documents
Upload a single clear colour scan (JPEG, PNG, or PDF under 2 MB) of any UIDAI-approved POA issued in your own name:
- Indian Passport, Voter ID (EPIC), or Ration Card
- Electricity, Water, Gas, or Postpaid Telephone Bill (not older than 3 months)
- Bank Statement / Passbook stamped and signed by the bank branch
- Registered Sale Deed, Gift Deed, or Rent Agreement (registered, not notarized)
- Property Tax Receipt (less than 1 year old) or Government Allotment Letter

## Step-by-Step Online Update via myAadhaar
1. Visit https://uidai.gov.in/ and navigate to **My Aadhaar → Update Demographics Data & Check Status** (https://myaadhaar.uidai.gov.in/).
2. Click **Login**, enter your 12-digit Aadhaar number and Captcha, and authenticate with the 6-digit OTP.
3. Select **Address Update → Update Aadhaar Online** (or **Head of Family (HoF) based Address Update** if you lack POA in your own name).
4. Review your existing address and type the new Care Of (C/O), House/Building, Street, Landmark, PIN code, Post Office, and District carefully—the regional language field auto-transliterates and should be verified word by word.
5. Upload your valid POA PDF/image scan, tick the declaration, and pay the **₹50** non-refundable online fee via UPI, net banking, or card.
6. Save the generated **Service Request Number (SRN)** (format: *S1234567890123*) to track approval.

## Head of Family (HoF) Address Update Route
For spouses, children, or tenants sharing an immediate family member's address, select **HoF-based Address Update**, enter the HoF's Aadhaar number, upload a Relationship Proof (Marriage Certificate, Birth Certificate, or Ration Card), pay ₹50, and have the HoF approve the request inside their own myAadhaar login within 30 days.

## Processing Timeline & Rejection Tips
Most online address requests clear within **7 to 15 days**. Always ensure the scanned POA is readable, uncropped, in your own name, and matches every PIN code and house number typed into the form.`,
    category: 'Aadhaar Card',
    tags: ['Aadhaar Address Update', 'myAadhaar', 'SRN', 'HoF Update'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Identity Compliance Lead',
    publishedAt: '2026-11-13T15:00:00Z',
    updatedAt: '2026-11-13T15:00:00Z',
    readingTimeMinutes: 4,
    relatedServiceSlug: 'digilocker-document-retrieval',
    seoTitle: 'How to Update Aadhaar Address Online — Fees, Docs & HoF Steps',
    seoDescription:
      'Step-by-step UIDAI myAadhaar guide to updating your Aadhaar address online with valid POA or Head of Family consent, SRN tracking, and ₹50 fee.',
    focusKeyword: 'update Aadhaar address online',
    faqItems: [
      {
        question: 'How much does an online Aadhaar address update cost?',
        answer:
          'UIDAI charges a statutory fee of ₹50 (inclusive of GST) for updating your address online via myAadhaar.',
      },
      {
        question: 'Can I use an unregistered rent agreement for Aadhaar address change?',
        answer:
          'No. UIDAI requires a registered Rent/Lease Agreement for address updates; unregistered or plain notarized agreements are routinely rejected.',
      },
    ],
  },
  {
    id: 'blog-004-correct-name-in-aadhaar',
    slug: 'how-to-correct-name-in-aadhaar-card',
    title: 'How to Correct Name in Aadhaar Card',
    titleHi: 'आधार कार्ड में नाम (Name) कैसे सुधारें',
    excerpt:
      'Understand UIDAI rules for Aadhaar name correction, minor spelling fixes vs full name changes via Gazette, the two-time lifetime limit, and ASK booking.',
    excerptHi:
      'आधार में नाम की वर्तनी सुधारने या विवाह/गजट के बाद पूरा नाम बदलने की सीमा, आवश्यक पहचान प्रमाण और सेवा केंद्र प्रक्रिया जानें।',
    content: `## UIDAI Limits on Name Changes in Aadhaar
UIDAI enforces strict anti-fraud rules on demographic updates: citizens can change their **name in Aadhaar at most twice (2 times) in their lifetime**. Minor phonetic/spelling fixes (such as correcting *Suresh* from *Suressh* or expanding initials) follow standard POI verification, whereas a complete name change requires an official **Gazette of India Notification**.

## Accepted Documents for Name Correction
- **Minor Spelling / Post-Marriage Change:** Valid Indian Passport, PAN Card, Voter ID, Driving Licence, or Registered Marriage Certificate alongside an approved photo ID
- **Complete / Full Name Change:** Central or State Official Gazette Notification published by the Department of Publication, accompanied by your old photo ID document
- **Important Note:** Self-service online name updates on myAadhaar have been restricted by UIDAI—you must visit an authorized **Aadhaar Seva Kendra (ASK)** in person for biometric authentication.

## Step-by-Step Name Correction Procedure
1. Book an appointment at https://uidai.gov.in/ → **My Aadhaar → Book an Appointment**, selecting **Demographic Update (Name)**.
2. Gather original POI documents showing the **exact desired spelling** (do not bring photocopies alone—originals are scanned live).
3. At the centre, provide your Aadhaar number and verify via live fingerprint/iris biometric scan.
4. Instruct the operator carefully on exact spacing, middle name order, and regional transliteration spelling, then verify the printed confirmation screen.
5. Pay the standard statutory demographic update fee of **₹50** and keep the **Update Request Number (URN)** receipt safely.

## Fixing Mismatches Across PAN & Passport
Because Income Tax and Passport Seva cross-verify Aadhaar data automatically character-for-character, align your Aadhaar spelling with your Class 10 marksheet or Gazette notification first. If you need help publishing a legal Gazette notification before updating Aadhaar, Digital India Project provides end-to-end Gazette filing assistance at https://digitalindiaproject.com/services/gazette-name-change.`,
    category: 'Aadhaar Card',
    tags: ['Aadhaar Name Correction', 'Gazette Name Change', 'UIDAI ASK', 'POI'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Legal Documentation Counsel',
    publishedAt: '2026-11-13T12:00:00Z',
    updatedAt: '2026-11-13T12:00:00Z',
    readingTimeMinutes: 4,
    relatedServiceSlug: 'gazette-name-change',
    seoTitle: 'How to Correct Name in Aadhaar Card — UIDAI Rules & Docs',
    seoDescription:
      'Learn how to fix spelling errors or legally change your full name in Aadhaar at an Aadhaar Seva Kendra, including Gazette rules and the 2-time limit.',
    focusKeyword: 'correct name in Aadhaar',
    faqItems: [
      {
        question: 'How many times can I update my name in Aadhaar?',
        answer:
          'UIDAI permits a maximum of two (2) name updates over a resident’s lifetime. Beyond that, updates require a special exception approval from the UIDAI Regional Office.',
      },
      {
        question: 'Can I correct my name in Aadhaar online from home?',
        answer:
          'Currently UIDAI routes name corrections through physical Aadhaar Seva Kendras so original photo IDs and Gazette proofs can be verified alongside live biometrics.',
      },
    ],
  },
  {
    id: 'blog-005-change-dob-in-aadhaar',
    slug: 'how-to-change-date-of-birth-in-aadhaar-card',
    title: 'How to Change Date of Birth in Aadhaar Card',
    titleHi: 'आधार कार्ड में जन्मतिथि (Date of Birth) कैसे बदलें',
    excerpt:
      'Know UIDAI’s once-in-a-lifetime Date of Birth update policy, mandatory verified DOB proofs, ASK biometric submission, and Regional Office exception rules.',
    excerptHi:
      'आधार कार्ड में जन्मतिथि अपडेट करने की एक-बार की सीमा, वैध जन्म प्रमाणपत्र और विशेष अपवाद (Exception) प्रक्रिया समझें।',
    content: `## Strict Once-in-a-Lifetime DOB Limit
Under UIDAI policy, a resident can update their **Date of Birth (DOB)** in Aadhaar **only once (1 time) in a lifetime**, and only if the DOB status is unverified or marked approximate—or if you hold documentary proof establishing a genuine clerical error at enrolment.

## Valid Proof of Date of Birth (PDB) Documents
Only UIDAI-approved original PDB documents bearing your full name and exact date of birth are accepted:
- Official **Birth Certificate** issued by Municipal Corporation / Registrar of Births & Deaths (CRSORGI)
- Valid **Indian Passport**
- **SSLC / Class 10 Board Marksheet** or Certificate issued by a recognized central/state university or board
- **PAN Card** (note: check current UIDAI list, as Birth Certificate/Passport/Matriculation remain strongest)
- Service Photo Identity Card issued by Central/State Government

## Step-by-Step DOB Update Process
1. Confirm your DOB update quota has not already been exhausted; second-time DOB updates are automatically flagged as **Crossed Limit** by UIDAI servers.
2. Visit https://uidai.gov.in/ and book an Aadhaar Seva Kendra slot for **Demographic Update → Date of Birth**.
3. Carry your original Birth Certificate, Passport, or Class 10 Certificate—photocopies without originals will be rejected at the counter.
4. Complete biometric authentication, verify the new DD/MM/YYYY date on screen, pay **₹50**, and obtain your **URN slip**.
5. Track approval on myAadhaar within 15 to 30 days.

## Handling Cross-Limit DOB Rejection (UIDAI Exception Process)
If your Aadhaar DOB was previously locked or updated once and still differs from your Birth Certificate or Passport, your update request will fail with a cross-limit error. In that case, email **help@uidai.gov.in** or visit your nearest **UIDAI Regional Office (RO)** carrying the rejection slip, your newly generated URN, original Birth Certificate, and a signed Exception Form requesting manual verification.`,
    category: 'Aadhaar Card',
    tags: ['Aadhaar DOB Update', 'Birth Certificate', 'UIDAI Exception', 'PDB'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Identity Compliance Lead',
    publishedAt: '2026-11-13T09:00:00Z',
    updatedAt: '2026-11-13T09:00:00Z',
    readingTimeMinutes: 4,
    relatedServiceSlug: 'pan-correction',
    seoTitle: 'How to Change Date of Birth in Aadhaar Card — Limit & Exception',
    seoDescription:
      'Complete guide to updating Date of Birth in Aadhaar once in a lifetime: accepted Birth Certificate/Passport/10th docs and Regional Office cross-limit resolution.',
    focusKeyword: 'change date of birth in Aadhaar',
    faqItems: [
      {
        question: 'Can I change my Aadhaar Date of Birth more than once?',
        answer:
          'Standard UIDAI policy allows only one DOB change in a lifetime. Any subsequent correction requires physical document verification at a UIDAI Regional Office under the Exception Handling process.',
      },
      {
        question: 'How long does UIDAI take to approve a DOB update?',
        answer:
          'Verified Date of Birth updates typically complete within 15 to 30 days after biometric submission at an Aadhaar Seva Kendra.',
      },
    ],
  },
  {
    id: 'blog-006-update-mobile-number-in-aadhaar',
    slug: 'how-to-update-mobile-number-in-aadhaar-card',
    title: 'How to Update Mobile Number in Aadhaar Card',
    titleHi: 'आधार कार्ड में मोबाइल नंबर कैसे जोड़ें या बदलें',
    excerpt:
      'Why linking your active mobile number with Aadhaar requires biometric verification at an ASK or IPPB doorstep service, fees, and turnaround time.',
    excerptHi:
      'आधार में नया मोबाइल नंबर लिंक या अपडेट करने के लिए सेवा केंद्र अपॉइंटमेंट, बायोमेट्रिक सत्यापन और ₹50 शुल्क की पूरी जानकारी।',
    content: `## Why Your Active Mobile Number Must Be Linked
Nearly every digital service in India—e-Aadhaar download, DigiLocker authentication, Income Tax e-Verify, Instant e-PAN, EPFO UAN claims, and PM-KISAN e-KYC—sends an OTP exclusively to your Aadhaar-registered mobile number.

## Can You Update Aadhaar Mobile Number Online?
**No.** For resident security against SIM-swap and unauthorized OTP hijacking, UIDAI does **not** allow adding or changing an Aadhaar mobile number online via OTP. Live biometric (fingerprint or iris) confirmation at an authorized centre is mandatory. You do **not** need your old phone number or any address/ID documents to update your mobile number.

## Method 1: Book an Appointment at Aadhaar Seva Kendra
1. Open https://uidai.gov.in/ → **My Aadhaar → Book an Appointment**.
2. Choose **UIDAI-run Aadhaar Seva Kendra** or Registrar-run centre (Bank / Post Office).
3. Enter any temporary active mobile number + Captcha to receive a booking OTP.
4. Select **Aadhaar Update → Mobile Number Update**, pick a date/time, and visit the centre carrying your Aadhaar number.
5. Verify fingerprints/iris, enter your new 10-digit mobile number, pay the statutory **₹50** fee, and keep the URN slip.

## Method 2: India Post Payments Bank (IPPB) Doorstep Request
India Post's **CELC (Child Enrolment Lite Client)** postmen offer doorstep mobile number updates for elderly, bedridden, or busy citizens via the **PostInfo** app or IPPB service portal. A nominal doorstep service charge applies in addition to the ₹50 UIDAI fee.

## Checking Activation Time
Mobile number updates usually synchronize across UIDAI servers within **5 to 15 days** (maximum 30 days). Verify your updated linkage immediately via https://myaadhaar.uidai.gov.in/ → **Verify Email/Mobile Number**.`,
    category: 'Aadhaar Card',
    tags: ['Aadhaar Mobile Update', 'IPPB Aadhaar', 'UIDAI ASK', 'OTP'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Identity Compliance Lead',
    publishedAt: '2026-11-12T20:00:00Z',
    updatedAt: '2026-11-12T20:00:00Z',
    readingTimeMinutes: 3,
    relatedServiceSlug: 'digilocker-document-retrieval',
    seoTitle: 'How to Update Mobile Number in Aadhaar Card — ASK & IPPB Guide',
    seoDescription:
      'Step-by-step instructions to link or change your mobile number in Aadhaar via Aadhaar Seva Kendra or India Post doorstep service, fees, and verification.',
    focusKeyword: 'update mobile number in Aadhaar',
    faqItems: [
      {
        question: 'Do I need documents to change my mobile number in Aadhaar?',
        answer:
          'No physical documents are required for a mobile number update—only your Aadhaar number and live fingerprint/iris authentication at the centre.',
      },
      {
        question: 'Is my old mobile number needed to link a new number?',
        answer:
          'No. Even if your old SIM is lost or deactivated, you can link a brand-new mobile number through biometric authentication.',
      },
    ],
  },
  {
    id: 'blog-007-check-aadhaar-update-status',
    slug: 'how-to-check-aadhaar-update-status',
    title: 'How to Check Aadhaar Update Status',
    titleHi: 'आधार अपडेट स्टेटस ऑनलाइन कैसे चेक करें',
    excerpt:
      'Track your Aadhaar enrolment or demographic/address update status online using your 28-digit EID, 14-digit URN, or myAadhaar Service Request Number (SRN).',
    excerptHi:
      '28-अंकीय EID, URN या SRN नंबर की मदद से अपने आधार कार्ड अपडेट और पीवीसी ऑर्डर की लाइव स्थिति जांचें।',
    content: `## Tracking Identifiers Explained
Every time you enrol for a new Aadhaar or request an update, UIDAI issues a tracking code on your acknowledgement slip:
- **EID (Enrolment ID):** 14-digit enrolment number + 14-digit date-timestamp (*YYYYMMDDHHMMSS*) = **28 digits**
- **URN (Update Request Number):** 14-digit number printed on Aadhaar Seva Kendra update receipts
- **SRN (Service Request Number):** Starts with **S** followed by digits, issued when updating address or ordering a PVC card online

## Step-by-Step Status Check on UIDAI Portal
1. Visit https://uidai.gov.in/ and click **My Aadhaar → Check Aadhaar Status** (opens https://myaadhaar.uidai.gov.in/CheckAadhaarStatus).
2. Enter your complete 28-digit EID, 14-digit URN, or SRN accurately without spaces or slashes.
3. Solve the Captcha and click **Submit**.
4. Review the live stage returned by UIDAI: *Draft/Submitted*, *Payment Pending*, *Verification Stage*, *Validation Stage*, or *Completed*.

## What Different UIDAI Status Messages Mean
- **Under Process / Validation Stage:** Your scan is in UIDAI's backend quality-check queue; normally clears in 7–30 days.
- **Rejected due to Data/Document Error:** Either the original scan was blurry, mismatched the typed field, or lacked a valid supporting proof—re-apply with a clean original document.
- **Rejected due to Crossed Limit:** You attempted to change Name (>2 times), DOB (>1 time), or Gender (>1 time) beyond the lifetime cap; file an Exception request with UIDAI Regional Office.
- **Your Aadhaar has been generated / updated:** Download the fresh e-Aadhaar PDF immediately without waiting for the postal letter.

## Alternative Support Channels
If an update stays stuck beyond 30 days, call UIDAI's toll-free helpline **1947** or log a grievance on the myAadhaar **File a Complaint** dashboard using your URN/SRN.`,
    category: 'Aadhaar Card',
    tags: ['Aadhaar Status', 'Check URN', 'EID Tracking', 'SRN Status'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Identity Compliance Lead',
    publishedAt: '2026-11-12T17:00:00Z',
    updatedAt: '2026-11-12T17:00:00Z',
    readingTimeMinutes: 3,
    relatedServiceSlug: 'pan-card',
    seoTitle: 'How to Check Aadhaar Update Status Online Using EID, URN or SRN',
    seoDescription:
      'Track your Aadhaar enrolment or update request online on UIDAI myAadhaar with EID, URN, or SRN and decode common rejection messages.',
    focusKeyword: 'check Aadhaar update status',
    faqItems: [
      {
        question: 'Why does the UIDAI portal say Invalid EID when I enter my slip details?',
        answer:
          'Check the timestamp order: UIDAI requires the 14-digit enrolment number followed by YYYYMMDDHHMMSS (Year first, then Month, Day, Hour, Minute, Second), even if the printed slip shows DD/MM/YYYY.',
      },
    ],
  },
  {
    id: 'blog-008-order-aadhaar-pvc-card',
    slug: 'how-to-order-an-aadhaar-pvc-card',
    title: 'How to Order an Aadhaar PVC Card',
    titleHi: 'आधार PVC कार्ड ऑनलाइन ऑर्डर कैसे करें',
    excerpt:
      'Order UIDAI’s durable, wallet-sized Aadhaar PVC Card with hologram and ghost image for just ₹50—even without a registered mobile number.',
    excerptHi:
      'सिर्फ ₹50 में होलोग्राम और क्यूआर कोड वाला टिकाऊ आधार पीवीसी कार्ड ऑनलाइन मंगवाएं, बिना रजिस्टर्ड मोबाइल के भी उपलब्ध।',
    content: `## Why Choose Official UIDAI Aadhaar PVC Card?
Unlike unauthorized market lamination of downloaded slips, the official **Aadhaar PVC Card** issued by UIDAI contains tamper-proof security elements accepted across every bank and government agency:
- Secure digital QR code with offline signature verification
- Hologram, Guilloche pattern, Ghost image, and Micro-text
- Embossed Aadhaar logo and printed Issue/Print date on waterproof, wallet-sized PVC plastic

## Step-by-Step Process to Order Online
1. Visit https://uidai.gov.in/ and select **My Aadhaar → Order Aadhaar PVC Card**.
2. Enter your 12-digit **Aadhaar Number** (or 28-digit Enrolment ID) and the Security Captcha.
3. **If mobile IS linked:** Click *Send OTP*, enter the 6-digit OTP, preview your live photo and address, and proceed to payment.
4. **If mobile is NOT linked:** Tick **"My mobile number is not registered"**, type any alternate mobile number to receive a delivery/order OTP, and verify (note: demographic preview is hidden for privacy when using an unlinked mobile).
5. Confirm the terms and pay **₹50** (inclusive of GST and India Post Speed Post charges) via UPI, Debit/Credit Card, or Net Banking.
6. Download the payment receipt containing your **SRN** to track Speed Post dispatch.

## Delivery Timeline & India Post Tracking
UIDAI hands printed PVC cards to **India Post Speed Post** within 5 working days of payment, and doorstep delivery typically reaches your registered Aadhaar address within **7 to 15 days**. Track dispatch airway bill details under **Check Aadhaar PVC Card Order Status** on https://myaadhaar.uidai.gov.in/.`,
    category: 'Aadhaar Card',
    tags: ['Aadhaar PVC Card', 'UIDAI PVC', 'Speed Post', 'Security Features'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Identity Compliance Lead',
    publishedAt: '2026-11-12T14:00:00Z',
    updatedAt: '2026-11-12T14:00:00Z',
    readingTimeMinutes: 3,
    relatedServiceSlug: 'digilocker-document-retrieval',
    seoTitle: 'Order Aadhaar PVC Card Online for ₹50 — UIDAI Speed Post Guide',
    seoDescription:
      'Step-by-step guide to ordering the official UIDAI Aadhaar PVC Card online for ₹50, including ordering without a registered mobile number and tracking Speed Post.',
    focusKeyword: 'order Aadhaar PVC card',
    faqItems: [
      {
        question: 'Can I order an Aadhaar PVC card to a custom address different from my Aadhaar?',
        answer:
          'No. For security reasons, UIDAI dispatches the PVC card strictly to the residential address currently recorded in the Aadhaar database.',
      },
    ],
  },
  {
    id: 'blog-009-lock-unlock-aadhaar-biometrics',
    slug: 'how-to-lock-and-unlock-aadhaar-biometrics',
    title: 'How to Lock and Unlock Aadhaar Biometrics',
    titleHi: 'आधार बायोमेट्रिक लॉक और अनलॉक कैसे करें',
    excerpt:
      'Protect your bank account and AEPS transactions from unauthorized fingerprint misuse by locking your Aadhaar biometrics—and learn temporary 10-minute unlock steps.',
    excerptHi:
      'AEPS और फिंगरप्रिंट धोखाधड़ी से बचने के लिए अपने आधार बायोमेट्रिक डेटा को सुरक्षित रूप से लॉक और जरूरत पड़ने पर अस्थायी रूप से अनलॉक करें।',
    content: `## Why Biometric Locking Prevents AEPS Fraud
Every Aadhaar card carries fingerprint, iris, and facial biometric markers used for Aadhaar Enabled Payment System (AEPS) banking, SIM issuance, and e-KYC. Enabling **Biometric Lock** blocks any third-party from authenticating your fingerprints or iris until you explicitly unlock it—while still letting you use **OTP** and **Virtual ID** normally.

## Prerequisite: Generate Your 16-Digit Virtual ID (VID)
Before locking your biometrics (or locking your entire Aadhaar), UIDAI requires an active **16-digit VID**:
1. Log into https://myaadhaar.uidai.gov.in/ using Aadhaar OTP.
2. Click **VID Generator** and generate/retrieve your 16-digit Virtual ID via SMS.

## Step-by-Step Biometric Lock & Unlock Process
1. Visit https://uidai.gov.in/ → **My Aadhaar → Lock/Unlock Biometrics**.
2. Click **Next**, enter your 16-digit VID (or login directly via myAadhaar), verify Captcha, and complete OTP authentication.
3. Click **Enable Biometric Locking**—your fingerprints and iris are immediately shielded across India's CIDR database.
4. **When you need biometric authentication (e.g., property registration or banking):** Log back in and choose **Unlock Biometrics Temporarily** (auto-locks again after ~10 minutes) or **Disable Biometric Lock** permanently.

## Lock Biometrics vs Lock Aadhaar Number
- **Lock Biometrics:** Keeps OTP authentication active while blocking fingerprint/iris scans (recommended for almost all citizens).
- **Lock Aadhaar:** Blocks *both* OTP and biometric use with your 12-digit Aadhaar number; only your 16-digit VID can authenticate until unlocked.

## What If You Forget Your VID While Locked?
Simply send an SMS from your registered mobile to **1947** in the format \`RVID <Last 4 or 8 digits of Aadhaar>\` to retrieve your active Virtual ID instantly.`,
    category: 'Aadhaar Card',
    tags: ['Aadhaar Security', 'Biometric Lock', 'AEPS Protection', 'Virtual ID'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Identity Compliance Lead',
    publishedAt: '2026-11-12T11:00:00Z',
    updatedAt: '2026-11-12T11:00:00Z',
    readingTimeMinutes: 4,
    relatedServiceSlug: 'b2b-bulk-verification',
    seoTitle: 'How to Lock and Unlock Aadhaar Biometrics — Stop AEPS Fraud',
    seoDescription:
      'Protect your Aadhaar fingerprints and iris scans using UIDAI Biometric Lock. Learn VID generation, temporary unlocking, and SMS 1947 recovery.',
    focusKeyword: 'lock Aadhaar biometrics',
    faqItems: [
      {
        question: 'Will my Aadhaar OTP stop working if I lock my biometrics?',
        answer:
          'No. Locking biometrics only blocks fingerprint and iris authentication. Mobile OTP services like e-Aadhaar download and DigiLocker continue working normally.',
      },
    ],
  },
  {
    id: 'blog-010-retrieve-lost-aadhaar-or-eid',
    slug: 'how-to-retrieve-lost-aadhaar-number-or-enrolment-id',
    title: 'How to Retrieve Lost Aadhaar Number or Enrolment ID',
    titleHi: 'खोया हुआ आधार नंबर या नामांकन आईडी (EID) वापस कैसे पाएं',
    excerpt:
      'Misplaced both your Aadhaar card and acknowledgement slip? Recover your 12-digit Aadhaar number or 28-digit EID online via UIDAI, IVRS 1947, or Regional Office.',
    excerptHi:
      'यदि आपका आधार कार्ड और नामांकन रसीद दोनों खो गए हैं, तो मोबाइल नंबर या हेल्पलाइन 1947 से अपना नंबर पुनः प्राप्त करने के तरीके जानें।',
    content: `## Recovering a Lost Aadhaar Without Slip or Card Number
Misplacing your Aadhaar card and original enrolment slip does not require fresh enrolment—in fact, UIDAI prohibits duplicate enrolments and will reject them under biometric deduplication. Instead, use UIDAI's official retrieval tools.

## Method 1: Online Retrieval (If Mobile/Email Is Registered)
1. Visit https://uidai.gov.in/ and navigate to **My Aadhaar → Retrieve Lost or Forgotten EID/UID**.
2. Choose whether you want to recover **Aadhaar Number (UID)** or **Enrolment ID (EID)**.
3. Enter your **Full Name** exactly as registered, along with either your **Registered Mobile Number** or **Registered Email Address**, plus the Captcha.
4. Click **Send OTP** and enter the 6-digit verification code.
5. UIDAI immediately sends your 12-digit Aadhaar Number or Enrolment ID via SMS/email, after which you can download e-Aadhaar immediately.

## Method 2: Toll-Free Helpline 1947 (Without Registered Mobile)
If your mobile number was never linked or has been deactivated:
1. Dial **1947** from any phone and speak to a UIDAI customer care executive.
2. Provide your exact Full Name, Date of Birth, PIN Code, and Enrolment Centre details.
3. Once verified against demographic records, the executive provides your **Enrolment ID (EID)**, which you can then use to order an Aadhaar PVC card (using the unregistered-mobile option) or visit an ASK with biometrics.

## Method 3: Resident Biometric Search at Aadhaar Seva Kendra
Visit any permanent Aadhaar Seva Kendra with an original photo ID; authorized operators or UIDAI Regional Office desks can locate your existing UID using demographic filters and issue a print/update slip.`,
    category: 'Aadhaar Card',
    tags: ['Lost Aadhaar', 'Retrieve EID', 'UIDAI 1947', 'Identity Recovery'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Identity Compliance Lead',
    publishedAt: '2026-11-12T08:00:00Z',
    updatedAt: '2026-11-12T08:00:00Z',
    readingTimeMinutes: 3,
    relatedServiceSlug: 'digilocker-document-retrieval',
    seoTitle: 'Retrieve Lost Aadhaar Number or EID Online & Via 1947 Helpline',
    seoDescription:
      'Recover your forgotten 12-digit Aadhaar number or 28-digit Enrolment ID online via UIDAI Retrieve EID/UID tool or by calling 1947.',
    focusKeyword: 'retrieve lost Aadhaar number',
    faqItems: [
      {
        question: 'Can I apply for a brand-new Aadhaar if I lost my old card and number?',
        answer:
          'No. Because Aadhaar captures unique biometrics, applying again triggers a Duplicate Enrolment rejection. Always retrieve your existing UID/EID instead.',
      },
    ],
  },

  // ==========================================
  // 2. PAN CARD — ARTICLES 11 TO 20
  // Official Portals:
  // - https://www.incometax.gov.in/
  // - https://www.pan.utiitsl.com/
  // - https://www.protean-tinpan.com/
  // ==========================================
  {
    id: 'blog-011-apply-new-pan-card-online',
    slug: 'how-to-apply-for-a-new-pan-card-online',
    title: 'How to Apply for a New PAN Card Online',
    titleHi: 'नए पैन कार्ड के लिए ऑनलाइन आवेदन कैसे करें (Form 49A)',
    excerpt:
      'Detailed walkthrough to apply for a fresh 10-digit PAN card online using Form 49A via Protean (NSDL) or UTIITSL portals, fees, e-Sign, and Digital India Project filing.',
    excerptHi:
      'Protean (NSDL) या UTIITSL के माध्यम से फॉर्म 49A भरकर नया पैन कार्ड ऑनलाइन बनवाने, दस्तावेज़, ई-साइन और शुल्क की पूरी जानकारी।',
    content: `## What Form 49A Covers
Every Indian citizen, HUF, partnership firm, company, or trust earning taxable income, opening bank/Demat accounts, or investing above threshold limits requires a 10-character alphanumeric **Permanent Account Number (PAN)** issued under the Income Tax Act. Resident applicants file **Form 49A** (while NRIs/foreign citizens file **Form 49AA**).

## Official Application Portals
- **Protean (formerly NSDL e-Gov):** https://www.protean-tinpan.com/
- **UTIITSL:** https://www.pan.utiitsl.com/
- **Assisted Filing Desk:** https://digitalindiaproject.com/services/pan-card

## Mandatory Documents Checklist
- **Proof of Identity, Address & DOB:** Aadhaar Card (supports paperless e-KYC/e-Sign), Indian Passport, Voter ID, Driving Licence, or Birth Certificate
- **Photographs & Signature:** Two recent color passport photos (white background) and a clear black-ink signature scan (required if not using purely Aadhaar paperless e-KYC photo)
- **For Firms/Companies:** Partnership Deed, Certificate of Incorporation, or MSME/Shop Act certificate

## Step-by-Step Online Filing Process
1. Visit Protean (https://www.protean-tinpan.com/) or UTIITSL (https://www.pan.utiitsl.com/) and select **Apply Online → New PAN – Indian Citizen (Form 49A)**.
2. Choose your Applicant Category (*Individual*, *HUF*, *Company*, etc.), enter Name, Date of Birth, Email, and Mobile to generate a temporary **Token Number**.
3. Pick submission mode: **Submit digitally through e-KYC & e-Sign (Paperless)** using Aadhaar OTP, or **Submit scanned images through e-Sign**.
4. Enter Father's Name (printed on card), Income source, Residential/Office Address, and exact **AO Code** (Area Code, AO Type, Range Code, AO Number—searchable built into the form).
5. Pay the statutory fee (**~₹101–₹107** for Indian dispatch; ~₹1,017 for foreign dispatch) via UPI or Net Banking and authenticate via final **Aadhaar e-Sign OTP**.

## Delivery Timeline & Assisted Error-Free Review
Paperless e-KYC applications normally deliver the digital **e-PAN** to your email within **48–72 hours**, followed by the physical PVC PAN card via India Post in **7–14 days**. For guided AO code selection and pre-submission verification, submit via Digital India Project.`,
    category: 'PAN Card',
    tags: ['New PAN Card', 'Form 49A', 'Protean NSDL', 'UTIITSL'],
    status: 'published',
    featured: true,
    authorName: 'Suraj Singh',
    authorRole: 'Tax & Identity Compliance Lead',
    publishedAt: '2026-11-13T17:00:00Z',
    updatedAt: '2026-11-13T17:00:00Z',
    readingTimeMinutes: 4,
    relatedServiceSlug: 'pan-card',
    seoTitle: 'How to Apply for a New PAN Card Online (Form 49A) — 2026 Guide',
    seoDescription:
      'Step-by-step Form 49A online application guide for a new PAN card via Protean NSDL and UTIITSL, AO code lookup, Aadhaar e-KYC, fees, and dispatch times.',
    focusKeyword: 'apply for new PAN card',
    faqItems: [
      {
        question: 'Which name is printed on a PAN card—First Name or Father Name?',
        answer:
          'Individual PAN cards print your Full Name along with your Father’s Name (even for married women, unless a Mother’s Name exception applies for single parents).',
      },
      {
        question: 'Can I apply for a second PAN card if I misplaced the old one?',
        answer:
          'No. Holding two PAN numbers attracts a ₹10,000 penalty under Section 272B of the Income Tax Act. Always request a Reprint or Duplicate PAN instead.',
      },
    ],
  },
  {
    id: 'blog-012-instant-epan-using-aadhaar',
    slug: 'how-to-apply-for-instant-e-pan-using-aadhaar',
    title: 'How to Apply for Instant e-PAN Using Aadhaar',
    titleHi: 'आधार से तुरंत (Instant) e-PAN कार्ड कैसे बनाएं — बिल्कुल मुफ्त',
    excerpt:
      'Generate a free, legally valid Instant e-PAN in 10 minutes on the Income Tax e-Filing portal using Aadhaar OTP—know eligibility, PDF download, and physical card limits.',
    excerptHi:
      'इनकम टैक्स पोर्टल से आधार OTP के ज़रिए 10 मिनट में मुफ्त Instant e-PAN प्राप्त करने की प्रक्रिया और सीमाएं जानें।',
    content: `## Zero-Cost Instant e-PAN Service
The Income Tax Department provides a **completely free Instant e-PAN** allotment facility on its official e-Filing portal (https://www.incometax.gov.in/) for individual taxpayers who have never been allotted a PAN earlier.

## Strict Eligibility Rules
- Applicant must be an **Individual adult citizen** (minors, HUFs, and firms are ineligible)
- Must **never** have possessed a PAN card previously (duplicate allotment is illegal)
- Your **Aadhaar card must have an active mobile number** linked for OTP authentication, and complete Date of Birth (DD-MM-YYYY) recorded on Aadhaar

## Step-by-Step Allotment Process
1. Go to https://www.incometax.gov.in/ and click **Instant e-PAN** under **Quick Links** on the left sidebar.
2. Select **Get New e-PAN**.
3. Enter your 12-digit **Aadhaar Number**, read the consent checkbox confirming you hold no prior PAN, and click **Continue**.
4. Enter the 6-digit OTP received on your Aadhaar-linked mobile number.
5. Verify your pre-fetched Name, Date of Birth, Gender, and Address fetched from UIDAI, validate your email (optional but recommended), and submit.
6. Note down the **15-digit Acknowledgement Number** immediately.

## Downloading & Important Limitations to Know
Your new PAN is usually generated within **10 to 30 minutes**. Return to the **Instant e-PAN → Check Status / Download PAN** section with Aadhaar OTP to download the PDF. Keep in mind that Instant e-PAN **does not include your Father's Name or signature** and does **not dispatch a plastic card**. To add a signature, Father's Name, and receive a physical card later, file a standard PAN Update/Reprint request.`,
    category: 'PAN Card',
    tags: ['Instant e-PAN', 'Income Tax Portal', 'Free PAN', 'Aadhaar OTP'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Tax & Identity Compliance Lead',
    publishedAt: '2026-11-13T14:00:00Z',
    updatedAt: '2026-11-13T14:00:00Z',
    readingTimeMinutes: 4,
    relatedServiceSlug: 'pan-card',
    seoTitle: 'Apply for Instant e-PAN Using Aadhaar Free in 10 Minutes',
    seoDescription:
      'Generate an Instant e-PAN free of cost via https://www.incometax.gov.in/ using Aadhaar OTP. Check eligibility, acknowledgement tracking, and signature upgrade rules.',
    focusKeyword: 'Instant e-PAN using Aadhaar',
    faqItems: [
      {
        question: 'Is Instant e-PAN valid for opening bank accounts and filing ITR?',
        answer:
          'Yes. Under Income Tax Notification rules, Instant e-PAN carries the exact same legal weight as a physical PAN card across banks, SEBI KYC, and ITR filings.',
      },
      {
        question: 'Why does my Instant e-PAN not show a signature?',
        answer:
          'Instant e-PAN pulls only UIDAI demographic data and photo, which lacks a wet signature scan. You can apply for a PAN Update via Form CSF anytime to add your signature and receive a PVC card.',
      },
    ],
  },
  {
    id: 'blog-013-download-epan-card-online',
    slug: 'how-to-download-e-pan-card-online',
    title: 'How to Download e-PAN Card Online',
    titleHi: 'e-PAN कार्ड ऑनलाइन डाउनलोड कैसे करें (NSDL, UTIITSL & Income Tax)',
    excerpt:
      'Download your digital e-PAN PDF online from Protean (NSDL), UTIITSL, or the Income Tax portal using your PAN or Acknowledgement Number—plus the PDF password format.',
    excerptHi:
      'Protean, UTIITSL और इनकम टैक्स पोर्टल से अपना डिजिटल e-PAN PDF डाउनलोड करने और DDMMYYYY पासवर्ड खोलने की आसान विधि।',
    content: `## Choosing the Right Download Portal
Your e-PAN download portal depends on **who originally processed your PAN card** (printed on the back of your card or acknowledgement slip):
- **Protean (NSDL):** https://www.protean-tinpan.com/
- **UTIITSL:** https://www.pan.utiitsl.com/
- **Instant e-PAN (Income Tax Portal):** https://www.incometax.gov.in/

## Downloading via Protean (NSDL) or UTIITSL
1. Visit the **Download e-PAN** page on https://www.protean-tinpan.com/ or https://www.pan.utiitsl.com/.
2. Select whether you have your **10-digit PAN Number** or **Acknowledgement Number**.
3. Enter your **Date of Birth / Date of Incorporation** (DD/MM/YYYY) and Captcha.
4. Authenticate via OTP sent to your registered mobile number or email ID.
5. **Fee Rule:** Downloads within **30 days** of PAN allotment or update are **free**. Older e-PAN downloads incur a nominal **₹8.26** (inclusive of GST) online convenience charge.

## Downloading Instant e-PAN from Income Tax Portal
1. Open https://www.incometax.gov.in/ → **Instant e-PAN → Check Status / Download PAN**.
2. Enter your 12-digit Aadhaar number, verify the 6-digit OTP, and click **Download e-PAN**—completely free even after 30 days.

## Password to Open e-PAN PDF
Unlike Aadhaar (which uses Name+Year), your **e-PAN PDF password is your full Date of Birth or Incorporation in DDMMYYYY format** without any slashes or hyphens. Example: If your DOB is *14 August 1995*, enter **14081995**.`,
    category: 'PAN Card',
    tags: ['Download e-PAN', 'Protean PAN', 'UTIITSL e-PAN', 'PDF Password'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Tax & Identity Compliance Lead',
    publishedAt: '2026-11-13T11:00:00Z',
    updatedAt: '2026-11-13T11:00:00Z',
    readingTimeMinutes: 3,
    relatedServiceSlug: 'pan-card',
    seoTitle: 'How to Download e-PAN Card Online & Unlock DDMMYYYY Password',
    seoDescription:
      'Download your digital e-PAN card from Protean NSDL, UTIITSL, or Income Tax portal. Know the ₹8.26 fee rule after 30 days and the DDMMYYYY PDF password.',
    focusKeyword: 'download e-PAN card online',
    faqItems: [
      {
        question: 'What if I do not remember whether NSDL or UTIITSL issued my PAN?',
        answer:
          'Check the back of your physical PAN card or old allotment email. If unavailable, enter your PAN on Protean first—the system prompts you if the record belongs to UTIITSL.',
      },
    ],
  },
  {
    id: 'blog-014-correct-name-in-pan-card',
    slug: 'how-to-correct-name-in-pan-card',
    title: 'How to Correct Name in PAN Card',
    titleHi: 'पैन कार्ड में नाम या स्पेलिंग में सुधार (Correction) कैसे करें',
    excerpt:
      'Fix spelling mistakes, expand initials, or update your surname after marriage on your PAN card using Form CSF via Protean, UTIITSL, or Digital India Project.',
    excerptHi:
      'पैन कार्ड में नाम की गलती ठीक करने, इनिशियल पूरा करने या विवाह के बाद उपनाम बदलने के लिए Form CSF भरने की पूरी प्रक्रिया।',
    content: `## Why PAN Name Must Match Aadhaar Exactly
Income Tax e-Filing, Demat KYC, and bank PAN-Aadhaar verification systems compare your PAN database name against UIDAI Aadhaar records. Even an extra space, swapped middle name, or single-letter typo can trigger **PAN-Aadhaar linking failure** or Demat account freeze.

## Accepted Proofs for Name Correction
- **Minor Spelling / Initial Expansion:** Aadhaar Card, Indian Passport, Voter ID, Driving Licence, or Matriculation Certificate showing the full expanded spelling
- **Major / Full Name Change:** Central/State **Official Gazette Notification** + Newspaper clipping + Old PAN copy
- **Post-Marriage Surname Change:** Registered Marriage Certificate, Marriage Invitation with Passport showing spouse name, or Official Gazette Notification

## Step-by-Step Form CSF Correction Process
1. Visit https://www.protean-tinpan.com/ or https://www.pan.utiitsl.com/ and choose **Changes or Correction in Existing PAN Data**.
2. Enter your existing 10-digit PAN, DOB, Email, and Mobile to generate a token.
3. Tick the **checkbox beside "Full Name"** so the processing team explicitly updates the name field rather than treating it as a reprint.
4. Type your **First Name, Middle Name, and Last Name** exactly as printed on your Aadhaar and preferred ID proof—also verify **"Name you would like printed on the card"**.
5. Upload scanned proofs (or use Aadhaar paperless e-KYC when Aadhaar already carries the corrected spelling), pay **₹101–₹107**, and complete e-Sign.

## Processing Time & Verification
PAN name corrections typically resolve in **7 to 15 working days**, keeping your **10-digit PAN number unchanged**. For hassle-free document checking prior to submission, apply via Digital India Project PAN Correction assistance.`,
    category: 'PAN Card',
    tags: ['PAN Name Correction', 'Form CSF', 'Post Marriage Name', 'Aadhaar Match'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Tax & Identity Compliance Lead',
    publishedAt: '2026-11-12T22:00:00Z',
    updatedAt: '2026-11-12T22:00:00Z',
    readingTimeMinutes: 4,
    relatedServiceSlug: 'pan-correction',
    seoTitle: 'How to Correct Name in PAN Card Online — Form CSF & Docs',
    seoDescription:
      'Step-by-step guide to correcting name spelling, expanding initials, or updating surname after marriage in your PAN card via Protean/UTIITSL Form CSF.',
    focusKeyword: 'correct name in PAN card',
    faqItems: [
      {
        question: 'Does my 10-digit PAN number change after name correction?',
        answer:
          'No. Your 10-character PAN number stays permanent for life; only the Income Tax database record and card print are updated.',
      },
    ],
  },
  {
    id: 'blog-015-change-dob-in-pan-card',
    slug: 'how-to-change-date-of-birth-in-pan-card',
    title: 'How to Change Date of Birth in PAN Card',
    titleHi: 'पैन कार्ड में जन्मतिथि (Date of Birth) कैसे बदलें',
    excerpt:
      'Correct an incorrect Date of Birth printed on your PAN card using Form CSF, valid Birth Certificate or Class 10 Marksheet proofs, and avoid Income Tax scrutiny flags.',
    excerptHi:
      'पैन कार्ड में गलत छपी जन्मतिथि को जन्म प्रमाणपत्र, 10वीं अंकपत्र या पासपोर्ट के आधार पर ऑनलाइन सुधारने की पूरी विधि।',
    content: `## Impact of Date of Birth Mismatch on PAN
If your Date of Birth on PAN differs from your Aadhaar Card or Passport, PAN-Aadhaar linking will fail immediately, rendering your PAN **inoperative** under Section 139AA and attracting higher 20% TDS deductions on salaries, interest, and property sales.

## Mandatory Date of Birth Proofs Accepted by Protean & UTIITSL
Upload self-attested legible copies of one of the following government-verified records matching your corrected DOB:
- **Birth Certificate** issued by Municipal Authority / Registrar of Births & Deaths
- **Matriculation (Class 10) Certificate** or Marksheet from a recognized education board
- **Indian Passport** or **Aadhaar Card** (note: if Aadhaar also shows the wrong DOB, update Aadhaar first or provide Birth Certificate/Class 10 Certificate)
- Domicile Certificate issued by Government or Pension Payment Order

## Step-by-Step DOB Correction Filing
1. Open https://www.protean-tinpan.com/ or https://www.pan.utiitsl.com/ and select **Changes / Correction in Existing PAN Data (Form CSF)**.
2. Enter your existing PAN number, personal details, and select **Submit scanned images through e-Sign** if attaching a Birth Certificate/Class 10 Marksheet, or **Paperless e-KYC** if your Aadhaar already displays the accurate DOB.
3. Tick the **checkbox left of Date of Birth**, enter the accurate DD/MM/YYYY value, and also include an Aadhaar copy if you want PAN-Aadhaar records synchronized.
4. Pay the statutory fee (**~₹107**) and complete Aadhaar OTP e-Sign (or post physical documents to the NSDL/UTIITSL CPC if using physical mode).

## Avoiding Rejections
Wait for any prior Aadhaar DOB update to finish completely before applying for PAN DOB correction, and verify that the applicant name on your Birth Certificate matches your PAN record.`,
    category: 'PAN Card',
    tags: ['PAN DOB Correction', 'Form CSF', 'Section 139AA', 'Tax KYC'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Tax & Identity Compliance Lead',
    publishedAt: '2026-11-12T19:00:00Z',
    updatedAt: '2026-11-12T19:00:00Z',
    readingTimeMinutes: 3,
    relatedServiceSlug: 'pan-correction',
    seoTitle: 'How to Change Date of Birth in PAN Card — Form CSF Guide',
    seoDescription:
      'Fix Date of Birth errors on your PAN card online via Protean or UTIITSL Form CSF using Birth Certificate, Class 10 marksheet, or updated Aadhaar.',
    focusKeyword: 'change date of birth in PAN card',
    faqItems: [
      {
        question: 'Which document is most reliable for PAN Date of Birth correction?',
        answer:
          'A Municipal Birth Certificate, Class 10 Board Marksheet, or valid Passport—paired with an already corrected Aadhaar—prevents Income Tax discrepancy queries.',
      },
    ],
  },
  {
    id: 'blog-016-update-address-in-pan-card',
    slug: 'how-to-update-address-in-pan-card',
    title: 'How to Update Address in PAN Card',
    titleHi: 'पैन कार्ड में पता (Address) ऑनलाइन अपडेट कैसे करें',
    excerpt:
      'Update your communication and dispatch address in the Income Tax PAN database free via Aadhaar Address Update Facility or via Form CSF with new card dispatch.',
    excerptHi:
      'पैन कार्ड में नया पता अपडेट करने के लिए मुफ्त Aadhaar Address Update सेवा या नए कार्ड के साथ Form CSF प्रक्रिया जानें।',
    content: `## Does a PAN Card Show Your Address on the Front?
Although your residential address is **not printed on the physical PAN card**, the Income Tax Department stores your communication address for sending statutory notices, refunds, and reprinted cards. Keeping it updated prevents undelivered cards and missed tax communications.

## Method 1: Free Address Sync Using Aadhaar (No Physical Card Reprint)
Both **Protean (NSDL)** and **UTIITSL** offer a **Free PAN Address Update Facility** using UIDAI Aadhaar e-KYC:
1. Visit the **Address Update** facility on https://www.protean-tinpan.com/ or https://www.pan.utiitsl.com/.
2. Enter your **PAN**, **12-digit Aadhaar Number**, Email, and Mobile Number.
3. Verify via Aadhaar OTP—your current residential address stored in UIDAI automatically updates your Income Tax PAN database **at zero fee**.

## Method 2: Address Update + New Physical Card (Form CSF)
If your Aadhaar does not yet show the new address or you also need a fresh physical PAN card dispatched there:
1. Apply for **Changes / Correction in PAN Data (Form CSF)** via Protean or UTIITSL.
2. Tick the **"Address for Communication"** checkbox and enter your updated house number, street, city, state, and PIN code.
3. Upload a valid Proof of Address (Electricity/Water Bill <3 months old, Bank Statement, Passport, Voter ID, or Property Tax Receipt).
4. Pay the **₹107** fee and e-Sign—your updated card dispatches to the new communication address within 10–15 days.`,
    category: 'PAN Card',
    tags: ['PAN Address Update', 'Protean Free Update', 'Form CSF', 'Income Tax'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Tax & Identity Compliance Lead',
    publishedAt: '2026-11-12T16:00:00Z',
    updatedAt: '2026-11-12T16:00:00Z',
    readingTimeMinutes: 3,
    relatedServiceSlug: 'pan-correction',
    seoTitle: 'Update Address in PAN Card Online — Free Aadhaar Sync & CSF',
    seoDescription:
      'Learn how to update your communication address in PAN free using Aadhaar e-KYC on Protean/UTIITSL or with a physical card via Form CSF.',
    focusKeyword: 'update address in PAN card',
    faqItems: [
      {
        question: 'Is there any fee to sync my PAN address with Aadhaar?',
        answer:
          'No. Updating only the database communication address using Aadhaar e-KYC on Protean or UTIITSL is completely free.',
      },
    ],
  },
  {
    id: 'blog-017-link-pan-with-aadhaar',
    slug: 'how-to-link-pan-card-with-aadhaar',
    title: 'How to Link PAN Card with Aadhaar',
    titleHi: 'पैन कार्ड को आधार कार्ड से लिंक कैसे करें (Status & Fee Guide)',
    excerpt:
      'Check PAN-Aadhaar linking status on the Income Tax e-Filing portal, pay the mandatory ₹1,000 Section 234H fee if unlinked, and reactivate an inoperative PAN.',
    excerptHi:
      'इनकम टैक्स पोर्टल पर PAN-Aadhaar लिंक स्टेटस चेक करने, ₹1,000 शुल्क चालान जमा करने और निष्क्रिय पैन को फिर से चालू करने की विधि।',
    content: `## Consequences of an Unlinked / Inoperative PAN
Under **Section 139AA** of the Income Tax Act, unlinked PANs become **inoperative**—meaning:
- Income Tax refunds are withheld without interest
- TDS and TCS apply at double/higher statutory rates (often 20%)
- Mutual fund investments, high-value bank deposits, and Demat trades get restricted

## Step 1: Check Your Current Link Status First
1. Visit https://www.incometax.gov.in/ and click **Link Aadhaar Status** under Quick Links.
2. Enter your 10-digit **PAN** and 12-digit **Aadhaar Number**.
3. If the pop-up confirms *"Your PAN is already linked"*, no action or payment is required.

## Step 2: Pay ₹1,000 Late Fee & Submit Link Request
1. Click **Link Aadhaar** on https://www.incometax.gov.in/, enter PAN + Aadhaar, and click **Continue to Pay Through e-Pay Tax**.
2. Select **Assessment Year (current AY, e.g., 2026–27)** and **Type of Payment: Other Receipts (500)** → **Fee for delay in linking PAN with Aadhaar**.
3. Pay **₹1,000** via UPI, Net Banking, or Debit Card and wait 4–5 working days for the NSDL/e-Pay challan to reflect (or proceed immediately if verified instantly).
4. Return to **Link Aadhaar**, enter your Name exactly as on Aadhaar, check *Agree to validate Aadhaar details*, and submit the 6-digit OTP.

## Troubleshooting Demographic Mismatches
If linking rejects due to Name, DOB, or Gender mismatch between PAN and Aadhaar, correct the wrong record first via Form CSF or Aadhaar Seva Kendra—linking cannot proceed until both databases match cleanly.`,
    category: 'PAN Card',
    tags: ['Link PAN Aadhaar', 'Section 139AA', 'Inoperative PAN', 'e-Filing'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Tax & Identity Compliance Lead',
    publishedAt: '2026-11-12T13:00:00Z',
    updatedAt: '2026-11-12T13:00:00Z',
    readingTimeMinutes: 4,
    relatedServiceSlug: 'pan-correction',
    seoTitle: 'How to Link PAN Card with Aadhaar — Check Status & Reactivate',
    seoDescription:
      'Step-by-step guide to checking PAN-Aadhaar link status on https://www.incometax.gov.in/, paying the ₹1,000 e-Pay Tax challan, and fixing name/DOB mismatches.',
    focusKeyword: 'link PAN card with Aadhaar',
    faqItems: [
      {
        question: 'How long does an inoperative PAN take to become active again after linking?',
        answer:
          'Once the ₹1,000 challan is paid and the Link Aadhaar request is successfully submitted, Income Tax systems typically restore operative PAN status within 7 to 30 days.',
      },
    ],
  },
  {
    id: 'blog-018-check-pan-application-status',
    slug: 'how-to-check-pan-card-application-status',
    title: 'How to Check PAN Card Application Status',
    titleHi: 'पैन कार्ड आवेदन की स्थिति (Application Status) ऑनलाइन कैसे जांचें',
    excerpt:
      'Track your PAN new application, correction, or reprint status using your 15-digit Acknowledgement Number or UTIITSL Coupon Number, plus India Post Speed Post.',
    excerptHi:
      '15-अंकीय रसीद नंबर या UTIITSL कूपन नंबर से अपने पैन कार्ड बनने और डाक डिस्पैच की लाइव स्थिति चेक करें।',
    content: `## Locating Your Tracking Number
Depending on where your Form 49A or Correction request was submitted, locate one of these reference numbers:
- **Protean (NSDL):** 15-digit **Acknowledgement Number**
- **UTIITSL:** **Application Coupon Number** (or PAN number + DOB)
- **Digital India Project:** Order tracking ID (e.g., *DIP-2026-XXXXX*) visible inside your Citizen Dashboard and Track page

## Tracking on Official Portals
1. **Protean Tracker:** Visit https://www.protean-tinpan.com/ → **PAN → Track PAN Status**, select *PAN-New/Change Request*, enter the 15-digit Acknowledgement Number and Captcha, and submit.
2. **UTIITSL Tracker:** Visit https://www.pan.utiitsl.com/ → **Track PAN Card**, enter your Application Coupon Number (or existing PAN + DOB), and verify Captcha.
3. **Income Tax Instant e-PAN:** Visit https://www.incometax.gov.in/ → **Instant e-PAN → Check Status / Download PAN**.

## Decoding Common Status Stages
- **Application under process at Income Tax Department:** Verification passed at agency level and awaiting PAN generation/approval.
- **Discrepancy Letter Issued / Objection Raised:** Submitted proof was blurry or mismatched; inspect your registered email for exact discrepancy instructions.
- **Card Dispatched via India Post:** Copy the **Speed Post Consignment Number** displayed on the status screen and track live postal delivery at India Post's tracking portal.`,
    category: 'PAN Card',
    tags: ['PAN Status', 'Protean Tracking', 'UTIITSL Coupon', 'Speed Post'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Tax & Identity Compliance Lead',
    publishedAt: '2026-11-12T10:00:00Z',
    updatedAt: '2026-11-12T10:00:00Z',
    readingTimeMinutes: 3,
    relatedServiceSlug: 'pan-card',
    seoTitle: 'How to Check PAN Card Application Status — NSDL & UTIITSL',
    seoDescription:
      'Track your PAN application, correction, or Speed Post delivery online using your 15-digit Protean Acknowledgement Number or UTIITSL Coupon Number.',
    focusKeyword: 'check PAN card status',
    faqItems: [
      {
        question: 'What should I do if my PAN status shows Discrepancy/Objection?',
        answer:
          'Check your registered email for the discrepancy notice specifying whether a clearer photo, signature, or matching DOB/ID proof is needed, and upload the clarified document via the portal response link.',
      },
    ],
  },
  {
    id: 'blog-019-apply-duplicate-pan-card',
    slug: 'how-to-apply-for-a-duplicate-pan-card',
    title: 'How to Apply for a Duplicate PAN Card',
    titleHi: 'खोया या खराब पैन कार्ड (Duplicate / Reprint PAN) दोबारा कैसे मंगवाएं',
    excerpt:
      'Lost, stolen, or damaged your physical PAN card? Order an official PAN Card Reprint online for ₹50 with zero data changes via Protean or UTIITSL.',
    excerptHi:
      'पैन कार्ड खो जाने या टूट जाने पर बिना किसी डेटा बदलाव के मात्र ₹50 में दोबारा फिजिकल पीवीसी कार्ड मंगवाने की सरल विधि।',
    content: `## Reprint vs Correction — Know Which One to Choose
Never file a fresh Form 49A if you already hold an active PAN number—holding two PANs is punishable under **Section 272B** with a ₹10,000 fine. Instead:
- Choose **PAN Card Reprint (₹50)** if you already know your 10-digit PAN number and require **zero changes** to Name, DOB, Photo, or Address.
- Choose **Form CSF Correction/Reprint (₹107)** if you also need a new photograph, signature, or updated delivery address.

## Step-by-Step Reprint Order (Only ₹50)
1. Confirm your original issuing agency (Protean/NSDL vs UTIITSL).
2. Visit https://www.protean-tinpan.com/ (**Request for Reprint of PAN Card**) or https://www.pan.utiitsl.com/ (**Reprint PAN Card**).
3. Enter your **10-digit PAN Number**, **12-digit Aadhaar Number**, Month & Year of Birth, and consent declaration.
4. Select **OTP Authentication** via registered mobile number or email ID.
5. Verify your pre-saved dispatch address and pay the **₹50** online fee (inclusive of taxes and domestic Speed Post dispatch).
6. Download your payment acknowledgement receipt and expect physical delivery within **7 to 14 days**.

## What If You Lost Your Card AND Forgot Your PAN Number?
Dial the Income Tax Aaykar Sampark Kendra (**1800-180-1961**), verify your identity, retrieve your PAN number, or inspect your **DigiLocker / e-Filing Profile** first—then submit the Reprint request.`,
    category: 'PAN Card',
    tags: ['Duplicate PAN', 'PAN Reprint', 'Lost PAN Card', '₹50 Reprint'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Tax & Identity Compliance Lead',
    publishedAt: '2026-11-12T07:00:00Z',
    updatedAt: '2026-11-12T07:00:00Z',
    readingTimeMinutes: 3,
    relatedServiceSlug: 'pan-card',
    seoTitle: 'Apply for Duplicate / Reprint PAN Card Online for ₹50',
    seoDescription:
      'Order a duplicate physical PAN card online for ₹50 via Protean NSDL or UTIITSL when your card is lost or damaged, keeping all existing details intact.',
    focusKeyword: 'duplicate PAN card',
    faqItems: [
      {
        question: 'Is an FIR copy mandatory for ordering a duplicate PAN card reprint?',
        answer:
          'No. Online PAN Reprint on Protean or UTIITSL does not require uploading an FIR—only OTP verification with your existing PAN and Aadhaar details.',
      },
    ],
  },
  {
    id: 'blog-020-difference-epan-physical-instant-pan',
    slug: 'difference-between-e-pan-physical-pan-and-instant-pan',
    title: 'Difference Between e-PAN, Physical PAN and Instant PAN',
    titleHi: 'e-PAN, फिजिकल पैन कार्ड और Instant PAN में क्या अंतर है?',
    excerpt:
      'Compare Instant e-PAN, regular Protean/UTIITSL e-PAN, and Physical PVC PAN cards across fees, processing time, signature visibility, and legal validity.',
    excerptHi:
      'Instant e-PAN, रेगुलर e-PAN और फिजिकल पैन कार्ड के शुल्क, हस्ताक्षर, पिता के नाम और कानूनी मान्यता का विस्तृत अंतर जानें।',
    content: `## Clearing Up Common PAN Format Confusion
All three formats carry a valid 10-digit Permanent Account Number issued by the **Income Tax Department of India**, yet they differ significantly in cost, turnaround speed, and printed fields.

## Detailed Side-by-Side Breakdown
- **Instant e-PAN (via https://www.incometax.gov.in/):**
  - **Cost:** Completely **Free (₹0)**
  - **Turnaround:** ~10 to 30 minutes
  - **Format:** Digital PDF only (no PVC card mailed)
  - **Fields Missing:** Does **not** carry your wet signature or Father's Name (generated purely from Aadhaar demographic data)
- **Standard e-PAN (via Protean https://www.protean-tinpan.com/ or UTIITSL https://www.pan.utiitsl.com/):**
  - **Cost:** ₹66 to ₹72 (digital-only mode)
  - **Turnaround:** 2 to 4 working days
  - **Format:** Signed PDF with Father's Name, custom photo, and QR code
- **Physical PAN + e-PAN Combo:**
  - **Cost:** ₹101 to ₹107 (domestic dispatch)
  - **Turnaround:** e-PAN in 3–5 days; physical laminated card via India Post in 7–14 days
  - **Advantage:** Accepted smoothly even at offline KYC desks, overseas visa counters, or banks demanding physical card + signature inspection

## Which Option Should You Choose?
Choose **Instant e-PAN** when you need an urgent PAN number today for ITR filing or mutual funds and already have an Aadhaar-linked mobile number. Choose **Physical + e-PAN** via Form 49A (or upgrade an existing Instant e-PAN via Form CSF) when opening corporate accounts, applying for visas, or needing your Father's Name and signature on the card.`,
    category: 'PAN Card',
    tags: ['e-PAN vs Physical PAN', 'Instant PAN', 'Income Tax', 'PAN Guide'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Tax & Identity Compliance Lead',
    publishedAt: '2026-11-12T04:00:00Z',
    updatedAt: '2026-11-12T04:00:00Z',
    readingTimeMinutes: 4,
    relatedServiceSlug: 'pan-card',
    seoTitle: 'e-PAN vs Physical PAN vs Instant PAN — Complete Comparison',
    seoDescription:
      'Understand key differences between Instant e-PAN, standard e-PAN, and Physical PAN card—fees, processing time, Father Name, signature, and KYC acceptance.',
    focusKeyword: 'e-PAN vs physical PAN',
    faqItems: [
      {
        question: 'Can I upgrade my free Instant e-PAN to a physical PVC PAN card with signature?',
        answer:
          'Yes. File a Changes/Correction (Form CSF) application on Protean or UTIITSL using your Instant e-PAN number, upload your signature and photo, and pay ₹107 for physical dispatch.',
      },
    ],
  },
];
