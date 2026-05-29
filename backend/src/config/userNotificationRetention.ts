/**
 * Política de retenção automática (job CleanupOldUserNotificationsService).
 *
 * - Lidas (não arquivadas): apagadas após 72 h desde readAt (ou updatedAt se readAt ausente).
 * - Arquivadas: apagadas após 24 h desde archivedAt.
 * - Não lidas: apagadas após 15 dias desde createdAt.
 *
 * O job corre no arranque do servidor e de 6 em 6 horas.
 */
export const RETENTION_READ_HOURS = 72;
export const RETENTION_ARCHIVED_HOURS = 24;
export const RETENTION_UNREAD_DAYS = 15;
