import type {
  AnnouncementDoc,
  AppNotification,
  NotificationStateDoc,
  ToolDefinition,
  ToolFavouriteDoc,
} from '../types/tool';
import { getToolBySlug } from '../data/toolsRegistry';

export const NOTIFICATION_STORAGE_KEY = 'dip_tool_notification_states_v1';

export interface LocalNotificationState {
  readIds: string[];
  dismissedIds: string[];
}

export interface ChangelogReleaseEntry {
  id: string;
  type: 'tool_update' | 'new_tool';
  toolSlug: string;
  title: string;
  message: string;
  createdAt: string;
}

export const TOOL_CHANGELOG_ENTRIES: ChangelogReleaseEntry[] = [
  {
    id: 'rel_new_ai_invoice_extractor',
    type: 'new_tool',
    toolSlug: 'ai-invoice-data-extractor',
    title: 'New Tool Added: AI Invoice Data Extractor',
    message:
      'Extract vendor GSTIN, invoice totals, and line items into JSON or CSV cleanly — unlock for ₹10 per use or Professional plan.',
    createdAt: '2026-11-15T04:00:00.000Z',
  },
  {
    id: 'rel_new_ai_pdf_assistant',
    type: 'new_tool',
    toolSlug: 'ai-pdf-assistant',
    title: 'New Tool Added: AI PDF Assistant',
    message:
      'Ask questions against long circulars, notices, and application guidelines with instant grounded answers.',
    createdAt: '2026-11-14T10:30:00.000Z',
  },
  {
    id: 'rel_new_pdf_ocr',
    type: 'new_tool',
    toolSlug: 'pdf-ocr',
    title: 'New Tool Added: PDF OCR / Searchable PDF',
    message:
      'Convert scanned multi-page PDFs into searchable text directly inside your browser (₹10 1-time pass or Personal Pro).',
    createdAt: '2026-11-12T09:00:00.000Z',
  },
  {
    id: 'rel_new_ai_doc_summarizer',
    type: 'new_tool',
    toolSlug: 'ai-document-summarizer',
    title: 'New Tool Added: AI Document Summarizer',
    message:
      'Summarize lengthy forms, government circulars, and agreements into clear action bullet points.',
    createdAt: '2026-11-10T08:00:00.000Z',
  },
  {
    id: 'rel_upd_merge_pdf',
    type: 'tool_update',
    toolSlug: 'merge-pdf',
    title: 'Merge PDF Updated: Multi-file ordering & speed boost',
    message:
      'Faster browser-side PDF stream merging with smoother handling for large multi-page KYC packs.',
    createdAt: '2026-11-15T03:00:00.000Z',
  },
  {
    id: 'rel_upd_compress_pdf',
    type: 'tool_update',
    toolSlug: 'compress-pdf',
    title: 'Compress PDF Updated: Balanced DPI target tuning',
    message:
      'Improved target-size compression keeps QR codes and stamped text sharp under 200 KB & 2 MB portal limits.',
    createdAt: '2026-11-14T16:00:00.000Z',
  },
  {
    id: 'rel_upd_pdf_to_word',
    type: 'tool_update',
    toolSlug: 'pdf-to-word',
    title: 'PDF to Word Updated: Cleaner paragraph detection',
    message:
      'Refined line-break reconstruction for cleaner .doc exports from multi-paragraph PDFs.',
    createdAt: '2026-11-13T14:00:00.000Z',
  },
  {
    id: 'rel_upd_passport_photo',
    type: 'tool_update',
    toolSlug: 'passport-photo-maker',
    title: 'Passport Photo Maker Updated: 300 DPI 4×6 print sheets',
    message:
      'Added crisp cut-guide spacing for 8-up 4×6 and 30-up A4 sheets plus instant white/blue background presets.',
    createdAt: '2026-11-15T01:30:00.000Z',
  },
  {
    id: 'rel_upd_kb_compressor',
    type: 'tool_update',
    toolSlug: 'image-size-kb-compressor',
    title: 'Image Size in KB Compressor Updated: Tighter KB accuracy',
    message:
      'Binary-search quality tuning hits exact 20 KB, 50 KB, and 100 KB targets in fewer passes.',
    createdAt: '2026-11-14T12:00:00.000Z',
  },
  {
    id: 'rel_upd_signature_resizer',
    type: 'tool_update',
    toolSlug: 'signature-resizer',
    title: 'Signature Resizer Updated: SSC, PAN & IBPS presets',
    message:
      'Updated auto-whitening contrast threshold so blue/black ballpoint pen signatures stay crisp at 10–20 KB.',
    createdAt: '2026-11-13T11:00:00.000Z',
  },
  {
    id: 'rel_upd_bg_remover',
    type: 'tool_update',
    toolSlug: 'background-remover',
    title: 'Background Remover Updated: Edge feather refinement',
    message:
      'Smoother hair and shoulder edge blending when replacing studio backdrops with pure white.',
    createdAt: '2026-11-12T15:00:00.000Z',
  },
  {
    id: 'rel_upd_gst_calc',
    type: 'tool_update',
    toolSlug: 'gst-calculator',
    title: 'GST Calculator Updated: Inclusive & IGST breakdown',
    message:
      'Instant CGST/SGST and IGST split view with one-click copy for billing counters.',
    createdAt: '2026-11-14T09:00:00.000Z',
  },
  {
    id: 'rel_upd_emi_calc',
    type: 'tool_update',
    toolSlug: 'emi-calculator',
    title: 'EMI Calculator Updated: Year-wise repayment schedule',
    message:
      'Added principal vs interest annual amortization breakdown for loan comparisons.',
    createdAt: '2026-11-11T10:00:00.000Z',
  },
  {
    id: 'rel_upd_upi_qr',
    type: 'tool_update',
    toolSlug: 'upi-qr-generator',
    title: 'UPI QR Generator Updated: A4 Standee PDF export',
    message:
      'Download a ready-to-print A4 shop counter UPI QR standee PDF alongside high-res PNG and SVG.',
    createdAt: '2026-11-13T18:00:00.000Z',
  },
  {
    id: 'rel_upd_gst_invoice',
    type: 'tool_update',
    toolSlug: 'gst-invoice-generator',
    title: 'GST Invoice Generator Updated: HSN/SAC line items',
    message:
      'Improved multi-row GST calculation and updated footer branding for Digital Tools Tray invoices.',
    createdAt: '2026-11-14T19:00:00.000Z',
  },
  {
    id: 'rel_upd_document_scanner',
    type: 'tool_update',
    toolSlug: 'document-scanner',
    title: 'Document Scanner Filter Updated: Shadow cleanup',
    message:
      'Sharper mobile photo deskewing and contrast boost for crisp black-and-white Aadhaar & PAN prints.',
    createdAt: '2026-11-12T13:30:00.000Z',
  },
  {
    id: 'rel_upd_land_calc',
    type: 'tool_update',
    toolSlug: 'land-measurement-converter',
    title: 'Land Measurement Converter Updated: Gujarat & All-India units',
    message:
      'Instant conversion across Bigha, Vigha, Guntha, Acre, Hectare, Sq.Ft, and Sq.Meter.',
    createdAt: '2026-11-11T15:30:00.000Z',
  },
];

export function readStoredNotificationState(): LocalNotificationState {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { readIds: [], dismissedIds: [] };
    }
    const raw = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (!raw) return { readIds: [], dismissedIds: [] };
    const parsed = JSON.parse(raw);
    return {
      readIds: Array.isArray(parsed?.readIds)
        ? parsed.readIds.filter((x: unknown): x is string => typeof x === 'string')
        : [],
      dismissedIds: Array.isArray(parsed?.dismissedIds)
        ? parsed.dismissedIds.filter((x: unknown): x is string => typeof x === 'string')
        : [],
    };
  } catch {
    return { readIds: [], dismissedIds: [] };
  }
}

export function writeStoredNotificationState(state: LocalNotificationState): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function mergeNotificationStates(
  remoteDocs: NotificationStateDoc[],
  localState: LocalNotificationState
): LocalNotificationState {
  const readSet = new Set<string>(localState.readIds);
  const dismissedSet = new Set<string>(localState.dismissedIds);
  for (const doc of remoteDocs) {
    if (doc.read) readSet.add(doc.notificationId);
    if (doc.dismissed) dismissedSet.add(doc.notificationId);
  }
  return {
    readIds: Array.from(readSet),
    dismissedIds: Array.from(dismissedSet),
  };
}

export function buildUserNotifications(options: {
  favourites: ToolFavouriteDoc[];
  liveAnnouncements?: AnnouncementDoc[];
  readIds?: Iterable<string>;
  dismissedIds?: Iterable<string>;
  resolveTool?: (slug: string) => ToolDefinition | undefined;
}): AppNotification[] {
  const {
    favourites,
    liveAnnouncements = [],
    readIds = [],
    dismissedIds = [],
    resolveTool = getToolBySlug,
  } = options;

  const favSlugs = new Set(favourites.map((f) => f.toolSlug));
  const readSet = new Set(readIds);
  const dismissedSet = new Set(dismissedIds);
  const items: AppNotification[] = [];
  const seenIds = new Set<string>();

  const pushIfRelevant = (candidate: {
    id: string;
    type: 'tool_update' | 'new_tool';
    toolSlug?: string;
    toolName?: string;
    title: string;
    message: string;
    createdAt: string;
    source: 'changelog' | 'live';
  }) => {
    if (seenIds.has(candidate.id) || dismissedSet.has(candidate.id)) return;
    if (candidate.type === 'tool_update') {
      if (!candidate.toolSlug || !favSlugs.has(candidate.toolSlug)) return;
      seenIds.add(candidate.id);
      const toolMeta = resolveTool(candidate.toolSlug);
      items.push({
        id: candidate.id,
        kind: 'favorite_update',
        toolSlug: candidate.toolSlug,
        toolName: candidate.toolName || toolMeta?.name,
        title: candidate.title,
        message: candidate.message,
        createdAt: candidate.createdAt,
        read: readSet.has(candidate.id),
        source: candidate.source,
      });
      return;
    }

    seenIds.add(candidate.id);
    const toolMeta = candidate.toolSlug ? resolveTool(candidate.toolSlug) : undefined;
    items.push({
      id: candidate.id,
      kind: 'new_tool',
      toolSlug: candidate.toolSlug,
      toolName: candidate.toolName || toolMeta?.name,
      title: candidate.title,
      message: candidate.message,
      createdAt: candidate.createdAt,
      read: readSet.has(candidate.id),
      source: candidate.source,
    });
  };

  for (const ann of liveAnnouncements) {
    pushIfRelevant({
      id: ann.id,
      type: ann.type,
      toolSlug: ann.toolSlug,
      toolName: ann.toolName,
      title: ann.title,
      message: ann.message,
      createdAt: ann.createdAt,
      source: 'live',
    });
  }

  for (const rel of TOOL_CHANGELOG_ENTRIES) {
    pushIfRelevant({
      id: rel.id,
      type: rel.type,
      toolSlug: rel.toolSlug,
      title: rel.title,
      message: rel.message,
      createdAt: rel.createdAt,
      source: 'changelog',
    });
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items;
}

export function countUnreadNotifications(notifications: AppNotification[]): number {
  return notifications.reduce((acc, item) => (item.read ? acc : acc + 1), 0);
}

export function filterNotificationsByKind(
  notifications: AppNotification[],
  filter: 'all' | 'favorite_update' | 'new_tool'
): AppNotification[] {
  if (filter === 'all') return notifications;
  return notifications.filter((n) => n.kind === filter);
}
