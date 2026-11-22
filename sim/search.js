// 円い盤（R重×Sマス、円周はつながる）で、先手/2番/3番の勝率が均等になる初期配置をさがす
const DIRS=[];for(const a of[-1,0,1])for(const b of[-1,0,1])if(a||b)DIRS.push([a,b]);
function mk(R,S){const N=R*S,nb=[];for(let i=0;i<R;i++)for(let j=0;j<S;j++){const v=[];for(const[a,b]of DIRS){const ii=i+a;v.push(ii<0||ii>=R?-1:ii*S+((j+b+S)%S));}nb.push(v);}return{R,S,N,nb};}
function flips(G,b,p,pl,out){out.length=0;if(b[p]>=0)return 0;for(let d=0;d<8;d++){let x=G.nb[p][d],k=0,start=out.length;while(x>=0&&x!==p&&b[x]>=0&&b[x]!==pl&&k<G.S){out.push(x);x=G.nb[x][d];k++;}if(!(x>=0&&x!==p&&b[x]===pl&&out.length>start))out.length=start;}return out.length;}
let rnd=Math.random;
function seed(s){return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
function game(G,init,first,bot){const b=new Int8Array(G.N).fill(-1);for(const[i,c]of init)b[i]=c;let pl=first,passes=0,lc=0,lead=-1;const tmp=[],cand=[];
 while(passes<3){cand.length=0;let best=-1,bs=-1e9;
  for(let p=0;p<G.N;p++){if(b[p]>=0)continue;const n=flips(G,b,p,pl,tmp);if(!n)continue;cand.push(p);
   let s=n+rnd();if(s>bs){bs=s;best=p;}}
  if(!cand.length){passes++;pl=(pl+1)%3;continue;}passes=0;
  let p=(bot==='g'&&rnd()<.85)?best:cand[Math.floor(rnd()*cand.length)];
  flips(G,b,p,pl,tmp);b[p]=pl;for(const x of tmp)b[x]=pl;
  const c=[0,0,0];for(const v of b)if(v>=0)c[v]++;const ld=c.indexOf(Math.max(...c));if(ld!==lead){if(lead>=0)lc++;lead=ld;}
  pl=(pl+1)%3;}
 const c=[0,0,0];let emp=0;for(const v of b)v>=0?c[v]++:emp++;return{c,lc,emp};}
function evalL(G,init,N,bot){const seat=[0,0,0];let lc=0,emp=0,zero=0;for(let g=0;g<N;g++){const f=g%3,r=game(G,init,f,bot);const m=Math.max(...r.c);const w=[0,1,2].filter(k=>r.c[k]===m);for(const k of w)seat[(k-f+3)%3]+=1/w.length;lc+=r.lc;emp+=r.emp;if(Math.min(...r.c)===0)zero++;}
 const s=seat.map(x=>x/N);return{s,dev:Math.max(...s.map(x=>Math.abs(x-1/3))),lc:lc/N,emp:emp/N,zero:zero/N};}
function sym(G,base){const out=[];const k3=G.S/3;for(const[i,j,c]of base)for(let k=0;k<3;k++)out.push([i*G.S+((j+k*k3)%G.S),(c+k)%3]);return out;}
module.exports={mk,evalL,sym,seed:s=>{rnd=seed(s)}};
if(require.main===module){
 const res=[];rnd=seed(1);
 for(const[R,S]of[[4,12],[5,12],[6,12],[5,15],[6,15],[5,18]]){
  const G=mk(R,S),k3=S/3,mids=[];for(let i=Math.max(0,Math.floor(R/2)-1);i<=Math.min(R-1,Math.floor(R/2)+1);i++)for(let j=0;j<k3;j++)mids.push([i,j]);
  const seen=new Set();
  for(let t=0;t<250;t++){const pick=[];const idx=[...mids.keys()].sort(()=>rnd()-.5).slice(0,4);for(const q of idx)pick.push([...mids[q],Math.floor(rnd()*3)]);
   const key=JSON.stringify(pick.slice().sort());if(seen.has(key))continue;seen.add(key);
   const init=sym(G,pick);const e=evalL(G,init,120,'g');if(e.emp>G.N*.3)continue;res.push({R,S,pick,e});}
 }
 res.sort((a,b)=>a.e.dev-b.e.dev);
 const top=res.slice(0,25).map(r=>{const G=mk(r.R,r.S),init=sym(G,r.pick);const g=evalL(G,init,3000,'g'),x=evalL(G,init,3000,'r');return{...r,g,x,worst:Math.max(g.dev,x.dev)};}).sort((a,b)=>a.worst-b.worst);
 for(const r of top.slice(0,10))console.log(`${r.R}重x${r.S} ${JSON.stringify(r.pick)} 欲ばり:${r.g.s.map(v=>Math.round(v*100))} 気まぐれ:${r.x.s.map(v=>Math.round(v*100))} 首位交代${r.g.lc.toFixed(1)} 0個${Math.round(r.g.zero*100)}% 空き${r.g.emp.toFixed(1)}`);
}
