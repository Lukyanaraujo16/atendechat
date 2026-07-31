/**
 * Compatibilidade temporária: clientes com registro legado em /OneSignalSDKWorker.js.
 * O init atual usa /push/onesignal/; a transição desregistra este script raiz.
 * Remover após janela de migração (próximas releases).
 */
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
