'use client';
import {useEffect,useState} from 'react';

type Status = {online:boolean;checkedAt:string;playersOnline:number|null;playersMax:number|null;source:'java'|'bedrock'|null};
export default function ServerStatus(){
 const [status,setStatus]=useState<Status|null>(null);
 const [error,setError]=useState(false);
 useEffect(()=>{
  let active=true;
  async function refresh(){
   try{
    const response=await fetch('/api/minecraft-status',{cache:'no-store'});
    if(!response.ok)throw new Error('Status unavailable');
    const data=await response.json() as Status;
    if(active){setStatus(data);setError(false)}
   }catch{if(active){setError(true);setStatus(null)}}
  }
  void refresh();
  const timer=window.setInterval(()=>void refresh(),60000);
  return()=>{active=false;window.clearInterval(timer)};
 },[]);
 const label=error?'Unavailable':!status?'Checking':status.online?'Online':'Offline';
 const countLabel=status?.online?(status.playersOnline===null?'Players unavailable':`${status.playersOnline}/${status.playersMax ?? '?'}`):null;
 return <span className={`sb-server-status ${status?.online?'is-online':status?'is-offline':'is-unknown'}`} role="status" aria-label={`Minecraft server ${label}`} title={status?.online?`Minecraft server online${status.playersOnline!==null?` · ${status.playersOnline} players`:''}`:`Minecraft server status: ${label}`}>
  <span className="sb-server-dot" aria-hidden="true"/><span className="sb-server-label">{label}</span>{status?.online&&countLabel&&<span className="sb-server-count">· {countLabel}</span>}
 </span>;
}
