"""Deterministic original SAT-style questions. No scraped question text."""
import json,random,math
from pathlib import Path
R=random.Random(19044)
qs=[]
def fmt(x):return str(int(x)) if float(x).is_integer() else f'{x:.4g}'
def add(topic,subject,prompt,answer,explanation,wrong=None,difficulty='Medium'):
    answer=str(answer)
    if wrong is None:
        a=float(answer);wrong=[fmt(a+1),fmt(a-1),fmt(a+3)]
    opts=list(dict.fromkeys([answer]+list(map(str,wrong))))
    if len(opts)<4:
        try:
            extras=[fmt(float(answer)+delta) for delta in [1,-1,3,7]]
        except ValueError: extras=['0','1','2','None of these values']
        for value in extras:
            if value not in opts:opts.append(value)
            if len(opts)==4:break
    assert len(opts)==4,(prompt,opts)
    R.shuffle(opts)
    qs.append({'id':f'original-{len(qs)+1}','source':'original','subject':subject,'topic':topic,'prompt':prompt,'options':opts,'answer':'ABCD'[opts.index(answer)],'explanationText':explanation,'difficulty':difficulty,'kind':'choice'})

for i in range(12):
    a=R.randint(2,12);x=R.randint(2,15);b=R.randint(2,20);c=a*x+b
    add('Linear equations','math',f'If {a}x + {b} = {c}, what is x?',x,f'Subtract {b} from both sides: {a}x = {c-b}. Divide by {a}, so x = {x}.',difficulty='Easy')
    y=R.randint(2,12);s=x+y;t=2*x+y
    add('Systems of equations','math',f'x + y = {s}\n2x + y = {t}\n\nWhat is x?',x,f'Subtract the first equation from the second. The y terms cancel and x = {t} − {s} = {x}.')
    m=R.randint(2,7);x1=R.randint(1,6);x2=x1+R.randint(2,8);y1=m*x1+b;y2=m*x2+b
    add('Slope','math',f'A line passes through ({x1}, {y1}) and ({x2}, {y2}). What is the slope?',m,f'Slope is change in y divided by change in x: ({y2} − {y1}) / ({x2} − {x1}) = {m}.',difficulty='Easy')
    add('Linear functions','math',f'A workshop charges a fixed fee of {b} dollars plus {a} dollars per hour. What is the cost of {x} hours?',c,f'Cost = fixed fee + hourly rate × hours = {b} + {a} × {x} = {c} dollars.',difficulty='Easy')
    k=R.randint(2,8);total=a*k
    add('Inequalities','math',f'The inequality {a}x < {total} is equivalent to x < k. What is k?',k,f'Divide both sides by positive {a}. The inequality direction stays the same: x < {k}.',difficulty='Easy')
    r1=R.randint(1,9);r2=r1+R.randint(1,5);sm=r1+r2;prod=r1*r2
    add('Quadratic equations','math',f'x² − {sm}x + {prod} = 0\n\nWhat is the larger solution?',r2,f'Factor: (x − {r1})(x − {r2}) = 0. The roots are {r1} and {r2}; the larger is {r2}.',wrong=[r1,sm,prod+1])
    h=R.randint(2,9);v=R.randint(1,15)
    add('Quadratic functions','math',f'f(x) = (x − {h})² + {v}\n\nWhat is the minimum value of f(x)?',v,f'A square is always nonnegative. Its minimum is 0, reached at x = {h}, so the minimum of f is {v}.',wrong=[h,v+1,v+h])
    base=R.randint(10,30);doublings=R.randint(2,4);ans=base*2**doublings
    add('Exponential growth','math',f'A population begins at {base} and doubles each hour. What is the population after {doublings} hours?',ans,f'Use P(t) = {base} × 2ᵗ. After {doublings} hours: {base} × 2^{doublings} = {ans}.',wrong=[base*2*doublings,ans//2,ans+base] if base*2*doublings!=ans else [base+doublings,ans//2,ans+base])
    p=R.randint(2,9);q=R.randint(2,9);z=p+q
    add('Rational expressions','math',f'For x ≠ {p}, simplify (x² − {p*p}) / (x − {p}). What is its value at x = {z}?',z+p,f'Factor x² − {p*p} as (x − {p})(x + {p}). Cancel the nonzero factor x − {p}; at x = {z}, the result is {z+p}.',difficulty='Hard')
    rad=R.randint(2,12)
    add('Circles','math',f'A circle has radius {rad}. Its area is kπ. What is k?',rad*rad,f'Area = πr² = π × {rad}² = {rad*rad}π, so k = {rad*rad}.',difficulty='Easy')
    side=R.randint(2,9)
    add('Right triangles','math',f'A right triangle has legs {3*side} and {4*side}. What is the hypotenuse?',5*side,f'The side ratio is 3:4:5, scaled by {side}. Alternatively, √({3*side}² + {4*side}²) = {5*side}.')
    angle=R.randint(30,65);other=R.randint(30,65);third=180-angle-other
    add('Angles','math',f'A triangle has two angles measuring {angle}° and {other}°. What is the third angle in degrees?',third,f'Triangle angles total 180°. Subtract: 180 − {angle} − {other} = {third}°.',difficulty='Easy')
    length=R.randint(3,10);width=R.randint(2,8);height=R.randint(2,9);vol=length*width*height
    add('Volume','math',f'A rectangular box measures {length} × {width} × {height} centimeters. What is its volume in cubic centimeters?',vol,f'Volume = length × width × height = {length} × {width} × {height} = {vol}.',difficulty='Easy')
    vals=[R.randint(3,25) for _ in range(4)];fifth=R.randint(3,25);mean=(sum(vals)+fifth)/5
    add('Statistics','math',f'The mean of five numbers is {fmt(mean)}. Four of the numbers are {", ".join(map(str,vals))}. What is the fifth?',fifth,f'The total must be 5 × {fmt(mean)} = {sum(vals)+fifth}. Subtract the known total, {sum(vals)}, leaving {fifth}.')
    initial=R.randint(4,20)*10;pct=R.choice([10,20,25,30,50]);disc=initial*(100-pct)/100
    add('Percentages','math',f'An item priced at {initial} dollars is discounted by {pct}%. What is the sale price in dollars?',fmt(disc),f'Keep {100-pct}% of the original price: {initial} × {fmt((100-pct)/100)} = {fmt(disc)} dollars.',wrong=[fmt(initial*pct/100),fmt(initial+pct),fmt(disc+5)])
    scale=R.randint(2,6);old=R.randint(2,10)
    add('Similar figures','math',f'Two similar squares have a side-length ratio of 1:{scale}. The smaller square has area {old*old}. What is the larger area?',old*old*scale*scale,f'Area scales with the square of the side ratio. Multiply {old*old} by {scale}² to get {old*old*scale*scale}.')
    total=R.randint(4,12);red=R.randint(1,total-1)
    add('Probability','math',f'A bag contains {red} red tokens and {total-red} blue tokens. What is the probability of drawing a red token?',f'{red}/{total}',f'Probability = favorable outcomes / total outcomes = {red}/{total}.',wrong=[f'{total}/{red}',f'{red}/{total+1}',f'{red+1}/{total}'])
    intercept=R.randint(2,15);rate=R.randint(2,6);inp=R.randint(1,12)
    add('Function evaluation','math',f'g(x) = {rate}x² + {intercept}\n\nWhat is g({inp})?',rate*inp*inp+intercept,f'Substitute x = {inp}: g({inp}) = {rate} × {inp}² + {intercept} = {rate*inp*inp+intercept}.')

verbal=[
('Transitions','The first battery lasted only two hours. _____ the redesigned battery lasted six hours.','By contrast,',['For example,','Similarly,','Therefore,'],'The second result contrasts with the first, so a contrast transition is needed.'),
('Transitions','The sensor was inexpensive and easy to install. _____ it consumed very little power.','Additionally,',['However,','Instead,','Nevertheless,'],'The final sentence adds another advantage.'),
('Transitions','The bridge was closed for repairs. _____ traffic was redirected through the town center.','Consequently,',['Similarly,','For instance,','Nonetheless,'],'The redirection is a result of the closure.'),
('Transitions','The model predicted a steady increase. _____ measurements showed a sharp decline.','However,',['Therefore,','Likewise,','Moreover,'],'The measurement contradicts the prediction.'),
('Agreement','The collection of old maps _____ in a temperature-controlled room.','is stored',['are stored','have stored','were storing'],'The singular subject is collection; the phrase of old maps does not change its number.'),
('Agreement','Neither the motor nor the two sensors _____ connected to the controller.','are',['is','was','has been'],'With neither…nor, the verb agrees with the nearer subject: two sensors.'),
('Agreement','Each of the proposed routes _____ a different advantage.','offers',['offer','have offered','are offering'],'Each is singular and takes offers.'),
('Agreement','The results of the experiment _____ the original hypothesis.','support',['supports','is supporting','has supported'],'The plural subject results takes support.'),
('Punctuation','Both prototypes worked _____ the lighter model used less energy.','; however,',['however,',', however,','; however'],'A semicolon joins the independent clauses; a comma follows the conjunctive adverb however.'),
('Punctuation','The project required three materials _____ copper, plastic, and glass.',':',[';',',','—,'],'A colon after a complete clause introduces the list.'),
('Punctuation','Ada Lovelace, _____ published detailed notes on the analytical engine.','a mathematician,',['a mathematician','a mathematician;','a mathematician:'],'The nonessential appositive needs a comma on both sides.'),
('Punctuation','The team tested the device _____ recorded the results.','and',['; and',', and',': and'],'Two verbs share one subject, so no comma or semicolon is needed before and.'),
('Vocabulary','The findings were tentative: the researchers emphasized that more evidence was needed. Here, tentative most nearly means _____ .','provisional',['conclusive','irrelevant','repetitive'],'The need for further evidence means the findings are provisional.'),
('Vocabulary','The original sketch was sparse, containing only a few outlines. Here, sparse most nearly means _____ .','minimal',['intricate','inaccurate','colorful'],'The few outlines indicate minimal detail.'),
('Vocabulary','The instructions were explicit, leaving no uncertainty about the steps. Here, explicit most nearly means _____ .','clear',['lengthy','optional','unusual'],'Leaving no uncertainty indicates clarity.'),
('Vocabulary','The method was robust: changing the sample slightly did not alter the conclusion. Here, robust most nearly means _____ .','reliable',['fragile','costly','recent'],'Stability under small changes shows reliability.'),
('Inference','A study found that trees near a busy road grew less than trees of the same species in a nearby park. The study did not measure soil conditions. Which conclusion is best supported?','Growth differed, but the cause remains uncertain.',['Traffic definitely caused the difference.','All roadside trees grow slowly.','Soil had no effect.'],'A difference was observed, but an unmeasured factor prevents a firm causal conclusion.'),
('Inference','A museum extended opening hours in June. Visitor counts rose during June, which also marked the start of school holidays. What can reasonably be concluded?','The increase cannot be attributed solely to longer hours.',['Longer hours were the only cause.','School holidays reduced visits.','The museum became less popular.'],'Two changes occurred together, so their effects cannot be separated from these observations alone.'),
('Main idea','The architect reused existing foundations, preserved local stonework, and adapted the interior for modern needs. Which statement best summarizes the approach?','Preserve useful historic features while updating function.',['Replace every historic feature.','Prioritize appearance over use.','Avoid any modern materials.'],'All three actions combine preservation with practical adaptation.'),
('Evidence','A researcher argues that a coating reduces corrosion. Which finding most directly supports the claim?','Identical coated samples corroded less than uncoated controls.',['The coating has a bright color.','The researcher preferred coated samples.','The coating was developed recently.'],'A controlled comparison of corrosion directly tests the claimed effect.'),
('Precision','Which revision removes redundancy from “The final outcome at the end was unexpected”?','The outcome was unexpected.',['The final end outcome was unexpected.','At the end, the final outcome at the end was unexpected.','The outcome result was unexpected.'],'Outcome already means result; final and at the end add redundant wording.'),
('Parallel structure','The course teaches designing models, testing prototypes, and _____ .','analyzing results',['to analyze results','analysis of results','results are analyzed'],'The list requires three parallel gerund phrases.'),
('Verb tense','By the time the technicians arrived, the machine _____ .','had stopped',['will stop','stops','has been stopping'],'An event completed before another past event takes the past perfect.'),
('Modifiers','Which sentence makes clear that the engineer used a microscope?','Using a microscope, the engineer inspected the sample.',['Using a microscope, the sample was inspected.','The sample using a microscope was inspected.','Using a microscope, an inspection occurred.'],'The person performing the introductory action must follow the modifying phrase.')]
for topic,prompt,answer,wrong,explanation in verbal:add(topic,'rw',prompt,answer,explanation,wrong)
path=Path(__file__).parent/'dist/practice.json';path.write_text(json.dumps(qs,ensure_ascii=False,separators=(',',':')))
print(f'{len(qs)} original questions written')
