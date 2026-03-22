import React from "react";
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  ListSubheader,
} from "@mui/material";
import {
  RocketLaunch,
  LibraryBooks,
  DynamicFeed,
  CallSplit,
  AccessTime,
  Ballot as BallotIcon,
  ConfirmationNumber,
  HourglassEmpty,
} from "@mui/icons-material";
import typebotIcon from "../../assets/typebot-ico.png";
import { SiOpenai } from "react-icons/si";
import { AccountTree, Cancel, LocalOffer } from "@mui/icons-material";
import { Box } from "@mui/material";

const CATEGORIES = {
  mensagens: { label: "Mensagens", order: 0 },
  interacoes: { label: "Interações", order: 1 },
  atendimento: { label: "Atendimento", order: 2 },
  integracoes: { label: "Integrações", order: 3 },
  utilitarios: { label: "Utilitários", order: 4 },
};

const NODE_ACTIONS = [
  {
    icon: <RocketLaunch sx={{ color: "#3ABA38" }} />,
    name: "Início",
    type: "start",
    category: "mensagens",
  },
  {
    icon: <LibraryBooks sx={{ color: "#EC5858" }} />,
    name: "Conteúdo",
    type: "content",
    category: "mensagens",
  },
  {
    icon: <DynamicFeed sx={{ color: "#683AC8" }} />,
    name: "Menu",
    type: "menu",
    category: "interacoes",
  },
  {
    icon: <BallotIcon sx={{ color: "#F7953B" }} />,
    name: "Pergunta",
    type: "question",
    category: "interacoes",
  },
  {
    icon: <HourglassEmpty sx={{ color: "#8b5cf6" }} />,
    name: "Aguardar Interação",
    type: "waitForInteraction",
    category: "interacoes",
  },
  {
    icon: <ConfirmationNumber sx={{ color: "#F7953B" }} />,
    name: "Ticket",
    type: "ticket",
    category: "atendimento",
  },
  {
    icon: <AccountTree sx={{ color: "#0872b9" }} />,
    name: "Setor",
    type: "sector",
    category: "atendimento",
  },
  {
    icon: <Cancel sx={{ color: "#ef4444" }} />,
    name: "Encerrar Ticket",
    type: "closeTicket",
    category: "atendimento",
  },
  {
    icon: <LocalOffer sx={{ color: "#6366f1" }} />,
    name: "Tag Kanban",
    type: "tag",
    category: "atendimento",
  },
  {
    icon: (
      <Box component="img" sx={{ width: 24, height: 24 }} src={typebotIcon} alt="typebot" />
    ),
    name: "TypeBot",
    type: "typebot",
    category: "integracoes",
  },
  {
    icon: <SiOpenai sx={{ color: "#F7953B" }} />,
    name: "OpenAI",
    type: "openai",
    category: "integracoes",
  },
  {
    icon: <CallSplit sx={{ color: "#1FBADC" }} />,
    name: "Randomizador",
    type: "random",
    category: "utilitarios",
  },
  {
    icon: <AccessTime sx={{ color: "#F7953B" }} />,
    name: "Intervalo",
    type: "interval",
    category: "utilitarios",
  },
];

const FlowBuilderAddNodeMenu = ({ anchorEl, open, onClose, onSelectAction }) => {
  const grouped = Object.entries(
    NODE_ACTIONS.reduce((acc, action) => {
      const cat = action.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(action);
      return acc;
    }, {})
  ).sort((a, b) => CATEGORIES[a[0]]?.order - CATEGORIES[b[0]]?.order);

  const handleClick = (type) => {
    onSelectAction(type);
    onClose();
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      PaperProps={{
        sx: { maxHeight: 400, minWidth: 220 },
      }}
    >
      {grouped.map(([categoryKey, actions]) => (
        <span key={categoryKey}>
          <ListSubheader
            sx={{
              lineHeight: 2.5,
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "text.secondary",
              textTransform: "uppercase",
            }}
          >
            {CATEGORIES[categoryKey]?.label || categoryKey}
          </ListSubheader>
          {actions.map((action) => (
            <MenuItem
              key={action.type}
              onClick={() => handleClick(action.type)}
              sx={{ py: 1.25 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{action.icon}</ListItemIcon>
              <ListItemText primary={action.name} />
            </MenuItem>
          ))}
        </span>
      ))}
    </Menu>
  );
};

export default FlowBuilderAddNodeMenu;
