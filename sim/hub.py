import random, circle as C
def flips(R,S,b,p,pl):
    if p in b: return []
    out=[]
    for di,dj in C.DIRS:
        i,j=p; t=[]
        while True:
            i+=di; j=(j+dj)%S
            if i==-1 and dj==0:            # 中心の「みんなの石」に届いた
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
random.seed(8)
S=12
def sym(base):
    d={}
    for (i,j),c in base:
        for k in range(3): d[(i,(j+4*k)%S)]=(c+k)%3
    return d
print("中心に みんなの石（1個）を置いた円盤")
C.run('C 5重×12 +中心',5,12,sym([((2,0),0),((2,1),1),((3,1),2),((3,2),0)]),400)
C.run('A 5重×12 +中心',5,12,sym([((2,0),0),((2,1),1),((3,0),1),((3,1),0)]),400)
C.run('E 内側だけ 6個 +中心',5,12,sym([((0,0),0),((0,2),1)]),400)
C.run('F 内側 2重 +中心',5,12,sym([((0,0),0),((0,1),1),((1,0),1),((1,1),0)]),400)
