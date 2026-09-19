import { useEffect, useMemo, useState } from "react";
import { Activity, Crown, LogIn, Music2, Radio, RefreshCw, Trash2, Trophy, Users, Zap } from "lucide-react";
import { getEventState, joinParticipant, sendBuzz, coordinatorLogin, startEvent, pauseEvent, endEvent, startBuzzer, lockBuzzer, resetBuzzer, reopenBuzzer, deleteParticipant } from "./lib/api";
import { supabase } from "./lib/realtime";

const statusText={WAITING:"WAITING",LIVE:"LIVE",PAUSED:"PAUSED",ENDED:"ENDED"};

export default function App(){
  const [page,setPage]=useState("login");
  const [mode,setMode]=useState("participant");
  const [password,setPassword]=useState("");
  const [coordinatorPassword,setCoordinatorPassword]=useState("");
  const [teamName,setTeamName]=useState("");
  const [collegeName,setCollegeName]=useState("");
  const [participant,setParticipant]=useState(()=>JSON.parse(localStorage.getItem("party_with_dj_participant")||"null"));
  const [event,setEvent]=useState(null);
  const [teams,setTeams]=useState([]);
  const [buzzes,setBuzzes]=useState([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);

  const eventId=event?.id;

  async function load(){
    try{
      setLoading(true);
      const x=await getEventState();
      setEvent(x.event); setTeams(x.participants||[]); setBuzzes(x.buzzes||[]);
    }catch(e){ alert(e.message); } finally { setLoading(false); }
  }
  useEffect(()=>{load()},[]);

  useEffect(()=>{
    if(!eventId) return;
    const channel=supabase.channel(`party-with-dj-${eventId}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"events",filter:`id=eq.${eventId}`},p=>{if(p.new?.id)setEvent(p.new)})
      .on("postgres_changes",{event:"*",schema:"public",table:"participants",filter:`event_id=eq.${eventId}`},p=>{
        if(p.eventType==="INSERT") setTeams(a=>a.some(x=>x.id===p.new.id)?a:[...a,p.new]);
        if(p.eventType==="UPDATE") setTeams(a=>a.map(x=>x.id===p.new.id?p.new:x));
        if(p.eventType==="DELETE") setTeams(a=>a.filter(x=>x.id!==p.old.id));
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"buzzes",filter:`event_id=eq.${eventId}`},p=>{
        if(p.eventType==="INSERT") setBuzzes(a=>[...a.filter(x=>x.id!==p.new.id),p.new].sort((x,y)=>x.position-y.position));
        if(p.eventType==="UPDATE") setBuzzes(a=>a.map(x=>x.id===p.new.id?p.new:x).sort((x,y)=>x.position-y.position));
        if(p.eventType==="DELETE") setBuzzes(a=>a.filter(x=>x.id!==p.old.id));
      })
      .subscribe();
    return ()=>{supabase.removeChannel(channel)};
  },[eventId]);

  async function login(){
    if(mode==="participant"){setPage("join");return;}
    try{await coordinatorLogin(password);setCoordinatorPassword(password);setPage("coordinator");}
    catch(e){alert(e.message)}
  }

  async function join(){
    if(!teamName.trim()||!collegeName.trim()) return alert("Enter team name and college name");
    try{
      const x=await joinParticipant(teamName,collegeName);
      localStorage.setItem("party_with_dj_participant",JSON.stringify(x.participant));
      setParticipant(x.participant);setPage("participant");
    }catch(e){alert(e.message)}
  }

  async function buzz(){
    if(!participant||!event?.buzzer_active) return;
    setBusy(true);
    try{await sendBuzz(participant.id)}catch(e){console.log(e.message)}
    finally{setBusy(false)}
  }

  async function action(fn){
    try{await fn(coordinatorPassword)}catch(e){alert(e.message)}
  }

  const leaderboard=useMemo(()=>buzzes.map(b=>({...b,participant:teams.find(t=>t.id===b.participant_id)})),[buzzes,teams]);

  if(loading) return <div className="min-h-screen grid place-items-center text-white"><RefreshCw className="animate-spin"/> Loading PARTY WITH DJ...</div>;

  if(page==="login") return <div className="min-h-screen grid place-items-center p-5">
    <div className="glass glow w-full max-w-lg rounded-3xl p-8">
      <div className="text-center mb-8"><Music2 className="mx-auto mb-4 text-fuchsia-400" size={46}/><h1 className="text-4xl font-black tracking-tight">PARTY WITH DJ</h1><p className="text-fuchsia-200 mt-2">HEAR IT. KNOW IT. BUZZ IT.</p></div>
      <div className="flex gap-2 mb-5"><button onClick={()=>setMode("participant")} className={`flex-1 rounded-xl p-3 ${mode==="participant"?"bg-fuchsia-600":"bg-white/10"}`}>Participant</button><button onClick={()=>setMode("coordinator")} className={`flex-1 rounded-xl p-3 ${mode==="coordinator"?"bg-blue-600":"bg-white/10"}`}>Coordinator</button></div>
      {mode==="coordinator"&&<input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} placeholder="Coordinator password" className="w-full mb-3 rounded-xl bg-black/40 border border-white/10 p-4 outline-none focus:border-fuchsia-400"/>}
      <button onClick={login} className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-blue-600 p-4 font-bold flex justify-center gap-2"><LogIn size={20}/>{mode==="participant"?"Join Event":"Enter Coordinator"}</button>
    </div>
  </div>;

  if(page==="join") return <div className="min-h-screen grid place-items-center p-5">
    <div className="glass w-full max-w-lg rounded-3xl p-8">
      <h2 className="text-3xl font-black mb-2">Join PARTY WITH DJ</h2><p className="text-white/60 mb-6">One team. One buzzer. Fastest wins the buzz position.</p>
      <input value={teamName} onChange={e=>setTeamName(e.target.value)} placeholder="Team Name" className="w-full mb-3 rounded-xl bg-black/40 border border-white/10 p-4"/>
      <input value={collegeName} onChange={e=>setCollegeName(e.target.value)} placeholder="College Name" className="w-full mb-5 rounded-xl bg-black/40 border border-white/10 p-4"/>
      <button onClick={join} className="w-full rounded-xl bg-fuchsia-600 p-4 font-bold">JOIN BUZZER ROUND</button>
    </div>
  </div>;

  if(page==="participant") return <div className="min-h-screen p-5">
    <header className="max-w-6xl mx-auto flex items-center justify-between mb-8"><div><div className="flex items-center gap-2 text-fuchsia-300"><Radio size={18}/> BUZZER ROUND</div><h1 className="text-3xl font-black">{participant?.team_name}</h1><p className="text-white/50">{participant?.college_name}</p></div><div className="glass rounded-full px-4 py-2">{statusText[event?.status]||"WAITING"}</div></header>
    <main className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_360px] gap-6">
      <section className="glass rounded-3xl p-8 text-center min-h-[500px] grid place-items-center">
        <div className="w-full"><Zap className={`mx-auto mb-6 ${event?.buzzer_active?"text-fuchsia-400 animate-pulse":"text-white/20"}`} size={70}/><h2 className="text-4xl font-black mb-3">{event?.buzzer_active?"BUZZ NOW":"WAIT FOR THE DJ"}</h2><p className="text-white/50 mb-8">{event?.buzzer_active?"Recognize the song? Hit the button!":"Coordinator will activate the buzzer."}</p><button disabled={!event?.buzzer_active||busy} onClick={buzz} className="mx-auto w-64 h-64 rounded-full bg-gradient-to-br from-fuchsia-600 via-purple-600 to-blue-600 disabled:opacity-25 shadow-[0_0_80px_rgba(168,85,247,.35)] text-2xl font-black">{busy?"SENDING...":"I KNOW THIS SONG!"}</button></div>
      </section>
      <Leaderboard leaderboard={leaderboard}/>
    </main>
  </div>;

  return <div className="min-h-screen p-5">
    <header className="max-w-7xl mx-auto flex flex-wrap gap-4 items-center justify-between mb-7"><div><div className="text-blue-300 flex gap-2 items-center"><Activity size={18}/> COORDINATOR CONTROL</div><h1 className="text-3xl font-black">PARTY WITH DJ</h1></div><div className="flex items-center gap-2 glass rounded-full px-4 py-2"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/> REALTIME</div></header>
    <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-5">
      <section className="glass rounded-3xl p-5 lg:col-span-2">
        <div className="flex flex-wrap gap-3 mb-5">
          <button onClick={()=>action(startEvent)} className="px-4 py-3 rounded-xl bg-green-600 font-bold">START EVENT</button>
          <button onClick={()=>action(pauseEvent)} className="px-4 py-3 rounded-xl bg-yellow-600 font-bold">PAUSE</button>
          <button onClick={()=>action(endEvent)} className="px-4 py-3 rounded-xl bg-red-600 font-bold">END EVENT</button>
          <button onClick={()=>action(startBuzzer)} className="px-4 py-3 rounded-xl bg-fuchsia-600 font-bold">START BUZZER</button>
          <button onClick={()=>action(lockBuzzer)} className="px-4 py-3 rounded-xl bg-slate-700 font-bold">LOCK</button>
          <button onClick={()=>action(resetBuzzer)} className="px-4 py-3 rounded-xl bg-orange-600 font-bold">RESET</button>
          <button onClick={()=>action(reopenBuzzer)} className="px-4 py-3 rounded-xl bg-blue-600 font-bold">REOPEN</button>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mb-5"><Stat icon={<Users/>} label="Participants" value={teams.length}/><Stat icon={<Zap/>} label="Buzzer" value={event?.buzzer_active?"ACTIVE":"LOCKED"}/><Stat icon={<Trophy/>} label="Buzzes" value={buzzes.length}/></div>
        <h2 className="font-black text-xl mb-3">Participants</h2>
        <div className="space-y-2">{teams.map(t=><div key={t.id} className="flex items-center justify-between glass rounded-xl p-3"><div><b>{t.team_name}</b><div className="text-sm text-white/50">{t.college_name}</div></div><button onClick={()=>confirm(`Delete ${t.team_name}?`)&&deleteParticipant(t.id,coordinatorPassword).catch(e=>alert(e.message))} className="p-2 rounded-lg bg-red-500/15 text-red-300"><Trash2 size={18}/></button></div>)}</div>
      </section>
      <Leaderboard leaderboard={leaderboard}/>
    </div>
  </div>;
}

function Stat({icon,label,value}){return <div className="glass rounded-2xl p-4"><div className="text-fuchsia-300">{icon}</div><div className="text-2xl font-black mt-2">{value}</div><div className="text-white/45 text-sm">{label}</div></div>}
function Leaderboard({leaderboard}){return <section className="glass rounded-3xl p-5"><h2 className="font-black text-xl flex items-center gap-2 mb-4"><Crown className="text-yellow-300"/> BUZZ LEADERBOARD</h2>{leaderboard.length===0?<div className="text-white/40 text-center py-12">No buzz yet</div>:<div className="space-y-2">{leaderboard.map(b=><div key={b.id} className="flex items-center gap-3 glass rounded-xl p-3"><div className="w-10 h-10 rounded-full bg-fuchsia-600 grid place-items-center font-black">#{b.position}</div><div className="min-w-0"><b>{b.participant?.team_name||"Deleted team"}</b><div className="text-xs text-white/45 truncate">{b.participant?.college_name||""}</div></div></div>)}</div>}</section>}
