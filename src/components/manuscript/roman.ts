// 罗马数字 — 1..3999
const ONES  = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
const TENS  = ['', 'X', 'XX', 'XXX', 'XL', 'L', 'LX', 'LXX', 'LXXX', 'XC'];
const HUND  = ['', 'C', 'CC', 'CCC', 'CD', 'D', 'DC', 'DCC', 'DCCC', 'CM'];
const THOUS = ['', 'M', 'MM', 'MMM'];

export const roman = (n: number): string => {
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 4000) return String(n);
  return (
    THOUS[Math.floor(n / 1000)] +
    HUND [Math.floor((n % 1000) / 100)] +
    TENS [Math.floor((n % 100)  / 10)] +
    ONES [n % 10]
  );
};

export default roman;
