// Reserve room for the other sessions sharing Claude's 4 MiB plugin store.
export const MAX_STATE_BYTES = 2800 * 1024;
export const jsonBytes = value => new TextEncoder().encode(JSON.stringify(value)).length;

export function boundedState(state) {
  let next = { ...state, undo: [...state.undo], redo: [...(state.redo||[])], history: [...state.history], done: [...state.done] };
  // Retention is bounded by bytes as well as count. Never trim pending/running work.
  while (jsonBytes(next) > MAX_STATE_BYTES && next.undo.length) next.undo.pop();
  while (jsonBytes(next) > MAX_STATE_BYTES && next.redo.length) next.redo.pop();
  while (jsonBytes(next) > MAX_STATE_BYTES && next.history.length > 1) next.history.pop();
  while (jsonBytes(next) > MAX_STATE_BYTES && next.done.length) next.done.pop();
  if (jsonBytes(next) > MAX_STATE_BYTES) throw new Error('Queue storage limit reached. Shorten tasks or split this batch; existing work is unchanged.');
  return next;
}

