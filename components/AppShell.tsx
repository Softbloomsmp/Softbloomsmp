'use client';
import { useEffect,useState,useRef,createContext,useContext } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter,usePathname } from 'next/navigation';
import { Home,Newspaper,Search,UserRound,Settings,LogOut,LogIn,Flower2,MessageCircle,ShoppingBag,BookOpen,ChevronDown } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import {supabase,Profile} from '@/lib/supabase';
import {NotificationBell} from './NotificationBell';
import './notification-bell.css';
import './dropdown-motion.css';
import './notification-repair.css';
import './social-footer.css';
import './news.css';
import './mobile-header-fix.css';
import ServerStatus from './ServerStatus';
import './server-status.css';
import './soft-info.css';
import { SocialDiscord,SocialYoutube,SocialInstagram,SocialTikTok } from './SocialIcons';
type AuthState={user:User|null;profile:Profile|null;refresh:()=>Promise<void>;login:(provider:'google'|'discord')=>Promise<void>};
const AuthContext=createContext<AuthState>({user:null,profile:null,refresh:async()=>{},login:async()=>{}});
export const useAuth=()=>useContext(AuthContext);
export function AppShell({children}:{children:React.ReactNode}){
 const [softInfoOpen,setSoftInfoOpen]=useState(false);const softInfoRef=useRef<HTMLDivElement>(null);const [newsUnread,setNewsUnread]=useState(0);const [bloomOpen,setBloomOpen]=useState(false); const [user,setUser]=useState<User|null>(null),[profile,setProfile]=useState<Profile|null>(null),[menu,setMenu]=useState(false),[search,setSearch]=useState(''),[results,setResults]=useState<Profile[]>([]),[focused,setFocused]=useState(false);
 const bloomRef=useRef<HTMLDivElement>(null),accountRef=useRef<HTMLDivElement>(null);
 const router=useRouter();const pathname=usePathname();const [authReady,setAuthReady]=useState(false),[loginError,setLoginError]=useState(''); const searchRef=useRef<HTMLDivElement>(null);
 async function refresh(){const {data:{user:u}}=await supabase.auth.getUser();setUser(u);if(u){const {data}=await supabase.from('profiles').select('*').eq('id',u.id).maybeSingle();setProfile(data)}else setProfile(null);setAuthReady(true)}
 useEffect(()=>{void refresh();const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{setTimeout(()=>void refresh(),0)});return()=>subscription.unsubscribe()},[]);
 useEffect(()=>{if(!search.trim()){setResults([]);return}const t=setTimeout(async()=>{const {data}=await supabase.from('profiles').select('id,username,avatar_url,bio,username_changed_at,created_at').ilike('username',`%${search.trim().replace(/[%_\\]/g,'')}%`).limit(8);setResults(data||[])},280);return()=>clearTimeout(t)},[search]);
 useEffect(()=>{
  function closeOutside(event:PointerEvent){
   const target=event.target as Node;
   if(!softInfoRef.current?.contains(target))setSoftInfoOpen(false);
   if(!bloomRef.current?.contains(target))setBloomOpen(false);
   if(!accountRef.current?.contains(target))setMenu(false);
  }
  function closeEscape(event:KeyboardEvent){if(event.key==='Escape'){setSoftInfoOpen(false);setBloomOpen(false);setMenu(false)}}
  document.addEventListener('pointerdown',closeOutside);
  document.addEventListener('keydown',closeEscape);
  return()=>{document.removeEventListener('pointerdown',closeOutside);document.removeEventListener('keydown',closeEscape)};
 },[]);
 useEffect(()=>{setSoftInfoOpen(false);setBloomOpen(false);setMenu(false)},[pathname]);
 useEffect(()=>{const close=()=>{setSoftInfoOpen(false);setBloomOpen(false);setMenu(false)};window.addEventListener('softbloom:close-header-menus',close);return()=>window.removeEventListener('softbloom:close-header-menus',close)},[]);
 useEffect(()=>{
  if(!user)return;
  let active=true;
  const check=async()=>{
   const {data}=await supabase.from('bloom_news').select('id,created_at').order('created_at',{ascending:false}).limit(100);
   if(!active)return;
   const seen=localStorage.getItem(`softbloom-news-seen-${user.id}`);
   setNewsUnread((data||[]).filter(n=>!seen||new Date(n.created_at).getTime()>new Date(seen).getTime()).length);
  };
  void check();
  const interval=window.setInterval(()=>void check(),60000);
  const refreshOnFocus=()=>void check();
  window.addEventListener('focus',refreshOnFocus);
  const seenHandler=()=>void check();
  window.addEventListener('softbloom:news-seen',seenHandler);
  return()=>{active=false;clearInterval(interval);window.removeEventListener('focus',refreshOnFocus);window.removeEventListener('softbloom:news-seen',seenHandler)};
 },[user?.id]);
 async function login(provider:'google'|'discord'){setLoginError('');const {error}=await supabase.auth.signInWithOAuth({provider,options:{redirectTo:`${window.location.origin}/auth/callback`}});if(error)setLoginError(error.message)}
 async function logout(){await supabase.auth.signOut();setMenu(false);router.push('/');router.refresh()}
 const isCallback=pathname?.startsWith('/auth/callback');
 if(!isCallback&&(!authReady||!user))return <AuthContext.Provider value={{user,profile,refresh,login}}>
  <div className="scenery" aria-hidden="true"><div className="landscape"/><div className="petals">{Array.from({length:23},(_,i)=><span key={i} style={{left:`${(i*43+13)%100}%`,animationDelay:`-${i*1.7}s`,animationDuration:`${11+(i%8)*2}s`,fontSize:`${13+i%5*4}px`}}>🌸</span>)}</div></div>
  <main className="guest-gate"><div className="guest-card"><Image className="guest-logo" src="/softbloom-greeting.png" alt="SoftBloom" width={800} height={280} priority unoptimized/>
  {!authReady?<p role="status" className="guest-status">Checking your session...</p>:<><p className="guest-status">Sign in to enter the SoftBloomSMP community</p><div className="guest-actions"><button className="btn" onClick={()=>void login('google')}>Continue with Google</button><button className="btn outline" onClick={()=>void login('discord')}>Continue with Discord</button></div>{loginError&&<p className="error" role="alert">{loginError}</p>}</>}</div></main>
 </AuthContext.Provider>;
 return <AuthContext.Provider value={{user,profile,refresh,login}}><div className="scenery"  aria-hidden="true"><div className="landscape"/><div className="petals">{Array.from({length:23},(_,i)=><span key={i} style={{left:`${(i*43+13)%100}%`,animationDelay:`-${i*1.7}s`,animationDuration:`${11+(i%8)*2}s`,fontSize:`${13+i%5*4}px`}}>🌸</span>)}</div></div>
 <header className="topbar"><div className="soft-info-brand" ref={softInfoRef}><Image src="/softbloom-logo.png" width={36} height={36} alt="SoftBloom logo"/><button type="button" className="soft-info-trigger" aria-expanded={softInfoOpen} aria-haspopup="menu" onClick={()=>{setBloomOpen(false);setMenu(false);window.dispatchEvent(new Event('softbloom:close-notifications'));setSoftInfoOpen(v=>!v)}}>SoftBloom <ChevronDown size={14}/></button>{softInfoOpen&&<div className="soft-info-menu" role="menu">{[['About','about'],['Join','join'],['Features','features'],['Worlds','worlds'],['Info','info'],['Staff','staff'],['FAQ','faq']].map(([label,anchor])=><Link role="menuitem" key={anchor} href={anchor==='staff'?'/softbloom/staff':`/softbloom#${anchor}`} onClick={()=>setSoftInfoOpen(false)}>{label}</Link>)}</div>}</div><div className="sb-news-status"><Link href="/news" className="softbloom-news-nav"><Newspaper size={17}/><span>News</span>{newsUnread>0&&<span className="softbloom-news-count" aria-label={`${newsUnread} new news posts`}>{newsUnread>99?'99+':newsUnread}</span>}</Link><ServerStatus/></div>
 <div className="searchwrap"  ref={searchRef}><Search size={19}/><input aria-label="Search usernames" value={search} onFocus={()=>setFocused(true)} onBlur={()=>setTimeout(()=>setFocused(false),170)} onChange={e=>setSearch(e.target.value)} placeholder="Search community members..."/>{focused&&search.trim()&&<div className="searchresults">{results.length?results.map(p=><Link key={p.id} href={`/profile/${p.id}`} onClick={()=>{setSearch('');setFocused(false)}}><Avatar profile={p}/><span>{p.username}</span></Link>):<p>No users found</p>}</div>}</div>
 <nav><Link href="/" className="homebtn"><Home size={18}/><span>Home</span></Link><div className="bloom-nav" ref={bloomRef}><button type="button" className="homebtn" onClick={()=>{window.dispatchEvent(new Event("softbloom:close-notifications"));setMenu(false);setBloomOpen(v=>!v)}} aria-expanded={bloomOpen}><Flower2 size={18}/>Bloom<ChevronDown size={14}/></button>{bloomOpen&&<div className="bloom-menu"><Link href="/shop" onClick={()=>setBloomOpen(false)}><ShoppingBag size={17}/>Shop</Link><a href="https://glaive-mc.github.io/SoftBloom-Minecraft-Wiki/" target="_blank" rel="noopener noreferrer" onClick={()=>setBloomOpen(false)}><BookOpen size={17}/>Our Wiki</a></div>}</div><div className="sb-bell-container" onPointerDown={e=>e.stopPropagation()}><NotificationBell userId={user?.id||null}/></div><div className="account" ref={accountRef}><button className="avatarbutton" aria-label="Account menu" aria-expanded={menu} onClick={()=>{window.dispatchEvent(new Event("softbloom:close-notifications"));setBloomOpen(false);setMenu(v=>!v)}}><Avatar profile={profile}/></button>{menu&&<div className="dropdown">{user?<><div className="menu-user"><Link href={`/profile/${user.id}`} onClick={()=>setMenu(false)}><strong>{profile?.username||'Member'}</strong></Link><small>Signed in</small></div><Link href={`/profile/${user.id}`} onClick={()=>setMenu(false)}><UserRound size={17}/>Go to Profile</Link><Link href="/messages" onClick={()=>setMenu(false)}><MessageCircle size={17}/>Messages</Link><Link href="/settings" onClick={()=>setMenu(false)}><Settings size={17}/>Profile Settings</Link><button onClick={logout}><LogOut size={17}/>Logout</button></>:<><p>Welcome to SoftBloomSMP!</p><button onClick={()=>login('google')}><LogIn size={17}/>Sign Up with Google</button><button onClick={()=>login('discord')}><LogIn size={17}/>Sign Up with Discord</button></>}</div>}</div></nav></header>
 <main className="main">{children}</main><footer className="softbloom-social-footer"><div className="softbloom-social-links" aria-label="SoftBloomSMP social links"><a href="https://discord.com/invite/RKbhhCMbZ5" target="_blank" rel="noopener noreferrer" aria-label="Join our Discord server" title="Discord"><SocialDiscord/> <span>Discord</span></a><a href="https://www.youtube.com/@sftblmSMP" target="_blank" rel="noopener noreferrer" aria-label="Visit our YouTube channel" title="YouTube"><SocialYoutube/> <span>YouTube</span></a><a href="https://www.instagram.com/softbloomsmp?igsh=cG9rb2R5c2cya2U2" target="_blank" rel="noopener noreferrer" aria-label="Visit our Instagram" title="Instagram"><SocialInstagram/> <span>Instagram</span></a><a href="https://www.tiktok.com/@softbloomsmp" target="_blank" rel="noopener noreferrer" aria-label="Visit our TikTok" title="TikTok"><SocialTikTok/> <span>TikTok</span></a></div><div className="softbloom-footer-credit">Made with <Flower2 size={14}/> for the SoftBloomSMP community</div></footer></AuthContext.Provider>}
export function Avatar({profile,size=42}:{profile?:Profile|null;size?:number}){return profile?.avatar_url?<img className="avatar" src={profile.avatar_url} alt="Profile avatar" width={size} height={size} referrerPolicy="no-referrer"/>:<span className="avatar fallback" style={{width:size,height:size}}><UserRound size={size*.52}/></span>}
