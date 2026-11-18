export interface ServiceCardTheme {
  card: string;
  footer: string;
  divider: string;
  iconBox: string;
  iconColor: string;
  categoryLabel: string;
}

const SERVICE_THEMES: Record<string, ServiceCardTheme> = {
  personal: {
    card: 'bg-gradient-to-br from-orange-50/75 via-white to-amber-50/45 dark:from-orange-950/25 dark:via-slate-900 dark:to-slate-900 border-orange-200/80 dark:border-orange-900/50 hover:border-[#FF671F] dark:hover:border-[#FF671F]',
    footer: 'bg-orange-50/70 dark:bg-orange-950/35 border-orange-200/70 dark:border-orange-900/45',
    divider: 'border-orange-100 dark:border-orange-900/40',
    iconBox: 'bg-orange-100/85 dark:bg-orange-950/70 border-orange-200/80 dark:border-orange-800/70 group-hover:bg-[#FF671F]',
    iconColor: 'text-[#E55B1B] dark:text-orange-400 group-hover:text-white',
    categoryLabel: 'text-orange-700/85 dark:text-orange-300/90',
  },
  'business-registration': {
    card: 'bg-gradient-to-br from-emerald-50/75 via-white to-teal-50/45 dark:from-emerald-950/25 dark:via-slate-900 dark:to-slate-900 border-emerald-200/80 dark:border-emerald-900/50 hover:border-emerald-500 dark:hover:border-emerald-500',
    footer: 'bg-emerald-50/70 dark:bg-emerald-950/35 border-emerald-200/70 dark:border-emerald-900/45',
    divider: 'border-emerald-100 dark:border-emerald-900/40',
    iconBox: 'bg-emerald-100/85 dark:bg-emerald-950/70 border-emerald-200/80 dark:border-emerald-800/70 group-hover:bg-emerald-600',
    iconColor: 'text-emerald-700 dark:text-emerald-400 group-hover:text-white',
    categoryLabel: 'text-emerald-700/85 dark:text-emerald-300/90',
  },
  'tax-compliance': {
    card: 'bg-gradient-to-br from-sky-50/80 via-white to-blue-50/50 dark:from-sky-950/25 dark:via-slate-900 dark:to-slate-900 border-sky-200/80 dark:border-sky-900/50 hover:border-sky-500 dark:hover:border-sky-400',
    footer: 'bg-sky-50/70 dark:bg-sky-950/35 border-sky-200/70 dark:border-sky-900/45',
    divider: 'border-sky-100 dark:border-sky-900/40',
    iconBox: 'bg-sky-100/85 dark:bg-sky-950/70 border-sky-200/80 dark:border-sky-800/70 group-hover:bg-sky-600',
    iconColor: 'text-sky-700 dark:text-sky-400 group-hover:text-white',
    categoryLabel: 'text-sky-700/85 dark:text-sky-300/90',
  },
  'education-career': {
    card: 'bg-gradient-to-br from-violet-50/75 via-white to-purple-50/45 dark:from-violet-950/25 dark:via-slate-900 dark:to-slate-900 border-violet-200/80 dark:border-violet-900/50 hover:border-violet-500 dark:hover:border-violet-400',
    footer: 'bg-violet-50/70 dark:bg-violet-950/35 border-violet-200/70 dark:border-violet-900/45',
    divider: 'border-violet-100 dark:border-violet-900/40',
    iconBox: 'bg-violet-100/85 dark:bg-violet-950/70 border-violet-200/80 dark:border-violet-800/70 group-hover:bg-violet-600',
    iconColor: 'text-violet-700 dark:text-violet-400 group-hover:text-white',
    categoryLabel: 'text-violet-700/85 dark:text-violet-300/90',
  },
  documentation: {
    card: 'bg-gradient-to-br from-rose-50/70 via-white to-amber-50/40 dark:from-rose-950/25 dark:via-slate-900 dark:to-slate-900 border-rose-200/80 dark:border-rose-900/50 hover:border-rose-500 dark:hover:border-rose-400',
    footer: 'bg-rose-50/65 dark:bg-rose-950/35 border-rose-200/70 dark:border-rose-900/45',
    divider: 'border-rose-100 dark:border-rose-900/40',
    iconBox: 'bg-rose-100/85 dark:bg-rose-950/70 border-rose-200/80 dark:border-rose-800/70 group-hover:bg-rose-600',
    iconColor: 'text-rose-700 dark:text-rose-400 group-hover:text-white',
    categoryLabel: 'text-rose-700/85 dark:text-rose-300/90',
  },
  'digital-products': {
    card: 'bg-gradient-to-br from-teal-50/80 via-white to-emerald-50/45 dark:from-teal-950/25 dark:via-slate-900 dark:to-slate-900 border-teal-200/80 dark:border-teal-900/50 hover:border-teal-500 dark:hover:border-teal-400',
    footer: 'bg-teal-50/70 dark:bg-teal-950/35 border-teal-200/70 dark:border-teal-900/45',
    divider: 'border-teal-100 dark:border-teal-900/40',
    iconBox: 'bg-teal-100/85 dark:bg-teal-950/70 border-teal-200/80 dark:border-teal-800/70 group-hover:bg-teal-600',
    iconColor: 'text-teal-700 dark:text-teal-400 group-hover:text-white',
    categoryLabel: 'text-teal-700/85 dark:text-teal-300/90',
  },
  'digital-technology': {
    card: 'bg-gradient-to-br from-indigo-50/80 via-white to-sky-50/45 dark:from-indigo-950/25 dark:via-slate-900 dark:to-slate-900 border-indigo-200/80 dark:border-indigo-900/50 hover:border-indigo-500 dark:hover:border-indigo-400',
    footer: 'bg-indigo-50/70 dark:bg-indigo-950/35 border-indigo-200/70 dark:border-indigo-900/45',
    divider: 'border-indigo-100 dark:border-indigo-900/40',
    iconBox: 'bg-indigo-100/85 dark:bg-indigo-950/70 border-indigo-200/80 dark:border-indigo-800/70 group-hover:bg-indigo-600',
    iconColor: 'text-indigo-700 dark:text-indigo-400 group-hover:text-white',
    categoryLabel: 'text-indigo-700/85 dark:text-indigo-300/90',
  },
  'b2b-partner': {
    card: 'bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/45 dark:from-blue-950/25 dark:via-slate-900 dark:to-slate-900 border-blue-200/80 dark:border-blue-900/50 hover:border-blue-600 dark:hover:border-blue-400',
    footer: 'bg-blue-50/70 dark:bg-blue-950/35 border-blue-200/70 dark:border-blue-900/45',
    divider: 'border-blue-100 dark:border-blue-900/40',
    iconBox: 'bg-blue-100/85 dark:bg-blue-950/70 border-blue-200/80 dark:border-blue-800/70 group-hover:bg-blue-600',
    iconColor: 'text-blue-700 dark:text-blue-400 group-hover:text-white',
    categoryLabel: 'text-blue-700/85 dark:text-blue-300/90',
  },
  packages: {
    card: 'bg-gradient-to-br from-emerald-50/80 via-white to-amber-50/50 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 border-emerald-200/85 dark:border-emerald-900/55 hover:border-emerald-600 dark:hover:border-emerald-400',
    footer: 'bg-emerald-50/75 dark:bg-emerald-950/40 border-emerald-200/70 dark:border-emerald-900/45',
    divider: 'border-emerald-100 dark:border-emerald-900/40',
    iconBox: 'bg-emerald-100/90 dark:bg-emerald-950/75 border-emerald-200/85 dark:border-emerald-800/70 group-hover:bg-[#138808]',
    iconColor: 'text-[#138808] dark:text-emerald-400 group-hover:text-white',
    categoryLabel: 'text-emerald-700/90 dark:text-emerald-300',
  },
};

export function getServiceCardTheme(category?: string, productType?: string): ServiceCardTheme {
  if (productType === 'compliance_package' || category === 'packages') {
    return SERVICE_THEMES.packages;
  }
  if (productType === 'digital_product' || category === 'digital-products') {
    return SERVICE_THEMES['digital-products'];
  }
  return SERVICE_THEMES[category || 'personal'] || SERVICE_THEMES.personal;
}

export const ROLE_TOOL_COLOR_BLOCKS = [
  {
    card: 'bg-gradient-to-br from-blue-50/80 via-white to-sky-50/50 dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900 border-blue-200/80 dark:border-blue-900/50 hover:border-blue-500',
    iconBox: 'bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white',
    divider: 'border-blue-100 dark:border-blue-900/40',
  },
  {
    card: 'bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 border-emerald-200/80 dark:border-emerald-900/50 hover:border-emerald-500',
    iconBox: 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white',
    divider: 'border-emerald-100 dark:border-emerald-900/40',
  },
  {
    card: 'bg-gradient-to-br from-amber-50/80 via-white to-orange-50/50 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900 border-amber-200/80 dark:border-amber-900/50 hover:border-[#FF671F]',
    iconBox: 'bg-orange-100 dark:bg-orange-950/70 text-[#E55B1B] dark:text-orange-400 group-hover:bg-[#FF671F] group-hover:text-white',
    divider: 'border-amber-100 dark:border-amber-900/40',
  },
  {
    card: 'bg-gradient-to-br from-violet-50/80 via-white to-indigo-50/50 dark:from-violet-950/30 dark:via-slate-900 dark:to-slate-900 border-violet-200/80 dark:border-violet-900/50 hover:border-violet-500',
    iconBox: 'bg-violet-100 dark:bg-violet-950/70 text-violet-700 dark:text-violet-400 group-hover:bg-violet-600 group-hover:text-white',
    divider: 'border-violet-100 dark:border-violet-900/40',
  },
  {
    card: 'bg-gradient-to-br from-teal-50/80 via-white to-cyan-50/50 dark:from-teal-950/30 dark:via-slate-900 dark:to-slate-900 border-teal-200/80 dark:border-teal-900/50 hover:border-teal-500',
    iconBox: 'bg-teal-100 dark:bg-teal-950/70 text-teal-700 dark:text-teal-400 group-hover:bg-teal-600 group-hover:text-white',
    divider: 'border-teal-100 dark:border-teal-900/40',
  },
] as const;
