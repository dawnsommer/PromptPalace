(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const DEFAULT_TEMPLATE = $('factoryTemplate').textContent.trim();
  const STORAGE_KEY = 'palaceprompt.state.v1';
  const TOKENS = [
    'DATA1-condition-name',
    'DATA1-parody-world-name',
    'DATA1-clinical-data',
  ];
  const TOKEN_REGEX = /DATA1-condition-name|DATA1-parody-world-name|DATA1-clinical-data/g;
  const DATA2_LINE_REGEX = /^[ \t]*DATA2[ \t]*$/gm;
  const TEXT_LIMIT = 1_500_000;
  const BACKUP_LIMIT = 20_000_000;

  const factoryVersion = () => ({
    id: 'factory',
    name: 'Factory default',
    content: DEFAULT_TEMPLATE,
    createdAt: null,
  });
  const freshState = () => ({
    condition: '', world: '', clinical: '', data2: '',
    activeTemplate: DEFAULT_TEMPLATE,
    versions: [factoryVersion()],
    preview: 'one',
    stage: 'one',
  });

  const elt = {
    condition: $('condition'), world: $('world'), clinical: $('clinical'), data2: $('data2'),
    copy1: $('copy1'), copy2: $('copy2'), copyPreview: $('copyPreview'),
    tab1: $('tab1'), tab2: $('tab2'), output: $('outputText'),
    alert: $('previewAlert'), metrics: $('outputMetrics'),
    savedStatus: $('savedStatus'),
    stageOne: $('stageOnePanel'), stageTwo: $('stageTwoPanel'),
    stageOneToggle: $('stageOneToggle'), stageTwoToggle: $('stageTwoToggle'),
    settingsOverlay: $('settingsOverlay'), editor: $('templateEditor'),
    versionName: $('versionName'), versionList: $('versionsList'),
    templateValidation: $('templateValidation'), dirty: $('templateDirty'),
  };

  let state = readState();
  let storageTimer;
  let toastTimer;
  let lastModalFocus = null;
  let notifiedStorageFailure = false;

  function isValidTemplate(content) {
    if (typeof content !== 'string' || !content.trim() || content.length > TEXT_LIMIT) return false;
    return TOKENS.every((token) => content.includes(token)) &&
      [...content.matchAll(DATA2_LINE_REGEX)].length === 1;
  }

  function missingTemplateTokens(content) {
    const missing = TOKENS.filter((token) => !content.includes(token));
    const count = [...content.matchAll(DATA2_LINE_REGEX)].length;
    if (count !== 1) missing.push(`standalone DATA2 line (found ${count})`);
    return missing;
  }

  function readState() {
    let raw;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (_) { return freshState(); }
    if (!raw) return freshState();
    try {
      const value = JSON.parse(raw);
      const output = freshState();
      if (!value || typeof value !== 'object') return output;
      for (const key of ['condition', 'world', 'clinical', 'data2']) {
        if (typeof value[key] === 'string' && value[key].length < TEXT_LIMIT) output[key] = value[key];
      }
      if (isValidTemplate(value.activeTemplate)) output.activeTemplate = value.activeTemplate;
      if (Array.isArray(value.versions)) {
        const historical = value.versions.filter((v) => v && typeof v.id === 'string' &&
          typeof v.name === 'string' && typeof v.content === 'string' && isValidTemplate(v.content));
        output.versions = historical.filter((v) => v.id !== 'factory');
        output.versions.unshift(factoryVersion());
      }
      output.preview = value.preview === 'two' ? 'two' : 'one';
      output.stage = value.stage === 'two' ? 'two' : 'one';
      return output;
    } catch (_) { return freshState(); }
  }

  function scheduleSave() {
    elt.savedStatus.textContent = 'Saving…';
    elt.savedStatus.classList.remove('storage-error');
    clearTimeout(storageTimer);
    storageTimer = setTimeout(saveImmediately, 180);
  }

  function saveImmediately() {
    clearTimeout(storageTimer);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      elt.savedStatus.textContent = 'Saved locally';
    } catch (_) {
      elt.savedStatus.textContent = 'Session only';
      if (!notifiedStorageFailure) {
        notify('Local storage is unavailable/full. Export a backup in Settings to preserve your work.');
        notifiedStorageFailure = true;
      }
    }
  }

  function buildPromptOne() {
    const replacements = {
      'DATA1-condition-name': state.condition,
      'DATA1-parody-world-name': state.world,
      'DATA1-clinical-data': state.clinical,
    };
    return state.activeTemplate.replace(TOKEN_REGEX, (key) => replacements[key]);
  }

  function buildPromptTwo() {
    return buildPromptOne().replace(/^[ \t]*DATA2[ \t]*$/m, () => state.data2);
  }

  function readyOne() {
    return isValidTemplate(state.activeTemplate) &&
      [state.condition, state.world, state.clinical].every((s) => s.trim().length > 0);
  }
  function readyTwo() { return readyOne() && state.data2.trim().length > 0; }

  function selectStage(stage, focusTab = false) {
    state.stage = stage === 'two' ? 'two' : 'one';
    // Keep the output preview aligned with the selected step by default.
    state.preview = state.stage;
    render();
    scheduleSave();
    if (focusTab) (state.stage === 'one' ? elt.stageOneToggle : elt.stageTwoToggle).focus();
  }

  function render() {
    const isOne = state.stage !== 'two';
    elt.stageOne.hidden = !isOne;
    elt.stageTwo.hidden = isOne;
    elt.stageOneToggle.setAttribute('aria-selected', String(isOne));
    elt.stageTwoToggle.setAttribute('aria-selected', String(!isOne));
    elt.stageOneToggle.tabIndex = isOne ? 0 : -1;
    elt.stageTwoToggle.tabIndex = isOne ? -1 : 0;
    document.querySelector('.stage-switch').classList.toggle('stage-two', !isOne);
    const filled = [state.condition, state.world, state.clinical].filter((s) => s.trim()).length;
    $('step1Status').textContent = `${filled} of 3 filled`;
    $('step1Status').classList.toggle('ready', readyOne());
    $('step2Status').textContent = state.data2.trim() ? 'Data added' : 'Waiting for data';
    $('step2Status').classList.toggle('ready', readyTwo());
    $('clinicalCount').textContent = `${state.clinical.length.toLocaleString()} characters`;
    $('data2Count').textContent = `${state.data2.length.toLocaleString()} characters`;
    $('step1Hint').textContent = readyOne() ? 'Prompt 1E is ready.' : 'Complete all three fields to copy Prompt 1E.';
    $('step2Hint').textContent = readyTwo() ? 'Final Prompt 2 is ready.' : 'Complete both steps to copy the final prompt.';
    elt.copy1.disabled = !readyOne();
    elt.copy2.disabled = !readyTwo();
    const selected = state.preview;
    elt.tab1.setAttribute('aria-selected', String(selected === 'one'));
    elt.tab2.setAttribute('aria-selected', String(selected === 'two'));
    const previewText = selected === 'one' ? buildPromptOne() : buildPromptTwo();
    // Textarea.value, never innerHTML, so inserted user content is treated as plain text.
    elt.output.value = previewText;
    elt.metrics.textContent = `${previewText.length.toLocaleString()} characters · ${countWords(previewText).toLocaleString()} words`;
    const complete = selected === 'one' ? readyOne() : readyTwo();
    const invalid = missingTemplateTokens(state.activeTemplate);
    if (invalid.length) {
      elt.alert.textContent = 'The current template is missing placeholders. Fix it in Settings.';
      elt.alert.className = 'preview-alert warn';
    } else if (complete) {
      elt.alert.textContent = selected === 'one' ? '✓ All Stage 1 fields inserted. DATA2 remains for the next step.' : '✓ All four inputs inserted. Final prompt ready.';
      elt.alert.className = 'preview-alert ok';
    } else {
      elt.alert.textContent = selected === 'one'
        ? 'Preview updates as you type. Empty inputs remain blank.'
        : 'Final preview updates as you add Data 2.';
      elt.alert.className = 'preview-alert';
    }
    elt.copyPreview.disabled = !complete;
    $('downloadPrompt').disabled = !complete;
  }

  function countWords(text) {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/u).length : 0;
  }

  async function copyText(text, successMessage) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        legacyCopy(text);
      }
      notify(successMessage);
    } catch (_) {
      try { legacyCopy(text); notify(successMessage); }
      catch (__) { notify('Clipboard access blocked. Select the preview and copy manually with Ctrl/Cmd+C.'); }
    }
  }

  function legacyCopy(text) {
    const temp = document.createElement('textarea');
    temp.value = text;
    temp.setAttribute('readonly', '');
    temp.style.cssText = 'position:fixed;top:0;left:-10000px;opacity:0;';
    document.body.appendChild(temp);
    temp.select();
    const copied = document.execCommand('copy');
    temp.remove();
    if (!copied) throw new Error('Legacy copy failed');
  }

  async function pasteInto(field) {
    const target = elt[field];
    if (!target) return;
    try {
      if (!navigator.clipboard?.readText || !window.isSecureContext) throw new Error('Clipboard reading unavailable');
      const text = await navigator.clipboard.readText();
      if (!text) { notify('Clipboard is empty.'); return; }
      // Replace selection if any; otherwise replace existing input deliberately.
      const selection = target.selectionStart !== target.selectionEnd;
      if (selection) target.setRangeText(text, target.selectionStart, target.selectionEnd, 'end');
      else target.value = text;
      state[field] = target.value;
      render();
      scheduleSave();
      notify(`Pasted into ${field === 'data2' ? 'Data 2' : field === 'world' ? 'parody world' : field === 'clinical' ? 'clinical data' : 'condition name'}.`);
    } catch (_) {
      target.focus();
      notify('Clipboard permission denied or unavailable. Press ⌘V (Mac) or Ctrl+V here.');
    }
  }

  function notify(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
  }

  function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
    const objectURL = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a');
    a.href = objectURL;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectURL), 1000);
  }

  function slug(text) {
    return String(text || 'untitled').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'untitled';
  }

  function generateId() {
    return (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID() : `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function addHistory(name, content) {
    state.versions.push({ id: generateId(), name: name.slice(0, 80), content, createdAt: new Date().toISOString() });
  }

  function renderSettingsValidation() {
    const content = elt.editor.value;
    const missing = missingTemplateTokens(content);
    const invalid = missing.length > 0 || !content.trim() || content.length > TEXT_LIMIT;
    elt.templateValidation.className = invalid ? 'validation-note invalid' : 'validation-note';
    elt.templateValidation.textContent = invalid
      ? `⚠ ${missing.length ? `Missing/invalid: ${missing.join(', ')}` : 'Template is empty or too large.'}`
      : '✓ All 4 required placeholders are present.';
    const dirty = elt.editor.value !== state.activeTemplate;
    elt.dirty.textContent = dirty ? 'Unsaved changes' : 'No unsaved edits';
    elt.dirty.classList.toggle('dirty', dirty);
    $('saveTemplate').disabled = invalid;
  }

  function renderVersions() {
    const container = elt.versionList;
    container.replaceChildren();
    $('versionCount').textContent = `${state.versions.length} saved`;
    for (const version of state.versions.slice().reverse()) {
      const row = document.createElement('div');
      row.className = 'version-entry';
      const info = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'version-entry-title';
      name.textContent = version.name;
      const meta = document.createElement('div');
      meta.className = 'version-entry-meta';
      const isActive = version.content === state.activeTemplate;
      meta.textContent = `${version.createdAt ? new Date(version.createdAt).toLocaleString() : 'Original built-in template'}${isActive ? ' · Active content' : ''}`;
      info.append(name, meta);
      const restore = document.createElement('button');
      restore.type = 'button';
      restore.textContent = isActive ? 'Active' : 'Restore';
      restore.disabled = isActive;
      restore.addEventListener('click', () => restoreVersion(version));
      row.append(info, restore);
      container.appendChild(row);
    }
  }

  function openSettings() {
    lastModalFocus = document.activeElement;
    elt.editor.value = state.activeTemplate;
    elt.versionName.value = '';
    renderSettingsValidation();
    renderVersions();
    elt.settingsOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    $('closeSettings').focus();
  }

  function closeSettings() {
    if (elt.settingsOverlay.hidden) return;
    if (elt.editor.value !== state.activeTemplate &&
        !window.confirm('Discard your unsaved template edits?')) return;
    elt.settingsOverlay.hidden = true;
    document.body.style.overflow = '';
    if (lastModalFocus && typeof lastModalFocus.focus === 'function') lastModalFocus.focus();
  }

  function restoreVersion(version) {
    if (elt.editor.value !== state.activeTemplate &&
        !window.confirm('Discard unsaved template edits and restore this version?')) return;
    if (!window.confirm(`Restore "${version.name}" as the active template? Your previous versions will be kept.`)) return;
    state.activeTemplate = version.content;
    addHistory(`Restored: ${version.name}`, version.content);
    elt.editor.value = version.content;
    render();
    renderSettingsValidation();
    renderVersions();
    saveImmediately();
    notify('Earlier template restored. Your version history is retained.');
  }

  function saveNewTemplate() {
    const content = elt.editor.value;
    if (!isValidTemplate(content)) {
      renderSettingsValidation();
      notify('Fix missing template placeholders before saving.');
      return;
    }
    const customName = elt.versionName.value.trim();
    const label = customName || `Version ${state.versions.length}`;
    state.activeTemplate = content;
    addHistory(label, content);
    elt.versionName.value = '';
    render();
    renderSettingsValidation();
    renderVersions();
    saveImmediately();
    notify(`Saved "${label}" as a new template version.`);
  }

  function restoreFactory() {
    if (!window.confirm('Restore the built-in original template? This preserves all prior versions and your entered data.')) return;
    state.activeTemplate = DEFAULT_TEMPLATE;
    addHistory('Factory template restored', DEFAULT_TEMPLATE);
    elt.editor.value = DEFAULT_TEMPLATE;
    render();
    renderSettingsValidation();
    renderVersions();
    saveImmediately();
    notify('Factory template restored.');
  }

  function exportBackup() {
    const payload = { schema: 'PalacePromptBackupV1', exportedAt: new Date().toISOString(), app: state };
    const filename = `palaceprompt-backup-${new Date().toISOString().slice(0, 10)}.json`;
    downloadText(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    notify('Backup exported.');
  }

  async function importBackup(file) {
    if (!file) return;
    if (file.size > BACKUP_LIMIT) { notify('Backup file too large (20 MB maximum).'); return; }
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.schema !== 'PalacePromptBackupV1' || !parsed.app || !isValidTemplate(parsed.app.activeTemplate) || !Array.isArray(parsed.app.versions)) {
        throw new Error('Invalid or incompatible PalacePrompt backup.');
      }
      for (const key of ['condition', 'world', 'clinical', 'data2']) {
        if (typeof parsed.app[key] !== 'string' || parsed.app[key].length > TEXT_LIMIT) throw new Error(`Invalid field: ${key}`);
      }
      if (parsed.app.versions.length > 500 || parsed.app.versions.some((version) =>
        !version || typeof version.id !== 'string' || typeof version.name !== 'string' || !isValidTemplate(version.content))) {
        throw new Error('Invalid template history in backup.');
      }
      if (!window.confirm('Import this backup and replace the current local inputs, template, and version history? Export your existing backup first if needed.')) return;
      const imported = freshState();
      for (const key of ['condition', 'world', 'clinical', 'data2']) imported[key] = parsed.app[key];
      imported.activeTemplate = parsed.app.activeTemplate;
      imported.versions = parsed.app.versions.filter((v) => v.id !== 'factory').map((v) => ({
        id: v.id, name: v.name.slice(0, 80), content: v.content,
        createdAt: typeof v.createdAt === 'string' ? v.createdAt : null,
      }));
      imported.versions.unshift(factoryVersion());
      imported.preview = parsed.app.preview === 'two' ? 'two' : 'one';
      imported.stage = parsed.app.stage === 'two' ? 'two' : 'one';
      state = imported;
      for (const key of ['condition', 'world', 'clinical', 'data2']) elt[key].value = state[key];
      elt.editor.value = state.activeTemplate;
      renderSettingsValidation();
      renderVersions();
      render();
      saveImmediately();
      notify('Backup restored successfully.');
    } catch (error) {
      notify(`Could not import backup: ${error.message || 'invalid file'}`);
    }
  }

  // Bind user inputs and controls.
  for (const key of ['condition', 'world', 'clinical', 'data2']) {
    elt[key].value = state[key];
    elt[key].addEventListener('input', () => {
      state[key] = elt[key].value;
      render();
      scheduleSave();
    });
  }
  document.querySelectorAll('[data-paste]').forEach((btn) => btn.addEventListener('click', () => pasteInto(btn.dataset.paste)));
  document.querySelectorAll('[data-stage]').forEach((btn) => {
    btn.addEventListener('click', () => selectStage(btn.dataset.stage));
    btn.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 'one' : event.key === 'End' ? 'two'
        : (state.stage === 'one' ? 'two' : 'one');
      selectStage(next, true);
    });
  });
  $('nextStage').addEventListener('click', () => selectStage('two', true));
  $('previousStage').addEventListener('click', () => selectStage('one', true));
  elt.copy1.addEventListener('click', () => { if (readyOne()) copyText(buildPromptOne(), 'Prompt 1E copied.'); });
  elt.copy2.addEventListener('click', () => { if (readyTwo()) copyText(buildPromptTwo(), 'Final Prompt 2 copied.'); });
  elt.copyPreview.addEventListener('click', () => {
    if (state.preview === 'one' && readyOne()) copyText(buildPromptOne(), 'Prompt 1E copied.');
    if (state.preview === 'two' && readyTwo()) copyText(buildPromptTwo(), 'Final Prompt 2 copied.');
  });
  document.querySelectorAll('[data-preview]').forEach((btn) => btn.addEventListener('click', () => {
    state.preview = btn.dataset.preview;
    render();
    scheduleSave();
  }));
  $('downloadPrompt').addEventListener('click', () => {
    const finalMode = state.preview === 'two';
    if ((finalMode && !readyTwo()) || (!finalMode && !readyOne())) return;
    const filename = `${slug(state.condition)}-${finalMode ? 'prompt2-final' : 'prompt1e'}.txt`;
    downloadText(filename, finalMode ? buildPromptTwo() : buildPromptOne());
    notify('Prompt downloaded as .txt.');
  });
  $('openSettings').addEventListener('click', openSettings);
  $('closeSettings').addEventListener('click', closeSettings);
  $('doneSettings').addEventListener('click', closeSettings);
  elt.settingsOverlay.addEventListener('click', (event) => { if (event.target === elt.settingsOverlay) closeSettings(); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !elt.settingsOverlay.hidden) closeSettings();
    if (event.key === 'Tab' && !elt.settingsOverlay.hidden) {
      const controls = [...elt.settingsOverlay.querySelectorAll('button:not([disabled]),input:not([disabled]):not([hidden]),textarea:not([disabled])')]
        .filter((e) => e.getClientRects().length);
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  elt.editor.addEventListener('input', renderSettingsValidation);
  $('saveTemplate').addEventListener('click', saveNewTemplate);
  $('restoreDefault').addEventListener('click', restoreFactory);
  $('exportBackup').addEventListener('click', exportBackup);
  $('importBackup').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', (event) => {
    importBackup(event.target.files[0]);
    event.target.value = '';
  });
  render();
})();
