'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {supabase} from '@/lib/supabase';
import './reaction-viewer.css';

type ReactionEntry={user_id:string;emoji:string};
type Person={id:string;username:string|null;avatar_url:string|null};
export default function ReactionViewer({reactions,label='See who reacted'}:{reactions:ReactionEntry[];label?:string}){
 const [open,setOpen]=useState(false);
 const [people,setPeople]=useState<Record<string,Person>>({});
 const [loading,setLoading]=useState(false);
 const ids=[...new Set(reactions.map(r=>r.user_id))];
 const key=ids.join(',');
 useEffect(()=>{
  if(!open||!ids.length)return;
  let active=true;
  setLoading(true);
  void supabase.from('profiles').select('id,username,avatar_url').in('id',ids).then(({data,error})=>{
   if(!active)return;
   if(error)console.warn('Reaction profiles unavailable',error.message);
   setPeople(Object.fromEntries((data||[]).map(p=>[p.id,p as Person])));
   setLoading(false);
  });
  return()=>{active=false};
 // key captures the relevant user IDs; reactions may change emoji without refetching profiles
 },[open,key]);
 if(!reactions.length)return null;
 return <span className="sb-react-view" onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}>
  <button type="button" className="sb-react-view-trigger" aria-label={label} aria-expanded={open} onClick={()=>setOpen(v=>!v)} onFocus={()=>setOpen(true)}>{label}</button>
  {open&&<span className="sb-react-view-popover" role="group" aria-label="People who reacted">
   <span className="sb-react-view-title">Reactions ({reactions.length})</span>
   {loading&&<span className="sb-react-view-loading">Loading names…</span>}
   <span className="sb-react-view-list">{reactions.map(r=><Link key={r.user_id} href={`/profile/${r.user_id}`} className="sb-react-view-person" title="Open profile">
    {people[r.user_id]?.avatar_url?<img src={people[r.user_id].avatar_url!} alt="" loading="lazy"/>:<span className="sb-react-view-avatar">👤</span>}
    <span className="sb-react-view-name">@{people[r.user_id]?.username||'Member'}</span>
    <span className="sb-react-view-emoji">{r.emoji}</span>
   </Link>)}</span>
  </span>}
 </span>;
}
