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

/** Acesso direto ao cliente ioredis (hardening / métricas distribuídas). */
export function getRedisClient(): Redis {
  return redis;
}

const REDIS_OP_TIMEOUT_MS = Number(process.env.REDIS_OP_TIMEOUT_MS || 250);
/** Após timeout/falha, pula Redis por este intervalo (fail-fast → memória). */
const REDIS_COOLDOWN_MS = Number(process.env.REDIS_COOLDOWN_MS || 5_000);
let redisDownUntil = 0;

export async function withRedisTimeout<T>(
  op: () => Promise<T>,
  ms = REDIS_OP_TIMEOUT_MS
): Promise<T> {
  if (Date.now() < redisDownUntil) {
    throw new Error("redis_cooldown");
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      op(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("redis_op_timeout")),
          ms
        );
      })
    ]);
    return result;
  } catch (err) {
    redisDownUntil = Date.now() + REDIS_COOLDOWN_MS;
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function redisGet(key: string): Promise<string | null> {
  return withRedisTimeout(() => redis.get(key));
}

export async function redisSet(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<"OK" | null> {
  if (ttlSeconds != null) {
    return withRedisTimeout(() => redis.set(key, value, "EX", ttlSeconds));
  }
  return withRedisTimeout(() => redis.set(key, value));
}

export async function redisIncr(key: string): Promise<number> {
  return withRedisTimeout(() => redis.incr(key));
}

export async function redisIncrBy(key: string, n: number): Promise<number> {
  return withRedisTimeout(() => redis.incrby(key, n));
}

export async function redisExpire(
  key: string,
  ttlSeconds: number
): Promise<number> {
  return withRedisTimeout(() => redis.expire(key, ttlSeconds));
}

export async function redisHIncrBy(
  key: string,
  field: string,
  n: number
): Promise<number> {
  return withRedisTimeout(() => redis.hincrby(key, field, n));
}

export async function redisHGetAll(
  key: string
): Promise<Record<string, string>> {
  return withRedisTimeout(() => redis.hgetall(key));
}

export async function redisZAdd(
  key: string,
  score: number,
  member: string
): Promise<number> {
  return withRedisTimeout(() => redis.zadd(key, score, member));
}

export async function redisZRemRangeByScore(
  key: string,
  min: number | string,
  max: number | string
): Promise<number> {
  return withRedisTimeout(() => redis.zremrangebyscore(key, min, max));
}

export async function redisZCard(key: string): Promise<number> {
  return withRedisTimeout(() => redis.zcard(key));
}

export async function redisZCount(
  key: string,
  min: number | string,
  max: number | string
): Promise<number> {
  return withRedisTimeout(() => redis.zcount(key, min, max));
}

export async function redisPing(): Promise<boolean> {
  try {
    const r = await withRedisTimeout(() => redis.ping(), 300);
    return r === "PONG";
  } catch {
    return false;
  }
}
