#!/usr/bin/env node
/** Small capped Wikidata CC0 bilingual title discovery, use official dumps for bulk. */
import fs from 'node:fs';
const args=process.argv.slice(2),arg=k=>args.includes(k)?args[args.indexOf(k)+1]:undefined;
const types={music:'Q482994',film:'Q11424',literature:'Q8261',anime:'Q1107',games:'Q7889'};
const kind=arg('--kind')||'film',limit=Math.min(Math.max(Number(arg('--limit')||50),1),200),email=process.env.CATALOG_CONTACT_EMAIL;
if(!types[kind]||!email){console.error('Usage: CATALOG_CONTACT_EMAIL=you@example.com node scripts/fetch-wikidata.mjs --kind film --limit 50');process.exit(1);}
const query=`SELECT ?work ?title ?ko ?year ?creatorLabel ?countryLabel WHERE {
 ?work wdt:P31 wd:${types[kind]}; rdfs:label ?title.
 FILTER(LANG(?title)="en")
 OPTIONAL {?work rdfs:label ?ko. FILTER(LANG(?ko)="ko")}
 OPTIONAL {?work wdt:P577 ?published. BIND(YEAR(?published) AS ?year)}
 OPTIONAL {?work wdt:P57|wdt:P50|wdt:P175|wdt:P178 ?creator. ?creator rdfs:label ?creatorLabel. FILTER(LANG(?creatorLabel)="en")}
 OPTIONAL {?work wdt:P495 ?country. ?country rdfs:label ?countryLabel. FILTER(LANG(?countryLabel)="en")}
} LIMIT ${limit}`;
const url='https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(query);
const response=await fetch(url,{headers:{'User-Agent':`larper101/0.1 (${email})`,'Accept':'application/sparql-results+json'}});
if(!response.ok){console.error('Wikidata HTTP',response.status);process.exit(1);}
const rows=(await response.json()).results.bindings,items=new Map();
for(const r of rows){
 const get=x=>r[x]?.value||'',id=get('work').split('/').pop();if(!id||!get('title'))continue;
 const work=items.get(id)||{sourceId:id,kind,title:get('title'),titleKo:get('ko'),creator:get('creatorLabel'),
  year:Number(get('year'))||null,country:get('countryLabel'),genres:[],ratingCount:null,verified:true,sourceUrl:`https://www.wikidata.org/wiki/${id}`};
 if(!work.titleKo)work.titleKo=get('ko');items.set(id,work);
}
const out=arg('--out')||`wikidata-${kind}.jsonl`;
fs.writeFileSync(out,[...items.values()].map(w=>JSON.stringify(w)).join('\n')+'\n');
console.log(JSON.stringify({source:'wikidata',count:items.size,out,scoringReady:false}));
