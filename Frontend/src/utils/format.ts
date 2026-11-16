const wholeRupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const exactRupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactCount = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export const formatPrice = (amount: number): string => {
  const value = Math.round((Number(amount) || 0) * 100) / 100;
  return Number.isInteger(value) ? wholeRupees.format(value) : exactRupees.format(value);
};

export const formatCount = (count: number): string => compactCount.format(Math.max(0, Number(count) || 0));
