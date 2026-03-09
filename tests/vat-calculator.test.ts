import { describe, it, expect, beforeEach } from 'vitest'
import { wireVatCalculations } from '../src/vat-calculator'

function setupDOM(): void {
  document.body.innerHTML = `
    <input id="field-total" type="number" />
    <select id="field-vat-rate">
      <option value="0">0%</option>
      <option value="0.05">5%</option>
      <option value="0.20">20%</option>
    </select>
    <input id="field-vat-amount" type="number" />
    <input id="field-subtotal" type="number" />
  `
}

function getFields() {
  return {
    total:     document.getElementById('field-total')      as HTMLInputElement,
    vatRate:   document.getElementById('field-vat-rate')   as HTMLSelectElement,
    vatAmount: document.getElementById('field-vat-amount') as HTMLInputElement,
    subtotal:  document.getElementById('field-subtotal')   as HTMLInputElement,
  }
}

describe('wireVatCalculations', () => {
  beforeEach(() => {
    setupDOM()
    wireVatCalculations()
  })

  it('calculates VAT and subtotal at 20% rate', () => {
    const { total, vatRate, vatAmount, subtotal } = getFields()
    total.value = '120'
    vatRate.value = '0.20'
    vatRate.dispatchEvent(new Event('change'))
    expect(vatAmount.value).toBe('20.00')
    expect(subtotal.value).toBe('100.00')
  })

  it('calculates VAT and subtotal at 5% rate', () => {
    const { total, vatRate, vatAmount, subtotal } = getFields()
    total.value = '105'
    vatRate.value = '0.05'
    vatRate.dispatchEvent(new Event('change'))
    expect(vatAmount.value).toBe('5.00')
    expect(subtotal.value).toBe('100.00')
  })

  it('does not recalculate when rate is 0', () => {
    const { total, vatRate, vatAmount, subtotal } = getFields()
    total.value = '100'
    vatRate.value = '0'
    vatRate.dispatchEvent(new Event('change'))
    expect(vatAmount.value).toBe('')
    expect(subtotal.value).toBe('')
  })

  it('does not recalculate when total is not a number', () => {
    const { total, vatRate, vatAmount, subtotal } = getFields()
    total.value = 'abc'
    vatRate.value = '0.20'
    vatRate.dispatchEvent(new Event('change'))
    expect(vatAmount.value).toBe('')
    expect(subtotal.value).toBe('')
  })

  it('recalculates when total changes with rate already set', () => {
    const { total, vatRate, vatAmount, subtotal } = getFields()
    vatRate.value = '0.20'
    total.value = '120'
    total.dispatchEvent(new Event('change'))
    expect(vatAmount.value).toBe('20.00')
    expect(subtotal.value).toBe('100.00')
  })

  it('recalculates when vatRateSelect changes after total is set', () => {
    const { total, vatRate, vatAmount, subtotal } = getFields()
    total.value = '105'
    vatRate.value = '0.20'
    vatRate.dispatchEvent(new Event('change'))
    expect(vatAmount.value).toBe('17.50')
    expect(subtotal.value).toBe('87.50')

    vatRate.value = '0.05'
    vatRate.dispatchEvent(new Event('change'))
    expect(vatAmount.value).toBe('5.00')
    expect(subtotal.value).toBe('100.00')
  })

  it('rounds correctly for total=10 at 20% rate', () => {
    const { total, vatRate, vatAmount, subtotal } = getFields()
    total.value = '10'
    vatRate.value = '0.20'
    total.dispatchEvent(new Event('change'))
    expect(vatAmount.value).toBe('1.67')
    expect(subtotal.value).toBe('8.33')
  })
})
