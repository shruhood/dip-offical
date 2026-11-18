import React, { useState } from 'react';
import { Search, HelpCircle, ChevronDown, ChevronUp, FileText, CreditCard, ShieldCheck } from 'lucide-react';

export const HelpFaqPage: React.FC<{ onNavigate: (route: string) => void }> = ({ onNavigate }) => {
  const [activeAccordion, setActiveAccordion] = useState<number | null>(0);
  const [faqSearch, setFaqSearch] = useState('');

  const faqs = [
    {
      q: 'What is the role of Digital India Project?',
      a: 'Digital India Project is an independent private online registration assistance platform. We guide applicants, prepare and audit required identification proofs, fill statutory forms, and manage filing follow-ups. We do not claim to be a government authority.',
    },
    {
      q: 'How does payment processing work?',
      a: 'All transactions are processed securely through Cashfree Payments, supporting UPI (PhonePe, Google Pay, Paytm, BHIM), NetBanking, and Cards. Once payment completes, a unique Application ID (DIP-2026-XXXXX) and downloadable receipt are generated.',
    },
    {
      q: 'Can I track the status of my application after submitting?',
      a: 'Yes. Visit the "Track Application" page anytime and enter your Application ID and registered mobile number. You will see the complete progress timeline and any remarks or certificates issued by operations officers.',
    },
    {
      q: 'What happens if my documents have discrepancies or errors?',
      a: 'Before portal submission, our operations team verifies your uploads. If a document is blurry or expired (e.g. an electricity bill older than 2 months for GST), our desk will mark the application as "Documents Required" and request an updated copy.',
    },
    {
      q: 'What is your refund policy?',
      a: 'If our operations desk has not yet initiated the drafting or filing process with statutory authorities, a full refund can be requested within 24 hours of payment. Once filing fees and officer reviews have commenced, nominal administrative deductions apply.',
    },
    {
      q: 'Are government fees included in the price shown?',
      a: 'Yes, we transparently display both our private facilitation charge and any applicable statutory government fees before you proceed to payment.',
    },
  ];

  const filteredFaqs = faqs.filter(
    (f) =>
      f.q.toLowerCase().includes(faqSearch.toLowerCase()) ||
      f.a.toLowerCase().includes(faqSearch.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="text-center space-y-2">
        <span className="text-xs font-bold text-[#FF671F] uppercase tracking-wider bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">
          Knowledge Base
        </span>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Help Centre & Frequently Asked Questions
        </h1>
        <p className="text-xs sm:text-sm text-slate-600">
          Everything you need to know about our digital application assistance services, documents, and payments.
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
        <input
          type="text"
          placeholder="Search questions or keywords..."
          value={faqSearch}
          onChange={(e) => setFaqSearch(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#FF671F] shadow-2xs"
        />
      </div>

      {/* Accordion list */}
      <div className="space-y-3">
        {filteredFaqs.map((faq, idx) => {
          const isOpen = activeAccordion === idx;
          return (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition shadow-2xs"
            >
              <button
                onClick={() => setActiveAccordion(isOpen ? null : idx)}
                className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-slate-900 hover:text-[#FF671F] transition cursor-pointer"
              >
                <span>{faq.q}</span>
                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
              </button>

              {isOpen && (
                <div className="px-4 pb-5 sm:px-5 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                  <p>{faq.a}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
