import type { Metadata } from 'next';
import './globals.css';
import './moonlight.css';
import {ThemeSync} from '@/components/ThemePreference';
import { AppShell } from '@/components/AppShell';
export const metadata: Metadata = {title:'SoftBloomSMP 🌸',description:'A blooming Minecraft-inspired community',icons:{icon:'/softbloom-logo.png'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:"try{if(localStorage.getItem('sb-theme')==='dark')document.documentElement.dataset.sbTheme='dark'}catch(e){}"}}/></head><body><ThemeSync/><AppShell>{children}</AppShell></body></html>}
