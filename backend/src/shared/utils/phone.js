/**
 * Phone Utilities
 * Phone number parsing, normalization, and WhatsApp ID conversion
 */

/**
 * Normalize phone number to E.164 format
 * Removes all formatting and ensures proper format
 */
export function normalizePhone(phone, defaultCountryCode = '55') {
  if (!phone) return null;
  
  // Convert to string and remove all non-digit characters
  let cleaned = String(phone).replace(/\D/g, '');
  
  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');
  
  // If starts with country code, ensure it has +
  if (cleaned.length > 11 && !cleaned.startsWith('+')) {
    return `+${cleaned}`;
  }
  
  // If doesn't have country code, add default
  if (cleaned.length <= 11) {
    return `+${defaultCountryCode}${cleaned}`;
  }
  
  return `+${cleaned}`;
}

/**
 * Parse phone number into components
 */
export function parsePhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  
  const cleaned = normalized.replace(/\D/g, '');
  
  // Assuming Brazilian format: +55 (11) 99999-9999
  if (cleaned.startsWith('55') && cleaned.length === 13) {
    return {
      countryCode: '55',
      areaCode: cleaned.substring(2, 4),
      number: cleaned.substring(4),
      full: normalized,
      e164: normalized,
      whatsappId: `${cleaned}@c.us`,
    };
  }
  
  // Generic international format
  return {
    countryCode: cleaned.substring(0, cleaned.length - 10),
    areaCode: null,
    number: cleaned.substring(cleaned.length - 10),
    full: normalized,
    e164: normalized,
    whatsappId: `${cleaned}@c.us`,
  };
}

/**
 * Convert phone number to WhatsApp ID format
 * Format: [country][area][number]@c.us
 */
export function toWhatsAppId(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  
  const cleaned = normalized.replace(/\D/g, '');
  return `${cleaned}@c.us`;
}

/**
 * Extract phone number from WhatsApp ID
 */
export function fromWhatsAppId(whatsappId) {
  if (!whatsappId) return null;
  
  // Remove @c.us or @s.whatsapp.net suffix
  const cleaned = whatsappId.replace(/@(c\.us|s\.whatsapp\.net)$/, '');
  return `+${cleaned}`;
}

/**
 * Format phone for display (Brazilian format)
 */
export function formatPhoneForDisplay(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return phone;
  
  const cleaned = normalized.replace(/\D/g, '');
  
  // Brazilian format
  if (cleaned.startsWith('55') && cleaned.length === 13) {
    const areaCode = cleaned.substring(2, 4);
    const firstPart = cleaned.substring(4, 9);
    const secondPart = cleaned.substring(9);
    return `+55 (${areaCode}) ${firstPart}-${secondPart}`;
  }
  
  // Generic format
  return normalized;
}

/**
 * Validate if phone number is valid WhatsApp number
 */
export function isValidWhatsAppNumber(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  
  const cleaned = normalized.replace(/\D/g, '');
  
  // Must have at least 10 digits (without country code)
  // and at most 15 digits total (E.164 limit)
  return cleaned.length >= 10 && cleaned.length <= 15;
}

/**
 * Check if two phone numbers are the same
 */
export function arePhoneNumbersEqual(phone1, phone2) {
  const normalized1 = normalizePhone(phone1);
  const normalized2 = normalizePhone(phone2);
  
  if (!normalized1 || !normalized2) return false;
  
  return normalized1 === normalized2;
}

/**
 * Get country code from phone number
 */
export function getCountryCode(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  
  const cleaned = normalized.replace(/\D/g, '');
  
  // Brazilian
  if (cleaned.startsWith('55')) return '55';
  
  // US/Canada
  if (cleaned.startsWith('1') && cleaned.length === 11) return '1';
  
  // Try to extract first 1-3 digits as country code
  for (let i = 1; i <= 3; i++) {
    const code = cleaned.substring(0, i);
    if (code.length > 0) return code;
  }
  
  return null;
}

/**
 * Remove country code from phone number
 */
export function removeCountryCode(phone, countryCode = '55') {
  const normalized = normalizePhone(phone);
  if (!normalized) return phone;
  
  const cleaned = normalized.replace(/\D/g, '');
  
  if (cleaned.startsWith(countryCode)) {
    return cleaned.substring(countryCode.length);
  }
  
  return cleaned;
}

/**
 * Detect if number is mobile or landline (Brazilian)
 */
export function isMobileNumber(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  
  const cleaned = normalized.replace(/\D/g, '');
  
  // Brazilian mobile numbers have 9 as the third digit after area code
  if (cleaned.startsWith('55') && cleaned.length === 13) {
    return cleaned.charAt(4) === '9';
  }
  
  return false;
}

/**
 * Generate variations of a phone number for duplicate detection
 */
export function generatePhoneVariations(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];
  
  const cleaned = normalized.replace(/\D/g, '');
  const variations = [normalized];
  
  // Add variation without country code
  if (cleaned.length > 11) {
    const withoutCountry = cleaned.substring(cleaned.length - 11);
    variations.push(withoutCountry);
    variations.push(`+${withoutCountry}`);
  }
  
  // Add WhatsApp ID format
  variations.push(toWhatsAppId(phone));
  
  return [...new Set(variations)]; // Remove duplicates
}

export default {
  normalizePhone,
  parsePhone,
  toWhatsAppId,
  fromWhatsAppId,
  formatPhoneForDisplay,
  isValidWhatsAppNumber,
  arePhoneNumbersEqual,
  getCountryCode,
  removeCountryCode,
  isMobileNumber,
  generatePhoneVariations,
};
