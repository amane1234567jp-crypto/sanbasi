const {hex,evalL,fmt}=require('./s3.js');
const ring=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
for(const R of[4,5,6]){const H=hex(R);
 const base=[];for(const[q,s]of ring)base.push([H.id(R*q,R*s),3]);
 const a=[...base];ring.forEach(([q,s],i)=>a.push([H.id(q,s),i%3]));
 const b=[...a];b.push([H.id(0,0),3]);
 for(const[n,init]of[['角だけみんな・各2個',a],['角＋中央みんな・各2個',b]]){const e=evalL(H,init,2000,'g'),x=evalL(H,init,2000,'r');
  console.log(fmt(`1辺${R+1}マス(${H.N}マス) ${n} 空き${H.N-init.length}(余り${(H.N-init.length)%3})`,e)+' 気まぐれ='+x.s.map(v=>Math.round(v*100)).join('/'));}}
