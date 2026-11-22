import random, circle as C
CFG={'out':False,'inn':False}
def flips(R,S,b,p,pl):
    if p in b: return []
    out=[]
    for di,dj in C.DIRS:
        i,j=p; t=[]
        while True:
            i+=di; j=(j+dj)%S
            if (i==R and CFG['out']) or (i==-1 and CFG['inn']):   # みんなの輪に届いた
                if t: out+=t
                break
            if not(0<=i<R) or (i,j) not in b or (i,j)==p: break
            if b[(i,j)]==pl:
                if t: out+=t
                break
            t.append((i,j))
            if len(t)>S: break
    return out
C.flips=flips
def play(R,S,init,first):
    b=dict(init); pl=first; passes=0; hist=[]; lc=0; zero=0; rec=0; was0=[False]*3; mn=99
    while passes<3:
        m=C.moves(R,S,b,pl)
        if not m: passes+=1; pl=(pl+1)%3; continue
        passes=0
        p=max(m,key=lambda p:len(set(m[p]))+random.random()) if random.random()<.85 else random.choice(list(m))
        b[p]=pl
        for x in m[p]: b[x]=pl
        c=[list(b.values()).count(k) for k in range(3)]; ld=c.index(max(c))
        if hist and hist[-1]!=ld: lc+=1
        hist.append(ld); mn=min(mn,min(c))
        for k in range(3):
            if c[k]==0: was0[k]=True
        pl=(pl+1)%3
    c=[list(b.values()).count(k) for k in range(3)]
    return c,hist,lc,any(was0),any(was0[k] and c[k]>=8 for k in range(3)),mn<=1
def run(name,R,S,init,N=400):
    seat=[0,0,0]; lc=z=rc=lo=hold=0
    for g in range(N):
        first=g%3; c,h,l,zz,r,low=play(R,S,init,first)
        mx=max(c); w=[k for k in range(3) if c[k]==mx]
        for k in w: seat[(k-first)%3]+=1/len(w)
        lc+=l; z+=zz; rc+=r; lo+=low; hold+=(h[len(h)//2] in w) if h else 0
    print(f"{name:26s} 先手/2番/3番={[round(100*s/N) for s in seat]} 首位交代={lc/N:.1f} 0個になる局={100*z/N:.0f}% そこから8個以上に戻す={100*rc/N:.0f}% 1個以下={100*lo/N:.0f}% 半分時点の首位が勝つ={100*hold/N:.0f}%")
random.seed(9)
S=12
def sym(base):
    d={}
    for (i,j),c in base:
        for k in range(3): d[(i,(j+4*k)%S)]=(c+k)%3
    return d
lay={'C':sym([((2,0),0),((2,1),1),((3,1),2),((3,2),0)]),'A':sym([((2,0),0),((2,1),1),((3,0),1),((3,1),0)]),
     'C内寄り':sym([((1,0),0),((1,1),1),((2,1),2),((2,2),0)])}
for o,i,label in [(False,False,'なし'),(True,False,'外周'),(False,True,'内周'),(True,True,'外周+内周')]:
    CFG['out']=o; CFG['inn']=i
    for ln,init in lay.items(): run(f'{label} {ln}',5,12,init)
