/* Portable project: fixed header, UTF-8 manifest, then original binary files.
   Blob slices avoid base64 expansion and copying entire videos into JS strings. */
(() => {
'use strict';
// iOS Files may disable unknown custom extensions. Keep desktop filters, but let
// iPhone/iPad select any document; the portable readers validate its contents.
J.configurePortableFileInput = input => {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    /Mac/.test(navigator.platform) && navigator.maxTouchPoints > 1;
  if (ios) input.removeAttribute('accept');
};
const magic = 'JIZURA01', text = new TextEncoder(), decode = new TextDecoder();
const fail = () => new Error('프로젝트 파일이 올바르지 않거나 지원하지 않는 형식입니다');
// Explicit settings allowlist keeps song content and future asset fields out of presets.
const settingKeys = ['themes','themeBalance','style','mood','extra','wa','horror','typo','kinetic','keyBg',
  'seed','aspect','res','fps','videoSize','videoSizeMode','quality','exportBitrate','exportQP','includeAudio','shortExport','fx','enabled',
  'lyricEffects','colors','colorTheme','fonts','userFonts','compositeFonts','effectFavorites','favoriteSequence','customEffects'];
const clone = value => JSON.parse(JSON.stringify(value));
J.projectSettings = project => {
  const result = {};
  for (const key of settingKeys) if (project[key] !== undefined) result[key] = clone(project[key]);
  for (const layer of ['media','foreground']) result[layer] = { effects: clone(J.mediaEffectSettings(project,layer)), opacity: project[layer]?.opacity ?? 100, blend: project[layer]?.blend ?? 'normal' };
  return result;
};
J.settingsProject = project => {
  const settings = J.projectSettings(project), result = Object.assign(J.defaultProject(),settings);
  result.lyrics = ''; result.title = ''; result.artist = '';
  for (const layer of ['media','foreground']) result[layer] = Object.assign(J.normalizeMedia(null),settings[layer]);
  return result;
};
J.applyProjectSettings = (current, source) => {
  const settings = J.projectSettings(source), result = clone(current);
  // Density is also an automatic cut splitter. Retain existing line divisions while
  // accepting the preset density for new lines and future explicit density edits.
  result.overrides ||= {};
  J.parseLyrics(current.lyrics).lines.forEach((line,index) => {
    const ov = result.overrides[index] ||= {};
    ov.divisionDensity ??= current.fx?.density ?? J.defaultProject().fx.density;
  });
  for (const key of settingKeys) if (settings[key] !== undefined) result[key] = settings[key];
  for (const layer of ['media','foreground']) Object.assign(result[layer],settings[layer]);
  // Retained cuts still need their custom component definitions.
  result.customEffects=clone(current.customEffects||[]);J.importCustomEffects(result,settings.customEffects||[]);
  // Existing cuts may still refer to fonts absent from the preset.
  for (const key of ['userFonts','compositeFonts']) {
    const imported = result[key] || [];
    result[key] = [...(current[key] || []).filter(f => !imported.some(g => g.key === f.key)),...imported];
  }
  return result;
};
J.packProject = async (project, audioFile) => {
  const entries = [], parts = []; let offset = 0;
  const add = async (kind, id, file, name) => {
    if (!(file instanceof Blob)) throw new Error((kind === 'font' ? '글꼴을' : '소재를') + ' 찾을 수 없습니다. 다시 불러와 주세요: ' + name);
    try { file = await J.snapshotMediaFile(file); }
    catch (error) {
      throw new Error('소재를 읽을 수 없습니다. 원본 파일이 바뀌었거나 옮겨졌을 수 있습니다. 다시 불러와 주세요: ' + name);
    }
    entries.push({kind,id,name:name || file.name || id,type:file.type,offset,size:file.size});
    parts.push(file); offset += file.size;
  };
  const items = new Map([...project.media.items,...project.foreground.items].map(item=>[item.id,item]));
  for (const [id,item] of items) await add('media',id,J.mediaAssets.get(id)?.file || await J.loadMedia(id),item.name);
  for (const [id,ref] of J.personMaskReferences?.(project) || []) await add('person',id,await J.personMaskBlob(ref),id+'.jizmat');
  if (project.audioAsset) await add('audio',project.audioAsset.id,audioFile || await J.loadMedia(project.audioAsset.id),project.audioAsset.name);
  for (const font of project.userFonts || []) if (font.file) await add('font',font.key,await J.readFontFile(font.key),font.label);
  // 소재 images and their subject masks ({name, type, data: ArrayBuffer} records in this browser)
  for (const asset of project.assets || []) for (const kind of ['asset','mask']) {
    const r = await J.idbGet(kind + ':' + asset.id);
    if (r && r.data) await add(kind,asset.id,new Blob([r.data],{type:r.type || ''}),r.name);
  }
  const manifest = text.encode(JSON.stringify({format:'jizura',version:1,project,entries}));
  if (manifest.length > 32 * 1024 * 1024) throw fail();
  const header = new Uint8Array(12); header.set(text.encode(magic)); new DataView(header.buffer).setUint32(8,manifest.length,true);
  return new Blob([header,manifest,...parts],{type:'application/octet-stream'});
};
J.unpackProject = async file => {
  const header = new Uint8Array(await file.slice(0,12).arrayBuffer());
  if (decode.decode(header.slice(0,8)) !== magic) {
    // Only legacy JSON may use the text path; never decode a video-sized binary.
    if (file.size > 32 * 1024 * 1024 || !/^\s*\{/.test(decode.decode(header))) throw fail();
    const project = JSON.parse(await file.text());
    if (!project || typeof project !== 'object' || typeof project.lyrics !== 'string') throw fail();
    return {project,files:[],portable:false};
  }
  if (header.length !== 12) throw fail();
  const length = new DataView(header.buffer).getUint32(8,true), start = 12 + length;
  if (length > 32 * 1024 * 1024 || start > file.size) throw fail();
  const manifest = JSON.parse(await file.slice(12,start).text());
  if (manifest.format !== 'jizura' || manifest.version !== 1 || typeof manifest.project?.lyrics !== 'string' || !Array.isArray(manifest.entries)) throw fail();
  let end = 0; const seen = new Set(), files = [];
  for (const entry of manifest.entries) {
    if (!['media','audio','font','asset','mask','person'].includes(entry.kind) || typeof entry.id !== 'string' || typeof entry.name !== 'string' || typeof entry.type !== 'string' || !Number.isSafeInteger(entry.offset) || !Number.isSafeInteger(entry.size) || entry.size < 0 || entry.offset !== end || start+end+entry.size > file.size || seen.has(entry.kind+':'+entry.id)) throw fail();
    seen.add(entry.kind+':'+entry.id); end += entry.size;
    files.push({...entry,file:new File([file.slice(start+entry.offset,start+end)],entry.name,{type:entry.type})});
  }
  if (start+end !== file.size) throw fail();
  for (const item of [...(manifest.project.media?.items || []),...(manifest.project.foreground?.items || [])]) if (!seen.has('media:'+item.id)) throw fail();
  if (manifest.project.audioAsset && !seen.has('audio:'+manifest.project.audioAsset.id)) throw fail();
  for (const font of manifest.project.userFonts || []) if (font.file && !seen.has('font:'+font.key)) throw fail();
  for (const entry of files) if (entry.kind === 'asset' || entry.kind === 'mask')
    if (!await J.idbPut(entry.kind + ':' + entry.id, {name:entry.name,type:entry.type,data:await entry.file.arrayBuffer()})) throw fail();
  for (const [id,ref] of J.personMaskReferences?.(manifest.project) || []) {
    if(!seen.has('person:'+id))throw fail();
    await J.readPersonMask(files.find(entry=>entry.kind==='person'&&entry.id===id).file,ref);
  }
  return {project:manifest.project,files,portable:true};
};
})();
