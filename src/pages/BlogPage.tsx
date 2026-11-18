import React, { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { BlogPost, Service } from '../types';
import { isSuperAdminRole, normalizeRole } from '../lib/rbac';
import { buildCanonicalSiteUrl, buildUrlForRoute } from '../lib/siteUrls';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Edit3,
  Eye,
  FileText,
  PenSquare,
  Plus,
  Search,
  Send,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { slugifyBlogTitle } from '../lib/blogSeo';

interface BlogPageProps {
  mode: 'index' | 'detail';
  slugOrCategory?: string;
  onNavigate: (route: string, param?: string) => void;
  onApplyForService?: (service: Service) => void;
}

interface ParsedHeading {
  id: string;
  text: string;
}

function headingId(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractHeadings(markdown: string): ParsedHeading[] {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith('## '))
    .map((line) => {
      const text = line.replace(/^##\s+/, '').trim();
      return { id: headingId(text), text };
    });
}

function renderTextWithLinks(segment: string, keyPrefix: string): React.ReactNode {
  const tokens = segment.split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<>()]+)/g);
  return tokens.map((tok, i) => {
    const mdMatch = tok.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (mdMatch) {
      const [, label, href] = mdMatch;
      return (
        <a
          key={`${keyPrefix}-md-${i}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#FF671F] hover:underline font-semibold break-words"
        >
          {label}
        </a>
      );
    }
    if (/^https?:\/\/[^\s<>()]+$/.test(tok)) {
      const cleaned = tok.replace(/[.,;:!?]+$/, '');
      const trailing = tok.slice(cleaned.length);
      return (
        <React.Fragment key={`${keyPrefix}-url-${i}`}>
          <a
            href={cleaned}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FF671F] hover:underline font-medium break-all"
          >
            {cleaned}
          </a>
          {trailing}
        </React.Fragment>
      );
    }
    return <React.Fragment key={`${keyPrefix}-txt-${i}`}>{tok}</React.Fragment>;
  });
}

function renderInlineText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-bold text-slate-900 dark:text-white">
          {renderTextWithLinks(part.slice(2, -2), `b-${idx}`)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{renderTextWithLinks(part, `p-${idx}`)}</React.Fragment>;
  });
}

function renderArticleBlocks(content: string): React.ReactNode[] {
  const lines = content.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];
  let numberedBuffer: string[] = [];
  let keyCounter = 0;

  const flushLists = () => {
    if (bulletBuffer.length > 0) {
      nodes.push(
        <ul
          key={`ul-${keyCounter++}`}
          className="list-disc pl-6 space-y-2 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300"
        >
          {bulletBuffer.map((item, idx) => (
            <li key={idx}>{renderInlineText(item)}</li>
          ))}
        </ul>
      );
      bulletBuffer = [];
    }
    if (numberedBuffer.length > 0) {
      nodes.push(
        <ol
          key={`ol-${keyCounter++}`}
          className="list-decimal pl-6 space-y-2 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300"
        >
          {numberedBuffer.map((item, idx) => (
            <li key={idx}>{renderInlineText(item)}</li>
          ))}
        </ol>
      );
      numberedBuffer = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushLists();
      continue;
    }

    if (line.startsWith('## ')) {
      flushLists();
      const text = line.replace(/^##\s+/, '').trim();
      nodes.push(
        <h2
          key={`h2-${keyCounter++}`}
          id={headingId(text)}
          className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white pt-4 border-t border-slate-100 dark:border-slate-800 scroll-mt-24"
        >
          {text}
        </h2>
      );
      continue;
    }

    if (line.startsWith('### ')) {
      flushLists();
      const text = line.replace(/^###\s+/, '').trim();
      nodes.push(
        <h3
          key={`h3-${keyCounter++}`}
          className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 pt-2"
        >
          {text}
        </h3>
      );
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (numberedBuffer.length > 0) flushLists();
      bulletBuffer.push(line.slice(2).trim());
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      if (bulletBuffer.length > 0) flushLists();
      numberedBuffer.push(line.replace(/^\d+\.\s+/, '').trim());
      continue;
    }

    flushLists();
    nodes.push(
      <p
        key={`p-${keyCounter++}`}
        className="text-[15px] sm:text-base leading-relaxed text-slate-700 dark:text-slate-300"
      >
        {renderInlineText(line)}
      </p>
    );
  }

  flushLists();
  return nodes;
}

export const BlogPage: React.FC<BlogPageProps> = ({
  mode,
  slugOrCategory = '',
  onNavigate,
  onApplyForService,
}) => {
  const { user } = useAuth();
  const {
    blogPosts,
    services,
    businessSettings,
    saveBlogPost,
    deleteBlogPost,
    toggleBlogPostStatus,
  } = useData();
  const { lang } = useLanguage();

  const defaultPublisher = businessSettings.blogPublisherName?.trim() || 'Suraj Singh';
  const allowUserPublishing = businessSettings.allowUserBlogPublishing !== false;
  const userRequiresReview = Boolean(businessSettings.userBlogRequiresReview);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(
    mode === 'index' && slugOrCategory ? slugOrCategory : 'all'
  );
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  // User Blog Publishing Controls
  const [myPostsOpen, setMyPostsOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingUserPostId, setEditingUserPostId] = useState<string | null>(null);
  const [postTitle, setPostTitle] = useState('');
  const [postCategory, setPostCategory] = useState('Citizen Guides');
  const [postAuthor, setPostAuthor] = useState(defaultPublisher);
  const [postStatus, setPostStatus] = useState<'published' | 'draft'>('published');
  const [postExcerpt, setPostExcerpt] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postRelatedService, setPostRelatedService] = useState('');
  const [postNotice, setPostNotice] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [savingPost, setSavingPost] = useState(false);

  React.useEffect(() => {
    if (mode === 'index') {
      setSelectedCategory(slugOrCategory || 'all');
      setCurrentPage(1);
    }
  }, [mode, slugOrCategory]);

  const canManageBlog =
    Boolean(user) &&
    (isSuperAdminRole(user?.role) || normalizeRole(user?.role) === 'manager');

  const myPosts = useMemo(() => {
    if (!user?.id) return [];
    return blogPosts
      .filter((p) => p.authorUserId === user.id)
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.publishedAt).getTime() -
          new Date(a.updatedAt || a.publishedAt).getTime()
      );
  }, [blogPosts, user?.id]);

  const openUserComposer = (existing?: BlogPost) => {
    setPostError(null);
    if (existing) {
      setEditingUserPostId(existing.id);
      setPostTitle(existing.title);
      setPostCategory(existing.category || 'Citizen Guides');
      setPostAuthor(existing.authorName || defaultPublisher);
      setPostStatus(existing.status === 'draft' ? 'draft' : 'published');
      setPostExcerpt(existing.excerpt);
      setPostContent(existing.content);
      setPostRelatedService(existing.relatedServiceSlug || '');
    } else {
      setEditingUserPostId(null);
      setPostTitle('');
      setPostCategory('Citizen Guides');
      setPostAuthor(defaultPublisher);
      setPostStatus(userRequiresReview ? 'draft' : 'published');
      setPostExcerpt('');
      setPostContent('## Overview\n\n\n## Required Documents\n- \n\n## Application Steps\n1. ');
      setPostRelatedService('');
    }
    setComposerOpen(true);
  };

  const handleSaveUserPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (postTitle.trim().length < 5 || !postContent.trim()) {
      setPostError('Please enter an article title (min 5 characters) and content.');
      return;
    }
    setSavingPost(true);
    setPostError(null);
    try {
      const targetStatus =
        userRequiresReview && !canManageBlog ? 'draft' : postStatus;
      const saved = await saveBlogPost({
        id: editingUserPostId || undefined,
        slug: editingUserPostId ? undefined : slugifyBlogTitle(postTitle),
        title: postTitle.trim(),
        category: postCategory.trim() || 'Citizen Guides',
        authorName: postAuthor.trim() || defaultPublisher,
        authorUserId: user.id,
        status: targetStatus,
        excerpt: postExcerpt.trim() || postContent.trim().slice(0, 155),
        content: postContent.trim(),
        relatedServiceSlug: postRelatedService || undefined,
      });
      setComposerOpen(false);
      setMyPostsOpen(true);
      setPostNotice(
        saved.status === 'published'
          ? `Published "${saved.title}" live on the blog.`
          : `Saved "${saved.title}" as draft.`
      );
      window.setTimeout(() => setPostNotice(null), 4000);
    } catch (err: any) {
      setPostError(err?.message || 'Unable to save article.');
    } finally {
      setSavingPost(false);
    }
  };

  const publishedPosts = useMemo(
    () =>
      blogPosts
        .filter((p) => p.status === 'published')
        .sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        ),
    [blogPosts]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    publishedPosts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['all', ...Array.from(set)];
  }, [publishedPosts]);

  const handleCopyLink = (slug: string) => {
    const url = buildCanonicalSiteUrl('blog-detail', slug);
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2200);
  };

  if (mode === 'detail') {
    const post: BlogPost | undefined =
      blogPosts.find(
        (p) =>
          (p.slug === slugOrCategory || p.id === slugOrCategory) &&
          (p.status === 'published' ||
            canManageBlog ||
            (Boolean(user?.id) && p.authorUserId === user?.id))
      );

    if (!post) {
      return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Article Not Found
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            The requested guide could not be located or has not been published yet.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('blog')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF671F] text-white text-xs font-bold hover:bg-[#E55B1B] transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Guides</span>
          </button>
        </div>
      );
    }

    const displayTitle = lang === 'hi' && post.titleHi ? post.titleHi : post.title;
    const displayExcerpt =
      lang === 'hi' && post.excerptHi ? post.excerptHi : post.excerpt;
    const displayContent =
      lang === 'hi' && post.contentHi ? post.contentHi : post.content;
    const headings = extractHeadings(displayContent);
    const relatedService = post.relatedServiceSlug
      ? services.find((s) => s.slug === post.relatedServiceSlug)
      : undefined;
    const relatedPosts = publishedPosts
      .filter((p) => p.id !== post.id)
      .sort((a, b) =>
        a.category === post.category && b.category !== post.category ? -1 : 1
      )
      .slice(0, 3);
    const canonicalUrl =
      post.canonicalUrl || buildCanonicalSiteUrl('blog-detail', post.slug);

    return (
      <article className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
        {/* Breadcrumb & Manage Link */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800 text-xs">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <a
              href={buildUrlForRoute('home')}
              onClick={(e) => {
                e.preventDefault();
                onNavigate('home');
              }}
              className="hover:text-[#FF671F] cursor-pointer"
            >
              Home
            </a>
            <span aria-hidden="true">/</span>
            <a
              href={buildUrlForRoute('blog')}
              onClick={(e) => {
                e.preventDefault();
                onNavigate('blog');
              }}
              className="hover:text-[#FF671F] cursor-pointer"
            >
              Blog &amp; Guides
            </a>
            <span aria-hidden="true">/</span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[220px] sm:max-w-sm">
              {post.category}
            </span>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopyLink(post.slug)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold hover:border-[#FF671F] transition cursor-pointer whitespace-nowrap"
            >
              {copiedSlug === post.slug ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#138808]" />
                  <span>Canonical Link Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Article Link</span>
                </>
              )}
            </button>

            {(canManageBlog || (Boolean(user?.id) && post.authorUserId === user?.id)) && (
              <button
                type="button"
                onClick={() =>
                  void toggleBlogPostStatus(
                    post.id,
                    post.status === 'published' ? 'draft' : 'published'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold hover:border-[#FF671F] transition cursor-pointer whitespace-nowrap"
              >
                <Eye className="w-3.5 h-3.5 text-[#FF671F]" />
                <span>{post.status === 'published' ? 'Unpublish' : 'Publish Live'}</span>
              </button>
            )}

            {canManageBlog && (
              <button
                type="button"
                onClick={() => onNavigate('admin', 'blog')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold cursor-pointer whitespace-nowrap"
              >
                <PenSquare className="w-3.5 h-3.5" />
                <span>Edit in CMS</span>
              </button>
            )}
          </div>
        </div>

        {/* Article Header + Main Asymmetric Reading Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <div className="lg:col-span-8 space-y-6">
            <header className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-bold text-[#FF671F] uppercase tracking-wider">
                  {post.category}
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Clock className="w-3.5 h-3.5" />
                  {post.readingTimeMinutes} min read
                </span>
                <span aria-hidden="true">·</span>
                <time dateTime={post.updatedAt || post.publishedAt} className="tabular-nums">
                  Updated{' '}
                  {new Date(post.updatedAt || post.publishedAt).toLocaleDateString(
                    'en-IN',
                    { day: 'numeric', month: 'short', year: 'numeric' }
                  )}
                </time>
                {post.status !== 'published' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400 uppercase">
                      {post.status}
                    </span>
                  </>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight text-balance">
                {displayTitle}
              </h1>

              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                {displayExcerpt}
              </p>

              {post.featuredImageUrl && (
                <div className="pt-2">
                  <img
                    src={post.featuredImageUrl}
                    alt={displayTitle}
                    className="w-full max-h-[380px] object-cover rounded-2xl border border-slate-200 dark:border-slate-800"
                    loading="lazy"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                <div>
                  By <strong className="text-slate-900 dark:text-white">{post.authorName}</strong>
                  {post.authorRole ? ` · ${post.authorRole}` : ''}
                </div>
                <div className="font-mono text-[11px] text-slate-400 truncate max-w-xs sm:max-w-md">
                  {canonicalUrl}
                </div>
              </div>
            </header>

            <div className="max-w-prose space-y-5 pt-2">
              {renderArticleBlocks(displayContent)}
            </div>

            {/* Structured Tags Row (Clean unboxed metadata style) */}
            {post.tags && post.tags.length > 0 && (
              <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">
                  <Tag className="w-3.5 h-3.5 text-[#FF671F]" />
                  Topics:
                </span>
                {post.tags.map((tag, idx) => (
                  <React.Fragment key={tag}>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery(tag);
                        onNavigate('blog');
                      }}
                      className="hover:text-[#FF671F] underline-offset-4 hover:underline cursor-pointer"
                    >
                      {tag}
                    </button>
                    {idx < post.tags.length - 1 && <span aria-hidden="true">·</span>}
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* Structured FAQ Section (Synced with FAQPage JSON-LD) */}
            {post.faqItems && post.faqItems.length > 0 && (
              <section
                aria-label="Frequently Asked Questions"
                className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4"
              >
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Frequently Asked Questions
                </h2>
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden">
                  {post.faqItems.map((faq, idx) => {
                    const isOpen = openFaqIdx === idx;
                    return (
                      <div key={idx}>
                        <button
                          type="button"
                          onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                          className="w-full p-4 text-left flex items-center justify-between gap-3 text-sm font-bold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40 transition cursor-pointer"
                        >
                          <span>{faq.question}</span>
                          <ChevronDown
                            className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${
                              isOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            {faq.answer}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Right Sidebar: TOC + Direct Service Action CTA */}
          <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
            {headings.length > 0 && (
              <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  In This Guide
                </div>
                <ul className="space-y-2 text-xs">
                  {headings.map((h, idx) => (
                    <li key={h.id}>
                      <a
                        href={`#${h.id}`}
                        className="text-slate-700 dark:text-slate-300 hover:text-[#FF671F] flex items-start gap-2 transition"
                      >
                        <span className="font-mono text-slate-400 tabular-nums shrink-0">
                          0{idx + 1}.
                        </span>
                        <span>{h.text}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {relatedService && (
              <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-[#138808] dark:text-emerald-400">
                  Related Official Service
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {relatedService.name}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {relatedService.shortDesc}
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800 tabular-nums">
                  <span className="text-slate-500 dark:text-slate-400">Total Fee</span>
                  <strong className="font-mono text-slate-900 dark:text-white">
                    ₹{relatedService.serviceCharge + relatedService.govtFees}
                  </strong>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onApplyForService
                        ? onApplyForService(relatedService)
                        : onNavigate('service-detail', relatedService.slug)
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                  >
                    <span>Apply Online Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('service-detail', relatedService.slug)}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer whitespace-nowrap"
                  >
                    View Document Checklist
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* Related Articles */}
        {relatedPosts.length > 0 && (
          <section className="pt-8 border-t border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                More Citizen &amp; Compliance Guides
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('blog')}
                className="text-xs font-bold text-[#FF671F] hover:underline cursor-pointer"
              >
                All Guides →
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {relatedPosts.map((rp) => (
                <a
                  key={rp.id}
                  href={buildUrlForRoute('blog-detail', rp.slug)}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('blog-detail', rp.slug);
                  }}
                  className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-bold text-[#FF671F]">{rp.category}</span>
                      {' · '}
                      <span>{rp.readingTimeMinutes} min read</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {lang === 'hi' && rp.titleHi ? rp.titleHi : rp.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                      {lang === 'hi' && rp.excerptHi ? rp.excerptHi : rp.excerpt}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#138808] dark:text-emerald-400">
                    Read Guide →
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}
      </article>
    );
  }

  // ==========================================
  // BLOG INDEX VIEW (/blog)
  // ==========================================
  const filteredPosts = publishedPosts.filter((p) => {
    const matchesCat =
      selectedCategory === 'all' ||
      p.category.toLowerCase() === selectedCategory.toLowerCase();
    if (!matchesCat) return false;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      (p.titleHi || '').toLowerCase().includes(q) ||
      p.excerpt.toLowerCase().includes(q) ||
      (p.excerptHi || '').toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.focusKeyword || '').toLowerCase().includes(q) ||
      (p.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  });

  const leadPost =
    filteredPosts.find((p) => p.featured) || filteredPosts[0] || null;
  const archivePosts = leadPost
    ? filteredPosts.filter((p) => p.id !== leadPost.id)
    : [];

  const PAGE_SIZE = 18;
  const totalPages = Math.max(1, Math.ceil(archivePosts.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pageStartIdx = (safePage - 1) * PAGE_SIZE;
  const visibleArchivePosts = archivePosts.slice(pageStartIdx, pageStartIdx + PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="space-y-2 max-w-2xl">
          <div className="text-xs font-bold uppercase tracking-widest text-[#FF671F]">
            Publisher: {defaultPublisher} · Digital India Project
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight text-balance">
            Citizen Guides, Tax Checklists &amp; Registration Insights
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Clear, actionable documentation guides for PAN, GSTIN, Udyam MSME, FSSAI, Gazette notifications, and digital certificates across India.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
          {allowUserPublishing &&
            (user ? (
              <>
                <button
                  type="button"
                  onClick={() => openUserComposer()}
                  className="px-3.5 py-2 rounded-xl bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Write &amp; Publish Guide</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMyPostsOpen((v) => !v)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                    myPostsOpen
                      ? 'border-[#FF671F] bg-[#FFF5EE] dark:bg-orange-950/30 text-[#FF671F]'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-[#FF671F]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>My Posts ({myPosts.length})</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 hover:border-[#FF671F] transition cursor-pointer whitespace-nowrap"
              >
                <PenSquare className="w-3.5 h-3.5 text-[#FF671F]" />
                <span>Sign In to Publish</span>
              </button>
            ))}

          {canManageBlog && (
            <button
              type="button"
              onClick={() => onNavigate('admin', 'blog')}
              className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-slate-800 dark:hover:bg-white transition cursor-pointer whitespace-nowrap"
            >
              <PenSquare className="w-3.5 h-3.5" />
              <span>CMS &amp; Import</span>
            </button>
          )}
        </div>
      </div>

      {postNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2">
          <span>{postNotice}</span>
          <button
            type="button"
            onClick={() => setPostNotice(null)}
            className="text-[11px] underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* User Publishing Control Drawer */}
      {user && allowUserPublishing && myPostsOpen && (
        <section
          aria-label="My Blog Publishing Controls"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Your Blog Publishing Workspace
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Create citizen guides, switch articles between Published and Draft, or edit anytime. Default publisher: {defaultPublisher}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openUserComposer()}
              className="px-3 py-1.5 rounded-lg bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Article</span>
            </button>
          </div>

          {myPosts.length === 0 ? (
            <div className="py-5 text-center text-slate-500 dark:text-slate-400 space-y-2">
              <p>You have not written any blog guides yet.</p>
              <button
                type="button"
                onClick={() => openUserComposer()}
                className="text-[#FF671F] font-bold hover:underline cursor-pointer"
              >
                Write your first guide →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {myPosts.map((mp) => (
                <div
                  key={mp.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span
                        className={`font-bold uppercase ${
                          mp.status === 'published'
                            ? 'text-[#138808] dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {mp.status}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{mp.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>Publisher: {mp.authorName}</span>
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white truncate">
                      {mp.title}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onNavigate('blog-detail', mp.slug)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 hover:border-[#FF671F] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>View</span>
                    </button>
                    {(!userRequiresReview || canManageBlog || mp.status === 'published') && (
                      <button
                        type="button"
                        onClick={() =>
                          void toggleBlogPostStatus(
                            mp.id,
                            mp.status === 'published' ? 'draft' : 'published'
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 hover:border-[#138808] cursor-pointer"
                      >
                        {mp.status === 'published' ? 'Set Draft' : 'Publish Live'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openUserComposer(mp)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 hover:border-[#FF671F] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteBlogPost(mp.id)}
                      aria-label={`Delete ${mp.title}`}
                      className="px-2 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Search & Category Filter Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setSelectedCategory(cat);
                setCurrentPage(1);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#FF671F] text-white'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {cat === 'all' ? `All Guides (${publishedPosts.length})` : cat}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-80 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search Aadhaar, PAN, Voter, Passport, GST..."
            aria-label="Search blog articles"
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#FF671F]"
          />
        </div>
      </div>

      {filteredPosts.length === 0 ? (
        <div className="p-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-3">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            No Matching Articles Found
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Clear your search filter or switch back to all categories to view published guides.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="px-4 py-2 rounded-xl bg-[#FF671F] text-white text-xs font-bold cursor-pointer"
          >
            Show All Guides
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Tier 1: Lead Story Feature */}
          {leadPost && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-8 space-y-3.5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-bold text-[#FF671F] uppercase tracking-wider">
                    Featured · {leadPost.category}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{leadPost.readingTimeMinutes} min read</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={leadPost.publishedAt} className="tabular-nums">
                    {new Date(leadPost.publishedAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </time>
                </div>

                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight text-balance">
                  <a
                    href={buildUrlForRoute('blog-detail', leadPost.slug)}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate('blog-detail', leadPost.slug);
                    }}
                    className="hover:text-[#FF671F] transition cursor-pointer"
                  >
                    {lang === 'hi' && leadPost.titleHi ? leadPost.titleHi : leadPost.title}
                  </a>
                </h2>

                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                  {lang === 'hi' && leadPost.excerptHi
                    ? leadPost.excerptHi
                    : leadPost.excerpt}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <a
                    href={buildUrlForRoute('blog-detail', leadPost.slug)}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate('blog-detail', leadPost.slug);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                  >
                    <span>Read Complete Guide</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                  {leadPost.focusKeyword && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Topic: {leadPost.focusKeyword}
                    </span>
                  )}
                </div>
              </div>

              <div className="lg:col-span-4 p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <FileText className="w-4 h-4 text-[#138808]" />
                  <span>Quick Article Outline</span>
                </div>
                <ul className="space-y-1.5 text-slate-600 dark:text-slate-300">
                  {extractHeadings(leadPost.content)
                    .slice(0, 4)
                    .map((h, i) => (
                      <li key={h.id} className="truncate">
                        <span className="font-mono text-slate-400 mr-1.5">0{i + 1}.</span>
                        {h.text}
                      </li>
                    ))}
                </ul>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
                  Author: <strong className="text-slate-800 dark:text-slate-200">{leadPost.authorName}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Tier 2 & 3: Paginated Article Archive Grid */}
          {archivePosts.length > 0 && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  Showing <strong className="text-slate-800 dark:text-slate-200 tabular-nums">{pageStartIdx + 1}–{Math.min(pageStartIdx + PAGE_SIZE, archivePosts.length)}</strong> of{' '}
                  <strong className="text-slate-800 dark:text-slate-200 tabular-nums">{archivePosts.length}</strong> more guides
                  {selectedCategory !== 'all' ? ` in ${selectedCategory}` : ''}
                </span>
                {totalPages > 1 && (
                  <span className="tabular-nums">
                    Page {safePage} of {totalPages}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleArchivePosts.map((post) => (
                  <article
                    key={post.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition"
                  >
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-bold text-[#FF671F]">{post.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{post.readingTimeMinutes} min read</span>
                        <span aria-hidden="true">·</span>
                        <time dateTime={post.publishedAt} className="tabular-nums">
                          {new Date(post.publishedAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </time>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                        <a
                          href={buildUrlForRoute('blog-detail', post.slug)}
                          onClick={(e) => {
                            e.preventDefault();
                            onNavigate('blog-detail', post.slug);
                          }}
                          className="hover:text-[#FF671F] transition cursor-pointer"
                        >
                          {lang === 'hi' && post.titleHi ? post.titleHi : post.title}
                        </a>
                      </h3>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                        {lang === 'hi' && post.excerptHi ? post.excerptHi : post.excerpt}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {post.authorName}
                      </span>
                      <a
                        href={buildUrlForRoute('blog-detail', post.slug)}
                        onClick={(e) => {
                          e.preventDefault();
                          onNavigate('blog-detail', post.slug);
                        }}
                        className="font-bold text-[#138808] dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Read Article →
                      </a>
                    </div>
                  </article>
                ))}
              </div>

              {totalPages > 1 && (
                <nav
                  aria-label="Blog pagination"
                  className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => {
                      setCurrentPage((p) => Math.max(1, p - 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:border-[#FF671F] transition cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => {
                          setCurrentPage(pageNum);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`w-8 h-8 rounded-lg text-xs font-bold tabular-nums transition cursor-pointer ${
                          pageNum === safePage
                            ? 'bg-[#FF671F] text-white'
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#FF671F]'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => {
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:border-[#FF671F] transition cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </nav>
              )}
            </div>
          )}
        </div>
      )}

      {/* Compact User Blog Write & Publish Modal */}
      {composerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Write and Publish Blog Guide"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
        >
          <form
            onSubmit={handleSaveUserPost}
            className="w-full max-w-lg max-h-[85vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs"
          >
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0 bg-slate-50/70 dark:bg-slate-950/50">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingUserPostId ? 'Edit Blog Article' : 'Write & Publish Blog Guide'}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Publisher: {postAuthor || defaultPublisher}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                aria-label="Close editor"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              {postError && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-semibold">
                  {postError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Article Title *
                </label>
                <input
                  type="text"
                  required
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="e.g. Complete PAN Card Name Correction Checklist 2026"
                  className="w-full px-3 py-2 rounded-lg bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={postCategory}
                    onChange={(e) => setPostCategory(e.target.value)}
                    placeholder="Citizen Guides"
                    className="w-full px-3 py-2 rounded-lg bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Publisher / Author Name
                  </label>
                  <input
                    type="text"
                    value={postAuthor}
                    onChange={(e) => setPostAuthor(e.target.value)}
                    placeholder={defaultPublisher}
                    className="w-full px-3 py-2 rounded-lg bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Publish Control
                  </label>
                  <select
                    value={userRequiresReview && !canManageBlog ? 'draft' : postStatus}
                    disabled={userRequiresReview && !canManageBlog}
                    onChange={(e) =>
                      setPostStatus(e.target.value as 'published' | 'draft')
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white disabled:opacity-60"
                  >
                    <option value="published">Publish Live Now</option>
                    <option value="draft">Save as Draft</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Related Service (Optional)
                  </label>
                  <select
                    value={postRelatedService}
                    onChange={(e) => setPostRelatedService(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="">None</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.slug}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Short Summary
                </label>
                <textarea
                  rows={2}
                  value={postExcerpt}
                  onChange={(e) => setPostExcerpt(e.target.value)}
                  placeholder="1–2 sentence overview displayed on the blog index..."
                  className="w-full px-3 py-2 rounded-lg bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Guide Content (## Headings, - Bullets, 1. Steps) *
                </label>
                <textarea
                  rows={6}
                  required
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingPost}
                className="px-4 py-2 rounded-lg bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {savingPost
                    ? 'Saving...'
                    : postStatus === 'published' && (!userRequiresReview || canManageBlog)
                    ? 'Publish Article'
                    : 'Save Draft'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
