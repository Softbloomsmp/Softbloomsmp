import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store'};
export async function POST(request:NextRequest){
 const secret=process.env.SOFTBLOOM_BRIDGE_SECRET;
 if(!secret||secret.length<32||request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401,headers:noStore});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:'Bridge not configured'},{status:503,headers:noStore});
 let body:Record<string,unknown>;
 try{body=await request.json() as Record<string,unknown>}catch{return NextResponse.json({error:'Invalid JSON'},{status:400,headers:noStore})}
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 let functionName:string;let args:Record<string,unknown>;
 if(body.action==='register'&&typeof body.uuid==='string'&&typeof body.name==='string'&&['java','bedrock'].includes(String(body.platform))){
  functionName='bloom_bridge_register_player';args={p_uuid:body.uuid,p_name:body.name,p_platform:body.platform};
 }else if(body.action==='claim'){
  functionName='bloom_bridge_claim_delivery';args={};
 }else if(body.action==='stash'&&typeof body.uuid==='string'){
  functionName='bloom_bridge_list_stash';args={p_uuid:body.uuid};
 }else if(body.action==='stash_claim'&&typeof body.uuid==='string'&&typeof body.orderId==='string'){
  functionName='bloom_bridge_claim_stash';args={p_uuid:body.uuid,p_order:body.orderId};
 }else if(body.action==='finish'&&typeof body.orderId==='string'&&typeof body.success==='boolean'){
  functionName='bloom_bridge_finish_delivery';args={p_order:body.orderId,p_success:body.success,p_error:typeof body.error==='string'?body.error.slice(0,500):null};
 }else return NextResponse.json({error:'Invalid action'},{status:400,headers:noStore});
 const {data,error}=await db.rpc(functionName,args);
 if(error)return NextResponse.json({error:'Bridge operation failed'},{status:500,headers:noStore});
 return NextResponse.json({data:data??null},{headers:noStore});
}
