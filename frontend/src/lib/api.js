const API_URL=import.meta.env.VITE_API_URL||"http://localhost:5000";
async function request(path,options={}) {
  const r=await fetch(`${API_URL}${path}`,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const data=await r.json();
  if(!r.ok) throw new Error(data.message||"Request failed");
  return data;
}
export const getEventState=()=>request("/api/event/state");
export const joinParticipant=(teamName,collegeName)=>request("/api/participant/join",{method:"POST",body:JSON.stringify({teamName,collegeName})});
export const sendBuzz=(participantId)=>request("/api/buzz",{method:"POST",body:JSON.stringify({participantId})});
export const coordinatorLogin=(password)=>request("/api/coordinator/login",{method:"POST",body:JSON.stringify({password})});
const coord=(p,password)=>request(p,{method:"POST",headers:{"x-coordinator-password":password}});
export const startEvent=p=>coord("/api/coordinator/start-event",p);
export const pauseEvent=p=>coord("/api/coordinator/pause-event",p);
export const endEvent=p=>coord("/api/coordinator/end-event",p);
export const startBuzzer=p=>coord("/api/coordinator/start-buzzer",p);
export const lockBuzzer=p=>coord("/api/coordinator/lock-buzzer",p);
export const resetBuzzer=p=>coord("/api/coordinator/reset-buzzer",p);
export const reopenBuzzer=p=>coord("/api/coordinator/reopen-buzzer",p);
export const deleteParticipant=(id,p)=>request(`/api/coordinator/participants/${id}`,{method:"DELETE",headers:{"x-coordinator-password":p}});
