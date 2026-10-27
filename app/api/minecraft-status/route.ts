import {NextResponse} from 'next/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type StatusResponse={online:boolean;playersOnline:number|null;playersMax:number|null;checkedAt:string;source:'java'|'bedrock'|null};
type ProviderResponse={online?:boolean;players?:{online?:number;max?:number}};
async function check(edition:'java'|'bedrock',address:string):Promise<ProviderResponse|null>{
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),5000);
 try{
  const response=await fetch(`https://api.mcstatus.io/v2/status/${edition}/${encodeURIComponent(address)}`,{signal:controller.signal,next:{revalidate:30}});
  if(!response.ok)return null;
  return await response.json() as ProviderResponse;
 }catch{return null}finally{clearTimeout(timeout)}
}
export async function GET(){
 const [java,bedrock]=await Promise.all([check('java','softbloomsmp.site'),check('bedrock','softbloomsmp.site:12006')]);
 if(!java&&!bedrock)return NextResponse.json({error:'Status provider unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
 const source=java?.online?'java':bedrock?.online?'bedrock':null;
 const selected=source==='java'?java:source==='bedrock'?bedrock:null;
 const result:StatusResponse={online:!!source,playersOnline:typeof selected?.players?.online==='number'?selected.players.online:null,playersMax:typeof selected?.players?.max==='number'?selected.players.max:null,checkedAt:new Date().toISOString(),source};
 return NextResponse.json(result,{headers:{'Cache-Control':'public, s-maxage=30, stale-while-revalidate=30'}});
}
