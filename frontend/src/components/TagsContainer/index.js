import React, { useEffect, useRef, useState } from "react";
import {
  Chip,
  Paper,
  TextField,
  IconButton,
  Popover,
  Box,
  Typography,
  Badge,
  Tooltip,
  Button,
} from "@material-ui/core";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
} from "../../ui";
import useIsMobile from "../../hooks/useIsMobile";
import { makeStyles, alpha } from "@material-ui/core/styles";
import Autocomplete from "@material-ui/lab/Autocomplete";
import LocalOfferOutlinedIcon from "@material-ui/icons/LocalOfferOutlined";
import { isArray, isString } from "lodash";
import toastError from "../../errors/toastError";
import { isForbiddenPermissionError } from "../../utils/apiErrorUtils";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

const useEditorStyles = makeStyles((theme) => ({
  input: {
    width: "100%",
    "& .MuiOutlinedInput-root": {
      borderRadius: 12,
      minHeight: 40,
      fontSize: "0.875rem",
      backgroundColor: alpha(
        theme.palette.action.hover,
        theme.palette.type === "dark" ? 0.35 : 0.5
      ),
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: theme.palette.divider,
    },
  },
  chip: {
    fontWeight: 600,
    borderRadius: 999,
    fontSize: "0.68rem",
    height: 22,
    marginRight: 4,
  },
}));

const usePopoverStyles = makeStyles((theme) => ({
  popoverPaper: {
    padding: theme.spacing(1.5),
    minWidth: 300,
    maxWidth: 400,
    borderRadius: 12,
  },
  popoverTitle: {
    fontWeight: 600,
    fontSize: "0.8rem",
    marginBottom: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  iconBtn: {
    transition: "all 180ms ease",
    "&:hover": {
      backgroundColor: alpha(theme.palette.success.main, 0.12),
    },
  },
}));

/** Autocomplete de tags do ticket (sincroniza via POST /tags/sync). */
export function TicketTagsEditor({ ticket, autoFocus, loadWhenActive = true }) {
  const classes = useEditorStyles();
  const [tags, setTags] = useState([]);
  const [selecteds, setSelecteds] = useState([]);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!loadWhenActive || !isMounted.current) {
      return;
    }
    loadTags().then(() => {
      if (!isMounted.current) return;
      if (Array.isArray(ticket?.tags)) {
        setSelecteds(ticket.tags);
      } else {
        setSelecteds([]);
      }
    });
  }, [ticket, loadWhenActive]);

  const createTag = async (data) => {
    try {
      const { data: responseData } = await api.post(`/tags`, data);
      return responseData;
    } catch (err) {
      if (!isForbiddenPermissionError(err)) {
        toastError(err);
      }
    }
  };

  const loadTags = async () => {
    try {
      const { data } = await api.get(`/tags/list`);
      setTags(Array.isArray(data) ? data : data?.tags || []);
    } catch (err) {
      if (!isForbiddenPermissionError(err)) {
        toastError(err);
      }
    }
  };

  const syncTags = async (data) => {
    try {
      const { data: responseData } = await api.post(`/tags/sync`, data);
      return responseData;
    } catch (err) {
      if (!isForbiddenPermissionError(err)) {
        toastError(err);
      }
    }
  };

  const onChange = async (value, reason) => {
    let optionsChanged = [];
    if (reason === "create-option") {
      if (isArray(value)) {
        for (const item of value) {
          if (isString(item)) {
            const newTag = await createTag({ name: item });
            optionsChanged.push(newTag);
          } else {
            optionsChanged.push(item);
          }
        }
      }
      await loadTags();
    } else {
      optionsChanged = value;
    }
    setSelecteds(Array.isArray(optionsChanged) ? optionsChanged : []);
    if (ticket?.id) {
      await syncTags({
        ticketId: ticket.id,
        tags: Array.isArray(optionsChanged) ? optionsChanged : [],
      });
    }
  };

  return (
    <Autocomplete
      multiple
      size="small"
      options={Array.isArray(tags) ? tags : []}
      value={Array.isArray(selecteds) ? selecteds : []}
      freeSolo
      onChange={(e, v, r) => onChange(v, r)}
      getOptionLabel={(option) =>
        (typeof option === "string" ? option : option?.name) || ""
      }
      renderTags={(value, getTagProps) =>
        (Array.isArray(value) ? value : []).map((option, index) => (
          <Chip
            key={index}
            variant="outlined"
            className={classes.chip}
            style={{
              background: option.color || undefined,
              color: option.color ? "#FFF" : undefined,
              borderColor: option.color ? "transparent" : undefined,
            }}
            label={(
              typeof option === "string" ? option : option?.name || ""
            ).toUpperCase()}
            {...getTagProps({ index })}
            size="small"
          />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          variant="outlined"
          placeholder={i18n.t("messagesList.header.buttons.tagsPlaceholder")}
          className={classes.input}
          autoFocus={autoFocus}
        />
      )}
      PaperComponent={({ children }) => (
        <Paper style={{ width: 400, marginLeft: 12 }}>{children}</Paper>
      )}
    />
  );
}

/** Ícone no header que abre popover (desktop) ou dialog fullscreen (mobile) para tags. */
export function TicketTagsButton({ ticket, disabled, className }) {
  const classes = usePopoverStyles();
  const isMobile = useIsMobile();
  const [anchorEl, setAnchorEl] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const tagCount = Array.isArray(ticket?.tags) ? ticket.tags.length : 0;

  if (!ticket?.id) return null;

  const popoverOpen = Boolean(anchorEl);
  const open = isMobile ? dialogOpen : popoverOpen;

  const handleOpen = (e) => {
    e.stopPropagation();
    if (isMobile) {
      setDialogOpen(true);
    } else {
      setAnchorEl(e.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
    setDialogOpen(false);
  };

  const editor = (
    <TicketTagsEditor ticket={ticket} autoFocus={open} loadWhenActive={open} />
  );

  return (
    <>
      <Tooltip title={i18n.t("messagesList.header.buttons.manageTags")}>
        <span>
          <IconButton
            size="small"
            onClick={handleOpen}
            disabled={disabled}
            className={className || classes.iconBtn}
            aria-label={i18n.t("messagesList.header.buttons.manageTags")}
            aria-haspopup="true"
            aria-expanded={open}
          >
            <Badge
              badgeContent={tagCount}
              color="primary"
              invisible={tagCount === 0}
              overlap="circular"
            >
              <LocalOfferOutlinedIcon fontSize="small" />
            </Badge>
          </IconButton>
        </span>
      </Tooltip>
      {isMobile ? (
        <AppDialog
          open={dialogOpen}
          onClose={handleClose}
          onClick={(e) => e.stopPropagation()}
        >
          <AppDialogTitle>
            {i18n.t("messagesList.header.buttons.manageTags")}
          </AppDialogTitle>
          <AppDialogContent>{editor}</AppDialogContent>
          <AppDialogActions stickyFooter>
            <Button color="primary" variant="contained" onClick={handleClose}>
              {i18n.t("confirmationModal.buttons.confirm")}
            </Button>
          </AppDialogActions>
        </AppDialog>
      ) : (
        <Popover
          open={popoverOpen}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          PaperProps={{ className: classes.popoverPaper }}
          onClick={(e) => e.stopPropagation()}
        >
          <Box>
            <Typography className={classes.popoverTitle} component="p">
              {i18n.t("messagesList.header.buttons.manageTags")}
            </Typography>
            {editor}
          </Box>
        </Popover>
      )}
    </>
  );
}

/** @deprecated Use TicketTagsButton no header. Mantido para compatibilidade. */
export function TagsContainer({ ticket }) {
  return <TicketTagsEditor ticket={ticket} />;
}
