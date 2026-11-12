(() => {
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}};
  const apply=()=>{
    const prefs=read('mdp-site-config-v1',{}),theme=prefs.theme||localStorage.getItem('mdp-theme')||'dark';
    document.documentElement.dataset.theme=theme;
    const fontSize=Number(prefs.fontSizes?.[document.documentElement.lang]);
    if(fontSize>=12&&fontSize<=28)document.body.style.fontSize=`${fontSize}px`;
    if(prefs.accent)document.documentElement.style.setProperty('--primary',prefs.accent);
    if(prefs.secondary)document.documentElement.style.setProperty('--secondary',prefs.secondary);
    if(prefs.success)document.documentElement.style.setProperty('--success',prefs.success);
    const packs=read('mdp-sponsor-packages-v1',{}),lang=document.documentElement.lang||'th';
    document.querySelectorAll('[data-package-value]').forEach(el=>{
      const [tier,key]=el.dataset.packageValue.split('.'),value=packs[tier]?.[key]?.[lang]??packs[tier]?.[key]?.en;
      if(value!==undefined&&value!==null&&String(value).trim())el.textContent=value;
    });
    document.querySelectorAll('[data-package-benefits]').forEach(list=>{
      const tier=list.dataset.packageBenefits,items=packs[tier]?.benefits?.[lang]??packs[tier]?.benefits?.en;
      if(Array.isArray(items)&&items.length)list.innerHTML=items.map(item=>`<li>${String(item).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</li>`).join('');
    });
  };
  apply();
  window.addEventListener('storage',e=>{if(['mdp-site-config-v1','mdp-sponsor-packages-v1','mdp-theme'].includes(e.key))apply()});
})();
