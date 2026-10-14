(function(root){
 'use strict';
 const VERSION=1;
 function dateKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
 function numeric(value){
   const t=String(value).trim().replace(/−/g,'-').replace(/\s/g,'');
   if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:\/[+-]?(?:\d+(?:\.\d*)?|\.\d+))?$/.test(t))return null;
   const parts=t.split('/').map(Number);const result=parts.length===2?parts[0]/parts[1]:parts[0];return Number.isFinite(result)?result:null;
 }
 function correct(question,response){
   if(question.kind==='choice')return String(response).toUpperCase()===question.answer;
   const n=numeric(response);if(n===null)return false;
   const values=question.answer.split(/;|\bor\b/i).map(numeric).filter(x=>x!==null);
   return values.some(x=>Math.abs(x-n)<=1e-9*Math.max(1,Math.abs(x)));
 }
 function fresh(){return {version:VERSION,goal:10,theme:'dark',attempts:[],saved:[],schedule:{},session:{completed:0,correct:0}};}
 function validate(raw){
   if(!raw||raw.version!==VERSION||!Array.isArray(raw.attempts)||!Array.isArray(raw.saved)||typeof raw.schedule!=='object'||raw.schedule===null)throw Error('Unsupported progress file.');
   if(raw.attempts.length>100000||raw.saved.length>5000)throw Error('Progress file is too large.');
   const clean=fresh();clean.goal=[5,10,20,30].includes(raw.goal)?raw.goal:10;clean.theme=raw.theme==='light'?'light':'dark';
   clean.attempts=raw.attempts.filter(a=>a&&typeof a.id==='string'&&typeof a.correct==='boolean'&&Number.isFinite(a.at)&&/^\d{4}-\d{2}-\d{2}$/.test(a.day)).map(a=>({id:a.id,correct:a.correct,at:a.at,day:a.day,topic:String(a.topic||'Practice').slice(0,100),subject:a.subject==='rw'?'rw':'math',response:String(a.response||'').slice(0,100)}));
   clean.saved=[...new Set(raw.saved.filter(s=>typeof s==='string'&&s.length<120))];
   for(const [id,s] of Object.entries(raw.schedule)){if(/^(?:original-\d+|digital-\d+-[0-3]-\d+)$/.test(id)&&s&&Number.isFinite(s.due)&&Number.isFinite(s.level)&&typeof s.wrong==='boolean')clean.schedule[id]={due:s.due,level:Math.max(0,Math.min(4,s.level)),wrong:s.wrong};}
   if(raw.session&&Number.isFinite(raw.session.completed)&&Number.isFinite(raw.session.correct))clean.session={completed:Math.max(0,raw.session.completed),correct:Math.max(0,Math.min(raw.session.correct,raw.session.completed))};
   return clean;
 }
 function record(state,q,response,now=Date.now()){
   const ok=correct(q,response);state.attempts.push({id:q.id,correct:ok,at:now,day:dateKey(new Date(now)),topic:q.topic,subject:q.subject,response:String(response)});
   const old=state.schedule[q.id]||{level:0};const level=ok?Math.min(old.level+1,4):0;
   state.schedule[q.id]={level,wrong:!ok,due:now+(ok?[0,1,3,7,14][level]*86400000:0)};
   state.session.completed++;if(ok)state.session.correct++;return ok;
 }
 function streak(attempts,now=new Date()){
   const days=new Set(attempts.map(a=>a.day));const d=new Date(now);d.setHours(12,0,0,0);if(!days.has(dateKey(d)))d.setDate(d.getDate()-1);
   let n=0;while(days.has(dateKey(d))){n++;d.setDate(d.getDate()-1);}return n;
 }
 function choose(pool,state,currentId,mode='practice',now=Date.now(),random=Math.random){
   let list=pool.filter(q=>q.id!==currentId);if(!list.length)list=pool;
   if(mode==='review')list=list.filter(q=>state.schedule[q.id]?.wrong);
   if(!list.length)return null;
   const due=list.filter(q=>state.schedule[q.id]?.due<=now);
   const unseen=list.filter(q=>!state.schedule[q.id]);
   const preferred=due.length?due:unseen.length?unseen:list;
   return preferred[Math.floor(random()*preferred.length)];
 }
 const api={VERSION,dateKey,numeric,correct,fresh,validate,record,streak,choose};root.SATCore=api;
 if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
