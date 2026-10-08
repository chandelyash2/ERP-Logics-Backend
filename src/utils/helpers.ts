export { numberToWords } from "./numberToWords.js";

export function round2(val: number | string | null | undefined): number {
  if (val === null || val === undefined) return 0;
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return 0;
  return Math.round((num + 1e-9) * 100) / 100;
}

export function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

export function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

export function isBatchExpired(expiryDate: string): boolean {
  if (!expiryDate) return false;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let exp: Date;
    if (expiryDate.length === 7 && expiryDate.includes("-")) {
      // YYYY-MM format: consider expired at end of that month
      const [year, month] = expiryDate.split("-").map(Number);
      exp = new Date(year, month, 0, 23, 59, 59); // Last day of month
    } else {
      exp = new Date(expiryDate);
    }
    
    return exp <= today;
  } catch {
    return false;
  }
}
