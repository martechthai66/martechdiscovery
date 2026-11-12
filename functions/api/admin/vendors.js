import {json,requireRole,requireSameOrigin} from '../../_shared/auth.js';

const clean=(value,max)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
const allowedStatuses=new Set(['Draft','Needs review','Published']);
const reviewStates=new Set(['Pending','Confirmed','Correction needed','Mock logo · replace or approve','Mock logo · retained as mock','Official asset · pending verification','Approved']);
const nameReviewStates=new Set(['Pending','Confirmed','Correction needed']);
const logoReviewStates=new Set(['Pending','Official asset · pending verification','Mock logo · replace or approve','Mock logo · retained as mock','Approved','Correction needed']);

export async function onRequestGet({request,env}) {
  const auth=await requireRole(request,env,['admin','super_admin']);
  if(auth.error)return json({error:auth.error},auth.error==='unauthorized'?401:403);
  if(!env.DB)return json({error:'Vendor storage is not configured.'},503);
  const result=await env.DB.prepare('SELECT slug,name,data_json AS dataJson,updated_at AS updatedAt,updated_by AS updatedBy FROM vendor_overrides ORDER BY name COLLATE NOCASE').all();
  return json({vendors:(result.results||[]).map(row=>{let data={};try{data=JSON.parse(row.dataJson||'{}')}catch{}return {...row,data}})});
}

export async function onRequestPut({request,env}) {
  const auth=await requireRole(request,env,['admin','super_admin']);
  if(auth.error)return json({error:auth.error},auth.error==='unauthorized'?401:403);
  if(!requireSameOrigin(request))return json({error:'Origin not allowed.'},403);
  if(!env.DB)return json({error:'Vendor storage is not configured.'},503);
  let body;try{body=await request.json()}catch{return json({error:'Invalid JSON.'},400)}
  const slug=clean(body?.slug,180).toLowerCase(),name=clean(body?.name,180),record=body?.data;
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||!name||!record||typeof record!=='object'||Array.isArray(record))return json({error:'Valid vendor slug, name, and details are required.'},400);
  const data={
    category:clean(record.category,180),website:clean(record.website,500),pricingModel:clean(record.pricingModel,180),supportedLanguages:clean(record.supportedLanguages,160),market:clean(record.market,180),integrations:clean(record.integrations,1000),pdpa:clean(record.pdpa,180),descriptionEn:clean(record.descriptionEn,6000),descriptionTh:clean(record.descriptionTh,6000),status:allowedStatuses.has(record.status)?record.status:'Draft',companyNameReview:nameReviewStates.has(record.companyNameReview)?record.companyNameReview:'Pending',logoReview:reviewStates.has(record.logoReview)?record.logoReview:'Pending',logoType:record.logoType==='source-asset'&&/^[a-z0-9._-]+\.webp$/i.test(String(record.logoAsset||''))?'source-asset':'mock',logoAsset:record.logoType==='source-asset'&&/^[a-z0-9._-]+\.webp$/i.test(String(record.logoAsset||''))?clean(record.logoAsset,240):''
  };
  const now=new Date().toISOString(),details=JSON.stringify(data);
  try{
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO vendor_overrides(slug,name,data_json,updated_at,updated_by) VALUES(?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET name=excluded.name,data_json=excluded.data_json,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).bind(slug,name,details,now,auth.user.username),
      env.DB.prepare('INSERT INTO audit_log(actor_email,action,target,details_json,created_at) VALUES(?,?,?,?,?)').bind(auth.user.email||auth.user.username,'vendor.upsert',slug,JSON.stringify({name,status:data.status,companyNameReview:data.companyNameReview,logoReview:data.logoReview}),now)
    ]);
  }catch{return json({error:'Could not save vendor details.'},500)}
  return json({success:true,vendor:{slug,name,data,updatedAt:now,updatedBy:auth.user.username}});
}

export async function onRequestPost({request,env}) {
  const auth=await requireRole(request,env,['admin','super_admin']);
  if(auth.error)return json({error:auth.error},auth.error==='unauthorized'?401:403);
  if(!requireSameOrigin(request))return json({error:'Origin not allowed.'},403);
  if(!env.DB)return json({error:'Vendor storage is not configured.'},503);
  let body;try{body=await request.json()}catch{return json({error:'Invalid JSON.'},400)}
  if(Array.isArray(body?.vendors)){
    if(!body.vendors.length||body.vendors.length>100)return json({error:'Import between 1 and 100 vendor records at a time.'},400);
    const current=await env.DB.prepare('SELECT slug,name,data_json AS dataJson FROM vendor_overrides').all(),bySlug=new Map(),byName=new Map();
    for(const row of current.results||[]){let data={};try{data=JSON.parse(row.dataJson||'{}')}catch{}const entry={...row,data};bySlug.set(row.slug,entry);byName.set(row.name.trim().toLowerCase(),entry)}
    const incoming=[],seen=new Set();
    for(const item of body.vendors){
      if(!item||typeof item!=='object'||Array.isArray(item))return json({error:'Every import row must be an object.'},400);
      const name=clean(item.name||item.vendor||item.vendor_name||item.company_name_from_list,180),existing=bySlug.get(clean(item.slug||item.vendor_slug,180).toLowerCase())||byName.get(name.toLowerCase());
      let slug=clean(item.slug||item.vendor_slug||existing?.slug,180).toLowerCase();
      if(!slug)slug=name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||!name)return json({error:'Each row needs a valid slug and company name.'},400);
      if(seen.has(slug))return json({error:`Duplicate vendor slug: ${slug}`},400);seen.add(slug);
      const old=bySlug.get(slug)?.data||{},pick=(keys,max,fallback='')=>{for(const key of keys){if(item[key]!==undefined&&item[key]!==null&&String(item[key]).trim()!=='')return clean(item[key],max)}return old[keys[0]]??fallback};
      const asset=pick(['logoAsset','logo_asset'],240),requestedLogoType=pick(['logoType','logo_type'],30,asset?'source-asset':'mock'),logoType=(requestedLogoType==='source-asset'||requestedLogoType==='SOURCE IMAGE ASSET')&&/^[a-z0-9._-]+\.webp$/i.test(asset)?'source-asset':'mock';
      const nameReview=pick(['companyNameReview','company_name_review'],100,old.companyNameReview||'Pending'),logoReview=pick(['logoReview','logo_review'],100,old.logoReview||(logoType==='source-asset'?'Official asset · pending verification':'Mock logo · replace or approve'));
      const data={category:pick(['category','primaryCategory'],180,old.category||'Needs verification'),website:pick(['website'],500),pricingModel:pick(['pricingModel','pricing'],180,old.pricingModel||'Not yet verified'),supportedLanguages:pick(['supportedLanguages','supported_languages'],160,old.supportedLanguages||'Not yet verified'),market:pick(['market'],180,old.market||'Not yet verified'),integrations:pick(['integrations'],1000),pdpa:pick(['pdpa'],180,old.pdpa||'Not yet verified'),descriptionEn:pick(['descriptionEn','summaryEn','description_en'],6000),descriptionTh:pick(['descriptionTh','summaryTh','description_th'],6000),status:allowedStatuses.has(item.status)?item.status:(old.status||'Draft'),companyNameReview:nameReviewStates.has(nameReview)?nameReview:'Pending',logoReview:logoReviewStates.has(logoReview)?logoReview:(logoType==='source-asset'?'Official asset · pending verification':'Mock logo · replace or approve'),logoType,logoAsset:logoType==='source-asset'?asset:''};
      incoming.push({slug,name,data});
    }
    const now=new Date().toISOString(),statements=incoming.map(v=>env.DB.prepare('INSERT INTO vendor_overrides(slug,name,data_json,updated_at,updated_by) VALUES(?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET name=excluded.name,data_json=excluded.data_json,updated_at=excluded.updated_at,updated_by=excluded.updated_by').bind(v.slug,v.name,JSON.stringify(v.data),now,auth.user.username));
    statements.push(env.DB.prepare('INSERT INTO audit_log(actor_email,action,target,details_json,created_at) VALUES(?,?,?,?,?)').bind(auth.user.email||auth.user.username,'vendor.import.bulk','vendor_overrides',JSON.stringify({count:incoming.length,slugs:incoming.map(v=>v.slug)}),now));
    try{await env.DB.batch(statements)}catch{return json({error:'Could not import vendor records.'},500)}
    return json({success:true,imported:incoming.length,updatedAt:now,updatedBy:auth.user.username});
  }
  const slugs=[...new Set((Array.isArray(body?.slugs)?body.slugs:[]).map(x=>clean(x,180).toLowerCase()))];
  const companyNameReview=body?.companyNameReview||'',logoReview=body?.logoReview||'';
  if(!slugs.length||slugs.length>100||slugs.some(slug=>!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)))return json({error:'Select between 1 and 100 valid vendor records.'},400);
  if(!companyNameReview&&!logoReview)return json({error:'Choose at least one review status to update.'},400);
  if(companyNameReview&&!nameReviewStates.has(companyNameReview))return json({error:'Invalid company name review status.'},400);
  if(logoReview&&!logoReviewStates.has(logoReview))return json({error:'Invalid logo review status.'},400);
  const placeholders=slugs.map(()=>'?').join(','),existing=await env.DB.prepare(`SELECT slug FROM vendor_overrides WHERE slug IN (${placeholders})`).bind(...slugs).all();
  if((existing.results||[]).length!==slugs.length)return json({error:'One or more selected vendors are missing from D1. Reload the vendor list.'},409);
  const now=new Date().toISOString(),setters=[],values=[];
  if(companyNameReview){setters.push("'$.companyNameReview',?");values.push(companyNameReview)}
  if(logoReview){setters.push("'$.logoReview',?");values.push(logoReview)}
  const statements=slugs.map(slug=>env.DB.prepare(`UPDATE vendor_overrides SET data_json=json_set(data_json,${setters.join(',')}),updated_at=?,updated_by=? WHERE slug=?`).bind(...values,now,auth.user.username,slug));
  statements.push(env.DB.prepare('INSERT INTO audit_log(actor_email,action,target,details_json,created_at) VALUES(?,?,?,?,?)').bind(auth.user.email||auth.user.username,'vendor.review.bulk','vendor_overrides',JSON.stringify({count:slugs.length,companyNameReview:companyNameReview||null,logoReview:logoReview||null,slugs}),now));
  try{await env.DB.batch(statements)}catch{return json({error:'Could not update vendor review statuses.'},500)}
  return json({success:true,updated:slugs.length,updatedAt:now,updatedBy:auth.user.username});
}

export async function onRequest({request}) {
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{Allow:'GET, PUT, POST, OPTIONS'}});
  return json({error:'Method not allowed.'},405,{Allow:'GET, PUT, POST, OPTIONS'});
}
