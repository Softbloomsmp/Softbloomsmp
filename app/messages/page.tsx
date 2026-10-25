'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {supabase,Profile} from '@/lib/supabase';
import {useAuth,Avatar} from '@/components/AppShell';
type Message={sender_id:string;recipient_id:string;created_at:string;body:string};
export default function Inbox(){
 const {user,login}=useAuth();const [people,setPeople]=useState<{profile:Profile;last:Message}[]>([]),[error,setError]=useState('');
 useEffect(()=>{
  if(!user){setPeople([]);return}let active=true;
  async function load(){
   const {data,error}=await supabase.from('direct_messages').select('sender_id,recipient_id,body,created_at').order('created_at',{ascending:false}).limit(500);
   if(!active)return;if(error){setError(error.message);return}
   const last=new Map<string,Message>();(data||[]).forEach(m=>{const peer=m.sender_id===user!.id?m.recipient_id:m.sender_id;if(!last.has(peer))last.set(peer,m)});
   if(!last.size){setPeople([]);setError('');return}
   const {data:profiles,error:profilesError}=await supabase.from('profiles').select('*').in('id',[...last.keys()]);
   if(!active)return;if(profilesError){setError(profilesError.message);return}
   setPeople((profiles||[]).map(profile=>({profile,last:last.get(profile.id)!})).sort((a,b)=>b.last.created_at.localeCompare(a.last.created_at)));setError('');
  }
  void load();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load()},10000);
  return()=>{active=false;window.clearInterval(timer)};
 },[user]);
 if(!user)return <section className="panel center"><h2>Messages 🌸</h2><p>Sign in to view your messages.</p><button className="btn" onClick={()=>login('google')}>Sign in</button></section>;
 return <section className="panel"><h2>Messages 🌸</h2>{error&&<p className="error" role="alert">{error}</p>}{people.length===0&&!error&&<p className="muted">No conversations yet. Visit someone&apos;s profile to send a message.</p>}{people.map(({profile,last})=><Link className="list-user" href={`/messages/${profile.id}`} key={profile.id}><Avatar profile={profile}/><div><strong>{profile.username}</strong><div className="muted small">{last.body.slice(0,100)}</div></div></Link>)}</section>;
}
