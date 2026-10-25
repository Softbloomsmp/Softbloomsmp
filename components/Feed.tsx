'use client';
import {useEffect,useState,useCallback,useRef} from 'react';
import Link from 'next/link';
import {createPortal} from 'react-dom';
import {Image as ImageIcon,Video,Send,PenLine,Trash2,MessageCircle} from 'lucide-react';
import {supabase,Post,Profile} from '@/lib/supabase';
import {useAuth,Avatar} from './AppShell';
const EMOJIS=['❤️','👍','🥰','😂','😮','😢','🌸'];
type Comment={id:string;post_id:string;user_id:string;body:string;created_at:string;updated_at:string;profiles?:Profile};
type Reaction={post_id:string;user_id:string;emoji:string};
export function Feed({onlyUser}:{onlyUser?:string}){
 const {user,profile,login}=useAuth();const [posts,setPosts]=useState<Post[]>([]),[comments,setComments]=useState<Record<string,Comment[]>>({}),[reactions,setReactions]=useState<Record<string,Reaction[]>>({}),[expanded,setExpanded]=useState<string[]>([]),[composer,setComposer]=useState(false),[editing,setEditing]=useState<Post|null>(null),[body,setBody]=useState(''),[file,setFile]=useState<File|null>(null),[removeMedia,setRemoveMedia]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[commentText,setCommentText]=useState<Record<string,string>>({}),[editingComment,setEditingComment]=useState<string|null>(null),[editCommentText,setEditCommentText]=useState('');const fileRef=useRef<HTMLInputElement>(null);
 const [portalReady,setPortalReady]=useState(false);
 useEffect(()=>{setPortalReady(true)},[]);
 useEffect(()=>{if(!composer)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy)setComposer(false)};window.addEventListener('keydown',onKey);return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',onKey)}},[composer,busy]);
 const [postCount,setPostCount]=useState(0),[feedError,setFeedError]=useState('');
 const load=useCallback(async()=>{
  // Fetch posts without an embedded relationship: a missing/stale PostgREST
  // relationship must not make the entire community feed disappear.
  let query=supabase.from('posts').select('*').order('created_at',{ascending:false}).limit(100);
  if(onlyUser){
   query=query.eq('user_id',onlyUser);
  }else{
   // Home shows your own posts and posts from accounts you follow.
   if(!user){setPosts([]);setComments({});setReactions({});setFeedError('');return}
   const {data:followRows,error:followError}=await supabase.from('follows').select('following_id').eq('follower_id',user.id);
   if(followError){setFeedError(`Unable to load your following list: ${followError.message}`);return}
   const visibleIds=[user.id,...(followRows||[]).map(r=>r.following_id)];
   query=query.in('user_id',visibleIds);
  }
  const {data:rawPosts,error:postsError}=await query;
  if(postsError){
   console.error('SoftBloomSMP posts query failed:',postsError);
   setFeedError(`Unable to load posts: ${postsError.message}`);
   return;
  }
  const rows=rawPosts||[];
  const authorIds=[...new Set(rows.map(p=>p.user_id))];
  const ids=rows.map(p=>p.id);
  const [authors,commentResult,reactionResult]=await Promise.all([
   authorIds.length?supabase.from('profiles').select('id,username,avatar_url,bio,username_changed_at,created_at').in('id',authorIds):Promise.resolve({data:[],error:null}),
   ids.length?supabase.from('comments').select('*').in('post_id',ids).order('created_at'):Promise.resolve({data:[],error:null}),
   ids.length?supabase.from('reactions').select('*').in('post_id',ids):Promise.resolve({data:[],error:null})
  ]);
  const profiles=new Map((authors.data||[]).map(p=>[p.id,p]));
  const commentRows=commentResult.data||[];
  const commentAuthors=[...new Set(commentRows.map(c=>c.user_id))];
  const missing=commentAuthors.filter(id=>!profiles.has(id));
  if(missing.length){
   const {data:extra,error:extraError}=await supabase.from('profiles').select('id,username,avatar_url,bio,username_changed_at,created_at').in('id',missing);
   if(extraError)console.warn('SoftBloomSMP comment profiles unavailable:',extraError);
   (extra||[]).forEach(p=>profiles.set(p.id,p));
  }
  if(authors.error)console.warn('SoftBloomSMP author profiles unavailable:',authors.error);
  if(commentResult.error)console.warn('SoftBloomSMP comments unavailable:',commentResult.error);
  if(reactionResult.error)console.warn('SoftBloomSMP reactions unavailable:',reactionResult.error);
  setPosts(rows.map(p=>({...p,profiles:profiles.get(p.user_id)})));
  const cm:Record<string,Comment[]>={},rm:Record<string,Reaction[]>={};
  commentRows.forEach(c=>(cm[c.post_id]??=[]).push({...c,profiles:profiles.get(c.user_id)}));
  (reactionResult.data||[]).forEach(r=>(rm[r.post_id]??=[]).push(r));
  setComments(cm);setReactions(rm);setFeedError('');
 },[onlyUser,user]);
 useEffect(()=>{
  void load();
  // Refresh when returning to the tab and periodically while viewing the feed.
  // This does not require enabling Supabase Realtime or modifying RLS.
  const refresh=()=>{if(document.visibilityState==='visible')void load()};
  document.addEventListener('visibilitychange',refresh);
  const interval=window.setInterval(refresh,20000);
  return ()=>{document.removeEventListener('visibilitychange',refresh);window.clearInterval(interval)};
 },[load]);
 useEffect(()=>{
  if(!user){setPostCount(0);return}
  let active=true;
  const update=async()=>{
   const {count,error}=await supabase.from('posts').select('id',{count:'exact',head:true}).eq('user_id',user.id);
   if(active){if(error)console.warn('Could not read post count:',error);else setPostCount(count||0)}
  };
  void update();
  // Count is refreshed after saves/deletions via load's post list as well.
  return ()=>{active=false};
 },[user,posts]);
 function start(post?:Post){setEditing(post||null);setBody(post?.body||'');setFile(null);setRemoveMedia(false);setError('');setComposer(true)}
 function chooseFile(f?:File){if(!f)return;const image=f.type.startsWith('image/'),video=f.type.startsWith('video/');if(!image&&!video){setError('Only images and videos are allowed.');return}if(f.size>(image?3:10)*1024*1024){setError(`${image?'Images':'Videos'} must be ${image?'3':'10'} MB or less.`);return}setFile(f);setRemoveMedia(false);setError('')}
 async function save(){if(!user)return;setBusy(true);setError('');try{let media_url=editing?.media_url||null,media_type=editing?.media_type||null;if(file){const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('Please sign in again.');const fd=new FormData();fd.set('file',file);const res=await fetch('/api/media',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body:fd});const out=await res.json();if(!res.ok)throw new Error(out.error||'Upload failed');media_url=out.url;media_type=out.type}else if(removeMedia){media_url=null;media_type=null}if(!body.trim()&&!media_url)throw new Error('Add some text or an attachment.');const payload={body:body.trim(),media_url,media_type};const result=editing?await supabase.from('posts').update(payload).eq('id',editing.id).eq('user_id',user.id):await supabase.from('posts').insert({...payload,user_id:user.id});if(result.error)throw result.error;setComposer(false);await load()}catch(e){setError(e instanceof Error?e.message:'Could not save post')}finally{setBusy(false)}}
 async function deletePost(p:Post){if(!user||!confirm('Delete this post and all its comments and reactions?'))return;const {error}=await supabase.from('posts').delete().eq('id',p.id).eq('user_id',user.id);if(error)alert(error.message);else await load()}
 async function react(p:Post,emoji:string){if(!user){void login('google');return}const mine=(reactions[p.id]||[]).find(r=>r.user_id===user.id);const result=mine?.emoji===emoji?await supabase.from('reactions').delete().eq('post_id',p.id).eq('user_id',user.id):await supabase.from('reactions').upsert({post_id:p.id,user_id:user.id,emoji},{onConflict:'post_id,user_id'});if(result.error)alert(result.error.message);else await load()}
 async function addComment(postId:string){if(!user){void login('google');return}const text=commentText[postId]?.trim();if(!text)return;const {error}=await supabase.from('comments').insert({post_id:postId,user_id:user.id,body:text});if(error)alert(error.message);else{setCommentText(s=>({...s,[postId]:''}));await load()}}
 async function changeComment(c:Comment,del=false){if(!user)return;if(del&&!confirm('Delete this comment?'))return;const result=del?await supabase.from('comments').delete().eq('id',c.id).eq('user_id',user.id):await supabase.from('comments').update({body:editCommentText.trim()}).eq('id',c.id).eq('user_id',user.id);if(result.error)alert(result.error.message);else{setEditingComment(null);await load()}}
 const count=postCount;
 return <><section className="panel"><div className="row"><Avatar profile={profile}/><div className="grow"><strong>{profile?.username||'Welcome, visitor!'}</strong><button className="composer-trigger" style={{display:'block',width:'100%',marginTop:7}} onClick={()=>user?start():login('google')}>What&apos;s blooming on your mind? 🌸</button></div></div><div className="row between" style={{marginTop:12}}><span className="muted small">📷 Photo · 🎬 Video · 😊 Emoji</span><span className="muted small">{user?`${count} / 5 posts`:'Sign in to post'}</span></div></section>
 <h2 className="section-title">{onlyUser?'Published Posts':'Community Garden 🌸'}</h2>{feedError&&<div className="panel error" role="alert">{feedError}</div>}{posts.length===0&&!feedError&&<div className="panel center muted">{onlyUser?'No posts yet.':user?'No posts from followed members yet. Follow someone to see their posts here!':'Sign in to see posts from members you follow.'}</div>}
 {posts.map(p=>{const r=reactions[p.id]||[],cs=comments[p.id]||[],mine=r.find(x=>x.user_id===user?.id);return <article className="panel post" key={p.id}><div className="post-header"><Link href={`/profile/${p.user_id}`}><Avatar profile={p.profiles}/></Link><div><Link href={`/profile/${p.user_id}`}><strong>{p.profiles?.username||'Member'}</strong></Link><small>{new Date(p.created_at).toLocaleString()}{p.updated_at!==p.created_at?' · Edited':''} · Public</small></div>{user?.id===p.user_id&&<div className="post-options"><button className="linkbutton" title="Edit post" onClick={()=>start(p)}><PenLine size={17}/></button><button className="linkbutton" title="Delete post" onClick={()=>deletePost(p)}><Trash2 size={17}/></button></div>}</div>{p.body&&<div className="post-body">{p.body}</div>}{p.media_url&&(p.media_type==='video'?<video className="post-media" src={p.media_url} controls preload="metadata"/>:<img className="post-media" src={p.media_url} alt="Community post attachment" loading="lazy"/>)}<div className="actions"><div className="reactions">{EMOJIS.map(emoji=><button key={emoji} className={`react-btn ${mine?.emoji===emoji?'selected':''}`} onClick={()=>react(p,emoji)} title={`React ${emoji}`}>{emoji} {r.filter(x=>x.emoji===emoji).length||''}</button>)}</div><button className="btn ghost" onClick={()=>setExpanded(x=>x.includes(p.id)?x.filter(id=>id!==p.id):[...x,p.id])}><MessageCircle size={17}/> {cs.length} Comments</button></div>{expanded.includes(p.id)&&<div className="comments">{cs.map(c=><div className="comment" key={c.id}><div className="row between"><Link className="row" href={`/profile/${c.user_id}`}><Avatar profile={c.profiles} size={27}/><strong>{c.profiles?.username||'Member'}</strong></Link>{user?.id===c.user_id&&<div><button className="linkbutton" onClick={()=>{setEditingComment(c.id);setEditCommentText(c.body)}}>Edit</button><button className="linkbutton" onClick={()=>changeComment(c,true)}>Delete</button></div>}</div>{editingComment===c.id?<div className="row"><input className="field" value={editCommentText} maxLength={2000} onChange={e=>setEditCommentText(e.target.value)}/><button className="btn" disabled={!editCommentText.trim()} onClick={()=>changeComment(c)}>Save</button><button className="btn outline" onClick={()=>setEditingComment(null)}>Cancel</button></div>:<div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',marginTop:6}}>{c.body} {c.updated_at!==c.created_at&&<span className="muted small">(Edited)</span>}</div>}</div>)}<form className="comment-form" onSubmit={e=>{e.preventDefault();void addComment(p.id)}}><input placeholder={user?'Write a comment...':'Sign in to comment'} value={commentText[p.id]||''} maxLength={2000} disabled={!user} onChange={e=>setCommentText(s=>({...s,[p.id]:e.target.value}))}/><button className="btn" disabled={!user||!commentText[p.id]?.trim()}><Send size={17}/></button></form></div>}</article>})}
 {composer&&portalReady&&createPortal(<div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget&&!busy)setComposer(false)}}><section className="modal" role="dialog" aria-modal="true" aria-label="Create or edit post"><div className="row between"><h2>{editing?'Edit Post':'Create Post'} 🌸</h2><button className="btn ghost" disabled={busy} onClick={()=>setComposer(false)}>✕</button></div><div className="row" style={{marginBottom:16}}><Avatar profile={profile}/><strong>{profile?.username}</strong><span className="muted small">· Public</span></div><textarea className="field" value={body} maxLength={5000} onChange={e=>setBody(e.target.value)} onPaste={e=>{const f=Array.from(e.clipboardData.files).find(f=>f.type.startsWith('image/'));if(f){e.preventDefault();chooseFile(f)}}} placeholder="Share your adventures, stories, and ideas..."/><div className="emoji-bar">{EMOJIS.map(emoji=><button key={emoji} onClick={()=>setBody(s=>s+emoji)}>{emoji}</button>)}</div><div className="row" style={{marginTop:15,flexWrap:'wrap'}}><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm" hidden onChange={e=>chooseFile(e.target.files?.[0])}/><button className="btn outline" onClick={()=>fileRef.current?.click()}><ImageIcon size={16}/><Video size={16}/> Attach media</button><span className="muted small">Image ≤ 3 MB · Video ≤ 10 MB</span></div>{file&&<div className="row" style={{marginTop:12}}><strong>{file.name}</strong><button className="linkbutton" onClick={()=>setFile(null)}>Remove</button></div>}{editing?.media_url&&!file&&!removeMedia&&<div style={{marginTop:12}}><p className="muted small">Existing attachment</p>{editing.media_type==='video'?<video src={editing.media_url} className="media-preview" controls/>:<img src={editing.media_url} className="media-preview" alt="Current attachment"/>}<button className="btn outline" onClick={()=>setRemoveMedia(true)}>Remove attachment</button></div>}{error&&<p className="error" role="alert">{error}</p>}<div className="row between" style={{marginTop:18}}><span className="muted small">{body.length}/5000 characters</span><button className="btn" disabled={busy||(!body.trim()&&!file&&!editing?.media_url)||(!editing&&count>=5)} onClick={save}>{busy?'Saving...':editing?'Save Changes':'Post'}</button></div>{!editing&&count>=5&&<p className="error">You have reached your 5-post limit. Delete a post to create another.</p>}</section></div>,document.body)}</>}
