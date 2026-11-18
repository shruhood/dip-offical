import type { CategoryMeta, ToolCategorySlug, ToolDefinition, ToolEngineId, PricingTier } from '../types/tool';

export const CATEGORIES: CategoryMeta[] = [
  {
    slug: 'pdf-tools',
    title: 'PDF Tools',
    description: 'Merge, split, compress, convert, reorder, watermark, and OCR PDF files directly in your browser.',
    iconName: 'FileText',
    accentColor: '#F06455',
  },
  {
    slug: 'image-tools',
    title: 'Image Tools',
    description: 'Resize, crop, compress to exact KB, convert formats, change DPI, and prepare passport photos.',
    iconName: 'Image',
    accentColor: '#F28C38',
  },
  {
    slug: 'csc-tools',
    title: 'CSC & Govt Portal Tools',
    description: 'Passport & visa photo sheets, signature whiteners, document packs, checklists, and Indian typing tools.',
    iconName: 'Landmark',
    accentColor: '#F5C542',
  },
  {
    slug: 'compressors',
    title: 'Compressors',
    description: 'Reduce PDF, JPG, PNG, WebP, audio, video, and ZIP archive sizes for portal upload limits.',
    iconName: 'Minimize2',
    accentColor: '#F06455',
  },
  {
    slug: 'converters',
    title: 'Converters',
    description: 'Convert Word, Excel, CSV, JSON, HTML, images, and PDF documents accurately.',
    iconName: 'RefreshCw',
    accentColor: '#F28C38',
  },
  {
    slug: 'calculators',
    title: 'Calculators',
    description: 'GST, Income Tax, TDS, EMI, SIP, FD, RD, Salary, PF, Gratuity, and Indian Land Area calculators.',
    iconName: 'Calculator',
    accentColor: '#252525',
  },
  {
    slug: 'qr-barcode',
    title: 'QR & Barcode Tools',
    description: 'Generate UPI payment QR codes, WhatsApp/Wi-Fi/vCard QR codes, barcodes, and scan QR images.',
    iconName: 'QrCode',
    accentColor: '#F5C542',
  },
  {
    slug: 'business-tools',
    title: 'Business & Document Generators',
    description: 'GST invoices, quotations, salary slips, offer letters, ID cards, business cards, and certificates.',
    iconName: 'Briefcase',
    accentColor: '#F28C38',
  },
  {
    slug: 'text-ocr',
    title: 'OCR & Language Tools',
    description: 'Extract English, Hindi, and Gujarati text from images & PDFs, clean text, count words, and speech tools.',
    iconName: 'ScanText',
    accentColor: '#F06455',
  },
  {
    slug: 'printing-tools',
    title: 'Printing & Cyber Café',
    description: 'Print cost calculators, A4 to A3 scaling, N-up sheets, booklet layouts, and 4x6 photo print sheets.',
    iconName: 'Printer',
    accentColor: '#252525',
  },
  {
    slug: 'ai-tools',
    title: 'AI Document Assistants',
    description: 'AI PDF assistant, document summarizer, structured invoice extractor, translation, and letter writer.',
    iconName: 'Sparkles',
    accentColor: '#F28C38',
  },
];

interface RawToolSeed {
  id: number;
  slug: string;
  name: string;
  shortDescription: string;
  category: ToolCategorySlug;
  iconName: string;
  acceptedFormats: string[];
  outputFormats: string[];
  processingType: 'client-browser' | 'server-ai' | 'calculator' | 'generator';
  engineId: ToolEngineId;
  presetConfig?: Record<string, string | number | boolean>;
  tier?: PricingTier;
  singleUsePriceInr?: number;
  isPopular?: boolean;
  isRecent?: boolean;
  isCscEssential?: boolean;
  isAiPowered?: boolean;
  limitations?: string;
}

export const CATEGORY_LABELS: Record<ToolCategorySlug, string> = {
  'pdf-tools': 'PDF Tools',
  'image-tools': 'Image Tools',
  'csc-tools': 'CSC Tools',
  compressors: 'Compressors',
  converters: 'Converters',
  calculators: 'Calculators',
  'qr-barcode': 'QR & Barcode',
  'business-tools': 'Business Tools',
  'text-ocr': 'OCR & Text',
  'printing-tools': 'Printing Tools',
  'ai-tools': 'AI Tools',
  'document-tools': 'Document Tools',
  'government-assistance': 'Government Assistance',
  'audio-tools': 'Audio Tools',
  'video-tools': 'Video Tools',
  'developer-tools': 'Developer Tools',
  'seo-tools': 'SEO Tools',
};

const RAW_TOOLS: RawToolSeed[] = [
  // A. PDF tools (1-20)
  { id: 1, slug: 'pdf-to-word', name: 'PDF to Word', shortDescription: 'Extract text and structure from PDF into an editable Word (.doc) document.', category: 'pdf-tools', iconName: 'FileType2', acceptedFormats: ['.pdf'], outputFormats: ['.doc', '.txt'], processingType: 'client-browser', engineId: 'pdf-to-word', tier: 'personal', isPopular: true, limitations: 'Extracts text and paragraphs into Word-compatible .doc format; complex multi-column scanned PDFs should use PDF OCR first.' },
  { id: 2, slug: 'word-to-pdf', name: 'Word to PDF', shortDescription: 'Convert DOCX, RTF, HTML, or TXT documents into clean paginated PDF files.', category: 'pdf-tools', iconName: 'FileOutput', acceptedFormats: ['.docx', '.txt', '.html', '.md'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'word-to-pdf', isPopular: true, limitations: 'Parses DOCX body text and paragraphs directly in browser; complex embedded Word macros or charts may simplify.' },
  { id: 3, slug: 'pdf-to-jpg', name: 'PDF to JPG', shortDescription: 'Render PDF pages into crisp high-DPI JPG images with ZIP batch download.', category: 'pdf-tools', iconName: 'FileImage', acceptedFormats: ['.pdf'], outputFormats: ['.jpg', '.zip'], processingType: 'client-browser', engineId: 'pdf-to-image', presetConfig: { format: 'image/jpeg' }, isPopular: true },
  { id: 4, slug: 'jpg-to-pdf', name: 'JPG to PDF', shortDescription: 'Combine one or multiple JPG photos into a single A4 or Fit-to-Page PDF.', category: 'pdf-tools', iconName: 'Images', acceptedFormats: ['.jpg', '.jpeg'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'image-to-pdf', isPopular: true, isCscEssential: true },
  { id: 5, slug: 'pdf-to-excel', name: 'PDF to Excel', shortDescription: 'Extract tabular rows from PDF documents into a real .xlsx Excel spreadsheet.', category: 'pdf-tools', iconName: 'Table', acceptedFormats: ['.pdf'], outputFormats: ['.xlsx', '.csv'], processingType: 'client-browser', engineId: 'pdf-to-excel', limitations: 'Best for text-based PDFs with aligned columns; scanned tables should run through OCR first.' },
  { id: 6, slug: 'excel-to-pdf', name: 'Excel to PDF', shortDescription: 'Convert .xlsx, .xls, or .csv spreadsheets into clean landscape/portrait PDFs.', category: 'pdf-tools', iconName: 'Sheet', acceptedFormats: ['.xlsx', '.xls', '.csv'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'excel-to-pdf' },
  { id: 7, slug: 'pdf-to-png', name: 'PDF to PNG', shortDescription: 'Export every PDF page as lossless PNG images for crisp printing and graphics.', category: 'pdf-tools', iconName: 'FileImage', acceptedFormats: ['.pdf'], outputFormats: ['.png', '.zip'], processingType: 'client-browser', engineId: 'pdf-to-image', presetConfig: { format: 'image/png' } },
  { id: 8, slug: 'png-to-pdf', name: 'PNG to PDF', shortDescription: 'Convert PNG screenshots, scans, or transparent graphics into a PDF file.', category: 'pdf-tools', iconName: 'FilePlus2', acceptedFormats: ['.png'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'image-to-pdf' },
  { id: 9, slug: 'merge-pdf', name: 'Merge PDF', shortDescription: 'Combine multiple PDF documents into one ordered PDF in seconds.', category: 'pdf-tools', iconName: 'Combine', acceptedFormats: ['.pdf'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'pdf-merge', isPopular: true, isCscEssential: true },
  { id: 10, slug: 'split-pdf', name: 'Split PDF', shortDescription: 'Split a PDF by page range or extract every page into separate PDFs (ZIP).', category: 'pdf-tools', iconName: 'Scissors', acceptedFormats: ['.pdf'], outputFormats: ['.pdf', '.zip'], processingType: 'client-browser', engineId: 'pdf-split', isPopular: true },
  { id: 11, slug: 'compress-pdf', name: 'Compress PDF', shortDescription: 'Shrink PDF file size using stream optimization or target-DPI recompression.', category: 'pdf-tools', iconName: 'Minimize2', acceptedFormats: ['.pdf'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'pdf-compress', isPopular: true, isCscEssential: true },
  { id: 12, slug: 'rotate-pdf', name: 'Rotate PDF', shortDescription: 'Fix upside-down or sideways scanned PDFs by rotating 90°, 180°, or 270°.', category: 'pdf-tools', iconName: 'RotateCw', acceptedFormats: ['.pdf'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'pdf-rotate' },
  { id: 13, slug: 'delete-pdf-pages', name: 'Delete PDF Pages', shortDescription: 'Remove unwanted blank or extra pages from any PDF document.', category: 'pdf-tools', iconName: 'Trash2', acceptedFormats: ['.pdf'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'pdf-delete-pages' },
  { id: 14, slug: 'extract-pdf-pages', name: 'Extract PDF Pages', shortDescription: 'Pull specific page numbers or ranges out into a clean new PDF.', category: 'pdf-tools', iconName: 'FileCheck', acceptedFormats: ['.pdf'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'pdf-extract-pages' },
  { id: 15, slug: 'reorder-pdf-pages', name: 'Reorder PDF Pages', shortDescription: 'Rearrange PDF page sequence with custom ordering before merging or printing.', category: 'pdf-tools', iconName: 'ArrowUpDown', acceptedFormats: ['.pdf'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'pdf-reorder-pages' },
  { id: 16, slug: 'add-page-numbers', name: 'Add Page Numbers', shortDescription: 'Stamp clean footer or header page numbers (e.g., Page 1 of 10) on PDFs.', category: 'pdf-tools', iconName: 'Hash', acceptedFormats: ['.pdf'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'pdf-page-numbers' },
  { id: 17, slug: 'add-watermark', name: 'Add Watermark', shortDescription: 'Add diagonal text watermarks like CONFIDENTIAL or DRAFT with custom opacity.', category: 'pdf-tools', iconName: 'Stamp', acceptedFormats: ['.pdf'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'pdf-watermark' },
  { id: 18, slug: 'password-protect-pdf', name: 'Password Protect PDF', shortDescription: 'Encrypt sensitive documents into a password-locked AES-256 package or watermarked PDF.', category: 'pdf-tools', iconName: 'Lock', acceptedFormats: ['.pdf'], outputFormats: ['.html', '.pdf'], processingType: 'client-browser', engineId: 'pdf-protect', limitations: 'Browser-side WebCrypto AES-256 creates a self-decrypting offline HTML vault without exposing your password to any server.' },
  { id: 19, slug: 'remove-pdf-password', name: 'Unlock Authorized PDF', shortDescription: 'Strip restriction flags or decrypt files where you own the authorized password.', category: 'pdf-tools', iconName: 'Unlock', acceptedFormats: ['.pdf', '.html'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'pdf-unlock', limitations: 'Only unlocks PDFs for which you supply the valid owner/user password or encrypted Digital India Project vault.' },
  { id: 20, slug: 'pdf-ocr', name: 'PDF OCR / Searchable PDF', shortDescription: 'Recognize scanned PDF text using Tesseract OCR and export text + PDF copy.', category: 'pdf-tools', iconName: 'ScanSearch', acceptedFormats: ['.pdf'], outputFormats: ['.pdf', '.txt'], processingType: 'client-browser', engineId: 'pdf-ocr', tier: 'personal', isRecent: true },

  // B. Image and photo tools (21-40)
  { id: 21, slug: 'image-compressor', name: 'Image Compressor', shortDescription: 'Reduce JPG, PNG, and WebP file sizes while keeping visual clarity sharp.', category: 'image-tools', iconName: 'Minimize2', acceptedFormats: ['.jpg', '.jpeg', '.png', '.webp'], outputFormats: ['.jpg', '.webp'], processingType: 'client-browser', engineId: 'image-compress', isPopular: true },
  { id: 22, slug: 'image-resizer', name: 'Image Resizer', shortDescription: 'Resize photos by percentage, preset portal dimensions, or aspect-locked pixels.', category: 'image-tools', iconName: 'Maximize2', acceptedFormats: ['.jpg', '.jpeg', '.png', '.webp'], outputFormats: ['.jpg', '.png'], processingType: 'client-browser', engineId: 'image-resize', isPopular: true },
  { id: 23, slug: 'image-cropper', name: 'Image Cropper', shortDescription: 'Crop photos to exact ratios (1:1, 4:3, 35x45mm, signature strip, or freeform).', category: 'image-tools', iconName: 'Crop', acceptedFormats: ['.jpg', '.jpeg', '.png', '.webp'], outputFormats: ['.jpg', '.png'], processingType: 'client-browser', engineId: 'image-crop' },
  { id: 24, slug: 'jpg-to-png', name: 'JPG to PNG', shortDescription: 'Convert JPG photographs into lossless PNG format with crisp edge rendering.', category: 'image-tools', iconName: 'ArrowRightLeft', acceptedFormats: ['.jpg', '.jpeg'], outputFormats: ['.png'], processingType: 'client-browser', engineId: 'image-convert', presetConfig: { targetMime: 'image/png', ext: 'png' } },
  { id: 25, slug: 'png-to-jpg', name: 'PNG to JPG', shortDescription: 'Convert PNG images (including transparent backgrounds) to white-backed JPG.', category: 'image-tools', iconName: 'ArrowRightLeft', acceptedFormats: ['.png'], outputFormats: ['.jpg'], processingType: 'client-browser', engineId: 'image-convert', presetConfig: { targetMime: 'image/jpeg', ext: 'jpg' } },
  { id: 26, slug: 'jpg-to-webp', name: 'JPG to WebP', shortDescription: 'Convert JPG images into lightweight modern WebP files for faster websites.', category: 'image-tools', iconName: 'Zap', acceptedFormats: ['.jpg', '.jpeg'], outputFormats: ['.webp'], processingType: 'client-browser', engineId: 'image-convert', presetConfig: { targetMime: 'image/webp', ext: 'webp' } },
  { id: 27, slug: 'webp-to-jpg', name: 'WebP to JPG', shortDescription: 'Convert WebP downloads into universally accepted JPG files for govt portals.', category: 'image-tools', iconName: 'FileImage', acceptedFormats: ['.webp'], outputFormats: ['.jpg'], processingType: 'client-browser', engineId: 'image-convert', presetConfig: { targetMime: 'image/jpeg', ext: 'jpg' }, isCscEssential: true },
  { id: 28, slug: 'heic-to-jpg', name: 'HEIC / Mobile Photo to JPG', shortDescription: 'Convert modern phone images to standard portal-compatible JPG format.', category: 'image-tools', iconName: 'Smartphone', acceptedFormats: ['.heic', '.heif', '.png', '.webp', '.jpg'], outputFormats: ['.jpg'], processingType: 'client-browser', engineId: 'image-convert', presetConfig: { targetMime: 'image/jpeg', ext: 'jpg' }, limitations: 'Uses native browser image decoding; Safari/macOS decodes HEIC natively while Chrome/Linux supports PNG/WebP/AVIF.' },
  { id: 29, slug: 'image-to-pdf', name: 'Image to PDF', shortDescription: 'Turn any photo or document scan into a properly scaled A4 PDF document.', category: 'image-tools', iconName: 'FileText', acceptedFormats: ['.jpg', '.jpeg', '.png', '.webp'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'image-to-pdf' },
  { id: 30, slug: 'background-remover', name: 'Background Remover', shortDescription: 'Remove uniform studio or paper backgrounds and swap with white, blue, or transparent.', category: 'image-tools', iconName: 'Eraser', acceptedFormats: ['.jpg', '.jpeg', '.png', '.webp'], outputFormats: ['.png', '.jpg'], processingType: 'client-browser', engineId: 'image-bg-remove', tier: 'personal', isPopular: true, isCscEssential: true },
  { id: 31, slug: 'photo-enhancer', name: 'Photo Enhancer', shortDescription: 'Adjust brightness, contrast, sharpness, and white balance on blurry ID photos.', category: 'image-tools', iconName: 'SunMedium', acceptedFormats: ['.jpg', '.jpeg', '.png', '.webp'], outputFormats: ['.jpg', '.png'], processingType: 'client-browser', engineId: 'image-enhance' },
  { id: 32, slug: 'image-dpi-changer', name: 'Image DPI Changer', shortDescription: 'Rewrite image DPI metadata headers to 200 DPI, 300 DPI, or 600 DPI for forms.', category: 'image-tools', iconName: 'SlidersHorizontal', acceptedFormats: ['.jpg', '.jpeg', '.png'], outputFormats: ['.jpg', '.png'], processingType: 'client-browser', engineId: 'image-dpi', isCscEssential: true },
  { id: 33, slug: 'image-size-kb-compressor', name: 'Image Size in KB Compressor', shortDescription: 'Compress any photo to an exact target KB (e.g., 20 KB, 50 KB, 100 KB, 200 KB).', category: 'image-tools', iconName: 'Gauge', acceptedFormats: ['.jpg', '.jpeg', '.png', '.webp'], outputFormats: ['.jpg'], processingType: 'client-browser', engineId: 'image-kb-compress', isPopular: true, isCscEssential: true },
  { id: 34, slug: 'custom-pixel-resizer', name: 'Custom Pixel Resizer', shortDescription: 'Set exact pixel width & height (e.g., 213×213 px for PAN or 200×230 px for IBPS).', category: 'image-tools', iconName: 'Ruler', acceptedFormats: ['.jpg', '.jpeg', '.png', '.webp'], outputFormats: ['.jpg', '.png'], processingType: 'client-browser', engineId: 'image-resize', presetConfig: { allowCustomPresets: true }, isCscEssential: true },
  { id: 35, slug: 'image-metadata-remover', name: 'Image Metadata Remover', shortDescription: 'Strip GPS coordinates, camera model, and EXIF metadata for citizen privacy.', category: 'image-tools', iconName: 'ShieldCheck', acceptedFormats: ['.jpg', '.jpeg', '.png', '.webp'], outputFormats: ['.jpg', '.png'], processingType: 'client-browser', engineId: 'image-strip-exif' },
  { id: 36, slug: 'passport-photo-maker', name: 'Passport Photo Maker', shortDescription: 'Create compliant 35×45mm Indian passport photos with white/blue background & 4×6 sheet.', category: 'image-tools', iconName: 'UserSquare2', acceptedFormats: ['.jpg', '.jpeg', '.png', '.webp'], outputFormats: ['.jpg', '.pdf'], processingType: 'client-browser', engineId: 'passport-photo', isPopular: true, isCscEssential: true },
  { id: 37, slug: 'visa-photo-maker', name: 'Visa Photo Maker', shortDescription: 'Generate US (2×2 in), UK, Schengen, Canada, and UAE visa photo sizes instantly.', category: 'image-tools', iconName: 'Globe2', acceptedFormats: ['.jpg', '.jpeg', '.png', '.webp'], outputFormats: ['.jpg', '.pdf'], processingType: 'client-browser', engineId: 'passport-photo', presetConfig: { mode: 'visa' } },
  { id: 38, slug: 'signature-cropper', name: 'Signature Cropper', shortDescription: 'Crop & auto-whiten photographed pen signatures into crisp black ink on pure white.', category: 'image-tools', iconName: 'PenTool', acceptedFormats: ['.jpg', '.jpeg', '.png', '.webp'], outputFormats: ['.jpg', '.png'], processingType: 'client-browser', engineId: 'signature-studio', isCscEssential: true },
  { id: 39, slug: 'signature-resizer', name: 'Signature Resizer', shortDescription: 'Resize signatures to exact SSC, UPSC, PAN, and bank portal dimensions (10–20 KB).', category: 'image-tools', iconName: 'Scaling', acceptedFormats: ['.jpg', '.jpeg', '.png', '.webp'], outputFormats: ['.jpg'], processingType: 'client-browser', engineId: 'signature-studio', presetConfig: { targetKb: 18 }, isPopular: true, isCscEssential: true },
  { id: 40, slug: 'multiple-photos-to-pdf', name: 'Multiple Photos to PDF', shortDescription: 'Batch-arrange multiple ID cards or photos onto A4 PDF pages in order.', category: 'image-tools', iconName: 'GalleryVerticalEnd', acceptedFormats: ['.jpg', '.jpeg', '.png', '.webp'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'image-to-pdf', presetConfig: { multiple: true } },

  // C. CSC and government application tools (41-60)
  { id: 41, slug: 'csc-passport-photo-studio', name: 'CSC Passport Photo Studio', shortDescription: 'Multi-copy passport & stamp-size photo print sheets tailored for CSC counters.', category: 'csc-tools', iconName: 'Camera', acceptedFormats: ['.jpg', '.jpeg', '.png'], outputFormats: ['.jpg', '.pdf'], processingType: 'client-browser', engineId: 'passport-photo', presetConfig: { mode: 'csc-sheet' }, tier: 'csc', isCscEssential: true },
  { id: 42, slug: 'signature-maker', name: 'Signature Maker & Whitener', shortDescription: 'Draw a digital signature on canvas or clean up a camera photo of a paper signature.', category: 'csc-tools', iconName: 'Signature', acceptedFormats: ['.jpg', '.png', 'canvas'], outputFormats: ['.png', '.jpg'], processingType: 'client-browser', engineId: 'signature-studio', presetConfig: { allowDraw: true }, isCscEssential: true },
  { id: 43, slug: 'photo-signature-size-reducer', name: 'Photo & Signature Size Reducer', shortDescription: 'Simultaneously compress applicant photo (20–50 KB) and signature (10–20 KB).', category: 'csc-tools', iconName: 'FileDown', acceptedFormats: ['.jpg', '.jpeg', '.png'], outputFormats: ['.jpg'], processingType: 'client-browser', engineId: 'image-kb-compress', presetConfig: { dualMode: true }, isCscEssential: true },
  { id: 44, slug: 'document-scanner', name: 'Document Scanner Filter', shortDescription: 'Clean shadows and grey backgrounds from mobile document photos into crisp B&W PDFs.', category: 'csc-tools', iconName: 'ScanLine', acceptedFormats: ['.jpg', '.jpeg', '.png'], outputFormats: ['.pdf', '.jpg'], processingType: 'client-browser', engineId: 'document-scanner', isPopular: true, isCscEssential: true },
  { id: 45, slug: 'document-to-pdf', name: 'Document to PDF', shortDescription: 'Convert scanned pages, photos, or text forms directly into portal-ready PDFs.', category: 'csc-tools', iconName: 'FilePlus', acceptedFormats: ['.jpg', '.png', '.txt', '.docx'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'image-to-pdf', isCscEssential: true },
  { id: 46, slug: 'pdf-document-pack-maker', name: 'PDF Document Pack Maker', shortDescription: 'Combine Aadhaar, PAN, photo & application form into one size-capped PDF pack.', category: 'csc-tools', iconName: 'FolderArchive', acceptedFormats: ['.pdf', '.jpg', '.png'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'pdf-merge', presetConfig: { packMode: true }, tier: 'csc', isCscEssential: true },
  { id: 47, slug: 'application-document-checklist-generator', name: 'Application Checklist Generator', shortDescription: 'Generate printable citizen checklists for Passport, PAN, Caste, Income & Ration cards.', category: 'csc-tools', iconName: 'ClipboardCheck', acceptedFormats: ['preset'], outputFormats: ['.pdf', '.txt'], processingType: 'generator', engineId: 'document-checklist', isCscEssential: true },
  { id: 48, slug: 'government-application-letter-generator', name: 'Govt Application Letter Generator', shortDescription: 'Draft formal Hindi, Gujarati, or English office application letters and export PDF.', category: 'csc-tools', iconName: 'FilePenLine', acceptedFormats: ['form'], outputFormats: ['.pdf', '.txt'], processingType: 'generator', engineId: 'letter-generator', presetConfig: { kind: 'application' }, isCscEssential: true },
  { id: 49, slug: 'self-declaration-generator', name: 'Self-Declaration Generator', shortDescription: 'Create clean self-declaration / स्व-घोषणा पत्र PDFs for income, address & scholarship.', category: 'csc-tools', iconName: 'FileSignature', acceptedFormats: ['form'], outputFormats: ['.pdf'], processingType: 'generator', engineId: 'letter-generator', presetConfig: { kind: 'self-declaration' }, isCscEssential: true },
  { id: 50, slug: 'affidavit-draft-generator', name: 'Affidavit Draft Generator', shortDescription: 'Prepare structured name-change, address, or gap-year affidavit drafts for notarization.', category: 'csc-tools', iconName: 'Scale', acceptedFormats: ['form'], outputFormats: ['.pdf', '.txt'], processingType: 'generator', engineId: 'letter-generator', presetConfig: { kind: 'affidavit' }, isCscEssential: true },
  { id: 51, slug: 'resume-biodata-maker', name: 'Resume & Biodata Maker', shortDescription: 'Build clean job resumes or traditional Indian biodata PDFs in minutes.', category: 'csc-tools', iconName: 'IdCard', acceptedFormats: ['form'], outputFormats: ['.pdf'], processingType: 'generator', engineId: 'business-doc', presetConfig: { docType: 'resume' }, isPopular: true },
  { id: 52, slug: 'hindi-typing-tool', name: 'Hindi Typing Tool (हिन्दी टाइपिंग)', shortDescription: 'Type phonetic Roman/English or use the Devanagari keypad and copy/download text.', category: 'csc-tools', iconName: 'Keyboard', acceptedFormats: ['text'], outputFormats: ['.txt', '.pdf'], processingType: 'client-browser', engineId: 'typing-tool', presetConfig: { lang: 'hi' }, isCscEssential: true },
  { id: 53, slug: 'gujarati-typing-tool', name: 'Gujarati Typing Tool (ગુજરાતી ટાઇપિંગ)', shortDescription: 'Phonetic Gujarati typing pad with virtual Gujarati script keys and PDF/TXT export.', category: 'csc-tools', iconName: 'Keyboard', acceptedFormats: ['text'], outputFormats: ['.txt', '.pdf'], processingType: 'client-browser', engineId: 'typing-tool', presetConfig: { lang: 'gu' }, isCscEssential: true },
  { id: 54, slug: 'english-typing-tool', name: 'English Typing & Speed Pad', shortDescription: 'Clean distraction-free English typing pad with WPM speed test and document export.', category: 'csc-tools', iconName: 'Type', acceptedFormats: ['text'], outputFormats: ['.txt', '.pdf'], processingType: 'client-browser', engineId: 'typing-tool', presetConfig: { lang: 'en' } },
  { id: 55, slug: 'hindi-to-english-translation', name: 'Hindi to English Translation', shortDescription: 'Translate Hindi applications, notices, and certificates into formal English.', category: 'csc-tools', iconName: 'Languages', acceptedFormats: ['text'], outputFormats: ['.txt'], processingType: 'server-ai', engineId: 'ai-assistant', presetConfig: { aiMode: 'translate', sourceLang: 'Hindi', targetLang: 'English' }, isAiPowered: true },
  { id: 56, slug: 'english-to-gujarati-translation', name: 'English to Gujarati Translation', shortDescription: 'Translate English documents, letters, and notices into natural Gujarati.', category: 'csc-tools', iconName: 'Languages', acceptedFormats: ['text'], outputFormats: ['.txt'], processingType: 'server-ai', engineId: 'ai-assistant', presetConfig: { aiMode: 'translate', sourceLang: 'English', targetLang: 'Gujarati' }, isAiPowered: true },
  { id: 57, slug: 'document-naming-tool', name: 'Document Naming Tool', shortDescription: 'Batch-rename customer files using standard portal naming patterns and download ZIP.', category: 'csc-tools', iconName: 'FolderKanban', acceptedFormats: ['*'], outputFormats: ['.zip'], processingType: 'client-browser', engineId: 'document-renamer', isCscEssential: true },
  { id: 58, slug: 'photo-dimension-checker', name: 'Photo Dimension Checker', shortDescription: 'Verify pixel width, height, DPI, aspect ratio, and KB size against Indian exam portals.', category: 'csc-tools', iconName: 'CheckSquare', acceptedFormats: ['.jpg', '.jpeg', '.png'], outputFormats: ['report'], processingType: 'client-browser', engineId: 'dimension-checker', presetConfig: { mode: 'photo' }, isCscEssential: true },
  { id: 59, slug: 'signature-dimension-checker', name: 'Signature Dimension Checker', shortDescription: 'Check if signature image meets SSC, UPSC, PAN, IBPS, and NTA size & dimension rules.', category: 'csc-tools', iconName: 'CheckSquare', acceptedFormats: ['.jpg', '.jpeg', '.png'], outputFormats: ['report'], processingType: 'client-browser', engineId: 'dimension-checker', presetConfig: { mode: 'signature' }, isCscEssential: true },
  { id: 60, slug: 'application-file-size-checker', name: 'Application File-Size Checker', shortDescription: 'Inspect PDF/JPG/PNG files against 50 KB, 200 KB, 1 MB, and 2 MB portal caps.', category: 'csc-tools', iconName: 'FileSearch', acceptedFormats: ['.pdf', '.jpg', '.jpeg', '.png'], outputFormats: ['report'], processingType: 'client-browser', engineId: 'dimension-checker', presetConfig: { mode: 'filesize' }, isCscEssential: true },

  // D. Compressors and converters (61-75)
  { id: 61, slug: 'pdf-file-compressor', name: 'PDF File Compressor', shortDescription: 'Optimize PDF byte size for email attachments and government upload thresholds.', category: 'compressors', iconName: 'Minimize2', acceptedFormats: ['.pdf'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'pdf-compress' },
  { id: 62, slug: 'bulk-image-compressor', name: 'Bulk Image Compressor', shortDescription: 'Compress a batch of JPG, PNG, and WebP files at once and download as a ZIP.', category: 'compressors', iconName: 'Images', acceptedFormats: ['.jpg', '.jpeg', '.png', '.webp'], outputFormats: ['.zip', '.jpg'], processingType: 'client-browser', engineId: 'image-compress' },
  { id: 63, slug: 'jpg-compressor', name: 'JPG Compressor', shortDescription: 'Tune JPEG quality slider from 10% to 95% with instant live before/after byte count.', category: 'compressors', iconName: 'FileDown', acceptedFormats: ['.jpg', '.jpeg'], outputFormats: ['.jpg'], processingType: 'client-browser', engineId: 'image-compress', presetConfig: { forceMime: 'image/jpeg' } },
  { id: 64, slug: 'png-compressor', name: 'PNG Compressor', shortDescription: 'Reduce heavy PNG screenshot sizes via smart scale and color palette optimization.', category: 'compressors', iconName: 'FileDown', acceptedFormats: ['.png'], outputFormats: ['.png', '.webp'], processingType: 'client-browser', engineId: 'image-compress', presetConfig: { forceMime: 'image/png' } },
  { id: 65, slug: 'webp-compressor', name: 'WebP Compressor', shortDescription: 'Re-encode WebP images at target quality for web performance optimization.', category: 'compressors', iconName: 'Zap', acceptedFormats: ['.webp'], outputFormats: ['.webp'], processingType: 'client-browser', engineId: 'image-compress', presetConfig: { forceMime: 'image/webp' } },
  { id: 66, slug: 'mp4-video-compressor', name: 'MP4 / WebM Video Compressor', shortDescription: 'Transcode and lower video resolution/bitrate directly in supported browsers.', category: 'video-tools', iconName: 'Video', acceptedFormats: ['.mp4', '.webm', '.mov'], outputFormats: ['.webm'], processingType: 'client-browser', engineId: 'media-compressor', presetConfig: { media: 'video' }, limitations: 'Browser MediaRecorder re-encodes to WebM/VP8; large 4K files should use server FFmpeg in cloud worker deployments.' },
  { id: 67, slug: 'mp3-audio-compressor', name: 'Audio Bitrate Compressor', shortDescription: 'Re-sample and compress MP3/WAV/OGG audio recordings to smaller web-ready audio.', category: 'audio-tools', iconName: 'AudioLines', acceptedFormats: ['.mp3', '.wav', '.ogg', '.m4a'], outputFormats: ['.wav', '.webm'], processingType: 'client-browser', engineId: 'media-compressor', presetConfig: { media: 'audio' } },
  { id: 68, slug: 'zip-creator', name: 'ZIP Creator', shortDescription: 'Bundle multiple documents, photos, or folders into a single compressed .zip archive.', category: 'compressors', iconName: 'FileArchive', acceptedFormats: ['*'], outputFormats: ['.zip'], processingType: 'client-browser', engineId: 'zip-creator' },
  { id: 69, slug: 'zip-extractor', name: 'ZIP Extractor', shortDescription: 'Inspect contents of a .zip archive in browser and extract individual files safely.', category: 'compressors', iconName: 'FolderOpen', acceptedFormats: ['.zip'], outputFormats: ['*'], processingType: 'client-browser', engineId: 'zip-extractor' },
  { id: 70, slug: 'word-converter', name: 'Word Document Converter', shortDescription: 'Convert DOCX / TXT / HTML documents to PDF, plain text, or Markdown.', category: 'converters', iconName: 'FileCode2', acceptedFormats: ['.docx', '.txt', '.html'], outputFormats: ['.pdf', '.txt'], processingType: 'client-browser', engineId: 'word-to-pdf' },
  { id: 71, slug: 'excel-converter', name: 'Excel Spreadsheet Converter', shortDescription: 'Convert XLSX / XLS spreadsheets to CSV, JSON, or formatted PDF tables.', category: 'converters', iconName: 'Sheet', acceptedFormats: ['.xlsx', '.xls', '.csv'], outputFormats: ['.csv', '.json', '.pdf'], processingType: 'client-browser', engineId: 'data-converter', presetConfig: { mode: 'excel-convert' } },
  { id: 72, slug: 'powerpoint-converter', name: 'Presentation Slide to PDF', shortDescription: 'Extract slide text from .pptx files and export structured handout PDFs.', category: 'converters', iconName: 'Presentation', acceptedFormats: ['.pptx', '.txt'], outputFormats: ['.pdf', '.txt'], processingType: 'client-browser', engineId: 'word-to-pdf', presetConfig: { pptxMode: true }, limitations: 'Extracts text content from PPTX slide XML into clean handout PDFs; full visual slide animations require LibreOffice headless.' },
  { id: 73, slug: 'csv-to-excel', name: 'CSV to Excel', shortDescription: 'Convert comma-separated CSV exports into formatted .xlsx Excel workbooks.', category: 'converters', iconName: 'Table2', acceptedFormats: ['.csv'], outputFormats: ['.xlsx'], processingType: 'client-browser', engineId: 'data-converter', presetConfig: { mode: 'csv-to-xlsx' } },
  { id: 74, slug: 'json-to-csv', name: 'JSON to CSV', shortDescription: 'Flatten JSON arrays and API payloads into clean spreadsheet-ready CSV files.', category: 'developer-tools', iconName: 'Braces', acceptedFormats: ['.json'], outputFormats: ['.csv', '.xlsx'], processingType: 'client-browser', engineId: 'data-converter', presetConfig: { mode: 'json-to-csv' } },
  { id: 75, slug: 'html-to-pdf', name: 'HTML to PDF', shortDescription: 'Render HTML snippets or web markup into clean paginated PDF documents.', category: 'converters', iconName: 'Code2', acceptedFormats: ['.html', '.htm', 'text'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'html-to-pdf' },

  // E. Calculators (76-95)
  { id: 76, slug: 'gst-calculator', name: 'GST Calculator', shortDescription: 'Calculate Indian GST (5%, 12%, 18%, 28%) with CGST/SGST and IGST split.', category: 'calculators', iconName: 'Percent', acceptedFormats: ['input'], outputFormats: ['summary', '.pdf'], processingType: 'calculator', engineId: 'calculator', presetConfig: { calcType: 'gst' }, isPopular: true },
  { id: 77, slug: 'cgst-calculator', name: 'CGST Calculator', shortDescription: 'Compute Central GST (half of total GST rate) for intra-state invoices.', category: 'calculators', iconName: 'Calculator', acceptedFormats: ['input'], outputFormats: ['summary'], processingType: 'calculator', engineId: 'calculator', presetConfig: { calcType: 'gst', focus: 'cgst' } },
  { id: 78, slug: 'sgst-calculator', name: 'SGST Calculator', shortDescription: 'Compute State GST (half of total GST rate) for intra-state billing.', category: 'calculators', iconName: 'Calculator', acceptedFormats: ['input'], outputFormats: ['summary'], processingType: 'calculator', engineId: 'calculator', presetConfig: { calcType: 'gst', focus: 'sgst' } },
  { id: 79, slug: 'igst-calculator', name: 'IGST Calculator', shortDescription: 'Compute Integrated GST for inter-state supplies and B2B tax invoices.', category: 'calculators', iconName: 'Calculator', acceptedFormats: ['input'], outputFormats: ['summary'], processingType: 'calculator', engineId: 'calculator', presetConfig: { calcType: 'gst', focus: 'igst' } },
  { id: 80, slug: 'gst-inclusive-exclusive-calculator', name: 'GST Inclusive / Exclusive Calculator', shortDescription: 'Reverse-calculate base price from GST-inclusive MRP or add GST on net price.', category: 'calculators', iconName: 'ArrowLeftRight', acceptedFormats: ['input'], outputFormats: ['summary'], processingType: 'calculator', engineId: 'calculator', presetConfig: { calcType: 'gst' } },
  { id: 81, slug: 'income-tax-estimator', name: 'Income Tax Estimator (India)', shortDescription: 'Compare New Tax Regime vs Old Tax Regime slabs with 4% cess calculation.', category: 'calculators', iconName: 'Landmark', acceptedFormats: ['input'], outputFormats: ['summary'], processingType: 'calculator', engineId: 'calculator', presetConfig: { calcType: 'income-tax' }, isPopular: true },
  { id: 82, slug: 'tds-calculator', name: 'TDS Calculator', shortDescription: 'Estimate Tax Deducted at Source across salary, contractor (194C), rent (194I) & fees.', category: 'calculators', iconName: 'ReceiptIndianRupee', acceptedFormats: ['input'], outputFormats: ['summary'], processingType: 'calculator', engineId: 'calculator', presetConfig: { calcType: 'tds' } },
  { id: 83, slug: 'emi-calculator', name: 'EMI Calculator', shortDescription: 'Calculate monthly loan EMI, total interest payable, and year-wise repayment chart.', category: 'calculators', iconName: 'Coins', acceptedFormats: ['input'], outputFormats: ['summary'], processingType: 'calculator', engineId: 'calculator', presetConfig: { calcType: 'emi' }, isPopular: true },
  { id: 84, slug: 'simple-interest-calculator', name: 'Simple Interest Calculator', shortDescription: 'Compute principal, rate, time, and simple interest breakdown instantly.', category: 'calculators', iconName: 'TrendingUp', acceptedFormats: ['input'], outputFormats: ['summary'], processingType: 'calculator', engineId: 'calculator', presetConfig: { calcType: 'simple-interest' } },
  { id: 85, slug: 'compound-interest-calculator', name: 'Compound Interest Calculator', shortDescription: 'Calculate compounding returns across yearly, half-yearly, quarterly, or monthly rests.', category: 'calculators', iconName: 'LineChart', acceptedFormats: ['input'], outputFormats: ['summary'], processingType: 'calculator', engineId: 'calculator', presetConfig: { calcType: 'compound-interest' } },
  { id: 86, slug: 'fd-calculator', name: 'FD Calculator', shortDescription: 'Calculate Fixed Deposit maturity value and interest earned for Indian banks.', category: 'calculators', iconName: 'PiggyBank', acceptedFormats: ['input'], outputFormats: ['summary'], processingType: 'calculator', engineId: 'calculator', presetConfig: { calcType: 'fd' } },
  { id: 87, slug: 'rd-calculator', name: 'RD Calculator', shortDescription: 'Estimate Recurring Deposit maturity corpus with quarterly compounding.', category: 'calculators', iconName: 'CalendarRange', acceptedFormats: ['input'], outputFormats: ['summary'], processingType: 'calculator', engineId: 'calculator', presetConfig: { calcType: 'rd' } },
  { id: 88, slug: 'sip-calculator', name: 'SIP Calculator', shortDescription: 'Project Mutual Fund Systematic Investment Plan wealth growth over years.', category: 'calculators', iconName: 'BarChart3', acceptedFormats: ['input'], outputFormats: ['summary'], processingType: 'calculator', engineId: 'calculator', presetConfig: { calcType: 'sip' }, isPopular: true },
  { id: 89, slug: 'salary-calculator', name: 'Salary / In-Hand Calculator', shortDescription: 'Break down annual CTC into Basic, HRA, PF, Professional Tax, and monthly take-home.', category: 'calculators', iconName: 'Wallet', acceptedFormats: ['input'], outputFormats: ['summary'], processingType: 'calculator', engineId: 'calculator', presetConfig: { calcType: 'salary' } },
  { id: 90, slug: 'pf-calculator', name: 'EPF / PF Calculator', shortDescription: 'Project Employee Provident Fund corpus with employer & employee contributions.', category: 'calculators', iconName: 'Shield', acceptedFormats: ['input'], outputFormats: ['summary'], processingType: 'calculator', engineId: 'calculator', presetConfig: { calcType: 'pf' } },
  { id: 91, slug: 'gratuity-calculator', name: 'Gratuity Calculator', shortDescription: 'Compute statutory Indian gratuity payout based on last drawn salary & tenure.', category: 'calculators', iconName: 'Award', acceptedFormats: ['input'], outputFormats: ['summary'], processingType: 'calculator', engineId: 'calculator', presetConfig: { calcType: 'gratuity' } },
  { id: 92, slug: 'age-calculator', name: 'Age Calculator (Exam Eligibility)', shortDescription: 'Calculate exact age in Years, Months, and Days as of any govt exam cutoff date.', category: 'calculators', iconName: 'CalendarCheck', acceptedFormats: ['input'], outputFormats: ['summary'], processingType: 'calculator', engineId: 'calculator', presetConfig: { calcType: 'age' }, isCscEssential: true },
  { id: 93, slug: 'percentage-calculator', name: 'Percentage & Marks Calculator', shortDescription: 'Calculate exam percentage, CGPA conversion, percentage change, and ratios.', category: 'calculators', iconName: 'Percent', acceptedFormats: ['input'], outputFormats: ['summary'], processingType: 'calculator', engineId: 'calculator', presetConfig: { calcType: 'percentage' } },
  { id: 94, slug: 'discount-calculator', name: 'Discount Calculator', shortDescription: 'Compute final sale price and net savings after percentage or flat discounts.', category: 'calculators', iconName: 'Tag', acceptedFormats: ['input'], outputFormats: ['summary'], processingType: 'calculator', engineId: 'calculator', presetConfig: { calcType: 'discount' } },
  { id: 95, slug: 'land-measurement-converter', name: 'Land Measurement Converter', shortDescription: 'Convert Bigha, Vigha, Guntha, Acre, Hectare, Sq.Ft, Sq.Yard & Sq.Meter across India.', category: 'calculators', iconName: 'Map', acceptedFormats: ['input'], outputFormats: ['summary'], processingType: 'calculator', engineId: 'calculator', presetConfig: { calcType: 'land' }, isCscEssential: true, isPopular: true },

  // F. QR and barcode (96-105)
  { id: 96, slug: 'qr-code-generator', name: 'QR Code Generator', shortDescription: 'Create crisp custom-colored QR codes for links, text, or printed posters.', category: 'qr-barcode', iconName: 'QrCode', acceptedFormats: ['text'], outputFormats: ['.png', '.svg', '.pdf'], processingType: 'generator', engineId: 'qr-generator', presetConfig: { qrMode: 'text' }, isPopular: true },
  { id: 97, slug: 'qr-code-scanner', name: 'QR Code Scanner', shortDescription: 'Decode QR codes from uploaded JPG/PNG images instantly in your browser.', category: 'qr-barcode', iconName: 'Scan', acceptedFormats: ['.jpg', '.jpeg', '.png', '.webp'], outputFormats: ['text'], processingType: 'client-browser', engineId: 'qr-scanner' },
  { id: 98, slug: 'upi-qr-generator', name: 'UPI QR Generator', shortDescription: 'Generate scannable BHIM / GPay / PhonePe UPI payment QR codes with fixed or open amount.', category: 'qr-barcode', iconName: 'IndianRupee', acceptedFormats: ['form'], outputFormats: ['.png', '.pdf'], processingType: 'generator', engineId: 'qr-generator', presetConfig: { qrMode: 'upi' }, isPopular: true, isCscEssential: true },
  { id: 99, slug: 'whatsapp-qr-generator', name: 'WhatsApp QR Generator', shortDescription: 'Create a direct WhatsApp chat QR code with pre-filled customer message.', category: 'qr-barcode', iconName: 'MessageCircle', acceptedFormats: ['form'], outputFormats: ['.png', '.pdf'], processingType: 'generator', engineId: 'qr-generator', presetConfig: { qrMode: 'whatsapp' } },
  { id: 100, slug: 'website-qr-generator', name: 'Website QR Generator', shortDescription: 'Generate scannable URL QR codes for brochures, menus, and shop boards.', category: 'qr-barcode', iconName: 'Globe', acceptedFormats: ['form'], outputFormats: ['.png', '.pdf'], processingType: 'generator', engineId: 'qr-generator', presetConfig: { qrMode: 'url' } },
  { id: 101, slug: 'wifi-qr-generator', name: 'Wi-Fi QR Generator', shortDescription: 'Let café or office visitors connect to Wi-Fi automatically by scanning a QR code.', category: 'qr-barcode', iconName: 'Wifi', acceptedFormats: ['form'], outputFormats: ['.png', '.pdf'], processingType: 'generator', engineId: 'qr-generator', presetConfig: { qrMode: 'wifi' } },
  { id: 102, slug: 'contact-qr-generator', name: 'Contact vCard QR Generator', shortDescription: 'Encode phone, email, address & organization into a one-tap Save Contact QR.', category: 'qr-barcode', iconName: 'Contact', acceptedFormats: ['form'], outputFormats: ['.png', '.pdf'], processingType: 'generator', engineId: 'qr-generator', presetConfig: { qrMode: 'vcard' } },
  { id: 103, slug: 'barcode-generator', name: 'Barcode Generator', shortDescription: 'Generate CODE128, EAN-13, UPC, and CODE39 retail & inventory barcodes.', category: 'qr-barcode', iconName: 'Barcode', acceptedFormats: ['text'], outputFormats: ['.png', '.svg'], processingType: 'generator', engineId: 'barcode-generator' },
  { id: 104, slug: 'barcode-scanner', name: 'Barcode & QR Image Reader', shortDescription: 'Scan barcodes and QR matrices using browser BarcodeDetector + jsQR engine.', category: 'qr-barcode', iconName: 'ScanBarcode', acceptedFormats: ['.jpg', '.png', '.webp'], outputFormats: ['text'], processingType: 'client-browser', engineId: 'qr-scanner', presetConfig: { includeBarcode: true } },
  { id: 105, slug: 'qr-code-to-image-pdf', name: 'QR Code Standee / PDF Maker', shortDescription: 'Place your QR code on a printable A4/A5 payment or store display PDF poster.', category: 'qr-barcode', iconName: 'FileImage', acceptedFormats: ['form'], outputFormats: ['.pdf', '.png'], processingType: 'generator', engineId: 'qr-generator', presetConfig: { qrMode: 'standee' } },

  // G. Document and business generators (106-120)
  { id: 106, slug: 'invoice-generator', name: 'Invoice Generator', shortDescription: 'Create clean itemized business invoices with logo header and instant PDF download.', category: 'business-tools', iconName: 'FileSpreadsheet', acceptedFormats: ['form'], outputFormats: ['.pdf'], processingType: 'generator', engineId: 'business-doc', presetConfig: { docType: 'invoice' }, isPopular: true },
  { id: 107, slug: 'gst-invoice-generator', name: 'GST Invoice Generator', shortDescription: 'Generate Indian GST tax invoices with GSTIN, HSN/SAC codes, CGST/SGST & IGST.', category: 'business-tools', iconName: 'ReceiptText', acceptedFormats: ['form'], outputFormats: ['.pdf'], processingType: 'generator', engineId: 'business-doc', presetConfig: { docType: 'gst-invoice' }, tier: 'professional', isPopular: true, isCscEssential: true },
  { id: 108, slug: 'quotation-generator', name: 'Quotation / Estimate Generator', shortDescription: 'Send professional project or hardware quotations with validity and terms.', category: 'business-tools', iconName: 'FileText', acceptedFormats: ['form'], outputFormats: ['.pdf'], processingType: 'generator', engineId: 'business-doc', presetConfig: { docType: 'quotation' } },
  { id: 109, slug: 'payment-receipt-generator', name: 'Payment Receipt Generator', shortDescription: 'Issue signed cash/UPI/bank payment receipts for customers and centres.', category: 'business-tools', iconName: 'Receipt', acceptedFormats: ['form'], outputFormats: ['.pdf'], processingType: 'generator', engineId: 'business-doc', presetConfig: { docType: 'receipt' }, isCscEssential: true },
  { id: 110, slug: 'delivery-challan-generator', name: 'Delivery Challan Generator', shortDescription: 'Create GST-compliant goods dispatch and delivery challans for printing.', category: 'business-tools', iconName: 'Truck', acceptedFormats: ['form'], outputFormats: ['.pdf'], processingType: 'generator', engineId: 'business-doc', presetConfig: { docType: 'challan' } },
  { id: 111, slug: 'purchase-order-generator', name: 'Purchase Order Generator', shortDescription: 'Generate structured vendor Purchase Orders (PO) with itemized quantities.', category: 'business-tools', iconName: 'ClipboardList', acceptedFormats: ['form'], outputFormats: ['.pdf'], processingType: 'generator', engineId: 'business-doc', presetConfig: { docType: 'po' } },
  { id: 112, slug: 'salary-slip-generator', name: 'Salary Slip Generator', shortDescription: 'Generate monthly employee payslips with earnings, deductions, and net pay.', category: 'business-tools', iconName: 'Banknote', acceptedFormats: ['form'], outputFormats: ['.pdf'], processingType: 'generator', engineId: 'business-doc', presetConfig: { docType: 'salary-slip' } },
  { id: 113, slug: 'experience-certificate-generator', name: 'Experience Certificate Generator', shortDescription: 'Draft official relieving and work experience letters on company letterhead.', category: 'business-tools', iconName: 'Award', acceptedFormats: ['form'], outputFormats: ['.pdf'], processingType: 'generator', engineId: 'business-doc', presetConfig: { docType: 'experience' } },
  { id: 114, slug: 'offer-letter-generator', name: 'Offer Letter Generator', shortDescription: 'Generate clean employment offer letters with CTC, joining date, and terms.', category: 'business-tools', iconName: 'MailCheck', acceptedFormats: ['form'], outputFormats: ['.pdf'], processingType: 'generator', engineId: 'business-doc', presetConfig: { docType: 'offer-letter' } },
  { id: 115, slug: 'resignation-letter-generator', name: 'Resignation Letter Generator', shortDescription: 'Create polite, formal resignation letters with notice period details.', category: 'business-tools', iconName: 'FileMinus', acceptedFormats: ['form'], outputFormats: ['.pdf', '.txt'], processingType: 'generator', engineId: 'business-doc', presetConfig: { docType: 'resignation' } },
  { id: 116, slug: 'business-card-maker', name: 'Business Card Maker', shortDescription: 'Design crisp printable visiting cards with optional UPI/contact QR code.', category: 'business-tools', iconName: 'CreditCard', acceptedFormats: ['form'], outputFormats: ['.png', '.pdf'], processingType: 'generator', engineId: 'business-doc', presetConfig: { docType: 'business-card' } },
  { id: 117, slug: 'letterhead-maker', name: 'Letterhead Maker', shortDescription: 'Create custom A4 company or CSC centre letterheads ready for Word or print.', category: 'business-tools', iconName: 'FileCheck2', acceptedFormats: ['form'], outputFormats: ['.pdf'], processingType: 'generator', engineId: 'business-doc', presetConfig: { docType: 'letterhead' }, tier: 'professional' },
  { id: 118, slug: 'id-card-maker', name: 'ID Card Maker', shortDescription: 'Generate student, staff, or visitor photo ID cards with barcode/QR.', category: 'business-tools', iconName: 'BadgeCheck', acceptedFormats: ['form', '.jpg'], outputFormats: ['.png', '.pdf'], processingType: 'generator', engineId: 'business-doc', presetConfig: { docType: 'id-card' } },
  { id: 119, slug: 'certificate-maker', name: 'Certificate Maker', shortDescription: 'Design completion, training, or appreciation certificates with border & seal.', category: 'business-tools', iconName: 'Medal', acceptedFormats: ['form'], outputFormats: ['.pdf', '.png'], processingType: 'generator', engineId: 'business-doc', presetConfig: { docType: 'certificate' } },
  { id: 120, slug: 'visiting-card-qr-generator', name: 'Visiting Card QR Generator', shortDescription: 'Generate compact high-contrast contact QR badges sized for visiting cards.', category: 'business-tools', iconName: 'QrCode', acceptedFormats: ['form'], outputFormats: ['.png', '.svg'], processingType: 'generator', engineId: 'qr-generator', presetConfig: { qrMode: 'vcard' } },

  // H. Text, OCR and language (121-130)
  { id: 121, slug: 'image-to-text-ocr', name: 'Image to Text OCR', shortDescription: 'Extract editable text from scanned forms, screenshots, and photos with Tesseract OCR.', category: 'text-ocr', iconName: 'ScanText', acceptedFormats: ['.jpg', '.jpeg', '.png', '.webp'], outputFormats: ['.txt'], processingType: 'client-browser', engineId: 'ocr-text', presetConfig: { lang: 'eng' }, isPopular: true },
  { id: 122, slug: 'pdf-to-text', name: 'PDF to Text', shortDescription: 'Extract all readable text across every page of a PDF file cleanly.', category: 'text-ocr', iconName: 'FileText', acceptedFormats: ['.pdf'], outputFormats: ['.txt'], processingType: 'client-browser', engineId: 'ocr-text', presetConfig: { mode: 'pdf-text' } },
  { id: 123, slug: 'hindi-ocr', name: 'Hindi OCR (हिन्दी OCR)', shortDescription: 'Recognize Devanagari Hindi printed documents from images directly in browser.', category: 'text-ocr', iconName: 'Languages', acceptedFormats: ['.jpg', '.jpeg', '.png'], outputFormats: ['.txt'], processingType: 'client-browser', engineId: 'ocr-text', presetConfig: { lang: 'hin' }, tier: 'csc', isCscEssential: true },
  { id: 124, slug: 'gujarati-ocr', name: 'Gujarati OCR (ગુજરાતી OCR)', shortDescription: 'Extract Gujarati script text from scanned documents and photos.', category: 'text-ocr', iconName: 'Languages', acceptedFormats: ['.jpg', '.jpeg', '.png'], outputFormats: ['.txt'], processingType: 'client-browser', engineId: 'ocr-text', presetConfig: { lang: 'guj' }, tier: 'csc', isCscEssential: true },
  { id: 125, slug: 'english-ocr', name: 'English OCR', shortDescription: 'High-accuracy English text recognition for receipts, letters, and books.', category: 'text-ocr', iconName: 'FileSearch2', acceptedFormats: ['.jpg', '.jpeg', '.png', '.webp'], outputFormats: ['.txt'], processingType: 'client-browser', engineId: 'ocr-text', presetConfig: { lang: 'eng' } },
  { id: 126, slug: 'word-counter', name: 'Word Counter', shortDescription: 'Count words, sentences, paragraphs, reading time, and keyword density live.', category: 'text-ocr', iconName: 'AlignLeft', acceptedFormats: ['text'], outputFormats: ['summary'], processingType: 'client-browser', engineId: 'text-utility', presetConfig: { mode: 'count' } },
  { id: 127, slug: 'character-counter', name: 'Character & SEO Length Counter', shortDescription: 'Check exact character limits for government form boxes, SMS, and SEO meta tags.', category: 'seo-tools', iconName: 'TextCursorInput', acceptedFormats: ['text'], outputFormats: ['summary'], processingType: 'client-browser', engineId: 'text-utility', presetConfig: { mode: 'chars' } },
  { id: 128, slug: 'text-case-converter', name: 'Text Case Converter', shortDescription: 'Convert text between UPPERCASE, lowercase, Title Case, Sentence case, and camelCase.', category: 'text-ocr', iconName: 'CaseSensitive', acceptedFormats: ['text'], outputFormats: ['.txt'], processingType: 'client-browser', engineId: 'text-utility', presetConfig: { mode: 'case' } },
  { id: 129, slug: 'text-cleaner', name: 'Text Cleaner & Formatter', shortDescription: 'Strip extra spaces, duplicate lines, blank rows, and HTML tags in one click.', category: 'text-ocr', iconName: 'Eraser', acceptedFormats: ['text'], outputFormats: ['.txt'], processingType: 'client-browser', engineId: 'text-utility', presetConfig: { mode: 'clean' } },
  { id: 130, slug: 'text-to-speech-stt', name: 'Text to Speech / Voice Typing', shortDescription: 'Listen to pasted text aloud or dictate English, Hindi & Gujarati with your mic.', category: 'audio-tools', iconName: 'Volume2', acceptedFormats: ['text', 'mic'], outputFormats: ['audio', '.txt'], processingType: 'client-browser', engineId: 'speech-tool' },

  // I. Printing and cyber café (131-140)
  { id: 131, slug: 'print-cost-calculator', name: 'Print Cost Calculator', shortDescription: 'Calculate customer billing for B&W/Color prints, duplex, binding & lamination.', category: 'printing-tools', iconName: 'Printer', acceptedFormats: ['input'], outputFormats: ['summary', '.pdf'], processingType: 'calculator', engineId: 'print-calculator', presetConfig: { mode: 'print' }, isCscEssential: true },
  { id: 132, slug: 'photocopy-cost-calculator', name: 'Photocopy Cost Calculator', shortDescription: 'Quickly price bulk Xerox / photocopy orders with slab discounts.', category: 'printing-tools', iconName: 'Copy', acceptedFormats: ['input'], outputFormats: ['summary'], processingType: 'calculator', engineId: 'print-calculator', presetConfig: { mode: 'xerox' }, isCscEssential: true },
  { id: 133, slug: 'a4-to-a3-converter', name: 'A4 to A3 PDF Scaler', shortDescription: 'Scale A4 PDF pages cleanly onto A3 sheets (or A3 down to A4) for shop printers.', category: 'printing-tools', iconName: 'Maximize', acceptedFormats: ['.pdf'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'print-layout', presetConfig: { layout: 'a4-to-a3' } },
  { id: 134, slug: 'multiple-pages-per-sheet', name: 'Multiple Pages Per Sheet (N-Up)', shortDescription: 'Arrange 2, 4, or 6 PDF pages onto a single A4 sheet to save paper and toner.', category: 'printing-tools', iconName: 'LayoutGrid', acceptedFormats: ['.pdf'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'print-layout', presetConfig: { layout: 'nup' }, isCscEssential: true },
  { id: 135, slug: 'booklet-print-layout', name: 'Booklet Print Layout', shortDescription: 'Impose PDF pages in 2-up booklet folding order ready for centre-stapled printing.', category: 'printing-tools', iconName: 'BookOpen', acceptedFormats: ['.pdf'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'print-layout', presetConfig: { layout: 'booklet' } },
  { id: 136, slug: 'passport-photo-print-sheet', name: 'Passport Photo Print Sheet (4×6 / A4)', shortDescription: 'Tile 8, 12, or 30 passport photos onto a 4×6 inch or A4 sheet with cut guides.', category: 'printing-tools', iconName: 'Grid', acceptedFormats: ['.jpg', '.jpeg', '.png'], outputFormats: ['.jpg', '.pdf'], processingType: 'client-browser', engineId: 'passport-photo', presetConfig: { mode: 'sheet' }, tier: 'csc', isPopular: true, isCscEssential: true },
  { id: 137, slug: 'signature-print-sheet', name: 'Signature Print Sheet', shortDescription: 'Place multiple cropped signatures cleanly on one sheet for batch verification.', category: 'printing-tools', iconName: 'PenLine', acceptedFormats: ['.jpg', '.jpeg', '.png'], outputFormats: ['.jpg', '.pdf'], processingType: 'client-browser', engineId: 'signature-studio', presetConfig: { sheet: true } },
  { id: 138, slug: 'pdf-print-optimizer', name: 'PDF Print Optimizer', shortDescription: 'Standardize margins and render PDFs into high-contrast print-ready A4 pages.', category: 'printing-tools', iconName: 'PrinterCheck', acceptedFormats: ['.pdf'], outputFormats: ['.pdf'], processingType: 'client-browser', engineId: 'print-layout', presetConfig: { layout: 'optimize' } },
  { id: 139, slug: 'print-job-receipt-generator', name: 'Print Job Receipt Generator', shortDescription: 'Create quick café customer receipts for printing, scanning, and lamination.', category: 'printing-tools', iconName: 'Receipt', acceptedFormats: ['form'], outputFormats: ['.pdf'], processingType: 'generator', engineId: 'business-doc', presetConfig: { docType: 'print-receipt' }, isCscEssential: true },
  { id: 140, slug: 'customer-service-bill-generator', name: 'Customer Service Bill Generator', shortDescription: 'Generate itemized CSC / cyber café service bills with UPI QR and centre footer.', category: 'printing-tools', iconName: 'FileSpreadsheet', acceptedFormats: ['form'], outputFormats: ['.pdf'], processingType: 'generator', engineId: 'business-doc', presetConfig: { docType: 'service-bill' }, tier: 'csc', isCscEssential: true },

  // J. AI tools (141-150)
  { id: 141, slug: 'ai-document-summarizer', name: 'AI Document Summarizer', shortDescription: 'Summarize long circulars, PDFs, notices, and agreements into clear bullet takeaways.', category: 'ai-tools', iconName: 'Sparkles', acceptedFormats: ['.pdf', '.txt', 'text'], outputFormats: ['text'], processingType: 'server-ai', engineId: 'ai-assistant', presetConfig: { aiMode: 'summarize' }, tier: 'personal', isAiPowered: true, isPopular: true, isRecent: true },
  { id: 142, slug: 'ai-pdf-assistant', name: 'AI PDF Assistant', shortDescription: 'Upload a PDF and ask specific questions to locate clauses, dates, and rules.', category: 'ai-tools', iconName: 'MessageSquareText', acceptedFormats: ['.pdf', 'text'], outputFormats: ['text'], processingType: 'server-ai', engineId: 'ai-assistant', presetConfig: { aiMode: 'pdf-qa' }, isAiPowered: true, isPopular: true, isRecent: true },
  { id: 143, slug: 'ai-application-letter-writer', name: 'AI Application Letter Writer', shortDescription: 'Draft formal applications for banks, municipal offices, schools, and utilities.', category: 'ai-tools', iconName: 'Sparkles', acceptedFormats: ['text'], outputFormats: ['text', '.pdf'], processingType: 'server-ai', engineId: 'ai-assistant', presetConfig: { aiMode: 'letter' }, isAiPowered: true, isCscEssential: true },
  { id: 144, slug: 'ai-resume-builder', name: 'AI Resume Builder', shortDescription: 'Turn raw career details into polished ATS-friendly resume summaries and bullets.', category: 'ai-tools', iconName: 'UserCheck', acceptedFormats: ['text'], outputFormats: ['text', '.pdf'], processingType: 'server-ai', engineId: 'ai-assistant', presetConfig: { aiMode: 'resume' }, isAiPowered: true },
  { id: 145, slug: 'ai-translation-assistant', name: 'AI Translation Assistant', shortDescription: 'Translate documents cleanly across English, Hindi, Gujarati, Marathi, and more.', category: 'ai-tools', iconName: 'Languages', acceptedFormats: ['text', '.pdf'], outputFormats: ['text'], processingType: 'server-ai', engineId: 'ai-assistant', presetConfig: { aiMode: 'translate' }, tier: 'personal', isAiPowered: true, isPopular: true },
  { id: 146, slug: 'ai-invoice-data-extractor', name: 'AI Invoice Data Extractor', shortDescription: 'Extract vendor, GSTIN, invoice number, totals, and line items into structured JSON/CSV.', category: 'ai-tools', iconName: 'FileJson', acceptedFormats: ['.jpg', '.png', '.pdf', 'text'], outputFormats: ['.json', '.csv'], processingType: 'server-ai', engineId: 'ai-assistant', presetConfig: { aiMode: 'extract-invoice' }, tier: 'professional', isAiPowered: true, isRecent: true },
  { id: 147, slug: 'ai-document-data-extractor', name: 'AI Document Data Extractor', shortDescription: 'Parse unstructured forms or notices into clean key-value fields and CSV tables.', category: 'ai-tools', iconName: 'Database', acceptedFormats: ['.jpg', '.png', '.pdf', 'text'], outputFormats: ['.json', '.csv'], processingType: 'server-ai', engineId: 'ai-assistant', presetConfig: { aiMode: 'extract-doc' }, tier: 'professional', isAiPowered: true },
  { id: 148, slug: 'ai-grammar-checker', name: 'AI Grammar & Clarity Checker', shortDescription: 'Fix grammar, spelling, and official tone in emails, letters, and reports.', category: 'ai-tools', iconName: 'SpellCheck', acceptedFormats: ['text'], outputFormats: ['text'], processingType: 'server-ai', engineId: 'ai-assistant', presetConfig: { aiMode: 'grammar' }, isAiPowered: true },
  { id: 149, slug: 'ai-form-filling-assistant', name: 'AI Form-Filling Assistant', shortDescription: 'Understand confusing application fields and generate clean draft responses.', category: 'ai-tools', iconName: 'ClipboardEdit', acceptedFormats: ['text'], outputFormats: ['text'], processingType: 'server-ai', engineId: 'ai-assistant', presetConfig: { aiMode: 'form-help' }, isAiPowered: true, isCscEssential: true },
  { id: 150, slug: 'ai-document-checklist-assistant', name: 'AI Document Checklist Assistant', shortDescription: 'Get a custom required-document checklist for any state scheme, visa, or license.', category: 'ai-tools', iconName: 'ListChecks', acceptedFormats: ['text'], outputFormats: ['text'], processingType: 'server-ai', engineId: 'ai-assistant', presetConfig: { aiMode: 'checklist' }, isAiPowered: true, isCscEssential: true },
];

export const TOOLS_REGISTRY: ToolDefinition[] = RAW_TOOLS.map((raw, idx) => {
  const nextSlug = RAW_TOOLS[(idx + 1) % RAW_TOOLS.length].slug;
  const prevSlug = RAW_TOOLS[(idx - 1 + RAW_TOOLS.length) % RAW_TOOLS.length].slug;
  const sameCategorySlugs = RAW_TOOLS.filter(
    (t) => t.category === raw.category && t.slug !== raw.slug
  )
    .slice(0, 3)
    .map((t) => t.slug);

  const related = Array.from(new Set([...sameCategorySlugs, nextSlug, prevSlug])).slice(0, 4);

  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    shortDescription: raw.shortDescription,
    longDescription: `${raw.shortDescription} Built for Digital India Project citizens, CSC Digital Seva operators, cyber cafés, students, and small businesses with clean output and zero clutter.`,
    category: raw.category,
    categoryLabel: CATEGORY_LABELS[raw.category],
    iconName: raw.iconName,
    acceptedFormats: raw.acceptedFormats,
    outputFormats: raw.outputFormats,
    maxFileSizeMb: raw.processingType === 'server-ai' ? 10 : 50,
    processingType: raw.processingType,
    engineId: raw.engineId,
    presetConfig: raw.presetConfig,
    tier: raw.tier || 'free',
    singleUsePriceInr: raw.tier && raw.tier !== 'free' ? (raw.singleUsePriceInr ?? 10) : 0,
    isPopular: Boolean(raw.isPopular),
    isRecent: Boolean(raw.isRecent),
    isCscEssential: Boolean(raw.isCscEssential),
    isAiPowered: Boolean(raw.isAiPowered),
    howToSteps: [
      `Upload your file or enter input details in the ${raw.name} workspace.`,
      'Adjust quality, page, size, or language settings as needed.',
      'Click Process / Generate to run the engine and inspect the instant preview.',
      'Download the final result directly to your device.',
    ],
    features: [
      raw.processingType === 'client-browser'
        ? 'Runs locally in your browser for speed and document privacy'
        : raw.processingType === 'server-ai'
        ? 'Powered by secure server-side AI with zero training on your documents'
        : 'Instant deterministic calculation and printable PDF export',
      'Clean mobile and desktop workflow with keyboard accessibility',
      'Built for Indian portal requirements, CSC counters, and global standards',
    ],
    limitations:
      raw.limitations ||
      'Extremely large multi-hundred-MB files depend on device memory when processed locally in browser.',
    faqs: [
      {
        q: `Is ${raw.name} safe for Aadhaar, PAN, or personal documents?`,
        a:
          raw.processingType === 'server-ai'
            ? 'AI requests process uploaded text or images transiently on the server without retaining identity documents or training AI models.'
            : 'Yes. Processing happens directly inside your browser memory, so your files do not leave your device.',
      },
      {
        q: `Do I need an account to use ${raw.name}?`,
        a: 'No sign-up is required for core utilities. Sign in with Google to save favourite tools, history, or manage a CSC centre.',
      },
    ],
    relatedSlugs: related,
  };
});

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  return TOOLS_REGISTRY.find((t) => t.slug === slug);
}

export function getToolsByCategory(categorySlug: string): ToolDefinition[] {
  if (categorySlug === 'all') return TOOLS_REGISTRY;
  if (categorySlug === 'document-tools') {
    return TOOLS_REGISTRY.filter((t) =>
      ['pdf-tools', 'business-tools', 'csc-tools'].includes(t.category)
    );
  }
  if (categorySlug === 'government-assistance') {
    return TOOLS_REGISTRY.filter((t) => t.category === 'csc-tools' || t.isCscEssential);
  }
  if (categorySlug === 'audio-tools') {
    return TOOLS_REGISTRY.filter(
      (t) => t.category === 'audio-tools' || t.engineId === 'speech-tool'
    );
  }
  if (categorySlug === 'video-tools') {
    return TOOLS_REGISTRY.filter((t) => t.category === 'video-tools');
  }
  if (categorySlug === 'developer-tools') {
    return TOOLS_REGISTRY.filter(
      (t) => t.category === 'developer-tools' || t.engineId === 'data-converter'
    );
  }
  if (categorySlug === 'seo-tools') {
    return TOOLS_REGISTRY.filter(
      (t) => t.category === 'seo-tools' || t.engineId === 'text-utility'
    );
  }
  return TOOLS_REGISTRY.filter((t) => t.category === categorySlug);
}

const CATEGORY_ALIASES: Partial<Record<ToolCategorySlug, string>> = {
  'pdf-tools': 'pdf utilities',
  'image-tools': 'image processing photo editing',
  'csc-tools': 'csc govt portals digital seva',
  compressors: 'file compressors size reducer',
  converters: 'document converters file format',
  calculators: 'financial calculators gst emi sip tax',
  'qr-barcode': 'qr barcodes scanner',
  'business-tools': 'business billing invoice receipt',
  'text-ocr': 'ocr language hindi gujarati text',
  'printing-tools': 'printing cyber cafe layout',
  'ai-tools': 'ai assistants summary extract',
};

const CATEGORY_SEARCH_TEXT = new Map<string, string>(
  CATEGORIES.map((c) => [
    c.slug,
    `${c.title} ${c.slug} ${c.description} ${CATEGORY_ALIASES[c.slug] || ''}`.toLowerCase(),
  ])
);

export function searchCategories(queryText: string): Array<CategoryMeta & { toolCount: number }> {
  const q = queryText.trim().toLowerCase();
  if (!q) return [];
  return CATEGORIES.filter((c) => (CATEGORY_SEARCH_TEXT.get(c.slug) || '').includes(q)).map((c) => ({
    ...c,
    toolCount: getToolsByCategory(c.slug).length,
  }));
}

export function searchTools(queryText: string): ToolDefinition[] {
  const q = queryText.trim().toLowerCase();
  if (!q) return TOOLS_REGISTRY;

  const tokens = q.split(/\s+/).filter(Boolean);
  const scored: Array<{ tool: ToolDefinition; score: number }> = [];

  for (const t of TOOLS_REGISTRY) {
    const nameLower = t.name.toLowerCase();
    const catLabelLower = t.categoryLabel.toLowerCase();
    const catFullLower = CATEGORY_SEARCH_TEXT.get(t.category) || t.category.toLowerCase();
    const shortDescLower = t.shortDescription.toLowerCase();
    const longDescLower = t.longDescription.toLowerCase();
    const slugLower = t.slug.toLowerCase();

    let score = 0;
    if (nameLower === q) score = 100;
    else if (nameLower.startsWith(q)) score = 85;
    else if (nameLower.includes(q)) score = 65;
    else if (slugLower.includes(q)) score = 50;
    else if (shortDescLower.includes(q)) score = 45;
    else if (catLabelLower.includes(q) || catFullLower.includes(q)) score = 35;
    else if (longDescLower.includes(q)) score = 25;
    else if (tokens.length > 1) {
      const combined = `${nameLower} ${slugLower} ${shortDescLower} ${longDescLower} ${catLabelLower} ${catFullLower}`;
      if (tokens.every((tok) => combined.includes(tok))) {
        score = tokens.every((tok) => nameLower.includes(tok)) ? 55 : 30;
      }
    }

    if (score > 0) {
      scored.push({ tool: t, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.tool.id - b.tool.id);
  return scored.map((s) => s.tool);
}
