export function createPreviewRequestGuard() {
  let generation = 0;

  return {
    begin() {
      generation += 1;
      const id = generation;
      return {
        id,
        isCurrent() {
          return id === generation;
        }
      };
    }
  };
}

export function applyPreviewSuccess(guard, data, onApply) {
  if (!guard || !guard.isCurrent()) {
    return { applied: false };
  }
  onApply(data);
  return { applied: true };
}

export function applyPreviewError(guard, onApply) {
  if (!guard || !guard.isCurrent()) {
    return { applied: false, closed: false };
  }
  onApply();
  return { applied: true, closed: true };
}

export function shouldReloadPreview(prev, next) {
  return (
    Boolean(next.open) &&
    Boolean(next.whatsappId) &&
    Boolean(next.groupJid) &&
    (prev.open !== next.open ||
      prev.whatsappId !== next.whatsappId ||
      prev.groupJid !== next.groupJid)
  );
}
