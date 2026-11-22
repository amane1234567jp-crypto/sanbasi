import random, corner as C, nocastle as NC
ring=C.ring
def mk(extra):
    def setup(v):
        cells=set(C.ALL); b={}
        for p in C.CORN+[(0,0)]: b[p]='W'
        for i,p in enumerate(ring): b[p]=i%3
        for p,c in extra: b[p]=c
        return cells,b,set(),set(C.CORN+[(0,0)])
    return setup
ax2=[(2,0),(2,-2),(0,-2),(-2,0),(-2,2),(0,2)]
mid2=[(2,-1),(1,-2),(-1,-1),(-2,1),(-1,2),(1,1)]
L={}
for s in range(3): L[f'外3個 型{s}']=[(ax2[2*k],(s-k)%3) for k in range(3)]
for s in range(3): L[f'外3個ずらし 型{s}']=[(ax2[2*k+1],(s-k)%3) for k in range(3)]
for s in range(3): L[f'外6個 ax 型{s}']=[(ax2[i],(i+s)%3) for i in range(6)]
for s in range(3): L[f'外6個 mid 型{s}']=[(mid2[i],(i+s)%3) for i in range(6)]
L['内6個だけ']=[]
random.seed(4)
for name,ex in L.items():
    NC.setup=mk(ex); print(name, end=' '); NC.run('x',300)
