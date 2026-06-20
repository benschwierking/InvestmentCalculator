import { calculateScenario, cents, dollars } from './finance.js';

const $ = id => document.getElementById(id);
const moneyIds = ['purchasePrice','currentValue','downPayment','extraMonthly','extraAnnual','rent','otherIncome','propertyTaxes','insurance','pmi','hoa','management','maintenance','vacancy','legal','utilities','otherExpenses','closingCosts','renovationCosts','otherAcquisitionCosts','depreciableBasis','altInitial','altContribution'];
const rateIds = ['mortgageRate','appreciationRate','federalTaxRate','stateTaxRate','sellingCostRate','capitalGainsRate','recaptureRate','altReturn','altFeeRate','altTaxRate'];
const numericIds = [...moneyIds,...rateIds,'holdingYears','loanTermYears','annualExtraMonth','recoveryYears','altCompounds'];
const fmt = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const fmtMoney = v => fmt.format(dollars(v));
const fmtPct = v => v == null || !Number.isFinite(v) ? '—' : `${(v*100).toFixed(1)}%`;
const signedMoney = v => `${v >= 0 ? '+' : '−'}${fmtMoney(Math.abs(v))}`;
let oneTimePayments = [];
let latest = null;
let saveTimer;

function readInput() {
  const raw = Object.fromEntries(numericIds.map(id => [id, Number($(id).value) || 0]));
  const input = {};
  moneyIds.forEach(id => input[id] = cents(raw[id]));
  rateIds.forEach(id => input[id] = raw[id] / 100);
  ['holdingYears','loanTermYears','annualExtraMonth','recoveryYears','altCompounds'].forEach(id => input[id] = raw[id]);
  input.startDate = $('startDate').value || new Date().toISOString().slice(0,10);
  input.biweekly = $('biweekly').checked;
  input.includeSale = $('includeSale').checked;
  input.oneTimePayments = oneTimePayments.map(p => ({date:p.date,amount:cents(p.amount)}));
  if ($('altContributionFrequency').value === 'annual') input.altContribution = Math.round(input.altContribution / 12);
  return input;
}

function validate(input) {
  const issues = [];
  if (input.purchasePrice <= 0) issues.push('Purchase price must be greater than zero.');
  if (input.downPayment > input.purchasePrice) issues.push('Down payment cannot exceed purchase price.');
  if (input.holdingYears <= 0) issues.push('Holding period must be greater than zero.');
  if (input.holdingYears > 50) issues.push('Holding periods over 50 years are outside this model.');
  if (input.mortgageRate > .25) issues.push('Mortgage rates over 25% may be unrealistic.');
  if (input.appreciationRate > .25 || input.appreciationRate < -.25) issues.push('Appreciation outside ±25% deserves a second look.');
  return issues;
}

function metric(label, value, note='') { return `<div class="metric"><small>${label}</small><strong>${value}</strong>${note?`<em>${note}</em>`:''}</div>`; }
function flowClass(v){return v < 0 ? 'negative' : v > 0 ? 'positive' : ''}

function render() {
  const input = readInput();
  const issues = validate(input);
  $('validation').hidden = issues.length === 0;
  $('validation').innerHTML = issues.join('<br>');
  latest = calculateScenario(input);
  const r = latest;
  $('total-return').textContent = signedMoney(r.totalReturn);
  $('total-return').className = flowClass(r.totalReturn);
  $('total-return-rate').textContent = `${fmtPct(r.totalReturnRate)} total return over ${r.years.toFixed(1)} years`;
  $('annualized').textContent = fmtPct(r.annualized);
  $('irr').textContent = fmtPct(r.irr);
  $('cash-on-cash').textContent = fmtPct(r.cashOnCash);
  $('mobile-result').textContent = signedMoney(r.totalReturn);
  const saleDate = new Date(`${input.startDate}T12:00:00`); saleDate.setMonth(saleDate.getMonth()+r.months);
  $('expected-sale-date').textContent = saleDate.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  $('return-components').innerHTML = [
    metric('Appreciation',signedMoney(r.appreciation),`${fmtMoney(r.projectedValue)} projected value`),
    metric('Scheduled principal',fmtMoney(r.mortgage.scheduledPrincipal),'Equity buydown'),
    metric('Extra principal',fmtMoney(r.mortgage.extraPrincipal),'Optional payments'),
    metric('Net rental cash flow',signedMoney(r.cashFlowAfterDebt),`${fmtMoney(r.cashFlowBeforeDebt)} before debt`),
    metric('Estimated tax benefit*',fmtMoney(r.taxBenefit),`${fmtMoney(r.depreciationAnnual)}/yr depreciation`),
    metric('Initial cash invested',fmtMoney(r.initialCash),'Down payment + upfront costs'),
    metric('Additional cash contributed',fmtMoney(r.additionalCash),'Shortfalls + extra principal'),
    metric(input.includeSale?'Net sale proceeds':'Projected equity',fmtMoney(r.netSaleProceeds),`${fmtMoney(r.mortgage.remainingBalance)} loan payoff`)
  ].join('');

  const lead = r.opportunityCost >= 0;
  $('opportunity-label').textContent = `${lead?'Real estate':'Alternative'} leads by`;
  $('opportunity-cost').textContent = fmtMoney(Math.abs(r.opportunityCost));
  $('real-estate-wealth').textContent = fmtMoney(r.endingWealth);
  $('alt-wealth').textContent = fmtMoney(r.alternative.afterTaxEnding);
  const maxWealth = Math.max(1,r.endingWealth,r.alternative.afterTaxEnding);
  $('real-bar').style.width = `${Math.max(0,r.endingWealth/maxWealth*100)}%`;
  $('alt-bar').style.width = `${Math.max(0,r.alternative.afterTaxEnding/maxWealth*100)}%`;
  const altProfit = r.alternative.afterTaxEnding-r.alternative.contributions;
  $('comparison-grid').innerHTML = [
    ['Initial cash',fmtMoney(r.initialCash),fmtMoney(input.altInitial || r.initialCash)],
    ['Additional contributions',fmtMoney(r.additionalCash),fmtMoney(r.alternative.contributions-(input.altInitial || r.initialCash))],
    ['Total profit',signedMoney(r.totalReturn),signedMoney(altProfit)],
    ['Cash flow received',fmtMoney(r.cashFlowReceived),'Included in ending value'],
    ['Annualized return',fmtPct(r.annualized),fmtPct(r.years?((r.alternative.afterTaxEnding/(input.altInitial||r.initialCash))**(1/r.years)-1):null)],
    ['Est. tax impact',fmtMoney(r.taxBenefit-r.capitalGainsTax-r.recaptureTax),`−${fmtMoney(r.alternative.endingBalance-r.alternative.afterTaxEnding)}`]
  ].map(([label,a,b])=>`<div><small>${label}</small><b>${a}<br>${b}</b></div>`).join('');

  $('annual-body').innerHTML = r.annual.map(row=>`<tr><td>Year ${row.year}</td><td>${fmtMoney(row.income)}</td><td>${fmtMoney(row.operating)}</td><td>${fmtMoney(row.debt)}</td><td class="${flowClass(row.cashFlow)}">${signedMoney(row.cashFlow)}</td><td>${fmtMoney(row.taxBenefit)}</td><td>${fmtMoney(row.equity)}</td></tr>`).join('');
  $('amortization-body').innerHTML = r.mortgage.schedule.map(row=>`<tr><td>${row.month}</td><td>${row.date}</td><td>${fmtMoney(row.payment)}</td><td>${fmtMoney(row.interest)}</td><td>${fmtMoney(row.scheduledPrincipal)}</td><td>${fmtMoney(row.extraPrincipal)}</td><td>${fmtMoney(row.balance)}</td></tr>`).join('');
  renderCharts(r);
  $('saved-state').textContent = 'Edited';
}

function points(values,w=500,h=150,pad=12) {
  const min=Math.min(0,...values),max=Math.max(1,...values),range=max-min||1;
  return values.map((v,i)=>`${pad+i*(w-pad*2)/Math.max(1,values.length-1)},${pad+(max-v)*(h-pad*2)/range}`).join(' ');
}
function renderCharts(r){
  const equity=[r.initialCash,...r.annual.map(x=>x.equity)],loan=[r.loan,...r.annual.map(x=>x.balance)];
  const all=[...equity,...loan],max=Math.max(...all,1); const normalized=a=>a.map(v=>v/max);
  $('equity-chart').innerHTML=`<svg viewBox="0 0 500 170" preserveAspectRatio="none"><defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#177a52" stop-opacity=".18"/><stop offset="1" stop-color="#177a52" stop-opacity="0"/></linearGradient></defs><line class="grid" x1="12" y1="12" x2="488" y2="12"/><line class="grid" x1="12" y1="75" x2="488" y2="75"/><line class="grid" x1="12" y1="138" x2="488" y2="138"/><polyline class="equity-line" points="${points(normalized(equity))}"/><polyline class="loan-line" points="${points(normalized(loan))}"/><text x="12" y="166">NOW</text><text x="460" y="166">YEAR ${Math.ceil(r.years)}</text><text x="350" y="15">— EQUITY  -- LOAN</text></svg>`;
  let cumulative=0; const cash=[0,...r.annual.map(x=>cumulative+=x.cashFlow+x.taxBenefit)];
  $('cash-chart').innerHTML=`<svg viewBox="0 0 500 170" preserveAspectRatio="none"><line class="grid" x1="12" y1="12" x2="488" y2="12"/><line class="zero" x1="12" y1="75" x2="488" y2="75"/><line class="grid" x1="12" y1="138" x2="488" y2="138"/><polyline class="cash-line" points="${points(cash)}"/><text x="12" y="166">NOW</text><text x="460" y="166">YEAR ${Math.ceil(r.years)}</text></svg>`;
}

function renderPayments(){
  const list=$('one-time-list');
  if(!oneTimePayments.length){list.innerHTML='<p class="empty">No one-time payments added.</p>';return}
  list.innerHTML=oneTimePayments.map((p,i)=>`<div class="one-time-row"><input type="date" value="${p.date}" aria-label="Payment date"><input type="number" min="0" step="100" value="${p.amount}" aria-label="Payment amount"><button class="remove-payment" data-index="${i}" aria-label="Remove payment">×</button></div>`).join('');
  list.querySelectorAll('.one-time-row').forEach((row,i)=>{
    row.children[0].addEventListener('input',e=>{oneTimePayments[i].date=e.target.value;render()});
    row.children[1].addEventListener('input',e=>{oneTimePayments[i].amount=Number(e.target.value)||0;render()});
  });
  list.querySelectorAll('.remove-payment').forEach(btn=>btn.addEventListener('click',()=>{oneTimePayments.splice(Number(btn.dataset.index),1);renderPayments();render()}));
}

function snapshot(name){
  const fields={}; document.querySelectorAll('input,select').forEach(el=>{if(el.id)fields[el.id]=el.type==='checkbox'?el.checked:el.value});
  return {id:crypto.randomUUID(),name,fields,oneTimePayments:[...oneTimePayments],updated:new Date().toISOString()};
}
function getScenarios(){try{return JSON.parse(localStorage.getItem('investment-calculator-scenarios'))||[]}catch{return[]}}
function setScenarios(items){localStorage.setItem('investment-calculator-scenarios',JSON.stringify(items));refreshScenarioSelect(items)}
function refreshScenarioSelect(items=getScenarios()){
  const selected=$('scenario-select').value;
  $('scenario-select').innerHTML='<option value="">Unsaved scenario</option>'+items.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  if(items.some(s=>s.id===selected))$('scenario-select').value=selected;
}
function escapeHtml(value){const d=document.createElement('div');d.textContent=value;return d.innerHTML}
function loadScenario(s){
  Object.entries(s.fields).forEach(([id,value])=>{const el=$(id);if(!el)return;if(el.type==='checkbox')el.checked=value;else el.value=value});
  oneTimePayments=s.oneTimePayments||[];renderPayments();$('scenario-select').value=s.id;render();$('saved-state').textContent='Loaded';
}
function saveScenario(duplicate=false){
  const items=getScenarios(); const current=items.find(s=>s.id===$('scenario-select').value);
  const defaultName=`Property scenario ${items.length+1}`; const name=duplicate?`${current?.name||'Property scenario'} copy`:(current?.name||prompt('Name this scenario',defaultName));
  if(!name)return;
  const s=snapshot(name); if(current&&!duplicate){s.id=current.id;items[items.indexOf(current)]=s}else items.push(s);
  setScenarios(items);$('scenario-select').value=s.id;$('saved-state').textContent='Saved';showToast('Scenario saved locally');
}
function showToast(text){clearTimeout(saveTimer);$('toast').textContent=text;$('toast').classList.add('show');saveTimer=setTimeout(()=>$('toast').classList.remove('show'),2200)}

function exportCsv(){
  if(!latest)return; const input=readInput(); const rows=[['InvestmentCalculator export'],[],['Assumption','Value'],...Object.entries(input).filter(([,v])=>typeof v!=='object').map(([k,v])=>[k,moneyIds.includes(k)?dollars(v):v]),[],['Result','Value'],['Initial cash',dollars(latest.initialCash)],['Ending wealth',dollars(latest.endingWealth)],['Total return',dollars(latest.totalReturn)],['Annualized return',latest.annualized],['Alternative ending value',dollars(latest.alternative.afterTaxEnding)],[],['Year','Income','Operating expenses','Debt service','Cash flow','Tax benefit','Equity'],...latest.annual.map(x=>[x.year,dollars(x.income),dollars(x.operating),dollars(x.debt),dollars(x.cashFlow),dollars(x.taxBenefit),dollars(x.equity)])];
  const csv=rows.map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n'); const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='investment-scenario.csv';a.click();URL.revokeObjectURL(a.href);showToast('CSV exported');
}

document.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',render));
$('add-payment').addEventListener('click',()=>{oneTimePayments.push({date:$('startDate').value,amount:5000});renderPayments();render()});
$('save-scenario').addEventListener('click',()=>saveScenario(false));
$('duplicate-scenario').addEventListener('click',()=>saveScenario(true));
$('scenario-select').addEventListener('change',e=>{const s=getScenarios().find(x=>x.id===e.target.value);if(s)loadScenario(s)});
$('export-csv').addEventListener('click',exportCsv);
$('export-pdf').addEventListener('click',()=>window.print());
refreshScenarioSelect();renderPayments();render();
