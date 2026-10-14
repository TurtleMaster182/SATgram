const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../dist/core.js');
const original=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/practice.json')));
test('numeric answers accept equivalent fractions and reject expressions or infinity',()=>{
 for(const [raw,n] of [['3/4',.75],['.75',.75],['-5',-5],[' −5 ', -5],['0',0]])assert.equal(C.numeric(raw),n);
 for(const raw of ['','1/0','2+2','Infinity','NaN','4/2/2','abc'])assert.equal(C.numeric(raw),null);
 assert(C.correct({kind:'numeric',answer:'15; -5'},'-5'));
 assert(C.correct({kind:'numeric',answer:'1/4; .25'},'2/8'));
 assert(C.correct({kind:'numeric',answer:'29/3; 9.666; 9.667'},'9.667'));
 assert(!C.correct({kind:'numeric',answer:'29/3; 9.666; 9.667'},'9.66'));
 assert(C.correct({kind:'choice',answer:'C'},'c'));
});
test('a missed question stays in review until answered correctly, then is spaced',()=>{
 const s=C.fresh(),q=original[0],now=new Date(2026,9,14,12).getTime();const wrong='ABCD'.split('').find(x=>x!==q.answer);
 assert.equal(C.record(s,q,wrong,now),false);assert.equal(s.schedule[q.id].wrong,true);assert.equal(s.schedule[q.id].due,now);
 assert.equal(C.choose([q],s,null,'review',now,()=>0).id,q.id);
 assert.equal(C.record(s,q,q.answer,now+1000),true);assert.equal(s.schedule[q.id].wrong,false);assert.equal(s.schedule[q.id].due,now+1000+86400000);
 assert.equal(C.choose([q],s,null,'review',now,()=>0),null);
 C.record(s,q,q.answer,now+2000);assert.equal(s.schedule[q.id].due,now+2000+3*86400000);
 assert.equal(s.session.completed,3);assert.equal(s.session.correct,2);
});
test('review and unseen questions are prioritized without immediately repeating the current card',()=>{
 const s=C.fresh(),q=original[0],other=original[1];s.schedule[q.id]={due:0,wrong:true,level:0};
 assert.equal(C.choose([q,other],s,q.id,'practice',100,()=>0).id,other.id);
 assert.equal(C.choose([q,other],s,null,'practice',100,()=>0).id,q.id);
 assert.equal(C.choose([],s,null),null);
});
test('streak uses local calendar dates and tolerates a not-yet-practiced current day',()=>{
 const now=new Date(2026,9,14,19),day=n=>C.dateKey(new Date(2026,9,n,12));
 assert.equal(C.streak([{day:day(14)},{day:day(13)},{day:day(12)}],now),3);
 assert.equal(C.streak([{day:day(13)},{day:day(12)}],now),2);
 assert.equal(C.streak([{day:day(12)}],now),0);
});
test('validated exports preserve progress and strip unsupported state',()=>{
 const s=C.fresh();s.saved=[original[0].id];C.record(s,original[0],original[0].answer,1234567890);
 const restored=C.validate(JSON.parse(JSON.stringify(s)));assert.deepEqual(restored,s);
 assert.throws(()=>C.validate({version:42}));assert.throws(()=>C.validate({...s,schedule:null}));
 assert.equal(C.validate({...s,goal:900,theme:'anything'}).goal,10);
});
test('every original exercise has four distinct options and a working factual key',()=>{
 assert.equal(original.length,240);assert.equal(new Set(original.map(q=>q.id)).size,240);
 for(const q of original){assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.match(q.answer,/^[ABCD]$/);assert(C.correct(q,q.answer));assert(q.explanationText.length>20);}
});
test('all indexed official question answers and coordinates validate',()=>{
 const index=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/official-index.json')));
 assert.equal(index.questions.length,960);assert.equal(new Set(index.questions.map(q=>q.id)).size,960);
 for(const q of index.questions){assert(q.rect[2]>q.rect[0]&&q.rect[3]>q.rect[1]);assert(q.rect[0]>=0&&q.rect[2]<=612&&q.rect[3]<=792);assert(q.explanation);if(q.kind==='numeric'){for(const a of q.answer.split(/;|\bor\b/i)){assert.notEqual(C.numeric(a),null,`Invalid numeric key ${q.id}: ${a}`);assert(C.correct(q,a));}}else assert(C.correct(q,q.answer));}
 for(const s of index.sources){assert.match(s.sha256,/^[a-f0-9]{64}$/);assert(s.url.startsWith('https://'));}
});
