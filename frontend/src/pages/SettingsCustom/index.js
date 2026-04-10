import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import MainContainer from "../../components/MainContainer";
import { Box, makeStyles, Paper, Tabs, Tab, Typography } from "@material-ui/core";
import { AppPageHeader } from "../../ui";
import Alert from "@material-ui/lab/Alert";

import TabPanel from "../../components/TabPanel";

import SchedulesForm from "../../components/SchedulesForm";
import CompaniesManager from "../../components/CompaniesManager";
import PlansManager from "../../components/PlansManager";
import HelpsManager from "../../components/HelpsManager";
import Options from "../../components/Settings/Options";

import { i18n } from "../../translate/i18n.js";
import { toast } from "react-toastify";

import useCompanies from "../../hooks/useCompanies";
import useAuth from "../../hooks/useAuth.js";
import useSettings from "../../hooks/useSettings";

import OnlyForSuperUser from "../../components/OnlyForSuperUser";
import CompanyTimezoneSettings from "../../components/CompanyTimezoneSettings";

const useStyles = makeStyles((theme) => ({
  root: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
    [theme.breakpoints.up("md")]: {
      gap: theme.spacing(3),
    },
  },
  mainPaper: {
    ...theme.scrollbarStyles,
    overflowY: "scroll",
    flex: 1,
  },
  tab: {
    backgroundColor: theme.palette.options,
    borderRadius: 4,
  },
  paper: {
    ...theme.scrollbarStyles,
    overflowY: "scroll",
    padding: theme.spacing(2),
    display: "flex",
    alignItems: "center",
    width: "100%",
  },
  container: {
    width: "100%",
    maxHeight: "100%",
  },
  control: {
    padding: theme.spacing(1),
  },
  textfield: {
    width: "100%",
  },
  pageContextWrap: {
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    paddingTop: theme.spacing(1),
    width: "100%",
  },
  pageContextAlert: {
    width: "100%",
    "& .MuiAlert-message": {
      width: "100%",
    },
  },
}));

const SettingsCustom = () => {
  const classes = useStyles();
  const location = useLocation();
  const [tab, setTab] = useState("options");
  const [schedules, setSchedules] = useState([]);
  const [company, setCompany] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState({});
  const [settings, setSettings] = useState({});
  const [schedulesEnabled, setSchedulesEnabled] = useState(false);

  const { getCurrentUserInfo } = useAuth();
  const { find, updateSchedules } = useCompanies();
  const { getAll: getAllSettings } = useSettings();

  useEffect(() => {
    async function findData() {
      setLoading(true);
      try {
        const companyId = localStorage.getItem("companyId");
        const company = await find(companyId);
        const settingList = await getAllSettings();
        setCompany(company);
        setSchedules(company.schedules);
        setSettings(settingList);

        if (Array.isArray(settingList)) {
          const scheduleType = settingList.find(
            (d) => d.key === "scheduleType"
          );
          if (scheduleType) {
            setSchedulesEnabled(scheduleType.value === "company");
          }
        }

        const user = await getCurrentUserInfo();
        setCurrentUser(user);
      } catch (e) {
        toast.error(e);
      }
      setLoading(false);
    }
    findData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSuperUser = Boolean(currentUser?.super);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const t = params.get("tab");
    if (!t) return;
    const allowed = ["options", "schedules", "companies", "plans", "helps"];
    if (!allowed.includes(t)) return;
    if ((t === "plans" || t === "companies" || t === "helps") && !isSuperUser) {
      return;
    }
    setTab(t);
  }, [location.search, isSuperUser]);

  const handleTabChange = (event, newValue) => {
      async function findData() {
        setLoading(true);
        try {
          const companyId = localStorage.getItem("companyId");
          const company = await find(companyId);
          const settingList = await getAllSettings();
          setCompany(company);
          setSchedules(company.schedules);
          setSettings(settingList);
  
          if (Array.isArray(settingList)) {
            const scheduleType = settingList.find(
              (d) => d.key === "scheduleType"
            );
            if (scheduleType) {
              setSchedulesEnabled(scheduleType.value === "company");
            }
          }
  
          const user = await getCurrentUserInfo();
          setCurrentUser(user);
        } catch (e) {
          toast.error(e);
        }
        setLoading(false);
      }
      findData();
      // eslint-disable-next-line react-hooks/exhaustive-deps

    setTab(newValue);
  };

  const handleSubmitSchedules = async (data) => {
    setLoading(true);
    try {
      setSchedules(data);
      await updateSchedules({ id: company.id, schedules: data });
      toast.success(i18n.t("settings.schedulesUpdated"));
    } catch (e) {
      toast.error(e);
    }
    setLoading(false);
  };

  const isSuper = () => {
    return currentUser.super;
  };

  return (
    <MainContainer className={classes.root}>
      <AppPageHeader
        title={
          <Typography variant="h5" color="primary" component="h1">
            {i18n.t("settings.title")}
          </Typography>
        }
        subtitle={
          <Typography variant="body2" color="textSecondary" component="p">
            {i18n.t("settings.pageSubtitle")}
          </Typography>
        }
      />
      <Paper className={classes.mainPaper} elevation={1}>
        <CompanyTimezoneSettings
          company={company}
          onSaved={(c) => setCompany(c)}
        />
        <Box className={classes.pageContextWrap}>
          <Alert
            severity="info"
            variant="outlined"
            className={classes.pageContextAlert}
          >
            <Typography variant="body2" component="p">
              {i18n.t("settings.customPageIntro")}
            </Typography>
          </Alert>
        </Box>
        <Tabs
          value={tab}
          indicatorColor="primary"
          textColor="primary"
          scrollButtons="on"
          variant="scrollable"
          onChange={handleTabChange}
          className={classes.tab}
        >
          <Tab label={i18n.t("settings.tabs.options")} value={"options"} />
          {schedulesEnabled && <Tab label={i18n.t("settings.tabs.schedules")} value={"schedules"} />}
          {isSuper() ? <Tab label={i18n.t("settings.tabs.companies")} value={"companies"} /> : null}
          {isSuper() ? <Tab label={i18n.t("settings.tabs.plans")} value={"plans"} /> : null}
          {isSuper() ? <Tab label={i18n.t("settings.tabs.helps")} value={"helps"} /> : null}
        </Tabs>
        <Paper className={classes.paper} elevation={0}>
          <TabPanel
            className={classes.container}
            value={tab}
            name={"schedules"}
          >
            <SchedulesForm
              loading={loading}
              onSubmit={handleSubmitSchedules}
              initialValues={schedules}
            />
          </TabPanel>
          <OnlyForSuperUser
            user={currentUser}
            yes={() => (
              <TabPanel
                className={classes.container}
                value={tab}
                name={"companies"}
              >
                <CompaniesManager />
              </TabPanel>
            )}
          />
          <OnlyForSuperUser
            user={currentUser}
            yes={() => (
              <TabPanel
                className={classes.container}
                value={tab}
                name={"plans"}
              >
                <PlansManager />
              </TabPanel>
            )}
          />
          <OnlyForSuperUser
            user={currentUser}
            yes={() => (
              <TabPanel
                className={classes.container}
                value={tab}
                name={"helps"}
              >
                <HelpsManager />
              </TabPanel>
            )}
          />
          <TabPanel className={classes.container} value={tab} name={"options"}>
            <Options
              settings={settings}
              scheduleTypeChanged={(value) =>
                setSchedulesEnabled(value === "company")
              }
            />
          </TabPanel>
        </Paper>
      </Paper>
    </MainContainer>
  );
};

export default SettingsCustom;
