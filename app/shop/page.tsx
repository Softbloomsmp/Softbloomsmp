'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ShoppingBag,Wallet,Ticket,ShieldCheck,Trash2,ImagePlus} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {useAuth} from '@/components/AppShell';
type Product={id:string;title:string;description:string;image_url:string|null;price_bcoins:number;price_gcash:number;active:boolean};
type TicketRow={id:string;user_id:string;kind:string;product_id:string|null;requested_bcoins:number|null;amount_php:number|null;reference:string|null;details:string;status:string;created_at:string};
type Message={id:string;ticket_id:string;sender_id:string;body:string;image_path?:string|null;created_at:string};
type AccountMatch={id:string;username:string;avatar_url:string|null};
type Order={id:string;product_title:string;payment_method:string;status:string;created_at:string};
export default function BloomShop(){
 const {user,login}=useAuth();const [admin,setAdmin]=useState(false),[products,setProducts]=useState<Product[]>([]),[tickets,setTickets]=useState<TicketRow[]>([]),[messages,setMessages]=useState<Message[]>([]),[orders,setOrders]=useState<Order[]>([]),[balance,setBalance]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(false),[modal,setModal]=useState<'topup'|'product'|'checkout'|null>(null),[chosen,setChosen]=useState<Product|null>(null),[method,setMethod]=useState<'bcoins'|'gcash'>('bcoins'),[amount,setAmount]=useState('100'),[reference,setReference]=useState(''),[details,setDetails]=useState(''),[reply,setReply]=useState<Record<string,string>>({}),[editing,setEditing]=useState<string|null>(null),[title,setTitle]=useState(''),[description,setDescription]=useState(''),[image,setImage]=useState(''),[bprice,setBprice]=useState('100'),[gprice,setGprice]=useState('100'),[active,setActive]=useState(true);
 const [imageFile,setImageFile]=useState<File|null>(null),[imagePreview,setImagePreview]=useState<string|null>(null);
 const imageInput=useRef<HTMLInputElement>(null);
 const [ticketImageUrls,setTicketImageUrls]=useState<Record<string,string>>({});
 const [ticketFiles,setTicketFiles]=useState<Record<string,File|null>>({});
 const [accountQuery,setAccountQuery]=useState(''),[accountMatches,setAccountMatches]=useState<AccountMatch[]>([]),[selectedAccount,setSelectedAccount]=useState<AccountMatch|null>(null),[searchingAccounts,setSearchingAccounts]=useState(false);
 const [adminUser,setAdminUser]=useState(''),[adminCoins,setAdminCoins]=useState('0'),[adminPostLimit,setAdminPostLimit]=useState('10');
 async function sendTicket(t:TicketRow){
  const file=ticketFiles[t.id],body=(reply[t.id]||'').trim();
  if(!body&&!file)return;
  if(file&&(file.size>8*1024*1024||!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))){setError('Ticket pictures must be JPG, PNG, WebP or GIF, up to 8 MB.');return}
  setBusy(true);setError('');
  let path:string|null=null;
  if(file&&user){
   const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'} as Record<string,string>)[file.type];
   path=`${t.id}/${user.id}/${crypto.randomUUID()}.${ext}`;
   const uploaded=await supabase.storage.from('bloom-ticket-images').upload(path,file,{contentType:file.type,upsert:false});
   if(uploaded.error){setError(uploaded.error.message);setBusy(false);return}
  }
  const sent=await supabase.rpc('bloom_send_ticket_attachment',{p_ticket:t.id,p_body:body,p_image_path:path});
  if(sent.error){if(path)await supabase.storage.from('bloom-ticket-images').remove([path]);setError(sent.error.message)}
  else{setReply(v=>({...v,[t.id]:''}));setTicketFiles(v=>({...v,[t.id]:null}));await load()}
  setBusy(false);
 }
 useEffect(()=>{
  if(!admin||!accountQuery.trim()||selectedAccount){setAccountMatches([]);return}
  let cancelled=false;
  const timeout=setTimeout(async()=>{
   setSearchingAccounts(true);
   const {data,error}=await supabase.rpc('bloom_admin_find_players',{p_query:accountQuery.trim()});
   if(!cancelled){setSearchingAccounts(false);setAccountMatches(error?[]:(data||[]) as AccountMatch[]);if(error)setError(error.message)}
  },250);
  return()=>{cancelled=true;clearTimeout(timeout)};
 },[accountQuery,admin,selectedAccount]);
 async function setAdminValue(which:'coins'|'posts'){
  if(!admin||!selectedAccount||selectedAccount.id!==adminUser)return;
  const val=Number(which==='coins'?adminCoins:adminPostLimit);
  if(!Number.isSafeInteger(val)||val<0){setError('Enter a valid non-negative whole number.');return}
  if(!window.confirm(`Set ${which==='coins'?'BCoins balance':'maximum total posts'} for @${selectedAccount.username} to ${val}?`))return;
  await run(which==='coins'?'bloom_admin_set_balance':'bloom_admin_set_post_limit',which==='coins'?{p_user:adminUser.trim(),p_balance:val}:{p_user:adminUser.trim(),p_limit:val});
 }

 useEffect(()=>{if(!imageFile){setImagePreview(null);return}const url=URL.createObjectURL(imageFile);setImagePreview(url);return()=>URL.revokeObjectURL(url)},[imageFile]);
 const allowedImages=new Set(['image/jpeg','image/png','image/gif','image/webp','image/avif','image/bmp']);
 function selectImage(file?:File){if(!file)return;if(!allowedImages.has(file.type)){setError('Choose a JPG, PNG, GIF, WebP, AVIF, or BMP image. Videos are not supported.');return}if(file.size>8*1024*1024){setError('Image must be 8 MB or smaller.');return}setError('');setImageFile(file)}
 const load=useCallback(async()=>{if(!user)return;const [ar,pr,wr,tr,mr,or]=await Promise.all([
 supabase.rpc('bloom_is_admin'),supabase.from('bloom_products').select('*').is('archived_at',null).order('created_at',{ascending:false}),supabase.from('bloom_wallets').select('balance').eq('user_id',user.id).maybeSingle(),supabase.from('bloom_tickets').select('*').is('archived_at',null).order('created_at',{ascending:false}).limit(100),supabase.from('bloom_ticket_messages').select('*').order('created_at',{ascending:true}).limit(500),supabase.from('bloom_orders').select('*').is('archived_at',null).order('created_at',{ascending:false}).limit(100)]);
 if(pr.error){setError(pr.error.message);return}setError('');setAdmin(ar.data===true);setProducts((pr.data||[]) as Product[]);setBalance(Number(wr.data?.balance||0));setTickets((tr.data||[]) as TicketRow[]);setMessages((mr.data||[]) as Message[]);setOrders((or.data||[]) as Order[]);
 const paths=[...new Set((mr.data||[]).map((m:Message)=>m.image_path).filter((p):p is string=>!!p))];
 if(paths.length){const urls:Record<string,string>={};await Promise.all(paths.map(async path=>{const r=await supabase.storage.from('bloom-ticket-images').createSignedUrl(path,3600);if(r.data?.signedUrl)urls[path]=r.data.signedUrl}));setTicketImageUrls(urls)}

 },[user]);
 useEffect(()=>{void load()},[load]);
 async function run(name:string,args:Record<string,unknown>,done?:()=>void){setBusy(true);setError('');const {error}=await supabase.rpc(name,args);setBusy(false);if(error){setError(error.message);return}done?.();await load()}
 function archiveRecord(kind:'ticket'|'order',id:string,label:string){
  if(!admin||busy)return;
  if(!window.confirm(`Remove ${label} from the active shop records?\n\nThis archives the record and keeps the transaction history for auditing. Wallet balances will NOT change.`))return;
  void run('bloom_admin_archive',{p_kind:kind,p_id:id});
 }
 function deleteProduct(p:Product){
  if(!admin||busy)return;
  if(!window.confirm(`Delete \"${p.title}\" from the Bloom Shop?\n\nIt will disappear from the shop, but past orders and transaction records will be retained. This cannot be undone from the shop.`))return;
  void run('bloom_admin_archive_product',{p_id:p.id},()=>{if(chosen?.id===p.id)setChosen(null)});
 }
 function editProduct(p?:Product){setEditing(p?.id||null);setTitle(p?.title||'');setDescription(p?.description||'');setImage(p?.image_url||'');setImageFile(null);if(imageInput.current)imageInput.current.value='';setBprice(String(p?.price_bcoins||100));setGprice(String(p?.price_gcash||100));setActive(p?.active??true);setModal('product')}
 async function saveProduct(){
  const b=Number(bprice),g=Number(gprice);
  if(!title.trim()||!Number.isSafeInteger(b)||b<=0||!Number.isFinite(g)||g<=0){setError('Enter a title and valid positive prices.');return}
  if(!user)return;
  setBusy(true);setError('');
  let imageUrl=image,uploadedPath:string|null=null;
  if(imageFile){
   const ext=({'image/jpeg':'jpg','image/png':'png','image/gif':'gif','image/webp':'webp','image/avif':'avif','image/bmp':'bmp'} as Record<string,string>)[imageFile.type];
   if(!ext){setError('Unsupported image format.');setBusy(false);return}
   uploadedPath=`products/${user.id}/${crypto.randomUUID()}.${ext}`;
   const upload=await supabase.storage.from('bloom-product-images').upload(uploadedPath,imageFile,{contentType:imageFile.type,upsert:false,cacheControl:'3600'});
   if(upload.error){setError(`Image upload failed: ${upload.error.message}`);setBusy(false);return}
   imageUrl=supabase.storage.from('bloom-product-images').getPublicUrl(uploadedPath).data.publicUrl;
  }
  const args={p_title:title,p_description:description,p_image_url:imageUrl,p_bcoins:b,p_gcash:g,p_active:active};
  const result=await supabase.rpc(editing?'bloom_set_product':'bloom_create_product',editing?{...args,p_id:editing}:args);
  if(result.error){
   if(uploadedPath)await supabase.storage.from('bloom-product-images').remove([uploadedPath]);
   setError(`Product save failed: ${result.error.message}`);setBusy(false);return;
  }
  // Remove the replaced image only when it belongs to our dedicated product bucket.
  if(editing&&uploadedPath&&image){
   try{
    const oldUrl=new URL(image);
    const marker='/storage/v1/object/public/bloom-product-images/';
    const idx=oldUrl.pathname.indexOf(marker);
    if(idx!==-1){const oldPath=decodeURIComponent(oldUrl.pathname.slice(idx+marker.length));if(oldPath.startsWith('products/'))await supabase.storage.from('bloom-product-images').remove([oldPath])}
   }catch{/* External image URL or invalid URL; do not delete. */}
  }
  setBusy(false);setImageFile(null);setModal(null);await load();
 }
 function checkout(){if(!chosen)return;if(method==='bcoins'){if(!window.confirm(`Spend ${chosen.price_bcoins} BCoins on ${chosen.title}?`))return;void run('bloom_buy_bcoins',{p_product:chosen.id},()=>{setModal(null);window.alert('Purchase recorded! Your order is awaiting delivery.')})}else void run('bloom_open_ticket',{p_kind:'gcash_purchase',p_product:chosen.id,p_reference:reference,p_details:details},()=>{setModal(null);setReference('');setDetails('');window.alert('GCash purchase ticket created. Please follow the admin instructions in your ticket.')})}
 if(!user)return <div className="shop-shell shop-panel"><h1>Bloom Shop 🌸</h1><p>Sign in to explore the shop and manage your BCoins wallet.</p><button className="shop-btn" onClick={()=>void login('google')}>Sign in with Google</button> <button className="shop-btn secondary" onClick={()=>void login('discord')}>Discord</button></div>;
 return <div className="shop-shell"><div className="shop-header"><div><h1>🌸 Bloom Shop</h1><p className="shop-muted">Explore the community shop and manage your purchases.</p></div><div className="shop-actions"><strong className="shop-panel"><Wallet size={17} style={{verticalAlign:'middle'}}/> {balance.toLocaleString()} BCoins</strong><button className="shop-btn" onClick={()=>{setModal('topup');setReference('');setDetails('')}}>Top Up BCoins</button>{admin&&<button className="shop-btn secondary" onClick={()=>editProduct()}><ShieldCheck size={16}/> Add product</button>}</div></div>
 {error&&<p className="shop-error" role="alert">{error}</p>}
 <div className="shop-grid">{products.filter(p=>p.active||admin).map(p=><article className="shop-card" key={p.id}>{p.image_url&&<img src={p.image_url} alt={p.title} onError={e=>{e.currentTarget.style.display='none'}}/>}<h3>{p.title}</h3><p>{p.description}</p><p><strong>{p.price_bcoins.toLocaleString()} BCoins</strong> <span className="shop-muted">or ₱{Number(p.price_gcash).toFixed(2)} GCash</span></p>{!p.active&&<p className="shop-muted">Unpublished</p>}<div className="shop-row">{p.active&&<button className="shop-btn" onClick={()=>{setChosen(p);setMethod('bcoins');setModal('checkout')}}>Buy</button>}{admin&&<button className="shop-btn secondary" onClick={()=>editProduct(p)}>Edit</button>}{admin&&<button type="button" className="shop-btn secondary" disabled={busy} onClick={()=>deleteProduct(p)}><Trash2 size={15}/> Delete</button>}</div></article>)}{products.length===0&&<p className="shop-muted">No products published yet.</p>}</div>
 {admin&&<section className="shop-panel" style={{marginTop:20}}><h2><ShieldCheck size={20}/> Admin player controls</h2><p className="shop-muted">Enter a player&apos;s account UUID (from Supabase Authentication → Users). These actions are restricted to administrators in the database.</p><div className="shop-form"><label>Find player by username<input value={accountQuery} onChange={e=>{setAccountQuery(e.target.value);setSelectedAccount(null);setAdminUser('');setAccountMatches([])}} placeholder="e.g. Testuser" autoComplete="off"/></label>
 {searchingAccounts&&<p className="shop-muted">Searching players...</p>}
 {!selectedAccount&&accountMatches.length>0&&<div style={{display:'grid',gap:6}}>{accountMatches.map(p=><button key={p.id} type="button" className="shop-btn secondary" style={{justifyContent:'flex-start',display:'flex',alignItems:'center',gap:8}} onClick={()=>{setSelectedAccount(p);setAdminUser(p.id);setAccountQuery(p.username);setAccountMatches([])}}>{p.avatar_url&&<img src={p.avatar_url} alt="" width={28} height={28} style={{borderRadius:'50%'}}/>}@{p.username}</button>)}</div>}
 {selectedAccount&&<p className="shop-muted">Selected account: <strong>@{selectedAccount.username}</strong> ✓ <button type="button" className="shop-btn secondary" onClick={()=>{setSelectedAccount(null);setAdminUser('');setAccountQuery('')}}>Change player</button></p>}<label>Set BCoins balance<input type="number" min="0" step="1" value={adminCoins} onChange={e=>setAdminCoins(e.target.value)}/></label><button className="shop-btn secondary" disabled={busy||!selectedAccount} onClick={()=>void setAdminValue('coins')}>Set BCoins</button><label>Maximum total posts (0 = no posts)<input type="number" min="0" step="1" value={adminPostLimit} onChange={e=>setAdminPostLimit(e.target.value)}/></label><button className="shop-btn secondary" disabled={busy||!selectedAccount} onClick={()=>void setAdminValue('posts')}>Set maximum posts</button></div></section>}
 <section className="shop-panel" style={{marginTop:25}}><h2><Ticket size={21}/> {admin?'Admin ticket inbox':'My private tickets'}</h2><p className="shop-muted">Top-up and GCash payment requests. Only the ticket owner and admins can read or reply.</p>{tickets.length===0&&<p>No tickets yet.</p>}{tickets.map(t=><details className="shop-ticket" key={t.id}><summary><strong>{t.kind==='topup'?'BCoins top-up':'GCash purchase'}</strong> · {t.status} · {new Date(t.created_at).toLocaleString()}{admin&&<span className="shop-muted"> · User {t.user_id.slice(0,8)}</span>}</summary>{admin&&<div className="shop-row" style={{margin:'10px 0'}}><button type="button" className="shop-btn secondary" disabled={busy} onClick={()=>archiveRecord('ticket',t.id,'this ticket')}><Trash2 size={15}/> Delete ticket</button></div>}<p>{t.kind==='topup'?`${t.requested_bcoins} BCoins requested`:`₱${t.amount_php} payment requested`}</p><p>Reference: {t.reference||'Not provided'}</p><p>{t.details}</p><div className="shop-ticket-messages">{messages.filter(m=>m.ticket_id===t.id).map(m=><p key={m.id}><strong>{m.sender_id===t.user_id?'Player':'Admin'}:</strong> {m.body}{m.image_path&&ticketImageUrls[m.image_path]&&<span style={{display:'block',marginTop:8}}><a href={ticketImageUrls[m.image_path]} target="_blank" rel="noopener noreferrer"><img src={ticketImageUrls[m.image_path]} alt="Ticket attachment" style={{maxWidth:'min(100%,340px)',maxHeight:260,borderRadius:10,objectFit:'contain'}}/></a></span>}</p>)}</div>{!['approved','rejected','closed'].includes(t.status)&&<div className="shop-form"><textarea placeholder="Reply privately..." value={reply[t.id]||''} onChange={e=>setReply(x=>({...x,[t.id]:e.target.value}))}/><label style={{display:'flex',alignItems:'center',gap:8}}><ImagePlus size={17}/> Attach picture (JPG, PNG, WebP, GIF · max 8 MB)<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>setTicketFiles(v=>({...v,[t.id]:e.target.files?.[0]||null}))}/></label><button className="shop-btn" disabled={busy||(!reply[t.id]?.trim()&&!ticketFiles[t.id])} onClick={()=>void sendTicket(t)}>Send reply / picture</button>{admin&&<div className="shop-row"><button className="shop-btn secondary" disabled={busy} onClick={()=>void run('bloom_admin_resolve',{p_ticket:t.id,p_action:'awaiting_payment'})}>Awaiting payment</button><button className="shop-btn" disabled={busy} onClick={()=>window.confirm('Have you independently verified the payment? This action cannot be reversed.')&&void run('bloom_admin_resolve',{p_ticket:t.id,p_action:'approve'})}>Approve verified payment</button><button className="shop-btn secondary" disabled={busy} onClick={()=>window.confirm('Reject this ticket?')&&void run('bloom_admin_resolve',{p_ticket:t.id,p_action:'reject'})}>Reject</button></div>}</div>}</details>)}</section>
 <section className="shop-panel" style={{marginTop:20}}><h2><ShoppingBag size={21}/> {admin?'Recent orders':'My orders'}</h2>{orders.length===0?<p className="shop-muted">No purchases yet.</p>:orders.map(o=><p key={o.id}>{o.product_title} · {o.payment_method.toUpperCase()} · <strong>{o.status}</strong> <span className="shop-muted">· {new Date(o.created_at).toLocaleDateString()}</span> {admin&&<button type="button" className="shop-btn secondary" style={{marginLeft:8,padding:'5px 9px'}} disabled={busy} onClick={()=>archiveRecord('order',o.id,'this order')}><Trash2 size={14}/> Delete</button>}</p>)}</section>
 {modal&&<div className="shop-modal-cover" onClick={()=>setModal(null)}><div className="shop-modal shop-panel" onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true"><div className="shop-header"><h2>{modal==='topup'?'Top Up BCoins':modal==='product'?'Manage product':`Buy ${chosen?.title}`}</h2><button className="shop-btn secondary" onClick={()=>setModal(null)}>Close</button></div>
 {modal==='topup'&&<div className="shop-form"><p className="shop-muted">Request BCoins from admins. No coins are credited until an admin verifies your GCash payment and approves this ticket. Confirm the exchange rate with an admin before paying.</p><label>BCoins requested<input type="number" min="1" max="100000000" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>GCash reference (optional)<input value={reference} onChange={e=>setReference(e.target.value)}/></label><label>Message to admin<textarea value={details} onChange={e=>setDetails(e.target.value)}/></label><button className="shop-btn" disabled={busy||!Number.isSafeInteger(Number(amount))||Number(amount)<=0||Number(amount)>100000000} onClick={()=>void run('bloom_open_ticket',{p_kind:'topup',p_bcoins:Number(amount),p_reference:reference,p_details:details},()=>setModal(null))}>Create private top-up ticket</button></div>}
 {modal==='checkout'&&chosen&&<div className="shop-form"><label>Payment method<select value={method} onChange={e=>setMethod(e.target.value as 'bcoins'|'gcash')}><option value="bcoins">BCoins — {chosen.price_bcoins}</option><option value="gcash">GCash — ₱{Number(chosen.price_gcash).toFixed(2)}</option></select></label>{method==='bcoins'?<p>Current balance: {balance} BCoins. This purchase deducts coins immediately and creates a paid order.</p>:<><p className="shop-muted">A private admin ticket will be opened. Admins will provide GCash payment instructions and verify your payment manually. Do not send money until details are confirmed.</p><label>GCash reference (optional)<input value={reference} onChange={e=>setReference(e.target.value)}/></label><label>Message<textarea value={details} onChange={e=>setDetails(e.target.value)}/></label></>}<button className="shop-btn" disabled={busy||(method==='bcoins'&&balance<chosen.price_bcoins)} onClick={checkout}>{method==='bcoins'?'Confirm BCoins purchase':'Create GCash purchase ticket'}</button></div>}
 {modal==='product'&&<div className="shop-form"><label>Title<input maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)}/></label><label>Product picture (JPG, PNG, GIF, WebP, AVIF, BMP — max 8 MB)<input ref={imageInput} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/avif,image/bmp" onChange={e=>selectImage(e.target.files?.[0])}/></label>{(imagePreview||image)&&<div><p className="shop-muted">Image preview (animated GIFs remain animated)</p><img src={imagePreview||image} alt="Product preview" style={{width:'100%',maxHeight:230,objectFit:'contain',borderRadius:12}}/></div>}<label>Price in BCoins<input type="number" min="1" value={bprice} onChange={e=>setBprice(e.target.value)}/></label><label>Price in PHP (GCash)<input type="number" min="0.01" step="0.01" value={gprice} onChange={e=>setGprice(e.target.value)}/></label><label><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/> Published</label><button className="shop-btn" disabled={busy} onClick={()=>void saveProduct()}>Save product</button></div>}
 </div></div>}</div>;
}
