-- Requires bloom_shop.sql (bloom_is_admin function). Run once in Supabase SQL Editor.
create table if not exists public.bloom_content (id uuid primary key default gen_random_uuid(),section text not null check(section in ('about','join','features','worlds','info','faq')),title text not null check(length(trim(title)) between 1 and 180),body text not null check(length(trim(body)) between 1 and 10000),image_url text,sort_order integer not null default 0,created_at timestamptz not null default now());
alter table public.bloom_content enable row level security;
drop policy if exists bloom_content_read on public.bloom_content;
create policy bloom_content_read on public.bloom_content for select to anon,authenticated using(true);
drop policy if exists bloom_content_insert on public.bloom_content;
create policy bloom_content_insert on public.bloom_content for insert to authenticated with check(public.bloom_is_admin());
drop policy if exists bloom_content_update on public.bloom_content;
create policy bloom_content_update on public.bloom_content for update to authenticated using(public.bloom_is_admin()) with check(public.bloom_is_admin());
drop policy if exists bloom_content_delete on public.bloom_content;
create policy bloom_content_delete on public.bloom_content for delete to authenticated using(public.bloom_is_admin());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('bloom-content-media','bloom-content-media',true,3145728,array['image/png','image/jpeg','image/webp']) on conflict(id) do update set public=true,file_size_limit=3145728,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists bloom_content_media_insert on storage.objects;
create policy bloom_content_media_insert on storage.objects for insert to authenticated with check(bucket_id='bloom-content-media' and public.bloom_is_admin() and split_part(name,'/',1)=auth.uid()::text);
-- Seed only if the table is empty; deleted content will not reappear on reruns.
do $$ begin if not exists(select 1 from public.bloom_content) then
insert into public.bloom_content(section,title,body,image_url,sort_order) values
('about','About SoftBloom','SoftBloom is a Minecraft community built for players who enjoy survival, adventure, creativity, and friendly multiplayer gameplay. SoftBloom SMP brings cozy survival, RPG-style progression, and a friendly community together.',null,0),
('about','Our Discord Hub','Our Discord server is the main hub for announcements, support, guides, events, our online store, and community interaction. https://discord.com/invite/RKbhhCMbZ5',null,1),
('join','Primary Java address','Softbloomsmp.site (no port required)',null,0),
('join','Primary Bedrock address','Softbloomsmp.site — Port: 12006',null,1),
('join','Alternative Java numeric IP','216.163.186.36:12006',null,2),
('join','Alternative Bedrock numeric IP','216.163.186.36 — Port: 12006',null,3),
('join','Server version','Java 1.21.11 · Bedrock Latest',null,4),
('features','Cozy & Community-Focused Survival','A welcoming survival world built around a close-knit community.',null,0),
('features','RPG-Style Progression & Leveled Mobs','Grow stronger through RPG progression and face mobs that scale with the challenge.',null,1),
('features','MMO-Like Skills & Progression','Train mining, combat, defense, fishing, and more.',null,2),
('features','1,400+ Quests with Rewards','Take on a large quest collection and earn rewards as you progress.',null,3),
('features','Custom Structures & Custom Trees','Discover custom-built structures and unique tree varieties.',null,4),
('features','Dungeons with Custom PvE Content & Rewards','Challenge custom PvE encounters and earn dungeon rewards.',null,5),
('features','Even More Fishes','Enjoy expanded fishing with custom fishing content.',null,6),
('features','Land Protection & Claiming','Claim land and protect the places you build.',null,7),
('features','Grindable Ranks','Progress from Settler to Eternal and unlock useful perks.',null,8),
('features','Player Economy, Shops & Trading','Trade with players and take part in a community-run economy.',null,9),
('features','Unique Loot, Crates, Collectibles & Rewards','Find special loot and collectibles through rewards and crates.',null,10),
('features','Cosmetics & Custom Content','Personalize your experience with cosmetics and custom content.',null,11),
('features','Community Events, Activities & Vote Rewards','Join community activities and earn rewards for voting.',null,12),
('features','Multilingual Translator','Chat translation supports EN, ES, FR, DE, PT, IT, JP, and CN.',null,13),
('features','Java + Bedrock Crossplay','Play together across Java and Bedrock editions.',null,14),
('features','Friendly & Welcoming Community','Meet players in a friendly community that welcomes everyone.',null,15),
('features','Parkour','Challenge yourself in the SoftBloom Parkour course, test your movement skills, and compete for the best times on the leaderboards.',null,16),
('features','Proximity Voice Chat','Talk with nearby players using in-game proximity voice chat while exploring, building, and adventuring together.',null,17),
('features','Player Warps','Visit player-created destinations around SoftBloom or create your own warp for others to discover.',null,18),
('features','Random Teleport','Discover new locations with Random Teleport and find places to explore, gather resources, or build.',null,19),
('features','Pets','Capture and collect pets from the world and bring your favorite companions along on your adventures.',null,20),
('features','Backpacks','Expand your storage with portable inventory space for longer adventures and resource gathering.',null,21),
('features','KOTH Events','Compete in King of the Hill events, fight for control of the area, and earn rewards.',null,22),
('features','Coinflip & Mini Games','Challenge other players to Coinflip and enjoy additional games and activities outside normal survival.',null,23),
('features','Teams','Form teams with other players and work together on builds, exploration, progression, and adventures.',null,24),
('features','Community Activities','Take part in interactive activities, chat games, events, and other community features throughout the server.',null,25),
('features','Quality-of-Life Features','Enjoy useful gameplay conveniences including elevators, player kits, selling tools, expanded storage, teleportation, and more.',null,26),
('worlds','Deeper Dark','Enter a dangerous world centered around the Deep Dark. Explore the darkness, face powerful threats, and discover what lies beneath.','/softbloom-info/world-deep-dark.jpg',0),
('worlds','Limbo','Step beyond the familiar and enter Limbo, a mysterious world filled with strange environments, unknown places, and discoveries waiting to be made.','/softbloom-info/world-limbo.jpg',1),
('worlds','Deep Blue','Dive into a world centered around the ocean. Explore vast waters, discover unique environments, and uncover what lies beneath the surface.','/softbloom-info/world-deep-blue.jpg',2),
('worlds','Resourceworld','Head out to gather materials, explore new terrain, and bring resources back for your builds and adventures.','/softbloom-info/world-resource.jpg',3),
('info','1,400+ Quests','Take on new goals, discover stories, and earn rewards.',null,0),
('info','Java + Bedrock','Join from your preferred edition and meet the community.',null,1),
('info','Settler → Eternal','Grindable ranks bring useful perks as you grow.',null,2),
('faq','How do I join SoftBloom?','Copy the SoftBloom SMP address from our server section , then add it in Minecraft multiplayer. Join our Discord for guides, and support.',null,0),
('faq','Does SoftBloom support Java and Bedrock?','Yes! SoftBloom SMP supports Java 1.21.11 and Bedrock (Latest) with crossplay.',null,1),
('faq','Is the server cracked?','SoftBloom uses login protection and Discord integration for a secure experience. Please check announcements in our Discord server.',null,2),
('faq','How do claims work?','SoftBloom SMP features land claiming and anti-grief protection. Use the in-game claiming system to protect your builds. Ask in Discord if you need help getting started.',null,3);
end if; end $$;
