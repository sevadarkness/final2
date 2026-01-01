/**
 * Formatting Utilities
 * Common formatting functions for data display
 */

/**
 * Format phone number to E.164 format
 */
export function formatPhone(phone, countryCode = '55') {
  if (!phone) return '';
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // If already has country code, return with +
  if (cleaned.startsWith(countryCode)) {
    return `+${cleaned}`;
  }
  
  // Add country code
  return `+${countryCode}${cleaned}`;
}

/**
 * Format phone number for display (Brazilian format)
 */
export function formatPhoneDisplay(phone) {
  if (!phone) return '';
  
  const cleaned = phone.replace(/\D/g, '');
  
  // Remove country code if present
  let number = cleaned;
  if (cleaned.startsWith('55')) {
    number = cleaned.substring(2);
  }
  
  // Format: (11) 99999-9999
  if (number.length === 11) {
    return `(${number.substring(0, 2)}) ${number.substring(2, 7)}-${number.substring(7)}`;
  }
  
  // Format: (11) 9999-9999
  if (number.length === 10) {
    return `(${number.substring(0, 2)}) ${number.substring(2, 6)}-${number.substring(6)}`;
  }
  
  return phone;
}

/**
 * Format CPF for display
 */
export function formatCPF(cpf) {
  if (!cpf) return '';
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return cpf;
  return `${cleaned.substring(0, 3)}.${cleaned.substring(3, 6)}.${cleaned.substring(6, 9)}-${cleaned.substring(9)}`;
}

/**
 * Format CNPJ for display
 */
export function formatCNPJ(cnpj) {
  if (!cnpj) return '';
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return cnpj;
  return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 5)}.${cleaned.substring(5, 8)}/${cleaned.substring(8, 12)}-${cleaned.substring(12)}`;
}

/**
 * Format currency (BRL)
 */
export function formatCurrency(value, currency = 'BRL') {
  if (value === null || value === undefined) return '';
  
  const numberValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numberValue)) return '';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numberValue);
}

/**
 * Format number with thousands separator
 */
export function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined) return '';
  
  const numberValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numberValue)) return '';
  
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(numberValue);
}

/**
 * Format date for display
 */
export function formatDate(date, format = 'short') {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return '';
  
  const options = {
    short: { day: '2-digit', month: '2-digit', year: 'numeric' },
    long: { day: '2-digit', month: 'long', year: 'numeric' },
    full: { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' },
    time: { hour: '2-digit', minute: '2-digit' },
    datetime: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
  };
  
  return new Intl.DateTimeFormat('pt-BR', options[format] || options.short).format(dateObj);
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date) {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now - dateObj;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return 'agora';
  if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'} atrás`;
  if (diffHour < 24) return `${diffHour} ${diffHour === 1 ? 'hora' : 'horas'} atrás`;
  if (diffDay < 30) return `${diffDay} ${diffDay === 1 ? 'dia' : 'dias'} atrás`;
  
  return formatDate(dateObj);
}

/**
 * Create slug from string
 */
export function slugify(text) {
  if (!text) return '';
  
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/--+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+/, '') // Remove leading hyphens
    .replace(/-+$/, ''); // Remove trailing hyphens
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text, maxLength = 100, suffix = '...') {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitalize first letter
 */
export function capitalize(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Format file size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format percentage
 */
export function formatPercentage(value, decimals = 1) {
  if (value === null || value === undefined) return '';
  const numberValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numberValue)) return '';
  return `${numberValue.toFixed(decimals)}%`;
}

export default {
  formatPhone,
  formatPhoneDisplay,
  formatCPF,
  formatCNPJ,
  formatCurrency,
  formatNumber,
  formatDate,
  formatRelativeTime,
  slugify,
  truncate,
  capitalize,
  formatFileSize,
  formatPercentage,
};
