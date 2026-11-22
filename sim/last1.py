import random, circle as C, rim as RM
def play(R,S,init,first):
    b=dict(init); pl=first; passes=0; hist=[]; lc=0; mn=99; saves=0
    while passes<3:
        m=C.moves(R,S,b,pl)
        if not m: passes+=1; pl=(pl+1)%3; continue
        passes=0
        p=max(m,key=lambda p:len(set(m[p]))+random.random()) if random.random()<.85 else random.choice(list(m))
        f=set(m[p])
        # さいごの1個は まもられる：だれかの石が全部とられるなら、そのうち1個（置いた石にいちばん近い）を残す
        for k in range(3):
            if k==pl: continue
            mine=[x for x in b if b[x]==k]
            if mine and all(x in f for x in mine):
                keep=min(mine,key=lambda x:abs(x[0]-p[0])+min((x[1]-p[1])%S,(p[1]-x[1])%S)); f.discard(keep); saves+=1
        b[p]=pl
        for x in f: b[x]=pl
        c=[list(b.values()).count(k) for k in range(3)]; ld=c.index(max(c))
        if hist and hist[-1]!=ld: lc+=1
        hist.append(ld); mn=min(mn,min(c))
        pl=(pl+1)%3
    c=[list(b.values()).count(k) for k in range(3)]
    return c,hist,lc,mn,saves
def run(name,R,S,init,N=400):
    seat=[0,0,0]; lc=lo=hold=sv=used=0; mins=0
    for g in range(N):
        first=g%3; c,h,l,mn,s=play(R,S,init,first)
        mx=max(c); w=[k for k in range(3) if c[k]==mx]
        for k in w: seat[(k-first)%3]+=1/len(w)
        lc+=l; lo+=mn<=1; hold+=(h[len(h)//2] in w) if h else 0; sv+=s; used+=s>0; mins+=min(c)
    print(f"{name:24s} 先手/2番/3番={[round(100*s/N) for s in seat]} 首位交代={lc/N:.1f} 0個になる=0% 1個まで追いこまれる局={100*lo/N:.0f}% まもりが働いた局={100*used/N:.0f}% 半分時点の首位が勝つ={100*hold/N:.0f}% 最下位の最終={mins/N:.1f}個")
random.seed(12); S=12
lay={'C':RM.lay['C'],'A':RM.lay['A']}
for o,label in [(False,'円盤＋まもり'),(True,'円盤＋外周＋まもり')]:
    RM.CFG['out']=o; RM.CFG['inn']=False
    for ln,init in lay.items(): run(f'{label} {ln}',5,12,init)
