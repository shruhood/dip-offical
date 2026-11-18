import type { Service } from '../../types';
import { CATALOGUE_CATEGORIES, CATEGORY_SLUG_ALIASES, resolveCategorySlug } from './categories';
import { CAT_A_PERSONAL_SERVICES } from './catA_personal';
import { CAT_B_BUSINESS_SERVICES } from './catB_business';
import { CAT_C_TAX_SERVICES } from './catC_tax';
import { CAT_D_EDUCATION_SERVICES } from './catD_education';
import { CAT_E_DOCUMENTATION_SERVICES } from './catE_documentation';
import { CAT_F_DIGITAL_PRODUCTS } from './catF_digitalProducts';
import { CAT_G_DIGITAL_TECH_SERVICES } from './catG_digitalTech';
import { CAT_H_B2B_PARTNER_SERVICES } from './catH_b2bPartner';
import { SERVICE_PACKAGES } from './packages';
import { INITIAL_COUPONS } from './coupons';
import { TARGET_LOCATIONS } from './locations';

export {
  CATALOGUE_CATEGORIES,
  CATEGORY_SLUG_ALIASES,
  resolveCategorySlug,
  CAT_A_PERSONAL_SERVICES,
  CAT_B_BUSINESS_SERVICES,
  CAT_C_TAX_SERVICES,
  CAT_D_EDUCATION_SERVICES,
  CAT_E_DOCUMENTATION_SERVICES,
  CAT_F_DIGITAL_PRODUCTS,
  CAT_G_DIGITAL_TECH_SERVICES,
  CAT_H_B2B_PARTNER_SERVICES,
  SERVICE_PACKAGES,
  INITIAL_COUPONS,
  TARGET_LOCATIONS,
};

export const CORE_CATALOGUE_ITEMS: Service[] = [
  ...CAT_A_PERSONAL_SERVICES,
  ...CAT_B_BUSINESS_SERVICES,
  ...CAT_C_TAX_SERVICES,
  ...CAT_D_EDUCATION_SERVICES,
  ...CAT_E_DOCUMENTATION_SERVICES,
  ...CAT_F_DIGITAL_PRODUCTS,
  ...CAT_G_DIGITAL_TECH_SERVICES,
  ...CAT_H_B2B_PARTNER_SERVICES,
];

export const COMPLETE_CATALOGUE_ITEMS: Service[] = [
  ...CORE_CATALOGUE_ITEMS,
  ...SERVICE_PACKAGES,
];
