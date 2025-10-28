import { format, parseISO, isValid } from 'date-fns';

export const safeFormatDate = (dateString: string | undefined, formatString: string): string => {
  if (!dateString) return 'Invalid Date';
  
  try {
    // Try parsing as ISO string first
    let date = parseISO(dateString);
    if (isValid(date)) {
      return format(date, formatString);
    }
    
    // Try parsing as regular date string
    date = new Date(dateString);
    if (isValid(date)) {
      return format(date, formatString);
    }
    
    return 'Invalid Date';
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
};

export const safeParseDate = (dateString: string | undefined): Date | null => {
  if (!dateString) return null;
  
  try {
    // Try parsing as ISO string first
    let date = parseISO(dateString);
    if (isValid(date)) {
      return date;
    }
    
    // Try parsing as regular date string
    date = new Date(dateString);
    if (isValid(date)) {
      return date;
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
};

export const isValidDateString = (dateString: string | undefined): boolean => {
  if (!dateString) return false;
  
  try {
    const date = parseISO(dateString);
    if (isValid(date)) return true;
    
    const date2 = new Date(dateString);
    return isValid(date2);
  } catch (error) {
    return false;
  }
};