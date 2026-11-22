// 盤を「となりの表」で表す汎用エンジン。値：-1 空き / 0..2 色 / 3 みんなの石
const rnd=Math.random;
function circle(R,S){const D=[];for(const a of[-1,0,1])for(const b of[-1,0,1])if(a||b)D.push([a,b]);const nb=[];for(let i=0;i<R;i++)for(let j=0;j<S;j++)nb.push(D.map(([a,b])=>{const ii=i+a;return ii<0||ii>=R?-1:ii*S+((j+b+S)%S);}));return{N:R*S,nb,max:S,R,S};}
function hex(R){const D=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]],C=[];for(let q=-R;q<=R;q++)for(let s=-R;s<=R;s++)if(Math.max(Math.abs(q),Math.abs(s),Math.abs(q+s))<=R)C.push([q,s]);const id=new Map(C.map((c,i)=>[c+'',i]));return{N:C.length,nb:C.map(([q,s])=>D.map(([a,b])=>id.has([q+a,s+b]+'')?id.get([q+a,s+b]+''):-1)),max:99,id:(q,s)=>id.get([q,s]+'')};}
function flips(G,b,p,pl,out){out.length=0;if(b[p]!==-1)return 0;const nd=G.nb[p].length;for(let d=0;d<nd;d++){let x=G.nb[p][d],k=0;const st=out.length;while(x>=0&&x!==p&&b[x]>=0&&b[x]<3&&b[x]!==pl&&k<G.max){out.push(x);x=G.nb[x][d];k++;}if(!(x>=0&&x!==p&&(b[x]===pl||b[x]===3)&&out.length>st))out.length=st;}return out.length;}
function game(G,init,first,bot){const b=new Int8Array(G.N).fill(-1);for(const[i,c]of init)b[i]=c;let pl=first,passes=0;const tmp=[],cand=[],leads=[];
 while(passes<3){cand.length=0;let best=-1,bs=-1e9;for(let p=0;p<G.N;p++){if(b[p]!==-1)continue;const n=flips(G,b,p,pl,tmp);if(!n)continue;cand.push(p);const s=n+rnd();if(s>bs){bs=s;best=p;}}
  if(!cand.length){passes++;pl=(pl+1)%3;continue;}passes=0;const p=(bot==='g'&&rnd()<.85)?best:cand[Math.floor(rnd()*cand.length)];
  flips(G,b,p,pl,tmp);b[p]=pl;for(const x of tmp)b[x]=pl;const c=[0,0,0];for(const v of b)if(v>=0&&v<3)c[v]++;leads.push(c.indexOf(Math.max(...c)));pl=(pl+1)%3;}
 const c=[0,0,0];let emp=0;for(const v of b){if(v===-1)emp++;else if(v<3)c[v]++;}return{c,leads,emp};}
function evalL(G,init,N,bot){const seat=[0,0,0];let h75=0,h90=0,mar=0,emp=0,big=0;for(let g=0;g<N;g++){const f=g%3,o=game(G,init,f,bot),m=Math.max(...o.c),w=[0,1,2].filter(k=>o.c[k]===m);for(const k of w)seat[(k-f+3)%3]+=1/w.length;
  const L=o.leads.length;if(L){h75+=w.includes(o.leads[Math.floor(L*.75)]);h90+=w.includes(o.leads[Math.floor(L*.9)]);}
  const srt=[...o.c].sort((a,b)=>b-a),tot=srt[0]+srt[1]+srt[2];mar+=(srt[0]-srt[1])/tot;big+=srt[0]/tot>=.5;emp+=o.emp;}
 const s=seat.map(x=>x/N);return{s,dev:Math.max(...s.map(x=>Math.abs(x-1/3))),h75:h75/N,h90:h90/N,mar:mar/N,big:big/N,emp:emp/N};}
function symC(G,base){const out=[],k3=G.S/3;for(const[i,j,c]of base)for(let k=0;k<3;k++)out.push([i*G.S+((j+k*k3)%G.S),(c+k)%3]);return out;}
const fmt=(n,e)=>`${n} 勝率(先/2/3)=${e.s.map(v=>Math.round(v*100)).join('/')} 3/4時点の首位が勝つ=${Math.round(e.h75*100)}% 9割時点=${Math.round(e.h90*100)}% 1位と2位の差=${(e.mar*100).toFixed(0)}%pt 1人で過半数=${Math.round(e.big*100)}% 空き=${e.emp.toFixed(1)}`;
module.exports={circle,hex,evalL,symC,fmt};
if(require.main===module){
 // 基準：いまの六角盤（角と中央がみんなの石、城なし、各4個）
 const H=hex(4),init=[];for(const[q,s]of[[0,0],[4,0],[4,-4],[0,-4],[-4,0],[-4,4],[0,4]])init.push([H.id(q,s),3]);
 [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]].forEach(([q,s],i)=>{init.push([H.id(q,s),i%3]);init.push([H.id(2*q,2*s),(i+1)%3]);});
 console.log(fmt('いまの六角盤',evalL(H,init,3000,'g')));
 const res=[];
 for(const[R,S]of[[4,12],[5,12],[6,12],[5,15]]){const G=circle(R,S),k3=S/3,cells=[];for(let i=0;i<R;i++)for(let j=0;j<k3;j++)cells.push([i,j]);const seen=new Set();
  for(let t=0;t<300;t++){const pick=[...cells.keys()].sort(()=>rnd()-.5).slice(0,4).map(q=>[...cells[q],Math.floor(rnd()*3)]);const key=JSON.stringify(pick.slice().sort());if(seen.has(key))continue;seen.add(key);
   const e=evalL(G,symC(G,pick),120,'g');if(e.emp>3)continue;res.push({R,S,pick,e,score:e.dev+.5*e.h75+.5*e.mar});}}
 res.sort((a,b)=>a.score-b.score);
 const top=res.slice(0,20).map(o=>{const G=circle(o.R,o.S),i=symC(G,o.pick),g=evalL(G,i,2500,'g'),x=evalL(G,i,2500,'r');return{...o,g,x,score:Math.max(g.dev,x.dev)+.5*g.h75+.5*g.mar};}).sort((a,b)=>a.score-b.score);
 for(const o of top.slice(0,6)){console.log(fmt(`円${o.R}重x${o.S} ${JSON.stringify(o.pick)}`,o.g));console.log('   気まぐれに打つと 勝率='+o.x.s.map(v=>Math.round(v*100)).join('/'));}
 console.log('候補数',res.length);
}
