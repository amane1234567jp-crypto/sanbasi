import random, sys
R=4
D=[(1,0),(1,-1),(0,-1),(-1,0),(-1,1),(0,1)]
ALL=[(q,r) for q in range(-R,R+1) for r in range(-R,R+1) if max(abs(q),abs(r),abs(q+r))<=R]
CORN=[(4,0),(4,-4),(0,-4),(-4,0),(-4,4),(0,4)]
ring=[(1,0),(1,-1),(0,-1),(-1,0),(-1,1),(0,1)]
def setup(v):
    cells=set(ALL); cells.discard((0,0)); b={}; cs=set(); wild=set()
    for i,p in enumerate(ring): b[p]=i%3
    for k in range(3):
        p=(ring[2*k][0]*2,ring[2*k][1]*2); b[p]=(2-k)%3; cs.add(p)
    if v=='hole': cells-=set(CORN)
    if v=='wild':
        for p in CORN: b[p]='W'; wild.add(p)
    return cells,b,cs,wild
def flips(cells,b,cs,p,pl,wildok=True):
    if p in b or p not in cells: return []
    out=[]
    for d in D:
        x=(p[0]+d[0],p[1]+d[1]); t=[]
        while x in b and b[x]!=pl and b[x]!='W' and x not in cs: t.append(x); x=(x[0]+d[0],x[1]+d[1])
        if t and x in b and (b[x]==pl or b[x]=='W'): out+=t
    return out
def moves(cells,b,cs,pl):
    m={}
    for p in cells:
        if p not in b:
            f=flips(cells,b,cs,p,pl)
            if f: m[p]=f
    return m
def stable_cells(cells):
    # 3軸すべてで端になっているマス（＝挟まれない）
    st=set()
    for p in cells:
        ok=True
        for a in range(3):
            d=D[a]; e=D[a+3]
            n1=(p[0]+d[0],p[1]+d[1]); n2=(p[0]+e[0],p[1]+e[1])
            if n1 in cells and n2 in cells: ok=False
        if ok: st.add(p)
    return st
def game(v,first,smart=True):
    cells,b,cs,wild=setup(v); st=stable_cells(cells)-wild
    pl=first; passes=0; firstcorner=None; leads=[]
    while passes<3:
        m=moves(cells,b,cs,pl)
        if not m: passes+=1; pl=(pl+1)%3; continue
        passes=0
        if smart and random.random()<.85:
            def sc(p):
                s=len(m[p])+random.random()
                if p in st: s+=12
                # 次の2人に角を与えるなら減点
                nb=dict(b); nb[p]=pl
                for x in m[p]: nb[x]=pl
                for k in (1,2):
                    om=moves(cells,nb,cs,(pl+k)%3)
                    if any(x in st for x in om): s-=6; break
                return s
            p=max(m,key=sc)
        else: p=random.choice(list(m))
        if p in st and firstcorner is None: firstcorner=pl
        b[p]=pl
        for x in m[p]: b[x]=pl
        c=[list(b.values()).count(i) for i in range(3)]
        lead=c.index(max(c))
        if not leads or leads[-1]!=lead: leads.append(lead)
        pl=(pl+1)%3
    c=[list(b.values()).count(i) for i in range(3)]
    mx=max(c); w=[i for i in range(3) if c[i]==mx]
    srt=sorted(c)
    return w,firstcorner,len(leads)-1,srt[2]-srt[1],len(st)
random.seed(3)
N=int(sys.argv[1]) if len(sys.argv)>1 else 400
for v in ['base','hole','wild']:
    fcw=fct=0; lc=mg=0; seat=[0,0,0]
    for g in range(N):
        first=g%3
        w,fc,l,m,ns=game(v,first)
        for x in w: seat[(x-first)%3]+=1/len(w)
        if fc is not None:
            fct+=1; fcw+= (1/len(w) if fc in w else 0)
        lc+=l; mg+=m
    print(f"{v:5s} 確定マス={ns} 最初に確定マスを取った人の勝率={100*fcw/max(fct,1):.0f}% 首位交代={lc/N:.1f} 1位と2位の差={mg/N:.1f} 先手/2番/3番={[round(100*s/N) for s in seat]}")
