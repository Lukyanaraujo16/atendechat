import PlatformUserPermission from "../../models/PlatformUserPermission";

/**
 * Fonte de verdade para permissões internas de plataforma.
 * Deny by default: ausência ou enabled=false ⇒ sem acesso.
 */
export async function hasPlatformPermission(
  userId: number | string,
  permissionKey: string
): Promise<boolean> {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return false;
  if (!permissionKey || typeof permissionKey !== "string") return false;

  const row = await PlatformUserPermission.findOne({
    where: {
      userId: id,
      permissionKey,
      enabled: true
    },
    attributes: ["id"]
  });

  return Boolean(row);
}

export async function listEnabledPlatformPermissions(
  userId: number | string
): Promise<string[]> {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return [];

  const rows = await PlatformUserPermission.findAll({
    where: {
      userId: id,
      enabled: true
    },
    attributes: ["permissionKey"],
    order: [["permissionKey", "ASC"]]
  });

  return rows.map(r => r.permissionKey);
}

const PlatformUserPermissionService = {
  hasPlatformPermission,
  listEnabledPlatformPermissions
};

export default PlatformUserPermissionService;
