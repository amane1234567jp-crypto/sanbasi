// 特別なコマは「みんなの石」だけ。盤(127マス)の上の みんなの石の位置と 初期配置を探す
const {hex}=require('./s3.js');
const H=hex(6),R=6;
const rot=([q,s])=>[-(q+s),q];            // 120°回転
function sym(base){const out=new Map();for(const[q,s,c]of base){let p=[q,s];for(let k=0;k<3;k++){const id=H.id(p[0],p[1]);if(id!==undefined)out.set(id,c===3?3:(c+k)%3);p=rot(p);}}return out;}
function flips(b,p,pl,out){out.length=0;if(b[p]!==-1)return 0;for(let d=0;d<6;d++){let x=H.nb[p][d];const st=out.length;while(x>=0&&b[x]>=0&&b[x]<3&&b[x]!==pl){out.push(x);x=H.nb[x][d];}if(!(x>=0&&(b[x]===pl||b[x]===3)&&out.length>st))out.length=st;}return out.length;}
function game(init,first,bot){const b=new Int8Array(H.N).fill(-1);for(const[i,c]of init)b[i]=c;let pl=first,passes=0,mv=0,early=false,zm=0;const tmp=[],leads=[];
 while(passes<3){const cand=[];let best=-1,bs=-1e9;for(let p=0;p<H.N;p++){const n=flips(b,p,pl,tmp);if(!n)continue;cand.push(p);const s=n+Math.random();if(s>bs){bs=s;best=p;}}
  if(!cand.length){passes++;pl=(pl+1)%3;continue;}passes=0;const p=(bot==='g'&&Math.random()<.85)?best:cand[Math.floor(Math.random()*cand.length)];
  flips(b,p,pl,tmp);b[p]=pl;for(const x of tmp)b[x]=pl;mv++;
  const c=[0,0,0];for(const v of b)if(v>=0&&v<3)c[v]++;leads.push(c.indexOf(Math.max(...c)));if(Math.min(...c)===0){zm++;if(mv<=20)early=true;}pl=(pl+1)%3;}
 const c=[0,0,0];let emp=0;for(const v of b){if(v===-1)emp++;else if(v<3)c[v]++;}return{c,leads,early,zm,mv,emp};}
function ev(init,N,bot){const seat=[0,0,0];let early=0,zt=0,h90=0,big=0,emp=0,mv=0;for(let g=0;g<N;g++){const f=g%3,o=game(init,f,bot);if(!o.mv)return null;const m=Math.max(...o.c),w=[0,1,2].filter(k=>o.c[k]===m);for(const k of w)seat[(k-f+3)%3]+=1/w.length;
  early+=o.early;zt+=o.zm/o.mv;const L=o.leads.length;h90+=w.includes(o.leads[Math.floor(L*.9)]);const t=o.c[0]+o.c[1]+o.c[2];big+=m/t>=.5;emp+=o.emp;mv+=o.mv;}
 const s=seat.map(v=>v/N);return{s,dev:Math.max(...s.map(v=>Math.abs(v-1/3))),early:early/N,zt:zt/N,h90:h90/N,big:big/N,emp:emp/N,mv:mv/N};}
const corners=[[6,0,3],[-6,6,3]].concat([[0,-6,3]]);   // 120°回転で6つの角になるよう2つ
const cornerSet=[[6,0,3],[6,-6,3]];
const fmt=e=>`勝率=${e.s.map(v=>Math.round(v*100)).join('/')} 20手以内に0個=${Math.round(e.early*100)}% 0個の時間=${Math.round(e.zt*100)}% 9割首位=${Math.round(e.h90*100)}% 過半数=${Math.round(e.big*100)}% 空き=${e.emp.toFixed(1)} 手数=${Math.round(e.mv)}`;
module.exports={sym,ev,fmt,H,cornerSet};
if(require.main===module){
 // 探す：みんなの石を中ほどに3個 or 6個、石は半径4以内に 各3〜6個
 const cells=[];for(let q=-4;q<=4;q++)for(let s=-4;s<=4;s++){if(Math.max(Math.abs(q),Math.abs(s),Math.abs(q+s))<=4&&!(q===0&&s===0))cells.push([q,s]);}
 const pick=a=>a[Math.floor(Math.random()*a.length)];
 const res=[];const seen=new Set();
 for(let t=0;t<1500;t++){
  const base=[...cornerSet];
  const nw=pick([0,1,1,2]);for(let k=0;k<nw;k++){const c=pick(cells);base.push([c[0],c[1],3]);}
  if(Math.random()<.3)base.push([0,0,3]);
  const ns=pick([1,2,2,3]);for(let k=0;k<ns;k++){const c=pick(cells);base.push([c[0],c[1],Math.floor(Math.random()*3)]);}
  const init=sym(base);const key=[...init].sort().join(';');if(seen.has(key))continue;seen.add(key);
  const nst=[...init.values()].filter(v=>v<3).length,nwi=[...init.values()].filter(v=>v===3).length;
  if(nst<6)continue;
  const e=ev([...init],60,'g');if(!e||e.emp>4)continue;
  res.push({base,init:[...init],nst,nwi,e,score:e.early*2+e.zt*3+e.dev+.3*e.h90+.3*e.big});
 }
 res.sort((a,b)=>a.score-b.score);
 const top=res.slice(0,25).map(r=>{const g=ev(r.init,800,'g'),x=ev(r.init,800,'r');return{...r,g,x,score:g.early*2+g.zt*3+Math.max(g.dev,x.dev)+.3*g.h90+.3*g.big};}).sort((a,b)=>a.score-b.score);
 for(const r of top.slice(0,6)){console.log(`みんな${r.nwi}個 石${r.nst}個 ${JSON.stringify(r.base.slice(2))}`);console.log('  欲ばり '+fmt(r.g));console.log('  気まぐれ '+fmt(r.x));}
 require('fs').writeFileSync('s7-top.json',JSON.stringify(top.slice(0,6).map(r=>({base:r.base,init:r.init}))));
 console.log('候補',res.length);
}
