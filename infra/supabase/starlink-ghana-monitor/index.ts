// Starlink Ghana Monitor: anonymous site, capability-protected personal snapshots.
// Both read and write credentials are random 256-bit strings generated on the laptop.
// No Starlink authentication or device identifiers are needed.
const HEADERS = {
 "Access-Control-Allow-Origin": "*",
 "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
 "Access-Control-Allow-Headers": "content-type, authorization",
 "Cache-Control": "no-store",
 "X-Content-Type-Options": "nosniff",
};
const ok = (body: unknown, status=200) => Response.json(body,{status,headers:HEADERS});
const valid = (s:unknown): s is string => typeof s==="string" && /^[A-Za-z0-9_-]{43}$/.test(s);
const isUuid = (s:unknown) => typeof s==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
async function digest(input:string) {
 const raw = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input));
 return Array.from(new Uint8Array(raw), (b)=>b.toString(16).padStart(2,"0")).join("");
}
function bearer(req:Request) {
 const value=req.headers.get("authorization")||"";
 return value.startsWith("Bearer ") && valid(value.slice(7)) ? value.slice(7) : "";
}
const endpoint = Deno.env.get("SUPABASE_URL") || "";
function serverKey():string {
 const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(legacy) return legacy;
 try {
 const parsed=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
 return typeof parsed.default==="string" ? parsed.default : "";
 } catch {return ""}
}
async function db(method:string,query:string,data?:unknown):Promise<unknown[]> {
 const key=serverKey();
 if(!key || !endpoint) throw Error("No internal database credentials");
 const headers:Record<string,string> = {
 "apikey":key,
 "Accept":"application/json",
 "Content-Type":"application/json",
 "Prefer":"return=representation",
 };
 if(key.split(".").length===3) headers.Authorization="Bearer "+key;
 const res=await fetch(endpoint+"/rest/v1/starlink_phone_pairs"+query,{
 method,headers,body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(10000)
 });
 const body=await res.text();
 if(!res.ok) throw Error("Database request failed "+res.status+" "+body.slice(0,100));
 return body?JSON.parse(body) as unknown[]:[];
}
type Obj=Record<string,unknown>;
const obj=(x:unknown):Obj=>x && typeof x==="object" && !Array.isArray(x) ? x as Obj : {};
const finite=(x:unknown):number|null=>typeof x==="number"&& Number.isFinite(x) && x>=0 && x<1e16 ?x:null;
const percent=(x:unknown)=>{const n=finite(x);return n===null?0:Math.max(0,Math.min(1,n))};
function scrub(input:unknown):Obj|null {
 const data=obj(input);
 if(data.version!==1 || finite(data.recordedAt)===null || !data.periods || typeof data.periods!=="object")return null;
 const periods=obj(data.periods), cleaned:Obj={};
 for(const id of ["today","week","month","cycle"]){
 const v=obj(periods[id]);const rows=v.buckets;
 if(!v.window || !Array.isArray(rows) || rows.length>40) return null;
 const w=obj(v.window);
 if(finite(w.start)===null || finite(w.end)===null)return null;
 cleaned[id]={
 gb:finite(v.gb),kWh:finite(v.kWh),coverage:percent(v.coverage),
 trafficCoverage:percent(v.trafficCoverage),latest:finite(v.latest),
 cost:finite(v.cost),projectedCost:finite(v.projectedCost),
 electricityCost:finite(v.electricityCost),planAllocation:finite(v.planAllocation),
 forecastGb:finite(v.forecastGb),forecastCoverageEligible:v.forecastCoverageEligible===true,
 window:{start:w.start,end:w.end},
 buckets:rows.map((row:unknown)=>{
 const b=obj(row);
 return {t:finite(b.t),gb:finite(b.gb),kWh:finite(b.kWh),downGB:finite(b.downGB),upGB:finite(b.upGB)};
 }).filter((b:{t:number|null})=>b.t!==null)
 };
 }
 return {
 version:1,recordedAt:data.recordedAt,latestSampleAt:finite(data.latestSampleAt),
 collectorOk:data.collectorOk===true,lastCollectorAt:finite(data.lastCollectorAt),
 planFee:finite(data.planFee),
 bundle:{
   price:finite(obj(data.bundle).price),
   gb:finite(obj(data.bundle).gb),
 },
 deviceTotalGb:finite(data.deviceTotalGb),
 devices:Array.isArray(data.devices) ? data.devices.slice(0,16).map((item:unknown)=>{
   const device=obj(item);
   const safe=(v:unknown,max:number)=>typeof v==="string"
      ? v.split("").filter((char)=>char.charCodeAt(0)>=32 && char!=="<" && char!==">").join("").slice(0,max) : "";
   return {
     name:safe(device.name,60),group:safe(device.group,50),
     gb:finite(device.gb),share:percent(device.share),
   };
 }).filter((x:{gb:number|null})=>x.gb!==null) : [],
 periods:cleaned,
 };
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:HEADERS});
 const url=new URL(req.url);
 const action=url.searchParams.get("action");
 if(req.method==="GET" && action==="health")return ok({configured:Boolean(serverKey()&&endpoint),version:1});
 try{
  if(req.method==="GET" && action==="read"){
   const token=bearer(req);
   if(!token)return ok({error:"pairing_required"},401);
   const rows=await db("GET","?select=payload,updated_at&view_digest=eq."+(await digest(token))+"&limit=1");
   if(!rows.length)return ok({error:"pairing_not_found"},404);
   const row=obj(rows[0]);return ok({snapshot:row.payload,updatedAt:row.updated_at});
  }
  if(req.method!=="POST" || !["create","push","revoke"].includes(action||""))return ok({error:"not_found"},404);
  if(Number(req.headers.get("content-length")||"0")>90000)return ok({error:"too_large"},413);
  const raw=await req.text();
  if(raw.length>90000)return ok({error:"too_large"},413);
  let data:Obj;try{data=obj(JSON.parse(raw))}catch{return ok({error:"invalid_json"},400)}
  if(action==="create"){
    if(!isUuid(data.monitorId)||!valid(data.viewToken)||!valid(data.writeToken) ||data.viewToken===data.writeToken)
      return ok({error:"invalid_pairing"},400);
    // Personal project capacity ceiling to prevent free-tier exhaustion through anonymous creates.
    const found=await db("GET","?select=monitor_id&limit=20");
    if(found.length>=20)return ok({error:"pairing_capacity_reached"},429);
    await db("POST","",{
      monitor_id:data.monitorId,view_digest:await digest(data.viewToken as string),
      write_digest:await digest(data.writeToken as string),payload:{}
    });
    return ok({ok:true},201);
  }
  const token=bearer(req);if(!token)return ok({error:"pairing_required"},401);
  const hash=await digest(token);
  if(action==="revoke"){
    const removed=await db("DELETE","?write_digest=eq."+hash);
    return ok({ok:removed.length>0},removed.length>0?200:404);
  }
  const snapshot=scrub(data.snapshot);
  if(!snapshot || JSON.stringify(snapshot).length>75000)return ok({error:"invalid_snapshot"},400);
  const rows=await db("PATCH","?write_digest=eq."+hash,{
   payload:snapshot,updated_at:new Date().toISOString()
  });
  if(!rows.length)return ok({error:"pairing_not_found"},404);
  return ok({ok:true});
 }catch(error){
  console.error("Phone monitor sync failed:",error instanceof Error?error.message:"unknown");
  return ok({error:"sync_unavailable"},503);
 }
});
