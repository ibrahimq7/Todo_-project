// notifications.js
export async function ensurePermission() {
  if(!('Notification' in window)) return false;
  if(Notification.permission === 'granted') return true;
  if(Notification.permission !== 'denied'){
    try{ const p = await Notification.requestPermission(); return p==='granted' }catch{ return false }
  }
  return false;
}

export function notify(title, body) {
  if(!('Notification' in window)) return;
  try{ new Notification(title, { body }) }catch{}
}


export function scheduleAllTaskNotifications() {
    // clear
    for(const id in state.timers.notify){ clearTimeout(state.timers.notify[id]); }
    state.timers.notify = {};
    const now = Date.now();
    const upcoming = state.tasks.filter(t=>!t.completed && t.due);
    for(const t of upcoming){
      const due = new Date(t.due).getTime();
      const minutes = Number(t.notify || 0);
      const at = due - minutes*60*1000;
      const delay = at - now;
      if(delay>0){
        state.timers.notify[t.id] = setTimeout(()=>{
          notify('⏰ '+t.title, `${minutes} min before (${new Date(t.due).toLocaleString()})`);
        }, delay);
      } else if(due>now && minutes>0) {
        // If pre-alert time already passed but task is in future, alert immediately
        notify('⏰ '+t.title, `Starting soon at ${new Date(t.due).toLocaleTimeString()}`);
      }
      // Overdue alert
      if(due <= now && !t.completed){
        // one-time inline badge; optionally toast
      }
    }
    updateNextUp();
  }