const safeText=value=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,6000);
const escapeHtml=value=>String(value).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

export async function onRequest(context) {
  const {request,env}=context;
  const match=new URL(request.url).pathname.match(/^\/(th|en)\/providers\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/i);
  const response=await context.next();
  if(!match||!env.DB||!response.ok||!response.headers.get('content-type')?.includes('text/html'))return response;

  let row;
  try{row=await env.DB.prepare('SELECT name,data_json AS dataJson FROM vendor_overrides WHERE slug=?').bind(match[2].toLowerCase()).first()}catch{return response}
  if(!row)return response;
  let data;try{data=JSON.parse(row.dataJson||'{}')}catch{return response}
  if(data.status!=='Published')return response;

  const locale=match[1].toLowerCase(),name=safeText(row.name),description=safeText(locale==='th'?data.descriptionTh:data.descriptionEn),title=locale==='th'?`${name} — ผู้ให้บริการ MarTech | MarTech Discovery Platform`:`${name} — MarTech provider profile | MarTech Discovery Platform`;
  let factIndex=0;
  const factValues=[null,safeText(data.pricingModel),safeText(data.supportedLanguages),safeText(data.market),null,safeText(data.pdpa),safeText(data.integrations)];
  const html=new HTMLRewriter()
    .on('title',{element:e=>e.setInnerContent(title)})
    .on('meta[name="description"]',{element:e=>{if(description)e.setAttribute('content',description)}})
    .on('meta[property="og:title"]',{element:e=>e.setAttribute('content',title)})
    .on('meta[property="og:description"]',{element:e=>{if(description)e.setAttribute('content',description)}})
    .on('.profile-route h1',{element:e=>e.setInnerContent(name)})
    .on('.profile-route .route-intro',{element:e=>{if(description)e.setInnerContent(description)}})
    .on('.profile-section h2',{element:e=>e.setInnerContent(`${locale==='th'?'เกี่ยวกับ':'About'} ${name}`)})
    .on('.profile-section p',{element:e=>{if(description)e.setInnerContent(description)}})
    .on('.profile-facts dl dd',{element:e=>{const value=factValues[factIndex++];if(value)e.setInnerContent(value)}})
    .on('.logo-review-badge',{element:e=>{const mock=data.logoType!=='source-asset';e.setInnerContent(mock?(data.logoReview==='Mock logo · retained as mock'?'MOCK LOGO · CONFIRMED PLACEHOLDER':'MOCK LOGO · NEEDS REVIEW'):data.logoReview==='Approved'?'SOURCE LOGO · TEAM CONFIRMED':'SOURCE ASSET · REVIEW PENDING');if(mock)e.setAttribute('class',`${e.getAttribute('class')||''} mock-logo-disclosure`)}});

  if(data.logoType==='source-asset'&&data.logoReview==='Approved'&&/^[a-z0-9._-]+\.webp$/i.test(String(data.logoAsset||''))){
    const asset=String(data.logoAsset);
    html.on('.profile-route .vendor-logo-source,.profile-route .vendor-logo-mark',{element:e=>e.replace(`<img class="vendor-logo-source-img" src="/assets/vendor-logos/${asset}" alt="${escapeHtml(name)} logo" loading="lazy">`,{html:true})});
  }

  const rendered=html.transform(response),headers=new Headers(rendered.headers);
  headers.set('cache-control','no-store');
  return new Response(rendered.body,{status:rendered.status,statusText:rendered.statusText,headers});
}
