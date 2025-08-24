import { ensurePermission, notify } from './notifications.js'; // adjust path if needed


export function addSection(){
    const name = $('newSectionName').value.trim();
    if(!name) return;
    if(state.sections.includes(name)) return alert('Section exists');
    state.sections.push(name); LS.save('sections_v1', state.sections); $('newSectionName').value=''; renderSections();
  }
export function renameSection(i){
    const cur = state.sections[i];
    const name = prompt('Rename section', cur); if(!name) return;
    state.sections[i]=name; LS.save('sections_v1', state.sections); renderSections(); renderTasks();
  }
export function removeSection(i){
    const name = state.sections[i];
    if(!confirm(`Delete section "${name}"? Tasks will move to Inbox.`)) return;
    state.sections.splice(i,1); for(const t of state.tasks){ if(t.section===name) t.section='Inbox' }
    LS.save('sections_v1', state.sections); LS.save('tasks_v1', state.tasks); renderSections(); renderTasks();
  }

    // Hydration / Habit
export function startWater(){
      const mins = Number($('waterInterval').value||60);
      state.settings.waterInterval = mins; LS.save('settings_v1', state.settings);
      if(state.timers.water) clearInterval(state.timers.water);
      ensurePermission();
      state.timers.water = setInterval(()=>{
        notify('💧 Hydration break', `Have some water • every ${mins} min`);
        $('waterStatus').textContent = `Last ping: ${new Date().toLocaleTimeString()}`;
      }, mins*60000);
      $('waterStatus').textContent = `Running: every ${mins} min`;
    }