// Shared form conversion; the queue engine remains the authority for writes.
export const CONFIG_KEYS = ['verify','model','retries','retryDelayMs','timeoutMs','contextPercent','onFail'];
export const FORM_KEYS = ['verify','model','retries','retryDelay','timeout','contextPercent','onFail'];
export const configSignature = config => JSON.stringify(CONFIG_KEYS.map(key => config?.[key]));
export function configDraft(config) {
  return { verify:config?.verify ?? 'off',model:config?.model ?? 'haiku',retries:String(config?.retries ?? 0),
    retryDelay:String((config?.retryDelayMs ?? 0)/1000),timeout:String((config?.timeoutMs ?? 0)/1000),
    contextPercent:String(config?.contextPercent ?? 0),onFail:config?.onFail ?? 'pause' };
}
export function parseSettings(draft) {
  const integer = (key,max) => {
    const raw=String(draft[key] ?? '').trim();
    if(!/^\d+$/.test(raw)||!Number.isSafeInteger(Number(raw))||Number(raw)>max)throw new Error(key);
    return Number(raw);
  };
  const seconds = (key,max) => {
    const raw=String(draft[key] ?? '').trim(),n=Number(raw);
    if(!/^\d+(?:\.\d{1,3})?$/.test(raw)||!Number.isFinite(n)||n>max)throw new Error(key);
    const ms=Math.round(n*1000);if(!Number.isSafeInteger(ms))throw new Error(key);return ms;
  };
  if(!['off','marker','ai'].includes(draft.verify))throw new Error('verify');
  const model=String(draft.model ?? '').trim();
  if(!/^[a-z0-9._-]{1,100}$/i.test(model))throw new Error('model');
  if(!['pause','continue'].includes(draft.onFail))throw new Error('onFail');
  return {verify:draft.verify,model,retries:integer('retries',5),retryDelayMs:seconds('retryDelay',600),
    timeoutMs:seconds('timeout',86400),contextPercent:integer('contextPercent',99),onFail:draft.onFail};
}
export function settingsGuard(state, expectedConfig) {
  if(state.running)throw new Error('running');
  if(!expectedConfig||configSignature(state.config)!==configSignature(expectedConfig))throw new Error('stale');
}

