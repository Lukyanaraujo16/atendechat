import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import User from "../models/User";
import { isInternalUser } from "../helpers/isInternalUser";

const isSuper = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const row = await User.findByPk(req.user.id, {
    attributes: ["super", "profile"]
  });
  const allowed = isInternalUser(row);
  if (!allowed) {
    throw new AppError(
      "Acesso não permitido",
      401
    );
  }

  return next();
}

export default isSuper;
