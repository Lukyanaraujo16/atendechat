import React, { useState } from "react";
import {
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import { searchKnowledgeChunks } from "../../services/knowledgeBaseApi";
import {
  KNOWLEDGE_DOCUMENT_TYPES,
  KNOWLEDGE_LANGUAGES,
} from "../../config/knowledgeBaseFeature";

const useStyles = makeStyles((theme) => ({
  panel: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
  },
  result: {
    padding: theme.spacing(1.5),
    marginTop: theme.spacing(1),
    background: theme.palette.action.hover,
    borderRadius: theme.shape.borderRadius,
  },
  disclaimer: {
    marginBottom: theme.spacing(1.5),
    padding: theme.spacing(1),
    background: theme.palette.warning.light,
    borderRadius: theme.shape.borderRadius,
  },
}));

export default function KnowledgeSemanticSearchPanel({ bases = [], onOpenDocument }) {
  const classes = useStyles();
  const [query, setQuery] = useState("");
  const [baseId, setBaseId] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [language, setLanguage] = useState("");
  const [limit, setLimit] = useState(8);
  const [minimumScore, setMinimumScore] = useState("");
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error(i18n.t("knowledgeBase.toasts.queryRequired"));
      return;
    }
    if (!baseId) {
      toast.error(i18n.t("knowledgeBase.toasts.baseRequired"));
      return;
    }
    setBusy(true);
    try {
      const res = await searchKnowledgeChunks(baseId, {
        query: query.trim(),
        knowledgeBaseIds: [Number(baseId)],
        documentTypes: documentType ? [documentType] : undefined,
        languages: language ? [language] : undefined,
        limit: Number(limit) || 8,
        minimumScore:
          minimumScore === "" ? undefined : Number(minimumScore),
      });
      setResults(res.data?.results || []);
      setMeta(res.data?.meta || null);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper className={classes.panel} variant="outlined">
      <Typography variant="h6" gutterBottom>
        {i18n.t("knowledgeBase.searchTest.title")}
      </Typography>
      <div className={classes.disclaimer}>
        <Typography variant="body2">
          {i18n.t("knowledgeBase.searchTest.disclaimer")}
        </Typography>
      </div>
      <Grid container spacing={1}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            label={i18n.t("knowledgeBase.searchTest.query")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth size="small" variant="outlined">
            <InputLabel>{i18n.t("knowledgeBase.searchTest.base")}</InputLabel>
            <Select
              value={baseId}
              label={i18n.t("knowledgeBase.searchTest.base")}
              onChange={(e) => setBaseId(e.target.value)}
            >
              {bases.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6} sm={2}>
          <FormControl fullWidth size="small" variant="outlined">
            <InputLabel>{i18n.t("knowledgeBase.fields.documentType")}</InputLabel>
            <Select
              value={documentType}
              label={i18n.t("knowledgeBase.fields.documentType")}
              onChange={(e) => setDocumentType(e.target.value)}
            >
              <MenuItem value="">{i18n.t("knowledgeBase.common.all")}</MenuItem>
              {KNOWLEDGE_DOCUMENT_TYPES.map((t) => (
                <MenuItem key={t} value={t}>
                  {i18n.t(`knowledgeBase.documentTypes.${t}`, t)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6} sm={2}>
          <FormControl fullWidth size="small" variant="outlined">
            <InputLabel>{i18n.t("knowledgeBase.fields.language")}</InputLabel>
            <Select
              value={language}
              label={i18n.t("knowledgeBase.fields.language")}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <MenuItem value="">{i18n.t("knowledgeBase.common.all")}</MenuItem>
              {KNOWLEDGE_LANGUAGES.map((l) => (
                <MenuItem key={l} value={l}>
                  {l}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6} sm={2}>
          <TextField
            fullWidth
            size="small"
            variant="outlined"
            type="number"
            label={i18n.t("knowledgeBase.searchTest.limit")}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </Grid>
        <Grid item xs={6} sm={2}>
          <TextField
            fullWidth
            size="small"
            variant="outlined"
            type="number"
            inputProps={{ step: 0.05, min: 0, max: 1 }}
            label={i18n.t("knowledgeBase.searchTest.minScore")}
            value={minimumScore}
            onChange={(e) => setMinimumScore(e.target.value)}
          />
        </Grid>
        <Grid item xs={12}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSearch}
            disabled={busy}
          >
            {i18n.t("knowledgeBase.buttons.search")}
          </Button>
        </Grid>
      </Grid>
      {meta ? (
        <Typography variant="caption" color="textSecondary" display="block" style={{ marginTop: 8 }}>
          {meta.provider}/{meta.model} · {meta.dimensions}d · {meta.vectorStore}
        </Typography>
      ) : null}
      {results.map((r) => (
        <div key={r.chunkId} className={classes.result}>
          <Typography variant="subtitle2">
            {(r.similarityScore * 100).toFixed(1)}% · {r.documentTitle} ·{" "}
            {r.knowledgeBaseName}
          </Typography>
          <Typography variant="caption" color="textSecondary" display="block">
            {r.documentType} · {r.sectionTitle || "—"} · {r.sourceType}
          </Typography>
          <Typography variant="body2" style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>
            {r.chunkContent}
          </Typography>
          {onOpenDocument ? (
            <Button
              size="small"
              style={{ marginTop: 4 }}
              onClick={() =>
                onOpenDocument({
                  baseId: r.knowledgeBaseId,
                  documentId: r.documentId,
                })
              }
            >
              {i18n.t("knowledgeBase.buttons.openDocument")}
            </Button>
          ) : null}
        </div>
      ))}
    </Paper>
  );
}
