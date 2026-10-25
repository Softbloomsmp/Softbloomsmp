import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'crypto';
export const runtime='nodejs';
const allowed=new Map([['image/png',{ext:'png',limit:3*1024*1024}],['image/jpeg',{ext:'jpg',limit:3*1024*1024}],['image/gif',{ext:'gif',limit:3*1024*1024}],['image/webp',{ext:'webp',limit:3*1024*1024}],['video/mp4',{ext:'mp4',limit:10*1024*1024}],['video/webm',{ext:'webm',limit:10*1024*1024}]]);
function validSignature(mime:string,b:Buffer){if(mime==='image/png')return b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));if(mime==='image/jpeg')return b[0]===255&&b[1]===216&&b[2]===255;if(mime==='image/gif')return b.subarray(0,3).toString()==='GIF';if(mime==='image/webp')return b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP';if(mime==='video/mp4')return b.subarray(4,8).toString()==='ftyp';if(mime==='video/webm')return b.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));return false}
export async function POST(req:NextRequest){try{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!anon||!secret)return NextResponse.json({error:'Server is not configured'},{status:503});
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return NextResponse.json({error:'Origin rejected'},{status:403});
 const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];if(!token)return NextResponse.json({error:'Authentication required'},{status:401});
 const auth=createClient(url,anon,{auth:{persistSession:false}});const {data:{user},error}=await auth.auth.getUser(token);if(error||!user)return NextResponse.json({error:'Invalid session'},{status:401});
 const contentLength=Number(req.headers.get('content-length')||0);if(contentLength>11*1024*1024)return NextResponse.json({error:'File too large'},{status:413});
 const form=await req.formData();const file=form.get('file');if(!(file instanceof File))return NextResponse.json({error:'Missing file'},{status:400});const cfg=allowed.get(file.type);if(!cfg||file.size>cfg.limit||file.size===0)return NextResponse.json({error:'Unsupported file or size exceeds limit'},{status:400});
 const bytes=Buffer.from(await file.arrayBuffer());if(!validSignature(file.type,bytes))return NextResponse.json({error:'File signature does not match type'},{status:400});
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const path=`${user.id}/${randomUUID()}.${cfg.ext}`;const {error:uploadError}=await admin.storage.from('post-media').upload(path,bytes,{contentType:file.type,upsert:false,cacheControl:'3600'});if(uploadError)return NextResponse.json({error:'Could not upload media'},{status:500});const {data}=admin.storage.from('post-media').getPublicUrl(path);
 return NextResponse.json({url:data.publicUrl,type:file.type.startsWith('image/')?'image':'video'},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Upload failed'},{status:500})}}
