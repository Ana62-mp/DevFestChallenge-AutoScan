const {scryptSync,timingSafeEqual,randomBytes}=require('node:crypto');
const normalize = value => String(value).trim().toLocaleLowerCase('es');
function secretHash(value,salt=randomBytes(16).toString('hex')){return {salt,hash:scryptSync(normalize(value),salt,32).toString('hex')};}
function matches(value,secret){if(!secret?.hash||!secret?.salt)return false;const candidate=scryptSync(normalize(value),secret.salt,32);const expected=Buffer.from(secret.hash,'hex');return expected.length===candidate.length&&timingSafeEqual(expected,candidate);}
function extractPlates(text){return [...new Set((text.toUpperCase().match(/\b[A-Z]{3}[\s-]?\d{4}\b/g)||[]).map(p=>p.replace(/[^A-Z0-9]/g,'').replace(/^([A-Z]{3})(\d{4})$/,'$1-$2')))];}
function pattern(previous,now){const times=[...(previous?.times||[]).filter(t=>t>=now-7*86400000),now];return {times,count:times.length,alert:times.length>=3&&(!previous?.lastAlert||previous.lastAlert<now-7*86400000)};}
module.exports={secretHash,matches,extractPlates,pattern};
