import Link from 'next/link';
import './softbloom-info.css';
const pages=[['About','about'],['Join','join'],['Features','features'],['Worlds','worlds'],['Info','info'],['Staff','staff'],['FAQ','faq']];
export default function SoftBloomHome(){return <div className="sb-info"><header className="sb-info-hero"><p className="sb-info-kicker">🌸 WELCOME TO SOFTBLOOM</p><h1>Your place to play &amp; bloom.</h1><p>Discover the SoftBloom SMP community, server and team.</p></header><div className="sb-info-grid" style={{marginTop:24}}>{pages.map(([label,path])=><Link className="sb-info-card" style={{textDecoration:'none',color:'inherit'}} key={path} href={`/softbloom/${path}`}><h3>{label} →</h3><p>Explore {label.toLowerCase()}.</p></Link>)}</div></div>}
