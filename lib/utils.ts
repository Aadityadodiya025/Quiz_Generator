import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format view count to a readable format (e.g., 1.2M views)
 */
export function formatViewCount(viewCount: string | undefined): string {
  if (!viewCount) return "N/A";
  
  // If viewCount already includes "views", return as is
  if (viewCount.toLowerCase().includes("view")) {
    return viewCount;
  }
  
  // Try to parse the numeric value
  const num = parseInt(viewCount.replace(/[^0-9]/g, ""));
  if (isNaN(num)) return viewCount;
  
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  } else {
    return num.toString();
  }
}

/**
 * Format date to a readable format
 */
export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "N/A";
  
  // If it's already in a formatted state like "March 15, 2023"
  if (/[A-Za-z]+ \d+, \d{4}/.test(dateStr)) {
    return dateStr;
  }
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    return dateStr;
  }
}

/**
 * Format duration to a readable format
 */
export function formatDuration(duration: string | undefined): string {
  if (!duration) return "N/A";
  
  // If it's already in a readable format like "42 minutes 15 seconds"
  if (/\d+\s+\w+/.test(duration)) {
    return duration;
  }
  
  // Try to handle ISO 8601 duration format
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (match) {
    const hours = match[1] ? parseInt(match[1]) : 0;
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const seconds = match[3] ? parseInt(match[3]) : 0;
    
    let result = '';
    if (hours > 0) result += `${hours} hour${hours > 1 ? 's' : ''} `;
    if (minutes > 0 || hours > 0) result += `${minutes} minute${minutes > 1 ? 's' : ''} `;
    if (seconds > 0 || (hours === 0 && minutes === 0)) result += `${seconds} second${seconds > 1 ? 's' : ''}`;
    
    return result.trim();
  }
  
  // Try to parse time formats like "MM:SS" or "HH:MM:SS"
  const timeMatch = duration.match(/^(\d+):(\d+)(?::(\d+))?$/);
  if (timeMatch) {
    const hasHours = timeMatch[3] !== undefined;
    const hours = hasHours ? parseInt(timeMatch[1]) : 0;
    const minutes = hasHours ? parseInt(timeMatch[2]) : parseInt(timeMatch[1]);
    const seconds = hasHours ? parseInt(timeMatch[3]) : parseInt(timeMatch[2]);
    
    let result = '';
    if (hours > 0) result += `${hours} hour${hours > 1 ? 's' : ''} `;
    if (minutes > 0 || hours > 0) result += `${minutes} minute${minutes > 1 ? 's' : ''} `;
    if (seconds > 0 || (hours === 0 && minutes === 0)) result += `${seconds} second${seconds > 1 ? 's' : ''}`;
    
    return result.trim();
  }
  
  return duration;
}
