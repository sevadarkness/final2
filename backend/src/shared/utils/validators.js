/**
 * Validation Utilities
 * Common validation functions for data validation
 */

/**
 * Validate email format
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate phone number (E.164 format or Brazilian format)
 */
export function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // E.164 format: +[country][number] (e.g., +5511999999999)
  // Brazilian: 11 digits (e.g., 11999999999) or with country code (5511999999999)
  return (
    /^\+?[1-9]\d{10,14}$/.test(phone) || // E.164
    /^[1-9]{2}9?\d{8}$/.test(cleaned) || // BR without country code
    /^55[1-9]{2}9?\d{8}$/.test(cleaned) // BR with country code
  );
}

/**
 * Validate CPF (Brazilian individual taxpayer ID)
 */
export function isValidCPF(cpf) {
  if (!cpf || typeof cpf !== 'string') return false;
  
  // Remove non-digit characters
  const cleaned = cpf.replace(/\D/g, '');
  
  // CPF must have 11 digits
  if (cleaned.length !== 11) return false;
  
  // Check for known invalid CPFs (all digits the same)
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  // Validate check digits
  let sum = 0;
  let remainder;
  
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleaned.substring(i - 1, i)) * (11 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.substring(9, 10))) return false;
  
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleaned.substring(i - 1, i)) * (12 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.substring(10, 11))) return false;
  
  return true;
}

/**
 * Validate CNPJ (Brazilian company taxpayer ID)
 */
export function isValidCNPJ(cnpj) {
  if (!cnpj || typeof cnpj !== 'string') return false;
  
  // Remove non-digit characters
  const cleaned = cnpj.replace(/\D/g, '');
  
  // CNPJ must have 14 digits
  if (cleaned.length !== 14) return false;
  
  // Check for known invalid CNPJs
  if (/^(\d)\1{13}$/.test(cleaned)) return false;
  
  // Validate check digits
  let length = cleaned.length - 2;
  let numbers = cleaned.substring(0, length);
  const digits = cleaned.substring(length);
  let sum = 0;
  let pos = length - 7;
  
  for (let i = length; i >= 1; i--) {
    sum += numbers.charAt(length - i) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;
  
  length = length + 1;
  numbers = cleaned.substring(0, length);
  sum = 0;
  pos = length - 7;
  
  for (let i = length; i >= 1; i--) {
    sum += numbers.charAt(length - i) * pos--;
    if (pos < 2) pos = 9;
  }
  
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;
  
  return true;
}

/**
 * Validate URL format
 */
export function isValidURL(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate hex color
 */
export function isValidHexColor(color) {
  if (!color || typeof color !== 'string') return false;
  const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexRegex.test(color);
}

/**
 * Validate date string (ISO 8601)
 */
export function isValidDate(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Validate JSON string
 */
export function isValidJSON(str) {
  if (!str || typeof str !== 'string') return false;
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate password strength
 * Requirements: min 8 chars, 1 uppercase, 1 lowercase, 1 number
 */
export function isStrongPassword(password) {
  if (!password || typeof password !== 'string') return false;
  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  return minLength && hasUppercase && hasLowercase && hasNumber;
}

/**
 * Basic string sanitization - removes common HTML elements
 * WARNING: This is NOT sufficient for preventing XSS attacks.
 * For user-generated content that will be displayed as HTML, use a proper
 * HTML sanitization library like DOMPurify or sanitize-html.
 * This function is only for basic cleaning of plain text inputs.
 */
export function sanitizeString(str) {
  if (!str || typeof str !== 'string') return '';
  
  // For plain text inputs, just remove ALL HTML tags and trim
  // This is safe because we're not trying to preserve any HTML
  return str
    .replace(/<[^>]*>/g, '') // Remove ALL HTML tags
    .trim();
}

export default {
  isValidEmail,
  isValidPhone,
  isValidCPF,
  isValidCNPJ,
  isValidURL,
  isValidUUID,
  isValidHexColor,
  isValidDate,
  isValidJSON,
  isStrongPassword,
  sanitizeString,
};
