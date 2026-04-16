import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
} from "react";

import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";

import audioNode from "./nodes/audioNode";
import typebotNode from "./nodes/typebotNode";
import openaiNode from "./nodes/openaiNode";
import messageNode from "./nodes/messageNode.js";
import startNode from "./nodes/startNode";
import menuNode from "./nodes/menuNode";
import intervalNode from "./nodes/intervalNode";
import imgNode from "./nodes/imgNode";
import randomizerNode from "./nodes/randomizerNode";
import conditionNode from "./nodes/conditionNode";
import attendantNode from "./nodes/attendantNode";
import httpRequestNode from "./nodes/httpRequestNode";
import notificationNode from "./nodes/notificationNode";
import blacklistNode from "./nodes/blacklistNode";
import flowUpNode from "./nodes/flowUpNode";
import videoNode from "./nodes/videoNode";
import questionNode from "./nodes/questionNode";
import RemoveEdge from "./nodes/removeEdge";
import singleBlockNode from "./nodes/singleBlockNode";
import ticketNode from "./nodes/ticketNode";
import sectorNode from "./nodes/sectorNode";
import closeTicketNode from "./nodes/closeTicketNode";
import tagNode from "./nodes/tagNode";
import waitForInteractionNode from "./nodes/waitForInteractionNode";

import api from "../../services/api";

import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import {
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { useParams } from "react-router-dom";
import { CircularProgress } from "@material-ui/core";

import "reactflow/dist/style.css";

import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  onElementsRemove,
  useReactFlow,
} from "react-flow-renderer";

import FlowBuilderAddTextModal from "../../components/FlowBuilderAddTextModal";
import FlowBuilderIntervalModal from "../../components/FlowBuilderIntervalModal";
import FlowBuilderConditionModal from "../../components/FlowBuilderConditionModal";
import FlowBuilderAttendantModal from "../../components/FlowBuilderAttendantModal";
import FlowBuilderHttpRequestModal from "../../components/FlowBuilderHttpRequestModal";
import FlowBuilderNotificationModal from "../../components/FlowBuilderNotificationModal";
import FlowBuilderBlacklistModal from "../../components/FlowBuilderBlacklistModal";
import FlowBuilderFlowUpModal from "../../components/FlowBuilderFlowUpModal";
import FlowBuilderMenuModal from "../../components/FlowBuilderMenuModal";
import FlowBuilderAddImgModal from "../../components/FlowBuilderAddImgModal";
import FlowBuilderTicketModal from "../../components/FlowBuilderAddTicketModal";
import FlowBuilderAddAudioModal from "../../components/FlowBuilderAddAudioModal";
import FlowBuilderRandomizerModal from "../../components/FlowBuilderRandomizerModal";
import FlowBuilderAddVideoModal from "../../components/FlowBuilderAddVideoModal";
import FlowBuilderSingleBlockModal from "../../components/FlowBuilderSingleBlockModal";
import FlowBuilderTypebotModal from "../../components/FlowBuilderAddTypebotModal";
import FlowBuilderOpenAIModal from "../../components/FlowBuilderAddOpenAIModal";
import FlowBuilderAddQuestionModal from "../../components/FlowBuilderAddQuestionModal";
import FlowBuilderSectorModal from "../../components/FlowBuilderSectorModal";
import FlowBuilderTagModal from "../../components/FlowBuilderTagModal";
import FlowBuilderCloseTicketModal from "../../components/FlowBuilderCloseTicketModal";
import FlowBuilderAddNodeMenu from "../../components/FlowBuilderAddNodeMenu";
import FlowBuilderTestPanel, {
  FlowBuilderTestFab,
} from "../../components/FlowBuilderTestSimulator";

import {
  buildFlowExportFile,
  downloadJson,
  sanitizeFilename,
} from "../../flowBuilderTemplates/flowImportExport";

import { Add } from "@mui/icons-material";

import { useNodeStorage } from "../../stores/useNodeStorage";
import { ConfirmationNumber } from "@material-ui/icons";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    position: "relative",
    backgroundColor: "#F8F9FA",
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  speeddial: {
    backgroundColor: "red",
  },
}));

function geraStringAleatoria(tamanho) {
  var stringAleatoria = "";
  var caracteres =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < tamanho; i++) {
    stringAleatoria += caracteres.charAt(
      Math.floor(Math.random() * caracteres.length)
    );
  }
  return stringAleatoria;
}

const nodeTypes = {
  message: messageNode,
  start: startNode,
  menu: menuNode,
  interval: intervalNode,
  img: imgNode,
  audio: audioNode,
  randomizer: randomizerNode,
  video: videoNode,
  singleBlock: singleBlockNode,
  ticket: ticketNode,
  typebot: typebotNode,
  openai: openaiNode,
  question: questionNode,
  sector: sectorNode,
  closeTicket: closeTicketNode,
  tag: tagNode,
  waitForInteraction: waitForInteractionNode,
  condition: conditionNode,
  attendant: attendantNode,
  httpRequest: httpRequestNode,
  notification: notificationNode,
  blacklist: blacklistNode,
  flowUp: flowUpNode,
};

const edgeTypes = {
  buttonedge: RemoveEdge,
};

const initialNodes = [
  {
    id: "1",
    position: { x: 250, y: 100 },
    data: { label: "Inicio do fluxo" },
    type: "start",
  },
];

const initialEdges = [];

const FlowBuilderConfig = () => {
  const classes = useStyles();
  const history = useHistory();
  const { id } = useParams();

  const storageItems = useNodeStorage();

  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [dataNode, setDataNode] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [modalAddText, setModalAddText] = useState(null);
  const [modalAddInterval, setModalAddInterval] = useState(false);
  const [modalAddMenu, setModalAddMenu] = useState(null);
  const [modalAddImg, setModalAddImg] = useState(null);
  const [modalAddAudio, setModalAddAudio] = useState(null);
  const [modalAddRandomizer, setModalAddRandomizer] = useState(null);
  const [modalAddVideo, setModalAddVideo] = useState(null);
  const [modalAddSingleBlock, setModalAddSingleBlock] = useState(null);
  const [modalAddTicket, setModalAddTicket] = useState(null);
  const [modalAddTypebot, setModalAddTypebot] = useState(null);
  const [modalAddOpenAI, setModalAddOpenAI] = useState(null);
  const [modalAddQuestion, setModalAddQuestion] = useState(null);
  const [modalAddSector, setModalAddSector] = useState(null);
  const [modalAddTag, setModalAddTag] = useState(null);
  const [modalAddCloseTicket, setModalAddCloseTicket] = useState(null);
  const [modalAddCondition, setModalAddCondition] = useState(null);
  const [modalAddAttendant, setModalAddAttendant] = useState(null);
  const [modalAddHttpRequest, setModalAddHttpRequest] = useState(null);
  const [modalAddNotification, setModalAddNotification] = useState(null);
  const [modalAddBlacklist, setModalAddBlacklist] = useState(null);
  const [modalAddFlowUp, setModalAddFlowUp] = useState(null);
  const [addNodeMenuAnchor, setAddNodeMenuAnchor] = useState(null);
  const [flowDisplayName, setFlowDisplayName] = useState("Fluxo");
  const [flowTestOpen, setFlowTestOpen] = useState(false);

  const connectionLineStyle = { stroke: "#2b2b2b", strokeWidth: "6px" };

  const handleExportFlow = () => {
    try {
      const payload = buildFlowExportFile(flowDisplayName, nodes, edges);
      const fname = `fluxo-${sanitizeFilename(flowDisplayName)}-${Date.now()}.json`;
      downloadJson(fname, payload);
      toast.success("Fluxo exportado em JSON.");
    } catch (e) {
      toast.error("Não foi possível exportar o fluxo.");
    }
  };

  const addNode = (type, data) => {

    const posY = nodes[nodes.length - 1].position.y;
    const posX = nodes[nodes.length - 1].position.x + nodes[nodes.length - 1].width + 40;

    if (type === "start") {
      return setNodes((old) => {
        return [
          ...old.filter((item) => item.id !== "1"),
          {
            id: "1",
            position: { x: posX, y: posY },
            data: { label: "Inicio do fluxo" },
            type: "start",
          },
        ];
      });
    }
    if (type === "text") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { label: data.text },
            type: "message",
          },
        ];
      });
    }
    if (type === "interval") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { label: `Intervalo ${data.sec} seg.`, sec: data.sec },
            type: "interval",
          },
        ];
      });
    }
    if (type === "condition") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              mode: data.mode || "all",
              rules: Array.isArray(data.rules) ? data.rules : [],
            },
            type: "condition",
          },
        ];
      });
    }
    if (type === "menu") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              message: data.message,
              arrayOption: data.arrayOption,
            },
            type: "menu",
          },
        ];
      });
    }
    if (type === "img") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url },
            type: "img",
          },
        ];
      });
    }
    if (type === "audio") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url, record: data.record },
            type: "audio",
          },
        ];
      });
    }
    if (type === "randomizer") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { percent: data.percent },
            type: "randomizer",
          },
        ];
      });
    }
    if (type === "video") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url },
            type: "video",
          },
        ];
      });
    }
    if (type === "singleBlock") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "singleBlock",
          },
        ];
      });
    }

    if (type === "ticket") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "ticket",
          },
        ];
      });
    }

    if (type === "typebot") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "typebot",
          },
        ];
      });
    }

    if (type === "openai") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "openai",
          },
        ];
      });
    }

    if (type === "question") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "question",
          },
        ];
      });
    }

    if (type === "sector") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: data?.data || {},
            type: "sector",
          },
        ];
      });
    }

    if (type === "closeTicket") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {},
            type: "closeTicket",
          },
        ];
      });
    }

    if (type === "tag") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: data?.data || {},
            type: "tag",
          },
        ];
      });
    }

    if (type === "waitForInteraction") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {},
            type: "waitForInteraction",
          },
        ];
      });
    }

    if (type === "attendant") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: data?.user
              ? { user: data.user }
              : { user: { id: 0, name: "" } },
            type: "attendant",
          },
        ];
      });
    }

    if (type === "httpRequest") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: data && typeof data === "object" ? { ...data } : {},
            type: "httpRequest",
          },
        ];
      });
    }

    if (type === "notification") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data:
              data && typeof data === "object"
                ? { phone: data.phone || "", message: data.message || "" }
                : { phone: "", message: "" },
            type: "notification",
          },
        ];
      });
    }

    if (type === "blacklist") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              action:
                data?.action === "remove" ? "remove" : "add",
            },
            type: "blacklist",
          },
        ];
      });
    }

    if (type === "flowUp") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              contactList: data?.contactList || { id: 0, name: "" },
            },
            type: "flowUp",
          },
        ];
      });
    }
  };

  const textAdd = (data) => {
    addNode("text", data);
  };

  const intervalAdd = (data) => {
    addNode("interval", data);
  };

  const conditionAdd = (data) => {
    addNode("condition", data);
  };

  const menuAdd = (data) => {
    addNode("menu", data);
  };

  const imgAdd = (data) => {
    addNode("img", data);
  };

  const audioAdd = (data) => {
    addNode("audio", data);
  };

  const randomizerAdd = (data) => {
    addNode("randomizer", data);
  };

  const videoAdd = (data) => {
    addNode("video", data);
  };

  const singleBlockAdd = (data) => {
    addNode("singleBlock", data);
  };

  const ticketAdd = (data) => {
    addNode("ticket", data);
  };

  const typebotAdd = (data) => {
    addNode("typebot", data);
  };

  const openaiAdd = (data) => {
    addNode("openai", data);
  };

  const questionAdd = (data) => {
    addNode("question", data);
  };

  const sectorAdd = (data) => {
    addNode("sector", data);
  };

  const closeTicketAdd = (data) => {
    addNode("closeTicket", data || {});
  };

  const tagAdd = (data) => {
    addNode("tag", data);
  };

  const waitForInteractionAdd = () => {
    addNode("waitForInteraction", {});
  };

  const attendantAdd = (data) => {
    addNode("attendant", data);
  };

  const httpRequestAdd = (data) => {
    addNode("httpRequest", data);
  };

  const notificationAdd = (data) => {
    addNode("notification", data);
  };

  const blacklistAdd = (data) => {
    addNode("blacklist", data);
  };

  const flowUpAdd = (data) => {
    addNode("flowUp", data);
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onRemoveEdge = useCallback(
    (edgeId) => setEdges((eds) => eds.filter((e) => e.id !== edgeId)),
    [setEdges]
  );

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(
      { ...params, type: "buttonedge", data: { onRemove: onRemoveEdge } },
      eds
    )),
    [setEdges, onRemoveEdge]
  );

  const saveFlow = async () => {
    const waitNodes = nodes.filter((n) => n.type === "waitForInteraction");
    for (const w of waitNodes) {
      const out = edges.filter((e) => e.source === w.id);
      if (out.length === 0) {
        toast.error(
          'O nó "Aguardar Interação" precisa de uma conexão de saída para o próximo passo.'
        );
        return;
      }
    }
    await api
      .post("/flowbuilder/flow", {
        idFlow: id,
        nodes: nodes,
        connections: edges,
      })
      .then((res) => {
        toast.success("Fluxo salvo com sucesso");
      });
  };

  const doubleClick = (event, node) => {
    setDataNode(node);
    if (node.type === "message") {
      setModalAddText("edit");
    }
    if (node.type === "interval") {
      setModalAddInterval("edit");
    }

    if (node.type === "menu") {
      setModalAddMenu("edit");
    }
    if (node.type === "img") {
      setModalAddImg("edit");
    }
    if (node.type === "audio") {
      setModalAddAudio("edit");
    }
    if (node.type === "randomizer") {
      setModalAddRandomizer("edit");
    }
    if (node.type === "singleBlock") {
      setModalAddSingleBlock("edit");
    }
    if (node.type === "ticket") {
      setModalAddTicket("edit");
    }
    if (node.type === "typebot") {
      setModalAddTypebot("edit");
    }
    if (node.type === "openai") {
      setModalAddOpenAI("edit");
    }
    if (node.type === "question") {
      setModalAddQuestion("edit");
    }
    if (node.type === "sector") {
      setModalAddSector("edit");
    }
    if (node.type === "tag") {
      setModalAddTag("edit");
    }
    if (node.type === "closeTicket") {
      setModalAddCloseTicket("edit");
    }
    if (node.type === "condition") {
      setModalAddCondition("edit");
    }
    if (node.type === "attendant") {
      setModalAddAttendant("edit");
    }
    if (node.type === "httpRequest") {
      setModalAddHttpRequest("edit");
    }
    if (node.type === "notification") {
      setModalAddNotification("edit");
    }
    if (node.type === "blacklist") {
      setModalAddBlacklist("edit");
    }
    if (node.type === "flowUp") {
      setModalAddFlowUp("edit");
    }
  };

  const clickNode = (event, node) => {
    setNodes((old) =>
      old.map((item) => {
        if (item.id === node.id) {
          return {
            ...item,
            style: { backgroundColor: "#0000FF", padding: 1, borderRadius: 8 },
          };
        }
        return {
          ...item,
          style: { backgroundColor: "#13111C", padding: 0, borderRadius: 8 },
        };
      })
    );
  };

  const clickEdge = (event, node) => {
    setNodes((old) =>
      old.map((item) => {
        return {
          ...item,
          style: { backgroundColor: "#13111C", padding: 0, borderRadius: 8 },
        };
      })
    );
  };

  const updateNode = (dataAlter) => {
    setNodes((old) =>
      old.map((itemNode) => {
        if (itemNode.id === dataAlter.id) {
          return dataAlter;
        }
        return itemNode;
      })
    );
    setModalAddText(null);
    setModalAddInterval(null);
    setModalAddMenu(null);
    setModalAddOpenAI(null);
    setModalAddTypebot(null);
    setModalAddSector(null);
    setModalAddTag(null);
    setModalAddCloseTicket(null);
    setModalAddCondition(null);
    setModalAddAttendant(null);
    setModalAddHttpRequest(null);
    setModalAddNotification(null);
    setModalAddBlacklist(null);
    setModalAddFlowUp(null);
  };

  const clickActions = (type) => {
    switch (type) {
      case "start":
        addNode("start");
        break;
      case "menu":
        setModalAddMenu("create");
        break;
      case "content":
        setModalAddSingleBlock("create");
        break;
      case "random":
        setModalAddRandomizer("create");
        break;
      case "interval":
        setModalAddInterval("create");
        break;
      case "ticket":
        setModalAddTicket("create");
        break;
      case "typebot":
        setModalAddTypebot("create");
        break;
      case "openai":
        setModalAddOpenAI("create");
        break;
      case "question":
        setModalAddQuestion("create");
        break;
      case "sector":
        setModalAddSector("create");
        break;
      case "closeTicket":
        setModalAddCloseTicket("create");
        break;
      case "tag":
        setModalAddTag("create");
        break;
      case "waitForInteraction":
        waitForInteractionAdd();
        break;
      case "condition":
        setModalAddCondition("create");
        break;
      case "attendant":
        setModalAddAttendant("create");
        break;
      case "httpRequest":
        setModalAddHttpRequest("create");
        break;
      case "notification":
        setModalAddNotification("create");
        break;
      case "blacklist":
        setModalAddBlacklist("create");
        break;
      case "flowUp":
        setModalAddFlowUp("create");
        break;
      default:
    }
  };

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get(`/flowbuilder/flow/${id}`);
          if (data?.flow) {
            setFlowDisplayName(data.flow.name || "Fluxo");
          }
          if (data?.flow?.flow != null) {
            const flowNodes = data.flow.flow.nodes;
            setNodes(flowNodes);
            const connections = data.flow.flow.connections || [];
            setEdges(connections.map((e) => ({
              ...e,
              type: "buttonedge",
              data: { ...e.data, onRemove: (edgeId) => setEdges((eds) => eds.filter((ed) => ed.id !== edgeId)) },
            })));
            const filterVariables = flowNodes.filter(
              (nd) => nd.type === "question"
            );
            const variables = filterVariables.map(
              (variable) => variable.data.typebotIntegration.answerKey
            );
            localStorage.setItem("variables", JSON.stringify(variables));
          }
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [id]);

  useEffect(() => {
    if (storageItems.action === "delete") {
      setNodes((old) => old.filter((item) => item.id !== storageItems.node));
      setEdges((old) => {
        const newData = old.filter((item) => item.source !== storageItems.node);
        const newClearTarget = newData.filter(
          (item) => item.target !== storageItems.node
        );
        return newClearTarget;
      });
      storageItems.setNodesStorage("");
      storageItems.setAct("idle");
    }
    if (storageItems.action === "duplicate") {
      const nodeDuplicate = nodes.filter(
        (item) => item.id === storageItems.node
      )[0];
      const maioresX = nodes.map((node) => node.position.x);
      const maiorX = Math.max(...maioresX);
      const finalY = nodes[nodes.length - 1].position.y;
      const nodeNew = {
        ...nodeDuplicate,
        id: geraStringAleatoria(30),
        position: {
          x: maiorX + 240,
          y: finalY,
        },
        selected: false,
        style: { backgroundColor: "#555555", padding: 0, borderRadius: 8 },
      };
      setNodes((old) => [...old, nodeNew]);
      storageItems.setNodesStorage("");
      storageItems.setAct("idle");
    }
  }, [storageItems.action]);

  return (
    <Stack sx={{ height: "100vh" }}>
      <FlowBuilderAddTextModal
        open={modalAddText}
        onSave={textAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddText}
      />
      <FlowBuilderIntervalModal
        open={modalAddInterval}
        onSave={intervalAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddInterval}
      />
      <FlowBuilderMenuModal
        open={modalAddMenu}
        onSave={menuAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddMenu}
      />
      <FlowBuilderAddImgModal
        open={modalAddImg}
        onSave={imgAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddImg}
      />
      <FlowBuilderAddAudioModal
        open={modalAddAudio}
        onSave={audioAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddAudio}
      />
      <FlowBuilderRandomizerModal
        open={modalAddRandomizer}
        onSave={randomizerAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddRandomizer}
      />
      <FlowBuilderAddVideoModal
        open={modalAddVideo}
        onSave={videoAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddVideo}
      />
      <FlowBuilderSingleBlockModal
        open={modalAddSingleBlock}
        onSave={singleBlockAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddSingleBlock}
      />
      <FlowBuilderTicketModal
        open={modalAddTicket}
        onSave={ticketAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddTicket}
      />

      <FlowBuilderOpenAIModal
        open={modalAddOpenAI}
        onSave={openaiAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddOpenAI}
      />

      <FlowBuilderTypebotModal
        open={modalAddTypebot}
        onSave={typebotAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddTypebot}
      />

      <FlowBuilderAddQuestionModal
        open={modalAddQuestion}
        onSave={questionAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddQuestion}
      />
      <FlowBuilderSectorModal
        open={modalAddSector}
        onSave={sectorAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddSector}
      />
      <FlowBuilderTagModal
        open={modalAddTag}
        onSave={tagAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddTag}
      />
      <FlowBuilderCloseTicketModal
        open={modalAddCloseTicket}
        onSave={closeTicketAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddCloseTicket}
      />
      <FlowBuilderConditionModal
        open={modalAddCondition}
        onSave={conditionAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddCondition}
      />
      <FlowBuilderAttendantModal
        open={modalAddAttendant}
        onSave={attendantAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddAttendant}
      />
      <FlowBuilderHttpRequestModal
        open={modalAddHttpRequest}
        onSave={httpRequestAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddHttpRequest}
      />
      <FlowBuilderNotificationModal
        open={modalAddNotification}
        onSave={notificationAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddNotification}
      />
      <FlowBuilderBlacklistModal
        open={modalAddBlacklist}
        onSave={blacklistAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddBlacklist}
      />
      <FlowBuilderFlowUpModal
        open={modalAddFlowUp}
        onSave={flowUpAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddFlowUp}
      />

      <MainHeader>
        <Title>Desenhe seu fluxo</Title>
      </MainHeader>
      {!loading && (
        <Paper
          className={classes.mainPaper}
          variant="outlined"
          onScroll={handleScroll}
        >
          <Stack>
            <IconButton
              aria-label="Adicionar nó"
              onClick={(e) => setAddNodeMenuAnchor(e.currentTarget)}
              sx={{
                position: "absolute",
                top: 8,
                left: 8,
                backgroundColor: "primary.main",
                color: "white",
                "&:hover": { backgroundColor: "primary.dark" },
                zIndex: 10,
              }}
            >
              <Add />
            </IconButton>
            <FlowBuilderAddNodeMenu
              anchorEl={addNodeMenuAnchor}
              open={Boolean(addNodeMenuAnchor)}
              onClose={() => setAddNodeMenuAnchor(null)}
              onSelectAction={clickActions}
            />
          </Stack>
          <Stack
            sx={{
              position: "absolute",
              justifyContent: "center",
              flexDirection: "row",
              width: "100%",
            }}
          >
            <Typography
              style={{ color: "#010101", textShadow: "#010101 1px 0 10px" }}
            >
              Não se esqueça de salvar seu fluxo!
            </Typography>
          </Stack>
          <Stack direction={"row"} justifyContent={"end"} spacing={1}>
            <Button
              sx={{ textTransform: "none" }}
              variant="outlined"
              color="primary"
              onClick={handleExportFlow}
            >
              Exportar JSON
            </Button>
            <Button
              sx={{ textTransform: "none" }}
              variant="contained"
              color="primary"
              onClick={() => saveFlow()}
            >
              Salvar
            </Button>
          </Stack>

          <Stack
            direction={"row"}
            style={{
              width: "100%",
              height: "90%",
              position: "relative",
              display: "flex",
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              deleteKeyCode={["Backspace", "Delete"]}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDoubleClick={doubleClick}
              onNodeClick={clickNode}
              onEdgeClick={clickEdge}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
              connectionLineStyle={connectionLineStyle}
              style={{
                //backgroundImage: `url(${imgBackground})`,
                //backgroundSize: "cover"
                backgroundColor: "#F8F9FA",
              }}
              edgeTypes={edgeTypes}
              variant={"cross"}
              defaultEdgeOptions={{
                style: { color: "#ff0000", strokeWidth: "6px" },
                animated: false,
              }}
            >
              <Controls />
              <MiniMap />
              <Background variant="dots" gap={12} size={-1} />
            </ReactFlow>

            <Stack
              style={{
                backgroundColor: "#FAFAFA",
                height: "20px",
                width: "58px",
                position: "absolute",
                bottom: 0,
                right: 0,
                zIndex: 1111,
              }}
            />
            {/* <Stack
                  style={{
                    backgroundColor: "#1B1B1B",
                    height: "70%",
                    width: "150px",
                    position: "absolute",
                    left: 0,
                    top: 0,
                    zIndex: 1111,
                    borderRadius: 3,
                    padding: 8
                  }}
                  spacing={1}
                >
                  <Typography style={{ color: "#ffffff", textAlign: "center" }}>
                    Adicionar
                  </Typography>
                  <Button
                    onClick={() => addNode("start")}
                    variant="contained"
                    style={{
                      backgroundColor: "#3ABA38",
                      color: "#ffffff",
                      padding: 8,
                      "&:hover": {
                        backgroundColor: "#3e3b7f"
                      },
                      textTransform: "none"
                    }}
                  >
                    <RocketLaunch
                      sx={{
                        width: "16px",
                        height: "16px",
                        marginRight: "4px"
                      }}
                    />
                    Inicio
                  </Button>
                  <Button
                    onClick={() => setModalAddText("create")}
                    variant="contained"
                    style={{
                      backgroundColor: "#6865A5",
                      color: "#ffffff",
                      padding: 8,
                      textTransform: "none"
                    }}
                  >
                    <Message
                      sx={{
                        width: "16px",
                        height: "16px",
                        marginRight: "4px"
                      }}
                    />
                    Texto
                  </Button>
                  <Button
                    onClick={() => setModalAddInterval("create")}
                    variant="contained"
                    style={{
                      backgroundColor: "#F7953B",
                      color: "#ffffff",
                      padding: 8,
                      textTransform: "none"
                    }}
                  >
                    <AccessTime
                      sx={{
                        width: "16px",
                        height: "16px",
                        marginRight: "4px"
                      }}
                    />
                    Intervalo
                  </Button>
                  <Button
                    onClick={() => setModalAddCondition("create")}
                    variant="contained"
                    disabled
                    style={{
                      backgroundColor: "#524d4d",
                      color: "#cccaed",
                      padding: 8,
                      textTransform: "none"
                    }}
                  >
                    <ImportExport
                      sx={{
                        width: "16px",
                        height: "16px",
                        marginRight: "4px"
                      }}
                    />
                    Condição
                  </Button>
                  <Button
                    onClick={() => setModalAddMenu("create")}
                    variant="contained"
                    style={{
                      backgroundColor: "#683AC8",
                      color: "#ffffff",
                      padding: 8,
                      textTransform: "none"
                    }}
                  >
                    <DynamicFeed
                      sx={{
                        width: "16px",
                        height: "16px",
                        marginRight: "4px"
                      }}
                    />
                    Menu
                  </Button>
                  <Button
                    onClick={() => setModalAddAudio("create")}
                    variant="contained"
                    style={{
                      backgroundColor: "#6865A5",
                      color: "#ffffff",
                      padding: 8,
                      textTransform: "none"
                    }}
                  >
                    <MicNone
                      sx={{
                        width: "16px",
                        height: "16px",
                        marginRight: "4px"
                      }}
                    />
                    Audio
                  </Button>
                  <Button
                    onClick={() => setModalAddVideo("create")}
                    variant="contained"
                    style={{
                      backgroundColor: "#6865A5",
                      color: "#ffffff",
                      padding: 8,
                      textTransform: "none"
                    }}
                  >
                    <Videocam
                      sx={{
                        width: "16px",
                        height: "16px",
                        marginRight: "4px"
                      }}
                    />
                    Video
                  </Button>
                  <Button
                    onClick={() => setModalAddImg("create")}
                    variant="contained"
                    style={{
                      backgroundColor: "#6865A5",
                      color: "#ffffff",
                      padding: 8,
                      textTransform: "none"
                    }}
                  >
                    <Image
                      sx={{
                        width: "16px",
                        height: "16px",
                        marginRight: "4px"
                      }}
                    />
                    Imagem
                  </Button>
                  <Button
                    onClick={() => setModalAddRandomizer("create")}
                    variant="contained"
                    style={{
                      backgroundColor: "#1FBADC",
                      color: "#ffffff",
                      padding: 8,
                      textTransform: "none"
                    }}
                  >
                    <CallSplit
                      sx={{
                        width: "16px",
                        height: "16px",
                        marginRight: "4px"
                      }}
                    />
                    Randomizador
                  </Button>
                  <Button
                    onClick={() => setModalAddSingleBlock("create")}
                    variant="contained"
                    style={{
                      backgroundColor: "#EC5858",
                      color: "#ffffff",
                      padding: 8,
                      textTransform: "none"
                    }}
                  >
                    <LibraryBooks
                      sx={{
                        width: "16px",
                        height: "16px",
                        marginRight: "4px"
                      }}
                    />
                    Conteúdo
                  </Button>
                </Stack> */}
          </Stack>
        </Paper>
      )}
      {loading && (
        <Stack justifyContent={"center"} alignItems={"center"} height={"70vh"}>
          <CircularProgress />
        </Stack>
      )}
      <FlowBuilderTestFab
        visible={!loading}
        onClick={() => setFlowTestOpen(true)}
      />
      <FlowBuilderTestPanel
        open={flowTestOpen}
        onClose={() => setFlowTestOpen(false)}
        nodes={nodes}
        edges={edges}
        flowName={flowDisplayName}
      />
    </Stack>
  );
};

export default FlowBuilderConfig;
