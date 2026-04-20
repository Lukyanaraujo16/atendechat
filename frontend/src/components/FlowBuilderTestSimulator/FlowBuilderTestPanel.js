import React, { useRef, useEffect, useCallback, useState } from "react";
import {
  Drawer,
  Box,
  Typography,
  TextField,
  IconButton,
  Fab,
  Chip,
  Stack,
  Button,
  Divider,
  Paper,
  Alert,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { i18n } from "../../translate/i18n";
import {
  runSimulationStep,
  firstNodeAfterStart,
  pickNextNode,
  findStartNodeId,
} from "./flowSimulator";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function SimulationChatRow({ row, t, theme }) {
  if (row.kind === "simulated_action") {
    const actionKey = row.action || "generic";
    const detail = row.detail ? String(row.detail) : "";
    const title =
      actionKey === "http"
        ? t("actionHttp")
        : actionKey === "openai"
          ? t("actionOpenai")
          : actionKey === "typebot"
            ? t("actionTypebot")
            : actionKey === "admin"
              ? t("actionAdmin", { type: detail || "—" })
              : t("actionGeneric", { type: detail || "—" });
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          mb: 1.5,
          px: 0.5,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            maxWidth: "94%",
            px: 1.75,
            py: 1.25,
            borderRadius: 2,
            border: "1px dashed",
            borderColor: alpha(theme.palette.info.main, 0.45),
            bgcolor: alpha(theme.palette.info.main, 0.06),
          }}
        >
          <Typography
            variant="caption"
            sx={{
              display: "block",
              fontWeight: 700,
              letterSpacing: 0.4,
              color: "info.main",
              textTransform: "uppercase",
              fontSize: "0.65rem",
            }}
          >
            {t("simulatedActionBadge")}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
            {title}
            {actionKey === "http" && detail ? ` · ${detail}` : ""}
            {actionKey === "typebot" && detail ? ` · ${detail}` : ""}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
            {t("notExecutedPreview")}
          </Typography>
        </Paper>
      </Box>
    );
  }

  if (row.kind === "condition_hint" && row.manualReason) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mb: 1.25, px: 0.5 }}>
        <Alert
          severity="info"
          variant="outlined"
          icon={false}
          sx={{
            py: 0.75,
            px: 1.5,
            maxWidth: "94%",
            width: "100%",
            "& .MuiAlert-message": { width: "100%" },
          }}
        >
          <Typography variant="caption" component="div" sx={{ fontWeight: 600, mb: 0.25 }}>
            {t("conditionManualTitle")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(`conditionManual.${row.manualReason}`)}
          </Typography>
        </Alert>
      </Box>
    );
  }

  if (row.kind === "hint" && row.hintKey) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mb: 1.25 }}>
        <Chip
          size="small"
          label={t(row.hintKey)}
          sx={{ fontStyle: "italic", opacity: 0.95 }}
          variant="outlined"
        />
      </Box>
    );
  }

  const isUser = row.from === "user";
  const isSystem = row.from === "system" && !row.kind;
  if (isSystem) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.85 }}>
          {row.text}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        mb: 1.35,
      }}
    >
      <Box
        sx={{
          maxWidth: "88%",
          px: 1.5,
          py: 1,
          borderRadius: 2,
          bgcolor: isUser
            ? alpha(theme.palette.success.main, 0.18)
            : theme.palette.background.paper,
          boxShadow: "0 1px 2px rgba(0,0,0,0.07)",
          border: isUser ? "none" : `1px solid ${alpha(theme.palette.divider, 0.9)}`,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: "0.9rem",
          }}
        >
          {row.text}
        </Typography>
      </Box>
    </Box>
  );
}

export default function FlowBuilderTestPanel({
  open,
  onClose,
  nodes,
  edges,
  flowName,
}) {
  const theme = useTheme();
  const [lines, setLines] = useState([]);
  const [input, setInput] = useState("");
  const [wait, setWait] = useState(null);
  const [stepInfo, setStepInfo] = useState(null);
  const [ctx, setCtx] = useState({
    lastUserMessage: "",
    messageCount: 0,
    mockContactName: "Teste",
    mockNumber: "5511999999999",
    mockEmail: "",
  });
  const scrollRef = useRef(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const t = useCallback((key, opts) => i18n.t(`flowBuilderSimulator.${key}`, opts), []);

  const appendBotLines = useCallback((arr) => {
    if (!arr || !arr.length) return;
    setLines((prev) => [
      ...prev,
      ...arr.map((m) => ({
        id: uid(),
        ...m,
      })),
    ]);
  }, []);

  const resetAndStart = useCallback(() => {
    setLines([]);
    setInput("");
    setWait(null);
    setStepInfo(null);
    const c0 = {
      lastUserMessage: "",
      messageCount: 0,
      mockContactName: "Teste",
      mockNumber: "5511999999999",
      mockEmail: "",
    };
    setCtx(c0);

    const n = nodesRef.current;
    const e = edgesRef.current;

    if (!findStartNodeId(n)) {
      setLines([{ id: uid(), from: "bot", text: t("noStart") }]);
      return;
    }
    const first = firstNodeAfterStart(n, e);
    if (!first) {
      setLines([{ id: uid(), from: "bot", text: t("noEdgeFromStart") }]);
      return;
    }
    const result = runSimulationStep(n, e, first, c0);
    setLines((result.messages || []).map((m) => ({ id: uid(), ...m })));
    setWait(
      result.wait ? { kind: result.wait, payload: result.payload } : null
    );
    setStepInfo(result.stepInfo || null);
  }, [t]);

  useEffect(() => {
    if (open) {
      resetAndStart();
    }
  }, [open, resetAndStart]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, open]);

  const applyStepFromResult = (result) => {
    if (result != null) {
      setStepInfo(result.stepInfo ?? null);
    }
  };

  const handleSend = () => {
    const trimmed = String(input || "").trim();
    if (!trimmed) return;
    setInput("");

    if (wait?.kind === "menu" && wait.payload?.menuNodeId) {
      const opts = Array.isArray(wait.payload.options) ? wait.payload.options : [];
      const validSet = new Set(opts.map((o) => String(o.number)));
      let matched = validSet.has(trimmed) ? trimmed : null;
      if (!matched) {
        const m = trimmed.match(/\d+/);
        if (m && validSet.has(m[0])) matched = m[0];
      }
      if (matched) {
        handleMenuPick(matched);
        return;
      }

      setLines((prev) => [...prev, { id: uid(), from: "user", text: trimmed }]);
      const menuNodeId = wait.payload.menuNodeId;
      const nextCtx = {
        ...ctx,
        lastUserMessage: trimmed,
        messageCount: ctx.messageCount + 1,
      };
      setCtx(nextCtx);
      setWait(null);
      const nextId = pickNextNode(edgesRef.current, menuNodeId, "invalid");
      if (nextId) {
        const result = runSimulationStep(
          nodesRef.current,
          edgesRef.current,
          nextId,
          nextCtx
        );
        appendBotLines(result.messages);
        applyStepFromResult(result);
        if (result.wait) {
          setWait({ kind: result.wait, payload: result.payload });
        }
      } else {
        appendBotLines([{ from: "bot", text: t("ended") }]);
        setStepInfo(null);
      }
      return;
    }

    setLines((prev) => [...prev, { id: uid(), from: "user", text: trimmed }]);

    const nextCtx = {
      ...ctx,
      lastUserMessage: trimmed,
      messageCount: ctx.messageCount + 1,
    };
    setCtx(nextCtx);

    if (wait?.kind === "text" && wait.payload?.afterTextNodeId) {
      const nextId = pickNextNode(
        edgesRef.current,
        wait.payload.afterTextNodeId,
        "a"
      );
      setWait(null);
      if (nextId) {
        const result = runSimulationStep(
          nodesRef.current,
          edgesRef.current,
          nextId,
          nextCtx
        );
        appendBotLines(result.messages);
        applyStepFromResult(result);
        if (result.wait) {
          setWait({ kind: result.wait, payload: result.payload });
        }
      } else {
        appendBotLines([{ from: "bot", text: t("ended") }]);
        setStepInfo(null);
      }
      return;
    }

    if (!wait) {
      appendBotLines([{ from: "bot", text: t("noWaitHint") }]);
    }
  };

  const handleMenuPick = (optionNumber) => {
    const num = Number(optionNumber);
    const label = String(num);
    setLines((prev) => [...prev, { id: uid(), from: "user", text: label }]);

    if (!wait || wait.kind !== "menu" || !wait.payload) return;
    const { menuNodeId } = wait.payload;
    const handle = `a${num}`;
    const nextId = pickNextNode(edgesRef.current, menuNodeId, handle);

    const nextCtx = {
      ...ctx,
      lastUserMessage: label,
      messageCount: ctx.messageCount + 1,
    };
    setCtx(nextCtx);
    setWait(null);

    if (nextId) {
      const result = runSimulationStep(
        nodesRef.current,
        edgesRef.current,
        nextId,
        nextCtx
      );
      appendBotLines(result.messages);
      applyStepFromResult(result);
      if (result.wait) {
        setWait({ kind: result.wait, payload: result.payload });
      }
    } else {
      appendBotLines([{ from: "bot", text: t("ended") }]);
      setStepInfo(null);
    }
  };

  const handleConditionPick = (passed) => {
    const userLabel = passed ? t("yes") : t("no");
    setLines((prev) => [
      ...prev,
      {
        id: uid(),
        from: "user",
        text: userLabel,
      },
    ]);

    if (!wait || wait.kind !== "condition" || !wait.payload) return;
    const { conditionNodeId } = wait.payload;
    const nextId = pickNextNode(
      edgesRef.current,
      conditionNodeId,
      passed ? "true" : "false"
    );

    const nextCtx = {
      ...ctx,
      messageCount: ctx.messageCount + 1,
    };
    setCtx(nextCtx);
    setWait(null);

    if (nextId) {
      const result = runSimulationStep(
        nodesRef.current,
        edgesRef.current,
        nextId,
        nextCtx
      );
      appendBotLines(result.messages);
      applyStepFromResult(result);
      if (result.wait) {
        setWait({ kind: result.wait, payload: result.payload });
      }
    } else {
      appendBotLines([{ from: "bot", text: t("ended") }]);
      setStepInfo(null);
    }
  };

  const stepTypeLabel = stepInfo?.nodeType
    ? i18n.exists(`flowBuilderSimulator.nodeType.${stepInfo.nodeType}`)
      ? t(`nodeType.${stepInfo.nodeType}`)
      : stepInfo.nodeType
    : null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        zIndex: (theme) => theme.zIndex.modal,
      }}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 440 },
          maxWidth: "100%",
          display: "flex",
          flexDirection: "column",
          top: 50,
          height: "calc(100vh - 50px)",
        },
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "flex-start",
          gap: 1.5,
          bgcolor: "primary.main",
          color: "primary.contrastText",
        }}
      >
        <SmartToyIcon sx={{ fontSize: 30, mt: 0.25 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap>
            {t("title")}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.95, fontWeight: 500 }} noWrap title={flowName || ""}>
            {flowName || "—"}
          </Typography>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" sx={{ mt: 0.75 }}>
            <Chip
              size="small"
              label={t("badgeSimulation")}
              sx={{
                height: 22,
                fontSize: "0.7rem",
                fontWeight: 600,
                bgcolor: alpha(theme.palette.common.white, 0.2),
                color: "inherit",
              }}
            />
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              {t("subtitle")}
            </Typography>
          </Stack>
        </Box>
        <Stack direction="row" spacing={0.5} alignItems="center" flexShrink={0}>
          <Button
            variant="contained"
            size="small"
            color="inherit"
            startIcon={<RestartAltIcon />}
            onClick={resetAndStart}
            aria-label={t("restartFull")}
            sx={{
              color: "primary.main",
              bgcolor: "background.paper",
              fontWeight: 700,
              "&:hover": { bgcolor: alpha(theme.palette.common.white, 0.92) },
              whiteSpace: "nowrap",
              px: { xs: 1, sm: 1.5 },
            }}
          >
            {t("restartFull")}
          </Button>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{ color: "inherit" }}
            aria-label={t("close")}
          >
            <CloseIcon />
          </IconButton>
        </Stack>
      </Box>

      <Box
        sx={{
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: alpha(theme.palette.primary.main, 0.04),
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 0 }}>
            {stepTypeLabel ? (
              <>
                {t("currentStep")}: <strong>{stepTypeLabel}</strong>
                {stepInfo?.label && stepInfo.nodeType === "message"
                  ? ` · ${stepInfo.label}`
                  : ""}
              </>
            ) : (
              t("noStepYet")
            )}
          </Typography>
        </Stack>
      </Box>

      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflowY: "auto",
          p: 2,
          bgcolor: alpha(theme.palette.grey[500], 0.08),
          backgroundImage: `repeating-linear-gradient(0deg, ${alpha(
            theme.palette.common.black,
            0.02
          )}, ${alpha(theme.palette.common.black, 0.02)} 1px, transparent 1px, transparent 8px)`,
        }}
      >
        {lines.map((row) => (
          <SimulationChatRow key={row.id} row={row} t={t} theme={theme} />
        ))}
      </Box>

      {wait?.kind === "menu" && Array.isArray(wait.payload?.options) && (
        <Box sx={{ px: 2, pb: 1, flexWrap: "wrap", display: "flex", gap: 0.5 }}>
          {wait.payload.options.map((opt) => (
            <Chip
              key={opt.number}
              size="small"
              label={`[${opt.number}] ${opt.value || ""}`}
              onClick={() => handleMenuPick(opt.number)}
              sx={{ cursor: "pointer" }}
            />
          ))}
        </Box>
      )}

      {wait?.kind === "condition" && (
        <Stack direction="row" spacing={1} sx={{ px: 2, pb: 1 }} alignItems="center">
          <Button
            size="small"
            variant="contained"
            color="success"
            onClick={() => handleConditionPick(true)}
          >
            {t("yes")}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={() => handleConditionPick(false)}
          >
            {t("no")}
          </Button>
        </Stack>
      )}

      <Divider />

      <Box sx={{ p: 2, display: "flex", gap: 1, alignItems: "flex-end" }}>
        <TextField
          fullWidth
          size="small"
          multiline
          maxRows={3}
          placeholder={
            wait?.kind === "menu" ? t("menuPlaceholder") : t("placeholder")
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={wait?.kind === "condition"}
        />
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={wait?.kind === "condition"}
          aria-label={t("send")}
        >
          <SendIcon />
        </IconButton>
      </Box>

    </Drawer>
  );
}

export function FlowBuilderTestFab({ onClick, visible }) {
  if (!visible) return null;
  return (
    <Fab
      color="secondary"
      variant="extended"
      onClick={onClick}
      sx={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 1200,
        textTransform: "none",
        fontWeight: 600,
        boxShadow: 4,
      }}
    >
      <SmartToyIcon sx={{ mr: 1 }} />
      {i18n.t("flowBuilderSimulator.openFab")}
    </Fab>
  );
}
