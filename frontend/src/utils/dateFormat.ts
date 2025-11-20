// Utility function to format dates as MM/DD/YYYY
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  // If date is already a string in YYYY-MM-DD format, parse it directly without timezone conversion
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}/)) {
    const parts = date.split('-');
    const year = parts[0];
    const month = parts[1];
    const day = parts[2].substring(0, 2); // Take only first 2 chars in case there's time component
    return `${month}/${day}/${year}`;
  }
  
  // Fallback for Date objects
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${month}/${day}/${year}`;
}

// Utility function to format dates for filenames (YYYY-MM-DD)
export function formatDateForFilename(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}
