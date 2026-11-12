import {json,requireRole} from '../_shared/auth.js';

const POLICY_VERSION='2026-11-08';
const clean=(value,max=300)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
const arrayOf=(value,maxItems=30,maxLength=120)=>Array.isArray(value)?[...new Set(value.map(v=>clean(v,maxLength)).filter(Boolean))].slice(0,maxItems):[];

async function digest(value) {
  const bytes=new TextEncoder().encode(value);
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');
}

export async function onRequestPost({request,env}) {
  if(!env.DB)return json({error:'Lead storage is not configured.'},503);
  const origin=request.headers.get('Origin');
  if(origin&&new URL(origin).origin!==new URL(request.url).origin)return json({error:'Origin not allowed.'},403);
  const contentLength=Number(request.headers.get('Content-Length')||0);
  if(contentLength>24_000)return json({error:'Request too large.'},413);
  let body;
  try{body=await request.json()}catch{return json({error:'Invalid JSON.'},400)}
  if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'Invalid request.'},400);
  if(clean(body.website,300))return json({success:true}); // honeypot field
  const name=clean(body.name,120),email=clean(body.email,254).toLowerCase(),company=clean(body.company,180);
  if(!name||!company||!/^\S+@\S+\.\S+$/.test(email))return json({error:'Name, company and a valid email are required.'},400);
  if(body.consent?.processing!==true||clean(body.consent?.policyVersion,32)!==POLICY_VERSION)return json({error:'Current data-processing consent is required.'},400);
  const namedProviders=arrayOf(body.consent?.namedProviders,20,180);
  if(body.consent?.demoContact===true&&!namedProviders.length)return json({error:'Choose at least one named provider for demo follow-up consent.'},400);

  const ip=request.cf?.connectingIp||'';
  if(ip){
    const day=new Date().toISOString().slice(0,10),sourceHash=await digest(`${env.RATE_LIMIT_SALT||'change-this-salt'}:${ip}`);
    const limit=await env.DB.prepare(`INSERT INTO lead_rate_limits(day_key,source_hash,request_count) VALUES(?,?,1) ON CONFLICT(day_key,source_hash) DO UPDATE SET request_count=request_count+1 WHERE request_count<5 RETURNING request_count`).bind(day,sourceHash).first();
    if(!limit)return json({error:'Too many requests. Please try again tomorrow.'},429);
  }

  const id=crypto.randomUUID(),createdAt=new Date().toISOString();
  const interests=arrayOf(body.interestAreas,30,80);
  const leadStatement=env.DB.prepare(`INSERT INTO leads (id,created_at,source,name,email,company,job_level,industry,company_size,budget,timeline,interest_areas_json,processing_consent,consent_policy_version,newsletter_consent,demo_contact_consent) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)`)
    .bind(id,createdAt,clean(body.source,40)||'buyer-guide',name,email,company,clean(body.jobLevel,100),clean(body.industry,120),clean(body.companySize,40),clean(body.budget,80),clean(body.timeline,60),JSON.stringify(interests),POLICY_VERSION,body.consent?.newsletter===true?1:0,body.consent?.demoContact===true?1:0);
  const statements=[leadStatement,...namedProviders.map(provider=>env.DB.prepare('INSERT INTO lead_provider_consents (lead_id,provider_name,consented_at,consent_text_version) VALUES (?,?,?,?)').bind(id,provider,createdAt,POLICY_VERSION))];
  try{await env.DB.batch(statements)}catch{return json({error:'Could not save this request.'},500)}
  return json({success:true,id},201);
}

export async function onRequestGet({request,env}) {
  const auth=await requireRole(request,env,['admin','super_admin']);
  if(auth.error)return json({error:auth.error==='unauthorized'?'Cloudflare Access authorization required.':'Admin role required.'},auth.error==='unauthorized'?401:403);
  if(!env.DB)return json({error:'Lead storage is not configured.'},503);
  const url=new URL(request.url),limit=Math.min(250,Math.max(1,Number(url.searchParams.get('limit'))||100));
  const leads=await env.DB.prepare(`SELECT id,created_at AS createdAt,source,name,email,company,job_level AS jobLevel,industry,company_size AS companySize,budget,timeline,interest_areas_json AS interestAreas,processing_consent AS processingConsent,consent_policy_version AS consentPolicyVersion,newsletter_consent AS newsletterConsent,demo_contact_consent AS demoContactConsent,status FROM leads WHERE status!='deleted' ORDER BY created_at DESC LIMIT ?`).bind(limit).all();
  const ids=(leads.results||[]).map(row=>row.id),consents=[];
  if(ids.length){
    const placeholders=ids.map(()=>'?').join(',');
    const result=await env.DB.prepare(`SELECT lead_id AS leadId,provider_name AS providerName,consented_at AS consentedAt,delivery_status AS deliveryStatus FROM lead_provider_consents WHERE lead_id IN (${placeholders}) ORDER BY id`).bind(...ids).all();
    consents.push(...(result.results||[]));
  }
  const grouped=new Map();for(const item of consents){const list=grouped.get(item.leadId)||[];list.push(item);grouped.set(item.leadId,list)}
  return json({leads:(leads.results||[]).map(row=>({...row,interestAreas:JSON.parse(row.interestAreas||'[]'),consents:grouped.get(row.id)||[]}))});
}

export async function onRequestDelete({request,env}) {
  const auth=await requireRole(request,env,['admin','super_admin']);
  if(auth.error)return json({error:auth.error==='unauthorized'?'Cloudflare Access authorization required.':'Admin role required.'},auth.error==='unauthorized'?401:403);
  if(!env.DB)return json({error:'Lead storage is not configured.'},503);
  let body;try{body=await request.json()}catch{return json({error:'Invalid JSON.'},400)}
  const id=clean(body?.id,64);if(!id)return json({error:'Lead id is required.'},400);
  await env.DB.prepare(`UPDATE leads SET status='deleted' WHERE id=?`).bind(id).run();
  await env.DB.prepare(`DELETE FROM lead_provider_consents WHERE lead_id=?`).bind(id).run();
  return json({success:true});
}

export async function onRequest({request}) {
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{Allow:'GET, POST, DELETE, OPTIONS'}});
  return json({error:'Method not allowed.'},405,{Allow:'GET, POST, DELETE, OPTIONS'});
}
