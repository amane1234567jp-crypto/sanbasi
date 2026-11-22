const {hex,evalL,fmt}=require('./s3.js');
const H=hex(4),ring=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]],corn=[[4,0],[4,-4],[0,-4],[-4,0],[-4,4],[0,4]];
function L({center,inner,outer,corners=true,outerShift=1}){const init=[];if(corners)for(const[q,s]of corn)init.push([H.id(q,s),3]);if(center==='w')init.push([H.id(0,0),3]);
 if(inner)ring.forEach(([q,s],i)=>init.push([H.id(q,s),i%3]));if(outer)ring.forEach(([q,s],i)=>init.push([H.id(2*q,2*s),(i+outerShift)%3]));return init;}
const V={
 'いまの形（角＋中央がみんな・各4個）':L({center:'w',inner:1,outer:1}),
 '角だけみんな・中央は空き・各4個':L({center:'e',inner:1,outer:1}),
 '角＋中央がみんな・各2個（内側だけ）':L({center:'w',inner:1}),
 '角だけみんな・中央は空き・各2個':L({center:'e',inner:1}),
};
for(const[n,i]of Object.entries(V)){const N=61-i.length;console.log(fmt(n+` 空きマス${N}(3で割ると余り${N%3})`,evalL(H,i,3000,'g')));console.log('   気まぐれに打つと 勝率='+evalL(H,i,3000,'r').s.map(v=>Math.round(v*100)).join('/'));}
