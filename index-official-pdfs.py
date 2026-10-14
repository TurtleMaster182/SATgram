import fitz, re, json, hashlib
from pathlib import Path
ROOT=Path(__file__).parent
OUT=ROOT/'dist'
sources=[]
questions=[]

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def key_index(path):
    page=fitz.open(path)[3]
    result={}
    for b in page.get_text('blocks'):
        match=re.match(r'^\s*(\d+)\s+(.+)',b[4].strip(),re.S)
        if match and 1<=int(match[1])<=33 and b[1]>225:
            col=0 if b[0]<130 else 1 if b[0]<230 else 2 if b[0]<365 else 3
            result[(col,int(match[1]))]=' '.join(match[2].split()).replace('−','-')
    return result

def explanation_index(path):
    doc=fitz.open(path);result={};section=-1;lastnum=0
    for pi,p in enumerate(doc):
        for b in sorted(p.get_text('blocks'),key=lambda b:b[1]):
            m=re.match(r'QUESTION\s+(\d+)\b',b[4].strip())
            if not m: continue
            num=int(m[1])
            if num==1 or section<0:section+=1
            result[(section,num)]={'page':pi,'rect':[34,max(0,round(b[1]-5,1)),p.rect.width-34,p.rect.height-35]}
    return result

for n in range(4,12):
    sid=f'digital-{n}'
    pdf=ROOT/'pdf'/f'sat-practice-test-{n}-digital.pdf'
    key=ROOT/'pdf'/f'scoring-sat-practice-test-{n}-digital.pdf'
    exp=ROOT/'pdf'/f'sat-practice-test-{n}-answers-digital.pdf'
    if not all(p.exists() for p in [pdf,key,exp]):continue
    doc=fitz.open(pdf);keys=key_index(key);exps=explanation_index(exp)
    copyright_year=re.search(r'©\s*(\d{4})',doc[-1].get_text())
    year=int(copyright_year[1]) if copyright_year else None
    source={'id':sid,'title':f'Official practice test {n}','era':'Digital format · nonadaptive PDF','year':year,'url':f'https://satsuite.collegeboard.org/media/pdf/{pdf.name}','sha256':digest(pdf),'explanationUrl':f'https://satsuite.collegeboard.org/media/pdf/{exp.name}','explanationSha256':digest(exp),'scoringUrl':f'https://satsuite.collegeboard.org/media/pdf/{key.name}','bytes':pdf.stat().st_size,'pages':len(doc)}
    sourceqs=[];section=-1
    for pi,p in enumerate(doc):
        markers=[]
        spans=[s for b in p.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans']]
        for draw in p.get_drawings():
            r=draw['rect'];fill=draw.get('fill')
            if not (fill and 0.79<fill[0]<0.85 and 150<r.width<550 and 9<r.height<16):continue
            candidates=[s for s in spans if re.fullmatch(r'\d{1,2}',s['text'].strip()) and r.x0<=s['bbox'][0]<=r.x0+22 and r.y0-5<=s['bbox'][1]<=r.y1+4]
            if not candidates:continue
            s=min(candidates,key=lambda s:abs(s['bbox'][1]-r.y0))
            markers.append((int(s['text'].strip()),r))
        markers.sort(key=lambda m:(m[1].x0>300,m[1].y0))
        if not markers:continue
        if markers[0][0]==1:section+=1
        if section not in range(4): raise ValueError((sid,pi,section))
        for num,r in markers:
            answer=keys.get((section,num))
            if not answer: raise ValueError(('missing key',sid,section,num))
            footer_stops=[s['bbox'][1]-12 for s in spans if s['text'].strip()=='STOP' and s['size']>=20 and s['bbox'][1]>500]
            next_y=min([t.y0 for _,t in markers if abs(t.x0-r.x0)<10 and t.y0>r.y0+2]+[735]+footer_stops)
            # Keep drawings, figures, answer choices and the source question label.
            area=fitz.Rect(r.x0-2,r.y0-4,r.x1+2,next_y-5)
            ends=[w[3] for w in p.get_text('words') if area.contains(fitz.Rect(w[:4]))]
            ends += [d['rect'].y1 for d in p.get_drawings() if area.contains(d['rect']) and d['rect'].width>1]
            if ends:area.y1=min(area.y1,max(ends)+10)
            q={'id':f'{sid}-{section}-{num}','source':sid,'subject':'math' if section>=2 else 'rw','topic':'Math' if section>=2 else 'Reading & writing','module':section%2+1,'number':num,'kind':'choice' if answer in 'ABCD' and len(answer)==1 else 'numeric','answer':answer,'page':pi,'rect':[round(v,2) for v in area],'explanation':exps.get((section,num))}
            if not q['explanation']:raise ValueError(('missing explanation',q['id']))
            sourceqs.append(q)
    expected=[33,33,27,27]
    counts=[sum(q['id'].split('-')[-2]==str(s) for q in sourceqs) for s in range(4)]
    if counts!=expected:raise ValueError((sid,counts))
    source['questionCount']=len(sourceqs);source['explanationPages']=len(fitz.open(exp));sources.append(source);questions+=sourceqs
    print(sid,year,counts,'keys',len(keys),'explanations',len(exps))

# Older officially released tests remain readable from original host links.
for n in [9,10]:
    p=ROOT/'pdf'/f'legacy-sat-practice-test-{n}.pdf'
    if p.exists():
        doc=fitz.open(p)
        sources.append({'id':f'legacy-{n}','title':f'Legacy SAT practice test {n}','era':'Older paper SAT · full PDF','year':None,'yearNote':'Publisher release year unconfirmed. Passage copyright dates are not test dates.','url':f'https://cdn.kastatic.org/KA-share/sat/sat-practice-test-{n}.pdf','sha256':digest(p),'bytes':p.stat().st_size,'pages':len(doc),'questionCount':154,'readerOnly':True})

sample=ROOT/'pdf'/'digital-sat-sample-questions.pdf'
if sample.exists():
    doc=fitz.open(sample)
    sources.append({'id':'samples-2022','title':'Digital SAT sample questions','era':'Official examples with explanations','year':2022,'url':'https://satsuite.collegeboard.org/media/pdf/digital-sat-sample-questions.pdf','sha256':digest(sample),'bytes':sample.stat().st_size,'pages':len(doc),'readerOnly':True})

manifest={'checkedAt':'2026-10-14','sources':sources,'questions':questions,'coverage':'Verified public practice PDFs, including older paper tests and current digital-format examples. This is not a complete archive of every SAT administered during 2016–2026. Publication/copyright years label resources, not examination dates.','copyright':'Official question text and PDFs are not bundled. Android downloads original files directly from the publisher or the original Khan Academy CDN for personal study, verifies each SHA-256 and caches files privately. The bundled index contains page coordinates, answer facts and source metadata only. SAT is a College Board trademark; SATflow is independent.'}
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'official-index.json').write_text(json.dumps(manifest,separators=(',',':')))
print('TOTAL',len(questions),'indexed questions',len(sources),'resources')
