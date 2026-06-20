# CODEX.md

## Project Overview

Build a responsive web application called **InvestmentCalculator**. The app helps users calculate the complete return on a real-estate investment and compare it with alternative investments such as stocks, bonds, CDs, and savings accounts.

The primary question the app should answer is:

> What is my true real-estate return, and what is the opportunity cost compared with investing the same money elsewhere?

## Core Requirements

### Real-Estate Inputs

Collect the following information:

- Purchase price and current property value
- Purchase or mortgage start date
- Down payment
- Loan term
- Mortgage interest rate
- Expected annual appreciation rate
- Monthly rental and other property income
- Property taxes
- Homeowners insurance
- PMI
- HOA fees
- Property management fees
- Maintenance and repairs
- Vacancy allowance
- Legal and professional fees
- Utilities paid by the owner
- Other recurring expenses
- Closing costs and initial renovation costs
- Federal and state marginal tax rates
- Depreciable property value or land value
- Expected holding period

Allow expenses to be entered monthly or annually where appropriate.

### Mortgage Calculator

Generate an amortization schedule that calculates:

- Monthly principal and interest payment
- Interest paid during each period
- Principal paid during each period
- Remaining loan balance
- Cumulative interest
- Cumulative principal reduction

Support:

- Standard monthly payments
- Extra monthly payments
- Extra annual payments
- One-time principal payments with payment dates
- Biweekly payments

Apply additional payments directly to principal. Never allow the remaining balance to become negative.

### Return Components

Calculate real-estate returns from four primary sources:

1. **Appreciation**
   - Projected value = starting property value × `(1 + appreciation rate)^years`
   - Appreciation return = projected value − starting property value

2. **Equity Buydown**
   - Equity buydown = original loan balance − projected remaining balance
   - Separate scheduled principal reduction from optional extra payments in the results.

3. **Net Rental Income**
   - Net rental income = total rental and other property income − operating expenses
   - Mortgage principal is not an operating expense.
   - Show cash flow both before and after debt service.

4. **Estimated Tax Benefits**
   - Include deductible mortgage interest, property taxes, insurance, repairs, management fees, legal/professional fees, and other eligible operating expenses.
   - Calculate residential rental depreciation using a configurable depreciable basis and recovery period, defaulting to 27.5 years.
   - Estimated tax benefit = deductible amount × applicable marginal tax rate.
   - Keep tax assumptions editable and label results as estimates.
   - Do not imply that every listed expense is deductible in every situation.
   - Reference IRS Publication 527 and include a tax-professional disclaimer.

### Total Real-Estate Return

Show the following separately:

- Appreciation
- Principal reduction
- Net rental cash flow
- Estimated tax benefit
- Initial cash invested
- Additional cash contributed
- Total projected equity
- Total dollar return
- Total return percentage
- Annualized return
- Cash-on-cash return
- Internal rate of return when dated cash flows are available

Avoid double-counting principal payments, appreciation, sale proceeds, or tax benefits.

Initial cash invested should include the down payment, closing costs, initial renovations, and other acquisition costs.

Provide an optional sale scenario containing:

- Expected sale date
- Selling costs
- Remaining mortgage payoff
- Estimated capital-gains taxes
- Depreciation recapture
- Net sale proceeds

### Alternative Investment Calculator

Let users compare the real-estate scenario against a compound investment.

Inputs:

- Initial investment
- Recurring monthly or annual contribution
- Expected annual return
- Investment period
- Compounding frequency
- Optional taxes and management fees

Calculate:

- Ending balance
- Total contributions
- Investment growth
- Annualized return
- After-tax ending value when tax assumptions are supplied

Default the initial alternative investment to the same amount of cash required by the real-estate scenario. Include real-estate shortfalls or additional contributions as matching contributions to the alternative investment so the comparison uses equivalent cash flows.

### Comparison View

Present both investments side by side using the same holding period and comparable cash contributions.

Show:

- Initial cash required
- Additional contributions
- Ending value
- Total profit
- Annualized return
- Cash flow received
- Estimated tax impact
- Liquidity note
- Difference in ending wealth
- Opportunity cost

Opportunity cost is the difference between the ending wealth produced by the selected alternatives.

## User Experience

Use a practical calculator interface, not a marketing landing page.

Organize the app into these sections:

1. Property
2. Mortgage
3. Income and Expenses
4. Taxes
5. Sale Assumptions
6. Alternative Investment
7. Results

Requirements:

- Recalculate results as inputs change.
- Save scenarios locally.
- Allow users to duplicate and compare scenarios.
- Provide sensible defaults without hiding assumptions.
- Add tooltips for financial terms.
- Format currency and percentages consistently.
- Validate missing, negative, and unrealistic inputs.
- Make the interface fully usable on desktop and mobile.
- Provide tables for annual cash flow and mortgage amortization.
- Provide charts for equity growth, loan balance, cumulative cash flow, and ending-wealth comparison.
- Allow results and assumptions to be exported as CSV or PDF.

## Technical Expectations

- Use the repository’s existing framework and conventions.
- Keep financial calculations in pure, independently testable functions.
- Use decimal-safe calculations and avoid unnecessary floating-point rounding.
- Store rates internally as decimals and money as cents or another precise representation.
- Clearly distinguish monthly, annual, and one-time values.
- Include unit tests for formulas and edge cases.
- Include integration tests covering a complete comparison scenario.
- Do not use external calculator websites at runtime.
- Do not claim that projections are guaranteed.

## Required Edge Cases

Test:

- Zero-percent interest
- Zero down payment
- PMI ending during the loan
- Extra payments paying off the mortgage early
- Partial-year holding periods
- Vacancies and negative cash flow
- Zero or negative appreciation
- A property sold before mortgage maturity
- Alternative investments with zero contributions
- Equivalent-cash-flow comparisons

## Disclaimer

Display this near the results:

> This calculator provides estimates for educational purposes and does not constitute financial, tax, legal, or investment advice. Tax treatment depends on individual circumstances and applicable law. Consult qualified professionals before making investment decisions.
