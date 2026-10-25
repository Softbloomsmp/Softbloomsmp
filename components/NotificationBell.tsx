'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Bell,CheckCheck} from 'lucide-react';
import {supabase} from '@/lib/supabase';

type Notice={id:string;actor_id:string;kind:string;post_id:string|null;post_owner_id:string|null;comment_id:string|null;created_at:string;read_at:string|null;actor?:{username:string;avatar_url:string|null}|null};
const labels:Record<string,string>={post_reaction:'reacted to your post',comment:'commented on your post',reply:'replied to your comment',comment_reaction:'reacted to your comment',message:'sent you a message',follow:'started following you'};
export function NotificationBell({userId}:{userId:string|null}){
 const [items,setItems]=useState<Notice[]>([]),[open,setOpen]=useState(false),[error,setError]=useState(''),[unread,setUnread]=useState(0);
 const ref=useRef<HTMLDivElement>(null);
 const load=useCallback(async()=>{
  if(!userId){setItems([]);setUnread(0);return}
  const {data,error}=await supabase.from('notifications').select('id,actor_id,kind,post_id,post_owner_id,comment_id,created_at,read_at').eq('recipient_id',userId).order('created_at',{ascending:false}).limit(80);
  if(error){setError(error.message);return}
  const rows=(data||[]) as Notice[];
  const {count}=await supabase.from('notifications').select('id',{head:true,count:'exact'}).eq('recipient_id',userId).is('read_at',null);
  if(count!==null)setUnread(count);
  const ids=[...new Set(rows.map(r=>r.actor_id))];
  const {data:people}=ids.length?await supabase.from('profiles').select('id,username,avatar_url').in('id',ids):{data:[]};
  const map=new Map((people||[]).map(p=>[p.id,p]));
  setItems(rows.map(n=>({...n,actor:map.get(n.actor_id)||null})));setError('');
 },[userId]);
 useEffect(()=>{void load();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load()},10000);const onFocus=()=>void load();window.addEventListener('focus',onFocus);return()=>{window.clearInterval(timer);window.removeEventListener('focus',onFocus)}},[load]);
 useEffect(()=>{const listener=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)};document.addEventListener('mousedown',listener);return()=>document.removeEventListener('mousedown',listener)},[]);
 async function mark(id:string){if(!userId)return;const {error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('recipient_id',userId);if(!error){setItems(old=>old.map(n=>n.id===id?{...n,read_at:new Date().toISOString()}:n));setUnread(v=>Math.max(0,v-1))}else setError(error.message)}
 async function markAll(){if(!userId||!unread)return;const {error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('recipient_id',userId).is('read_at',null);if(error)setError(error.message);else{setItems(old=>old.map(n=>({...n,read_at:n.read_at||new Date().toISOString()})));setUnread(0)}}
 if(!userId)return null;
 return <div className="sb-notification" ref={ref}>
 <button className="sb-notification-trigger" type="button" aria-label={`Notifications, ${unread} unread`} aria-expanded={open} onClick={()=>{setOpen(v=>!v);void load()}}><Bell size={22}/>{unread>0&&<span className="sb-notification-count">{unread>99?'99+':unread}</span>}</button>
 {open&&<section className="sb-notification-panel" aria-label="Notifications">
 <div className="sb-notification-head"><strong>Notifications 🌸</strong><button type="button" onClick={()=>void markAll()} disabled={!unread} title="Mark all as read"><CheckCheck size={18}/> Mark all read</button></div>
 {error&&<p className="error">{error}</p>}
 {!items.length&&!error&&<p className="muted" style={{padding:18}}>No notifications yet.</p>}
 <div className="sb-notification-list">{items.map(n=><Link key={n.id} className={`sb-notification-item ${n.read_at?'':'unread'}`} href={n.kind==='message'?`/messages/${n.actor_id}`:n.kind==='follow'?`/profile/${n.actor_id}`:n.post_id?`/profile/${n.post_owner_id||n.actor_id}/posts?post=${n.post_id}${n.comment_id?`&comment=${n.comment_id}`:''}`:'/'} onClick={()=>{setOpen(false);void mark(n.id)}}>
 <span className="sb-notification-dot">{n.read_at?'':'●'}</span><span><strong>{n.actor?.username||'A member'}</strong> {labels[n.kind]||'interacted with you'}<small>{new Date(n.created_at).toLocaleString()}</small></span></Link>)}</div>
 </section>}</div>;
}
