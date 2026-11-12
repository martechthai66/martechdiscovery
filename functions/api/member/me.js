import {json,resolveUser} from '../../_shared/auth.js';

export async function onRequestGet({request,env}) {
  const result=await resolveUser(request,env);
  if(result.error)return json({error:result.error},result.error==='unauthorized'?401:result.error==='storage_unavailable'?503:403);
  return json({user:result.user});
}

export async function onRequest({request}) {
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{Allow:'GET, OPTIONS'}});
  return json({error:'Method not allowed.'},405,{Allow:'GET, OPTIONS'});
}
