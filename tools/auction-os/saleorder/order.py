import sys,re,collections,bisect
sys.path.insert(0,'.')
from cat import cat
import openpyxl
wb=openpyxl.load_workbook('setlots-template.xlsx');ws=wb.active
rows=list(ws.iter_rows(min_row=2,values_only=True))
I={l.split('|')[0]:l.strip().split('|') for l in open('interest.txt')}
L=[]
for r in rows:
    w,b,p=I[r[1].replace('–','-')][1:]
    w,b,p=int(w),int(b),float(p)
    L.append(dict(lot=r[1],title=r[3],run=bool(__import__('re').search(r'composite rail|stair riser|stair stringer|handrail|richmond vesuvius',r[3].lower())),cat=cat(r[3]),w=w,b=b,p=p,s=p+0.6*w,key=re.sub(r'\W+',' ',r[3].lower())[:38]))
N=len(L)
# multiples (same product) groups
grp=collections.defaultdict(list)
for x in L: grp[x['key']].append(x)
# tiers
byS=sorted(L,key=lambda x:-x['s'])
major=[];seen=set()
for x in byS:
    if len(major)>=22: break
    if x['key'] in seen: continue   # one per product as major
    seen.add(x['key']);major.append(x)
majset={id(x) for x in major}
sec=[x for x in byS if id(x) not in majset and x['s']>=24][:170]
secset={id(x) for x in sec}
rest=[x for x in L if id(x) not in majset|secset]
# ---- density curve: opening .10-.20 lighter, core .40-.75 heaviest
def w(f):
    return 0.9 if f<0.15 else 1.15 if f<0.40 else 1.7 if f<0.75 else 1.15 if f<0.90 else 1.0
import numpy as np
fs=np.linspace(0,1,2001);cdf=np.cumsum([w(f) for f in fs]);cdf/=cdf[-1]
def q(u): return float(np.interp(u,cdf,fs))
# interleave helper: order items so same category/product not adjacent
def interleave(items):
    buckets=collections.defaultdict(list)
    for x in items: buckets[x['cat']].append(x)
    for b in buckets.values(): b.sort(key=lambda x:-x['s'])
    out=[];last=None
    while any(buckets.values()):
        cands=sorted([c for c in buckets if buckets[c]],key=lambda c:-len(buckets[c]))
        c=next((c for c in cands if c!=last),cands[0])
        out.append(buckets[c].pop(0));last=c
    return out
# separate same-product among majors+secondaries: spread substitutes
T={}
# majors: one early hook at .13, the rest across .24-.86
mo=interleave(major)
# keep the two biggest same-buyer items (grills / freezers / welders) apart: interleave handles by category
pos=[0.13]+list(np.linspace(0.24,0.86,len(mo)-1))
# put the single strongest item mid-core, not first
mo.sort(key=lambda x:-x['s'])
order=[None]*len(mo)
# rank -> slot mapping: strongest to core centre, spiral outward
slots=sorted(range(len(pos)),key=lambda i:abs(pos[i]-0.57))
slots=[i for i in slots if i!=0]  # slot 0 (.13) reserved
order[0]=None
assigned={}
# hook lot: a strong but not top-3 crowd-pleaser
hook=mo[5]; assigned[0]=hook
rem=[x for x in mo if x is not hook]
# assign alternately while avoiding same cat in neighbouring slots
for x in rem:
    for i in slots:
        if i in assigned: continue
        nb=[assigned.get(i-1),assigned.get(i+1)]
        if any(n and n['cat']==x['cat'] for n in nb): continue
        assigned[i]=x;break
    else:
        i=next(i for i in slots if i not in assigned);assigned[i]=x
for i,x in assigned.items(): T[id(x)]=pos[i]
# secondaries: spread by density, interleaved categories; substitutes of same product spaced
so=interleave([x for x in sec if not x["run"]])
# spread same-product secondaries: stable reorder so identical products are far apart
byk=collections.defaultdict(list)
for x in so: byk[x['key']].append(x)
n=len(so);U=np.linspace(0.0,0.985,n)
fr=[q(u) for u in U]
free=list(range(n));placed={}
for k,xs in sorted(byk.items(),key=lambda kv:-len(kv[1])):
    if len(xs)==1: continue
    # composite rail / stair risers: contractors want several -> keep as a run (adjacent slots) in core
    if xs[0]['run']:
        continue
    step=len(free)//len(xs)
    for j,x in enumerate(xs):
        i=free[min(len(free)-1,j*step+step//2)];free.remove(i);placed[i]=x
singles=[x for x in so if x not in placed.values() and not x['run']]
for x in singles:
    i=free.pop(0);placed[i]=x
for i,x in placed.items(): T[id(x)]=fr[i]
# building-material run (rail + risers + handrails) as one contractor block at ~.50-.53
run=[x for x in L if x['run']]
run.sort(key=lambda x:(0 if 'composite rail' in x['title'].lower() else 1 if 'handrail' in x['title'].lower() else 2 if 'stair' in x['title'].lower() else 3, x['lot']))
for j,x in enumerate(run): T[id(x)]=0.50+j*0.0009
runset={id(x) for x in run}
# rest: chunk multiples into runs of <=6 spread through the sale; singles interleaved
rest=[x for x in rest if id(x) not in runset]
units=[]
g2=collections.defaultdict(list)
for x in rest: g2[x['key']].append(x)
singles=[]
for k,xs in g2.items():
    if len(xs)>=4:
        xs.sort(key=lambda x:x['lot'])
        nch=max(1,round(len(xs)/6));sz=-(-len(xs)//nch)
        for c in range(nch): units.append(dict(cat=xs[0]['cat'],items=xs[c*sz:(c+1)*sz],s=0,ci=c))
    else: singles+=xs
# singles grouped into short same-category runs of 3-5 so buyers can follow
bc=collections.defaultdict(list)
for x in singles: bc[x['cat']].append(x)
for c,xs in bc.items():
    xs.sort(key=lambda x:x['lot'])
    for i in range(0,len(xs),4): units.append(dict(cat=c,items=xs[i:i+4],s=0))
# spread each category's units evenly over the whole sale, chunks of one product far apart
byc=collections.defaultdict(list)
for u in units: byc[u['cat']].append(u)
cats=sorted(byc)
for ci,c in enumerate(cats):
    us=byc[c]
    us.sort(key=lambda u:(u.get('ci',0),u['items'][0]['lot']))
    n=len(us);off=(ci*0.6180339)%1
    for k,u in enumerate(us):
        f=((k+off)/n)
        for j,x in enumerate(u['items']): T[id(x)]=f+j*1e-6
assert len(T)==N,(len(T),N)
final=sorted(L,key=lambda x:T[id(x)])
for i,x in enumerate(final,1): x['so']=i
import json
json.dump([{k:x[k] for k in('lot','title','cat','w','b','p','s','so')} for x in final],open('order.json','w'))
print('majors:');[print(' %4d %-9s %6.0f %s'%(x['so'],x['lot'],x['p'],x['title'][:55])) for x in sorted(major,key=lambda x:x['so'])]
