import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const PORT = process.env.PORT || 5000;
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken:false, persistSession:false } }
);

async function getEvent() {
  const { data, error } = await supabase.from("events")
    .select("*").order("created_at", { ascending:true }).limit(1).single();
  if (error) throw error;
  return data;
}

function coordinatorAuth(req,res,next) {
  if (req.headers["x-coordinator-password"] !== process.env.COORDINATOR_PASSWORD)
    return res.status(403).json({success:false,message:"Invalid coordinator password"});
  next();
}

app.get("/api/health", async (_req,res)=>{
  try { const event=await getEvent(); res.json({success:true,server:"PARTY WITH DJ",realtime:true,eventId:event.id}); }
  catch(e){ res.status(500).json({success:false,message:e.message}); }
});

app.get("/api/event/state", async (_req,res)=>{
  try {
    const event=await getEvent();
    const {data:participants,error:pe}=await supabase.from("participants")
      .select("*").eq("event_id",event.id).eq("active",true).order("joined_at");
    if(pe) throw pe;
    const {data:buzzes,error:be}=await supabase.from("buzzes")
      .select("*").eq("event_id",event.id).order("position");
    if(be) throw be;
    res.json({success:true,event,participants,buzzes});
  } catch(e){ res.status(500).json({success:false,message:e.message}); }
});

app.post("/api/participant/join", async (req,res)=>{
  try {
    const teamName=req.body.teamName?.trim(), collegeName=req.body.collegeName?.trim();
    if(!teamName || !collegeName) return res.status(400).json({success:false,message:"Team and college are required"});
    const event=await getEvent();
    if(event.status==="ENDED") return res.status(400).json({success:false,message:"Event has ended"});
    const {data:existing}=await supabase.from("participants").select("*")
      .eq("event_id",event.id).eq("team_name",teamName).eq("active",true).maybeSingle();
    if(existing) return res.status(409).json({success:false,message:"Team already exists",participant:existing});
    const {data,error}=await supabase.from("participants").insert({event_id:event.id,team_name:teamName,college_name:collegeName}).select().single();
    if(error) throw error;
    res.json({success:true,participant:data,event});
  } catch(e){ res.status(500).json({success:false,message:e.message}); }
});

app.post("/api/coordinator/login",(req,res)=>{
  if(req.body.password!==process.env.COORDINATOR_PASSWORD) return res.status(401).json({success:false,message:"Invalid coordinator password"});
  res.json({success:true,coordinator:true});
});

async function updateEvent(patch,res) {
  try {
    const event=await getEvent();
    const {data,error}=await supabase.from("events").update(patch).eq("id",event.id).select().single();
    if(error) throw error;
    res.json({success:true,event:data});
  } catch(e){ res.status(500).json({success:false,message:e.message}); }
}

app.post("/api/coordinator/start-event",coordinatorAuth,(req,res)=>updateEvent({status:"LIVE",started_at:new Date().toISOString()},res));
app.post("/api/coordinator/pause-event",coordinatorAuth,(req,res)=>updateEvent({status:"PAUSED",buzzer_active:false},res));
app.post("/api/coordinator/end-event",coordinatorAuth,(req,res)=>updateEvent({status:"ENDED",buzzer_active:false},res));

app.post("/api/coordinator/start-buzzer",coordinatorAuth,async(_req,res)=>{
  try {
    const event=await getEvent();
    if(event.status!=="LIVE") return res.status(400).json({success:false,message:"Event is not live"});
    const {error:de}=await supabase.from("buzzes").delete().eq("event_id",event.id);
    if(de) throw de;
    await updateEvent({buzzer_active:true},res);
  } catch(e){ res.status(500).json({success:false,message:e.message}); }
});

app.post("/api/coordinator/lock-buzzer",coordinatorAuth,(req,res)=>updateEvent({buzzer_active:false},res));

app.post("/api/coordinator/reset-buzzer",coordinatorAuth,async(_req,res)=>{
  try {
    const event=await getEvent();
    const {error}=await supabase.from("buzzes").delete().eq("event_id",event.id);
    if(error) throw error;
    await updateEvent({buzzer_active:false},res);
  } catch(e){ res.status(500).json({success:false,message:e.message}); }
});

app.post("/api/coordinator/reopen-buzzer",coordinatorAuth,(req,res)=>updateEvent({buzzer_active:true},res));

app.post("/api/buzz",async(req,res)=>{
  try {
    const event=await getEvent();
    const {data,error}=await supabase.rpc("register_buzz",{p_event_id:event.id,p_participant_id:req.body.participantId});
    if(error) return res.status(409).json({success:false,message:error.message});
    res.json({success:true,buzz:data});
  } catch(e){ res.status(500).json({success:false,message:e.message}); }
});

app.delete("/api/coordinator/participants/:id",coordinatorAuth,async(req,res)=>{
  try {
    const event=await getEvent();
    const {error}=await supabase.from("participants").delete().eq("id",req.params.id).eq("event_id",event.id);
    if(error) throw error;
    const {data:buzzes,error:be}=await supabase.from("buzzes").select("*").eq("event_id",event.id).order("buzzed_at");
    if(be) throw be;
    for(let i=0;i<buzzes.length;i++) await supabase.from("buzzes").update({position:i+1}).eq("id",buzzes[i].id);
    res.json({success:true});
  } catch(e){ res.status(500).json({success:false,message:e.message}); }
});

app.listen(PORT,()=>console.log(`PARTY WITH DJ backend: http://localhost:${PORT}`));
