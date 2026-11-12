import {json} from './access.js';
export {json};

const SESSION_COOKIE='mdp_session';
const encoder=new TextEncoder();
const bytesToHex=bytes=>[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
const hexToBytes=hex=>new Uint8Array((hex.match(/.{1,2}/g)||[]).map(x=>parseInt(x,16)));

export async function passwordHash(password,saltHex) {
  const salt=hexToBytes(saltHex);
  let material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  let result=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},material,256);
  material=await crypto.subtle.importKey('raw',result,'PBKDF2',false,['deriveBits']);
  const secondSalt=new Uint8Array(salt.length+1);secondSalt.set(salt);secondSalt[salt.length]=1;
  result=await crypto.subtle.deriveBits({name:'PBKDF2',salt:secondSalt,iterations:100000,hash:'SHA-256'},material,256);
  return bytesToHex(result);
}

export const randomHex=(length=32)=>bytesToHex(crypto.getRandomValues(new Uint8Array(length)));
export const sha256=async value=>bytesToHex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
export function cookies(request){const entries=[];for(const part of (request.headers.get('Cookie')||'').split(';')){const x=part.trim(),i=x.indexOf('=');if(i<0)continue;try{entries.push([x.slice(0,i),decodeURIComponent(x.slice(i+1))])}catch{}}return Object.fromEntries(entries)}
export function sessionCookie(token,maxAge=60*60*24*7){return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`}
export function requireSameOrigin(request){const origin=request.headers.get('Origin');return !origin||new URL(origin).origin===new URL(request.url).origin}

export async function resolveUser(request,env) {
  if(!env.DB)return {error:'storage_unavailable'};
  const token=cookies(request)[SESSION_COOKIE];if(!token||token.length>160)return {error:'unauthorized'};
  const row=await env.DB.prepare(`SELECT u.id,u.username,u.email,u.name,u.role,u.status,u.must_change_password AS mustChangePassword,u.created_at AS createdAt,u.last_login_at AS lastLoginAt,s.expires_at AS expiresAt FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?`).bind(await sha256(token)).first();
  if(!row||row.status!=='active'||Date.parse(row.expiresAt)<=Date.now())return {error:'unauthorized'};
  return {user:row};
}

export async function requireRole(request,env,roles) {
  const result=await resolveUser(request,env);if(result.error)return result;
  if(!roles.includes(result.user.role))return {error:'forbidden',user:result.user};
  return result;
}

export function authError(result){return json({error:result.error==='storage_unavailable'?'Authentication storage is not configured.':result.error},result.error==='unauthorized'?401:result.error==='storage_unavailable'?503:403)}
