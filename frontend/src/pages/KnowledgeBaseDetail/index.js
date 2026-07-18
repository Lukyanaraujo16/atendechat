import React, { useCallback, useEffect, useState } from "react";
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import {
  ArrowBack,
  CloudUpload,
  DeleteOutline,
  Edit,
  FileCopy,
  Language,
  NoteAdd,
  Refresh,
  Visibility,
} from "@material-ui/icons";
import { toast } from "react-toastify";
import { useHistory, useParams } from "react-router-dom";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ConfirmationModal from "../../components/ConfirmationModal";
import { AppEmptyState } from "../../ui";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import {
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  duplicateKnowledgeDocument,
  getKnowledgeBase,
  getKnowledgeDocument,
  listKnowledgeDocumentProcessings,
  listKnowledgeDocuments,
  reprocessKnowledgeDocument,
  updateKnowledgeDocument,
  uploadKnowledgeDocument,
  indexKnowledgeDocument,
  reindexKnowledgeDocument,
} from "../../services/knowledgeBaseApi";
import {
  KNOWLEDGE_BASE_ROUTE_PATH,
  KNOWLEDGE_DOCUMENT_STATUSES,
  KNOWLEDGE_DOCUMENT_TYPES,
  KNOWLEDGE_LANGUAGES,
  KNOWLEDGE_PROCESSING_STATUSES,
  KNOWLEDGE_INDEX_STATUSES,
} from "../../config/knowledgeBaseFeature";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  filterBar: {
    marginBottom: theme.spacing(2),
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    alignItems: "center",
  },
  actionIcon: {
    opacity: 0.55,
    "&:hover": { opacity: 1 },
  },
  previewBlock: {
    whiteSpace: "pre-wrap",
    fontFamily: "monospace",
    fontSize: 13,
    maxHeight: 320,
    overflow: "auto",
    background: theme.palette.action.hover,
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
  },
}));

function DocumentFormDialog({
  open,
  onClose,
  baseId,
  initial,
  mode = "manual",
  onSaved,
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [documentType, setDocumentType] = useState("general");
  const [status, setStatus] = useState("draft");
  const [language, setLanguage] = useState("pt-BR");
  const [contentMarkdown, setContentMarkdown] = useState("");
  const [contentText, setContentText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title || "");
    setDescription(initial?.description || "");
    setDocumentType(initial?.documentType || "general");
    setStatus(initial?.status || (mode === "upload" ? "ready" : "draft"));
    setLanguage(initial?.language || "pt-BR");
    setContentMarkdown(initial?.contentMarkdown || "");
    setContentText(initial?.contentText || "");
    setSourceUrl(initial?.sourceUrl || "");
    setFile(null);
  }, [open, initial, mode]);

  const handleSave = async () => {
    if (!title.trim() && mode !== "upload") {
      toast.error(i18n.t("knowledgeBase.toasts.titleRequired"));
      return;
    }
    if (mode === "website" && !sourceUrl.trim()) {
      toast.error(i18n.t("knowledgeBase.toasts.urlRequired"));
      return;
    }
    if (mode === "upload" && !initial?.id && !file) {
      toast.error(i18n.t("knowledgeBase.toasts.fileRequired"));
      return;
    }
    setSaving(true);
    try {
      if (mode === "upload" && !initial?.id) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", title.trim() || file.name);
        formData.append("description", description.trim());
        formData.append("documentType", documentType);
        formData.append("status", status);
        formData.append("language", language);
        await uploadKnowledgeDocument(baseId, formData);
        toast.success(i18n.t("knowledgeBase.toasts.documentCreated"));
      } else if (initial?.id) {
        await updateKnowledgeDocument(baseId, initial.id, {
          title: title.trim(),
          description: description.trim() || null,
          documentType,
          status,
          language,
          contentMarkdown: contentMarkdown || null,
          contentText: contentText || null,
          sourceUrl: sourceUrl.trim() || null,
        });
        toast.success(i18n.t("knowledgeBase.toasts.documentUpdated"));
      } else {
        await createKnowledgeDocument(baseId, {
          title: title.trim(),
          description: description.trim() || null,
          documentType,
          sourceType: mode === "website" ? "website" : "manual",
          status,
          language,
          contentMarkdown: contentMarkdown || null,
          contentText: contentText || null,
          sourceUrl: sourceUrl.trim() || null,
        });
        toast.success(i18n.t("knowledgeBase.toasts.documentCreated"));
      }
      onSaved();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const dialogTitle =
    mode === "website"
      ? i18n.t("knowledgeBase.modal.newWebsite")
      : mode === "upload"
        ? i18n.t("knowledgeBase.modal.upload")
        : initial?.id
          ? i18n.t("knowledgeBase.modal.editDocument")
          : i18n.t("knowledgeBase.modal.newDocument");

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{dialogTitle}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={8}>
            <TextField
              label={i18n.t("knowledgeBase.fields.title")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              margin="dense"
              variant="outlined"
              required={mode !== "upload"}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth margin="dense" variant="outlined">
              <InputLabel>{i18n.t("knowledgeBase.fields.documentType")}</InputLabel>
              <Select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                label={i18n.t("knowledgeBase.fields.documentType")}
              >
                {KNOWLEDGE_DOCUMENT_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {i18n.t(`knowledgeBase.documentTypes.${t}`, t)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              label={i18n.t("knowledgeBase.fields.description")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              margin="dense"
              variant="outlined"
              multiline
              rows={2}
            />
          </Grid>
          <Grid item xs={6} sm={4}>
            <FormControl fullWidth margin="dense" variant="outlined">
              <InputLabel>{i18n.t("knowledgeBase.fields.status")}</InputLabel>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                label={i18n.t("knowledgeBase.fields.status")}
              >
                {KNOWLEDGE_DOCUMENT_STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {i18n.t(`knowledgeBase.documentStatuses.${s}`, s)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={4}>
            <FormControl fullWidth margin="dense" variant="outlined">
              <InputLabel>{i18n.t("knowledgeBase.fields.language")}</InputLabel>
              <Select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                label={i18n.t("knowledgeBase.fields.language")}
              >
                {KNOWLEDGE_LANGUAGES.map((l) => (
                  <MenuItem key={l} value={l}>
                    {l}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          {mode === "website" || initial?.sourceType === "website" ? (
            <Grid item xs={12}>
              <TextField
                label={i18n.t("knowledgeBase.fields.sourceUrl")}
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                fullWidth
                margin="dense"
                variant="outlined"
                required
              />
            </Grid>
          ) : null}
          {mode === "upload" && !initial?.id ? (
            <Grid item xs={12}>
              <Button variant="outlined" component="label">
                {file
                  ? file.name
                  : i18n.t("knowledgeBase.buttons.chooseFile")}
                <input
                  type="file"
                  hidden
                  accept=".txt,.md,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </Button>
              <Typography variant="caption" display="block" color="textSecondary">
                {i18n.t("knowledgeBase.uploadHint")}
              </Typography>
            </Grid>
          ) : null}
          {mode === "manual" || initial?.sourceType === "manual" ? (
            <>
              <Grid item xs={12}>
                <TextField
                  label={i18n.t("knowledgeBase.fields.contentMarkdown")}
                  value={contentMarkdown}
                  onChange={(e) => setContentMarkdown(e.target.value)}
                  fullWidth
                  margin="dense"
                  variant="outlined"
                  multiline
                  rows={6}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label={i18n.t("knowledgeBase.fields.contentText")}
                  value={contentText}
                  onChange={(e) => setContentText(e.target.value)}
                  fullWidth
                  margin="dense"
                  variant="outlined"
                  multiline
                  rows={4}
                />
              </Grid>
            </>
          ) : null}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {i18n.t("knowledgeBase.buttons.cancel")}
        </Button>
        <Button
          color="primary"
          variant="contained"
          onClick={handleSave}
          disabled={saving}
        >
          {i18n.t("knowledgeBase.buttons.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function PreviewDialog({ open, onClose, document: doc, baseId, onReprocessed }) {
  const classes = useStyles();
  const [fullDoc, setFullDoc] = useState(doc);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !doc?.id || !baseId) return;
    let cancelled = false;
    (async () => {
      try {
        const [docRes, histRes] = await Promise.all([
          getKnowledgeDocument(baseId, doc.id),
          listKnowledgeDocumentProcessings(baseId, doc.id),
        ]);
        if (cancelled) return;
        setFullDoc(docRes.data);
        setHistory(histRes.data?.processings || []);
      } catch (err) {
        if (!cancelled) toastError(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, doc?.id, baseId]);

  if (!doc) return null;
  const view = fullDoc || doc;

  const handleReprocess = async () => {
    setBusy(true);
    try {
      await reprocessKnowledgeDocument(baseId, doc.id);
      toast.success(i18n.t("knowledgeBase.toasts.reprocessQueued"));
      const [docRes, histRes] = await Promise.all([
        getKnowledgeDocument(baseId, doc.id),
        listKnowledgeDocumentProcessings(baseId, doc.id),
      ]);
      setFullDoc(docRes.data);
      setHistory(histRes.data?.processings || []);
      if (onReprocessed) onReprocessed();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{i18n.t("knowledgeBase.preview.title")}</DialogTitle>
      <DialogContent>
        <Typography variant="h6">{view.title}</Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {view.description || "—"}
        </Typography>
        <Typography variant="body2">
          {i18n.t("knowledgeBase.fields.documentType")}:{" "}
          {i18n.t(
            `knowledgeBase.documentTypes.${view.documentType}`,
            view.documentType
          )}
        </Typography>
        <Typography variant="body2">
          {i18n.t("knowledgeBase.fields.sourceType")}:{" "}
          {i18n.t(
            `knowledgeBase.sourceTypes.${view.sourceType}`,
            view.sourceType
          )}
        </Typography>
        <Typography variant="body2">
          {i18n.t("knowledgeBase.fields.language")}: {view.language || "—"}
        </Typography>
        <Typography variant="body2">
          {i18n.t("knowledgeBase.fields.processingStatus")}:{" "}
          {i18n.t(
            `knowledgeBase.processingStatuses.${view.processingStatus}`,
            view.processingStatus || "—"
          )}
        </Typography>
        <Typography variant="body2">
          {i18n.t("knowledgeBase.fields.indexStatus")}:{" "}
          {i18n.t(
            `knowledgeBase.indexStatuses.${view.indexStatus}`,
            view.indexStatus || "—"
          )}
        </Typography>
        <Typography variant="body2">
          {i18n.t("knowledgeBase.fields.chunkCount")}: {view.chunkCount ?? 0}
        </Typography>
        <Typography variant="body2">
          {i18n.t("knowledgeBase.fields.processor")}:{" "}
          {view.lastProcessor || "—"}
        </Typography>
        <Typography variant="body2">
          {i18n.t("knowledgeBase.fields.lastProcessedAt")}:{" "}
          {view.lastProcessedAt
            ? new Date(view.lastProcessedAt).toLocaleString()
            : "—"}
        </Typography>
        <Typography variant="body2">
          {i18n.t("knowledgeBase.fields.lastIndexedAt")}:{" "}
          {view.lastIndexedAt
            ? new Date(view.lastIndexedAt).toLocaleString()
            : "—"}
        </Typography>
        <Typography variant="body2">
          Embedding: {view.lastEmbeddingProvider || "—"} /{" "}
          {view.lastEmbeddingModel || "—"} ({view.lastEmbeddingDimensions || "—"}d)
        </Typography>
        <Typography variant="body2">
          {i18n.t("knowledgeBase.fields.durationMs")}:{" "}
          {view.lastProcessingDurationMs ?? "—"}
        </Typography>
        <Typography variant="body2">
          {i18n.t("knowledgeBase.fields.characterCount")}:{" "}
          {view.characterCount ?? 0}
        </Typography>
        {view.lastProcessingError ? (
          <Typography variant="body2" color="error" gutterBottom>
            {i18n.t("knowledgeBase.fields.lastError")}:{" "}
            {view.lastProcessingError}
          </Typography>
        ) : null}
        {view.sourceType === "upload" ? (
          <Typography variant="body2" gutterBottom>
            {i18n.t("knowledgeBase.fields.fileName")}: {view.fileName || "—"}
            <br />
            MIME: {view.mimeType || "—"}
            <br />
            {i18n.t("knowledgeBase.fields.fileSize")}: {view.fileSize ?? "—"}
            <br />
            Checksum: {view.checksum || "—"}
          </Typography>
        ) : null}
        {view.sourceType === "website" ? (
          <Typography variant="body2" gutterBottom>
            URL: {view.sourceUrl || "—"}
          </Typography>
        ) : null}
        <Typography variant="subtitle2" style={{ marginTop: 12 }}>
          {i18n.t("knowledgeBase.fields.extractedText")}
        </Typography>
        <div className={classes.previewBlock}>
          {view.contentText ||
            view.contentMarkdown ||
            i18n.t("knowledgeBase.preview.noExtractedText")}
        </div>
        {history.length > 0 ? (
          <>
            <Typography variant="subtitle2" style={{ marginTop: 16 }}>
              {i18n.t("knowledgeBase.preview.history")}
            </Typography>
            {history.slice(0, 5).map((item) => (
              <Typography key={item.id} variant="caption" display="block">
                #{item.id} · {item.processor} · {item.status}
                {item.durationMs != null ? ` · ${item.durationMs}ms` : ""}
                {item.errorMessage ? ` · ${item.errorMessage}` : ""}
              </Typography>
            ))}
          </>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          color="primary"
          startIcon={<Refresh />}
          disabled={busy}
          onClick={handleReprocess}
        >
          {i18n.t("knowledgeBase.buttons.reprocess")}
        </Button>
        <Button
          color="primary"
          disabled={busy || view.processingStatus !== "completed"}
          onClick={async () => {
            setBusy(true);
            try {
              await reindexKnowledgeDocument(baseId, doc.id);
              toast.success(i18n.t("knowledgeBase.toasts.reindexQueued"));
              const docRes = await getKnowledgeDocument(baseId, doc.id);
              setFullDoc(docRes.data);
              if (onReprocessed) onReprocessed();
            } catch (err) {
              toastError(err);
            } finally {
              setBusy(false);
            }
          }}
        >
          {i18n.t("knowledgeBase.buttons.reindex")}
        </Button>
        <Button onClick={onClose}>{i18n.t("knowledgeBase.buttons.close")}</Button>
      </DialogActions>
    </Dialog>
  );
}

const KnowledgeBaseDetail = () => {
  const classes = useStyles();
  const history = useHistory();
  const { baseId } = useParams();
  const [loading, setLoading] = useState(true);
  const [base, setBase] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [status, setStatus] = useState("");
  const [processingStatus, setProcessingStatus] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("manual");
  const [editing, setEditing] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [baseRes, docsRes] = await Promise.all([
        getKnowledgeBase(baseId),
        listKnowledgeDocuments(baseId, {
          search: search.trim() || undefined,
          documentType: documentType || undefined,
          sourceType: sourceType || undefined,
          status: status || undefined,
          processingStatus: processingStatus || undefined,
        }),
      ]);
      setBase(baseRes.data);
      setDocuments(docsRes.data?.documents || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [baseId, search, documentType, sourceType, status, processingStatus]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const openCreate = (mode) => {
    setEditing(null);
    setFormMode(mode);
    setFormOpen(true);
  };

  const handleDuplicate = async (doc) => {
    try {
      await duplicateKnowledgeDocument(baseId, doc.id);
      toast.success(i18n.t("knowledgeBase.toasts.documentDuplicated"));
      load();
    } catch (err) {
      toastError(err);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete?.id) return;
    try {
      await deleteKnowledgeDocument(baseId, confirmDelete.id);
      toast.success(i18n.t("knowledgeBase.toasts.documentDeleted"));
      setConfirmDelete(null);
      load();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <MainHeader>
        <div>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => history.push(KNOWLEDGE_BASE_ROUTE_PATH)}
            size="small"
          >
            {i18n.t("knowledgeBase.buttons.back")}
          </Button>
          <Title>
            {base?.name || i18n.t("knowledgeBase.detailTitle")}
          </Title>
        </div>
        <MainHeaderButtonsWrapper>
          <Button
            variant="outlined"
            startIcon={<NoteAdd />}
            onClick={() => openCreate("manual")}
          >
            {i18n.t("knowledgeBase.buttons.newDocument")}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Language />}
            onClick={() => openCreate("website")}
          >
            {i18n.t("knowledgeBase.buttons.newWebsite")}
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<CloudUpload />}
            onClick={() => openCreate("upload")}
          >
            {i18n.t("knowledgeBase.buttons.upload")}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        <div className={classes.filterBar}>
          <TextField
            size="small"
            variant="outlined"
            placeholder={i18n.t("knowledgeBase.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 200 }}
          />
          <FormControl size="small" variant="outlined" style={{ minWidth: 140 }}>
            <InputLabel>{i18n.t("knowledgeBase.fields.documentType")}</InputLabel>
            <Select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              label={i18n.t("knowledgeBase.fields.documentType")}
            >
              <MenuItem value="">{i18n.t("knowledgeBase.common.all")}</MenuItem>
              {KNOWLEDGE_DOCUMENT_TYPES.map((t) => (
                <MenuItem key={t} value={t}>
                  {i18n.t(`knowledgeBase.documentTypes.${t}`, t)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" variant="outlined" style={{ minWidth: 120 }}>
            <InputLabel>{i18n.t("knowledgeBase.fields.sourceType")}</InputLabel>
            <Select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              label={i18n.t("knowledgeBase.fields.sourceType")}
            >
              <MenuItem value="">{i18n.t("knowledgeBase.common.all")}</MenuItem>
              <MenuItem value="manual">
                {i18n.t("knowledgeBase.sourceTypes.manual")}
              </MenuItem>
              <MenuItem value="upload">
                {i18n.t("knowledgeBase.sourceTypes.upload")}
              </MenuItem>
              <MenuItem value="website">
                {i18n.t("knowledgeBase.sourceTypes.website")}
              </MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" variant="outlined" style={{ minWidth: 120 }}>
            <InputLabel>{i18n.t("knowledgeBase.fields.status")}</InputLabel>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              label={i18n.t("knowledgeBase.fields.status")}
            >
              <MenuItem value="">{i18n.t("knowledgeBase.common.all")}</MenuItem>
              {KNOWLEDGE_DOCUMENT_STATUSES.map((s) => (
                <MenuItem key={s} value={s}>
                  {i18n.t(`knowledgeBase.documentStatuses.${s}`, s)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" variant="outlined" style={{ minWidth: 140 }}>
            <InputLabel>
              {i18n.t("knowledgeBase.fields.processingStatus")}
            </InputLabel>
            <Select
              value={processingStatus}
              onChange={(e) => setProcessingStatus(e.target.value)}
              label={i18n.t("knowledgeBase.fields.processingStatus")}
            >
              <MenuItem value="">{i18n.t("knowledgeBase.common.all")}</MenuItem>
              {KNOWLEDGE_PROCESSING_STATUSES.map((s) => (
                <MenuItem key={s} value={s}>
                  {i18n.t(`knowledgeBase.processingStatuses.${s}`, s)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>

        {loading ? (
          <TableRowSkeleton columns={7} />
        ) : documents.length === 0 ? (
          <AppEmptyState
            title={i18n.t("knowledgeBase.emptyDocumentsTitle")}
            description={i18n.t("knowledgeBase.emptyDocumentsDescription")}
          />
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{i18n.t("knowledgeBase.fields.title")}</TableCell>
                <TableCell>{i18n.t("knowledgeBase.fields.documentType")}</TableCell>
                <TableCell>{i18n.t("knowledgeBase.fields.sourceType")}</TableCell>
                <TableCell>
                  {i18n.t("knowledgeBase.fields.processingStatus")}
                </TableCell>
                <TableCell>
                  {i18n.t("knowledgeBase.fields.indexStatus")}
                </TableCell>
                <TableCell>{i18n.t("knowledgeBase.fields.language")}</TableCell>
                <TableCell align="right">
                  {i18n.t("knowledgeBase.fields.actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id} hover>
                  <TableCell>
                    <Typography variant="body2" style={{ fontWeight: 600 }}>
                      {doc.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {i18n.t(
                      `knowledgeBase.documentTypes.${doc.documentType}`,
                      doc.documentType
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={i18n.t(
                        `knowledgeBase.sourceTypes.${doc.sourceType}`,
                        doc.sourceType
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={
                        doc.processingStatus === "failed"
                          ? "secondary"
                          : doc.processingStatus === "completed"
                            ? "primary"
                            : "default"
                      }
                      label={i18n.t(
                        `knowledgeBase.processingStatuses.${doc.processingStatus}`,
                        doc.processingStatus || "—"
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={i18n.t(
                        `knowledgeBase.indexStatuses.${doc.indexStatus}`,
                        doc.indexStatus || "—"
                      )}
                    />
                  </TableCell>
                  <TableCell>{doc.language || "—"}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      className={classes.actionIcon}
                      onClick={() => setPreviewDoc(doc)}
                    >
                      <Visibility fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      className={classes.actionIcon}
                      title={i18n.t("knowledgeBase.buttons.index")}
                      disabled={doc.processingStatus !== "completed"}
                      onClick={async () => {
                        try {
                          await indexKnowledgeDocument(baseId, doc.id);
                          toast.success(
                            i18n.t("knowledgeBase.toasts.indexQueued")
                          );
                          load();
                        } catch (err) {
                          toastError(err);
                        }
                      }}
                    >
                      <CloudUpload fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      className={classes.actionIcon}
                      title={i18n.t("knowledgeBase.buttons.reprocess")}
                      onClick={async () => {
                        try {
                          await reprocessKnowledgeDocument(baseId, doc.id);
                          toast.success(
                            i18n.t("knowledgeBase.toasts.reprocessQueued")
                          );
                          load();
                        } catch (err) {
                          toastError(err);
                        }
                      }}
                    >
                      <Refresh fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      className={classes.actionIcon}
                      onClick={() => {
                        setEditing(doc);
                        setFormMode(
                          doc.sourceType === "website"
                            ? "website"
                            : doc.sourceType === "upload"
                              ? "upload"
                              : "manual"
                        );
                        setFormOpen(true);
                      }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      className={classes.actionIcon}
                      onClick={() => handleDuplicate(doc)}
                    >
                      <FileCopy fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      className={classes.actionIcon}
                      onClick={() => setConfirmDelete(doc)}
                    >
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <DocumentFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        baseId={baseId}
        initial={editing}
        mode={formMode}
        onSaved={load}
      />
      <PreviewDialog
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
        baseId={baseId}
        onReprocessed={load}
      />
      <ConfirmationModal
        title={i18n.t("knowledgeBase.confirmDeleteDocumentTitle")}
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      >
        {i18n.t("knowledgeBase.confirmDeleteDocumentMessage")}
      </ConfirmationModal>
    </MainContainer>
  );
};

export default KnowledgeBaseDetail;
