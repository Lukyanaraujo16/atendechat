/**
 * @deprecated Prefer bootstrapDisableWorkboxServiceWorker.
 * Mantido para imports existentes (OneSignal testes / bootstrap).
 */
export {
  bootstrapDisableWorkboxServiceWorker as registerMinimalPwaServiceWorker,
  unregisterWorkboxServiceWorkers,
  clearAppOwnedCaches,
  bootstrapDisableWorkboxServiceWorker,
} from "./utils/unregisterWorkboxServiceWorker";
