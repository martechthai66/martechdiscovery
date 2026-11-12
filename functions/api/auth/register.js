import {json} from '../../_shared/auth.js';

export async function onRequestPost() {
  return json({error:'Public sign-up is disabled. Ask a Super Admin to create your account.'},403);
}

export async function onRequest({request}) {
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{Allow:'POST, OPTIONS'}});
  return json({error:'Method not allowed.'},405,{Allow:'POST, OPTIONS'});
}
