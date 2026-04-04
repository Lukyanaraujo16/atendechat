import React, { useMemo, useState, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import Checkbox from "@material-ui/core/Checkbox";
import DeleteIcon from "@material-ui/icons/Delete";
import EditIcon from "@material-ui/icons/Edit";
import Alert from "@material-ui/lab/Alert";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import MainContainer from "../../components/MainContainer";

const STORAGE_KEY = "tasks";

function generateTaskId() {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeTasks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => {
      if (!item || typeof item !== "object") return null;
      const text = typeof item.text === "string" ? item.text : "";
      const createdAt = item.createdAt ? new Date(item.createdAt) : new Date();
      const updatedAt = item.updatedAt ? new Date(item.updatedAt) : createdAt;
      return {
        id: typeof item.id === "string" ? item.id : `legacy-${idx}-${Date.now()}`,
        text,
        completed: Boolean(item.completed),
        createdAt,
        updatedAt,
      };
    })
    .filter(Boolean);
}

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    maxWidth: 720,
    margin: "0 auto",
    padding: theme.spacing(2),
  },
  pageTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(1),
  },
  pageSubtitle: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2),
  },
  notice: {
    marginBottom: theme.spacing(2),
  },
  filterRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
    alignItems: "center",
  },
  filterLabel: {
    marginRight: theme.spacing(1),
    fontSize: "0.875rem",
    color: theme.palette.text.secondary,
  },
  inputContainer: {
    display: "flex",
    width: "100%",
    marginBottom: theme.spacing(1),
  },
  input: {
    flexGrow: 1,
    marginRight: theme.spacing(1),
  },
  listContainer: {
    width: "100%",
    marginTop: theme.spacing(1),
    backgroundColor: theme.palette.grey[100],
    borderRadius: theme.shape.borderRadius,
  },
  listItem: {
    marginBottom: theme.spacing(0.5),
  },
  primaryDone: {
    textDecoration: "line-through",
    color: theme.palette.text.secondary,
  },
}));

const FILTER_ALL = "all";
const FILTER_PENDING = "pending";
const FILTER_COMPLETED = "completed";

const ToDoList = () => {
  const classes = useStyles();

  const [task, setTask] = useState("");
  const [tasks, setTasks] = useState([]);
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState(FILTER_ALL);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved == null || saved === "") {
        return;
      }
      const parsed = JSON.parse(saved);
      const next = normalizeTasks(parsed);
      setTasks(next);
    } catch (e) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setTasks([]);
      toast.error(i18n.t("todolist.storageParseError"));
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      toast.error(i18n.t("todolist.storageWriteError"));
    }
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    const list = Array.isArray(tasks) ? tasks : [];
    if (filter === FILTER_PENDING) {
      return list.filter((t) => !t.completed);
    }
    if (filter === FILTER_COMPLETED) {
      return list.filter((t) => t.completed);
    }
    return list;
  }, [tasks, filter]);

  const handleTaskChange = (event) => {
    setTask(event.target.value);
  };

  const handleAddTask = () => {
    const taskText = (task || "").toString().trim();
    if (!taskText) {
      toast.info(i18n.t("todolist.buttons.typeTask"));
      return;
    }

    const now = new Date();
    if (editId) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === editId
            ? {
                ...t,
                text: taskText,
                updatedAt: now,
              }
            : t
        )
      );
      setTask("");
      setEditId(null);
      return;
    }

    setTasks((prev) => [
      ...(Array.isArray(prev) ? prev : []),
      {
        id: generateTaskId(),
        text: taskText,
        completed: false,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    setTask("");
  };

  const handleEditTask = (id) => {
    const taskItem = tasks.find((t) => t.id === id);
    if (!taskItem) return;
    setTask((taskItem.text || "").toString());
    setEditId(id);
  };

  const handleDeleteTask = (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (editId === id) {
      setEditId(null);
      setTask("");
    }
  };

  const handleToggleComplete = (id) => {
    const now = new Date();
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, completed: !t.completed, updatedAt: now }
          : t
      )
    );
  };

  return (
    <MainContainer>
      <div className={classes.root}>
        <Typography variant="h5" component="h1" className={classes.pageTitle}>
          {i18n.t("todolist.pageTitle")}
        </Typography>
        <Typography variant="body2" className={classes.pageSubtitle}>
          {i18n.t("todolist.pageSubtitle")}
        </Typography>

        <Alert severity="info" className={classes.notice}>
          {i18n.t("todolist.notice")}
        </Alert>

        <div className={classes.filterRow}>
          <span className={classes.filterLabel}>
            {i18n.t("todolist.filter.label")}
          </span>
          <Button
            size="small"
            variant={filter === FILTER_ALL ? "contained" : "outlined"}
            color="primary"
            onClick={() => setFilter(FILTER_ALL)}
          >
            {i18n.t("todolist.filter.all")}
          </Button>
          <Button
            size="small"
            variant={filter === FILTER_PENDING ? "contained" : "outlined"}
            color="primary"
            onClick={() => setFilter(FILTER_PENDING)}
          >
            {i18n.t("todolist.filter.pending")}
          </Button>
          <Button
            size="small"
            variant={filter === FILTER_COMPLETED ? "contained" : "outlined"}
            color="primary"
            onClick={() => setFilter(FILTER_COMPLETED)}
          >
            {i18n.t("todolist.filter.completed")}
          </Button>
        </div>

        <div className={classes.inputContainer}>
          <TextField
            className={classes.input}
            label={i18n.t("todolist.input")}
            value={task}
            onChange={handleTaskChange}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddTask();
              }
            }}
            variant="outlined"
            fullWidth
          />
          <Button
            type="button"
            variant="contained"
            color="primary"
            onClick={handleAddTask}
          >
            {editId
              ? i18n.t("todolist.buttons.save")
              : i18n.t("todolist.buttons.add")}
          </Button>
        </div>

        <div className={classes.listContainer}>
          {visibleTasks.length === 0 && (
            <Typography
              variant="body2"
              color="textSecondary"
              style={{ padding: 16 }}
            >
              {tasks.length === 0
                ? i18n.t("todolist.emptyNoItems")
                : i18n.t("todolist.emptyFilter")}
            </Typography>
          )}
          <List>
            {visibleTasks.map((taskItem) => (
              <ListItem key={taskItem.id} className={classes.listItem} dense>
                <ListItemIcon>
                  <Checkbox
                    edge="start"
                    checked={Boolean(taskItem.completed)}
                    tabIndex={-1}
                    disableRipple
                    inputProps={{
                      "aria-label": i18n.t("todolist.completedAria"),
                    }}
                    onChange={() => handleToggleComplete(taskItem.id)}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={taskItem.text || ""}
                  primaryTypographyProps={{
                    className: taskItem.completed ? classes.primaryDone : undefined,
                  }}
                  secondary={
                    taskItem.updatedAt
                      ? new Date(taskItem.updatedAt).toLocaleString()
                      : taskItem.createdAt
                      ? new Date(taskItem.createdAt).toLocaleString()
                      : ""
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    aria-label="edit"
                    onClick={() => handleEditTask(taskItem.id)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => handleDeleteTask(taskItem.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </div>
      </div>
    </MainContainer>
  );
};

export default ToDoList;
