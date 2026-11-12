import {json,cookies,sha256,sessionCookie,requireSameOrigin} from '../../_shared/auth.js';

export async function onRequestPost({request,env}) {
  if(!requireSameOrigin(request))return json({error:'Origin not allowed.'},403);
  const token=cookies(request).mdp_session;if(token&&env.DB)await env.DB.prepare('DELETE FROM user_sessions WHERE token_hash=?').bind(await sha256(token)).run();
  return json({success:true},200,{'Set-Cookie':sessionCookie('',0)});
}
export async function onRequest({request}) {if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{Allow:'POST, OPTIONS'}});return json({error:'Method not allowed.'},405,{Allow:'POST, OPTIONS'});}
