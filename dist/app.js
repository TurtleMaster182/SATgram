'use strict';
const $=id=>document.getElementById(id), C=SATCore, native=typeof Android!=='undefined';
let state,original=[],official=[],sources=[],all=[],current=null,selected='',checked=false,imageReady=false,mode='practice',reader=null,requestCounter=0,toastTimer;
const pendingImages=new Map();
try{state=C.validate(JSON.parse(localStorage.getItem('satflow-v1')));}catch{state=C.fresh();}
function persist(){try{localStorage.setItem('satflow-v1',JSON.stringify(state));}catch{toast('Device storage is full. Export progress to keep a copy.');}}
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3800);}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function external(url){if(native){Android.openExternal(url);return;}window.open(url,'_blank','noopener');}
function todayAttempts(){return state.attempts.filter(a=>a.day===C.dateKey());}
function updateStats(){
 const today=todayAttempts();$('today-count').textContent=today.length;$('daily-goal').textContent=state.goal;$('goal-bar').style.width=`${Math.min(100,today.length/state.goal*100)}%`;
 $('goal-message').textContent=today.length>=state.goal?'Daily target complete. A good time to pause.':`${state.goal-today.length} more to reach today's target.`;
 $('accuracy').textContent=today.length?`${Math.round(today.filter(a=>a.correct).length/today.length*100)}%`:'—';$('saved-count').textContent=state.saved.length;$('streak').textContent=C.streak(state.attempts);
 $('session-label').textContent=state.session.completed?`${state.session.completed} completed this session · ${state.session.correct} correct`:'A short session beats an endless scroll.';
}
function goTab(tab){
 document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===tab));document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
 $('page-title').textContent={practice:'Replace the scroll.',library:'A library, not a rabbit hole.',progress:'A little further.',settings:'Set the pace.'}[tab];
 if(tab==='progress')renderProgress();window.scrollTo({top:0,behavior:'smooth'});
}
function pool(){const src=$('source').value,sub=$('subject').value;return all.filter(q=>(src==='original'?q.source==='original':q.source===src)&&(sub==='all'||q.subject===sub));}
function nextQuestion(forceId){
 $('session-end').hidden=true;$('question-card').hidden=false;
 const q=forceId?all.find(q=>q.id===forceId):C.choose(pool(),state,current?.id,mode);
 if(!q){if(mode==='review'){toast('No remaining mistakes in this selection.');mode='practice';$('review-btn').textContent='Review mistakes';return nextQuestion();}toast('No questions match this selection.');return;}
 current=q;selected='';checked=false;imageReady=q.source==='original';$('feedback').hidden=true;$('explanation').hidden=true;$('explanation').replaceChildren();$('choices').replaceChildren();$('numeric-wrap').hidden=q.kind!=='numeric';$('numeric-answer').value='';$('numeric-answer').disabled=false;$('check').disabled=true;$('check').textContent='Check answer ↗';$('skip').textContent='Skip for now';
 $('topic').textContent=q.topic;$('difficulty').textContent=q.difficulty||`${q.subject==='math'?'Math':'Reading & writing'} · M${q.module}`;$('question-number').textContent=String(q.number||Number(q.id.split('-').pop())).padStart(2,'0');
 $('question-context').textContent=q.source==='original'?'ORIGINAL SAT-STYLE PRACTICE':`${sources.find(s=>s.id===q.source)?.title} · QUESTION ${q.number}`;
 $('question-content').replaceChildren();$('source-note').replaceChildren();
 if(q.source==='original'){$('question-content').textContent=q.prompt;$('source-note').textContent='Original exercise · 240 questions available offline';}
 else{
  const loading=el('div','loading-content');loading.append(el('span','loader'),el('span',null,'Loading the official question. The first download may take a moment.'));$('question-content').append(loading);
  const s=sources.find(s=>s.id===q.source);$('source-note').append(el('span',null,`College Board · ${s.year} resource · module ${q.module} · page ${q.page+1} · `));
  const link=el('a',null,'Original PDF ↗');link.href=s.url;link.addEventListener('click',e=>{e.preventDefault();external(s.url);});$('source-note').append(link);
  loadImage(q.id,false,$('question-content'),()=>{if(current?.id===q.id){imageReady=true;updateCheck();}});
 }
 if(q.kind==='choice')for(let i=0;i<4;i++){
  const letter='ABCD'[i],button=el('button','choice');button.dataset.answer=letter;button.append(el('span','letter',letter),el('span',null,q.options?q.options[i]:`Option ${letter}`));
  button.addEventListener('click',()=>{if(checked)return;selected=letter;$('choices').querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b===button));updateCheck();});$('choices').append(button);
 }
 updateBookmark();updateStats();
}
function updateCheck(){$('check').disabled=!imageReady||(!selected&&current?.kind==='choice')||(current?.kind==='numeric'&&C.numeric($('numeric-answer').value)===null);}
function loadImage(id,explanation,target,onReady){
 if(!native){target.replaceChildren(el('div','error-message','Official PDF cards are available in the Android app. Open the original PDF from the test library to practice here.'));return;}
 const request=`image-${++requestCounter}`;pendingImages.set(request,{target,onReady,retry:()=>loadImage(id,explanation,target,onReady)});Android.renderQuestion(id,explanation,request);
}
window.onNativeImage=function(result){
 const task=pendingImages.get(result.request);if(!task)return;pendingImages.delete(result.request);
 task.target.replaceChildren();
 if(result.error){task.target.append(el('p','error-message',result.error));const retry=el('button','small-button','Retry download');retry.onclick=task.retry;task.target.append(retry);return;}
 const img=el('img');img.alt=result.explanation?'Official answer explanation':'Official SAT question';img.src='data:image/png;base64,'+result.image;task.target.append(img);task.onReady?.();
};
function checkAnswer(){
 if(!current)return;if(checked){if(state.session.completed&&state.session.completed%10===0)return endSession();nextQuestion();window.scrollTo({top:0,behavior:'smooth'});return;}
 if(!imageReady)return;const response=current.kind==='numeric'?$('numeric-answer').value:selected;if(!response)return;
 const ok=C.record(state,current,response);persist();checked=true;$('choices').querySelectorAll('button').forEach(b=>{b.disabled=true;b.classList.toggle('correct',b.dataset.answer===current.answer);b.classList.toggle('wrong',b.dataset.answer===selected&&!ok);});$('numeric-answer').disabled=true;
 $('feedback').hidden=false;$('feedback').className='feedback '+(ok?'success':'failure');$('feedback').textContent=ok?'Correct. A small win.':`Not quite. Correct answer: ${current.answer}${current.options?' · '+current.options['ABCD'.indexOf(current.answer)]:''}`;
 $('explanation').hidden=false;$('explanation').append(el('h4',null,'WHY THIS WORKS'));
 if(current.explanationText)$('explanation').append(el('p',null,current.explanationText));
 else{
  $('explanation').append(el('p',null,'Read the official explanation below. The original explanation page may include neighboring answers.'));
  const target=el('div','explanation-image');target.append(el('span',null,'Loading explanation…'));$('explanation').append(target);loadImage(current.id,true,target);
  const q=current,s=sources.find(s=>s.id===q.source),full=el('button','small-button','Read full explanation PDF ↗');full.onclick=()=>openReader(s.id+'-explanations',s.title+' · explanations',s.explanationPages,q.explanation.page);$('explanation').append(full);
 }
 $('check').disabled=false;$('check').textContent=state.session.completed%10===0?'Finish 10-question session ✓':'Next question ↗';$('skip').textContent='Save & revisit';updateStats();
}
function updateBookmark(){const saved=current&&state.saved.includes(current.id);$('save-question').textContent=saved?'★':'☆';$('save-question').classList.toggle('saved',!!saved);$('save-question').setAttribute('aria-label',saved?'Unsave question':'Save question');}
function toggleSaved(){if(!current)return;const i=state.saved.indexOf(current.id);if(i>=0)state.saved.splice(i,1);else state.saved.push(current.id);persist();updateBookmark();updateStats();}
function startReview(){if(!pool().some(q=>state.schedule[q.id]?.wrong)){const missed=all.find(q=>state.schedule[q.id]?.wrong);if(missed){$('source').value=missed.source;$('subject').value='all';}}mode='review';$('review-btn').textContent='Mistake review active';nextQuestion();goTab('practice');}
function endSession(){$('question-card').hidden=true;$('session-end').hidden=false;$('session-result').textContent=`${state.session.completed} questions completed, ${state.session.correct} correct. Progress is saved. A break is always available.`;}
function renderLibrary(){
 $('resources').replaceChildren();
 for(const s of sources){
  const card=el('article','resource');card.append(el('p','eyebrow',`${s.year?s.year+' RESOURCE':'LEGACY PRACTICE'} · ${s.readerOnly?'PDF READER':'QUESTION FEED'}`),el('h3',null,s.title),el('p',null,`${s.era} · ${s.questionCount?s.questionCount+' questions · ':''}${(s.bytes/1048576).toFixed(1)} MB${s.yearNote?' · Release year unconfirmed':''}`));
  const actions=el('div','resource-actions');const open=el('button',native?'primary':'small-button',native?(s.readerOnly?'Read in app ↗':'Start question feed ↗'):'Open official PDF ↗');open.onclick=()=>{if(!native)return external(s.url);if(s.readerOnly)return openReader(s.id,s.title,s.pages);$('source').value=s.id;mode='practice';nextQuestion();goTab('practice');};actions.append(open);
  if(!s.readerOnly){const key=el('a','small-button','Scoring key ↗');key.href=s.scoringUrl;key.target='_blank';key.rel='noopener';key.onclick=e=>{e.preventDefault();external(s.scoringUrl);};actions.append(key);}
  if(native&&!s.readerOnly){const full=el('button','small-button','Full PDF');full.onclick=()=>openReader(s.id,s.title,s.pages);actions.append(full);}
  card.append(actions);$('resources').append(card);
 }
 $('import-pdf').hidden=!native;
 if(native)try{const imported=JSON.parse(Android.listImports());for(const s of imported){const card=el('article','resource');card.append(el('p','eyebrow','PERSONAL IMPORT'),el('h3',null,s.title));const b=el('button','small-button','Read imported PDF');b.onclick=()=>openReader(s.id,s.title,s.pages);card.append(b);$('resources').append(card);}}catch{}
}
function renderProgress(){
 const total=state.attempts.length,correct=state.attempts.filter(a=>a.correct).length,wrong=Object.values(state.schedule).filter(s=>s.wrong).length;
 $('stats-grid').replaceChildren();for(const [value,label] of [[total,'questions completed'],[total?Math.round(correct/total*100)+'%':'—','practice accuracy'],[C.streak(state.attempts),'day streak'],[wrong,'questions to revisit']]){const n=el('div','stat');n.append(el('b',null,value),el('span',null,label));$('stats-grid').append(n);}
 const days=[];for(let i=6;i>=0;i--){const date=new Date();date.setDate(date.getDate()-i);days.push({name:date.toLocaleDateString('en',{weekday:'short'}),count:state.attempts.filter(a=>a.day===C.dateKey(date)).length});}
 $('activity').replaceChildren();const max=Math.max(1,...days.map(d=>d.count));for(const d of days){const n=el('div','activity-day'),bar=el('div','activity-bar');bar.style.height=`${Math.max(3,d.count/max*76)}px`;n.append(el('span',null,d.count),bar,el('span',null,d.name));$('activity').append(n);}
 const topics={};for(const [id,s] of Object.entries(state.schedule)){const q=all.find(q=>q.id===id);if(s.wrong&&q)topics[q.topic]=(topics[q.topic]||0)+1;}
 $('topics').replaceChildren();if(!Object.keys(topics).length)$('topics').append(el('p',null,'No open mistakes. Completed questions will build a topic history here.'));
 for(const [topic,num] of Object.entries(topics).sort((a,b)=>b[1]-a[1])){const row=el('div','topic-row');row.append(el('span',null,topic),el('span',null,`${num} to revisit`));$('topics').append(row);}
 $('saved-list').replaceChildren();if(!state.saved.length)$('saved-list').append(el('p',null,'Tap the star on a question to save it for later.'));
 for(const id of state.saved){const q=all.find(q=>q.id===id);if(!q)continue;const row=el('div','saved-row');row.append(el('span',null,q.prompt?.replace(/\n/g,' ')||`${q.topic} · ${sources.find(s=>s.id===q.source)?.title} · Q${q.number}`));const b=el('button','small-button','Practice');b.onclick=()=>{$('source').value=q.source;$('subject').value='all';mode='practice';nextQuestion(id);goTab('practice');};row.append(b);$('saved-list').append(row);}
}
function openReader(id,title,pages,start=0){reader={id,title,pages,page:start};$('reader-title').textContent=title;$('pdf-reader').showModal();renderReader();}
function renderReader(){if(!reader)return;$('reader-page').textContent=`${reader.page+1} / ${reader.pages}`;$('reader-prev').disabled=reader.page===0;$('reader-next').disabled=reader.page>=reader.pages-1;$('reader-image').replaceChildren(el('div','loading-content','Loading PDF page…'));const request=`image-${++requestCounter}`;pendingImages.set(request,{target:$('reader-image'),retry:renderReader});Android.renderPage(reader.id,reader.page,request);}
window.onPdfImported=function(result){if(result.error){toast(result.error);return;}toast('Personal PDF imported.');renderLibrary();openReader(result.id,result.title,result.pages);};
window.nativeBack=function(){if($('pdf-reader').open){$('pdf-reader').close();return true;}if(!$('practice').classList.contains('active')){goTab('practice');return true;}return false;};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>goTab(b.dataset.tab));$('check').onclick=checkAnswer;$('save-question').onclick=toggleSaved;$('review-btn').onclick=startReview;$('progress-review').onclick=startReview;
$('skip').onclick=()=>{if(checked){if(!state.saved.includes(current.id))toggleSaved();toast('Saved for later.');return;}nextQuestion();};
$('subject').onchange=$('source').onchange=()=>{mode='practice';$('review-btn').textContent='Review mistakes';nextQuestion();};$('numeric-answer').oninput=updateCheck;$('numeric-answer').onkeydown=e=>{if(e.key==='Enter'&&!$('check').disabled)checkAnswer();};
$('end-session').onclick=endSession;$('keep-going').onclick=()=>{state.session={completed:0,correct:0};persist();nextQuestion();};$('close-session').onclick=()=>goTab('progress');
$('goal-setting').value=state.goal;$('goal-setting').onchange=()=>{state.goal=Number($('goal-setting').value);persist();updateStats();};$('theme-setting').value=state.theme;document.body.classList.toggle('light',state.theme==='light');$('theme-setting').onchange=()=>{state.theme=$('theme-setting').value;document.body.classList.toggle('light',state.theme==='light');persist();};
$('export-progress').onclick=()=>{const data=JSON.stringify(state,null,2);if(native){Android.exportProgress(data);return;}const u=URL.createObjectURL(new Blob([data],{type:'application/json'}));const a=el('a');a.href=u;a.download='satflow-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
$('restore-progress').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>10*1048576)throw Error('Progress file is too large.');const raw=C.validate(JSON.parse(await file.text()));if(!confirm('Replace the current practice progress with this file?'))return;state=raw;persist();$('goal-setting').value=state.goal;$('theme-setting').value=state.theme;document.body.classList.toggle('light',state.theme==='light');updateStats();nextQuestion();toast('Progress restored.');}catch(err){toast(err.message);}e.target.value='';};
$('delete-progress').onclick=()=>{if(!confirm('Delete all local answers, bookmarks and practice history?'))return;const goal=state.goal,theme=state.theme;state=C.fresh();state.goal=goal;state.theme=theme;persist();updateStats();nextQuestion();toast('Practice progress reset.');};
$('reader-close').onclick=()=>$('pdf-reader').close();$('reader-prev').onclick=()=>{reader.page--;renderReader();};$('reader-next').onclick=()=>{reader.page++;renderReader();};$('import-pdf').onclick=()=>Android.importPdf();
$('date-label').textContent=new Date().toLocaleDateString('en',{weekday:'long',month:'short',day:'numeric'}).toUpperCase();
async function init(){
 try{
  const [p,o]=await Promise.all([fetch('practice.json').then(r=>{if(!r.ok)throw Error('Practice data unavailable');return r.json();}),fetch('official-index.json').then(r=>{if(!r.ok)throw Error('Official index unavailable');return r.json();})]);
  original=p;official=o.questions;sources=o.sources;all=native?[...original,...official]:original;$('coverage').textContent=o.coverage;$('official-count').textContent=official.length;
  if(native){for(const s of sources.filter(s=>!s.readerOnly)){const opt=el('option',null,s.title);opt.value=s.id;$('source').append(opt);}$('platform').textContent='Progress stays on this device';$('native-note').replaceChildren(el('span',null,'OFFICIAL PRACTICE, ON DEVICE'),el('p',null,`${official.length} official questions · select a test to download it once. 240 original exercises are ready offline.`));}
  renderLibrary();updateStats();nextQuestion();
  if(!native&&'serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
 }catch(error){$('question-content').replaceChildren(el('p','error-message',error.message));toast('Practice could not load. Reopen the app.');}
}
init();
