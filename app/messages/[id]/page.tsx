'use client';
import {useCallback,useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {supabase,Profile} from '@/lib/supabase';
import {Avatar,useAuth} from '@/components/AppShell';
type DM={id:string;sender_id:string;recipient_id:string;body:string;created_at:string};
export default function MessagePage(){
 const {id}=useParams<{id:string}>();const {user,login}=useAuth();
 const [recipient,setRecipient]=useState<Profile|null>(null),[messages,setMessages]=useState<DM[]>([]),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=useCallback(async()=>{
  if(!user||!id||id===user.id)return;
  const {data,error}=await supabase.from('direct_messages').select('id,sender_id,recipient_id,body,created_at')
   .or(`and(sender_id.eq.${user.id},recipient_id.eq.${id}),and(sender_id.eq.${id},recipient_id.eq.${user.id})`)
   .order('created_at',{ascending:true}).limit(200);
  if(error){setError(error.message);return}setMessages(data||[]);setError('');
 },[user,id]);
 useEffect(()=>{if(id)void supabase.from('profiles').select('*').eq('id',id).maybeSingle().then(({data})=>setRecipient(data))},[id]);
 useEffect(()=>{void load();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load()},5000);return()=>window.clearInterval(timer)},[load]);
 async function send(e:React.FormEvent){e.preventDefault();if(!user||!recipient||!draft.trim()||busy)return;setBusy(true);setError('');const {error:sendError}=await supabase.from('direct_messages').insert({sender_id:user.id,recipient_id:id,body:draft.trim()});if(sendError)setError(sendError.message);else{setDraft('');await load()}setBusy(false)}
 if(!user)return <section className="panel center"><h2>Private Messages 🌸</h2><p>Sign in to message community members.</p><button className="btn" onClick={()=>login('google')}>Sign in</button></section>;
 if(id===user.id)return <section className="panel">You cannot message yourself. <Link href={`/profile/${id}`}>Back to profile</Link></section>;
 return <section className="panel dm-panel"><div className="row between"><div className="row"><Avatar profile={recipient}/><div><strong>{recipient?.username||'Member'}</strong><div className="muted small">Private conversation</div></div></div><Link className="btn outline" href={`/profile/${id}`}>Profile</Link></div>
 <div className="dm-history" aria-live="polite">{messages.length===0&&<p className="muted center">No messages yet. Say hello! 🌸</p>}{messages.map(m=><div key={m.id} className={`dm-bubble ${m.sender_id===user.id?'mine':''}`}><div>{m.body}</div><small>{new Date(m.created_at).toLocaleString()}</small></div>)}</div>
 {error&&<p className="error" role="alert">{error}</p>}
 <form className="row" onSubmit={send}><input className="field" aria-label="Message" placeholder="Write a message..." value={draft} maxLength={2000} onChange={e=>setDraft(e.target.value)} required/><button className="btn" disabled={busy||!draft.trim()||!recipient}>Send</button></form></section>;
}
