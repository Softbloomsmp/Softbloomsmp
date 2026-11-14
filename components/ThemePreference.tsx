'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {useAuth} from '@/components/AppShell';
function apply(dark:boolean){document.documentElement.dataset.sbTheme=dark?'dark':'light';try{localStorage.setItem('sb-theme',dark?'dark':'light')}catch{};window.dispatchEvent(new Event('sb-theme-change'))}
export function ThemeSync(){useEffect(()=>{let mounted=true;const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{if(mounted)apply(session?.user.user_metadata?.softbloom_theme==='dark')});return()=>{mounted=false;subscription.unsubscribe()}},[]);return null}
export function ThemeSetting(){const {user}=useAuth();const [dark,setDark]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');useEffect(()=>{const sync=()=>setDark(document.documentElement.dataset.sbTheme==='dark');sync();window.addEventListener('sb-theme-change',sync);return()=>window.removeEventListener('sb-theme-change',sync)},[]);
async function change(next:boolean){if(!user||busy)return;setBusy(true);setError('');const previous=dark;apply(next);try{const {error}=await supabase.auth.updateUser({data:{softbloom_theme:next?'dark':'light'}});if(error)throw error}catch{apply(previous);setError('Could not save your theme preference. Please try again.')}finally{setBusy(false)}}
return <section className="sb-appearance"><h2>Appearance</h2><label className="sb-theme-switch"><span><strong>{dark?'🌙':'☀️'} Dark Mode</strong><br/><span className="muted small">Experience SoftBloom under the moonlight.</span></span><input type="checkbox" role="switch" checked={dark} disabled={busy} onChange={e=>void change(e.target.checked)} aria-label="Dark Mode"/></label>{error&&<p className="error" role="alert">{error}</p>}</section>}
