/**
 * Phone Number Utilities
 * Standardizes phone numbers to E.164 format for Telnyx compatibility
 */

/**
 * Standardizes a phone number to E.164 format
 * Converts formats like:
 * - (555) 123-4567 -> +15551234567
 * - 555-123-4567 -> +15551234567
 * - 555.123.4567 -> +15551234567
 * - 5551234567 -> +15551234567
 * - +1 (555) 123-4567 -> +15551234567
 * 
 * @param phoneNumber - The phone number to standardize
 * @param defaultCountryCode - The default country code to use (default: '1' for US/Canada)
 * @returns The standardized phone number in E.164 format (+XXXXXXXXXXX)
 */
export function standardizePhoneNumber(phoneNumber: string, defaultCountryCode: string = '1'): string {
  if (!phoneNumber) return phoneNumber;

  // Remove all non-numeric characters except leading +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // If it starts with +, keep it and remove any internal +
  if (cleaned.startsWith('+')) {
    cleaned = '+' + cleaned.substring(1).replace(/\+/g, '');
  } else {
    // Remove any + that isn't at the start
    cleaned = cleaned.replace(/\+/g, '');
  }
  
  // If number doesn't start with +, add country code
  if (!cleaned.startsWith('+')) {
    // If it starts with the country code without +, just add +
    if (cleaned.startsWith(defaultCountryCode)) {
      cleaned = '+' + cleaned;
    } else {
      // Add country code
      cleaned = '+' + defaultCountryCode + cleaned;
    }
  }
  
  return cleaned;
}

/**
 * Validates if a phone number is in valid E.164 format
 * E.164 format: + followed by 1-15 digits
 * 
 * @param phoneNumber - The phone number to validate
 * @returns true if valid E.164 format, false otherwise
 */
export function isValidE164(phoneNumber: string): boolean {
  if (!phoneNumber) return false;
  
  // E.164: + followed by 1-15 digits
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
}

/**
 * Formats a phone number for display (plain format: 555-123-4567)
 * Converts +15551234567 to 555-123-4567
 * 
 * @param phoneNumber - The phone number in E.164 format
 * @returns The formatted phone number for display
 */
export function formatPhoneForDisplay(phoneNumber: string): string {
  if (!phoneNumber) return phoneNumber;
  
  // Remove + and get just the numbers
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Check if it's a US/Canada number (starts with 1)
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const areaCode = cleaned.substring(1, 4);
    const prefix = cleaned.substring(4, 7);
    const lineNumber = cleaned.substring(7, 11);
    return `${areaCode}-${prefix}-${lineNumber}`;
  }
  
  // For 10 digit numbers, assume US
  if (cleaned.length === 10) {
    const areaCode = cleaned.substring(0, 3);
    const prefix = cleaned.substring(3, 6);
    const lineNumber = cleaned.substring(6, 10);
    return `${areaCode}-${prefix}-${lineNumber}`;
  }
  
  // For other formats, return as-is or with + if it had one
  return phoneNumber.startsWith('+') ? phoneNumber : `+${cleaned}`;
}

/**
 * Batch standardizes an array of phone numbers
 * 
 * @param phoneNumbers - Array of phone numbers to standardize
 * @param defaultCountryCode - The default country code to use
 * @returns Array of standardized phone numbers
 */
export function batchStandardizePhoneNumbers(
  phoneNumbers: string[], 
  defaultCountryCode: string = '1'
): string[] {
  return phoneNumbers.map(num => standardizePhoneNumber(num, defaultCountryCode));
}
