import { Op, Transaction } from "sequelize";
import Appointment from "../../models/Appointment";
import AppointmentParticipant from "../../models/AppointmentParticipant";
import User from "../../models/User";

/**
 * Constrói o JSON de compromisso com criador e participantes **sem nenhum include/JOIN
 * do Sequelize** (apenas findByPk + findAll com IN). Evita 500 em MySQL/Sequelize 5
 * (includes aninhados + alias).
 */
export const buildAppointmentResponse = async (
  id: number,
  options: { transaction?: Transaction; companyId?: number } = {}
): Promise<Record<string, unknown> | null> => {
  const { transaction, companyId } = options;
  const a = await Appointment.findByPk(id, { transaction });
  if (!a) {
    return null;
  }
  if (companyId !== undefined && a.companyId !== companyId) {
    return null;
  }

  const [creator, rows] = await Promise.all([
    User.findByPk(a.createdBy, {
      attributes: ["id", "name", "email"],
      transaction
    }),
    AppointmentParticipant.findAll({
      where: { appointmentId: id },
      order: [["id", "ASC"]],
      transaction
    })
  ]);

  const userIds = [...new Set(rows.map(r => r.userId))];
  const users = userIds.length
    ? await User.findAll({
        where: { id: { [Op.in]: userIds } },
        attributes: ["id", "name", "email"],
        transaction
      })
    : [];
  const umap = new Map<number, Record<string, unknown>>(
    users.map(u => {
      const p = u.get({ plain: true }) as Record<string, unknown> & { id: number };
      return [p.id, p];
    })
  );

  const participants = rows.map(r => {
    const plain = r.get({ plain: true });
    return { ...plain, user: umap.get(r.userId) ?? null };
  });

  return {
    ...a.get({ plain: true }),
    creator: creator ? creator.get({ plain: true }) : null,
    participants
  };
};
