'use client';
import {useCallback,useEffect,useState,useRef} from 'react';
import {createPortal} from 'react-dom';
import {Image as ImageIcon,Video,Pencil,Trash2,Send} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {useAuth,Avatar} from '@/components/AppShell';
import Link from 'next/link';
import ReactionViewer from '@/components/ReactionViewer';

type News={id:string;author_id:string;title:string;body:string;media_url:string|null;media_type:string|null;created_at:string;updated_at:string};
type Comment={id:string;news_id:string;user_id:string;body:string;created_at:string;parent_id:string|null};
type CommentReaction={comment_id:string;user_id:string;emoji:string};
type Reaction={news_id:string;user_id:string;emoji:string};
const EMOJIS=['❤️','👍','🥰','😂','😮','😢','🌸'];
export default function NewsPage(){
 const {user,profile}=useAuth();
 const [picker,setPicker]=useState<string|null>(null),[replyTo,setReplyTo]=useState<string|null>(null),[commentReactions,setCommentReactions]=useState<CommentReaction[]>([]);
 const [visibleComments,setVisibleComments]=useState<Record<string,boolean>>({});
 const [visibleReplies,setVisibleReplies]=useState<Record<string,boolean>>({});
 const [composer,setComposer]=useState(false),[portalReady,setPortalReady]=useState(false);const fileRef=useRef<HTMLInputElement>(null);
 useEffect(()=>setPortalReady(true),[]);
 useEffect(()=>{if(!picker)return;const dismiss=(e:PointerEvent)=>{if(!(e.target as HTMLElement).closest('.sb-reaction-wrap'))setPicker(null)};document.addEventListener('pointerdown',dismiss);return()=>document.removeEventListener('pointerdown',dismiss)},[picker]);
 const [admin,setAdmin]=useState(false),[news,setNews]=useState<News[]>([]),[comments,setComments]=useState<Comment[]>([]),[reactions,setReactions]=useState<Reaction[]>([]);
 const [names,setNames]=useState<Record<string,string>>({}),[avatars,setAvatars]=useState<Record<string,string|null>>({}),[title,setTitle]=useState(''),[body,setBody]=useState(''),[file,setFile]=useState<File|null>(null);
 const [editing,setEditing]=useState<string|null>(null),[commentDraft,setCommentDraft]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!composer)return;const prev=document.body.style.overflow;document.body.style.overflow='hidden';const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy)setComposer(false)};window.addEventListener('keydown',key);return()=>{document.body.style.overflow=prev;window.removeEventListener('keydown',key)}},[composer,busy]);
 const load=useCallback(async()=>{
  const [n,c,r,cr]=await Promise.all([
   supabase.from('bloom_news').select('*').order('created_at',{ascending:false}).limit(100),
   supabase.from('bloom_news_comments').select('*').order('created_at',{ascending:true}).limit(1000),
   supabase.from('bloom_news_reactions').select('*').limit(5000),
   supabase.from('bloom_news_comment_reactions').select('*').limit(10000)
  ]);
  if(n.error){setError(n.error.message);return}
  setNews((n.data||[]) as News[]);setComments((c.data||[]) as Comment[]);setReactions((r.data||[]) as Reaction[]);if(cr.error)setError(cr.error.message);else setCommentReactions((cr.data||[]) as CommentReaction[]);
  const ids=[...new Set([...(n.data||[]).map(x=>x.author_id),...(c.data||[]).map(x=>x.user_id),...(r.data||[]).map(x=>x.user_id),...(cr.data||[]).map(x=>x.user_id)])];
  if(ids.length){const p=await supabase.from('profiles').select('id,username,avatar_url').in('id',ids);setNames(Object.fromEntries((p.data||[]).map(x=>[x.id,x.username])));setAvatars(Object.fromEntries((p.data||[]).map(x=>[x.id,x.avatar_url])))}
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
  if(result.error){setError(result.error.message)}else{setEditing(null);setTitle('');setBody('');setFile(null);setComposer(false);await load()}
  setBusy(false);
 }
 function startEdit(n:News){setEditing(n.id);setTitle(n.title);setBody(n.body);setFile(null);setError('');setComposer(true)}
 function startNew(){setEditing(null);setTitle('');setBody('');setFile(null);setError('');setComposer(true)}
 function chooseFile(f?:File){if(!f)return;const allowed=['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'];if(!allowed.includes(f.type)||f.size>25*1024*1024){setError('Use JPG, PNG, WebP, GIF, MP4 or WebM, up to 25 MB.');return}setFile(f);setError('')}
 async function remove(id:string){if(!admin||!confirm('Delete this news post and its comments/reactions?'))return;setBusy(true);const r=await supabase.from('bloom_news').delete().eq('id',id);if(r.error)setError(r.error.message);else await load();setBusy(false)}
 async function comment(id:string,parentId?:string){const key=parentId||id;const value=(commentDraft[key]||'').trim();if(!user||!value)return;setBusy(true);const r=await supabase.from('bloom_news_comments').insert({news_id:id,user_id:user.id,body:value,...(parentId?{parent_id:parentId}:{})});if(r.error)setError(r.error.message);else{setCommentDraft(p=>({...p,[key]:''}));setReplyTo(null);await load()}setBusy(false)}
 async function react(id:string,emoji:string){if(!user)return;const old=reactions.find(r=>r.news_id===id&&r.user_id===user.id);const r=old?.emoji===emoji?await supabase.from('bloom_news_reactions').delete().eq('news_id',id).eq('user_id',user.id):await supabase.from('bloom_news_reactions').upsert({news_id:id,user_id:user.id,emoji},{onConflict:'news_id,user_id'});if(r.error)setError(r.error.message);else await load()}
 async function reactComment(id:string,emoji:string){if(!user)return;const old=commentReactions.find(r=>r.comment_id===id&&r.user_id===user.id);const r=old?.emoji===emoji?await supabase.from('bloom_news_comment_reactions').delete().eq('comment_id',id).eq('user_id',user.id):await supabase.from('bloom_news_comment_reactions').upsert({comment_id:id,user_id:user.id,emoji},{onConflict:'comment_id,user_id'});if(r.error)setError(r.error.message);else await load();setPicker(null)}
 function pickerButton(id:string,kind:'post'|'comment',selected:string|undefined,onPick:(emoji:string)=>void){
  const key=`${kind}:${id}`;
  return <span className="sb-reaction-wrap"><button type="button" className="sb-reaction-trigger" aria-label="Choose reaction" aria-expanded={picker===key} onClick={()=>setPicker(p=>p===key?null:key)}>{selected||'😊'} <span className="sb-reaction-label">React</span></button>{picker===key&&<span className="sb-reaction-popup" role="group" aria-label="Choose emoji reaction">{EMOJIS.map(e=><button key={e} type="button" title={e} aria-label={`React ${e}`} onClick={()=>onPick(e)}>{e}</button>)}</span>}</span>
 }
 function renderComment(c:Comment,depth:number,postId:string):React.ReactNode{
  const children=comments.filter(child=>child.parent_id===c.id&&child.news_id===postId);
  const selected=commentReactions.find(r=>r.comment_id===c.id&&r.user_id===user?.id)?.emoji;
  return <div key={c.id} className={`sb-news-comment ${depth?'sb-news-reply':''}`} style={{marginLeft:depth?Math.min(depth,3)*16:0}}>
   <div className="sb-news-comment-author"><Link href={`/profile/${c.user_id}`}><Avatar profile={{avatar_url:avatars[c.user_id]||null} as Parameters<typeof Avatar>[0]['profile']} size={30}/></Link><div><Link href={`/profile/${c.user_id}`}><strong>@{names[c.user_id]||'Member'}</strong></Link><span className="sb-news-meta"> · {new Date(c.created_at).toLocaleString()}</span></div></div>
   <p className="sb-news-body">{c.body}</p>
   <div className="sb-news-comment-controls">{pickerButton(c.id,'comment',selected,e=>void reactComment(c.id,e))}<button type="button" onClick={()=>setReplyTo(v=>v===c.id?null:c.id)}>Reply</button>{(admin||c.user_id===user?.id)&&<button type="button" onClick={async()=>{if(!confirm('Delete this comment and its replies?'))return;const r=await supabase.from('bloom_news_comments').delete().eq('id',c.id);if(r.error)setError(r.error.message);else await load()}}>Delete</button>}</div>
   <div className="sb-reaction-inline"><div className="sb-news-reaction-counts">{EMOJIS.filter(e=>commentReactions.some(r=>r.comment_id===c.id&&r.emoji===e)).map(e=><span key={e}>{e} {commentReactions.filter(r=>r.comment_id===c.id&&r.emoji===e).length}</span>)}</div><ReactionViewer reactions={commentReactions.filter(r=>r.comment_id===c.id)} label={`👥 ${commentReactions.filter(r=>r.comment_id===c.id).length} reacted`}/></div>
   {replyTo===c.id&&<div className="sb-news-reply-input"><input aria-label={`Reply to ${names[c.user_id]||'member'}`} placeholder={`Reply to @${names[c.user_id]||'member'}...`} maxLength={2000} value={commentDraft[c.id]||''} onChange={e=>setCommentDraft(p=>({...p,[c.id]:e.target.value}))}/><button disabled={busy||!commentDraft[c.id]?.trim()} onClick={()=>void comment(postId,c.id)}><Send size={16}/></button></div>}
   {children.length>0&&<button type="button" className="sb-news-thread-toggle" aria-expanded={!!visibleReplies[c.id]} onClick={()=>setVisibleReplies(prev=>({...prev,[c.id]:!prev[c.id]}))}>{visibleReplies[c.id]?'Hide Replies':`View Replies (${children.length})`}</button>}
   {visibleReplies[c.id]&&children.map(child=>renderComment(child,depth+1,postId))}
  </div>
 }
 return <section className="sb-news-page">
  
  {error&&<p role="alert" className="sb-news-error">{error}</p>}
  {admin&&<section className="panel"><div className="row"><Avatar profile={profile}/><div className="grow"><strong>{profile?.username||'Administrator'}</strong><button className="composer-trigger" style={{display:'block',width:'100%',marginTop:7}} onClick={startNew}>What&apos;s blooming in SoftBloomSMP? 🌸</button></div></div><div className="row between" style={{marginTop:12}}><span className="muted small">📷 Photo · 🎬 Video · 😊 Emoji</span><span className="muted small">Admin announcements only</span></div></section>}
  {!news.length&&<div className="sb-news-card">No news announcements yet. Check back soon! 🌷</div>}
  {news.map(n=><article className="sb-news-card" key={n.id}>
   <div className="sb-news-author"><Link href={`/profile/${n.author_id}`} className="sb-news-author-avatar" aria-label={`View @${names[n.author_id]||'member'} profile`}><Avatar profile={{avatar_url:avatars[n.author_id]||null} as Parameters<typeof Avatar>[0]["profile"]} size={44}/></Link><div className="sb-news-author-details"><Link href={`/profile/${n.author_id}`} className="sb-news-author-name">@{names[n.author_id]||'Member'}</Link><div className="sb-news-meta">{new Date(n.created_at).toLocaleString()}{n.updated_at!==n.created_at?' · Edited':''}</div></div></div><h2>{n.title}</h2>
   <p className="sb-news-body">{n.body}</p>
   {n.media_url&&(n.media_type==='video'?<video className="sb-news-media" src={n.media_url} controls preload="metadata"/>:<img className="sb-news-media" src={n.media_url} alt={`Media for ${n.title}`} loading="lazy"/>)}
   {admin&&<div className="sb-news-actions"><button onClick={()=>startEdit(n)}><Pencil size={14}/> Edit</button><button disabled={busy} onClick={()=>void remove(n.id)}><Trash2 size={14}/> Delete</button></div>}
   <div className="sb-news-post-reactions">{pickerButton(n.id,'post',reactions.find(r=>r.news_id===n.id&&r.user_id===user?.id)?.emoji,e=>{setPicker(null);void react(n.id,e)})}<div className="sb-news-reaction-counts">{EMOJIS.filter(e=>reactions.some(r=>r.news_id===n.id&&r.emoji===e)).map(e=><span key={e}>{e} {reactions.filter(r=>r.news_id===n.id&&r.emoji===e).length}</span>)}</div><ReactionViewer reactions={reactions.filter(r=>r.news_id===n.id)} label={`👥 ${reactions.filter(r=>r.news_id===n.id).length} reacted`}/></div>
   <button type="button" className="sb-news-thread-toggle sb-news-comments-toggle" aria-expanded={!!visibleComments[n.id]} onClick={()=>setVisibleComments(prev=>({...prev,[n.id]:!prev[n.id]}))}>{visibleComments[n.id]?'Hide Comments':`View Comments (${comments.filter(c=>c.news_id===n.id).length})`}</button>
   {visibleComments[n.id]&&comments.filter(c=>c.news_id===n.id&&!c.parent_id).map(c=>renderComment(c,0,n.id))}
   <div style={{display:'flex',gap:8,marginTop:12}}><input aria-label="Write a comment" placeholder={`Comment as @${profile?.username||'member'}...`} maxLength={2000} value={commentDraft[n.id]||''} onChange={e=>setCommentDraft(p=>({...p,[n.id]:e.target.value}))}/><div className="sb-news-actions"><button disabled={busy||!commentDraft[n.id]?.trim()} onClick={()=>void comment(n.id)}><Send size={16}/></button></div></div>
  </article>)}
  {composer&&admin&&portalReady&&createPortal(
   <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget&&!busy)setComposer(false)}}>
    <section className="modal" role="dialog" aria-modal="true" aria-label={editing?'Edit announcement':'Create announcement'}>
     <div className="row between"><h2>{editing?'Edit News':'Create News'} 🌸</h2><button type="button" className="btn ghost" disabled={busy} onClick={()=>setComposer(false)}>✕</button></div>
     <div className="row" style={{marginBottom:16}}><Avatar profile={profile}/><strong>{profile?.username||'Administrator'}</strong><span className="muted small">· Official News</span></div>
     <input className="field" aria-label="News title" placeholder="Announcement title" maxLength={140} value={title} onChange={e=>setTitle(e.target.value)} style={{width:'100%',marginBottom:12}}/>
     <textarea className="field" aria-label="News content" placeholder="Share the latest SoftBloomSMP news..." maxLength={10000} value={body} onChange={e=>setBody(e.target.value)}/>
     <div className="sb-news-actions">{EMOJIS.map(emoji=><button key={emoji} type="button" onClick={()=>setBody(v=>v+emoji)}>{emoji}</button>)}</div>
     <div className="row" style={{marginTop:15,flexWrap:'wrap'}}>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" hidden onChange={e=>chooseFile(e.target.files?.[0])}/>
      <button className="btn outline" type="button" onClick={()=>fileRef.current?.click()}><ImageIcon size={16}/><Video size={16}/> Attach media</button>
      <span className="muted small">Images / videos up to 25 MB</span>
     </div>
     {file&&<div className="row" style={{marginTop:12}}><strong>{file.name}</strong><button type="button" onClick={()=>setFile(null)}>Remove</button></div>}
     {editing&&news.find(n=>n.id===editing)?.media_url&&!file&&<p className="muted small">Existing media remains unless replaced.</p>}
     {error&&<p className="sb-news-error" role="alert">{error}</p>}
     <div className="row between" style={{marginTop:18}}><span className="muted small">{body.length}/10000 characters</span><button className="btn" type="button" disabled={busy||!title.trim()||(!body.trim()&&!file&&!editing)} onClick={()=>void save()}>{busy?'Saving...':editing?'Save Changes':'Publish News'}</button></div>
    </section>
   </div>,document.body)}
 </section>
}
