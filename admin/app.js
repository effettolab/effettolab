import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0';

const config = window.CMS_CONFIG || {};
const loginScreen = document.querySelector('#login-screen');
const appShell = document.querySelector('#app-shell');
const loginForm = document.querySelector('#login-form');
const loginMessage = document.querySelector('#login-message');
const globalMessage = document.querySelector('#global-message');
const requiredConfigReady = Boolean(config.supabaseUrl && config.supabaseAnonKey && !String(config.supabaseAnonKey).includes('PEGA_AQUI'));

let supabase = null;
let currentUser = null;
let siteContent = [];
let services = [];
let portfolio = [];
let team = [];
let activeView = 'dashboard';
let messageTimer = null;

const viewTitles = {
  dashboard: 'Resumen', general: 'Contenido general', services: 'Servicios', portfolio: 'Galería de trabajos', team: 'Equipo'
};

const itemDefinitions = {
  services: {
    table: 'cms_services', title: 'servicio', editor: '#service-editor', list: '#services-list',
    fields: [
      ['service_number','Número','text'],['title','Nombre del servicio','text'],['slug','Identificador (slug)','text'],
      ['description','Descripción','textarea'],['icon_symbol','Símbolo','text'],['image_path','Ruta de imagen','image'],
      ['image_alt','Texto alternativo de imagen','text'],['image_link_label','Texto de enlace de imagen','text'],
      ['image_link_message','Mensaje de WhatsApp de imagen','textarea'],['cta_label','Texto del botón','text'],
      ['cta_message','Mensaje de WhatsApp del botón','textarea'],['display_order','Orden de aparición','number'],['is_active','Mostrar en el sitio','boolean']
    ], defaults: {service_number:'',title:'',slug:'',description:'',icon_symbol:'✳',image_path:'',image_alt:'',image_link_label:'',image_link_message:'',cta_label:'Consultar servicio',cta_message:'',display_order:1,is_active:true}
  },
  portfolio: {
    table: 'cms_portfolio_items', title: 'trabajo', editor: '#portfolio-editor', list: '#portfolio-list',
    fields: [
      ['title','Título del trabajo','text'],['slug','Identificador (slug)','text'],['category','Categoría interna','select',['instrumentos','pedalboards']],
      ['category_label','Etiqueta visible','text'],['image_path','Fotografía','image'],['image_alt','Texto alternativo','text'],
      ['display_order','Orden de aparición','number'],['is_active','Mostrar en la galería','boolean']
    ], defaults: {title:'',slug:'',category:'instrumentos',category_label:'EN EL TALLER',image_path:'',image_alt:'',display_order:1,is_active:true}
  },
  team: {
    table: 'cms_team_members', title: 'integrante', editor: '#team-editor', list: '#team-list',
    fields: [
      ['sequence_label','Distintivo / función','text'],['name','Nombre','text'],['slug','Identificador (slug)','text'],
      ['job_title','Cargo','text'],['photo_path','Fotografía','image'],['photo_alt','Texto alternativo','text'],
      ['display_order','Orden de aparición','number'],['is_active','Mostrar en el sitio','boolean']
    ], defaults: {sequence_label:'',name:'',slug:'',job_title:'',photo_path:'',photo_alt:'',display_order:1,is_active:true}
  }
};

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function showLoginMessage(message, isError=false) {
  loginMessage.textContent = message;
  loginMessage.classList.toggle('error', isError);
}
function showGlobalMessage(message, isError=false) {
  globalMessage.textContent = message;
  globalMessage.classList.toggle('error', isError);
  globalMessage.classList.add('show');
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => globalMessage.classList.remove('show'), 5500);
}
function setBusy(button, busy, label='Guardando…') {
  if (!button) return;
  if (busy) {
    button.dataset.originalLabel = button.innerHTML;
    button.disabled = true;
    button.textContent = label;
  } else {
    button.disabled = false;
    if (button.dataset.originalLabel) button.innerHTML = button.dataset.originalLabel;
  }
}
function toReadableError(error) {
  return error?.message || 'Ocurrió un error inesperado. Revisa la conexión e inténtalo de nuevo.';
}
function getSectionIcon(section) {
  return ({General:'◈',Marca:'✳',Navegación:'⌑',Portada:'⌂',Servicios:'✳',Promoción:'％',Galería:'▧',Video:'▷',Historia:'◎',Equipo:'♙',Cifras:'#',Contacto:'↗',Formulario:'☷','Redes sociales':'◎','Pie de página':'▤','Botón flotante':'◉'})[section] || '✎';
}
function normalizeContentValue(item) {
  if (item.content_type === 'json') return JSON.stringify(item.content_value ?? [], null, 2);
  if (item.content_type === 'boolean') return Boolean(item.content_value);
  return item.content_value == null ? '' : String(item.content_value);
}
function contentControl(item) {
  const key = escapeHtml(item.content_key);
  const value = normalizeContentValue(item);
  const label = escapeHtml(item.label);
  const type = item.content_type;
  const full = type === 'multiline' || type === 'json' ? 'full' : '';
  if (type === 'boolean') {
    return `<label class="content-field ${full}" data-content-field><span>${label}</span><select data-key="${key}" data-type="boolean"><option value="true" ${value?'selected':''}>Activado</option><option value="false" ${!value?'selected':''}>Desactivado</option></select></label>`;
  }
  if (type === 'multiline' || type === 'json') {
    return `<label class="content-field ${full}" data-content-field><span>${label}</span><textarea data-key="${key}" data-type="${type}" spellcheck="true">${escapeHtml(value)}</textarea>${type==='json'?'<small class="field-hint">Formato JSON válido. Ejemplo: ["Opción 1", "Opción 2"]</small>':''}</label>`;
  }
  const htmlType = type === 'number' ? 'number' : (type === 'email' ? 'email' : (type === 'url' ? 'url' : 'text'));
  return `<label class="content-field" data-content-field><span>${label}</span><input type="${htmlType}" data-key="${key}" data-type="${type}" value="${escapeHtml(value)}"></label>`;
}
function groupContentRows(rows) {
  return rows.reduce((groups, row) => {
    (groups[row.section] ||= []).push(row);
    return groups;
  }, {});
}
function renderGeneralContent() {
  const groups = groupContentRows(siteContent);
  const container = document.querySelector('#general-groups');
  const sections = Object.keys(groups).sort((a,b) => a.localeCompare(b,'es'));
  if (!sections.length) {
    container.innerHTML = '<div class="empty-state">Todavía no hay contenido general registrado en Supabase.</div>';
    return;
  }
  container.innerHTML = sections.map(section => {
    const rows = groups[section].sort((a,b) => a.label.localeCompare(b.label,'es'));
    return `<article class="content-group"><header class="group-head"><h3>${getSectionIcon(section)} &nbsp; ${escapeHtml(section)}</h3><small>${rows.length} campos</small></header><div class="group-fields">${rows.map(contentControl).join('')}</div><div class="field-actions"><button class="button button-primary button-small" data-save-group="${escapeHtml(section)}">Guardar sección</button></div></article>`;
  }).join('');
}
function getImageUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('assets/')) return `../${path}`;
  return supabase.storage.from('effettolab-site-media').getPublicUrl(path).data.publicUrl;
}
function itemTitle(type, row) {
  if (type === 'services') return row.title || 'Servicio sin título';
  if (type === 'portfolio') return row.title || 'Trabajo sin título';
  return row.name || 'Integrante sin nombre';
}
function itemSubtitle(type, row) {
  if (type === 'services') return row.description || row.slug || '';
  if (type === 'portfolio') return `${row.category_label || row.category || ''} · ${row.slug || ''}`;
  return `${row.job_title || ''} · ${row.sequence_label || ''}`;
}
function itemImage(type, row) {
  return type === 'team' ? row.photo_path : row.image_path;
}
function renderItemList(type) {
  const def = itemDefinitions[type];
  const rows = ({services,portfolio,team})[type];
  const container = document.querySelector(def.list);
  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">No hay ${def.title}s registrados. Usa “Añadir ${def.title}” para crear el primero.</div>`;
    return;
  }
  container.innerHTML = rows.map(row => {
    const image = getImageUrl(itemImage(type,row));
    return `<article class="item-card">${image?`<img class="item-thumb" src="${escapeHtml(image)}" alt="" loading="lazy">`:'<div class="item-thumb placeholder">✳</div>'}<div class="item-info"><strong>${escapeHtml(itemTitle(type,row))}</strong><small>${escapeHtml(itemSubtitle(type,row))}</small></div><div class="item-actions"><span class="active-pill ${row.is_active?'':'off'}">${row.is_active?'Visible':'Oculto'}</span><button class="text-button" data-edit="${escapeHtml(row.id)}" data-type="${type}">Editar</button><button class="text-button danger" data-delete="${escapeHtml(row.id)}" data-type="${type}">Eliminar</button></div></article>`;
  }).join('');
}
function inputForItemField(type, field, label, kind, options, row) {
  const value = row[field] ?? '';
  const name = `${type}-${field}`;
  if (kind === 'boolean') return `<label class="check-row"><input type="checkbox" name="${name}" ${value?'checked':''}> ${escapeHtml(label)}</label>`;
  if (kind === 'select') return `<label><span>${escapeHtml(label)}</span><select name="${name}">${options.map(opt=>`<option value="${escapeHtml(opt)}" ${value===opt?'selected':''}>${escapeHtml(opt==='instrumentos'?'Instrumentos':'Pedalboards')}</option>`).join('')}</select></label>`;
  if (kind === 'textarea') return `<label class="${field.includes('message')||field==='description'?'full':''}"><span>${escapeHtml(label)}</span><textarea name="${name}">${escapeHtml(value)}</textarea></label>`;
  if (kind === 'image') {
    const url = getImageUrl(String(value));
    return `<label class="${field==='image_path'||field==='photo_path'?'full':''}"><span>${escapeHtml(label)}</span><div class="image-control">${url?`<img class="image-preview" src="${escapeHtml(url)}" alt="Vista previa">`:'<div class="image-preview"></div>'}<input name="${name}" type="text" value="${escapeHtml(value)}" placeholder="Ruta del archivo en Storage"><input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" data-upload-image="${name}"><small class="field-hint">JPG, PNG, WEBP o SVG. Máximo 10 MB.</small></div></label>`;
  }
  const inputType = kind === 'number' ? 'number' : 'text';
  return `<label><span>${escapeHtml(label)}</span><input name="${name}" type="${inputType}" value="${escapeHtml(value)}" ${kind==='number'?'step="1"':''}></label>`;
}
function showItemEditor(type, row=null) {
  const def = itemDefinitions[type];
  const editor = document.querySelector(def.editor);
  const data = row ? {...row} : {...def.defaults, display_order: (Math.max(0,...({services,portfolio,team})[type].map(x=>Number(x.display_order)||0))+1)};
  editor.dataset.itemId = row?.id || '';
  editor.innerHTML = `<div class="editor-head"><h3>${row?'Editar':'Añadir'} ${def.title}</h3><button type="button" class="text-button" data-close-editor="${type}">Cerrar ×</button></div><form class="editor-form" data-item-form="${type}">${def.fields.map(([field,label,kind,options])=>inputForItemField(type,field,label,kind,options,data)).join('')}</form><div class="editor-actions"><button class="button button-quiet" type="button" data-close-editor="${type}">Cancelar</button><button class="button button-primary" type="button" data-save-item="${type}">Guardar ${def.title}</button></div>`;
  editor.hidden = false;
  editor.scrollIntoView({behavior:'smooth',block:'start'});
}
async function uploadImage(file, folder) {
  const allowed = ['image/jpeg','image/png','image/webp','image/svg+xml'];
  if (!allowed.includes(file.type)) throw new Error('Formato no permitido. Usa JPG, PNG, WEBP o SVG.');
  if (file.size > 10 * 1024 * 1024) throw new Error('La imagen supera el límite de 10 MB.');
  const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9._-]+/g,'-');
  const path = `cms/${folder}/${Date.now()}-${safeName}`;
  const {error} = await supabase.storage.from('effettolab-site-media').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
  if (error) throw error;
  return path;
}
async function saveItem(type) {
  const def = itemDefinitions[type];
  const editor = document.querySelector(def.editor);
  const form = editor.querySelector('form');
  const id = editor.dataset.itemId;
  const payload = {};
  for (const [field,,kind] of def.fields) {
    const input = form.elements[`${type}-${field}`];
    if (!input) continue;
    if (kind === 'boolean') payload[field] = input.checked;
    else if (kind === 'number') payload[field] = Number(input.value || 0);
    else payload[field] = input.value.trim();
  }
  if (!payload.slug) payload.slug = String(payload.title || payload.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  if (!payload.title && type !== 'team') throw new Error('Escribe un título antes de guardar.');
  if (type === 'team' && !payload.name) throw new Error('Escribe el nombre del integrante.');
  if (!payload.slug) throw new Error('No fue posible generar el identificador.');
  if (type === 'portfolio' && !payload.image_path) throw new Error('Selecciona una fotografía para este trabajo.');
  const query = id ? supabase.from(def.table).update(payload).eq('id',id) : supabase.from(def.table).insert(payload);
  const {error} = await query;
  if (error) throw error;
  editor.hidden = true;
  await loadData();
  showGlobalMessage(`${def.title.charAt(0).toUpperCase()+def.title.slice(1)} guardado correctamente.`);
}
async function deleteItem(type,id) {
  const def = itemDefinitions[type];
  if (!window.confirm(`¿Seguro que deseas eliminar este ${def.title}? Esta acción no se puede deshacer.`)) return;
  const {error} = await supabase.from(def.table).delete().eq('id',id);
  if (error) throw error;
  await loadData();
  showGlobalMessage(`${def.title.charAt(0).toUpperCase()+def.title.slice(1)} eliminado.`);
}
async function saveGeneralGroup(section, button) {
  const group = [...document.querySelectorAll('.content-group')].find(el => el.querySelector('.group-head h3')?.textContent.includes(section));
  if (!group) return;
  const controls = [...group.querySelectorAll('[data-key]')];
  const changes = [];
  for (const input of controls) {
    const type = input.dataset.type;
    let value;
    if (type === 'boolean') value = input.value === 'true';
    else if (type === 'number') value = input.value === '' ? null : Number(input.value);
    else if (type === 'json') {
      try { value = JSON.parse(input.value); }
      catch { throw new Error(`El campo “${input.closest('label').querySelector('span').textContent}” no contiene JSON válido.`); }
    } else value = input.value;
    changes.push({key:input.dataset.key,value});
  }
  setBusy(button,true);
  try {
    for (const change of changes) {
      const {error} = await supabase.from('cms_site_content').update({content_value:change.value}).eq('content_key',change.key);
      if (error) throw error;
    }
    await loadSiteContent();
    renderGeneralContent();
    showGlobalMessage(`Se guardaron los campos de ${section}.`);
  } finally { setBusy(button,false); }
}
async function loadSiteContent() {
  const {data,error} = await supabase.from('cms_site_content').select('*').order('section').order('label');
  if (error) throw error;
  siteContent = data || [];
}
async function loadData() {
  const [contentResult,servicesResult,portfolioResult,teamResult] = await Promise.all([
    supabase.from('cms_site_content').select('*').order('section').order('label'),
    supabase.from('cms_services').select('*').order('display_order'),
    supabase.from('cms_portfolio_items').select('*').order('display_order'),
    supabase.from('cms_team_members').select('*').order('display_order')
  ]);
  for (const result of [contentResult,servicesResult,portfolioResult,teamResult]) if (result.error) throw result.error;
  siteContent = contentResult.data || [];
  services = servicesResult.data || [];
  portfolio = portfolioResult.data || [];
  team = teamResult.data || [];
  document.querySelector('#stat-content').textContent = siteContent.length;
  document.querySelector('#stat-services').textContent = services.length;
  document.querySelector('#stat-portfolio').textContent = portfolio.length;
  document.querySelector('#stat-team').textContent = team.length;
  renderGeneralContent();
  renderItemList('services');
  renderItemList('portfolio');
  renderItemList('team');
}
function setView(view) {
  activeView = view;
  document.querySelectorAll('.view').forEach(el => {el.hidden = el.id !== `view-${view}`; el.classList.toggle('active',el.id === `view-${view}`);});
  document.querySelectorAll('.nav-link').forEach(el => el.classList.toggle('active',el.dataset.view === view));
  document.querySelector('#page-title').textContent = viewTitles[view] || 'Panel';
  window.scrollTo({top:0,behavior:'smooth'});
}
async function verifyAdminAndOpen(session) {
  if (!session?.user) {
    loginScreen.hidden = false;
    appShell.hidden = true;
    return;
  }
  const {data,error} = await supabase.from('cms_admins').select('user_id,role,is_active').eq('user_id',session.user.id).maybeSingle();
  if (error) throw error;
  if (!data || !data.is_active || data.role !== 'admin') {
    await supabase.auth.signOut();
    loginScreen.hidden = false;
    appShell.hidden = true;
    showLoginMessage('Esta cuenta no tiene permisos de administrador activos.',true);
    return;
  }
  currentUser = session.user;
  document.querySelector('#account-email').textContent = currentUser.email || 'Administrador';
  loginScreen.hidden = true;
  appShell.hidden = false;
  await loadData();
  setView(activeView);
}
async function initialize() {
  if (!requiredConfigReady) {
    showLoginMessage('Falta configurar la clave publishable/anon en admin/config.js. No uses service_role.',true);
    return;
  }
  supabase = createClient(config.supabaseUrl,config.supabaseAnonKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  supabase.auth.onAuthStateChange((event,session) => {
    if (event === 'SIGNED_IN' && session) {
      queueMicrotask(() => verifyAdminAndOpen(session).catch(err => showGlobalMessage(toReadableError(err),true)));
    }
    if (event === 'SIGNED_OUT') {
      loginScreen.hidden = false;
      appShell.hidden = true;
      currentUser = null;
    }
  });
  const {data,error} = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session) await verifyAdminAndOpen(data.session);
}

loginForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if (!supabase) return showLoginMessage('Configura primero la conexión de Supabase.',true);
  const button = loginForm.querySelector('button[type="submit"]');
  setBusy(button,true,'Verificando…');
  try {
    const email = document.querySelector('#login-email').value.trim();
    const password = document.querySelector('#login-password').value;
    const {data,error} = await supabase.auth.signInWithPassword({email,password});
    if (error) throw error;
    await verifyAdminAndOpen(data.session);
    showLoginMessage('');
  } catch(error) { showLoginMessage(toReadableError(error),true); }
  finally { setBusy(button,false); }
});


document.querySelector('#magic-link-button').addEventListener('click',async event=>{
  if (!supabase) return showLoginMessage('Configura primero la conexión de Supabase.',true);
  const email = document.querySelector('#login-email').value.trim();
  if (!email) return showLoginMessage('Escribe primero tu correo electrónico.',true);
  const button = event.currentTarget;
  setBusy(button,true,'Enviando…');
  try {
    const {error} = await supabase.auth.signInWithOtp({
      email,
      options:{
        emailRedirectTo:'https://effettolab.com/admin/',
        shouldCreateUser:false
      }
    });
    if (error) throw error;
    showLoginMessage('Revisa tu correo. Te enviamos un enlace de acceso si la cuenta está habilitada.');
  } catch(error) { showLoginMessage(toReadableError(error),true); }
  finally { setBusy(button,false); }
});


document.querySelector('#main-nav').addEventListener('click',event=>{
  const button = event.target.closest('[data-view]');
  if (button) setView(button.dataset.view);
});
document.querySelector('#logout-button').addEventListener('click',async()=>{
  const {error} = await supabase.auth.signOut();
  if (error) showGlobalMessage(toReadableError(error),true);
});

document.querySelector('#general-groups').addEventListener('click',async event=>{
  const button = event.target.closest('[data-save-group]');
  if (!button) return;
  try { await saveGeneralGroup(button.dataset.saveGroup,button); }
  catch(error) { showGlobalMessage(toReadableError(error),true); }
});

for (const type of ['services','portfolio','team']) {
  const def = itemDefinitions[type];
  document.querySelector(def.list).addEventListener('click',async event=>{
    const edit = event.target.closest('[data-edit]');
    const remove = event.target.closest('[data-delete]');
    if (edit) {
      const row = ({services,portfolio,team})[type].find(x=>x.id===edit.dataset.edit);
      if (row) showItemEditor(type,row);
    }
    if (remove) {
      try { await deleteItem(type,remove.dataset.delete); }
      catch(error) { showGlobalMessage(toReadableError(error),true); }
    }
  });
  document.querySelector(def.editor).addEventListener('click',async event=>{
    const close = event.target.closest('[data-close-editor]');
    const save = event.target.closest('[data-save-item]');
    if (close) document.querySelector(def.editor).hidden = true;
    if (save) {
      setBusy(save,true,'Guardando…');
      try { await saveItem(type); }
      catch(error) { showGlobalMessage(toReadableError(error),true); }
      finally { setBusy(save,false); }
    }
  });
  document.querySelector(def.editor).addEventListener('change',async event=>{
    const upload = event.target.closest('[data-upload-image]');
    if (!upload || !upload.files?.[0]) return;
    try {
      showGlobalMessage('Subiendo imagen…');
      const path = await uploadImage(upload.files[0],type);
      const textInput = document.querySelector(`[name="${CSS.escape(upload.dataset.uploadImage)}"]`);
      textInput.value = path;
      const preview = upload.closest('.image-control').querySelector('.image-preview');
      if (preview.tagName === 'IMG') preview.src = getImageUrl(path);
      else {
        const img = document.createElement('img');
        img.className = 'image-preview'; img.alt = 'Vista previa'; img.src = getImageUrl(path);
        preview.replaceWith(img);
      }
      showGlobalMessage('Imagen subida. Guarda la ficha para aplicar la nueva ruta.');
    } catch(error) { showGlobalMessage(toReadableError(error),true); }
  });
}

document.querySelector('#add-service').addEventListener('click',()=>showItemEditor('services'));
document.querySelector('#add-portfolio').addEventListener('click',()=>showItemEditor('portfolio'));
document.querySelector('#add-team').addEventListener('click',()=>showItemEditor('team'));

initialize().catch(error=>showLoginMessage(toReadableError(error),true));
