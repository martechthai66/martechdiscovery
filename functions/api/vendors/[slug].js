import {json} from '../../_shared/access.js';

export async function onRequestGet({params,env}) {
  if(!env.DB)return json({error:'Not found.'},404);
  const slug=String(params?.slug||'').trim().toLowerCase();
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return json({error:'Not found.'},404);
  const row=await env.DB.prepare('SELECT name,data_json AS dataJson FROM vendor_overrides WHERE slug=?').bind(slug).first();
  if(!row)return json({error:'Not found.'},404);
  let data={};try{data=JSON.parse(row.dataJson||'{}')}catch{return json({error:'Not found.'},404)}
  if(data.status!=='Published')return json({error:'Not found.'},404);
  return json({slug,name:row.name,...data});
}

export async function onRequest({request}) {
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{Allow:'GET, OPTIONS'}});
  return json({error:'Method not allowed.'},405,{Allow:'GET, OPTIONS'});
}
