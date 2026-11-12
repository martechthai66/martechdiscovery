(() => {
  const form=document.querySelector('#buyer-lead-form');if(!form)return;
  const step1=form.querySelector('[data-step="1"]'),step2=form.querySelector('[data-step="2"]'),success=form.querySelector('[data-step="success"]');
  const next=document.querySelector('#lead-next'),back=document.querySelector('#lead-back'),skip=document.querySelector('#lead-skip');
  const dots=[...document.querySelectorAll('.step-dot')],label=document.querySelector('.progress-label');
  const th=document.documentElement.lang==='th',leadKey='mdp-buyer-leads-v1';
  function showStep(step){step1.hidden=step!==1;step2.hidden=step!==2;success.hidden=step!=='success';dots[0].classList.toggle('active',step===1);dots[1].classList.toggle('active',step===2||step==='success');if(label)label.textContent=th?(step===1?'ข้อมูลพื้นฐาน':'ข้อมูลเสริม (ไม่บังคับ)'):(step===1?'Basic details':'Optional details');}
  async function saveLead(){
    const data=new FormData(form),partners=data.getAll('partnerConsent');
    const lead={id:crypto.randomUUID?.()||`lead-${Date.now()}`,createdAt:new Date().toISOString(),source:'buyer-guide',name:String(data.get('name')||'').trim(),email:String(data.get('email')||'').trim(),company:String(data.get('company')||'').trim(),jobLevel:String(data.get('jobLevel')||''),industry:String(data.get('industry')||''),companySize:String(data.get('companySize')||''),budget:String(data.get('budget')||''),timeline:String(data.get('timeline')||''),website:String(data.get('website')||''),interestAreas:data.getAll('interestAreas'),consent:{processing:data.get('processingConsent')==='on',policyVersion:'2026-11-08',newsletter:data.get('newsletter')==='on',namedProviders:partners,demoContact:data.get('demoConsent')==='on'},deliveryStatus:'Local demo only'};
    let storedOnServer=false;
    try{const response=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(lead)});if(response.ok){storedOnServer=true;lead.deliveryStatus='Stored securely';}else if(![404,503].includes(response.status)){const result=await response.json().catch(()=>({}));throw new Error(result.error||'Could not submit your request.')}}catch(error){if(!(error instanceof TypeError))throw error}
    if(!storedOnServer){let leads=[];try{leads=JSON.parse(localStorage.getItem(leadKey)||'[]')}catch{};leads.unshift(lead);localStorage.setItem(leadKey,JSON.stringify(leads));}
    const successCopy=success.querySelector('p');if(successCopy)successCopy.textContent=storedOnServer?(th?'ส่งคำขอเรียบร้อยแล้ว ระบบบันทึกข้อมูลตามความยินยอมที่คุณเลือก':'Your request has been submitted and stored according to the consent you selected.'):(th?'บันทึกคำขอไว้ในเครื่องนี้แล้ว ข้อมูลยังไม่ถูกส่งไปยังเซิร์ฟเวอร์หรือผู้ให้บริการ':'Your request is saved in this browser demo. It has not been sent to a server or any provider.');
    showStep('success');if(window.lucide)window.lucide.createIcons({attrs:{'stroke-width':1.75}});
  }
  next?.addEventListener('click',()=>{if(!form.reportValidity())return;showStep(2);step2.querySelector('select')?.focus()});
  back?.addEventListener('click',()=>showStep(1));
  skip?.addEventListener('click',async()=>{if(!form.reportValidity())return;try{await saveLead()}catch(error){alert((th?'ส่งคำขอไม่สำเร็จ: ':'Submission failed: ')+error.message)}});
  form.addEventListener('submit',async e=>{e.preventDefault();if(!form.reportValidity())return;try{await saveLead()}catch(error){alert((th?'ส่งคำขอไม่สำเร็จ: ':'Submission failed: ')+error.message)}});
})();
