const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const cents = value => Math.round((Number(value) || 0) * 100);
export const dollars = value => (Number(value) || 0) / 100;
export const roundCents = value => Math.round(value);

export function paymentAmount(principal, annualRate, periods) {
  if (principal <= 0 || periods <= 0) return 0;
  const rate = annualRate / 12;
  if (rate === 0) return roundCents(principal / periods);
  return roundCents(principal * rate / (1 - (1 + rate) ** -periods));
}

export function amortize({
  principal, annualRate, termMonths, startDate = '2026-01-01', holdingMonths = termMonths,
  extraMonthly = 0, extraAnnual = 0, annualExtraMonth = 12, oneTimePayments = [], biweekly = false
}) {
  principal = Math.max(0, roundCents(principal));
  const balanceStart = principal;
  const standardPayment = paymentAmount(principal, annualRate, termMonths);
  const schedule = [];
  let balance = principal;
  let cumulativeInterest = 0;
  let cumulativeScheduledPrincipal = 0;
  let cumulativeExtraPrincipal = 0;
  const maxMonths = Math.min(Math.ceil(holdingMonths), termMonths);
  const start = new Date(`${startDate}T12:00:00`);

  for (let month = 1; month <= maxMonths && balance > 0; month++) {
    const date = new Date(start);
    date.setMonth(date.getMonth() + month - 1);
    const interest = roundCents(balance * annualRate / 12);
    const scheduledPrincipal = Math.min(balance, Math.max(0, standardPayment - interest));
    let requestedExtra = extraMonthly;
    if (month % 12 === clamp(annualExtraMonth, 1, 12) % 12) requestedExtra += extraAnnual;
    if (biweekly) requestedExtra += roundCents(standardPayment / 12); // 13th payment spread over the year
    const periodKey = date.toISOString().slice(0, 7);
    requestedExtra += oneTimePayments
      .filter(p => String(p.date || '').slice(0, 7) === periodKey)
      .reduce((sum, p) => sum + Math.max(0, roundCents(p.amount)), 0);
    const extraPrincipal = Math.min(balance - scheduledPrincipal, Math.max(0, requestedExtra));
    const totalPrincipal = scheduledPrincipal + extraPrincipal;
    const payment = interest + totalPrincipal;
    balance = Math.max(0, balance - totalPrincipal);
    cumulativeInterest += interest;
    cumulativeScheduledPrincipal += scheduledPrincipal;
    cumulativeExtraPrincipal += extraPrincipal;
    schedule.push({
      month, date: date.toISOString().slice(0, 10), payment, interest,
      scheduledPrincipal, extraPrincipal, totalPrincipal, balance,
      cumulativeInterest, cumulativeScheduledPrincipal, cumulativeExtraPrincipal
    });
  }
  return {
    standardPayment, schedule, originalBalance: balanceStart, remainingBalance: balance,
    cumulativeInterest, scheduledPrincipal: cumulativeScheduledPrincipal,
    extraPrincipal: cumulativeExtraPrincipal, totalPrincipal: cumulativeScheduledPrincipal + cumulativeExtraPrincipal,
    payoffMonth: balance === 0 ? schedule.length : null
  };
}

export function futureValue({ initial, contribution = 0, annualRate = 0, months, compoundsPerYear = 12, annualFeeRate = 0, taxRate = 0, matchingContributions = [] }) {
  let balance = Math.max(0, roundCents(initial));
  let contributions = balance;
  const netRate = annualRate - annualFeeRate;
  const monthlyRate = compoundsPerYear > 0 ? (1 + netRate / compoundsPerYear) ** (compoundsPerYear / 12) - 1 : 0;
  const history = [{ month: 0, balance, contributions }];
  for (let month = 1; month <= Math.ceil(months); month++) {
    balance = roundCents(balance * (1 + monthlyRate));
    const added = Math.max(0, roundCents(contribution)) + Math.max(0, roundCents(matchingContributions[month - 1] || 0));
    balance += added;
    contributions += added;
    history.push({ month, balance, contributions });
  }
  const growth = balance - contributions;
  const afterTaxEnding = balance - Math.max(0, roundCents(growth * taxRate));
  return { endingBalance: balance, contributions, growth, afterTaxEnding, history };
}

export function annualizedReturn(start, end, years) {
  if (start <= 0 || end < 0 || years <= 0) return null;
  return (end / start) ** (1 / years) - 1;
}

export function calculateIrr(cashFlows) {
  if (!cashFlows.some(v => v < 0) || !cashFlows.some(v => v > 0)) return null;
  const npv = rate => cashFlows.reduce((sum, flow, i) => sum + flow / (1 + rate) ** i, 0);
  let low = -0.9999, high = 10;
  if (npv(low) * npv(high) > 0) return null;
  for (let i = 0; i < 180; i++) {
    const mid = (low + high) / 2;
    if (npv(low) * npv(mid) <= 0) high = mid; else low = mid;
  }
  return (1 + (low + high) / 2) ** 12 - 1;
}

const annualToMonthly = value => roundCents(value / 12);

export function calculateScenario(input) {
  const months = Math.max(1, Math.round(input.holdingYears * 12));
  const years = months / 12;
  const purchasePrice = input.purchasePrice;
  const startingValue = input.currentValue || purchasePrice;
  const initialCash = input.downPayment + input.closingCosts + input.renovationCosts + (input.otherAcquisitionCosts || 0);
  const loan = Math.max(0, purchasePrice - input.downPayment);
  const mortgage = amortize({
    principal: loan, annualRate: input.mortgageRate, termMonths: input.loanTermYears * 12,
    startDate: input.startDate, holdingMonths: months, extraMonthly: input.extraMonthly,
    extraAnnual: input.extraAnnual, annualExtraMonth: input.annualExtraMonth,
    oneTimePayments: input.oneTimePayments || [], biweekly: input.biweekly
  });
  const projectedValue = roundCents(startingValue * (1 + input.appreciationRate) ** years);
  const appreciation = projectedValue - startingValue;
  const combinedTaxRate = clamp(input.federalTaxRate + input.stateTaxRate, 0, 1);
  const depreciationAnnual = input.depreciableBasis > 0 && input.recoveryYears > 0 ? roundCents(input.depreciableBasis / input.recoveryYears) : 0;
  const monthlyIncome = input.rent + input.otherIncome;
  const monthlyFixedOperating = annualToMonthly(input.propertyTaxes) + annualToMonthly(input.insurance) + input.pmi + input.hoa +
    input.management + input.maintenance + input.vacancy + input.legal + input.utilities + input.otherExpenses;
  const cashFlows = [-initialCash];
  const monthly = [];
  let totalIncome = 0, operatingExpenses = 0, debtService = 0, cashFlowAfterDebt = 0, taxBenefit = 0, additionalCash = 0, cashFlowReceived = 0;
  let deductibleExpenses = 0;
  for (let month = 1; month <= months; month++) {
    const loanRow = mortgage.schedule[month - 1];
    const pmiActive = loanRow && purchasePrice > 0 && loanRow.balance / purchasePrice > 0.8;
    const pmi = pmiActive ? input.pmi : 0;
    const operating = monthlyFixedOperating - input.pmi + pmi;
    const debt = loanRow?.payment || 0;
    const beforeDebt = monthlyIncome - operating;
    const afterDebt = beforeDebt - debt;
    const eligibleOperating = annualToMonthly(input.propertyTaxes) + annualToMonthly(input.insurance) + input.management + input.maintenance + input.legal + input.otherExpenses;
    const deductible = (loanRow?.interest || 0) + eligibleOperating + annualToMonthly(depreciationAnnual);
    const benefit = roundCents(deductible * combinedTaxRate);
    const afterTaxCash = afterDebt + benefit;
    const contribution = Math.max(0, -afterTaxCash);
    const distribution = Math.max(0, afterTaxCash);
    totalIncome += monthlyIncome; operatingExpenses += operating; debtService += debt; cashFlowAfterDebt += afterDebt;
    taxBenefit += benefit; additionalCash += contribution; cashFlowReceived += distribution; deductibleExpenses += deductible;
    cashFlows.push(afterDebt + benefit);
    monthly.push({ month, income: monthlyIncome, operating, beforeDebt, debt, afterDebt, taxBenefit: benefit, afterTaxCash, contribution, distribution, propertyValue: roundCents(startingValue * (1 + input.appreciationRate) ** (month / 12)), balance: loanRow?.balance || 0 });
  }
  const depreciationTaken = Math.min(roundCents(depreciationAnnual * years), input.depreciableBasis);
  const sellingCosts = input.includeSale ? roundCents(projectedValue * input.sellingCostRate) : 0;
  const taxableGain = Math.max(0, projectedValue - purchasePrice - sellingCosts);
  const capitalGainsTax = input.includeSale ? roundCents(taxableGain * input.capitalGainsRate) : 0;
  const recaptureTax = input.includeSale ? roundCents(depreciationTaken * input.recaptureRate) : 0;
  const equity = projectedValue - mortgage.remainingBalance;
  const netSaleProceeds = input.includeSale ? Math.max(0, projectedValue - sellingCosts - mortgage.remainingBalance - capitalGainsTax - recaptureTax) : equity;
  const endingWealth = netSaleProceeds + cashFlowReceived;
  cashFlows[cashFlows.length - 1] += netSaleProceeds;
  const totalContributed = initialCash + additionalCash;
  const totalReturn = endingWealth - totalContributed;
  const altMatching = monthly.map(m => m.contribution);
  const alternative = futureValue({
    initial: input.altInitial > 0 ? input.altInitial : initialCash,
    contribution: input.altContribution, annualRate: input.altReturn, months,
    compoundsPerYear: input.altCompounds, annualFeeRate: input.altFeeRate,
    taxRate: input.altTaxRate, matchingContributions: altMatching
  });
  const annual = [];
  for (let start = 0; start < months; start += 12) {
    const rows = monthly.slice(start, start + 12);
    const last = rows[rows.length - 1];
    annual.push({ year: Math.floor(start / 12) + 1, income: rows.reduce((s, r) => s + r.income, 0), operating: rows.reduce((s, r) => s + r.operating, 0), debt: rows.reduce((s, r) => s + r.debt, 0), cashFlow: rows.reduce((s, r) => s + r.afterDebt, 0), taxBenefit: rows.reduce((s, r) => s + r.taxBenefit, 0), propertyValue: last.propertyValue, balance: last.balance, equity: last.propertyValue - last.balance });
  }
  return {
    months, years, initialCash, loan, projectedValue, appreciation, mortgage, totalIncome,
    operatingExpenses, cashFlowBeforeDebt: totalIncome - operatingExpenses, debtService, cashFlowAfterDebt,
    taxBenefit, deductibleExpenses, depreciationAnnual, depreciationTaken, additionalCash, totalContributed,
    equity, sellingCosts, capitalGainsTax, recaptureTax, netSaleProceeds, cashFlowReceived, endingWealth, totalReturn,
    totalReturnRate: totalContributed ? totalReturn / totalContributed : null,
    annualized: annualizedReturn(totalContributed, endingWealth, years),
    cashOnCash: initialCash ? (cashFlowAfterDebt / years) / initialCash : null,
    irr: calculateIrr(cashFlows), alternative, opportunityCost: endingWealth - alternative.afterTaxEnding,
    annual, monthly, cashFlows
  };
}
