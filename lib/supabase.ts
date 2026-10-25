import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
export const supabase = createClient(url, anon, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
export type Profile = {id:string;username:string;avatar_url:string|null;bio:string|null;username_changed_at:string|null;created_at:string};
export type Post = {id:string;user_id:string;body:string;media_url:string|null;media_type:string|null;created_at:string;updated_at:string;profiles?:Profile;comments?:{count:number}[];reactions?:{count:number}[]};
