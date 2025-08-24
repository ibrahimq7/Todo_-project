// ====== State & Utilities ======
  const $ = (id)=>document.getElementById(id);
  const uid = ()=> Math.random().toString(36).slice(2,10);
  const LS = {
    load(k, d){ try{ return JSON.parse(localStorage.getItem(k)) ?? d }catch{ return d }},
    save(k, v){ localStorage.setItem(k, JSON.stringify(v)) }
  };

  const state = {
    tasks: LS.load('tasks_v1', []),
    sections: LS.load('sections_v1', ['Inbox','Work','College','Diet']),
    settings: LS.load('settings_v1', { theme:'dark', waterInterval:60 }),
    filters: { section:'All', query:'', date:null },
    calendar: { y: new Date().getFullYear(), m: new Date().getMonth() },
    timers: { notify: {}, water: null }
  };

  // Theme
  function applyTheme(){
    const light = state.settings.theme === 'light';
    document.documentElement.classList.toggle('light', light);
  }

  // Notifications
  async function ensurePermission(){
    if(!('Notification' in window)) return false;
    if(Notification.permission === 'granted') return true;
    if(Notification.permission !== 'denied'){
      try{ const p = await Notification.requestPermission(); return p==='granted' }catch{ return false }
    }
    return false;
  }
  function notify(title, body){
    if(!('Notification' in window)) return;
    try{ new Notification(title, { body }) }catch{}
  }

  function scheduleAllTaskNotifications(){
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

  function updateNextUp(){
    const now = Date.now();
    const next = state.tasks
      .filter(t=>!t.completed && t.due && new Date(t.due).getTime()>now)
      .sort((a,b)=> new Date(a.due)-new Date(b.due))[0];
    const el = $('nextUp');
    if(next){
      const mins = Math.round((new Date(next.due).getTime()-now)/60000);
      el.textContent = `Next: ${next.title} • in ${mins}m`;
    } else { el.textContent = 'No upcoming tasks'; }
  }

  // ====== Rendering ======
  function renderSections(){
    const list = $('sections');
    list.innerHTML = '';
    state.sections.forEach((name, idx)=>{
      const div = document.createElement('div'); div.className='item';
      div.innerHTML = `<strong>${name}</strong>
        <span>
          ${idx>0?`<button class="btn" data-act="rename" data-i="${idx}">Rename</button>`:''}
          ${idx>0?`<button class="btn danger" data-act="del" data-i="${idx}">Delete</button>`:''}
        </span>`;
      list.appendChild(div);
    });
    // populate selects
    const opts = ['All', ...state.sections];
    const fill = (sel)=>{ sel.innerHTML = opts.map(o=>`<option>${o}</option>`).join('') };
    fill($('filterSection'));
    const secSel = $('section');
    secSel.innerHTML = state.sections.map(o=>`<option>${o}</option>`).join('');
  }

  function taskBadge(t){
    const due = t.due? new Date(t.due) : null;
    let dueCls = 'due'; let dueTxt = 'No due';
    if(due){
      const diff = due - Date.now();
      if(diff < 0){ dueCls+=' overdue'; dueTxt = 'Overdue'; }
      else if(diff < 60*60*1000){ dueCls+=' soon'; dueTxt = `${Math.round(diff/60000)}m`; }
      else dueTxt = due.toLocaleString();
    }
    const quad = (t.imp? 'I' : '¬I') + ' / ' + (t.urg? 'U':'¬U');
    return `<span class="tag">${t.section}</span>
            <span class="tag">${t.category}</span>
            <span class="tag">${quad}</span>
            <span class="meta ${dueCls}">${dueTxt}</span>`
  }

  function renderTasks(){
    const list = $('taskList');
    const q = $('search').value.toLowerCase();
    const sec = $('filterSection').value;
    list.innerHTML = '';
    const tasks = [...state.tasks]
      .filter(t=> (sec==='All' || t.section===sec))
      .filter(t=> t.title.toLowerCase().includes(q))
      .sort((a,b)=> Number(a.completed)-Number(b.completed) || new Date(a.due||0)-new Date(b.due||0));

    for(const t of tasks){
      const row = document.createElement('div');
      row.className = 'task' + (t.completed?' completed':'');
      row.draggable = true; row.dataset.id = t.id;
      row.innerHTML = `
        <input type="checkbox" ${t.completed?'checked':''} data-act="toggle" data-id="${t.id}"/>
        <div>
          <div style="font-weight:700">${t.title}</div>
          <div class="meta">${taskBadge(t)}</div>
        </div>
        <div class="row">
          <button class="btn" data-act="edit" data-id="${t.id}">Edit</button>
          <button class="btn danger" data-act="del" data-id="${t.id}">Delete</button>
        </div>`;
      list.appendChild(row);
    }
    renderMatrixSlots();
    updateNextUp();
  }

  function renderMatrixSlots(){
    const quads = { Q11:[], Q10:[], Q01:[], Q00:[] };
    for(const t of state.tasks){
      if(t.completed) continue;
      const key = `Q${Number(t.imp)}${Number(t.urg)}`;
      quads[key].push(t);
    }
    for(const id of Object.keys(quads)){
      const el = $(id);
      [...el.querySelectorAll('.task')].forEach(n=>n.remove());
      quads[id]
        .sort((a,b)=> new Date(a.due||0)-new Date(b.due||0))
        .forEach(t=>{
          const n = document.createElement('div');
          n.className='task'; n.draggable=true; n.dataset.id=t.id;
          n.innerHTML = `<div style="grid-column:1/3"><strong>${t.title}</strong><div class="meta">${taskBadge(t)}</div></div>`;
          el.appendChild(n);
        });
    }
  }

  // Calendar
  function renderCalendar(){
    const head = $('calHead'); const grid = $('calGrid');
    const {y,m} = state.calendar;
    const first = new Date(y,m,1); const last = new Date(y,m+1,0);
    const startDay = (first.getDay()+6)%7; // make Monday=0
    const days = last.getDate();

    head.innerHTML = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`<div class="cal-cell" style="text-align:center; padding:8px; font-weight:700">${d}</div>`).join('');
    grid.innerHTML = '';
    $('calLabel').textContent = `${first.toLocaleString(undefined,{month:'long'})} ${y}`;

    for(let i=0;i<startDay;i++) grid.appendChild(document.createElement('div'));
    for(let d=1; d<=days; d++){
      const cell = document.createElement('div'); cell.className='cal-cell';
      const dateStr = new Date(y,m,d).toISOString().slice(0,10);
      const items = state.tasks.filter(t=> t.due && t.due.slice(0,10)===dateStr);
      cell.innerHTML = `<div class="d">${d}</div><div class="dots">${items.slice(0,6).map(()=>'<span class="dot"></span>').join('')}</div>`;
      cell.title = items.map(t=>t.title).join('\n');
      cell.addEventListener('click', ()=>{ state.filters.date = dateStr; $('filterSection').value='All'; renderTasks(); });
      grid.appendChild(cell);
    }
  }

  // ====== CRUD ======
  function upsertTask(fromForm=true){
    const id = $('saveBtn').dataset.editing || uid();
    const t = {
      id,
      title: $('title').value.trim(),
      due: $('due').value || null,
      section: $('section').value,
      category: $('category').value,
      notify: Number($('notify').value||0),
      repeat: $('repeat').value,
      repeatEvery: Number($('repeatEvery').value||0),
      imp: Number($('importance').value),
      urg: Number($('urgency').value),
      completed: false
    };
    if(!t.title){ alert('Please enter a title'); return }

    const idx = state.tasks.findIndex(x=>x.id===id);
    if(idx>=0){ state.tasks[idx] = {...state.tasks[idx], ...t} }
    else state.tasks.push(t);

    LS.save('tasks_v1', state.tasks);
    scheduleAllTaskNotifications();
    renderTasks(); renderCalendar();
    if(fromForm) clearForm();
  }

  function clearForm(){ $('title').value=''; $('due').value=''; $('notify').value='10'; $('repeat').value='none'; $('repeatEvery').value=''; $('importance').value='1'; $('urgency').value='1'; $('saveBtn').dataset.editing=''; }

  function deleteTask(id){ state.tasks = state.tasks.filter(t=>t.id!==id); LS.save('tasks_v1', state.tasks); renderTasks(); renderCalendar(); scheduleAllTaskNotifications(); }
  function toggleTask(id){ const t= state.tasks.find(t=>t.id===id); if(!t) return; t.completed=!t.completed; LS.save('tasks_v1', state.tasks); renderTasks(); scheduleAllTaskNotifications(); }

  // Drag & Drop
  function setupDnD(){
    document.addEventListener('dragstart', e=>{
      const row = e.target.closest('.task'); if(!row) return; e.dataTransfer.setData('text/plain', row.dataset.id);
    });
    for(const q of document.querySelectorAll('.quad')){
      q.addEventListener('dragover', e=>{ e.preventDefault(); q.classList.add('dragover') });
      q.addEventListener('dragleave', ()=> q.classList.remove('dragover'));
      q.addEventListener('drop', e=>{
        e.preventDefault(); q.classList.remove('dragover');
        const id = e.dataTransfer.getData('text/plain');
        const t = state.tasks.find(x=>x.id===id); if(!t) return;
        t.imp = Number(q.dataset.i); t.urg = Number(q.dataset.u);
        LS.save('tasks_v1', state.tasks); renderMatrixSlots(); renderTasks();
      });
    }
  }

  // Sections CRUD
  function addSection(){
    const name = $('newSectionName').value.trim();
    if(!name) return;
    if(state.sections.includes(name)) return alert('Section exists');
    state.sections.push(name); LS.save('sections_v1', state.sections); $('newSectionName').value=''; renderSections();
  }
  function renameSection(i){
    const cur = state.sections[i];
    const name = prompt('Rename section', cur); if(!name) return;
    state.sections[i]=name; LS.save('sections_v1', state.sections); renderSections(); renderTasks();
  }
  function removeSection(i){
    const name = state.sections[i];
    if(!confirm(`Delete section "${name}"? Tasks will move to Inbox.`)) return;
    state.sections.splice(i,1); for(const t of state.tasks){ if(t.section===name) t.section='Inbox' }
    LS.save('sections_v1', state.sections); LS.save('tasks_v1', state.tasks); renderSections(); renderTasks();
  }

  // Hydration / Habit
  function startWater(){
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
  function stopWater(){ if(state.timers.water){ clearInterval(state.timers.water); state.timers.water=null; $('waterStatus').textContent='Stopped'; } }

  // Import / Export
  function exportJSON(){
    const blob = new Blob([JSON.stringify({tasks:state.tasks, sections:state.sections, settings:state.settings}, null, 2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='smart-todo-data.json'; a.click(); URL.revokeObjectURL(url);
  }
  function importJSON(file){
    const fr = new FileReader(); fr.onload = ()=>{
      try{
        const data = JSON.parse(fr.result);
        if(data.tasks) state.tasks = data.tasks;
        if(data.sections) state.sections = data.sections;
        if(data.settings) state.settings = data.settings;
        LS.save('tasks_v1', state.tasks); LS.save('sections_v1', state.sections); LS.save('settings_v1', state.settings);
        applyTheme(); renderSections(); renderTasks(); renderCalendar(); scheduleAllTaskNotifications();
      }catch(err){ alert('Invalid JSON') }
    }; fr.readAsText(file);
  }

  // ====== Events ======
  function wire(){
    // Theme & buttons
    $('themeBtn').addEventListener('click', ()=>{ state.settings.theme = state.settings.theme==='dark'?'light':'dark'; LS.save('settings_v1', state.settings); applyTheme(); });
    $('exportBtn').addEventListener('click', exportJSON);
    $('importFile').addEventListener('change', e=>{ const f=e.target.files?.[0]; if(f) importJSON(f); e.target.value=''; });
    $('clearBtn').addEventListener('click', ()=>{ if(confirm('Reset all data?')){ localStorage.clear(); location.reload(); } });

    // Task save
    $('saveBtn').addEventListener('click', ()=> upsertTask(true));

    // Task list actions (delegate)
    $('taskList').addEventListener('click', e=>{
      const btn = e.target.closest('button, input[type="checkbox"]'); if(!btn) return;
      const id = btn.dataset.id;
      const act = btn.dataset.act || (btn.type==='checkbox'?'toggle':null);
      if(act==='del') deleteTask(id);
      if(act==='toggle') toggleTask(id);
      if(act==='edit'){
        const t = state.tasks.find(x=>x.id===id); if(!t) return;
        $('title').value = t.title; $('due').value = t.due||''; $('section').value=t.section; $('category').value=t.category;
        $('notify').value = t.notify||0; $('repeat').value=t.repeat||'none'; $('repeatEvery').value=t.repeatEvery||''; $('importance').value=t.imp; $('urgency').value=t.urg; $('saveBtn').dataset.editing=t.id; window.scrollTo({top:0, behavior:'smooth'});
      }
    });

    // Filters
    $('filterSection').addEventListener('change', renderTasks);
    $('search').addEventListener('input', renderTasks);

    // Sections
    $('addSectionBtn').addEventListener('click', addSection);
    $('sections').addEventListener('click', e=>{
      const b = e.target.closest('button'); if(!b) return;
      const i = Number(b.dataset.i);
      if(b.dataset.act==='rename') renameSection(i);
      if(b.dataset.act==='del') removeSection(i);
    });

    // Calendar nav
    $('prevMonth').addEventListener('click', ()=>{ const d=new Date(state.calendar.y,state.calendar.m-1,1); state.calendar.y=d.getFullYear(); state.calendar.m=d.getMonth(); renderCalendar(); });
    $('nextMonth').addEventListener('click', ()=>{ const d=new Date(state.calendar.y,state.calendar.m+1,1); state.calendar.y=d.getFullYear(); state.calendar.m=d.getMonth(); renderCalendar(); });

    // DnD
    setupDnD();
  }

  // Recurrence tick (promotes repeated tasks after completion or when due passes)
  function recurrenceSweep(){
    const now = Date.now(); let changed=false;
    for(const t of state.tasks){
      if(!t.due) continue; const dueTs = new Date(t.due).getTime();
      if(dueTs<=now && t.repeat && t.repeat!=='none'){
        const step = t.repeat==='daily'? 24*60 : t.repeat==='weekly'? 7*24*60 : (t.repeatEvery||0);
        if(step>0){
          let next = dueTs; while(next<=now) next += step*60000;
          t.due = new Date(next).toISOString().slice(0,16);
          t.completed=false; changed=true;
        }
      }
    }
    if(changed){ LS.save('tasks_v1', state.tasks); renderTasks(); renderCalendar(); scheduleAllTaskNotifications(); }
  }

  // ====== Init ======
  (async function init(){
    // Minimal demo data on first run
    if(state.tasks.length===0){
      const base = new Date();
      const t1 = new Date(base.getTime()+45*60000).toISOString().slice(0,16);
      const t2 = new Date(base.getTime()+3*60*60000).toISOString().slice(0,16);
      state.tasks = [
        {id:uid(), title:'Write DSA notes', due:t1, section:'College', category:'Study', notify:10, repeat:'none', repeatEvery:0, imp:1, urg:1, completed:false},
        {id:uid(), title:'Lunch (diet plan)', due:t2, section:'Diet', category:'Meal', notify:20, repeat:'daily', repeatEvery:0, imp:1, urg:0, completed:false},
      ];
      LS.save('tasks_v1', state.tasks);
    }

    applyTheme(); renderSections(); renderTasks(); renderCalendar();
    wire();
    await ensurePermission();
    scheduleAllTaskNotifications();
    updateNextUp();

    // Head cells once
    renderCalendar();

    // Background sweeps
    setInterval(recurrenceSweep, 60*1000);
  })();