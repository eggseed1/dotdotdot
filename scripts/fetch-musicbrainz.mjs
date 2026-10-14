#!/usr/bin/env node
/** SMALL respectful MusicBrainz discovery, not full harvesting. Use CC0 dumps for bulk.
 * API allows <=1 request/sec with a genuine identifying User-Agent.
 * Supplementary tags/ratings are NOT CC0 and are not copied.
 */
import fs from 'node:fs';
const argv=process.argv.slice(2),arg=k=>argv.includes(k)?argv[argv.indexOf(k)+1]:undefined;
const contact=process.env.CATALOG_CONTACT_EMAIL;
if(!contact){console.error('Set CATALOG_CONTACT_EMAIL so MusicBrainz can identify the application.');process.exit(1);}
const count=Math.min(Math.max(Number(arg('--limit')||100),1),5000),query=arg('--query')||'primarytype:album';
const out=arg('--out')||'musicbrainz-sample.jsonl',pause=ms=>new Promise(r=>setTimeout(r,ms));
let written=0;const output=fs.createWriteStream(out,{flags:'w'});
try{
 for(let offset=0;offset<count;offset+=100){
  const url=new URL('https://musicbrainz.org/ws/2/release-group/');
  url.searchParams.set('query',query);url.searchParams.set('fmt','json');
  url.searchParams.set('limit',String(Math.min(100,count-offset)));url.searchParams.set('offset',String(offset));
  const response=await fetch(url,{headers:{'User-Agent':`larper101/0.1 (${contact})`,'Accept':'application/json'}});
  if(!response.ok)throw Error(`MusicBrainz HTTP ${response.status}; stopping`);
  const json=await response.json();
  for(const item of json['release-groups']||[]){
   const year=/^\d{4}/.exec(item['first-release-date']||'');
   output.write(JSON.stringify({kind:'music',title:item.title,creator:(item['artist-credit']||[]).filter(a=>a.artist).map(a=>a.artist.name).join(', '),
    year:year?Number(year[0]):null,sourceId:item.id,sourceUrl:`https://musicbrainz.org/release-group/${item.id}`,
    genres:[],aliases:[],ratingCount:null,verified:true})+'\n');written++;
  }
  if(!(json['release-groups']||[]).length)break;
  if(offset+100<count)await pause(1200);
 }
}catch(e){console.error(e.message);process.exitCode=1;}finally{output.end();}
console.log(JSON.stringify({written,out,source:'musicbrainz',scoringReady:false}));
