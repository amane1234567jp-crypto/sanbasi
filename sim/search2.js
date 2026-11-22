const L=require('./search.js');L.seed(7);
const res=[];
for(const[R,S]of[[4,12],[5,12],[6,12],[5,15],[6,15]]){
 const G=L.mk(R,S),k3=S/3,mids=[];for(let i=0;i<R;i++)for(let j=0;j<k3;j++)mids.push([i,j]);
 const seen=new Set();let r=1;const rnd=()=>{r=(r*1103515245+12345)>>>0;return r/4294967296;};
 for(let t=0;t<500;t++){const idx=[...mids.keys()].sort(()=>rnd()-.5).slice(0,4);const pick=idx.map(q=>[...mids[q],Math.floor(rnd()*3)]);
  const key=JSON.stringify(pick.slice().sort());if(seen.has(key))continue;seen.add(key);
  const init=L.sym(G,pick),e=L.evalL(G,init,150,'g');if(e.emp>3)continue;res.push({R,S,pick,e});}
}
res.sort((a,b)=>a.e.dev-b.e.dev);
const top=res.slice(0,30).map(r=>{const G=L.mk(r.R,r.S),init=L.sym(G,r.pick);const g=L.evalL(G,init,4000,'g'),x=L.evalL(G,init,4000,'r');return{...r,g,x,worst:Math.max(g.dev,x.dev)};}).sort((a,b)=>a.worst-b.worst);
for(const r of top.slice(0,8))console.log(`${r.R}重x${r.S} ${JSON.stringify(r.pick)} 欲ばり:${r.g.s.map(v=>Math.round(v*100))} 気まぐれ:${r.x.s.map(v=>Math.round(v*100))} 首位交代${r.g.lc.toFixed(1)} 0個${Math.round(r.g.zero*100)}% 空き${r.g.emp.toFixed(1)} 候補数${res.length}`);
