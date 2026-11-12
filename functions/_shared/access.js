let certificatesPromise;

function decodePart(part) {
  const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
}

async function accessKeys(teamDomain) {
  certificatesPromise ||= fetch(`https://${teamDomain}/cdn-cgi/access/certs`, {headers:{accept:'application/json'}})
    .then(async response => {
      if (!response.ok) throw new Error('Could not load Cloudflare Access signing keys');
      return response.json();
    });
  return certificatesPromise;
}

export async function getAccessIdentity(request, env) {
  const teamDomain=String(env.CF_ACCESS_TEAM_DOMAIN||'').replace(/^https?:\/\//,'').replace(/\/$/,'');
  const expectedAudience=String(env.CF_ACCESS_AUD||'');
  const token=request.headers.get('Cf-Access-Jwt-Assertion');
  if(!teamDomain||!expectedAudience||!token) return null;
  try {
    const [encodedHeader,encodedPayload,encodedSignature]=token.split('.');
    if(!encodedHeader||!encodedPayload||!encodedSignature)return null;
    const header=decodePart(encodedHeader),payload=decodePart(encodedPayload);
    const now=Math.floor(Date.now()/1000),issuer=`https://${teamDomain}`;
    const audiences=Array.isArray(payload.aud)?payload.aud:[payload.aud];
    if(header.alg!=='RS256'||payload.iss!==issuer||!audiences.includes(expectedAudience)||!payload.exp||payload.exp<=now||(payload.nbf&&payload.nbf>now))return null;
    const key=(await accessKeys(teamDomain)).public_certs?.find(item=>item.kid===header.kid);
    if(!key)return null;
    const cryptoKey=await crypto.subtle.importKey('jwk',key, {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    const data=new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
    const signature=Uint8Array.from(atob(encodedSignature.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
    if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',cryptoKey,signature,data))return null;
    const email=String(payload.email||'').trim().toLowerCase();
    if(!/^\S+@\S+\.\S+$/.test(email))return null;
    return {email,name:String(payload.name||payload.email).trim().slice(0,160),subject:String(payload.sub||'').slice(0,200)};
  } catch { return null; }
}

export async function requireAccess(request, env) {
  return Boolean(await getAccessIdentity(request,env));
}

export async function resolveUser(request,env,{create=true}={}) {
  const identity=await getAccessIdentity(request,env);
  if(!identity)return {error:'unauthorized'};
  if(!env.DB)return {error:'storage_unavailable'};
  const now=new Date().toISOString();
  const bootstrap=String(env.INITIAL_SUPERADMIN_EMAIL||'').trim().toLowerCase();
  const role=bootstrap&&identity.email===bootstrap?'super_admin':'member';
  if(create)await env.DB.prepare(`INSERT INTO users(email,name,role,status,created_at,updated_at,last_login_at) VALUES(?,?,?,'active',?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at,last_login_at=excluded.last_login_at`).bind(identity.email,identity.name,role,now,now,now).run();
  const user=await env.DB.prepare('SELECT id,email,name,role,status,created_at AS createdAt,last_login_at AS lastLoginAt FROM users WHERE email=?').bind(identity.email).first();
  if(!user||user.status!=='active')return {error:'forbidden'};
  return {user,identity};
}

export async function requireRole(request,env,roles) {
  const result=await resolveUser(request,env);
  if(result.error)return result;
  if(!roles.includes(result.user.role))return {error:'forbidden',user:result.user};
  return result;
}

export function json(data,status=200,headers={}) {
  return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
}
