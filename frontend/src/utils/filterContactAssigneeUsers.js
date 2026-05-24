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

/** IDs válidos para PUT /contacts/:id/assignments */
export function normalizeAssigneeUserIds(users) {
	return [...new Set((users || []).map((u) => Number(u.id)).filter((id) => id > 0))];
}
