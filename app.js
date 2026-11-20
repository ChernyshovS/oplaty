'use strict';
const S=Subscriptions,$=id=>document.getElementById(id),KEY='oplaty.records.v1',PREF='oplaty.preferences.v1';
const DEFAULT_REMINDER_TIME='10:00';
const moscowClock=new Intl.DateTimeFormat('en-CA',{
  timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23'
});
const validReminderTime=value=>typeof value==='string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
let records=[],preferences={reminders:[7,1,0],time:DEFAULT_REMINDER_TIME},filter='active',pending=null,storageAvailable=true;
const periodLabels={0:'Разовая оплата',1:'Каждый месяц',3:'Раз в 3 месяца',6:'Раз в 6 месяцев',12:'Каждый год'};
const periodSuffix={0:'один раз',1:'в месяц',3:'за 3 месяца',6:'за 6 месяцев',12:'в год'};
const preset=[0,1,3,7,14,30];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(a,c)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:c,maximumFractionDigits:2}).format(a);
const dateLabel=d=>S.parse(d).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,5000)}
function load(){try{const value=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(value)||!value.every(S.validate))throw Error('invalid');records=value;const p=JSON.parse(localStorage.getItem(PREF)||'null');if(p&&Array.isArray(p.reminders)&&p.reminders.every(n=>Number.isInteger(n)&&n>=0&&n<=365))preferences={reminders:p.reminders,time:validReminderTime(p.time)?p.time:DEFAULT_REMINDER_TIME};}catch(e){storageAvailable=false;toast('Не удалось прочитать сохранённые данные. Сохранение заблокировано, чтобы не перезаписать их.');}}
function save(next){if(!storageAvailable){toast('Хранилище недоступно. Изменения не сохранены.');return false}try{localStorage.setItem(KEY,JSON.stringify(next));records=next;render();return true}catch(e){toast('Не удалось сохранить. Проверьте доступ к хранилищу браузера.');return false}}
function totals(items){const values={};items.forEach(x=>values[x.currency]=(values[x.currency]||0)+x.amount);return Object.entries(values).sort(([a],[b])=>a.localeCompare(b)).map(([c,a])=>money(a,c)).join(' + ')||'Нет оплат';}
function reminderOptions(container,selected){const options=[...new Set([...preset,...selected])].sort((a,b)=>b-a);$(container).innerHTML=options.map(n=>`<label class="reminder-chip"><input type="checkbox" value="${n}" ${selected.includes(n)?'checked':''}>${n===0?'В день оплаты':`За ${n} дн.`}</label>`).join('');}
function selectedReminders(container,custom){const values=[...$(container).querySelectorAll('input:checked')].map(el=>Number(el.value));if($(custom).value!=='')values.push(Number($(custom).value));return [...new Set(values)].sort((a,b)=>b-a)}
function openEditor(id){const item=records.find(x=>x.id===id);$('editForm').reset();$('itemId').value=item?.id||'';$('dialogTitle').textContent=item?'Изменить оплату':'Новая оплата';$('name').value=item?.name||'';$('amount').value=item?.amount??'';$('currency').value=item?.currency||'RUB';$('date').value=item?.date||S.today();$('period').value=item?.period??1;$('note').value=item?.note||'';$('active').checked=item?.active??true;reminderOptions('itemReminders',item?.reminders||preferences.reminders);$('editor').showModal();$('name').focus()}
function ask(title,message,action,label='Подтвердить'){$('confirmTitle').textContent=title;$('confirmText').textContent=message;$('confirmYes').textContent=label;pending=action;$('confirmDialog').showModal();$('confirmNo').focus()}
function dueLabel(x){const diff=S.days(S.today(),x.date);if(!x.active)return '<span class="status off">Отключена</span>';if(diff<0)return `<span class="due late">Просрочено: ${-diff} дн.</span>`;if(diff===0)return '<span class="due">Сегодня</span>';if(diff<=7)return `<span class="due">Через ${diff} дн.</span>`;return `<span class="muted">Через ${diff} дн.</span>`}
function moscowDateTime(now=new Date()){
  const parts=Object.fromEntries(moscowClock.formatToParts(now).map(({type,value})=>[type,value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}
function reminderLabel(item, now){
  if(!item.active)return 'Напоминания отключены';
  if(!item.reminders.length)return 'Без напоминаний';

  const next=S.reminderDates(item,now.date).find(reminder=>
    reminder.date>now.date || preferences.time>=now.time
  );
  const status=next ? `Ближайшее напоминание: ${dateLabel(next.date)} в ${preferences.time} МСК` : 'Будущих напоминаний по этой оплате нет';
  return status+' · каналы не подключены';
}
function renderCards(){const now=moscowDateTime();const query=$('search').value.trim().toLocaleLowerCase('ru-RU');const visible=records.filter(x=>(filter==='all'||(filter==='active'?x.active:!x.active))&&`${x.name} ${x.note||''}`.toLocaleLowerCase('ru-RU').includes(query)).sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name));
  $('cards').innerHTML=visible.length?visible.map(x=>`<article class="subscription"><div class="card-top"><div class="avatar" aria-hidden="true">${escape(x.name.charAt(0).toUpperCase())}</div><div class="card-title"><h2>${escape(x.name)}</h2><span>${periodLabels[x.period]}</span></div><button class="text-button" data-action="edit" data-id="${escape(x.id)}" aria-label="Изменить ${escape(x.name)}">Изменить</button></div><div class="card-price">${money(x.amount,x.currency)}<small>${periodSuffix[x.period]}</small></div><div class="card-date"><span>${dateLabel(x.date)}</span>${dueLabel(x)}</div>${x.note?`<p class="card-note">${escape(x.note)}</p>`:''}<p class="card-reminders">${reminderLabel(x,now)}</p><div class="card-actions">${x.active?`<button class="text-button" data-action="pay" data-id="${escape(x.id)}">Отметить оплату</button>`:''}<button class="text-button" data-action="toggle" data-id="${escape(x.id)}">${x.active?'Отключить':'Включить'}</button><button class="text-button danger" data-action="delete" data-id="${escape(x.id)}">Удалить</button></div></article>`).join(''):`<div class="empty"><div class="empty-icon" aria-hidden="true">◷</div><h2>${records.length?'Здесь пока пусто':'Первая оплата — начало порядка'}</h2><p>${records.length?'Подходящих подписок нет. Измените поиск или статус.':'Добавьте подписки, интернет, страховку и другие регулярные оплаты. Ближайшие даты и суммы появятся здесь.'}</p>${!records.length?'<button class="primary" data-action="add">＋ Добавить первую оплату</button>':''}</div>`;
}
function render(){const active=records.filter(x=>x.active),today=S.today(),end=S.iso(new Date(S.parse(today).getFullYear(),S.parse(today).getMonth(),S.parse(today).getDate()+29,12));const upcoming=active.flatMap(x=>S.occurrences(x,today,end).map(date=>({...x,date})));$('navCount').textContent=records.length;$('activeCount').textContent=active.length;$('total30').textContent=upcoming.length?totals(upcoming):'0 ₽';$('totalCaption').textContent=upcoming.length?`Запланировано платежей: ${upcoming.length}`:'Нет запланированных оплат';const next=[...active].sort((a,b)=>a.date.localeCompare(b.date))[0];$('nextName').textContent=next?.name||'Пока нет';$('nextDate').textContent=next?`${dateLabel(next.date)} · ${money(next.amount,next.currency)}${next.date<today?' · просрочено':''}`:'Добавьте первую подписку';renderCards();renderPlan();}
function renderPlan(){const today=S.today(),base=S.parse(today);const overdue=records.filter(x=>x.active&&x.date<today);$('overdue').innerHTML=overdue.length?`<div class="overdue-box"><strong>Есть просроченные оплаты: ${overdue.length}</strong><br>${overdue.map(x=>`${escape(x.name)} — ${dateLabel(x.date)}, ${money(x.amount,x.currency)}`).join('<br>')}<br>Проверьте даты и отметьте уже оплаченные платежи в списке.</div>`:'';
  const yearPayments=[],html=[];for(let i=0;i<12;i++){const first=new Date(base.getFullYear(),base.getMonth()+i,1,12),last=new Date(base.getFullYear(),base.getMonth()+i+1,0,12);const start=i===0?today:S.iso(first),end=S.iso(last);const payments=records.flatMap(x=>S.occurrences(x,start,end).map(date=>({...x,date}))).sort((a,b)=>a.date.localeCompare(b.date));yearPayments.push(...payments);html.push(`<article class="month"><h2>${first.toLocaleDateString('ru-RU',{month:'long',year:'numeric'})}</h2><div class="month-total">${totals(payments)}</div>${i===0?'<p class="hint">С сегодняшнего дня до конца месяца</p>':''}${payments.length?payments.map(x=>`<div class="plan-row"><span><small>${S.parse(x.date).getDate()}</small>${escape(x.name)}</span><b>${money(x.amount,x.currency)}</b></div>`).join(''):'<p class="muted">Платежей не запланировано</p>'}</article>`)}$('months').innerHTML=html.join('');renderStatistics(yearPayments, today, S.iso(new Date(base.getFullYear(), base.getMonth()+12, 0, 12)));
}
const shareFormat = new Intl.NumberFormat('ru-RU', {style:'percent', maximumFractionDigits:1});
function renderStatistics(payments, start, end) {
  const currencies = new Map();
  for (const payment of payments) {
    if (!currencies.has(payment.currency)) currencies.set(payment.currency, new Map());
    const subscriptions = currencies.get(payment.currency);
    const previous = subscriptions.get(payment.id);
    subscriptions.set(payment.id, {name: payment.name, total: (previous?.total ?? 0) + payment.amount});
  }

  const averages = [], annual = [], charts = [];
  for (const [currency, subscriptions] of [...currencies].sort(([a], [b]) => a.localeCompare(b))) {
    const entries = [...subscriptions.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    const total = entries.reduce((sum, item) => sum + item.total, 0);
    averages.push(`<div class="summary-amount">${money(total / 12, currency)}</div>`);
    annual.push(`<div class="summary-amount">${money(total, currency)}</div>`);

    const sectors = [];
    let runningTotal = 0;
    const legend = entries.map(({name, total: amount}, index) => {
      const color = `hsl(${Math.round(index * 137.508) % 360} 52% ${index % 2 ? 46 : 36}%)`;
      const share = total > 0 ? amount / total : 0;
      if (amount > 0) {
        const from = runningTotal / total * 100;
        runningTotal += amount;
        const to = Math.min(100, runningTotal / total * 100);
        sectors.push(`${color} ${from}% ${to}%`);
      }
      const percent = share > 0 && share < 0.0005 ? '<0,1 %' : shareFormat.format(share);
      return `<li><span class="pie-key" style="background:${color}" aria-hidden="true"></span><span>${escape(name)}</span><span class="pie-value">${money(amount / 12, currency)}<b>${escape(percent)}</b></span></li>`;
    }).join('');
    const pie = sectors.length
      ? `<div class="spending-pie" style="background:conic-gradient(${sectors.join(',')}, transparent 100%)" aria-hidden="true"></div>`
      : '<p>Все платежи в этой валюте на нулевую сумму.</p>';
    charts.push(`<article class="plan-summary"><h2>Доли подписок · ${currency}</h2><div class="pie-layout">${pie}<ul class="pie-legend">${legend}</ul></div></article>`);
  }

  const zero = '<div class="summary-amount">0 ₽</div>';
  const range = `С ${dateLabel(start)} по ${dateLabel(end)}.`;
  $('planAverage').innerHTML = '<h2>В среднем за месяц</h2>' + (averages.join('') || zero) +
    `<p>${range} Сумма за показанные 12 месяцев, делённая на 12.</p>`;
  $('spendingCharts').innerHTML = charts.join('') || '<p class="muted">За этот период платежей нет.</p>';
  $('planYear').innerHTML = '<h2>Всего за год</h2>' + (annual.join('') || zero);
}
function view(name){for(const key of ['list','plan','settings','stats'])$(key+'View').hidden=key!==name;document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===name));if(name==='settings'){reminderOptions('defaultReminders',preferences.reminders);$('defaultCustom').value='';$('reminderTime').value=preferences.time}if(name==='list')renderCards();window.scrollTo(0,0)}
$('today').textContent=new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
$('add').onclick=()=>openEditor();$('closeEditor').onclick=$('cancelEditor').onclick=()=>$('editor').close();$('openSettings').onclick=()=>view('settings');document.querySelectorAll('[data-view]').forEach(x=>x.onclick=()=>view(x.dataset.view));document.querySelectorAll('[data-filter]').forEach(x=>x.onclick=()=>{filter=x.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('selected',b===x));renderCards()});$('search').oninput=renderCards;
$('editForm').onsubmit=e=>{e.preventDefault();const id=$('itemId').value,old=records.find(x=>x.id===id),date=$('date').value;const item={id:id||crypto.randomUUID(),name:$('name').value.trim(),amount:Number($('amount').value),currency:$('currency').value,date,period:Number($('period').value),anchor:old&&old.date===date?old.anchor:S.parse(date).getDate(),note:$('note').value.trim(),active:$('active').checked,reminders:selectedReminders('itemReminders','itemCustom')};if(!S.validate(item)){toast('Проверьте название, сумму, дату и сроки напоминаний.');return}const next=id?records.map(x=>x.id===id?item:x):[...records,item];if(save(next)){$('editor').close();toast('Оплата сохранена')}};
$('saveSettings').onclick=()=>{
  const custom=$('defaultCustom');
  const time=$('reminderTime');
  if(!custom.reportValidity() || !time.reportValidity())return;
  if(!validReminderTime(time.value)){toast('Укажите время в формате ЧЧ:ММ.');return;}
  if(!storageAvailable){toast('Хранилище недоступно. Настройки не сохранены.');return;}
  const next={reminders:selectedReminders('defaultReminders','defaultCustom'),time:time.value};
  try {
    localStorage.setItem(PREF,JSON.stringify(next));
  } catch(e) {
    toast('Не удалось сохранить настройки в браузере.');
    return;
  }
  preferences=next;
  reminderOptions('defaultReminders',next.reminders);
  custom.value='';
  renderCards();
  toast('Настройки напоминаний сохранены');
};
$('cards').onclick=e=>{const button=e.target.closest('[data-action]');if(!button)return;const {action,id}=button.dataset;if(action==='add'){openEditor();return}const item=records.find(x=>x.id===id);if(!item)return;if(action==='edit'){openEditor(id);return}if(action==='delete'){ask('Удалить оплату?',`«${item.name}», ${money(item.amount,item.currency)}, дата ${dateLabel(item.date)}. Запись будет удалена из списка.`,()=>{if(save(records.filter(x=>x.id!==id)))toast('Оплата удалена')},'Удалить');return}if(action==='toggle'){ask(item.active?'Отключить подписку?':'Включить подписку?',`«${item.name}». ${item.active?'Она останется в списке, но не будет учитываться в будущих расходах.':'Она снова будет учитываться в плане платежей.'}`,()=>{if(save(records.map(x=>x.id===id?{...x,active:!x.active}:x)))toast(item.active?'Подписка отключена':'Подписка включена')});return}if(action==='pay'){const nextDate=S.advance(item.date,item.period,item.anchor);if(nextDate&&nextDate>'2100-12-31'){toast('Следующая дата выходит за поддерживаемый диапазон. Измените её вручную.');return}ask('Подтвердить оплату?',`«${item.name}» — ${money(item.amount,item.currency)} за ${dateLabel(item.date)}. ${nextDate?'Следующая дата: '+dateLabel(nextDate)+'.':'Разовая оплата будет отключена.'}`,()=>{if(save(records.map(x=>x.id===id?{...x,...(nextDate?{date:nextDate}:{active:false})}:x)))toast('Оплата отмечена')},'Оплачено')}};
$('confirmNo').onclick=()=>{$('confirmDialog').close();pending=null};$('confirmYes').onclick=()=>{const action=pending;pending=null;$('confirmDialog').close();action?.()};$('confirmDialog').addEventListener('cancel',()=>pending=null);
window.addEventListener('storage',event=>{if(event.key===KEY||event.key===PREF){load();render()}});
load();render();
