const {hex}=require('./s3.js');
const H=hex(6),R=6,ring=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
function flips(b,p,pl,out){out.length=0;if(b[p]!==-1)return 0;for(let d=0;d<6;d++){let x=H.nb[p][d];const st=out.length;while(x>=0&&b[x]>=0&&b[x]<3&&b[x]!==pl){out.push(x);x=H.nb[x][d];}if(!(x>=0&&(b[x]===pl||b[x]===3)&&out.length>st))out.length=st;}return out.length;}
function game(init,first,protect,bot){const b=new Int8Array(H.N).fill(-1);for(const[i,c]of init)b[i]=c;let pl=first,passes=0,mv=0,early=false,zeroMoves=0,firstZero=-1;const tmp=[],leads=[];
 while(passes<3){const cand=[];let best=-1,bs=-1e9;for(let p=0;p<H.N;p++){const n=flips(b,p,pl,tmp);if(!n)continue;cand.push(p);const s=n+Math.random();if(s>bs){bs=s;best=p;}}
  if(!cand.length){passes++;pl=(pl+1)%3;continue;}passes=0;const p=(bot==='g'&&Math.random()<.85)?best:cand[Math.floor(Math.random()*cand.length)];
  flips(b,p,pl,tmp);const f=new Set(tmp);
  if(protect)for(let k=0;k<3;k++){if(k===pl)continue;const mine=[];for(let i=0;i<H.N;i++)if(b[i]===k)mine.push(i);if(mine.length&&mine.every(i=>f.has(i)))f.delete(mine[mine.length-1]);}
  b[p]=pl;for(const x of f)b[x]=pl;mv++;
  const c=[0,0,0];for(const v of b)if(v>=0&&v<3)c[v]++;leads.push(c.indexOf(Math.max(...c)));
  if(Math.min(...c)===0){zeroMoves++;if(firstZero<0)firstZero=mv;if(mv<=15)early=true;}
  pl=(pl+1)%3;}
 const c=[0,0,0];for(const v of b)if(v>=0&&v<3)c[v]++;return{c,leads,early,zeroMoves,mv};}
function ev(name,init,protect,N=1500){for(const bot of['g','r']){const seat=[0,0,0];let early=0,zm=0,mv=0,h90=0,big=0;
 for(let g=0;g<N;g++){const f=g%3,o=game(init,f,protect,bot),m=Math.max(...o.c),w=[0,1,2].filter(k=>o.c[k]===m);for(const k of w)seat[(k-f+3)%3]+=1/w.length;
  early+=o.early;zm+=o.zeroMoves/o.mv;mv+=o.mv;const L=o.leads.length;if(L)h90+=w.includes(o.leads[Math.floor(L*.9)]);const t=o.c[0]+o.c[1]+o.c[2];big+=m/t>=.5;}
 console.log(`${name} [${bot==='g'?'欲ばり':'気まぐれ'}] 勝率=${seat.map(v=>Math.round(v/N*100)).join('/')} 15手以内に誰かが0個=${Math.round(early/N*100)}% 0個の人がいる時間=${Math.round(zm/N*100)}% 9割時点の首位が勝つ=${Math.round(h90/N*100)}% 過半数=${Math.round(big/N*100)}% 手数=${Math.round(mv/N)}`);}}
const W=ring.map(([q,s])=>[H.id(R*q,R*s),3]);
const in6=ring.map(([q,s],i)=>[H.id(q,s),i%3]);
const out6=ring.map(([q,s],i)=>[H.id(2*q,2*s),(i+1)%3]);
const mid6=[[2,-1],[1,-2],[-1,-1],[-2,1],[-1,2],[1,1]].map(([q,s],i)=>[H.id(q,s),(i+2)%3]);
ev('いまの形（各2個）',[...W,...in6],false);
ev('各2個＋最後の1個は取られない',[...W,...in6],true);
ev('各4個（外側に次の色）',[...W,...in6,...out6],false);
ev('各6個（2重の輪）',[...W,...in6,...out6,...mid6],false);
ev('各4個＋最後の1個は取られない',[...W,...in6,...out6],true);
console.log('--- 中央にも みんなの石');
const C=[[H.id(0,0),3]];
ev('中央みんな＋各2個',[...W,...C,...in6],false);
ev('中央みんな＋各4個',[...W,...C,...in6,...out6],false);
ev('中央みんな＋各2個（外側の輪に置く）',[...W,...C,...out6],false);
