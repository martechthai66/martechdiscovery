import {json,requireRole,requireSameOrigin,passwordHash,randomHex} from '../../_shared/auth.js';

const clean=(v,max=200)=>String(v??'').trim().slice(0,max);
const passwordAlphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
function temporaryPassword(){const bytes=crypto.getRandomValues(new Uint8Array(8));return [...bytes].map(value=>passwordAlphabet[value%passwordAlphabet.length]).join('')}

export async function onRequestGet({request,env}) {
  const auth=await requireRole(request,env,['super_admin']);
  if(auth.error)return json({error:auth.error},auth.error==='unauthorized'?401:403);
  const rows=await env.DB.prepare('SELECT id,username,email,name,role,status,created_at AS createdAt,last_login_at AS lastLoginAt FROM users ORDER BY created_at DESC LIMIT 500').all();
  return json({users:rows.results||[]});
}

export async function onRequestPost({request,env}) {
  const auth=await requireRole(request,env,['super_admin']);
  if(auth.error)return json({error:auth.error},auth.error==='unauthorized'?401:403);
  if(!requireSameOrigin(request))return json({error:'Origin not allowed.'},403);
  let body;try{body=await request.json()}catch{return json({error:'Invalid JSON.'},400)}
  const username=clean(body?.username,80).toLowerCase(),email=clean(body?.email,254).toLowerCase(),name=clean(body?.name,120),role=clean(body?.role,20);
  if(!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(username)||!/^\S+@\S+\.\S+$/.test(email)||!name||!['member','admin','super_admin'].includes(role))return json({error:'Enter a valid username, email, name, and role.'},400);
  const password=temporaryPassword(),salt=randomHex(16),hash=await passwordHash(password,salt),now=new Date().toISOString();
  try{
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO users(username,email,name,role,status,password_salt,password_hash,must_change_password,created_at,updated_at,last_login_at) VALUES(?,?,?,?,'active',?,?,1,?,?,?)`).bind(username,email,name,role,salt,hash,now,now,now),
      env.DB.prepare('INSERT INTO audit_log(actor_email,action,target,details_json,created_at) VALUES(?,?,?,?,?)').bind(auth.user.email||auth.user.username,'user.create',username,JSON.stringify({role,email}),now)
    ]);
  }catch{return json({error:'Username or email is already in use.'},409)}
  return json({success:true,user:{username,email,name,role},temporaryPassword:password},201);
}

export async function onRequestPatch({request,env}) {
  const auth=await requireRole(request,env,['super_admin']);
  if(auth.error)return json({error:auth.error},auth.error==='unauthorized'?401:403);
  if(new URL(request.url).origin!==request.headers.get('Origin'))return json({error:'Origin not allowed.'},403);
  let body;try{body=await request.json()}catch{return json({error:'Invalid JSON.'},400)}
  const username=clean(body?.username,80).toLowerCase(),role=clean(body?.role,20),status=clean(body?.status,20);
  if(!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(username)||!['member','admin','super_admin'].includes(role)||!['active','suspended'].includes(status))return json({error:'Username, valid role and status are required.'},400);
  const target=await env.DB.prepare('SELECT id,role,status,email,username FROM users WHERE username=? COLLATE NOCASE').bind(username).first();
  if(!target)return json({error:'Member must create an account before a role can be assigned.'},404);
  if(target.id===auth.user.id&&(role!=='super_admin'||status!=='active'))return json({error:'You cannot remove your own Super Admin access.'},409);
  if(target.role==='super_admin'&&(role!=='super_admin'||status!=='active')){
    const count=await env.DB.prepare("SELECT COUNT(*) AS total FROM users WHERE role='super_admin' AND status='active'").first();
    if(Number(count?.total||0)<=1)return json({error:'The last active Super Admin cannot be demoted or suspended.'},409);
  }
  const now=new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET role=?,status=?,updated_at=? WHERE id=?').bind(role,status,now,target.id),
    env.DB.prepare('INSERT INTO audit_log(actor_email,action,target,details_json,created_at) VALUES(?,?,?,?,?)').bind(auth.user.email||auth.user.username,'user.role.update',username,JSON.stringify({role,status}),now)
  ]);
  return json({success:true});
}

export async function onRequest({request}) {
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{Allow:'GET, POST, PATCH, OPTIONS'}});
  return json({error:'Method not allowed.'},405,{Allow:'GET, POST, PATCH, OPTIONS'});
}
