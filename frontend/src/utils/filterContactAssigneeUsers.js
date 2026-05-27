/**
 * Opções do Autocomplete de responsáveis.
 * GET /users/list já filtra por companyId no backend; o campo pode não vir no JSON.
 * Exclui apenas usuários explicitamente de outra empresa ou sem empresa (super admin).
 */
export function filterContactAssigneeUsers(users, authCompanyId) {
	const companyId = Number(authCompanyId);
	const list = Array.isArray(users) ? users : [];

	return list.filter((user) => {
		if (user?.companyId == null || user.companyId === "") {
			// Sem companyId no payload: confiar no escopo do /users/list
			return true;
		}
		if (!Number.isFinite(companyId)) {
			return false;
		}
		return Number(user.companyId) === companyId;
	});
}

function assigneeEntryToId(entry) {
	if (entry == null) return NaN;
	if (typeof entry === "number" || typeof entry === "string") {
		return Number(entry);
	}
	return Number(entry.id ?? entry.userId);
}

/** IDs válidos para POST/PUT de responsáveis (objetos de usuário, { userId } ou id numérico). */
export function normalizeAssigneeUserIds(users) {
	return [
		...new Set(
			(users || []).map(assigneeEntryToId).filter((id) => Number.isFinite(id) && id > 0)
		),
	];
}

/**
 * IDs a enviar na API: remove apenas responsáveis claramente inválidos.
 * Se /users/list ainda não carregou, confia na seleção do Autocomplete.
 * Mantém responsáveis já gravados no contato mesmo fora da lista atual.
 */
export function resolveContactAssigneeUserIds(
	selectedAssignees,
	companyUsers,
	{ initialAssigneeIds = [] } = {}
) {
	const selectedIds = normalizeAssigneeUserIds(selectedAssignees);
	if (!selectedIds.length) return [];

	const allowedIds = new Set(normalizeAssigneeUserIds(companyUsers));
	const initialIds = new Set(normalizeAssigneeUserIds(initialAssigneeIds));

	if (allowedIds.size === 0) {
		return selectedIds;
	}

	const valid = selectedIds.filter(
		(id) => allowedIds.has(id) || initialIds.has(id)
	);
	return valid.length > 0 ? valid : selectedIds;
}
