import random, corner as C
orig=C.setup
def setup(v):
    cells,b,cs,wild=orig('wild')
    cells.add((0,0)); b[(0,0)]='W'; wild.add((0,0))
    if v=='normal': cs=set()                       # 城の場所はふつうの石
    if v=='empty':
        for p in list(cs): del b[p]
        cs=set()                                   # 城の場所は空き
    return cells,b,cs,wild
random.seed(21)
def run(v,N=400):
    seat=[0,0,0]; lc=0; zero=0; back=0; low=0; hold=0; passes_tot=0; last=[]
    for g in range(N):
        first=g%3
        cells,b,cs,wild=setup(v)
        pl=first; passes=0; hist=[]; hitzero=[False]*3; mincnt=9
        while passes<3:
            m=C.moves(cells,b,cs,pl)
            if not m: passes+=1; passes_tot+=1; pl=(pl+1)%3; continue
            passes=0
            p=max(m,key=lambda p:len(m[p])+random.random()) if random.random()<.85 else random.choice(list(m))
            b[p]=pl
            for x in m[p]: b[x]=pl
            c=[list(b.values()).count(i) for i in range(3)]; ld=c.index(max(c))
            if hist and hist[-1]!=ld: lc+=1
            hist.append(ld); mincnt=min(mincnt,min(c))
            for i in range(3):
                if c[i]==0: hitzero[i]=True
            pl=(pl+1)%3
        c=[list(b.values()).count(i) for i in range(3)]; mx=max(c); w=[i for i in range(3) if c[i]==mx]
        for x in w: seat[(x-first)%3]+=1/len(w)
        zero+=any(hitzero); low+=mincnt<=1
        back+=any(hitzero[i] and c[i]>=10 for i in range(3))
        hold+=hist[len(hist)//2] in w
        last.append(min(c))
    print(f"{v:7s} 先手/2番/3番={[round(100*s/N) for s in seat]} 首位交代={lc/N:.1f} 一度でも0個になる局={100*zero/N:.0f}% 0個から10個以上に戻した局={100*back/N:.0f}% 1個以下になる局={100*low/N:.0f}% 半分時点の首位が勝つ={100*hold/N:.0f}% 最下位の最終石数={sum(last)/N:.1f} パス/局={passes_tot/N:.1f}")
for v in ['castle','normal','empty']: run(v)
