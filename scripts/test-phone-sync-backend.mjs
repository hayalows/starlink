// Invoked by GitHub Actions against the deployed free PostgreSQL Edge service.
import { randomBytes, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const endpoint="https://hdvkmpotagbigcmyozaf.supabase.co/functions/v1/starlink-ghana-monitor";
const token=()=>randomBytes(32).toString("base64url");
const viewToken=token(),writeToken=token(),monitorId=randomUUID();
const request=async(action,{method="GET",bearer,body}={})=>{
 const r=await fetch(endpoint+"?action="+action,{
   method,headers:{
     ...(bearer?{authorization:"Bearer "+bearer}:{}),
     ...(body?{"content-type":"application/json"}:{})
   },
   ...(body?{body:JSON.stringify(body)}:{})
 });
 const payload=await r.json();
 return {status:r.status,...payload};
};
const emptyPeriod=()=>({
 gb:1.25,kWh:0.42,coverage:0.88,trafficCoverage:0.87,latest:Math.floor(Date.now()/1000),
 cost:15.33,projectedCost:420,electricityCost:0.33,planAllocation:15,
 window:{start:1000000,end:1003600},
 buckets:[{t:1000000,gb:1.25,kWh:0.42}]
});
const snapshot={version:1,recordedAt:Date.now(),latestSampleAt:Math.floor(Date.now()/1000),
 collectorOk:true,lastCollectorAt:Date.now(),periods:{
 today:emptyPeriod(),week:emptyPeriod(),month:emptyPeriod(),cycle:emptyPeriod()
}};
console.log("Health check...");
const health=await request("health");
assert.equal(health.status,200,JSON.stringify(health));
assert.equal(health.configured,true,"Edge function cannot access its database credentials");
const anonymous=await request("read");
assert.equal(anonymous.status,401,"Unauthenticated request was allowed");
let created=false;
try{
 console.log("Create pairing...");
 const a=await request("create",{method:"POST",body:{monitorId,viewToken,writeToken}});
 assert.equal(a.status,201,JSON.stringify(a));
 created=true;
 console.log("Upload sample...");
 const b=await request("push",{method:"POST",bearer:writeToken,body:{snapshot}});
 assert.equal(b.status,200,JSON.stringify(b));
 console.log("Read on phone...");
 const c=await request("read",{bearer:viewToken});
 assert.equal(c.status,200,JSON.stringify(c));
 assert.equal(c.snapshot.periods.month.gb,1.25);
 assert.equal(c.snapshot.periods.month.cost,15.33);
 assert.ok(c.updatedAt);
 const fake=await request("read",{bearer:token()});
 assert.equal(fake.status,404,"Unknown pairing must not return telemetry");
 console.log("TESTS PASSED: health, 401, create, upload, read, unknown key");
}finally{
 if(created){
   const d=await request("revoke",{method:"POST",bearer:writeToken,body:{}});
   assert.equal(d.status,200,"Temporary pairing cleanup failed");
   const after=await request("read",{bearer:viewToken});
   assert.equal(after.status,404,"Revoked link still reads data");
   console.log("REVOCATION PASSED");
 }
}
