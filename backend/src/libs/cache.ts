import Redis from "ioredis";
import { REDIS_URI_CONNECTION } from "../config/redis";
import util from "util";
import * as crypto from "crypto";

const redis = new Redis(REDIS_URI_CONNECTION);

function encryptParams(params: any) {
  const str = JSON.stringify(params);
  return crypto.createHash("sha256").update(str).digest("base64");
}

export function setFromParams(
  key: string,
  params: any,
  value: string,
  option?: string,
  optionValue?: string | number
) {
  const finalKey = `${key}:${encryptParams(params)}`;
  if (option !== undefined && optionValue !== undefined) {
    return set(finalKey, value, option, optionValue);
  }
  return set(finalKey, value);
}

export function getFromParams(key: string, params: any) {
  const finalKey = `${key}:${encryptParams(params)}`;
  return get(finalKey);
}

export function delFromParams(key: string, params: any) {
  const finalKey = `${key}:${encryptParams(params)}`;
  return del(finalKey);
}

export function set(
  key: string,
  value: string,
  option?: string,
  optionValue?: string | number
) {
  const setPromisefy = util.promisify(redis.set).bind(redis);
  if (option !== undefined && optionValue !== undefined) {
    return setPromisefy(key, value, option, optionValue);
  }

  return setPromisefy(key, value);
}

export function get(key: string) {
  const getPromisefy = util.promisify(redis.get).bind(redis);
  return getPromisefy(key);
}

export function getKeys(pattern: string) {
  const getKeysPromisefy = util.promisify(redis.keys).bind(redis);
  return getKeysPromisefy(pattern);
}

export function del(key: string) {
  const delPromisefy = util.promisify(redis.del).bind(redis);
  return delPromisefy(key);
}

export async function delFromPattern(pattern: string) {
  const all = await getKeys(pattern);
  for (let item of all) {
    del(item);
  }
}

/** SET com NX e EX — devolve true se a chave foi criada (lock adquirido). */
export async function setNx(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<boolean> {
  const reply = await redis.set(key, value, "EX", ttlSeconds, "NX");
  return reply === "OK";
}

export function activeTicketViewKey(
  companyId: number,
  ticketId: number,
  userId: number
): string {
  return `active_ticket_view:${companyId}:${ticketId}:${userId}`;
}

/** Heartbeat: utilizador está a ver o ticket (TTL curto). */
export async function refreshActiveTicketView(
  companyId: number,
  ticketId: number,
  userId: number,
  ttlSeconds: number
): Promise<void> {
  await redis.set(
    activeTicketViewKey(companyId, ticketId, userId),
    "1",
    "EX",
    ttlSeconds
  );
}

/**
 * Remove utilizadores que têm vista ativa no ticket.
 * Em falha Redis, devolve todos em `kept` (fail-open para não perder push).
 */
export async function filterOutUsersViewingTicket(
  companyId: number,
  ticketId: number,
  userIds: number[]
): Promise<{ kept: number[]; skippedActiveView: number[] }> {
  const uniq = [...new Set(userIds.filter(id => id != null && !Number.isNaN(Number(id))))];
  if (!uniq.length) {
    return { kept: [], skippedActiveView: [] };
  }
  try {
    const pipeline = redis.pipeline();
    for (const uid of uniq) {
      pipeline.get(activeTicketViewKey(companyId, ticketId, uid));
    }
    const results = await pipeline.exec();
    const skippedActiveView: number[] = [];
    const kept: number[] = [];
    uniq.forEach((uid, i) => {
      const tuple = results[i];
      if (!tuple) {
        kept.push(uid);
        return;
      }
      const err = tuple[0];
      const val = tuple[1];
      if (err) {
        kept.push(uid);
        return;
      }
      if (val != null) {
        skippedActiveView.push(uid);
      } else {
        kept.push(uid);
      }
    });
    return { kept, skippedActiveView };
  } catch {
    return { kept: uniq, skippedActiveView: [] };
  }
}

export const cacheLayer = {
  set,
  setFromParams,
  get,
  getFromParams,
  getKeys,
  del,
  delFromParams,
  delFromPattern
};
