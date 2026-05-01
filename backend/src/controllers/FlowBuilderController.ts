import { Request, Response } from "express";
import ListFlowBuilderService from "../services/FlowBuilderService/ListFlowBuilderService";
import CreateFlowBuilderService from "../services/FlowBuilderService/CreateFlowBuilderService";
import UpdateFlowBuilderService from "../services/FlowBuilderService/UpdateFlowBuilderService";
import DeleteFlowBuilderService from "../services/FlowBuilderService/DeleteFlowBuilderService";
import GetFlowBuilderService from "../services/FlowBuilderService/GetFlowBuilderService";
import FlowUpdateDataService from "../services/FlowBuilderService/FlowUpdateDataService";
import FlowsGetDataService from "../services/FlowBuilderService/FlowsGetDataService";
import UploadImgFlowBuilderService from "../services/FlowBuilderService/UploadImgFlowBuilderService";
import UploadAudioFlowBuilderService from "../services/FlowBuilderService/UploadAudioFlowBuilderService";
import DuplicateFlowBuilderService from "../services/FlowBuilderService/DuplicateFlowBuilderService";
import UploadAllFlowBuilderService from "../services/FlowBuilderService/UploadAllFlowBuilderService";
import { isFlowBuilderDebugEnabled } from "../utils/flowBuilderDebug";
import { logger } from "../utils/logger";
import { incrementCompanyStorageUsage } from "../services/CompanyService/adjustCompanyStorageUsage";
// import { handleMessage } from "../services/FacebookServices/facebookMessageListener";

export const createFlow = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { name } = req.body;
  const userId = parseInt(req.user.id);
  const { companyId } = req.user;

  const flow = await CreateFlowBuilderService({
    userId,
    name,
    companyId
  });

  if(flow === 'exist'){
    return res.status(402).json('exist')
  }

  return res.status(200).json(flow);
};

export const updateFlow = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { flowId, name } = req.body;

  const flow = await UpdateFlowBuilderService({ companyId, name, flowId });

  if(flow === 'exist'){
    return res.status(402).json('exist')
  }

  return res.status(200).json(flow);
};

export const deleteFlow = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { idFlow } = req.params;

  const flowIdInt = parseInt(idFlow);

  const flow = await DeleteFlowBuilderService(flowIdInt);

  return res.status(200).json(flow);
};

export const myFlows = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;

  const flows = await ListFlowBuilderService({
    companyId
  });

  return res.status(200).json(flows);
};

export const flowOne = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { idFlow } = req.params;

  const { companyId } = req.user;

  const idFlowInt = parseInt(idFlow);

  const webhook = await GetFlowBuilderService({
    companyId,
    idFlow: idFlowInt
  });

  return res.status(200).json(webhook);
};

export const FlowDataUpdate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const userId = parseInt(req.user.id);

  const bodyData = req.body;

  const { companyId } = req.user;

  if (isFlowBuilderDebugEnabled()) {
    logger.info(
      { keys: Object.keys(bodyData) },
      "[FlowBuilder][debug] FlowDataUpdate body keys"
    );
  }

  const webhook = await FlowUpdateDataService({
    companyId,
    bodyData
  });

  return res.status(200).json(webhook);
};

export const FlowDataGetOne = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { idFlow } = req.params;

  const { companyId } = req.user;

  const idFlowInt = parseInt(idFlow);

  const webhook = await FlowsGetDataService({
    companyId,
    idFlow: idFlowInt
  });

  return res.status(200).json(webhook);
};

export const FlowUploadImg = async (req: Request, res: Response) => {
  const medias = (req.files as Express.Multer.File[]) || [];
  const { companyId } = req.user;
  const userId = parseInt(req.user.id);

  if (isFlowBuilderDebugEnabled()) {
    logger.info(
      { filesCount: medias.length, companyId },
      "[FlowBuilder][debug] FlowUploadImg início"
    );
  }

  if (medias.length === 0) {
    if (isFlowBuilderDebugEnabled()) {
      logger.info("[FlowBuilder][debug] FlowUploadImg rejeitado: sem arquivos");
    }
    return res.status(400).json("No File");
  }

  let nameFile = medias[0].filename;

  if (medias[0].filename.split(".").length === 1) {
    nameFile = medias[0].filename + "." + medias[0].mimetype.split("/")[1];
  }

  try {
    const img = await UploadImgFlowBuilderService({
      userId,
      name: nameFile,
      companyId
    });
    if (isFlowBuilderDebugEnabled()) {
      logger.info({ nameFile }, "[FlowBuilder][debug] FlowUploadImg sucesso");
    }
    if (medias[0].size > 0) {
      void incrementCompanyStorageUsage(companyId, medias[0].size);
    }
    return res.status(200).json(img);
  } catch (err) {
    logger.error({ err }, "[FlowUploadImg] erro");
    return res.status(500).json({ error: "upload_failed" });
  }
};

export const FlowUploadAudio = async (req: Request, res: Response) => {
  const medias = (req.files as Express.Multer.File[]) || [];
  const { companyId } = req.user;
  const userId = parseInt(req.user.id);

  if (isFlowBuilderDebugEnabled()) {
    logger.info(
      { filesCount: medias.length, companyId },
      "[FlowBuilder][debug] FlowUploadAudio início"
    );
  }

  if (medias.length === 0) {
    if (isFlowBuilderDebugEnabled()) {
      logger.info("[FlowBuilder][debug] FlowUploadAudio rejeitado: sem arquivos");
    }
    return res.status(400).json("No File");
  }

  let nameFile = medias[0].filename;

  if (medias[0].filename.split(".").length === 1) {
    nameFile = medias[0].filename + "." + medias[0].mimetype.split("/")[1];
  }

  try {
    const audio = await UploadAudioFlowBuilderService({
      userId,
      name: nameFile,
      companyId
    });
    if (isFlowBuilderDebugEnabled()) {
      logger.info({ nameFile }, "[FlowBuilder][debug] FlowUploadAudio sucesso");
    }
    if (medias[0].size > 0) {
      void incrementCompanyStorageUsage(companyId, medias[0].size);
    }
    return res.status(200).json(audio);
  } catch (err) {
    logger.error({ err }, "[FlowUploadAudio] erro");
    return res.status(500).json({ error: "upload_failed" });
  }
};

export const FlowDuplicate = async (req: Request, res: Response) => {
  const { flowId } = req.body;

  const newFlow = await DuplicateFlowBuilderService({ id: flowId });

  return res.status(200).json(newFlow);
};


export const FlowUploadAll = async (req: Request, res: Response) => {
  const medias = (req.files as Express.Multer.File[]) || [];
  const { companyId } = req.user;
  const userId = parseInt(req.user.id);

  if (isFlowBuilderDebugEnabled()) {
    logger.info(
      { filesCount: medias.length, companyId, userId },
      "[FlowBuilder][debug] FlowUploadAll início"
    );
  }

  if (medias.length === 0) {
    if (isFlowBuilderDebugEnabled()) {
      logger.info(
        "[FlowBuilder][debug] FlowUploadAll rejeitado: sem arquivos (field medias vazio?)"
      );
    }
    return res.status(400).json("No File");
  }

  try {
    const items = await UploadAllFlowBuilderService({
      userId,
      medias,
      companyId
    });
    if (isFlowBuilderDebugEnabled()) {
      logger.info(
        {
          itemsCount: Array.isArray(items) ? items.length : 0,
          items
        },
        "[FlowBuilder][debug] FlowUploadAll sucesso"
      );
    }
    for (const m of medias) {
      if (m.size > 0) {
        void incrementCompanyStorageUsage(companyId, m.size);
      }
    }
    return res.status(200).json(items);
  } catch (err) {
    logger.error({ err }, "[FlowUploadAll] erro");
    return res.status(500).json({ error: "upload_failed" });
  }
};
