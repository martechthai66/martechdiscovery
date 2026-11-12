(() => {
  const profile=document.querySelector('.profile-route[data-vendor-slug]');
  if(!profile)return;
  const slug=profile.dataset.vendorSlug;
  fetch(`/api/vendors/${encodeURIComponent(slug)}`,{headers:{accept:'application/json'}}).then(async response=>{
    if(!response.ok)return null;
    return response.json();
  }).then(vendor=>{
    if(!vendor)return;
    const locale=document.documentElement.lang==='th'?'th':'en';
    const name=String(vendor.name||'').trim(),description=String((locale==='th'?vendor.descriptionTh:vendor.descriptionEn)||'').trim();
    if(name){const heading=profile.querySelector('h1');if(heading)heading.textContent=name;const aboutHeading=profile.parentElement.querySelector('.profile-section h2');if(aboutHeading)aboutHeading.textContent=`${locale==='th'?'เกี่ยวกับ':'About'} ${name}`;document.title=`${name} — MarTech provider profile | MarTech Discovery Platform`;const og=document.querySelector('meta[property="og:title"]');if(og)og.content=document.title;}
    if(description){const intro=profile.querySelector('.route-intro');if(intro)intro.textContent=description;const about=profile.parentElement.querySelector('.profile-section p');if(about)about.textContent=description;const meta=document.querySelector('meta[name="description"]');if(meta)meta.content=description;const ogDescription=document.querySelector('meta[property="og:description"]');if(ogDescription)ogDescription.content=description;}
    const fields=[['Category',vendor.category],['Pricing model',vendor.pricingModel],['Support languages',vendor.supportedLanguages],['Company fit',vendor.market],['PDPA readiness',vendor.pdpa],['Integrations',vendor.integrations]];
    for(const [label,value] of fields){if(!value)continue;const term=[...profile.querySelectorAll('dt')].find(node=>node.textContent.trim().toLowerCase()===label.toLowerCase());if(term?.nextElementSibling)term.nextElementSibling.textContent=value;}
    const logoBadge=profile.querySelector('.logo-review-badge');
    if(logoBadge){const mock=vendor.logoType!=='source-asset';logoBadge.textContent=mock?(vendor.logoReview==='Mock logo · retained as mock'?'MOCK LOGO · CONFIRMED PLACEHOLDER':'MOCK LOGO · NEEDS REVIEW'):vendor.logoReview==='Approved'?'SOURCE LOGO · TEAM CONFIRMED':'SOURCE ASSET · REVIEW PENDING';logoBadge.classList.toggle('mock-logo-disclosure',mock);}
    if(vendor.logoType==='source-asset'&&vendor.logoAsset&&vendor.logoReview==='Approved'&&/^[a-z0-9._-]+$/i.test(vendor.logoAsset)){
      const current=profile.querySelector('.vendor-logo-source img,.vendor-logo-mark');
      if(current){const image=document.createElement('img');image.src=`/assets/vendor-logos/${vendor.logoAsset}`;image.alt=`${name} logo`;image.className='vendor-logo-source-img';image.loading='lazy';current.replaceWith(image);}
    }
  }).catch(()=>{});
})();
