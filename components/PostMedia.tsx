 'use client';
import {useState} from 'react';
export default function PostMedia({url,type,className,alt}:{url:string;type:string|null;className:string;alt:string}){
 const [ratio,setRatio]=useState('16 / 9');const [failed,setFailed]=useState(false);
 return <div className="sb-post-attachment">{type==='video'?<video className={className} src={url} controls playsInline preload="auto" style={{aspectRatio:ratio,height:'auto',objectFit:'contain',background:'#141018'}} onLoadedMetadata={e=>{const v=e.currentTarget;if(v.videoWidth&&v.videoHeight)setRatio(`${v.videoWidth} / ${v.videoHeight}`)}} onError={()=>setFailed(true)}/>:<img className={className} src={url} alt={alt} loading="lazy" onError={()=>setFailed(true)}/>} {failed&&<p className="muted small">This attachment could not be displayed. <a href={url} target="_blank" rel="noopener noreferrer">Open original attachment</a></p>}</div>
}
