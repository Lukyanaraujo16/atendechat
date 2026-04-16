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
} from "@mui/material";
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

export default function FlowBuilderTestPanel({
  open,
  onClose,
  nodes,
  edges,
  flowName,
}) {
  const [lines, setLines] = useState([]);
  const [input, setInput] = useState("");
  const [wait, setWait] = useState(null);
  const [ctx, setCtx] = useState({
    lastUserMessage: "",
    messageCount: 0,
    mockContactName: "Teste",
    mockNumber: "5511999999999",
  });
  const scrollRef = useRef(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const t = useCallback((key) => i18n.t(`flowBuilderSimulator.${key}`), []);

  const appendBotLines = useCallback((arr) => {
    if (!arr || !arr.length) return;
    setLines((prev) => [
      ...prev,
      ...arr.map((m) => ({
        id: uid(),
        from: m.from,
        text: m.text,
      })),
    ]);
  }, []);

  const resetAndStart = useCallback(() => {
    setLines([]);
    setInput("");
    setWait(null);
    const c0 = {
      lastUserMessage: "",
      messageCount: 0,
      mockContactName: "Teste",
      mockNumber: "5511999999999",
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
    setLines(
      (result.messages || []).map((m) => ({ id: uid(), ...m }))
    );
    setWait(
      result.wait ? { kind: result.wait, payload: result.payload } : null
    );
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

  const handleSend = () => {
    const trimmed = String(input || "").trim();
    if (!trimmed) return;
    setInput("");

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
        if (result.wait) {
          setWait({ kind: result.wait, payload: result.payload });
        }
      } else {
        appendBotLines([{ from: "bot", text: t("ended") }]);
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
      if (result.wait) {
        setWait({ kind: result.wait, payload: result.payload });
      }
    } else {
      appendBotLines([{ from: "bot", text: t("ended") }]);
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
      if (result.wait) {
        setWait({ kind: result.wait, payload: result.payload });
      }
    } else {
      appendBotLines([{ from: "bot", text: t("ended") }]);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 420 },
          maxWidth: "100%",
          display: "flex",
          flexDirection: "column",
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
          alignItems: "center",
          gap: 1,
          bgcolor: "primary.main",
          color: "primary.contrastText",
        }}
      >
        <SmartToyIcon sx={{ fontSize: 28 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap>
            {t("title")}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.9 }} noWrap>
            {flowName || "—"} · {t("subtitle")}
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={onClose}
          sx={{ color: "inherit" }}
          aria-label={t("close")}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflowY: "auto",
          p: 2,
          bgcolor: "#e5ddd5",
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0,0,0,.02), rgba(0,0,0,.02) 1px, transparent 1px, transparent 8px)",
        }}
      >
        {lines.map((row) => (
          <Box
            key={row.id}
            sx={{
              display: "flex",
              justifyContent: row.from === "user" ? "flex-end" : "flex-start",
              mb: 1.25,
            }}
          >
            <Box
              sx={{
                maxWidth: "88%",
                px: 1.5,
                py: 1,
                borderRadius: 2,
                bgcolor: row.from === "user" ? "#dcf8c6" : "#fff",
                boxShadow: "0 1px 1px rgba(0,0,0,0.08)",
                border:
                  row.from === "user"
                    ? "none"
                    : "1px solid rgba(0,0,0,0.06)",
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
        <Stack direction="row" spacing={1} sx={{ px: 2, pb: 1 }}>
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
          placeholder={t("placeholder")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={wait?.kind === "menu" || wait?.kind === "condition"}
        />
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={wait?.kind === "menu" || wait?.kind === "condition"}
          aria-label={t("send")}
        >
          <SendIcon />
        </IconButton>
      </Box>

      <Box sx={{ px: 2, pb: 2, display: "flex", justifyContent: "flex-start" }}>
        <Button
          startIcon={<RestartAltIcon />}
          size="small"
          onClick={resetAndStart}
        >
          {t("restart")}
        </Button>
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
