import React from 'react';
import { Logo } from './Logo';
import { useData } from '../../context/DataContext';
import { buildUrlForRoute } from '../../lib/siteUrls';
import {
  Mail,
  Phone,
  MessageSquare,
  ShieldAlert,
  MapPin,
  Clock,
} from 'lucide-react';

interface FooterProps {
  onNavigate: (route: string, param?: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const { businessSettings } = useData();
  const gstin = businessSettings.gstin || '26EXIPK0151F1ZQ';
  const udyam = businessSettings.udyamNumber || 'UDYAM-DD-03-0009994';
  const duns = businessSettings.dunsNumber || '308198649';

  const handleFooterLink = (e: React.MouseEvent<HTMLAnchorElement>, route: string, param?: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(route, param);
  };

  return (
    <footer className="bg-white dark:bg-slate-950 border-t border-[#E5E7EB] dark:border-slate-800 text-[#202124] dark:text-slate-200 pb-20 lg:pb-0">
      {/* Subtle tricolour top border */}
      <div className="w-full h-1.5 flex">
        <div className="flex-1 bg-[#FF671F]"></div>
        <div className="flex-1 bg-[#FFFFFF] dark:bg-slate-700 border-y border-slate-200 dark:border-slate-700"></div>
        <div className="flex-1 bg-[#138808]"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10">
          <div className="sm:col-span-2 space-y-4">
            <Logo size="md" />
            <p className="text-xs text-[#64748B] dark:text-slate-400 leading-relaxed max-w-sm">
              Digital India Project provides professional documentation, advisory, and online registration facilitation for citizens, entrepreneurs, and enterprises across India.
            </p>

            {/* Official Corporate Identifiers */}
            <div className="text-[11px] font-mono text-slate-700 dark:text-slate-300 space-y-1 border-t border-b border-slate-100 dark:border-slate-800 py-2.5">
              <div>
                <span className="text-slate-400">GSTIN:</span>{' '}
                <strong className="font-bold">{gstin}</strong>
                <span className="mx-2 text-slate-300 dark:text-slate-700">·</span>
                <span className="text-slate-400">UDYAM:</span>{' '}
                <strong className="font-bold">{udyam}</strong>
              </div>
              <div>
                <span className="text-slate-400">D-U-N-S® No:</span>{' '}
                <strong className="font-bold">{duns}</strong>
              </div>
            </div>

            <div className="p-3.5 bg-[#FFFDF8] dark:bg-slate-900 border border-[#F1E8D9] dark:border-slate-800 rounded-xl text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-[#FF671F] font-bold text-[11px] uppercase tracking-wider">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>Statutory Business Disclosure</span>
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400 leading-relaxed">
                We are a private registration consultancy and tech-enabled facilitation firm. We do not represent any government department or statutory authority. Official approvals rest solely with the respective government bodies.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs text-[#64748B] dark:text-slate-400 pt-1">
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#138808]" />
                <span>Mon – Sat: 9:30 AM – 7:00 PM IST</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#202124] dark:text-white">
              Service Categories
            </h4>
            <ul className="space-y-1.5 text-xs text-[#64748B] dark:text-slate-400">
              <li><a href="/services/personal" onClick={(e) => handleFooterLink(e, 'services', 'personal')} className="hover:text-[#FF671F] transition cursor-pointer">Personal &amp; Citizen Services</a></li>
              <li><a href="/services/business-registration" onClick={(e) => handleFooterLink(e, 'services', 'business-registration')} className="hover:text-[#FF671F] transition cursor-pointer">Business &amp; Startup Setup</a></li>
              <li><a href="/services/tax-compliance" onClick={(e) => handleFooterLink(e, 'services', 'tax-compliance')} className="hover:text-[#FF671F] transition cursor-pointer">Taxation &amp; Compliance</a></li>
              <li><a href="/services/education-career" onClick={(e) => handleFooterLink(e, 'services', 'education-career')} className="hover:text-[#FF671F] transition cursor-pointer">Education &amp; Career</a></li>
              <li><a href="/services/documentation" onClick={(e) => handleFooterLink(e, 'services', 'documentation')} className="hover:text-[#FF671F] transition cursor-pointer">Documentation &amp; Legal Support</a></li>
              <li><a href="/products" onClick={(e) => handleFooterLink(e, 'products')} className="hover:text-[#FF671F] font-semibold transition cursor-pointer">Digital Products &amp; Downloads</a></li>
              <li><a href="/services/digital-technology" onClick={(e) => handleFooterLink(e, 'services', 'digital-technology')} className="hover:text-[#FF671F] transition cursor-pointer">Digital &amp; Tech Solutions</a></li>
              <li><a href="/services/b2b-partner" onClick={(e) => handleFooterLink(e, 'services', 'b2b-partner')} className="hover:text-[#FF671F] transition cursor-pointer">B2B, Partner &amp; Reseller</a></li>
              <li><a href="/packages" onClick={(e) => handleFooterLink(e, 'packages')} className="hover:text-[#FF671F] font-semibold text-[#138808] transition cursor-pointer">Startup &amp; Compliance Packages</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#202124] dark:text-white">
              Quick Links &amp; Locations
            </h4>
            <ul className="space-y-1.5 text-xs text-[#64748B] dark:text-slate-400">
              <li><a href={buildUrlForRoute('services')} onClick={(e) => handleFooterLink(e, 'services')} className="hover:text-[#FF671F] transition cursor-pointer">All 149+ Services &amp; Kits</a></li>
              <li><a href={buildUrlForRoute('pricing')} onClick={(e) => handleFooterLink(e, 'pricing')} className="hover:text-[#FF671F] transition cursor-pointer">Pricing &amp; Fee Schedule</a></li>
              <li><a href={buildUrlForRoute('track')} onClick={(e) => handleFooterLink(e, 'track')} className="hover:text-[#FF671F] transition text-[#FF671F] font-semibold cursor-pointer">Track Your Application</a></li>
              <li><a href={buildUrlForRoute('blog')} onClick={(e) => handleFooterLink(e, 'blog')} className="hover:text-[#FF671F] transition cursor-pointer">Blog &amp; Compliance Guides</a></li>
              <li><a href={buildUrlForRoute('become-partner')} onClick={(e) => handleFooterLink(e, 'become-partner')} className="hover:text-[#FF671F] transition cursor-pointer">Become Our Partner</a></li>
              <li><a href={buildUrlForRoute('faq')} onClick={(e) => handleFooterLink(e, 'faq')} className="hover:text-[#FF671F] transition cursor-pointer">Help Centre &amp; FAQs</a></li>
              <li><a href={buildUrlForRoute('contact')} onClick={(e) => handleFooterLink(e, 'contact')} className="hover:text-[#FF671F] transition cursor-pointer">Contact Support Desk</a></li>
              <li><a href="/india" onClick={(e) => handleFooterLink(e, 'india-directory', '/india')} className="hover:text-[#FF671F] font-semibold transition cursor-pointer">India Directory (All 36 States &amp; UTs)</a></li>
              <li><a href={buildUrlForRoute('about')} onClick={(e) => handleFooterLink(e, 'about')} className="hover:text-[#FF671F] transition cursor-pointer">About Us</a></li>
            </ul>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Regional Desks
              </div>
              <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] text-[#64748B] dark:text-slate-400">
                <a href="/locations/silvassa" onClick={(e) => handleFooterLink(e, 'location', 'silvassa')} className="hover:text-[#FF671F] cursor-pointer">Silvassa</a>
                <span>·</span>
                <a href="/locations/dadra-nagar-haveli" onClick={(e) => handleFooterLink(e, 'location', 'dadra-nagar-haveli')} className="hover:text-[#FF671F] cursor-pointer">DNH</a>
                <span>·</span>
                <a href="/locations/daman" onClick={(e) => handleFooterLink(e, 'location', 'daman')} className="hover:text-[#FF671F] cursor-pointer">Daman</a>
                <span>·</span>
                <a href="/locations/vapi" onClick={(e) => handleFooterLink(e, 'location', 'vapi')} className="hover:text-[#FF671F] cursor-pointer">Vapi</a>
                <span>·</span>
                <a href="/locations/valsad" onClick={(e) => handleFooterLink(e, 'location', 'valsad')} className="hover:text-[#FF671F] cursor-pointer">Valsad</a>
                <span>·</span>
                <a href="/locations/umargam" onClick={(e) => handleFooterLink(e, 'location', 'umargam')} className="hover:text-[#FF671F] cursor-pointer">Umargam</a>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#202124] dark:text-white">
              Business Desk
            </h4>
            <div className="space-y-2.5 text-xs text-[#64748B] dark:text-slate-400">
              <div className="flex items-start gap-2">
                <Mail className="w-3.5 h-3.5 text-[#FF671F] mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <a href={`mailto:${businessSettings.supportEmail}`} className="hover:text-[#FF671F] block break-all">
                    {businessSettings.supportEmail}
                  </a>
                  <a href="mailto:applications@digitalindiaproject.com" className="hover:text-[#FF671F] block text-[11px] text-slate-500 break-all">
                    applications@digitalindiaproject.com
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#138808] shrink-0" />
                <a href={`tel:${businessSettings.supportPhone.replace(/\s+/g, '')}`} className="hover:text-[#FF671F] font-semibold">
                  {businessSettings.supportPhone}
                </a>
              </div>

              <div className="flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                <a href="https://wa.me/917777941227" target="_blank" rel="noopener noreferrer" className="text-[#138808] font-semibold hover:underline">
                  WhatsApp: {businessSettings.supportPhone}
                </a>
              </div>

              <div className="flex items-start gap-2 pt-1">
                <MapPin className="w-3.5 h-3.5 text-[#64748B] mt-0.5 shrink-0" />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {businessSettings.registeredAddress}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[#E5E7EB] dark:border-slate-800 mt-10 pt-6 flex flex-col lg:flex-row items-center justify-between gap-4 text-xs text-[#64748B] dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 justify-center lg:justify-start">
            <a href={buildUrlForRoute('legal', 'disclaimer')} onClick={(e) => handleFooterLink(e, 'legal', 'disclaimer')} className="hover:text-[#FF671F] transition cursor-pointer">Legal Disclaimer</a>
            <span>·</span>
            <a href={buildUrlForRoute('legal', 'terms')} onClick={(e) => handleFooterLink(e, 'legal', 'terms')} className="hover:text-[#FF671F] transition cursor-pointer">Terms &amp; Conditions</a>
            <span>·</span>
            <a href={buildUrlForRoute('legal', 'privacy')} onClick={(e) => handleFooterLink(e, 'legal', 'privacy')} className="hover:text-[#FF671F] transition cursor-pointer">Privacy Policy</a>
            <span>·</span>
            <a href={buildUrlForRoute('legal', 'data-protection')} onClick={(e) => handleFooterLink(e, 'legal', 'data-protection')} className="hover:text-[#FF671F] transition cursor-pointer">Data Protection</a>
            <span>·</span>
            <a href={buildUrlForRoute('legal', 'refund')} onClick={(e) => handleFooterLink(e, 'legal', 'refund')} className="hover:text-[#FF671F] transition cursor-pointer">Refund &amp; Cancellation</a>
            <span>·</span>
            <a href={buildUrlForRoute('legal', 'digital-product-policy')} onClick={(e) => handleFooterLink(e, 'legal', 'digital-product-policy')} className="hover:text-[#FF671F] transition cursor-pointer">Digital Product Policy</a>
            <span>·</span>
            <a href={buildUrlForRoute('legal', 'grievance')} onClick={(e) => handleFooterLink(e, 'legal', 'grievance')} className="hover:text-[#FF671F] transition cursor-pointer">Grievance Redressal</a>
          </div>

          <div className="text-center lg:text-right text-[11px] text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} {businessSettings.legalName} · GSTIN {gstin} · Udyam {udyam} · D-U-N-S {duns}
          </div>
        </div>
      </div>
    </footer>
  );
};
