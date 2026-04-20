import BullQueue from "bull";

const connection = process.env.REDIS_URI || "";

/** Fila dedicada: timeout do nó Menu no Flow Builder (evita ciclo de imports com queues.ts). */
export const flowMenuTimeoutQueue = new BullQueue("FlowMenuTimeout", connection);
