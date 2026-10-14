import {canonical,phoneticKeys,suggestWorks,exactWorks} from './title-match.mjs';
import type {Kind,Work} from './types';

type ShardManifest={version:number;total:number;prefixes:Record<string,{files:string[];count:number}>};
const cache=new Map<string,Promise<Work[]>>();
let manifestPromise:Promise<ShardManifest|null>|undefined;
const root=`${import.meta.env.BASE_URL}catalog-shards/`;
const keyFor=(value:string)=>Array.from(canonical(value).replaceAll(' ','')).slice(0,2).join('');
const cleanWork=(w:Work)=>({...w,popularity:50});
const getManifest=()=>manifestPromise??=fetch(root+'manifest.json').then(async r=>r.ok?await r.json() as ShardManifest:null).catch(()=>null);
const getFile=(filename:string)=>{if(!/^[a-z0-9-]+\.json$/i.test(filename))return Promise.resolve([] as Work[]);
 let pending=cache.get(filename);if(!pending){pending=fetch(root+filename).then(async r=>r.ok?(await r.json() as Work[]).map(cleanWork):[]).catch(()=>[]);cache.set(filename,pending);}return pending;
};
/** Fetch only the prefixes relevant to the query. Never fetch the whole catalog on initial load. */
export async function staticCatalogMatches(query:string,kind:Kind,limit=7):Promise<Work[]>{
 if(canonical(query).length<2)return [];
 const manifest=await getManifest();if(!manifest?.prefixes)return [];
 const keys=[...new Set(phoneticKeys(query).map(keyFor))].filter(k=>Array.from(k).length>=2);
 const filenames=[...new Set(keys.flatMap(k=>manifest.prefixes[k]?.files||[]))];
 if(!filenames.length)return [];
 const arrays=await Promise.all(filenames.map(getFile));
 const seen=new Set<string>(),pool:Work[]=[];
 for(const work of arrays.flat()){if((kind==='any'||kind===work.kind)&&!seen.has(work.id)){seen.add(work.id);pool.push(work);}}
 return suggestWorks(query,pool,limit);
}
export async function staticCatalogExact(query:string,kind:Kind):Promise<Work[]>{
 if(canonical(query).length<2)return [];
 const manifest=await getManifest();if(!manifest?.prefixes)return [];
 const keys=[...new Set(phoneticKeys(query).map(keyFor))].filter(k=>Array.from(k).length>=2);
 const filenames=[...new Set(keys.flatMap(k=>manifest.prefixes[k]?.files||[]))];
 const arrays=await Promise.all(filenames.map(getFile));
 const seen=new Set<string>();
 return exactWorks(query,arrays.flat().filter(w=>{if((kind!=='any'&&kind!==w.kind)||seen.has(w.id))return false;seen.add(w.id);return true;}));
}
export async function staticCatalogStats(){const manifest=await getManifest();return manifest?{total:manifest.total,prefixes:Object.keys(manifest.prefixes).length}:null;}
