import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import alertSound from "../../assets/sound.mp3";
import notifySound from "../../assets/chat_notify.mp3";
import { getNotificationSoundType } from "../../utils/getNotificationSoundType";
import {
  persistOpenConversationEnabled,
  readOpenConversationEnabled,
} from "../../utils/notificationSoundOpenConversation";
import { playNotificationSoundThrottled } from "../../utils/notificationSoundPlayback";
import { logNotificationMetric } from "../../utils/globalNotificationMetrics";

const STORAGE_VOLUME = "notificationSoundVolume";
const STORAGE_MUTED = "notificationSoundMuted";
/** Chave legada usada antes do contexto centralizado */
const LEGACY_VOLUME_KEY = "volume";

/** Volume relativo para som discreto na conversa aberta (mesmo arquivo que newMessage). */
const OPEN_CONVERSATION_VOLUME_SCALE = 0.45;

export const NOTIFICATION_SOUND_TYPES = {
  newMessage: "newMessage",
  openConversationMessage: "openConversationMessage",
  newPendingTicket: "newPendingTicket",
  internalChat: "internalChat",
  default: "default",
};

const SOUND_SRC = {
  [NOTIFICATION_SOUND_TYPES.newMessage]: alertSound,
  [NOTIFICATION_SOUND_TYPES.openConversationMessage]: alertSound,
  [NOTIFICATION_SOUND_TYPES.newPendingTicket]: alertSound,
  [NOTIFICATION_SOUND_TYPES.internalChat]: notifySound,
  [NOTIFICATION_SOUND_TYPES.default]: alertSound,
};

const SOUND_VOLUME_SCALE = {
  [NOTIFICATION_SOUND_TYPES.openConversationMessage]:
    OPEN_CONVERSATION_VOLUME_SCALE,
};

function clampVolume(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, n));
}

function readStoredVolume() {
  const raw =
    localStorage.getItem(STORAGE_VOLUME) ??
    localStorage.getItem(LEGACY_VOLUME_KEY);
  return clampVolume(raw);
}

function readStoredMuted() {
  const flag = localStorage.getItem(STORAGE_MUTED);
  if (flag === "true") return true;
  if (flag === "false") return false;
  return readStoredVolume() === 0;
}

function persistSoundPrefs(volume, muted) {
  const v = clampVolume(volume);
  localStorage.setItem(STORAGE_VOLUME, String(v));
  localStorage.setItem(STORAGE_MUTED, muted ? "true" : "false");
  localStorage.setItem(LEGACY_VOLUME_KEY, String(v));
}

const NotificationSoundContext = createContext(null);

function createUnlockedPool() {
  const pool = new Map();
  Object.values(SOUND_SRC).forEach((src) => {
    if (pool.has(src)) return;
    try {
      const audio = new Audio(src);
      audio.preload = "auto";
      pool.set(src, audio);
    } catch {
      /* ignore */
    }
  });
  return pool;
}

export function NotificationSoundProvider({ children }) {
  const [volume, setVolumeState] = useState(readStoredVolume);
  const [muted, setMutedState] = useState(readStoredMuted);
  const [openConversationEnabled, setOpenConversationEnabledState] = useState(
    readOpenConversationEnabled
  );
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const poolRef = useRef(null);

  if (poolRef.current == null && typeof Audio !== "undefined") {
    poolRef.current = createUnlockedPool();
  }

  const effectiveVolume = muted ? 0 : volume;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const unlock = () => {
      const pool = poolRef.current;
      if (!pool) {
        setAudioUnlocked(true);
        return;
      }
      const first = pool.values().next().value;
      if (!first) {
        setAudioUnlocked(true);
        return;
      }
      const prevVolume = first.volume;
      first.volume = 0;
      first
        .play()
        .then(() => {
          first.pause();
          first.currentTime = 0;
          first.volume = prevVolume;
          setAudioUnlocked(true);
          setAudioBlocked(false);
          logNotificationMetric("audio_unlocked");
        })
        .catch(() => {
          /* ainda bloqueado até próximo gesto */
        });
    };

    const opts = { capture: true, passive: true };
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("keydown", unlock, opts);
    window.addEventListener("touchstart", unlock, opts);

    return () => {
      window.removeEventListener("pointerdown", unlock, opts);
      window.removeEventListener("keydown", unlock, opts);
      window.removeEventListener("touchstart", unlock, opts);
    };
  }, []);

  const setVolume = useCallback((next) => {
    const v = clampVolume(next);
    setVolumeState(v);
    const m = v === 0;
    setMutedState(m);
    persistSoundPrefs(v, m);
  }, []);

  const setMuted = useCallback(
    (next) => {
      const m = Boolean(next);
      setMutedState(m);
      persistSoundPrefs(volume, m);
    },
    [volume]
  );

  const toggleMuted = useCallback(() => {
    setMutedState((prev) => {
      const next = !prev;
      persistSoundPrefs(volume, next);
      return next;
    });
  }, [volume]);

  const setOpenConversationEnabled = useCallback((enabled) => {
    const next = Boolean(enabled);
    setOpenConversationEnabledState(next);
    persistOpenConversationEnabled(next);
  }, []);

  const playNotificationSound = useCallback(
    (soundType = NOTIFICATION_SOUND_TYPES.default) => {
      if (muted || effectiveVolume <= 0) {
        return Promise.resolve({ played: false, reason: "muted" });
      }

      const src = SOUND_SRC[soundType] || SOUND_SRC.default;
      const scale = SOUND_VOLUME_SCALE[soundType] ?? 1;
      const pool = poolRef.current;
      let audio = pool?.get(src);

      try {
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        } else {
          audio = new Audio(src);
          if (pool) pool.set(src, audio);
        }
        audio.volume = effectiveVolume * scale;
      } catch (err) {
        logNotificationMetric("audio_create_failed", {
          message: err?.message,
        });
        return Promise.resolve({ played: false, reason: "create_failed" });
      }

      return audio
        .play()
        .then(() => {
          setAudioBlocked(false);
          setAudioUnlocked(true);
          return { played: true };
        })
        .catch((err) => {
          const name = err?.name || "";
          const blocked =
            name === "NotAllowedError" || name === "NotSupportedError";
          if (blocked) {
            setAudioBlocked(true);
            logNotificationMetric("audio_blocked", { name });
          } else if (process.env.NODE_ENV === "development") {
            // eslint-disable-next-line no-console
            console.debug("[NotificationSound] play failed", err);
          }
          return { played: false, reason: blocked ? "blocked" : "error" };
        });
    },
    [muted, effectiveVolume]
  );

  const playContextualNotificationSound = useCallback(
    ({ ticketId, ticketUuid, route } = {}) => {
      if (muted || effectiveVolume <= 0) {
        return Promise.resolve({ played: false, reason: "muted" });
      }

      const pathname =
        route ||
        (typeof window !== "undefined" ? window.location.pathname : "");

      const soundType = getNotificationSoundType({
        route: pathname,
        incomingTicket: { id: ticketId, uuid: ticketUuid },
      });

      if (
        soundType === NOTIFICATION_SOUND_TYPES.openConversationMessage &&
        !openConversationEnabled
      ) {
        return Promise.resolve({ played: false, reason: "open_disabled" });
      }

      return playNotificationSoundThrottled(
        playNotificationSound,
        soundType
      );
    },
    [
      muted,
      effectiveVolume,
      openConversationEnabled,
      playNotificationSound,
    ]
  );

  const value = useMemo(
    () => ({
      volume,
      muted,
      effectiveVolume,
      openConversationEnabled,
      audioUnlocked,
      audioBlocked,
      setVolume,
      setMuted,
      toggleMuted,
      setOpenConversationEnabled,
      playNotificationSound,
      playContextualNotificationSound,
    }),
    [
      volume,
      muted,
      effectiveVolume,
      openConversationEnabled,
      audioUnlocked,
      audioBlocked,
      setVolume,
      setMuted,
      toggleMuted,
      setOpenConversationEnabled,
      playNotificationSound,
      playContextualNotificationSound,
    ]
  );

  return (
    <NotificationSoundContext.Provider value={value}>
      {children}
    </NotificationSoundContext.Provider>
  );
}

export function useNotificationSound() {
  const ctx = useContext(NotificationSoundContext);
  if (!ctx) {
    throw new Error(
      "useNotificationSound must be used within NotificationSoundProvider"
    );
  }
  return ctx;
}

export default NotificationSoundContext;
