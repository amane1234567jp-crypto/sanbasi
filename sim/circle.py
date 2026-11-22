import random, itertools
def make(R,S):
    cells=[(i,j) for i in range(R) for j in range(S)]
    return cells
DIRS=[(a,b) for a in (-1,0,1) for b in (-1,0,1) if (a,b)!=(0,0)]
def flips(R,S,b,p,pl):
    if p in b: return []
    out=[]
    for di,dj in DIRS:
        i,j=p; t=[]
        for _ in range(S):
            i+=di; j=(j+dj)%S
            if not(0<=i<R) or (i,j) not in b or b[(i,j)]==pl or (i,j)==p: break
            t.append((i,j))
        else: continue
        if t and 0<=i<R and (i,j) in b and b[(i,j)]==pl and (i,j)!=p: out+=t
    return out
def moves(R,S,b,pl):
    m={}
    for i in range(R):
        for j in range(S):
            if (i,j) not in b:
                f=flips(R,S,b,(i,j),pl)
                if f: m[(i,j)]=f
    return m
def play(R,S,init,first):
    b=dict(init); pl=first; passes=0; hist=[]; zero=[False]*3; lc=0
    while passes<3:
        m=moves(R,S,b,pl)
        if not m: passes+=1; pl=(pl+1)%3; continue
        passes=0
        p=max(m,key=lambda p:len(set(m[p]))+random.random()) if random.random()<.85 else random.choice(list(m))
        b[p]=pl
        for x in m[p]: b[x]=pl
        c=[list(b.values()).count(k) for k in range(3)]; ld=c.index(max(c))
        if hist and hist[-1]!=ld: lc+=1
        hist.append(ld)
        for k in range(3):
            if c[k]==0: zero[k]=True
        pl=(pl+1)%3
    c=[list(b.values()).count(k) for k in range(3)]
    return c,hist,zero,lc,R*S-len(b)
def run(name,R,S,init,N=300):
    seat=[0,0,0]; z=0; lc=0; emp=0; hold=0; out=0
    for g in range(N):
        first=g%3; c,h,zero,l,e=play(R,S,init,first)
        mx=max(c); w=[k for k in range(3) if c[k]==mx]
        for k in w: seat[(k-first)%3]+=1/len(w)
        z+=any(zero); lc+=l; emp+=e; hold+= (h[len(h)//2] in w) if h else 0
    print(f"{name:28s} マス={R*S} 初期石={len(init)} 先手/2番/3番={[round(100*s/N) for s in seat]} 首位交代={lc/N:.1f} 誰かが0個(脱落)={100*z/N:.0f}% 半分時点の首位が勝つ={100*hold/N:.0f}% 空き残り={emp/N:.1f}")
random.seed(2)
R,S=5,12
# 120°対称（4セクターずつ回す）な初期配置をいくつか
def sym(base):
    d={}
    for (i,j),c in base:
        for k in range(3): d[(i,(j+4*k)%S)]=(c+k)%3
    return d
L={
 'A 2重×各2':sym([((2,0),0),((2,1),1),((3,0),1),((3,1),0)]),
 'B 帯 1列':sym([((2,0),0),((2,1),1),((2,2),2),((2,3),0)]),
 'C 2重 ずらし':sym([((2,0),0),((2,1),1),((3,1),2),((3,2),0)]),
 'D 内外交互':sym([((1,0),0),((2,0),1),((1,2),1),((2,2),2)]),
}
for n,init in L.items(): run(n,R,S,init)
print('--- 大きさ違い')
for R2,S2 in [(4,12),(6,12),(5,15)]:
    def sym2(base,S=S2):
        d={}
        for (i,j),c in base:
            for k in range(3): d[(i,(j+S//3*k)%S)]=(c+k)%3
        return d
    m=R2//2
    run(f'A型 {R2}重×{S2}',R2,S2,sym2([((m,0),0),((m,1),1),((m-1 if R2>4 else m+1,0),1),((m-1 if R2>4 else m+1,1),0)]))
