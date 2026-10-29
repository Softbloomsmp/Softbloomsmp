'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {supabase} from '@/lib/supabase';
import {useAuth} from '@/components/AppShell';

type Staff={id:string;name:string;role:string;image_url:string|null;profile_id:string|null;sort_order:number};
type Candidate={id:string;username:string};
const defaults:Staff[]=[
{id:'legacy-val',name:'Val',role:'Owner & Developer',image_url:'/softbloom-info/val.png',profile_id:null,sort_order:0},
{id:'legacy-adam',name:'Adam',role:'Admin',image_url:'/softbloom-info/adam.png',profile_id:null,sort_order:1},
{id:'legacy-nao',name:'Nao',role:'Admin',image_url:'/softbloom-info/naomi.png',profile_id:null,sort_order:2},
{id:'legacy-camilla',name:'Camilla',role:'Moderator',image_url:'/softbloom-info/camilla.png',profile_id:null,sort_order:3},
{id:'legacy-eleeyz',name:'.eleeyz',role:'Recruiter',image_url:'/softbloom-info/eleeyz.png',profile_id:null,sort_order:4}];
export default function StaffManager(){
 const {user}=useAuth();
 const [admin,setAdmin]=useState(false),[staff,setStaff]=useState<Staff[]>([]),[ready,setReady]=useState(false),[error,setError]=useState('');
 const [editing,setEditing]=useState<string|null>(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const [name,setName]=useState(''),[role,setRole]=useState(''),[image,setImage]=useState<File|null>(null),[existingImage,setExistingImage]=useState<string|null>(null),[linked,setLinked]=useState<Candidate|null>(null),[search,setSearch]=useState(''),[candidates,setCandidates]=useState<Candidate[]>([]);
 async function load(){const r=await supabase.from('bloom_staff').select('id,name,role,image_url,profile_id,sort_order').order('sort_order');if(r.error){setError('Staff database is not ready. Run supabase/bloom_staff.sql in Supabase.');setStaff(defaults);}else{setError('');setStaff(r.data||[]);}setReady(true);}
 useEffect(()=>{void load();},[]);
 useEffect(()=>{if(!user){setAdmin(false);return;}void supabase.rpc('bloom_is_admin').then(r=>setAdmin(r.data===true));},[user?.id]);
 useEffect(()=>{let active=true;const t=setTimeout(async()=>{if(search.trim().length<2){setCandidates([]);return;}const r=await supabase.from('profiles').select('id,username').ilike('username',`%${search.trim().replace(/[%_,]/g,'')}%`).limit(8);if(active)setCandidates(r.data||[]);},250);return()=>{active=false;clearTimeout(t);};},[search]);
 function start(item?:Staff){setEditing(item?.id||null);setName(item?.name||'');setRole(item?.role||'');setExistingImage(item?.image_url||null);setImage(null);setLinked(null);setSearch('');setCandidates([]);setError('');setOpen(true);if(item?.profile_id){void supabase.from('profiles').select('id,username').eq('id',item.profile_id).maybeSingle().then(r=>{if(r.data)setLinked(r.data);});}}
 async function save(){if(!admin||!user||busy)return;if(!name.trim()||!role.trim()){setError('Role / Position and In-game Name are required.');return;}if(name.trim().length>80||role.trim().length>100){setError('In-game Name or Role / Position is too long.');return;}if(image&&(!['image/png','image/jpeg','image/webp'].includes(image.type)||image.size>3*1024*1024)){setError('Use PNG, JPG, or WebP up to 3 MB.');return;}setBusy(true);setError('');try{
 let url=existingImage;
 if(image){const ext=image.type==='image/png'?'png':image.type==='image/webp'?'webp':'jpg';const path=`${user.id}/${crypto.randomUUID()}.${ext}`;const up=await supabase.storage.from('bloom-staff-media').upload(path,image,{contentType:image.type,upsert:false});if(up.error)throw up.error;url=supabase.storage.from('bloom-staff-media').getPublicUrl(path).data.publicUrl;}
 const values={name:name.trim(),role:role.trim(),image_url:url,profile_id:linked?.id||null};
 const result=editing?await supabase.from('bloom_staff').update(values).eq('id',editing):await supabase.from('bloom_staff').insert({...values,sort_order:staff.length});if(result.error)throw result.error;setOpen(false);await load();
 }catch(e){setError(e instanceof Error?e.message:'Unable to save staff member.');}finally{setBusy(false);}}
 async function remove(item:Staff){if(!admin||busy||!confirm(`Remove ${item.name} from the staff page?`))return;setBusy(true);const r=await supabase.from('bloom_staff').delete().eq('id',item.id);if(r.error)setError(r.error.message);else await load();setBusy(false);}
 return <section id="staff"><div className="sb-staff-heading"><div><h2>Meet the Staff</h2><p>The people who help SoftBloom grow and thrive.</p></div>{admin&&<button type="button" className="sb-staff-button" onClick={()=>start()}>+ Add More</button>}</div>
 {error&&<p role="alert" className="sb-staff-error">{error}</p>}
 <div className="sb-info-staff">{(ready?staff:defaults).map(s=><article className="sb-info-card" key={s.id}>{s.profile_id?<Link href={`/profile/${s.profile_id}`} className="sb-staff-profile">{s.image_url&&<img src={s.image_url} alt={s.name} loading="lazy"/>}<h3>{s.name}</h3></Link>:<>{s.image_url&&<img src={s.image_url} alt={s.name} loading="lazy"/>}<h3>{s.name}</h3></>}<p>{s.role}</p>{s.profile_id&&<Link href={`/profile/${s.profile_id}`} className="sb-staff-view">View profile</Link>}{admin&&<div className="sb-staff-actions"><button onClick={()=>start(s)}>Edit</button><button disabled={busy} onClick={()=>void remove(s)}>Remove</button></div>}</article>)}</div>
 {open&&admin&&<div className="sb-staff-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setOpen(false)}}><div className="sb-staff-dialog" role="dialog" aria-modal="true" aria-label={editing?'Edit staff':'Add staff'}><div className="sb-staff-heading"><h2>{editing?'Edit Staff':'Add Staff'} 🌸</h2><button disabled={busy} onClick={()=>setOpen(false)} aria-label="Close">✕</button></div><label>Role / Position<input maxLength={100} value={role} onChange={e=>setRole(e.target.value)} placeholder="e.g. Community Manager"/></label><label>In-game Name<input maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Enter Minecraft username"/></label><label>Picture (PNG, JPG, WebP · max 3 MB)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setImage(e.target.files?.[0]||null)}/></label><label>Link an existing website user (optional)<input value={search} onChange={e=>{setSearch(e.target.value);setLinked(null);}} placeholder="Search username..."/></label>{linked&&<div className="sb-staff-linked">Linked to @{linked.username} <button onClick={()=>{setLinked(null);setSearch('');}}>Unlink</button></div>}{search.trim().length>=2&&!linked&&<div className="sb-staff-results">{candidates.map(c=><button key={c.id} onClick={()=>{setLinked(c);setSearch(c.username);setCandidates([]);}}>@{c.username}</button>)}{!candidates.length&&<span>No matching users</span>}</div>}<div className="sb-staff-actions"><button disabled={busy} onClick={()=>setOpen(false)}>Cancel</button><button className="sb-staff-button" disabled={busy} onClick={()=>void save()}>{busy?'Saving...':'Save Staff'}</button></div></div></div>}
 </section>;
}
