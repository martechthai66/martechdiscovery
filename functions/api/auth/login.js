import {json,sessionCookie,passwordHash,randomHex,sha256,requireSameOrigin} from '../../_shared/auth.js';

const clean=(value,max=200)=>String(value??'').trim().slice(0,max);
const equal=(left,right)=>{const a=new TextEncoder().encode(String(left)),b=new TextEncoder().encode(String(right));let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a[i%a.length]||0)^(b[i%b.length]||0);return diff===0};

export async function onRequestPost({request,env}) {
  if(!requireSameOrigin(request))return json({error:'Origin not allowed.'},403);
  if(!env.DB)return json({error:'Authentication storage is not configured.'},503);
  let body;try{body=await request.json()}catch{return json({error:'Invalid JSON.'},400)}
  const username=clean(body?.username,80).toLowerCase(),password=String(body?.password||''),locale=body?.locale==='en'?'en':'th';
  if(!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(username)||password.length>256)return json({error:'Invalid username or password.'},400);
  const key=await sha256(`${env.RATE_LIMIT_SALT||'mdp-rate-limit'}:${request.cf?.connectingIp||'unknown'}:${username}`),now=Date.now(),windowStart=new Date(now-15*60*1000).toISOString();
  const attempt=await env.DB.prepare(`INSERT INTO auth_rate_limits(limit_key,window_started_at,attempts) VALUES(?,?,1) ON CONFLICT(limit_key) DO UPDATE SET attempts=CASE WHEN window_started_at<? THEN 1 ELSE attempts+1 END,window_started_at=CASE WHEN window_started_at<? THEN excluded.window_started_at ELSE window_started_at END RETURNING attempts`).bind(key,new Date(now).toISOString(),windowStart,windowStart).first();
  if(Number(attempt?.attempts)>8)return json({error:'Too many sign-in attempts. Try again in 15 minutes.'},429);
  const user=await env.DB.prepare('SELECT id,username,password_salt,password_hash,status,must_change_password FROM users WHERE username=? COLLATE NOCASE').bind(username).first();
  const candidate=await passwordHash(password,user?.password_salt||'00'.repeat(16));
  const valid=user&&user.status==='active'&&equal(candidate,user.password_hash);
  if(!valid)return json({error:'Invalid username or password.'},401);
  const token=randomHex(32),createdAt=new Date().toISOString(),expiresAt=new Date(Date.now()+7*24*60*60*1000).toISOString();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO user_sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)').bind(await sha256(token),user.id,createdAt,expiresAt),
    env.DB.prepare('UPDATE users SET last_login_at=?,updated_at=? WHERE id=?').bind(createdAt,createdAt,user.id),
    env.DB.prepare('DELETE FROM auth_rate_limits WHERE limit_key=?').bind(key)
  ]);
  return json({success:true,forcePasswordChange:Boolean(user.must_change_password),redirect:user.must_change_password?`/${locale}/change-password/`:user.role==='member'?`/${locale}/member/`:'/admin/'},200,{'Set-Cookie':sessionCookie(token)});
}

export async function onRequest({request}) {if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{Allow:'POST, OPTIONS'}});return json({error:'Method not allowed.'},405,{Allow:'POST, OPTIONS'});}
