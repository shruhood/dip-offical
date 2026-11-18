import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  IndianLanguageDefinition,
  SUPPORTED_INDIAN_LANGUAGES,
  SupportedLanguageCode,
  isSupportedLangCode,
  resolveLanguageMeta,
} from '../data/indianLanguages';

export type Language = SupportedLanguageCode;

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
  langMeta: IndianLanguageDefinition;
  supportedLanguages: IndianLanguageDefinition[];
}

const translations: Partial<Record<Language, Record<string, string>>> = {
  en: {
    'nav.home': 'Home',
    'nav.services': 'Services',
    'nav.businessServices': 'Business Services',
    'nav.personalServices': 'Personal Services',
    'nav.about': 'About Us',
    'nav.contact': 'Contact',
    'nav.track': 'Track Application',
    'nav.login': 'Login',
    'nav.register': 'Register',
    'nav.dashboard': 'Dashboard',
    'nav.applyNow': 'Apply Online',
    'hero.badge': 'India’s Dedicated Digital Services & Online Registration Assistance Platform',
    'hero.title': 'Your Digital Services, Simplified.',
    'hero.subtitle': 'Your Trusted Partner for Digital Applications & Registration Assistance.',
    'hero.desc': 'Access essential digital services, complete online applications and get professional assistance — all from one convenient platform.',
    'hero.explore': 'Explore Services',
    'hero.track': 'Track Application',
    'hero.searchPlaceholder': 'What service are you looking for? (e.g. PAN Card, GST, Udyam, FSSAI...)',
    'quick.browse': 'Browse Services',
    'quick.apply': 'Apply Online',
    'quick.track': 'Track Application',
    'quick.assist': 'Get Assistance',
    'sec.popularServices': 'Popular Digital Services',
    'sec.popularSub': 'Fast, transparent, and professionally assisted online registration and documentation.',
    'sec.categories': 'Browse by Categories',
    'sec.howItWorks': 'How It Works',
    'sec.whyUs': 'Why Digital India Project?',
    'sec.testimonials': 'Customer Experiences',
    'sec.faqs': 'Frequently Asked Questions',
    'sec.ctaTitle': 'Ready to Get Started?',
    'sec.ctaDesc': 'Find the service you need and submit your application online with complete peace of mind.',
    'footer.disclaimer': 'Digital India Project is a privately operated digital services and online registration assistance provider. We are not a government department or government-owned entity. Government registrations, applications and approvals are subject to the rules, verification and decisions of the respective authorities.',
    'status.draft': 'Draft',
    'status.submitted': 'Submitted',
    'status.awaitingPayment': 'Awaiting Payment',
    'status.paymentConfirmed': 'Payment Confirmed',
    'status.underReview': 'Under Review',
    'status.documentVerification': 'Document Verification',
    'status.documentsRequired': 'Documents Required',
    'status.processing': 'Application Processing',
    'status.completed': 'Completed',
    'status.rejected': 'Rejected',
    'common.govtFee': 'Official Govt Fee',
    'common.serviceCharge': 'Facilitation Fee',
    'common.estTime': 'Est. Time',
    'common.viewDetails': 'View Details',
    'common.applyNow': 'Apply Now',
  },
  hi: {
    'nav.home': 'होम',
    'nav.services': 'सभी सेवाएं',
    'nav.businessServices': 'व्यावसायिक सेवाएं',
    'nav.personalServices': 'व्यक्तिगत सेवाएं',
    'nav.about': 'हमारे बारे में',
    'nav.contact': 'संपर्क करें',
    'nav.track': 'आवेदन ट्रैक करें',
    'nav.login': 'लॉग इन',
    'nav.register': 'पंजीकरण',
    'nav.dashboard': 'डैशबोर्ड',
    'nav.applyNow': 'ऑनलाइन आवेदन करें',
    'hero.badge': 'भारत का विश्वसनीय डिजिटल आवेदन एवं पंजीकरण सहायता मंच',
    'hero.title': 'आपकी डिजिटल सेवाएं, अब और भी आसान।',
    'hero.subtitle': 'डिजिटल आवेदनों और सरकारी पंजीकरणों में आपका विश्वसनीय सहयोगी।',
    'hero.desc': 'आवश्यक डिजिटल सेवाओं तक पहुंचें, आसान ऑनलाइन फॉर्म भरें और पेशेवर सहायता प्राप्त करें — सब एक ही मंच पर।',
    'hero.explore': 'सेवाएं देखें',
    'hero.track': 'आवेदन ट्रैक करें',
    'hero.searchPlaceholder': 'आप किस सेवा की तलाश में हैं? (उदा. पैन कार्ड, जीएसटी, उद्यम, फ़ूड लाइसेंस...)',
    'quick.browse': 'सेवाएं देखें',
    'quick.apply': 'ऑनलाइन आवेदन',
    'quick.track': 'आवेदन ट्रैक करें',
    'quick.assist': 'सहायता प्राप्त करें',
    'sec.popularServices': 'लोकप्रिय डिजिटल सेवाएं',
    'sec.popularSub': 'पारदर्शी शुल्क, तीव्र प्रक्रिया और पेशेवर सहायता के साथ ऑनलाइन पंजीकरण।',
    'sec.categories': 'श्रेणियों के अनुसार खोजें',
    'sec.howItWorks': 'यह कैसे काम करता है',
    'sec.whyUs': 'डिजिटल इंडिया प्रोजेक्ट ही क्यों?',
    'sec.testimonials': 'ग्राहकों के अनुभव',
    'sec.faqs': 'अक्सर पूछे जाने वाले सवाल',
    'sec.ctaTitle': 'क्या आप शुरुआत करने के लिए तैयार हैं?',
    'sec.ctaDesc': 'अपनी आवश्यक सेवा चुनें और घर बैठे सुरक्षित तरीके से ऑनलाइन आवेदन पूरा करें।',
    'footer.disclaimer': 'डिजिटल इंडिया प्रोजेक्ट एक निजी तौर पर संचालित डिजिटल सेवाएं एवं ऑनलाइन पंजीकरण सहायता प्रदाता कंपनी है। हम कोई सरकारी विभाग या सरकार के स्वामित्व वाला पोर्टल नहीं हैं। सरकारी पंजीकरण, आवेदन और अनुमोदन संबंधित प्राधिकारियों के नियमों, सत्यापन और निर्णयों के अधीन हैं।',
    'status.draft': 'ड्राफ्ट',
    'status.submitted': 'जमा किया गया',
    'status.awaitingPayment': 'भुगतान प्रतीक्षित',
    'status.paymentConfirmed': 'भुगतान सफल',
    'status.underReview': 'समीक्षाधीन',
    'status.documentVerification': 'दस्तावेज़ सत्यापन',
    'status.documentsRequired': 'अतिरिक्त दस्तावेज़ आवश्यक',
    'status.processing': 'प्रक्रिया जारी है',
    'status.completed': 'पूर्ण',
    'status.rejected': 'अस्वीकृत',
    'common.govtFee': 'सरकारी शुल्क',
    'common.serviceCharge': 'सेवा शुल्क',
    'common.estTime': 'अनुमानित समय',
    'common.viewDetails': 'विवरण देखें',
    'common.applyNow': 'आवेदन करें',
  },
};

const defaultLangMeta = resolveLanguageMeta('en');

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
  langMeta: defaultLangMeta,
  supportedLanguages: SUPPORTED_INDIAN_LANGUAGES,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('dip_lang');
      return isSupportedLangCode(saved) ? saved : 'en';
    } catch {
      return 'en';
    }
  });

  const langMeta = resolveLanguageMeta(lang);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = langMeta.hreflang || lang;
      document.documentElement.dir = langMeta.rtl ? 'rtl' : 'ltr';
    }
  }, [lang, langMeta.hreflang, langMeta.rtl]);

  const setLang = (newLang: Language) => {
    const safeLang = isSupportedLangCode(newLang) ? newLang : 'en';
    setLangState(safeLang);
    try {
      localStorage.setItem('dip_lang', safeLang);
    } catch {
      // Ignore storage errors
    }
  };

  const t = (key: string): string => {
    const direct = translations[lang]?.[key];
    if (direct) return direct;
    if (key === 'common.applyNow') return langMeta.copy.applyOnline;
    if (key === 'common.viewDetails') return langMeta.copy.viewDetails;
    if (key === 'common.govtFee') return langMeta.copy.govtFeeLabel;
    if (key === 'common.serviceCharge') return langMeta.copy.profFeeLabel;
    if (key === 'footer.disclaimer') return langMeta.copy.disclaimer;
    return translations.en?.[key] || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLang,
        t,
        langMeta,
        supportedLanguages: SUPPORTED_INDIAN_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
