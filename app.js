/* PalacePrompt JS — dependency-free, offline-first prompt assembler. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const DEFAULT_TEMPLATE = window.PALACE_DEFAULT_TEMPLATE;
  const KEY = 'palaceprompt.state.v1'; // Reuse earlier PalacePrompt saved data.
  const MAX_FIELD = 1_500_000;
  const TOKENS = ['DATA1-condition-name', 'DATA1-parody-world-name', 'DATA1-clinical-data'];
  const DATA1_REGEX = /DATA1-condition-name|DATA1-parody-world-name|DATA1-clinical-data/g;
  const DATA2_REGEX = /^[ \t]*DATA2[ \t]*$/gm;
  const icon = (name, size = 17) => {
    const paths = {
      copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/>',
      paste: '<path d="M9 4.5h-3a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-13a2 2 0 0 0-2-2h-3"/><rect x="9" y="2.5" width="6" height="4" rx="1"/>',
      settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="m19.3 15.1 1.2 1.2-2.2 2.2-1.2-1.2a7.7 7.7 0 0 1-2.1.9V20h-3.1v-1.8a7.7 7.7 0 0 1-2.1-.9l-1.2 1.2-2.2-2.2 1.2-1.2a7.7 7.7 0 0 1-.9-2.1H5v-3.1h1.7a7.7 7.7 0 0 1 .9-2.1L6.4 6.6l2.2-2.2 1.2 1.2a7.7 7.7 0 0 1 2.1-.9V3H15v1.7a7.7 7.7 0 0 1 2.1.9l1.2-1.2 2.2 2.2-1.2 1.2a7.7 7.7 0 0 1 .9 2.1H22V13h-1.8a7.7 7.7 0 0 1-.9 2.1Z" transform="translate(-.6,.5) scale(.97)"/>',
      eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.7"/>',
      close: '<path d="M5 5 19 19M19 5 5 19"/>',
      arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
      left: '<path d="M19 12H5m6 6-6-6 6-6"/>',
      download: '<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
      check: '<path d="m4.5 12 5 5L20 6.5"/>',
      save: '<path d="M4 4h13l3 3v13H4Z"/><path d="M7 4v7h10V4M8 20v-6h8v6"/>',
      refresh: '<path d="M4 11a8 8 0 0 1 14-5l2 2m0-5v5h-5M20 13a8 8 0 0 1-14 5l-2-2m0 5v-5h5"/>',
    };
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
  };
  const pasteBtn = (id, label) => `<button type="button" class="field-paste" data-paste="${id}" aria-label="Paste ${label}" title="Paste from clipboard">${icon('paste', 16)}<span>Paste</span></button>`;
  const factory = () => ({id:'factory',name:'Factory default',content:DEFAULT_TEMPLATE,createdAt:null});
  const fresh = () => ({ condition:'',world:'',clinical:'',data2:'',activeTemplate:DEFAULT_TEMPLATE,versions:[factory()],stage:'one',preview:'one' });
  function validTemplate(txt) {
    return typeof txt === 'string' && txt.trim().length > 0 && txt.length <= MAX_FIELD &&
      TOKENS.every(token => txt.includes(token)) && [...txt.matchAll(DATA2_REGEX)].length === 1;
  }
  function invalidReasons(txt) {
    const missing = TOKENS.filter(token => !txt.includes(token));
    const count = [...txt.matchAll(DATA2_REGEX)].length;
    if(count !== 1) missing.push(`standalone DATA2 line: found ${count}, need 1`);
    if(!txt.trim() || txt.length > MAX_FIELD) missing.push('empty / over-size template');
    return missing;
  }
  function readState(){
    const s = fresh();
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if(!d || typeof d !== 'object') return s;
      for(const k of ['condition','world','clinical','data2']) if(typeof d[k]==='string' && d[k].length <=MAX_FIELD) s[k]=d[k];
      if(validTemplate(d.activeTemplate)) s.activeTemplate=d.activeTemplate;
      if(Array.isArray(d.versions)) s.versions=[factory(),...d.versions.filter(v => v && v.id!=='factory' && typeof v.id==='string' && typeof v.name==='string' && validTemplate(v.content)).slice(-250)];
      s.stage=d.stage==='two'?'two':'one';s.preview=s.stage;
    } catch (_) { /* Storage unavailable: app still works for this session. */ }
    return s;
  }
  let state=readState();
  let saveTimer, toastTimer, focusBeforeDialog, settingsTab='template';
  const app = $('app');
  app.innerHTML = `
  <div class="app-shell">
    <header class="app-header">
      <div class="brand-mark" aria-hidden="true">P<span>·</span></div>
      <div class="brand-text"><strong>PalacePrompt<span class="brand-js"> JS</span></strong><small>Compact builder</small></div>
      <div class="header-right">
        <span id="saveState" class="save-state"><span class="save-dot"></span> Saved locally</span>
        <button id="openPreview" class="tool-button preview-launch" type="button" aria-label="Open prompt preview">${icon('eye',17)}<span>Preview</span></button>
        <button id="openSettings" class="tool-button" type="button" aria-label="Open template settings">${icon('settings',18)}<span class="settings-name">Settings</span></button>
      </div>
    </header>
    <section class="workspace" aria-label="Prompt builder">
      <div class="stage-select" role="tablist" aria-label="Builder stages">
        <div class="slider" aria-hidden="true"></div>
        <button id="stageOne" type="button" role="tab" data-stage="one" aria-selected="true" aria-controls="panelOne"><span class="step-index">01</span> Build Prompt 1E</button>
        <button id="stageTwo" type="button" role="tab" data-stage="two" aria-selected="false" aria-controls="panelTwo"><span class="step-index">02</span> Add Data 2</button>
      </div>
      <main class="content-area">
        <div class="input-card">
          <section id="panelOne" class="stage-panel" role="tabpanel" aria-labelledby="stageOne">
            <div class="section-title"><div><h1>Build Prompt 1E</h1><p>Fill three fields to populate your base prompt.</p></div><span id="stepOneBadge" class="completion">0 / 3</span></div>
            <div class="compact-two-col">
              <div class="field"><label for="condition">Condition name</label><div class="input-wrap"><input id="condition" type="text" autocomplete="off" placeholder="e.g. Aortic dissection">${pasteBtn('condition','condition name')}</div></div>
              <div class="field"><label for="world">Parody world</label><div class="input-wrap"><input id="world" type="text" autocomplete="off" placeholder="e.g. One Piece universe">${pasteBtn('world','parody world')}</div></div>
            </div>
            <div class="field stretch-field"><label for="clinical">Clinical data <span id="clinicalCount" class="length-count">0 chars</span></label><div class="input-wrap area-wrap"><textarea id="clinical" placeholder="Paste clinical signs, mechanisms, diagnostic workup, treatment and pitfalls…"></textarea>${pasteBtn('clinical','clinical data')}</div></div>
            <div class="action-row"><span class="action-status" id="stepOneStatus">Complete all three inputs</span><div class="action-buttons"><button id="copy1" class="primary-action" type="button" disabled>${icon('copy',16)} Copy 1E</button><button id="nextStage" class="secondary-action" type="button">Next ${icon('arrow',16)}</button></div></div>
          </section>
          <section id="panelTwo" class="stage-panel" role="tabpanel" aria-labelledby="stageTwo" hidden>
            <div class="section-title"><div><h1>Add Data 2</h1><p>Insert your second data block into Prompt 1E.</p></div><span id="stepTwoBadge" class="completion">Step 2</span></div>
            <div class="field stretch-field"><label for="data2">Data 2 <span id="data2Count" class="length-count">0 chars</span></label><div class="input-wrap area-wrap"><textarea id="data2" placeholder="Paste Data 2 here…"></textarea>${pasteBtn('data2','Data 2')}</div></div>
            <div class="action-row"><span id="stepTwoStatus" class="action-status">Complete Stage 1 + Data 2</span><div class="action-buttons"><button id="previousStage" class="secondary-action" type="button">${icon('left',16)} Back</button><button id="copy2" class="primary-action" type="button" disabled>${icon('copy',16)} Copy final</button></div></div>
          </section>
        </div>
        <aside id="previewCard" class="preview-card" aria-label="Generated prompt preview">
          <div class="preview-header"><div><strong>Live preview</strong><small id="previewSubtitle">Prompt 1E</small></div><div class="preview-toolbar"><button class="small-icon-button" id="downloadTxt" title="Save output as .txt" aria-label="Save output as text file">${icon('download',16)}</button><button class="small-icon-button preview-close" id="closePreview" title="Close preview" aria-label="Close preview">${icon('close',17)}</button></div></div>
          <div id="previewNotice" class="preview-notice">Live preview updates while you type</div>
          <textarea id="output" class="prompt-output" readonly spellcheck="false" aria-label="Assembled prompt text"></textarea>
          <div class="preview-footer"><span id="outputCount">0 chars</span><button id="copyPreview" type="button" class="preview-copy" disabled>${icon('copy',15)} Copy preview</button></div>
        </aside>
      </main>
      <div class="workspace-bottom"><span>Offline · Automatically saves inputs · No account required</span><span class="key-tip">⌘ / Ctrl + Enter: copy current prompt</span></div>
    </section>
  </div>
  <div id="previewBackdrop" class="preview-backdrop" hidden></div>
  <div id="settingsOverlay" class="overlay" hidden>
    <section class="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settingsHeading">
      <div class="settings-top"><div><h2 id="settingsHeading">Template settings</h2><p>Customize the prompt and recover saved versions.</p></div><button id="closeSettings" class="small-icon-button" type="button" aria-label="Close settings">${icon('close',19)}</button></div>
      <div class="settings-tabs" role="tablist" aria-label="Settings sections">
        <button data-settings-tab="template" class="selected" type="button">Edit template</button><button data-settings-tab="versions" type="button">Versions</button><button data-settings-tab="backup" type="button">Backup</button>
      </div>
      <div id="settingsTemplate" class="settings-pane">
        <div class="validation" id="templateValidation">All required placeholders present</div>
        <textarea id="templateEditor" spellcheck="false" aria-label="Edit base prompt template"></textarea>
        <div class="settings-save-row"><input id="versionName" type="text" maxlength="80" placeholder="Version name (optional)" aria-label="Version name"><button id="saveTemplate" class="primary-action" type="button">${icon('save',15)} Save version</button></div>
        <small id="templateDirty" class="inline-hint">Editing will not change the active prompt until saved.</small>
      </div>
      <div id="settingsVersions" class="settings-pane" hidden><div class="history-caption">Restore any prior version without losing the history. <strong id="versionCount"></strong></div><div id="versionsList" class="version-list"></div><div class="versions-bottom"><button id="restoreDefault" class="secondary-action" type="button">${icon('refresh',15)} Restore original template</button></div></div>
      <div id="settingsBackup" class="settings-pane" hidden><p class="backup-description">Export all four inputs, your current template and every saved version as a JSON backup. Import restores that complete state.</p><div class="backup-buttons"><button id="exportBackup" type="button" class="secondary-action">${icon('download',16)} Export backup</button><button id="importBackup" type="button" class="secondary-action">${icon('refresh',16)} Import backup</button><input id="importFile" type="file" accept=".json,application/json" hidden></div><p class="backup-description muted">Data stays in your browser unless you explicitly export it. For reliable recovery, keep an exported backup file.</p></div>
      <div class="settings-foot"><small>Required placeholders: DATA1-condition-name, DATA1-parody-world-name, DATA1-clinical-data, standalone DATA2.</small><button id="doneSettings" class="secondary-action" type="button">Done</button></div>
    </section>
  </div>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>`;

  const fieldIds=['condition','world','clinical','data2'];
  function generated(which) {
    const map={'DATA1-condition-name':state.condition,'DATA1-parody-world-name':state.world,'DATA1-clinical-data':state.clinical};
    const injectStageOne=(part)=>part.replace(DATA1_REGEX,token=>map[token]);
    // Split around the marker in the ORIGINAL template; inject values only afterwards.
    // This prevents replacement of placeholder-like text contained in the user's data.
    if(which==='two'){
      const marker=/^[ \t]*DATA2[ \t]*$/m.exec(state.activeTemplate);
      if(marker){
        const index=marker.index;
        return injectStageOne(state.activeTemplate.slice(0,index)) + state.data2 + injectStageOne(state.activeTemplate.slice(index+marker[0].length));
      }
    }
    return injectStageOne(state.activeTemplate);
  }
  const complete1=()=>validTemplate(state.activeTemplate)&&['condition','world','clinical'].every(k=>state[k].trim());
  const complete2=()=>complete1()&&!!state.data2.trim();
  function formatLength(n){return `${n.toLocaleString()} chars`}
  function render(){
    const one=state.stage==='one';
    $('panelOne').hidden=!one; $('panelTwo').hidden=one;
    for(const [id,on] of [['stageOne',one],['stageTwo',!one]]) {$(id).setAttribute('aria-selected',String(on));$(id).tabIndex=on?0:-1;}
    document.querySelector('.stage-select').classList.toggle('on-two',!one);
    const filled=['condition','world','clinical'].filter(k=>state[k].trim()).length;
    $('stepOneBadge').textContent=`${filled} / 3`;
    $('stepOneBadge').classList.toggle('complete',!!complete1());
    $('stepOneStatus').textContent=complete1()?'Prompt 1E ready to copy':`${3-filled} input${3-filled===1?'':'s'} remaining`;
    $('stepTwoBadge').textContent=complete2()?'Ready':'Step 2';
    $('stepTwoBadge').classList.toggle('complete',!!complete2());
    $('stepTwoStatus').textContent=complete2()?'Final prompt ready':(!complete1()?'Finish Stage 1 first':'Paste Data 2 to finish');
    $('copy1').disabled=!complete1(); $('copy2').disabled=!complete2();
    $('clinicalCount').textContent=formatLength(state.clinical.length);
    $('data2Count').textContent=formatLength(state.data2.length);
    state.preview=state.stage;
    const value=generated(state.preview);
    $('output').value=value;
    $('outputCount').textContent=formatLength(value.length);
    $('previewSubtitle').textContent=one?'Prompt 1E':'Final Prompt 2';
    $('previewNotice').textContent=(one?complete1():complete2())?'All required inputs inserted ✓':'Fill the fields to enable copying';
    $('copyPreview').disabled=one?!complete1():!complete2();
    $('downloadTxt').disabled=one?!complete1():!complete2();
  }
  function save(){
    clearTimeout(saveTimer);
    try {localStorage.setItem(KEY,JSON.stringify(state));$('saveState').innerHTML='<span class="save-dot"></span> Saved locally';}
    catch (_){$('saveState').textContent='Not saved — export backup';}
  }
  function scheduleSave(){
    $('saveState').textContent='Saving…';clearTimeout(saveTimer);saveTimer=setTimeout(save,250);
  }
  function setStage(stage,focus=false){
    state.stage=stage==='two'?'two':'one';render();scheduleSave();
    if(focus) $(state.stage==='two'?'stageTwo':'stageOne').focus();
  }
  function toast(msg){const e=$('toast');e.textContent=msg;e.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('visible'),2600);}
  function fallbackCopy(text){
    const input=document.createElement('textarea');input.value=text;input.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(input);input.select();
    const ok=document.execCommand('copy');input.remove();if(!ok) throw Error('Copy denied');
  }
  async function copyCurrent(which){
    if(which==='one'?!complete1():!complete2()) return;
    const text=generated(which);
    try {if(navigator.clipboard?.writeText && window.isSecureContext) await navigator.clipboard.writeText(text);else fallbackCopy(text);toast(which==='one'?'Prompt 1E copied':'Final prompt copied');}
    catch (_){try {fallbackCopy(text);toast('Prompt copied');}catch(err){$('output').focus();$('output').select();toast('Select the preview and press ⌘C / Ctrl+C');}}
  }
  async function pasteInto(id){
    const input=$(id);
    try {
      if(!window.isSecureContext||!navigator.clipboard?.readText) throw Error('Clipboard API unavailable');
      const clip=await navigator.clipboard.readText();
      if(!clip){toast('Clipboard is empty');return;}
      if(input.selectionStart!==input.selectionEnd) input.setRangeText(clip,input.selectionStart,input.selectionEnd,'end');
      else input.value=clip;
      state[id]=input.value;render();scheduleSave();toast('Pasted');
    }catch(_){input.focus();toast('Press ⌘V or Ctrl+V to paste here');}
  }
  function overlayPreview(open){document.body.classList.toggle('preview-open',open);$('previewBackdrop').hidden=!open;}
  function uniqueId(){return (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;}
  function addVersion(name,content){state.versions.push({id:uniqueId(),name:name.slice(0,80),content,createdAt:new Date().toISOString()});}
  function showSettingsTab(tab){
    settingsTab=['template','versions','backup'].includes(tab)?tab:'template';
    for(const name of ['template','versions','backup']){
      $(`settings${name[0].toUpperCase()+name.slice(1)}`).hidden=name!==settingsTab;
      document.querySelector(`[data-settings-tab="${name}"]`).classList.toggle('selected',name===settingsTab);
    }
    if(settingsTab==='versions') renderVersions();
  }
  function validateEditor(){
    const reason=invalidReasons($('templateEditor').value);
    $('templateValidation').textContent=reason.length?`Missing: ${reason.join(', ')}`:'✓ All four template placeholders present';
    $('templateValidation').classList.toggle('invalid',reason.length>0);
    $('templateDirty').textContent=$('templateEditor').value!==state.activeTemplate?'Unsaved changes — click Save version to apply':'Current active template';
    $('saveTemplate').disabled=reason.length>0;
  }
  function renderVersions(){
    const container=$('versionsList');container.replaceChildren();
    $('versionCount').textContent=`${state.versions.length} saved`;
    for(const v of [...state.versions].reverse()){
      const row=document.createElement('div');row.className='version-row';
      const info=document.createElement('div');info.className='version-description';
      const title=document.createElement('strong');title.textContent=v.name;
      const date=document.createElement('small');date.textContent=`${v.createdAt?new Date(v.createdAt).toLocaleString():'Built-in original'}${v.content===state.activeTemplate?' · Active':''}`;
      info.append(title,date);
      const button=document.createElement('button');button.className='secondary-action';button.textContent=v.content===state.activeTemplate?'Active':'Restore';button.disabled=v.content===state.activeTemplate;
      button.addEventListener('click',()=>{
        if(!confirm(`Restore template "${v.name}"? Your saved versions and input text will remain.`))return;
        state.activeTemplate=v.content;addVersion(`Restored: ${v.name}`,v.content);$('templateEditor').value=v.content;render();validateEditor();renderVersions();save();toast('Template restored');
      });
      row.append(info,button);container.append(row);
    }
  }
  function openSettings(){
    focusBeforeDialog=document.activeElement;
    $('templateEditor').value=state.activeTemplate;$('versionName').value='';validateEditor();showSettingsTab('template');
    $('settingsOverlay').hidden=false;document.body.classList.add('dialog-open');$('closeSettings').focus();
  }
  function closeSettings(){
    if($('settingsOverlay').hidden)return;
    if($('templateEditor').value!==state.activeTemplate&&!confirm('Discard unsaved template edits?'))return;
    $('settingsOverlay').hidden=true;document.body.classList.remove('dialog-open');focusBeforeDialog?.focus?.();
  }
  function saveTemplate(){
    const value=$('templateEditor').value;
    if(!validTemplate(value)){toast('Fix the template placeholders first');return;}
    const name=$('versionName').value.trim()||`Version ${state.versions.length}`;
    state.activeTemplate=value;addVersion(name,value);$('versionName').value='';render();validateEditor();save();toast('Template version saved');
  }
  function download(filename,text,mime){
    const url=URL.createObjectURL(new Blob([text],{type:mime||'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const slug=t=>String(t||'prompt').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'prompt';
  function exportBackup(){download(`palaceprompt-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({schema:'PalacePromptBackupV1',exportedAt:new Date().toISOString(),app:state},null,2),'application/json');toast('Backup exported');}
  async function importBackup(file){
    if(!file)return;
    try {
      if(file.size>20_000_000)throw Error('File too large');
      const parsed=JSON.parse(await file.text());const d=parsed.app;
      if(parsed.schema!=='PalacePromptBackupV1'||!d||!validTemplate(d.activeTemplate)||!Array.isArray(d.versions)||d.versions.length>500)throw Error('Invalid backup');
      for(const k of fieldIds)if(typeof d[k]!=='string'||d[k].length>MAX_FIELD)throw Error('Invalid input data');
      if(d.versions.some(v=>!v||typeof v.id!=='string'||typeof v.name!=='string'||!validTemplate(v.content)))throw Error('Invalid template version');
      if(!confirm('Import backup and replace your saved inputs and versions?'))return;
      state=fresh();for(const k of fieldIds){state[k]=d[k];$(k).value=d[k];}
      state.activeTemplate=d.activeTemplate;state.versions=[factory(),...d.versions.filter(v=>v.id!=='factory')];state.stage=d.stage==='two'?'two':'one';
      $('templateEditor').value=state.activeTemplate;render();validateEditor();save();toast('Backup imported');
    }catch(err){toast(`Import failed: ${err.message}`);}
  }
  for(const k of fieldIds){$(k).value=state[k];$(k).addEventListener('input',()=>{state[k]=$(k).value;render();scheduleSave();});}
  document.querySelectorAll('[data-paste]').forEach(btn=>btn.addEventListener('click',()=>pasteInto(btn.dataset.paste)));
  document.querySelectorAll('[data-stage]').forEach(btn=>{
    btn.addEventListener('click',()=>setStage(btn.dataset.stage));
    btn.addEventListener('keydown',evt=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(evt.key))return;evt.preventDefault();setStage(evt.key==='Home'?'one':evt.key==='End'?'two':state.stage==='one'?'two':'one',true);});
  });
  $('nextStage').addEventListener('click',()=>setStage('two',true));
  $('previousStage').addEventListener('click',()=>setStage('one',true));
  $('copy1').addEventListener('click',()=>copyCurrent('one'));
  $('copy2').addEventListener('click',()=>copyCurrent('two'));
  $('copyPreview').addEventListener('click',()=>copyCurrent(state.stage));
  $('downloadTxt').addEventListener('click',()=>{if(state.stage==='one'?!complete1():!complete2())return;download(`${slug(state.condition)}-${state.stage==='one'?'prompt1e':'prompt2'}.txt`,generated(state.stage));toast('Prompt saved');});
  $('openPreview').addEventListener('click',()=>overlayPreview(true));
  $('closePreview').addEventListener('click',()=>overlayPreview(false));
  $('previewBackdrop').addEventListener('click',()=>overlayPreview(false));
  $('openSettings').addEventListener('click',openSettings);
  $('closeSettings').addEventListener('click',closeSettings);
  $('doneSettings').addEventListener('click',closeSettings);
  $('settingsOverlay').addEventListener('click',evt=>{if(evt.target===$('settingsOverlay'))closeSettings();});
  document.querySelectorAll('[data-settings-tab]').forEach(btn=>btn.addEventListener('click',()=>showSettingsTab(btn.dataset.settingsTab)));
  $('templateEditor').addEventListener('input',validateEditor);
  $('saveTemplate').addEventListener('click',saveTemplate);
  $('restoreDefault').addEventListener('click',()=>{if(!confirm('Restore the original built-in template? Inputs and versions are preserved.'))return;state.activeTemplate=DEFAULT_TEMPLATE;addVersion('Factory restored',DEFAULT_TEMPLATE);$('templateEditor').value=DEFAULT_TEMPLATE;render();validateEditor();renderVersions();save();toast('Original template restored');});
  $('exportBackup').addEventListener('click',exportBackup);
  $('importBackup').addEventListener('click',()=>$('importFile').click());
  $('importFile').addEventListener('change',evt=>{importBackup(evt.target.files[0]);evt.target.value='';});
  document.addEventListener('keydown',evt=>{
    if(evt.key==='Escape'){if(!$('settingsOverlay').hidden)closeSettings();else overlayPreview(false);}
    if((evt.metaKey||evt.ctrlKey)&&evt.key==='Enter'&&!evt.repeat&&!evt.isComposing){evt.preventDefault();copyCurrent(state.stage);}
    if(evt.key==='Tab'&&!$('settingsOverlay').hidden){
      const controls=[...$('settingsOverlay').querySelectorAll('button:not([disabled]), input:not([disabled]):not([type="file"]), textarea:not([disabled])')].filter(e=>e.getClientRects().length);
      if(!controls.length)return;
      if(evt.shiftKey&&document.activeElement===controls[0]){evt.preventDefault();controls.at(-1).focus();}
      else if(!evt.shiftKey&&document.activeElement===controls.at(-1)){evt.preventDefault();controls[0].focus();}
    }
  });
  render();
})();
