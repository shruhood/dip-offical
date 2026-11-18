import { FieldCondition, ServiceFormField } from '../types';

/**
 * Evaluates a declarative field condition safely without dynamic JS execution.
 */
export function evaluateCondition(
  condition: FieldCondition | undefined,
  formData: Record<string, any>
): boolean {
  if (!condition || !condition.fieldId) return true;
  const actual = formData[condition.fieldId];

  switch (condition.operator) {
    case 'equals':
      return String(actual ?? '') === String(condition.value ?? '');
    case 'not_equals':
      return String(actual ?? '') !== String(condition.value ?? '');
    case 'contains':
      if (Array.isArray(actual)) {
        return actual.map(String).includes(String(condition.value ?? ''));
      }
      return String(actual ?? '').toLowerCase().includes(String(condition.value ?? '').toLowerCase());
    case 'in':
      if (Array.isArray(condition.value)) {
        return condition.value.map(String).includes(String(actual ?? ''));
      }
      return false;
    case 'is_truthy':
      return Boolean(actual);
    default:
      return true;
  }
}

export function isFieldVisible(
  field: ServiceFormField,
  formData: Record<string, any>
): boolean {
  return evaluateCondition(field.showIf, formData);
}

export interface FormValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates submission payload strictly against a versioned JSON schema.
 * Runs identically in browser wizard and server-side Worker / Express API routes.
 */
export function validateFormSubmission(
  fields: ServiceFormField[],
  formData: Record<string, any>,
  lang: 'en' | 'hi' = 'en'
): FormValidationResult {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    // Non-input structural blocks do not require user values
    if (field.type === 'heading' || field.type === 'info') {
      continue;
    }

    // Hidden conditional fields are exempt from required/regex checks
    if (!isFieldVisible(field, formData)) {
      continue;
    }

    const label = lang === 'hi' && field.labelHi ? field.labelHi : field.label;
    const val = formData[field.id];

    const isEmpty =
      val === undefined ||
      val === null ||
      val === '' ||
      (Array.isArray(val) && val.length === 0) ||
      (field.type === 'checkbox' && field.required && val !== true) ||
      (field.type === 'consent' && field.required && val !== true);

    if (field.required && isEmpty) {
      errors[field.id] = field.customError || `${label} is required`;
      continue;
    }

    if (isEmpty) continue;

    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val))) {
      errors[field.id] = field.customError || `Please enter a valid email address for ${label}`;
      continue;
    }

    if (field.type === 'tel') {
      const digits = String(val).replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 13) {
        errors[field.id] = field.customError || `Please enter a valid 10-digit mobile number for ${label}`;
        continue;
      }
    }

    if (field.type === 'address' && typeof val === 'object') {
      if (field.required && (!val.line1 || !val.city || !val.state || !/^\d{6}$/.test(String(val.pincode || '')))) {
        errors[field.id] = field.customError || `Please complete full address and valid 6-digit PIN code for ${label}`;
        continue;
      }
    }

    if (field.type === 'repeater' && Array.isArray(val) && field.subFields?.length) {
      for (let i = 0; i < val.length; i++) {
        const row = val[i] || {};
        for (const sf of field.subFields) {
          if (sf.required && (row[sf.id] === undefined || row[sf.id] === '')) {
            errors[field.id] = `${label} (Entry #${i + 1}): ${sf.label} is required`;
            break;
          }
        }
        if (errors[field.id]) break;
      }
    }

    if (field.validationRegex && typeof val === 'string') {
      try {
        const regex = new RegExp(field.validationRegex);
        if (!regex.test(val)) {
          errors[field.id] = field.customError || `Invalid format for ${label}`;
        }
      } catch {
        // Ignore malformed admin regex safely without throwing
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
