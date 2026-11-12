import {json,passwordHash,randomHex,resolveUser,requireSameOrigin} from '../../_shared/auth.js';

export async function onRequestPost({request,env}) {
  if(!requireSameOrigin(request))return json({error:'Origin not allowed.'},403);
  const auth=await resolveUser(request,env);if(auth.error)return json({error:auth.error},auth.error==='unauthorized'?401:503);
  let body;try{body=await request.json()}catch{return json({error:'Invalid JSON.'},400)}
  const password=String(body?.password||''),confirm=String(body?.confirm||'');
  if(password.length<8||password.length>256)return json({error:'Use at least 8 characters for the new password.'},400);
  if(password!==confirm)return json({error:'Passwords do not match.'},400);
  const salt=randomHex(16),hash=await passwordHash(password,salt),now=new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_salt=?,password_hash=?,must_change_password=0,updated_at=? WHERE id=?').bind(salt,hash,now,auth.user.id)
  ]);
  return json({success:true});
}
export async function onRequest({request}) {if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{Allow:'POST, OPTIONS'}});return json({error:'Method not allowed.'},405,{Allow:'POST, OPTIONS'});}
