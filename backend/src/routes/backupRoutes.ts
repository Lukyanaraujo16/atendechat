import { Router } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";
import * as BackupController from "../controllers/BackupController";
import { ensureBackupDirs, getIncomingRestoresDir } from "../config/backup";

const backupRoutes = Router();

const restoreUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureBackupDirs();
      cb(null, getIncomingRestoresDir());
    },
    filename: (_req, _file, cb) => {
      cb(null, `${uuidv4()}.zip`);
    }
  }),
  limits: { fileSize: 4 * 1024 * 1024 * 1024 }
});

backupRoutes.get("/platform/backups", isAuth, isSuper, BackupController.list);

backupRoutes.get(
  "/platform/backups/disk-space",
  isAuth,
  isSuper,
  BackupController.getDiskSpace
);

backupRoutes.get("/platform/backup-config", isAuth, isSuper, BackupController.getBackupConfig);

backupRoutes.put("/platform/backup-config", isAuth, isSuper, BackupController.updateBackupConfig);

backupRoutes.post(
  "/platform/backups/generate",
  isAuth,
  isSuper,
  BackupController.generate
);

backupRoutes.get(
  "/platform/backups/jobs/:jobId",
  isAuth,
  isSuper,
  BackupController.getGenerateJobStatus
);

backupRoutes.delete(
  "/platform/backups/:fileName",
  isAuth,
  isSuper,
  (req, _res, next) => {
    req.params.fileName = path.basename(req.params.fileName || "");
    next();
  },
  BackupController.remove
);

backupRoutes.get(
  "/platform/backups/download/:fileName",
  isAuth,
  isSuper,
  async (req, res, next) => {
    req.params.fileName = path.basename(req.params.fileName);
    try {
      await BackupController.download(req, res);
    } catch (e) {
      next(e);
    }
  }
);

backupRoutes.post(
  "/platform/backups/prepare-restore",
  isAuth,
  isSuper,
  restoreUpload.single("file"),
  BackupController.prepareRestore
);

backupRoutes.post(
  "/platform/backups/execute-restore",
  isAuth,
  isSuper,
  BackupController.executeRestore
);

export default backupRoutes;
