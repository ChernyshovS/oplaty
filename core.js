(function(root){
  'use strict';
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const parse=s=>new Date(s+'T12:00:00');
  const today=()=>iso(new Date());
  const days=(a,b)=>Math.round((parse(b)-parse(a))/86400000);
  function advance(s,period,anchor){
    if(!period)return null;
    const d=parse(s), month=d.getMonth()+period;
    const last=new Date(d.getFullYear(),month+1,0,12).getDate();
    return iso(new Date(d.getFullYear(),month,Math.min(anchor||d.getDate(),last),12));
  }
  function occurrences(item,start,end){
    if(!item.active)return [];
    const found=[]; let date=item.date, guard=0;
    while(date && date<=end && guard++<12000){
      if(date>=start)found.push(date);
      date=advance(date,item.period,item.anchor);
    }
    return found;
  }
  function reminderDates(item, from=today()){
    if(!item.active || item.date<from)return [];
    return [...new Set(item.reminders)].sort((a,b)=>b-a).flatMap(leadDays=>{
      const date=parse(item.date);
      date.setDate(date.getDate()-leadDays);
      const reminderDate=iso(date);
      return reminderDate>=from ? [{date:reminderDate, paymentDate:item.date, leadDays}] : [];
    });
  }
  function validate(x){
    return x && typeof x.id==='string' && typeof x.name==='string' && x.name.trim().length>0 && x.name.length<=120 && Number.isFinite(x.amount) && x.amount>=0 && ['RUB','USD','EUR','GBP','CNY','KZT'].includes(x.currency) && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && Number.isFinite(+parse(x.date)) && iso(parse(x.date))===x.date && [0,1,3,6,12].includes(x.period) && Number.isInteger(x.anchor) && x.anchor>=1 && x.anchor<=31 && typeof x.active==='boolean' && Array.isArray(x.reminders) && x.reminders.every(n=>Number.isInteger(n)&&n>=0&&n<=365);
  }
  const api={iso,parse,today,days,advance,occurrences,reminderDates,validate};
  if(typeof module!=='undefined')module.exports=api;
  else root.Subscriptions=api;
})(typeof window!=='undefined'?window:globalThis);
