import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'crypto';

export const runtime='nodejs';
const ALLOWED:Record<string,{ext:string;limit:number;type:'image'|'video'}>={
 'image/png':{ext:'png',limit:3*1024*1024,type:'image'},
 'image/jpeg':{ext:'jpg',limit:3*1024*1024,type:'image'},
 'image/gif':{ext:'gif',limit:3*1024*1024,type:'image'},
 'image/webp':{ext:'webp',limit:3*1024*1024,type:'image'},
 'video/mp4':{ext:'mp4',limit:10*1024*1024,type:'video'},
 'video/webm':{ext:'webm',limit:10*1024*1024,type:'video'}
};
function json(error:string,status:number){return NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}})}
// Only creates a short-lived upload token. File bytes go straight from the browser to Supabase.
export async function POST(req:NextRequest){
 try{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!anon||!secret)return json('Media uploads are not configured.',503);
  const origin=req.headers.get('origin');
  if(origin&&origin!==new URL(req.url).origin)return json('Origin rejected.',403);
  const bearer=req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if(!bearer)return json('Please sign in before uploading.',401);
  const length=Number(req.headers.get('content-length')||0);
  if(length>4096)return json('Invalid upload request.',413);
  const payload=await req.json();
  if(!payload||typeof payload.type!=='string'||typeof payload.size!=='number'||!Number.isSafeInteger(payload.size))return json('Invalid upload metadata.',400);
  const config=ALLOWED[payload.type];
  if(!config||payload.size<1||payload.size>config.limit)return json('Unsupported media type or file exceeds the allowed size.',400);
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await auth.auth.getUser(bearer);
  if(authError||!user)return json('Your session has expired. Please sign in again.',401);
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const path=`${user.id}/${randomUUID()}.${config.ext}`;
  const {data,error}=await admin.storage.from('post-media').createSignedUploadUrl(path);
  if(error||!data?.token)return json('Could not prepare media upload.',500);
  const {data:publicData}=admin.storage.from('post-media').getPublicUrl(path);
  return NextResponse.json({path,token:data.token,url:publicData.publicUrl,type:config.type},{headers:{'Cache-Control':'no-store'}});
 }catch{return json('Could not prepare media upload.',400)}
}
