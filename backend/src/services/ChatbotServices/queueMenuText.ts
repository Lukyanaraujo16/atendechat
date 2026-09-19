export type QueueMenuItem = {
  id: string;
  title: string;
};

export type QueueMenuKind = "button" | "list";

/**
 * Transporte Baileys: buttons/list. Evolution omite — o core usa texto.
 */
export type QueueMenuRenderCapability = {
  sendInteractiveMenu?: (input: {
    kind: QueueMenuKind;
    text: string;
    items: QueueMenuItem[];
  }) => Promise<void>;
};

export function formatQueueListText(
  greeting: string,
  queues: Array<{ name: string }>
): string {
  let options = "";
  queues.forEach((queue, index) => {
    options += `*[ ${index + 1} ]* - ${queue.name}\n`;
  });
  const greetingTrim = greeting != null ? String(greeting).trim() : "";
  return greetingTrim
    ? `\u200e${greetingTrim}\n\n${options}`
    : `\u200e${options}`;
}

export function formatQueueOptionsText(
  heading: string,
  options: Array<{ option: string; title: string }>,
  includeBack: boolean
): string {
  let lines = "";
  options.forEach(option => {
    lines += `*[ ${option.option} ]* - ${option.title}\n`;
  });
  if (includeBack) {
    lines += "\n*[ 0 ]* - Menu anterior";
  }
  lines += "\n*[ # ]* - Menu inicial";
  return `\u200e${heading}\n\n${lines}`;
}
