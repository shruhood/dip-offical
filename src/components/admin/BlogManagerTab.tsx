import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { BlogFaqItem, BlogPost, BlogPostStatus } from '../../types';
import {
  SAMPLE_BULK_BATCH_TEMPLATE,
  buildSitemapXml,
  estimateReadingTime,
  evaluateBlogSeo,
  exportBlogPostsToCsv,
  exportBlogPostsToJson,
  parseImportedBlogPosts,
  slugifyBlogTitle,
} from '../../lib/blogSeo';
import { CANONICAL_ORIGIN } from '../../lib/siteUrls';
import { fetchD1BlogRevisions, uploadFileToR2 } from '../../services/backendApi';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  Globe,
  Layers,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';

interface BlogManagerTabProps {
  onNavigate: (route: string, param?: string) => void;
}

interface BulkDraftRow {
  rowId: string;
  title: string;
  category: string;
  focusKeyword: string;
  status: BlogPostStatus;
  relatedServiceSlug: string;
  excerpt: string;
  content: string;
}

function createEmptyBulkRow(): BulkDraftRow {
  return {
    rowId: `row-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    title: '',
    category: 'PAN & Identity',
    focusKeyword: '',
    status: 'published',
    relatedServiceSlug: '',
    excerpt: '',
    content: '',
  };
}

function triggerFileDownload(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const BlogManagerTab: React.FC<BlogManagerTabProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const {
    blogPosts,
    services,
    businessSettings,
    updateBusinessSettings,
    saveBlogPost,
    bulkSaveBlogPosts,
    deleteBlogPost,
    toggleBlogPostStatus,
  } = useData();

  const defaultPublisherName = businessSettings.blogPublisherName?.trim() || 'Suraj Singh';
  const allowUserPublishing = businessSettings.allowUserBlogPublishing !== false;
  const userRequiresReview = Boolean(businessSettings.userBlogRequiresReview);
  const [publisherInput, setPublisherInput] = useState(defaultPublisherName);

  const [subMode, setSubMode] = useState<'manage' | 'bulk' | 'import' | 'export'>('manage');
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Manage list filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BlogPostStatus>('all');

  // Single post editor state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [edTitle, setEdTitle] = useState('');
  const [edSlug, setEdSlug] = useState('');
  const [edTitleHi, setEdTitleHi] = useState('');
  const [edCategory, setEdCategory] = useState('PAN & Identity');
  const [edStatus, setEdStatus] = useState<BlogPostStatus>('published');
  const [edFeatured, setEdFeatured] = useState(false);
  const [edFocusKeyword, setEdFocusKeyword] = useState('');
  const [edSeoTitle, setEdSeoTitle] = useState('');
  const [edSeoDescription, setEdSeoDescription] = useState('');
  const [edExcerpt, setEdExcerpt] = useState('');
  const [edExcerptHi, setEdExcerptHi] = useState('');
  const [edContent, setEdContent] = useState('');
  const [edTags, setEdTags] = useState('');
  const [edRelatedServiceSlug, setEdRelatedServiceSlug] = useState('');
  const [edAuthorName, setEdAuthorName] = useState(defaultPublisherName);
  const [edFeaturedImageUrl, setEdFeaturedImageUrl] = useState('');
  const [uploadingBlogImg, setUploadingBlogImg] = useState(false);
  const [edRevisions, setEdRevisions] = useState<Array<{ id: string; version: number; title: string; created_at: string }>>([]);
  const [edFaqs, setEdFaqs] = useState<BlogFaqItem[]>([]);

  // Bulk post creator state
  const [bulkInputMethod, setBulkInputMethod] = useState<'table' | 'batch'>('table');
  const [bulkRows, setBulkRows] = useState<BulkDraftRow[]>(() => [
    createEmptyBulkRow(),
    createEmptyBulkRow(),
  ]);
  const [batchText, setBatchText] = useState('');

  // Import state
  const [importText, setImportText] = useState('');
  const [importFormatHint, setImportFormatHint] = useState<'auto' | 'json' | 'csv'>('auto');

  const showToast = (msg: string) => {
    setErrorMsg(null);
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const openNewEditor = () => {
    setEditingPostId(null);
    setEdTitle('');
    setEdSlug('');
    setEdTitleHi('');
    setEdCategory('PAN & Identity');
    setEdStatus('published');
    setEdFeatured(false);
    setEdFocusKeyword('');
    setEdSeoTitle('');
    setEdSeoDescription('');
    setEdExcerpt('');
    setEdExcerptHi('');
    setEdContent('## Overview\n\n\n## Required Documents\n- \n\n## Step-by-Step Process\n1. ');
    setEdTags('Digital India, Guide');
    setEdRelatedServiceSlug('');
    setEdAuthorName(defaultPublisherName);
    setEdFeaturedImageUrl('');
    setEdRevisions([]);
    setEdFaqs([]);
    setEditorOpen(true);
  };

  const openExistingEditor = (post: BlogPost) => {
    setEditingPostId(post.id);
    setEdTitle(post.title);
    setEdSlug(post.slug);
    setEdTitleHi(post.titleHi || '');
    setEdCategory(post.category);
    setEdStatus(post.status);
    setEdFeatured(Boolean(post.featured));
    setEdFocusKeyword(post.focusKeyword || '');
    setEdSeoTitle(post.seoTitle || '');
    setEdSeoDescription(post.seoDescription || '');
    setEdExcerpt(post.excerpt);
    setEdExcerptHi(post.excerptHi || '');
    setEdContent(post.content);
    setEdTags((post.tags || []).join(', '));
    setEdRelatedServiceSlug(post.relatedServiceSlug || '');
    setEdAuthorName(post.authorName);
    setEdFeaturedImageUrl(post.featuredImageUrl || '');
    setEdRevisions([]);
    fetchD1BlogRevisions(post.id)
      .then((res) => {
        if (res.ok && Array.isArray(res.data)) {
          setEdRevisions(res.data);
        }
      })
      .catch(() => {});
    setEdFaqs(post.faqItems || []);
    setEditorOpen(true);
  };

  const editorSeoAudit = useMemo(
    () =>
      evaluateBlogSeo({
        title: edTitle,
        slug: edSlug || slugifyBlogTitle(edTitle),
        excerpt: edExcerpt,
        content: edContent,
        seoTitle: edSeoTitle,
        seoDescription: edSeoDescription,
        focusKeyword: edFocusKeyword,
        tags: edTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        relatedServiceSlug: edRelatedServiceSlug || undefined,
        faqItems: edFaqs,
      }),
    [
      edTitle,
      edSlug,
      edExcerpt,
      edContent,
      edSeoTitle,
      edSeoDescription,
      edFocusKeyword,
      edTags,
      edRelatedServiceSlug,
      edFaqs,
    ]
  );

  const handleSaveSinglePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edTitle.trim() || !edContent.trim()) {
      setErrorMsg('Post title and article content are required.');
      return;
    }

    try {
      const saved = await saveBlogPost({
        id: editingPostId || undefined,
        title: edTitle.trim(),
        slug: edSlug.trim() || slugifyBlogTitle(edTitle),
        titleHi: edTitleHi.trim() || undefined,
        excerpt: edExcerpt.trim() || edContent.trim().slice(0, 155),
        excerptHi: edExcerptHi.trim() || undefined,
        content: edContent.trim(),
        category: edCategory.trim() || 'Citizen Guides',
        status: edStatus,
        featured: edFeatured,
        focusKeyword: edFocusKeyword.trim() || undefined,
        seoTitle: edSeoTitle.trim() || edTitle.trim().slice(0, 65),
        seoDescription:
          edSeoDescription.trim() || (edExcerpt || edContent).trim().slice(0, 158),
        tags: edTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        relatedServiceSlug: edRelatedServiceSlug || undefined,
        authorName: edAuthorName.trim() || defaultPublisherName,
        featuredImageUrl: edFeaturedImageUrl.trim() || undefined,
        faqItems: edFaqs.filter((f) => f.question.trim() && f.answer.trim()),
      });
      setEditorOpen(false);
      setEditingPostId(null);
      showToast(`Saved "${saved.title}" (${saved.status}).`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to save blog post.');
    }
  };

  // Batch preview for paste mode
  const parsedBatchPreview = useMemo(() => {
    if (!batchText.trim()) return null;
    return parseImportedBlogPosts(batchText, {
      formatHint: 'batch',
      existingSlugs: blogPosts.map((p) => p.slug),
      defaultAuthor: defaultPublisherName,
    });
  }, [batchText, blogPosts, defaultPublisherName]);

  // Import file/paste preview
  const parsedImportPreview = useMemo(() => {
    if (!importText.trim()) return null;
    return parseImportedBlogPosts(importText, {
      formatHint: importFormatHint === 'auto' ? undefined : importFormatHint,
      existingSlugs: blogPosts.map((p) => p.slug),
      defaultAuthor: defaultPublisherName,
    });
  }, [importText, importFormatHint, blogPosts, defaultPublisherName]);

  const handleBulkTableSubmit = async () => {
    const validRows = bulkRows.filter((r) => r.title.trim().length >= 5);
    if (validRows.length === 0) {
      setErrorMsg('Enter at least one post row with a valid title (min 5 characters).');
      return;
    }

    const usedSlugs = new Set(blogPosts.map((p) => p.slug.toLowerCase()));
    const nowIso = new Date().toISOString();
    const postsToCreate: BlogPost[] = validRows.map((row, idx) => {
      let slug = slugifyBlogTitle(row.title);
      if (usedSlugs.has(slug)) {
        slug = `${slug}-${Date.now().toString(36)}-${idx + 1}`;
      }
      usedSlugs.add(slug);

      const finalExcerpt =
        row.excerpt.trim() ||
        `${row.title.trim()} — complete eligibility, documents checklist, and step-by-step online filing process on Digital India Project.`;
      const finalContent =
        row.content.trim() ||
        `## Overview\n\n${finalExcerpt}\n\n## Key Requirements\n- Valid Aadhaar & PAN identification\n- Address and supporting eligibility documents\n\n## Online Application Steps\n1. Open the service page and fill accurate applicant details\n2. Upload clear PDF/JPG proofs to your vault\n3. Track live officer verification from your Citizen Dashboard`;

      return {
        id: `post-${slug.slice(0, 36)}-${Date.now().toString(36)}-${idx}`,
        slug,
        title: row.title.trim(),
        excerpt: finalExcerpt.slice(0, 360),
        content: finalContent,
        category: row.category || 'Citizen Guides',
        tags: [row.category, row.focusKeyword || 'Digital India'].filter(Boolean),
        status: row.status,
        featured: false,
        authorName: defaultPublisherName,
        authorRole: 'Publisher & Editorial Desk',
        publishedAt: nowIso,
        updatedAt: nowIso,
        readingTimeMinutes: estimateReadingTime(finalContent),
        relatedServiceSlug: row.relatedServiceSlug || undefined,
        focusKeyword: row.focusKeyword.trim() || undefined,
        seoTitle: row.title.trim().slice(0, 65),
        seoDescription: finalExcerpt.slice(0, 158),
      };
    });

    try {
      const res = await bulkSaveBlogPosts(postsToCreate);
      setBulkRows([createEmptyBulkRow(), createEmptyBulkRow()]);
      setSubMode('manage');
      showToast(`Created ${res.count} blog post(s) in bulk.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Bulk creation failed.');
    }
  };

  const handleConfirmBatchPaste = async () => {
    if (!parsedBatchPreview || parsedBatchPreview.validPosts.length === 0) {
      setErrorMsg('No valid batch articles parsed to save.');
      return;
    }
    try {
      const res = await bulkSaveBlogPosts(parsedBatchPreview.validPosts);
      setBatchText('');
      setSubMode('manage');
      showToast(`Published/saved ${res.count} article(s) from batch paste.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Batch save failed.');
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedImportPreview || parsedImportPreview.validPosts.length === 0) {
      setErrorMsg('No valid rows ready for import.');
      return;
    }
    try {
      const res = await bulkSaveBlogPosts(parsedImportPreview.validPosts);
      setImportText('');
      setSubMode('manage');
      showToast(
        `Successfully imported ${res.count} post(s) (${parsedImportPreview.detectedFormat.toUpperCase()}).`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Import failed.');
    }
  };

  const handleImportFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.toLowerCase().endsWith('.json')) {
      setImportFormatHint('json');
    } else if (file.name.toLowerCase().endsWith('.csv')) {
      setImportFormatHint('csv');
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImportText(String(reader.result || ''));
    };
    reader.readAsText(file);
  };

  const filteredPosts = blogPosts.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.focusKeyword || '').toLowerCase().includes(q)
    );
  });

  const publishedCount = blogPosts.filter((p) => p.status === 'published').length;
  const draftCount = blogPosts.filter((p) => p.status === 'draft').length;

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-[#FF671F]" />
            <span>Blog CMS, SEO Optimizer &amp; Bulk Import / Export</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {publishedCount} published · {draftCount} drafts · Schema.org JSON-LD &amp; XML Sitemap synchronized for {CANONICAL_ORIGIN}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('blog')}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>View Public Blog</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSubMode('manage');
              openNewEditor();
            }}
            className="px-4 py-2 rounded-xl bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New SEO Article</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#138808] shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="underline text-[11px] cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sub-mode Segmented Switch */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
        {[
          { id: 'manage', label: `All Articles (${blogPosts.length})`, icon: Edit3 },
          { id: 'bulk', label: 'Bulk Post Creator', icon: Layers },
          { id: 'import', label: 'Import CSV / JSON', icon: Upload },
          { id: 'export', label: 'Export & SEO Sitemap', icon: Download },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSubMode(tab.id as any);
                if (tab.id !== 'manage') setEditorOpen(false);
              }}
              className={`px-4 py-2 rounded-xl inline-flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                subMode === tab.id
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Publisher & User Blog Publishing Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-end text-xs">
        <div className="lg:col-span-5">
          <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
            Default Blog Publisher Name
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={publisherInput}
              onChange={(e) => setPublisherInput(e.target.value)}
              placeholder="Suraj Singh"
              className="flex-1 px-3 py-2 rounded-lg bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
            />
            <button
              type="button"
              onClick={async () => {
                const nextName = publisherInput.trim() || 'Suraj Singh';
                setPublisherInput(nextName);
                await updateBusinessSettings({ blogPublisherName: nextName });
                showToast(`Default blog publisher updated to "${nextName}".`);
              }}
              className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold whitespace-nowrap cursor-pointer"
            >
              Save Publisher
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-wrap items-center gap-3 lg:justify-end">
          <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F7F8FA] dark:bg-slate-800/70 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={allowUserPublishing}
              onChange={async (e) => {
                await updateBusinessSettings({ allowUserBlogPublishing: e.target.checked });
                showToast(
                  e.target.checked
                    ? 'User blog publishing enabled on /blog.'
                    : 'User blog publishing paused.'
                );
              }}
            />
            <span>Allow User Blog Publishing</span>
          </label>

          <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F7F8FA] dark:bg-slate-800/70 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={!userRequiresReview}
              disabled={!allowUserPublishing}
              onChange={async (e) => {
                await updateBusinessSettings({ userBlogRequiresReview: !e.target.checked });
                showToast(
                  e.target.checked
                    ? 'Users can publish guides live immediately.'
                    : 'New user guides will save as Draft for review.'
                );
              }}
            />
            <span>Instant User Publish (No Hold)</span>
          </label>
        </div>
      </div>

      {/* ========================================== */}
      {/* SUBMODE 1: MANAGE & SINGLE SEO EDITOR      */}
      {/* ========================================== */}
      {subMode === 'manage' && (
        <div className="space-y-6">
          {editorOpen ? (
            <form
              onSubmit={handleSaveSinglePost}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingPostId ? 'Edit Blog Post & SEO Metadata' : 'Create New SEO Blog Post'}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-white font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Content Fields */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                        Article Title (H1) *
                      </label>
                      <input
                        type="text"
                        value={edTitle}
                        onChange={(e) => {
                          setEdTitle(e.target.value);
                          if (!editingPostId) setEdSlug(slugifyBlogTitle(e.target.value));
                        }}
                        placeholder="e.g. PAN Card Application & Correction Online Guide"
                        className="w-full px-3 py-2 rounded-lg bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        URL Slug
                      </label>
                      <input
                        type="text"
                        value={edSlug}
                        onChange={(e) => setEdSlug(slugifyBlogTitle(e.target.value))}
                        placeholder="pan-card-correction-guide-2026"
                        className="w-full px-3 py-2 rounded-lg bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Category
                      </label>
                      <input
                        type="text"
                        value={edCategory}
                        onChange={(e) => setEdCategory(e.target.value)}
                        placeholder="GST & Business"
                        className="w-full px-3 py-2 rounded-lg bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Publish Status
                      </label>
                      <select
                        value={edStatus}
                        onChange={(e) => setEdStatus(e.target.value as BlogPostStatus)}
                        className="w-full px-3 py-2 rounded-lg bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      >
                        <option value="published">Published (Live + Sitemap)</option>
                        <option value="draft">Draft (Hidden)</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Linked Service CTA
                      </label>
                      <select
                        value={edRelatedServiceSlug}
                        onChange={(e) => setEdRelatedServiceSlug(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      >
                        <option value="">None</option>
                        {services.map((s) => (
                          <option key={s.id} value={s.slug}>
                            {s.name} ({s.slug})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Author / Publisher Name
                      </label>
                      <input
                        type="text"
                        value={edAuthorName}
                        onChange={(e) => setEdAuthorName(e.target.value)}
                        placeholder={defaultPublisherName}
                        className="w-full px-3 py-2 rounded-lg bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Summary / Excerpt *
                    </label>
                    <textarea
                      rows={2}
                      value={edExcerpt}
                      onChange={(e) => setEdExcerpt(e.target.value)}
                      placeholder="Concise 1–2 sentence article summary shown on blog cards..."
                      className="w-full px-3 py-2 rounded-lg bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Article Body (supports ## Headings, - Bullets, 1. Steps, **Bold**) *
                    </label>
                    <textarea
                      rows={10}
                      value={edContent}
                      onChange={(e) => setEdContent(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[11px]"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Hindi Title (Optional)
                      </label>
                      <input
                        type="text"
                        value={edTitleHi}
                        onChange={(e) => setEdTitleHi(e.target.value)}
                        placeholder="हिंदी शीर्षक..."
                        className="w-full px-3 py-2 rounded-lg bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Tags (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={edTags}
                        onChange={(e) => setEdTags(e.target.value)}
                        placeholder="PAN Card, Aadhaar Linking, Form 49A"
                        className="w-full px-3 py-2 rounded-lg bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Hindi Excerpt (Optional)
                      </label>
                      <input
                        type="text"
                        value={edExcerptHi}
                        onChange={(e) => setEdExcerptHi(e.target.value)}
                        placeholder="संक्षिप्त हिंदी सारांश..."
                        className="w-full px-3 py-2 rounded-lg bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Featured Image (R2 dip-media-library or URL)
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={edFeaturedImageUrl}
                          onChange={(e) => setEdFeaturedImageUrl(e.target.value)}
                          placeholder="/api/storage/public/file-... or https://digitalindiaproject.com/..."
                          className="flex-1 px-3 py-2 rounded-lg bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[11px]"
                        />
                        <label className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{uploadingBlogImg ? 'Uploading...' : 'Upload to R2'}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            disabled={uploadingBlogImg}
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              setUploadingBlogImg(true);
                              try {
                                const res = await uploadFileToR2({
                                  file: f,
                                  bucket: 'dip-media-library',
                                  documentCategory: 'blog_cover',
                                });
                                if (res.ok && res.data?.id) {
                                  setEdFeaturedImageUrl(`/api/storage/public/${res.data.id}`);
                                  showToast(`Uploaded "${f.name}" to R2 dip-media-library.`);
                                } else {
                                  setErrorMsg(res.message || 'R2 image upload failed.');
                                }
                              } finally {
                                setUploadingBlogImg(false);
                                e.target.value = '';
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                  {edRevisions.length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        D1 Revision History ({edRevisions.length})
                      </div>
                      <div className="space-y-1 max-h-28 overflow-y-auto text-[11px]">
                        {edRevisions.map((rev) => (
                          <div key={rev.id} className="flex items-center justify-between gap-2 text-slate-600 dark:text-slate-300">
                            <span className="truncate font-mono">v{rev.version} · {rev.title}</span>
                            <span className="text-slate-400 shrink-0">{new Date(rev.created_at).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* FAQ Schema Builder */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        Structured FAQs (Auto FAQPage JSON-LD)
                      </span>
                      <button
                        type="button"
                        onClick={() => setEdFaqs([...edFaqs, { question: '', answer: '' }])}
                        className="text-[#FF671F] font-bold hover:underline cursor-pointer"
                      >
                        + Add FAQ Item
                      </button>
                    </div>
                    {edFaqs.map((faq, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            placeholder="FAQ Question"
                            value={faq.question}
                            onChange={(e) => {
                              const next = [...edFaqs];
                              next[idx] = { ...next[idx], question: e.target.value };
                              setEdFaqs(next);
                            }}
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                          />
                          <button
                            type="button"
                            onClick={() => setEdFaqs(edFaqs.filter((_, i) => i !== idx))}
                            className="text-rose-500 hover:text-rose-700 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          placeholder="Clear factual answer..."
                          value={faq.answer}
                          onChange={(e) => {
                            const next = [...edFaqs];
                            next[idx] = { ...next[idx], answer: e.target.value };
                            setEdFaqs(next);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column: Live SEO Analyzer & Google SERP Preview */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-[#FF671F]" />
                        <span>Live SEO Audit</span>
                      </span>
                      <span
                        className={`font-mono font-black tabular-nums ${
                          editorSeoAudit.score >= 83
                            ? 'text-[#138808] dark:text-emerald-400'
                            : editorSeoAudit.score >= 50
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {editorSeoAudit.score}% ({editorSeoAudit.grade})
                      </span>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Focus Keyword
                      </label>
                      <input
                        type="text"
                        value={edFocusKeyword}
                        onChange={(e) => setEdFocusKeyword(e.target.value)}
                        placeholder="e.g. PAN card correction online"
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        SEO Meta Title ({(edSeoTitle || edTitle).length}/65)
                      </label>
                      <input
                        type="text"
                        value={edSeoTitle}
                        onChange={(e) => setEdSeoTitle(e.target.value)}
                        placeholder="Optimal 30–65 characters"
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Meta Description ({(edSeoDescription || edExcerpt).length}/160)
                      </label>
                      <textarea
                        rows={3}
                        value={edSeoDescription}
                        onChange={(e) => setEdSeoDescription(e.target.value)}
                        placeholder="Optimal 110–160 characters for Google snippets"
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                      />
                    </div>

                    <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={edFeatured}
                        onChange={(e) => setEdFeatured(e.target.checked)}
                      />
                      <span>Pin as Lead Featured Story</span>
                    </label>
                  </div>

                  {/* SERP Preview Card */}
                  <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Google Search Preview
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {editorSeoAudit.resolvedCanonicalUrl}
                    </div>
                    <div className="text-sm font-bold text-blue-700 dark:text-blue-400 leading-snug line-clamp-2">
                      {editorSeoAudit.resolvedTitle}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">
                      {editorSeoAudit.resolvedDescription}
                    </p>
                  </div>

                  {/* Diagnostic Checklist */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      SEO Verification Checks
                    </div>
                    {editorSeoAudit.checks.map((chk) => (
                      <div key={chk.id} className="flex items-start gap-2 text-[11px]">
                        <span
                          className={`font-bold shrink-0 ${
                            chk.passed ? 'text-[#138808] dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {chk.passed ? 'PASS' : 'TODO'}
                        </span>
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-100">
                            {chk.label}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400">{chk.hint}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#138808] hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  Save &amp; Update Blog Post
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filter articles by title, slug, or keyword..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 text-xs rounded-xl bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold"
                >
                  <option value="all">All Statuses ({blogPosts.length})</option>
                  <option value="published">Published ({publishedCount})</option>
                  <option value="draft">Drafts ({draftCount})</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-xs text-left tabular-nums">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3.5">Article &amp; Slug</th>
                      <th className="p-3.5">Category &amp; Keyword</th>
                      <th className="p-3.5">SEO Score</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredPosts.map((post) => {
                      const seo = evaluateBlogSeo(post);
                      return (
                        <tr key={post.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-3.5 max-w-sm">
                            <div className="font-bold text-slate-900 dark:text-white line-clamp-1">
                              {post.title}
                            </div>
                            <div className="font-mono text-[11px] text-slate-400 truncate">
                              /blog/{post.slug}
                            </div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-semibold text-slate-700 dark:text-slate-200">
                              {post.category}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {post.focusKeyword || 'No focus keyword'}
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`font-mono font-bold ${
                                seo.score >= 83
                                  ? 'text-[#138808] dark:text-emerald-400'
                                  : seo.score >= 50
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {seo.score}% · {seo.grade}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <button
                              type="button"
                              onClick={() =>
                                toggleBlogPostStatus(
                                  post.id,
                                  post.status === 'published' ? 'draft' : 'published'
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                                post.status === 'published'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-[#138808] dark:text-emerald-300'
                                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                              }`}
                            >
                              {post.status === 'published' ? 'Published' : post.status}
                            </button>
                          </td>
                          <td className="p-3.5 text-right space-x-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onNavigate('blog-detail', post.slug)}
                              className="text-slate-600 dark:text-slate-300 hover:text-[#FF671F] font-semibold cursor-pointer"
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => openExistingEditor(post)}
                              className="text-[#FF671F] hover:underline font-bold cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteBlogPost(post.id)}
                              className="text-rose-600 hover:underline font-semibold cursor-pointer"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* SUBMODE 2: BULK POST CREATOR               */}
      {/* ========================================== */}
      {subMode === 'bulk' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Bulk Create Blog Posts
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                Create multiple SEO articles in one atomic batch using the rapid multi-row grid or structured batch paste.
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setBulkInputMethod('table')}
                className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                  bulkInputMethod === 'table'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Multi-Row Builder
              </button>
              <button
                type="button"
                onClick={() => setBulkInputMethod('batch')}
                className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                  bulkInputMethod === 'batch'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Structured Batch Paste
              </button>
            </div>
          </div>

          {bulkInputMethod === 'table' ? (
            <div className="space-y-4">
              <div className="space-y-3">
                {bulkRows.map((row, idx) => (
                  <div
                    key={row.rowId}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[#FF671F]">
                        Post #{idx + 1}
                      </span>
                      {bulkRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setBulkRows(bulkRows.filter((r) => r.rowId !== row.rowId))
                          }
                          className="text-rose-600 hover:underline font-semibold cursor-pointer"
                        >
                          Remove Row
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="md:col-span-2">
                        <label className="block font-semibold mb-1">Article Title *</label>
                        <input
                          type="text"
                          value={row.title}
                          onChange={(e) => {
                            const next = [...bulkRows];
                            next[idx] = { ...next[idx], title: e.target.value };
                            setBulkRows(next);
                          }}
                          placeholder="e.g. How to Link PAN with Aadhaar Online"
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Category</label>
                        <input
                          type="text"
                          value={row.category}
                          onChange={(e) => {
                            const next = [...bulkRows];
                            next[idx] = { ...next[idx], category: e.target.value };
                            setBulkRows(next);
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Status</label>
                        <select
                          value={row.status}
                          onChange={(e) => {
                            const next = [...bulkRows];
                            next[idx] = {
                              ...next[idx],
                              status: e.target.value as BlogPostStatus,
                            };
                            setBulkRows(next);
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                        >
                          <option value="published">Published</option>
                          <option value="draft">Draft</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">Focus SEO Keyword</label>
                        <input
                          type="text"
                          value={row.focusKeyword}
                          onChange={(e) => {
                            const next = [...bulkRows];
                            next[idx] = { ...next[idx], focusKeyword: e.target.value };
                            setBulkRows(next);
                          }}
                          placeholder="e.g. PAN Aadhaar link"
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Linked Service CTA</label>
                        <select
                          value={row.relatedServiceSlug}
                          onChange={(e) => {
                            const next = [...bulkRows];
                            next[idx] = {
                              ...next[idx],
                              relatedServiceSlug: e.target.value,
                            };
                            setBulkRows(next);
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                        >
                          <option value="">Optional Service CTA</option>
                          {services.map((s) => (
                            <option key={s.id} value={s.slug}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Meta Excerpt</label>
                        <input
                          type="text"
                          value={row.excerpt}
                          onChange={(e) => {
                            const next = [...bulkRows];
                            next[idx] = { ...next[idx], excerpt: e.target.value };
                            setBulkRows(next);
                          }}
                          placeholder="Auto-generated if left blank"
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">
                        Body Content (Optional — structured checklist auto-filled if blank)
                      </label>
                      <textarea
                        rows={3}
                        value={row.content}
                        onChange={(e) => {
                          const next = [...bulkRows];
                          next[idx] = { ...next[idx], content: e.target.value };
                          setBulkRows(next);
                        }}
                        placeholder="## Section Title&#10;- Key point 1"
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px]"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkRows([...bulkRows, createEmptyBulkRow()])}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    + Add 1 Row
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBulkRows([
                        ...bulkRows,
                        createEmptyBulkRow(),
                        createEmptyBulkRow(),
                        createEmptyBulkRow(),
                      ])
                    }
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    + Add 3 Rows
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleBulkTableSubmit}
                  className="px-5 py-2.5 rounded-xl bg-[#138808] hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  Save All Bulk Articles ({bulkRows.filter((r) => r.title.trim().length >= 5).length})
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-slate-600 dark:text-slate-300">
                  Separate multiple articles using <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">---</code> on a line by itself.
                </p>
                <button
                  type="button"
                  onClick={() => setBatchText(SAMPLE_BULK_BATCH_TEMPLATE)}
                  className="text-[#FF671F] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Load Sample Multi-Post Batch</span>
                </button>
              </div>

              <textarea
                rows={12}
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={SAMPLE_BULK_BATCH_TEMPLATE}
                className="w-full p-3.5 rounded-xl bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]"
              />

              {parsedBatchPreview && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-white">
                    Batch Preview: {parsedBatchPreview.validPosts.length} ready ·{' '}
                    {parsedBatchPreview.errors.length} error(s)
                  </div>
                  {parsedBatchPreview.errors.map((err, i) => (
                    <div key={i} className="text-rose-600 dark:text-rose-400">
                      {err}
                    </div>
                  ))}
                  {parsedBatchPreview.validPosts.map((vp) => (
                    <div key={vp.id} className="flex items-center justify-between gap-2 py-1 border-t border-slate-200/70 dark:border-slate-700">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {vp.title}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 shrink-0">
                        /{vp.slug} · {vp.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!parsedBatchPreview || parsedBatchPreview.validPosts.length === 0}
                  onClick={handleConfirmBatchPaste}
                  className="px-5 py-2.5 rounded-xl bg-[#138808] hover:bg-emerald-700 text-white font-bold disabled:opacity-40 cursor-pointer"
                >
                  Publish / Save Batch ({parsedBatchPreview?.validPosts.length || 0})
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* SUBMODE 3: IMPORT CSV / JSON               */}
      {/* ========================================== */}
      {subMode === 'import' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Import Blog Posts from CSV or JSON
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                Upload a `.csv` spreadsheet or `.json` feed, validate slugs &amp; SEO fields, and import in bulk.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  triggerFileDownload(
                    'dip-blog-template.csv',
                    'text/csv;charset=utf-8',
                    exportBlogPostsToCsv(blogPosts.slice(0, 2))
                  )
                }
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#138808]" />
                <span>Download CSV Template</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  triggerFileDownload(
                    'dip-blog-template.json',
                    'application/json',
                    exportBlogPostsToJson(blogPosts.slice(0, 2))
                  )
                }
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <FileJson className="w-3.5 h-3.5 text-[#FF671F]" />
                <span>Download JSON Template</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <label className="block p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-[#F7F8FA] dark:bg-slate-800/50 cursor-pointer">
              <span className="font-bold text-slate-800 dark:text-slate-100 block mb-1">
                Choose `.csv` or `.json` file
              </span>
              <input
                type="file"
                accept=".csv,.json,.txt"
                onChange={handleImportFileUpload}
                className="text-xs text-slate-600 dark:text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#FF671F] file:text-white file:font-bold"
              />
            </label>

            <div>
              <label className="block font-semibold mb-1">Format Detection</label>
              <select
                value={importFormatHint}
                onChange={(e) => setImportFormatHint(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold"
              >
                <option value="auto">Auto-detect (JSON / CSV)</option>
                <option value="json">JSON</option>
                <option value="csv">CSV (Comma-separated)</option>
              </select>
            </div>
          </div>

          <textarea
            rows={10}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste exported JSON ({ posts: [...] } or [...]) or CSV rows with header row here..."
            className="w-full p-3.5 rounded-xl bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]"
          />

          {parsedImportPreview && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-900 dark:text-white">
                  Detected {parsedImportPreview.detectedFormat.toUpperCase()} ·{' '}
                  {parsedImportPreview.validPosts.length} Valid Row(s) ·{' '}
                  {parsedImportPreview.errors.length} Error(s)
                </span>
                {parsedImportPreview.warnings.length > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    {parsedImportPreview.warnings.length} Slug Warning(s)
                  </span>
                )}
              </div>

              {parsedImportPreview.errors.map((err, i) => (
                <div key={i} className="text-rose-600 dark:text-rose-400">
                  {err}
                </div>
              ))}
              {parsedImportPreview.warnings.map((w, i) => (
                <div key={i} className="text-amber-600 dark:text-amber-400">
                  {w}
                </div>
              ))}

              {parsedImportPreview.validPosts.length > 0 && (
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-700 pt-1">
                  {parsedImportPreview.validPosts.map((post) => (
                    <div key={post.id} className="py-1.5 flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {post.title}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 shrink-0">
                        {post.category} · {post.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!parsedImportPreview || parsedImportPreview.validPosts.length === 0}
              onClick={handleConfirmImport}
              className="px-5 py-2.5 rounded-xl bg-[#138808] hover:bg-emerald-700 text-white font-bold disabled:opacity-40 cursor-pointer"
            >
              Confirm &amp; Import ({parsedImportPreview?.validPosts.length || 0})
            </button>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* SUBMODE 4: EXPORT & XML SITEMAP            */}
      {/* ========================================== */}
      {subMode === 'export' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <FileJson className="w-6 h-6 text-[#FF671F]" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Export Blog Archive (JSON)
              </h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Full structured backup including bilingual titles, FAQ Schema arrays, focus keywords, and SEO metadata for all {blogPosts.length} posts.
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  triggerFileDownload(
                    `dip-blog-all-${new Date().toISOString().slice(0, 10)}.json`,
                    'application/json',
                    exportBlogPostsToJson(blogPosts)
                  );
                  showToast('Exported all blog posts to JSON.');
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold cursor-pointer"
              >
                Download All Posts (.json)
              </button>
              <button
                type="button"
                onClick={() => {
                  const published = blogPosts.filter((p) => p.status === 'published');
                  triggerFileDownload(
                    `dip-blog-published-${new Date().toISOString().slice(0, 10)}.json`,
                    'application/json',
                    exportBlogPostsToJson(published)
                  );
                  showToast(`Exported ${published.length} published post(s) to JSON.`);
                }}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
              >
                Download Published Only (.json)
              </button>
            </div>
          </div>

          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <FileSpreadsheet className="w-6 h-6 text-[#138808]" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Export Spreadsheet (CSV)
              </h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                RFC-4180 escaped CSV compatible with Excel and Google Sheets for offline bulk editing, translation, and re-import.
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  triggerFileDownload(
                    `dip-blog-export-${new Date().toISOString().slice(0, 10)}.csv`,
                    'text/csv;charset=utf-8',
                    exportBlogPostsToCsv(blogPosts)
                  );
                  showToast('Exported blog catalog to CSV.');
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-[#138808] hover:bg-emerald-700 text-white font-bold cursor-pointer"
              >
                Download All Posts (.csv)
              </button>
            </div>
          </div>

          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <Globe className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                SEO XML Sitemap Generator
              </h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Generate an updated `sitemap.xml` covering all public portal pages, active services, and {publishedCount} published blog URLs on `{CANONICAL_ORIGIN}`.
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  triggerFileDownload(
                    'sitemap.xml',
                    'application/xml;charset=UTF-8',
                    buildSitemapXml(services, blogPosts)
                  );
                  showToast('Generated and downloaded updated sitemap.xml.');
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold cursor-pointer"
              >
                Download sitemap.xml
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
