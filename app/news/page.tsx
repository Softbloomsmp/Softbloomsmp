'use client';
import {useCallback,useEffect,useState} from 'react';
import {ImagePlus,Newspaper,Pencil,Trash2,Send} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {useAuth} from '@/components/AppShell';

type News={id:string;author_id:string;title:string;body:string;media_url:string|null;media_type:string|null;created_at:string;updated_at:string};
type Comment={id:string;news_id:string;user_id:string;body:string;created_at:string};
type Reaction={news_id:string;user_id:string;emoji:string};
const EMOJIS=['❤️','👍','🥰','😂','😮','😢','🌸'];
export default function NewsPage(){
 const {user,profile}=useAuth();
 const [admin,setAdmin]=useState(false),[news,setNews]=useState<News[]>([]),[comments,setComments]=useState<Comment[]>([]),[reactions,setReactions]=useState<Reaction[]>([]);
 const [names,setNames]=useState<Record<string,string>>({}),[title,setTitle]=useState(''),[body,setBody]=useState(''),[file,setFile]=useState<File|null>(null);
 const [editing,setEditing]=useState<string|null>(null),[commentDraft,setCommentDraft]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=useCallback(async()=>{
  const [n,c,r]=await Promise.all([
   supabase.from('bloom_news').select('*').order('created_at',{ascending:false}).limit(100),
   supabase.from('bloom_news_comments').select('*').order('created_at',{ascending:true}).limit(1000),
   supabase.from('bloom_news_reactions').select('*').limit(5000)
  ]);
  if(n.error){setError(n.error.message);return}
  setNews((n.data||[]) as News[]);setComments((c.data||[]) as Comment[]);setReactions((r.data||[]) as Reaction[]);
  const ids=[...new Set([...(n.data||[]).map(x=>x.author_id),...(c.data||[]).map(x=>x.user_id)])];
  if(ids.length){const p=await supabase.from('profiles').select('id,username').in('id',ids);setNames(Object.fromEntries((p.data||[]).map(x=>[x.id,x.username])))}
 },[]);
 useEffect(()=>{void load();const timer=setInterval(()=>void load(),60000);return()=>clearInterval(timer)},[load]);
 useEffect(()=>{if(!user)return;void supabase.rpc('bloom_is_admin').then(r=>setAdmin(r.data===true));},[user?.id]);
 useEffect(()=>{if(!user)return;localStorage.setItem(`softbloom-news-seen-${user.id}`,new Date().toISOString());window.dispatchEvent(new Event('softbloom:news-seen'))},[user?.id,news.length]);
 async function save(){
  if(!admin||!user||!title.trim()||(!body.trim()&&!file&&!editing))return;
  setBusy(true);setError('');
  let mediaUrl:string|null=null,mediaType:string|null=null;
  if(file){
   const allowed=['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'];
   if(!allowed.includes(file.type)||file.size>25*1024*1024){setError('Use JPG, PNG, WebP, GIF, MP4 or WebM, up to 25 MB.');setBusy(false);return}
   const ext=file.name.split('.').pop()?.toLowerCase()||'bin';
   const path=`${user.id}/${crypto.randomUUID()}.${ext}`;
   const upload=await supabase.storage.from('bloom-news-media').upload(path,file,{contentType:file.type,upsert:false});
   if(upload.error){setError(upload.error.message);setBusy(false);return}
   mediaUrl=supabase.storage.from('bloom-news-media').getPublicUrl(path).data.publicUrl;
   mediaType=file.type.startsWith('video/')?'video':'image';
  }
  const payload={title:title.trim(),body:body.trim(),...(mediaUrl?{media_url:mediaUrl,media_type:mediaType}:{})};
  const result=editing?await supabase.from('bloom_news').update(payload).eq('id',editing):await supabase.from('bloom_news').insert({...payload,author_id:user.id});
  if(result.error){setError(result.error.message)}else{setEditing(null);setTitle('');setBody('');setFile(null);await load()}
  setBusy(false);
 }
 function startEdit(n:News){setEditing(n.id);setTitle(n.title);setBody(n.body);setFile(null);window.scrollTo({top:0,behavior:'smooth'})}
 async function remove(id:string){if(!admin||!confirm('Delete this news post and its comments/reactions?'))return;setBusy(true);const r=await supabase.from('bloom_news').delete().eq('id',id);if(r.error)setError(r.error.message);else await load();setBusy(false)}
 async function comment(id:string){const text=(commentDraft[id]||'').trim();if(!user||!text)return;setBusy(true);const r=await supabase.from('bloom_news_comments').insert({news_id:id,user_id:user.id,body:text});if(r.error)setError(r.error.message);else{setCommentDraft(p=>({...p,[id]:''}));await load()}setBusy(false)}
 async function react(id:string,emoji:string){if(!user)return;const old=reactions.find(r=>r.news_id===id&&r.user_id===user.id);const r=old?.emoji===emoji?await supabase.from('bloom_news_reactions').delete().eq('news_id',id).eq('user_id',user.id):await supabase.from('bloom_news_reactions').upsert({news_id:id,user_id:user.id,emoji},{onConflict:'news_id,user_id'});if(r.error)setError(r.error.message);else await load()}
 return <section className="sb-news-page">
  <div className="sb-news-card"><h1><Newspaper size={23} style={{display:'inline',verticalAlign:'middle'}}/> SoftBloomSMP News</h1><p>Official server announcements, events and updates from the SoftBloomSMP team. 🌸</p></div>
  {error&&<p role="alert" className="sb-news-error">{error}</p>}
  {admin&&<div className="sb-news-card"><h2>{editing?'Edit announcement':'Publish an announcement'}</h2><div style={{display:'grid',gap:10}}>
   <input aria-label="News title" placeholder="Announcement title" maxLength={140} value={title} onChange={e=>setTitle(e.target.value)}/>
   <textarea aria-label="News content" placeholder="Write the news here..." maxLength={10000} value={body} onChange={e=>setBody(e.target.value)}/>
   <div className="sb-news-actions">{EMOJIS.map(e=><button key={e} type="button" onClick={()=>setBody(v=>v+e)}>{e}</button>)}</div>
   <label><ImagePlus size={16} style={{display:'inline'}}/> Picture or video <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
   <div className="sb-news-actions"><button type="button" disabled={busy||!title.trim()} onClick={()=>void save()}>{editing?'Save changes':'Publish news'}</button>{editing&&<button type="button" onClick={()=>{setEditing(null);setTitle('');setBody('');setFile(null)}}>Cancel edit</button>}</div>
  </div></div>}
  {!news.length&&<div className="sb-news-card">No news announcements yet. Check back soon! 🌷</div>}
  {news.map(n=><article className="sb-news-card" key={n.id}>
   <h2>{n.title}</h2><p className="sb-news-meta">By @{names[n.author_id]||'SoftBloom Team'} · {new Date(n.created_at).toLocaleString()}{n.updated_at!==n.created_at?' · Edited':''}</p>
   <p className="sb-news-body">{n.body}</p>
   {n.media_url&&(n.media_type==='video'?<video className="sb-news-media" src={n.media_url} controls preload="metadata"/>:<img className="sb-news-media" src={n.media_url} alt={`Media for ${n.title}`} loading="lazy"/>)}
   {admin&&<div className="sb-news-actions"><button onClick={()=>startEdit(n)}><Pencil size={14}/> Edit</button><button disabled={busy} onClick={()=>void remove(n.id)}><Trash2 size={14}/> Delete</button></div>}
   <div className="sb-news-actions">{EMOJIS.map(e=><button key={e} type="button" onClick={()=>void react(n.id,e)} style={{fontWeight:reactions.some(r=>r.news_id===n.id&&r.user_id===user?.id&&r.emoji===e)?900:400}}>{e} {reactions.filter(r=>r.news_id===n.id&&r.emoji===e).length||''}</button>)}</div>
   <h3>Comments ({comments.filter(c=>c.news_id===n.id).length})</h3>
   {comments.filter(c=>c.news_id===n.id).map(c=><div className="sb-news-comment" key={c.id}><strong>@{names[c.user_id]||'Member'}</strong> <span className="sb-news-meta">{new Date(c.created_at).toLocaleString()}</span><p className="sb-news-body">{c.body}</p>{(admin||c.user_id===user?.id)&&<div className="sb-news-actions"><button onClick={async()=>{if(!confirm('Delete this comment?'))return;const r=await supabase.from('bloom_news_comments').delete().eq('id',c.id);if(r.error)setError(r.error.message);else await load()}}>Delete comment</button></div>}</div>)}
   <div style={{display:'flex',gap:8,marginTop:12}}><input aria-label="Write a comment" placeholder={`Comment as @${profile?.username||'member'}...`} maxLength={2000} value={commentDraft[n.id]||''} onChange={e=>setCommentDraft(p=>({...p,[n.id]:e.target.value}))}/><div className="sb-news-actions"><button disabled={busy||!commentDraft[n.id]?.trim()} onClick={()=>void comment(n.id)}><Send size={16}/></button></div></div>
  </article>)}
 </section>
}
