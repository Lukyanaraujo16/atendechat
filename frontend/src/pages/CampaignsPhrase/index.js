import React, { useState, useEffect, useContext } from "react";
import { toast } from "react-toastify";

import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Chip from "@material-ui/core/Chip";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { isArray } from "lodash";
import { AddCircle, Tag as TagIcon } from "@mui/icons-material";
import { CircularProgress, Grid, Stack } from "@mui/material";
import { Can } from "../../components/Can";
import { AuthContext } from "../../context/Auth/AuthContext";
import CampaignModalPhrase from "../../components/CampaignModalPhrase";

const reducer = (state, action) => {
  if (action.type === "LOAD_CAMPAIGNS") {
    const campaigns = action.payload;
    const newCampaigns = [];

    if (isArray(campaigns)) {
      campaigns.forEach((campaign) => {
        const campaignIndex = state.findIndex((u) => u.id === campaign.id);
        if (campaignIndex !== -1) {
          state[campaignIndex] = campaign;
        } else {
          newCampaigns.push(campaign);
        }
      });
    }

    return [...state, ...newCampaigns];
  }

  if (action.type === "UPDATE_CAMPAIGNS") {
    const campaign = action.payload;
    const campaignIndex = state.findIndex((u) => u.id === campaign.id);

    if (campaignIndex !== -1) {
      state[campaignIndex] = campaign;
      return [...state];
    } else {
      return [campaign, ...state];
    }
  }

  if (action.type === "DELETE_CAMPAIGN") {
    const campaignId = action.payload;

    const campaignIndex = state.findIndex((u) => u.id === campaignId);
    if (campaignIndex !== -1) {
      state.splice(campaignIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    borderRadius: 12,
    padding: theme.spacing(2),
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  actionIcon: {
    opacity: 0.55,
    transition: theme.transitions.create("opacity", {
      duration: theme.transitions.duration.shorter,
    }),
    "&:hover": {
      opacity: 1,
    },
  },
}));

const CampaignsPhrase = () => {
  const classes = useStyles();
  const history = useHistory();

  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingContact, setDeletingContact] = useState(null);

  const [campaignflows, setCampaignFlows] = useState([]);
  const [ModalOpenPhrase, setModalOpenPhrase] = useState(false);
  const [campaignflowSelected, setCampaignFlowSelected] = useState();

  const handleDeleteCampaign = async (campaignId) => {
    try {
      await api.delete(`/flowcampaign/${campaignId}`);
      toast.success("Frase deletada");
      getCampaigns();
    } catch (err) {
      toastError(err);
    }
  };

  const getCampaigns = async () => {
    setLoading(true);
    await api
      .get("/flowcampaign")
      .then((res) => {
        setCampaignFlows(Array.isArray(res.data?.flow) ? res.data.flow : []);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const onSaveModal = () => {
    getCampaigns();
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
    }
  };

  useEffect(() => {
    getCampaigns();
  }, []);

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          deletingContact &&
          `${i18n.t("campaigns.confirmationModal.deleteTitle")} ${
            deletingContact.name
          }?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => deletingContact && handleDeleteCampaign(deletingContact.id)}
      >
        {i18n.t("campaigns.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <CampaignModalPhrase
        open={ModalOpenPhrase}
        onClose={() => setModalOpenPhrase(false)}
        FlowCampaignId={campaignflowSelected}
        onSave={onSaveModal}
      />

      <MainHeader>
        <Grid style={{ width: "99.6%" }} container>
          <Grid xs={12} sm={8} item>
            <Title>Campanhas</Title>
          </Grid>
          <Grid xs={12} sm={4} item>
            <Grid spacing={2} container>
              <Grid xs={6} sm={6} item>
                {/* <TextField
                  fullWidth
                  placeholder={i18n.t("campaigns.searchPlaceholder")}
                  type="search"
                  value={searchParam}
                  onChange={handleSearch}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon style={{ color: "gray" }} />
                      </InputAdornment>
                    ),
                  }}
                /> */}
              </Grid>
              <Grid xs={6} sm={6} item>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => {
                    setCampaignFlowSelected();
                    setModalOpenPhrase(true);
                  }}
                  color="primary"
                  style={{ textTransform: "none" }}
                >
                  <Stack direction={"row"} gap={1}>
                    <AddCircle />
                    {"Campanha"}
                  </Stack>
                </Button>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </MainHeader>
      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        {loading && !(Array.isArray(campaignflows) && campaignflows.length) ? (
          <Stack
            justifyContent="center"
            alignItems="center"
            minHeight="50vh"
          >
            <CircularProgress />
          </Stack>
        ) : (
          <Table size="medium">
            <TableHead>
              <TableRow>
                <TableCell style={{ fontWeight: 600, fontSize: "0.8125rem" }}>
                  Nome
                </TableCell>
                <TableCell align="center" style={{ fontWeight: 600, width: 140, fontSize: "0.8125rem" }}>
                  Status
                </TableCell>
                <TableCell align="right" style={{ fontWeight: 600, width: 120, fontSize: "0.8125rem" }}>
                  {i18n.t("contacts.table.actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(Array.isArray(campaignflows) ? campaignflows : []).map((flow) => (
                <TableRow
                  key={flow.id}
                  hover
                  style={{ verticalAlign: "middle" }}
                >
                  <TableCell
                    onClick={() => {
                      setCampaignFlowSelected(flow.id);
                      setModalOpenPhrase(true);
                    }}
                    style={{
                      cursor: "pointer",
                      maxWidth: 400,
                      transition: "background-color 0.15s ease",
                    }}
                  >
                    <Box display="flex" alignItems="flex-start" style={{ gap: 12 }}>
                      <TagIcon
                        style={{
                          color: "#24c776",
                          fontSize: 26,
                          flexShrink: 0,
                          marginTop: 2,
                          opacity: 0.92,
                        }}
                      />
                      <Box minWidth={0}>
                        <Typography variant="body1" style={{ fontWeight: 600, lineHeight: 1.35 }}>
                          {flow.name}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    {flow.status ? (
                      <Chip label="Ativo" size="small" style={{ backgroundColor: "#24c776", color: "#fff", fontWeight: 500 }} />
                    ) : (
                      <Chip
                        label="Inativo"
                        size="small"
                        style={{ backgroundColor: "#e0e0e0", color: "#424242", fontWeight: 500 }}
                      />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                      <Tooltip title="Editar">
                        <IconButton
                          size="small"
                          className={classes.actionIcon}
                          aria-label="Editar"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCampaignFlowSelected(flow.id);
                            setModalOpenPhrase(true);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Can
                        role={user.profile}
                        perform="contacts-page:deleteContact"
                        yes={() => (
                          <Tooltip title="Excluir">
                            <IconButton
                              size="small"
                              className={classes.actionIcon}
                              aria-label="Excluir"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmModalOpen(true);
                                setDeletingContact(flow);
                              }}
                              style={{ color: "#d32f2f", opacity: 0.75 }}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      />
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </MainContainer>
  );
};

export default CampaignsPhrase;
