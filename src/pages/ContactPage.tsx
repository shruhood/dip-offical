import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import {
  Mail,
  Phone,
  MessageSquare,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
  Building2,
} from 'lucide-react';

export const ContactPage: React.FC = () => {
  const { businessSettings } = useData();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [service, setService] = useState('General Inquiry');
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);
  const [submittedNotice, setSubmittedNotice] = useState<string | null>(null);

  const gstin = businessSettings.gstin || '26EXIPK0151F1ZQ';
  const udyam = businessSettings.udyamNumber || 'UDYAM-DD-03-0009994';
  const duns = businessSettings.dunsNumber || '308198649';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !msg.trim()) return;

    setSent(true);
    setTimeout(() => {
      setSubmittedNotice(
        `Thank you, ${name.trim()}! Your inquiry regarding "${service}" has been logged with our support desk. An agent will respond within 2 business hours.`
      );
      setName('');
      setEmail('');
      setMobile('');
      setMsg('');
      setSent(false);
    }, 500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Page Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <div className="text-[11px] font-bold text-[#FF671F] uppercase tracking-[0.14em]">
          Assistance &amp; Help Desk
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Contact {businessSettings.legalName}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Have questions regarding document prerequisites, fee breakdowns, or application tracking? Reach out to our dedicated assistance desk.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-6xl mx-auto">
        {/* Contact Information (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5 text-xs">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
              Official Department Desks &amp; Corporate Registry
            </h3>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-[#FF671F] flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">Support &amp; Customer Inquiries</div>
                  <a href={`mailto:${businessSettings.supportEmail}`} className="text-slate-600 dark:text-slate-400 hover:text-[#FF671F] break-all">
                    {businessSettings.supportEmail}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-[#FF671F] flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">Applications &amp; Billing Desks</div>
                  <a href="mailto:applications@digitalindiaproject.com" className="text-slate-600 dark:text-slate-400 hover:text-[#FF671F] block break-all">
                    applications@digitalindiaproject.com
                  </a>
                  <a href="mailto:accounts@digitalindiaproject.com" className="text-slate-500 dark:text-slate-400 hover:text-[#FF671F] block text-[11px] break-all">
                    accounts@digitalindiaproject.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-emerald-950/40 text-[#138808] flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">Helpline Phone</div>
                  <a href={`tel:${businessSettings.supportPhone.replace(/\s+/g, '')}`} className="text-slate-600 dark:text-slate-300 hover:text-[#FF671F] font-semibold">
                    {businessSettings.supportPhone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-emerald-950/40 text-[#138808] flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">WhatsApp Support Desk</div>
                  <a href="https://wa.me/917777941227" target="_blank" rel="noopener noreferrer" className="text-slate-600 dark:text-slate-300 hover:text-[#138808] font-semibold">
                    {businessSettings.supportPhone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">Operating Hours</div>
                  <span className="text-slate-600 dark:text-slate-400">Monday to Saturday: 9:30 AM – 7:00 PM IST</span>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">Registered Office Address</div>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                    {businessSettings.registeredAddress}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-[#FF671F] flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                  <div className="font-sans font-bold text-slate-800 dark:text-slate-200 text-xs">Enterprise Registrations</div>
                  <div>GSTIN: <strong>{gstin}</strong></div>
                  <div>UDYAM: <strong>{udyam}</strong></div>
                  <div>D-U-N-S®: <strong>{duns}</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-5 text-xs">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Send an Online Inquiry</h2>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
              Fill out this form and our support officers will get back to you with guidance.
            </p>
          </div>

          {submittedNotice && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#138808] shrink-0" />
                <span>{submittedNotice}</span>
              </div>
              <button type="button" onClick={() => setSubmittedNotice(null)} className="underline text-[11px] shrink-0 cursor-pointer">
                Dismiss
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Your Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Verma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:border-[#FF671F] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Mobile Number *</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:border-[#FF671F] focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address *</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:border-[#FF671F] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Service Inquired About</label>
                <select
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:border-[#FF671F] focus:outline-none"
                >
                  <option>General Inquiry</option>
                  <option>PAN Card Application / Correction</option>
                  <option>GST Registration &amp; Return</option>
                  <option>Udyam MSME Certificate</option>
                  <option>FSSAI Food License</option>
                  <option>Digital Signature (DSC)</option>
                  <option>D-U-N-S Number Assistance</option>
                  <option>Gazette Name Change</option>
                  <option>Payment &amp; Receipt Clarification</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Your Message or Question *</label>
              <textarea
                rows={4}
                placeholder="Explain what assistance or document clarification you need..."
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:border-[#FF671F] focus:outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={sent}
              className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-6 py-2.5 rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sent ? 'Sending Message...' : 'Submit Inquiry'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
