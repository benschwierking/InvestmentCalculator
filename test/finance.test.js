import test from 'node:test';
import assert from 'node:assert/strict';
import { amortize, calculateScenario, futureValue, paymentAmount } from '../finance.js';

const base = () => ({
  purchasePrice: 40000000, currentValue: 40000000, startDate: '2026-01-01', downPayment: 8000000,
  loanTermYears: 30, mortgageRate: .065, appreciationRate: .03, holdingYears: 10,
  extraMonthly: 0, extraAnnual: 0, annualExtraMonth: 12, oneTimePayments: [], biweekly: false,
  rent: 300000, otherIncome: 0, propertyTaxes: 480000, insurance: 180000, pmi: 0, hoa: 0,
  management: 24000, maintenance: 30000, vacancy: 15000, legal: 0, utilities: 0, otherExpenses: 0,
  closingCosts: 800000, renovationCosts: 500000, otherAcquisitionCosts: 0,
  federalTaxRate: .24, stateTaxRate: .05, depreciableBasis: 32000000, recoveryYears: 27.5,
  includeSale: true, sellingCostRate: .06, capitalGainsRate: .15, recaptureRate: .25,
  altInitial: 0, altContribution: 0, altReturn: .07, altCompounds: 12, altFeeRate: .0025, altTaxRate: .15
});

test('zero-percent loan amortizes exactly without negative balance', () => {
  const result = amortize({ principal: 120000, annualRate: 0, termMonths: 12, holdingMonths: 12 });
  assert.equal(paymentAmount(120000, 0, 12), 10000);
  assert.equal(result.remainingBalance, 0);
  assert.equal(result.cumulativeInterest, 0);
});

test('extra payments pay loan off early and are capped', () => {
  const result = amortize({ principal: 1000000, annualRate: .05, termMonths: 360, holdingMonths: 360, extraMonthly: 500000 });
  assert.ok(result.payoffMonth < 360);
  assert.equal(result.remainingBalance, 0);
  assert.ok(result.schedule.every(row => row.balance >= 0));
});

test('partial-year, negative appreciation, vacancy and sale before maturity', () => {
  const input = base();
  Object.assign(input, { holdingYears: 1.5, appreciationRate: -.02, vacancy: 200000 });
  const result = calculateScenario(input);
  assert.equal(result.months, 18);
  assert.ok(result.projectedValue < input.currentValue);
  assert.ok(result.mortgage.remainingBalance > 0);
  assert.ok(result.cashFlowAfterDebt < 0);
});

test('zero down payment remains calculable', () => {
  const input = base(); input.downPayment = 0;
  const result = calculateScenario(input);
  assert.equal(result.loan, input.purchasePrice);
  assert.ok(Number.isFinite(result.endingWealth));
});

test('PMI ends after loan reaches 80% LTV', () => {
  const input = base();
  Object.assign(input, { downPayment: 2000000, pmi: 30000, extraMonthly: 150000, holdingYears: 5 });
  const result = calculateScenario(input);
  const pmiMonths = result.monthly.filter(m => m.operating > result.monthly.at(-1).operating).length;
  assert.ok(pmiMonths > 0 && pmiMonths < result.months);
});

test('alternative supports zero recurring contributions', () => {
  const result = futureValue({ initial: 1000000, contribution: 0, annualRate: .06, months: 12 });
  assert.equal(result.contributions, 1000000);
  assert.ok(result.endingBalance > result.contributions);
});

test('comparison matches property shortfalls and extra principal', () => {
  const input = base(); Object.assign(input, { rent: 0, extraMonthly: 10000 });
  const result = calculateScenario(input);
  assert.ok(result.additionalCash > 0);
  assert.equal(result.alternative.contributions, result.initialCash + result.additionalCash);
});
