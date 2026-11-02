/**
 * Motor mínimo de storytelling por etapas.
 *
 * Elementos dentro da raiz com `data-at="n"` recebem `.is-in` quando a etapa atual >= n
 * e o perdem quando a etapa >= `data-until` (opcional). Os tempos de cada etapa vêm de
 * `data-steps="ms,ms,..."` na raiz. A animação só roda visível na tela e com a aba ativa;
 * com `prefers-reduced-motion` exibe direto o estado final, sem loop.
 */
export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function onVisible(el: Element, cb: (visible: boolean) => void, threshold = 0.25) {
  const io = new IntersectionObserver(([entry]) => cb(entry.isIntersecting), { threshold });
  io.observe(el);
  return io;
}

export function initTimeline(root: HTMLElement) {
  const steps = (root.dataset.steps ?? "").split(",").map(Number).filter((n) => n > 0);
  const items = Array.from(root.querySelectorAll<HTMLElement>("[data-at]"));
  const last = steps.length;
  const hold = Number(root.dataset.hold ?? 4200);

  const render = (step: number) => {
    root.dataset.step = String(step);
    for (const el of items) {
      const at = Number(el.dataset.at);
      const until = el.dataset.until ? Number(el.dataset.until) : Infinity;
      el.classList.toggle("is-in", step >= at && step < until);
    }
  };

  if (reducedMotion()) {
    render(last);
    root.classList.add("is-static");
    return;
  }

  let step = 0;
  let timer: number | undefined;
  let running = false;
  let visible = false;

  const schedule = () => {
    window.clearTimeout(timer);
    if (!running) return;
    if (step >= last) {
      timer = window.setTimeout(() => {
        root.classList.add("is-resetting");
        timer = window.setTimeout(() => {
          step = 0;
          render(step);
          root.classList.remove("is-resetting");
          schedule();
        }, 600);
      }, hold);
      return;
    }
    timer = window.setTimeout(() => {
      step += 1;
      render(step);
      schedule();
    }, steps[step]);
  };

  const sync = () => {
    const shouldRun = visible && !document.hidden;
    if (shouldRun === running) return;
    running = shouldRun;
    if (running) schedule();
    else window.clearTimeout(timer);
  };

  render(0);
  onVisible(root, (v) => {
    visible = v;
    sync();
  });
  document.addEventListener("visibilitychange", sync);
}

/** Revela elementos `[data-reveal]` uma única vez ao entrarem na tela. */
export function initReveal() {
  const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
  if (reducedMotion()) {
    els.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
  );
  els.forEach((el) => io.observe(el));
}
