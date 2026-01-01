/**
 * Cryptography Utilities
 * Encryption, hashing, and token generation utilities
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Generate a secure random token
 */
export function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a secure API key
 */
export function generateApiKey(prefix = 'wh') {
  const random = crypto.randomBytes(32).toString('hex');
  return `${prefix}_${random}`;
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password, rounds = 12) {
  return bcrypt.hash(password, rounds);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate HMAC signature
 */
export function generateHMAC(data, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(typeof data === 'string' ? data : JSON.stringify(data))
    .digest('hex');
}

/**
 * Verify HMAC signature
 */
export function verifyHMAC(data, signature, secret) {
  const expectedSignature = generateHMAC(data, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encrypt(data, key) {
  if (!key) throw new Error('Encryption key is required');
  
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  
  // Generate salt and derive key
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');
  
  // Generate IV
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Encrypt
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final()
  ]);
  
  // Get auth tag
  const tag = cipher.getAuthTag();
  
  // Combine: salt + iv + tag + encrypted
  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decrypt(encryptedData, key) {
  if (!key) throw new Error('Decryption key is required');
  
  const buffer = Buffer.from(encryptedData, 'base64');
  
  // Extract components
  const salt = buffer.slice(0, SALT_LENGTH);
  const iv = buffer.slice(SALT_LENGTH, TAG_POSITION);
  const tag = buffer.slice(TAG_POSITION, ENCRYPTED_POSITION);
  const encrypted = buffer.slice(ENCRYPTED_POSITION);
  
  // Derive key
  const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');
  
  // Decrypt
  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(tag);
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
  
  return decrypted.toString('utf8');
}

/**
 * Hash data using SHA-256
 */
export function hash(data) {
  return crypto
    .createHash('sha256')
    .update(typeof data === 'string' ? data : JSON.stringify(data))
    .digest('hex');
}

/**
 * Generate a UUID v4
 */
export function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Generate a numeric code (for OTP, etc.)
 */
export function generateNumericCode(length = 6) {
  const max = Math.pow(10, length) - 1;
  const min = Math.pow(10, length - 1);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Mask sensitive data (PII)
 */
export function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  const maskedLocal = local.length > 2 
    ? `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}`
    : local;
  return `${maskedLocal}@${domain}`;
}

/**
 * Mask phone number
 */
export function maskPhone(phone) {
  if (!phone) return phone;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 4) return phone;
  return `${'*'.repeat(cleaned.length - 4)}${cleaned.slice(-4)}`;
}

/**
 * Mask credit card number
 */
export function maskCreditCard(cardNumber) {
  if (!cardNumber) return cardNumber;
  const cleaned = cardNumber.replace(/\D/g, '');
  if (cleaned.length < 4) return cardNumber;
  return `${'*'.repeat(cleaned.length - 4)}${cleaned.slice(-4)}`;
}

/**
 * Generate a secure session ID
 */
export function generateSessionId() {
  return `${Date.now()}-${generateToken(24)}`;
}

/**
 * Create a checksum for data integrity
 */
export function createChecksum(data) {
  return crypto
    .createHash('md5')
    .update(typeof data === 'string' ? data : JSON.stringify(data))
    .digest('hex');
}

export default {
  generateToken,
  generateApiKey,
  hashPassword,
  verifyPassword,
  generateHMAC,
  verifyHMAC,
  encrypt,
  decrypt,
  hash,
  generateUUID,
  generateNumericCode,
  maskEmail,
  maskPhone,
  maskCreditCard,
  generateSessionId,
  createChecksum,
};
