import React, { useState, useEffect, useContext } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import Board from "react-trello";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import { useHistory } from "react-router-dom";
import useUsers from "../../hooks/useUsers";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    padding: theme.spacing(2),
    backgroundColor: "#f4f4f4",
  },
  filterBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    padding: theme.spacing(2),
    backgroundColor: "#fff",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  filterControl: {
    minWidth: 160,
  },
  boardWrap: {
    flex: 1,
    minHeight: 400,
    backgroundColor: "#fff",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    padding: theme.spacing(2),
    overflow: "auto",
  },
  button: {
    background: "#24c776",
    border: "none",
    padding: "8px 12px",
    color: "white",
    fontWeight: 600,
    borderRadius: 6,
    fontSize: "0.8125rem",
    cursor: "pointer",
  },
}));

const Kanban = () => {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const { whatsApps } = useContext(WhatsAppsContext);
  const { users: usersList } = useUsers();
  const { profile, queues } = user;
  const queuesList = Array.isArray(queues) ? queues : [];

  const [tags, setTags] = useState([]);
  const [file, setFile] = useState({ lanes: [] });
  const [tickets, setTickets] = useState([]);

  const [filterUser, setFilterUser] = useState("");
  const [filterSetor, setFilterSetor] = useState("");
  const [filterConexao, setFilterConexao] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const queueIdsParam = queuesList.length
    ? (filterSetor ? [Number(filterSetor)] : queuesList.map((q) => q.id))
    : [];
  const usersParam = filterUser ? [Number(filterUser)] : [];

  const fetchTags = async () => {
    try {
      const response = await api.get("/tags/kanban");
      const lista = response.data?.lista;
      setTags(Array.isArray(lista) ? lista : []);
    } catch (error) {
      console.log(error);
    }
  };

  const fetchTickets = async () => {
    try {
      const { data } = await api.get("/ticket/kanban", {
        params: {
          queueIds: JSON.stringify(queueIdsParam),
          showAll: profile === "admin",
          users: JSON.stringify(usersParam),
          ...(filterStatus ? { status: filterStatus } : {}),
        },
      });
      let list = data.tickets || [];
      if (filterConexao) {
        list = list.filter((t) => String(t.whatsappId) === String(filterConexao));
      }
      if (filterStatus) {
        list = list.filter((t) => t.status === filterStatus);
      }
      setTickets(list);
    } catch (err) {
      console.log(err);
      setTickets([]);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [filterUser, filterSetor, filterConexao, filterStatus, profile]);

  const popularCards = () => {
    const filteredTickets = tickets.filter(
      (ticket) => !ticket.tags || ticket.tags.length === 0
    );

    const lanes = [
      {
        id: "lane0",
        title: i18n.t("kanban.open", "Em aberto"),
        label: filteredTickets.length.toString(),
        cards: filteredTickets.map((ticket) => ({
          id: ticket.id.toString(),
          label: "Ticket nº " + ticket.id.toString(),
          description: (
            <div>
              <p>
                {ticket.contact.number}
                <br />
                {ticket.lastMessage}
              </p>
              <button
                className={classes.button}
                onClick={() => {
                  handleCardClick(ticket.uuid);
                }}
              >
                {i18n.t("kanban.seeTicket")}
              </button>
            </div>
          ),
          title: ticket.contact.name,
          draggable: true,
          href: "/tickets/" + ticket.uuid,
        })),
      },
      ...(Array.isArray(tags) ? tags : []).map((tag) => {
        const tagsTickets = tickets.filter((ticket) => {
          const ticketTags = ticket.tags;
          const tagIds = Array.isArray(ticketTags) ? ticketTags.map((t) => t.id) : [];
          return tagIds.includes(tag.id);
        });

        return {
          id: tag.id.toString(),
          title: tag.name,
          label: tagsTickets.length.toString(),
          cards: tagsTickets.map((ticket) => ({
            id: ticket.id.toString(),
            label: "Ticket nº " + ticket.id.toString(),
            description: (
              <div>
                <p>
                  {ticket.contact.number}
                  <br />
                  {ticket.lastMessage}
                </p>
                <button
                  className={classes.button}
                  onClick={() => {
                    handleCardClick(ticket.uuid);
                  }}
                >
                  {i18n.t("kanban.seeTicket")}
                </button>
              </div>
            ),
            title: ticket.contact.name,
            draggable: true,
            href: "/tickets/" + ticket.uuid,
          })),
          style: { backgroundColor: tag.color, color: "white" },
        };
      }),
    ];

    setFile({ lanes });
  };

  const handleCardClick = (uuid) => {
    //console.log("Clicked on card with UUID:", uuid);
    history.push("/tickets/" + uuid);
  };

  useEffect(() => {
    popularCards();
  }, [tags, tickets]);

  const handleCardMove = async (cardId, sourceLaneId, targetLaneId) => {
    try {
      await api.delete(`/ticket-tags/${targetLaneId}`);
      toast.success(i18n.t("kanban.toasts.removed"));
      await api.put(`/ticket-tags/${targetLaneId}/${sourceLaneId}`);
      toast.success(i18n.t("kanban.toasts.added"));
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div className={classes.root}>
      <Paper elevation={0} className={classes.filterBar}>
        <FormControl variant="outlined" size="small" className={classes.filterControl}>
          <InputLabel id="kanban-filter-user">Usuário</InputLabel>
          <Select
            labelId="kanban-filter-user"
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            label="Usuário"
          >
            <MenuItem value="">Todos</MenuItem>
            {(usersList || []).map((u) => (
              <MenuItem key={u.id} value={String(u.id)}>{u.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl variant="outlined" size="small" className={classes.filterControl}>
          <InputLabel id="kanban-filter-setor">Setor</InputLabel>
          <Select
            labelId="kanban-filter-setor"
            value={filterSetor}
            onChange={(e) => setFilterSetor(e.target.value)}
            label="Setor"
          >
            <MenuItem value="">Todos</MenuItem>
            {(queues || []).map((q) => (
              <MenuItem key={q.id} value={String(q.id)}>{q.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl variant="outlined" size="small" className={classes.filterControl}>
          <InputLabel id="kanban-filter-conexao">Conexão</InputLabel>
          <Select
            labelId="kanban-filter-conexao"
            value={filterConexao}
            onChange={(e) => setFilterConexao(e.target.value)}
            label="Conexão"
          >
            <MenuItem value="">Todas</MenuItem>
            {(Array.isArray(whatsApps) ? whatsApps : []).map((w) => (
              <MenuItem key={w.id} value={String(w.id)}>{w.name || `Conexão ${w.id}`}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl variant="outlined" size="small" className={classes.filterControl}>
          <InputLabel id="kanban-filter-status">Status</InputLabel>
          <Select
            labelId="kanban-filter-status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            label="Status"
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="open">Em aberto</MenuItem>
            <MenuItem value="pending">Pendente</MenuItem>
          </Select>
        </FormControl>
      </Paper>
      <div className={classes.boardWrap}>
        <Board
          data={file}
          onCardMoveAcrossLanes={handleCardMove}
          style={{ backgroundColor: "transparent" }}
        />
      </div>
    </div>
  );
};

export default Kanban;
