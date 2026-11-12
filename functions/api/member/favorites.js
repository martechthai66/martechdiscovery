import {json,requireRole,requireSameOrigin} from '../../_shared/auth.js';

export async function onRequestGet({request,env}) {
  const auth=await requireRole(request,env,['member','admin','super_admin']);
  if(auth.error)return json({error:auth.error},auth.error==='unauthorized'?401:403);
  const rows=await env.DB.prepare('SELECT vendor_slug AS slug,created_at AS createdAt FROM member_saved_vendors WHERE user_id=? ORDER BY created_at DESC').bind(auth.user.id).all();
  return json({favorites:rows.results||[]});
}

export async function onRequestPost({request,env}) {
  if(!requireSameOrigin(request))return json({error:'Origin not allowed.'},403);
  const auth=await requireRole(request,env,['member','admin','super_admin']);
  if(auth.error)return json({error:auth.error},auth.error==='unauthorized'?401:403);
  let body;try{body=await request.json()}catch{return json({error:'Invalid JSON.'},400)}
  const slug=String(body?.slug||'').trim().toLowerCase();
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>180)return json({error:'Invalid vendor slug.'},400);
  await env.DB.prepare('INSERT INTO member_saved_vendors(user_id,vendor_slug,created_at) VALUES(?,?,?) ON CONFLICT(user_id,vendor_slug) DO NOTHING').bind(auth.user.id,slug,new Date().toISOString()).run();
  return json({success:true});
}

export async function onRequestDelete({request,env}) {
  if(!requireSameOrigin(request))return json({error:'Origin not allowed.'},403);
  const auth=await requireRole(request,env,['member','admin','super_admin']);
  if(auth.error)return json({error:auth.error},auth.error==='unauthorized'?401:403);
  let body;try{body=await request.json()}catch{return json({error:'Invalid JSON.'},400)}
  const slug=String(body?.slug||'').trim().toLowerCase();
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>180)return json({error:'Invalid vendor slug.'},400);
  await env.DB.prepare('DELETE FROM member_saved_vendors WHERE user_id=? AND vendor_slug=?').bind(auth.user.id,slug).run();
  return json({success:true});
}

export async function onRequest({request}) {
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{Allow:'GET, POST, DELETE, OPTIONS'}});
  return json({error:'Method not allowed.'},405,{Allow:'GET, POST, DELETE, OPTIONS'});
}
