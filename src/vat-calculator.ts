// ============================================================
// VAT CALCULATOR — auto-recalculate VAT amount and subtotal
// ============================================================

export function wireVatCalculations(): void {
  const totalInput    = document.getElementById('field-total')      as HTMLInputElement;
  const vatRateSelect = document.getElementById('field-vat-rate')   as HTMLSelectElement;
  const vatAmountInput = document.getElementById('field-vat-amount') as HTMLInputElement;
  const subtotalInput = document.getElementById('field-subtotal')   as HTMLInputElement;

  function recalculate(): void {
    const total = parseFloat(totalInput.value);
    const rate  = parseFloat(vatRateSelect.value);
    if (!isNaN(total) && !isNaN(rate) && rate > 0) {
      const vat = Math.round((total - total / (1 + rate)) * 100) / 100;
      const sub = Math.round((total / (1 + rate)) * 100) / 100;
      vatAmountInput.value = vat.toFixed(2);
      subtotalInput.value  = sub.toFixed(2);
    }
  }

  totalInput.addEventListener('change', recalculate);
  vatRateSelect.addEventListener('change', recalculate);
}
