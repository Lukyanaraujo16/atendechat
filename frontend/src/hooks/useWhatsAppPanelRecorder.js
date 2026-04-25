import { useRef, useCallback, useState } from "react";
import { toast } from "react-toastify";
import api from "../services/api";
import { i18n } from "../translate/i18n";
import toastError from "../errors/toastError";
import {
  getBestAudioMimeType,
  createAudioMediaRecorder,
  getAudioFileExtension,
  getAudioErrorI18nKey,
  logAudioRecorderError,
} from "../utils/audioRecorder";

/**
 * Gravação de voz no painel (MediaRecorder + MIME negociado — compatível com Edge/Chrome/Firefox).
 * @param {{ ticketId: number|string, setLoading: (v: boolean) => void }} opts
 */
export function useWhatsAppPanelRecorder({ ticketId, setLoading }) {
  const [recording, setRecording] = useState(false);
  const audioStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const selectedMimeTypeRef = useRef("");
  const dataListenerRef = useRef(null);
  const errorListenerRef = useRef(null);

  const stopAudioTracks = useCallback(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
  }, []);

  const detachRecorderListeners = useCallback((rec) => {
    if (!rec) return;
    if (dataListenerRef.current) {
      rec.removeEventListener("dataavailable", dataListenerRef.current);
      dataListenerRef.current = null;
    }
    if (errorListenerRef.current) {
      rec.removeEventListener("error", errorListenerRef.current);
      errorListenerRef.current = null;
    }
  }, []);

  const waitForRecorderStop = useCallback(() => {
    return new Promise((resolve, reject) => {
      const rec = mediaRecorderRef.current;
      if (!rec) {
        resolve(null);
        return;
      }
      if (rec.state === "inactive") {
        resolve(rec);
        return;
      }
      const onEnd = () => {
        rec.removeEventListener("stop", onEnd);
        resolve(rec);
      };
      rec.addEventListener("stop", onEnd, { once: true });
      try {
        rec.stop();
      } catch (e) {
        rec.removeEventListener("stop", onEnd);
        logAudioRecorderError("recorder_stop_threw", e);
        reject(e);
      }
    });
  }, []);

  const handleStartRecording = useCallback(async () => {
    setLoading(true);
    audioChunksRef.current = [];
    selectedMimeTypeRef.current = "";

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      logAudioRecorderError("no_getUserMedia", new Error("API missing"));
      toast.error(i18n.t("messagesInput.audioRecorder.notSupported"));
      setLoading(false);
      return;
    }
    if (!window.MediaRecorder) {
      logAudioRecorderError("no_MediaRecorder", new Error("API missing"));
      toast.error(i18n.t("messagesInput.audioRecorder.notSupported"));
      setLoading(false);
      return;
    }

    const { mime, explicit } = getBestAudioMimeType();

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      logAudioRecorderError("getUserMedia", err);
      const k = getAudioErrorI18nKey(err);
      toast.error(i18n.t(`messagesInput.audioRecorder.${k}`));
      setLoading(false);
      return;
    }

    let recorder;
    try {
      recorder = createAudioMediaRecorder(stream, mime, explicit);
    } catch (err) {
      logAudioRecorderError("MediaRecorder_create", err);
      stream.getTracks().forEach((t) => t.stop());
      toast.error(i18n.t("messagesInput.audioRecorder.formatNotSupported"));
      setLoading(false);
      return;
    }

    const onData = (e) => {
      if (e.data && e.data.size > 0) {
        audioChunksRef.current.push(e.data);
      }
    };
    const onRecErr = (e) => {
      logAudioRecorderError("recorder_error_event", e.error || e);
    };
    dataListenerRef.current = onData;
    errorListenerRef.current = onRecErr;
    recorder.addEventListener("dataavailable", onData);
    recorder.addEventListener("error", onRecErr);

    selectedMimeTypeRef.current = recorder.mimeType || mime || "audio/webm";
    mediaRecorderRef.current = recorder;
    audioStreamRef.current = stream;

    try {
      recorder.start(250);
    } catch (err) {
      logAudioRecorderError("recorder_start", err);
      detachRecorderListeners(recorder);
      mediaRecorderRef.current = null;
      stopAudioTracks();
      audioChunksRef.current = [];
      toast.error(i18n.t("messagesInput.audioRecorder.recorderStartFailed"));
      setLoading(false);
      return;
    }

    setRecording(true);
    setLoading(false);
  }, [detachRecorderListeners, setLoading, stopAudioTracks]);

  const handleUploadAudio = useCallback(async () => {
    setLoading(true);
    try {
      const stoppedRec = await waitForRecorderStop();
      detachRecorderListeners(stoppedRec);
      mediaRecorderRef.current = null;
      stopAudioTracks();

      const mimeType =
        stoppedRec?.mimeType || selectedMimeTypeRef.current || "audio/webm";
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      audioChunksRef.current = [];

      if (blob.size < 10000) {
        logAudioRecorderError("blob_too_small", { size: blob.size });
        return;
      }

      const ext = getAudioFileExtension(blob.type || mimeType);
      const filename = `audio-record-site-${new Date().getTime()}.${ext}`;
      const formData = new FormData();
      formData.append("medias", blob, filename);
      formData.append("body", filename);
      formData.append("fromMe", true);

      await api.post(`/messages/${ticketId}`, formData);
    } catch (err) {
      logAudioRecorderError("upload_or_stop", err);
      if (err?.response) {
        toastError(err);
      } else {
        toast.error(i18n.t("messagesInput.audioRecorder.blobOrUploadFailed"));
      }
    } finally {
      if (mediaRecorderRef.current) {
        try {
          if (mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
          }
        } catch (e) {
          logAudioRecorderError("recorder_stop_cleanup", e);
        }
        detachRecorderListeners(mediaRecorderRef.current);
        mediaRecorderRef.current = null;
      }
      stopAudioTracks();
      audioChunksRef.current = [];
      setRecording(false);
      setLoading(false);
    }
  }, [
    detachRecorderListeners,
    setLoading,
    stopAudioTracks,
    ticketId,
    waitForRecorderStop,
  ]);

  const handleCancelAudio = useCallback(async () => {
    try {
      const stopped = await waitForRecorderStop();
      detachRecorderListeners(stopped);
    } catch (err) {
      logAudioRecorderError("cancel_stop", err);
    } finally {
      mediaRecorderRef.current = null;
      stopAudioTracks();
      audioChunksRef.current = [];
      setRecording(false);
      setLoading(false);
    }
  }, [detachRecorderListeners, setLoading, stopAudioTracks, waitForRecorderStop]);

  return {
    recording,
    handleStartRecording,
    handleUploadAudio,
    handleCancelAudio,
  };
}
