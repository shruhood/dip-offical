export type LanguageCode = 'en' | 'hi' | 'gu';

export type PricingTier = 'free' | 'personal' | 'csc' | 'professional';

export type ToolCategorySlug =
  | 'pdf-tools'
  | 'image-tools'
  | 'csc-tools'
  | 'compressors'
  | 'converters'
  | 'calculators'
  | 'qr-barcode'
  | 'business-tools'
  | 'text-ocr'
  | 'printing-tools'
  | 'ai-tools'
  | 'document-tools'
  | 'government-assistance'
  | 'audio-tools'
  | 'video-tools'
  | 'developer-tools'
  | 'seo-tools';

export type ToolEngineId =
  | 'pdf-merge'
  | 'pdf-split'
  | 'pdf-compress'
  | 'pdf-rotate'
  | 'pdf-delete-pages'
  | 'pdf-extract-pages'
  | 'pdf-reorder-pages'
  | 'pdf-page-numbers'
  | 'pdf-watermark'
  | 'pdf-protect'
  | 'pdf-unlock'
  | 'pdf-to-image'
  | 'image-to-pdf'
  | 'pdf-to-word'
  | 'word-to-pdf'
  | 'pdf-to-excel'
  | 'excel-to-pdf'
  | 'pdf-ocr'
  | 'image-compress'
  | 'image-kb-compress'
  | 'image-resize'
  | 'image-crop'
  | 'image-convert'
  | 'image-bg-remove'
  | 'image-enhance'
  | 'image-dpi'
  | 'image-strip-exif'
  | 'passport-photo'
  | 'signature-studio'
  | 'document-scanner'
  | 'document-checklist'
  | 'document-renamer'
  | 'dimension-checker'
  | 'letter-generator'
  | 'typing-tool'
  | 'zip-creator'
  | 'zip-extractor'
  | 'data-converter'
  | 'html-to-pdf'
  | 'media-compressor'
  | 'calculator'
  | 'qr-generator'
  | 'qr-scanner'
  | 'barcode-generator'
  | 'business-doc'
  | 'ocr-text'
  | 'text-utility'
  | 'speech-tool'
  | 'print-layout'
  | 'print-calculator'
  | 'ai-assistant';

export interface ToolFaq {
  q: string;
  a: string;
}

export interface ToolDefinition {
  id: number;
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  category: ToolCategorySlug;
  categoryLabel: string;
  iconName: string;
  acceptedFormats: string[];
  outputFormats: string[];
  maxFileSizeMb: number;
  processingType: 'client-browser' | 'server-ai' | 'calculator' | 'generator';
  engineId: ToolEngineId;
  presetConfig?: Record<string, string | number | boolean>;
  tier: PricingTier;
  singleUsePriceInr?: number;
  isPopular?: boolean;
  isRecent?: boolean;
  isCscEssential?: boolean;
  isAiPowered?: boolean;
  howToSteps: string[];
  features: string[];
  limitations: string;
  faqs: ToolFaq[];
  relatedSlugs: string[];
}

export interface ToolSingleUsePass {
  toolSlug: string;
  remainingUses: number;
  priceInr: number;
  orderId?: string;
  paymentMethod?: string;
  purchasedAt: string;
}

export interface PaidToolPurchaseRecord {
  id: string;
  ownerUid: string;
  purchaseType: 'one_time' | 'subscription';
  toolSlug?: string;
  toolName: string;
  categoryLabel?: string;
  planCode?: 'personal' | 'csc' | 'professional' | 'enterprise';
  billingCycle?: 'monthly' | 'annual';
  amountInr: number;
  orderId?: string;
  paymentMethod?: string;
  purchasedAt: string;
  lastUsedAt?: string;
  usesGranted: number;
  usesConsumed: number;
}

export interface CategoryMeta {
  slug: ToolCategorySlug;
  title: string;
  description: string;
  iconName: string;
  accentColor: string;
}

export interface UserProfileDoc {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: 'user' | 'csc_operator' | 'admin';
  plan: 'free' | 'personal' | 'csc' | 'professional' | 'enterprise';
  language: LanguageCode;
  creditsRemaining?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ToolFavouriteDoc {
  ownerUid: string;
  toolSlug: string;
  toolName: string;
  category: string;
  createdAt: string;
}

export interface ToolHistoryDoc {
  id?: string;
  ownerUid: string;
  toolSlug: string;
  toolName: string;
  status: 'completed' | 'failed';
  inputSummary?: string;
  outputSummary?: string;
  durationMs?: number;
  createdAt: string;
}

export interface AnnouncementDoc {
  id: string;
  type: 'tool_update' | 'new_tool';
  toolSlug?: string;
  toolName?: string;
  title: string;
  message: string;
  createdByUid: string;
  createdAt: string;
}

export interface NotificationStateDoc {
  ownerUid: string;
  notificationId: string;
  read: boolean;
  dismissed: boolean;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  kind: 'favorite_update' | 'new_tool';
  toolSlug?: string;
  toolName?: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  source: 'changelog' | 'live';
}

export interface ToolReviewDoc {
  id: string;
  toolSlug: string;
  authorUid: string;
  authorName: string;
  authorPhotoUrl?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title?: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolReviewStats {
  totalCount: number;
  averageRating: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

