export function numberToWords(num: number): string {
  try {
    const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    
    const n = Math.round(num);
    if (n === 0) return "Zero Rupees Only";
    
    function convertHundred(val: number): string {
      let res = "";
      if (val >= 100) {
        res += units[Math.floor(val / 100)] + " Hundred ";
        val %= 100;
      }
      if (val >= 20) {
        res += tens[Math.floor(val / 10)] + " ";
        val %= 10;
      }
      if (val > 0) {
        res += units[val] + " ";
      }
      return res.trim();
    }
    
    let words = "";
    const crore = Math.floor(n / 10000000);
    const remainderCrore = n % 10000000;
    
    const lakh = Math.floor(remainderCrore / 100000);
    const remainderLakh = remainderCrore % 100000;
    
    const thousand = Math.floor(remainderLakh / 1000);
    const remainderThousand = remainderLakh % 1000;
    
    if (crore > 0) words += convertHundred(crore) + " Crore ";
    if (lakh > 0) words += convertHundred(lakh) + " Lakh ";
    if (thousand > 0) words += convertHundred(thousand) + " Thousand ";
    if (remainderThousand > 0) words += convertHundred(remainderThousand) + " ";
    
    return words.trim() + " Rupees Only";
  } catch {
    return `${num} Rupees Only`;
  }
}
