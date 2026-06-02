import React, { useContext } from "react";
import { Route as RouterRoute, Redirect } from "react-router-dom";

import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import { canAccessSaasPlatform } from "../utils/platformUser";

const Route = ({ component: Component, isPrivate = false, ...rest }) => {
  const { isAuth, loading, user } = useContext(AuthContext);
  const hasToken =
    typeof window !== "undefined" && Boolean(localStorage.getItem("token"));

  if (!isAuth && isPrivate) {
    if (loading && hasToken) {
      return <BackdropLoading />;
    }
    return <Redirect to={{ pathname: "/login", state: { from: rest.location } }} />;
  }

  if (isAuth && !isPrivate) {
    if (loading) {
      return <BackdropLoading />;
    }
    const home = canAccessSaasPlatform(user) ? "/saas" : "/";
    return <Redirect to={{ pathname: home, state: { from: rest.location } }} />;
  }

  if (isPrivate && loading && hasToken) {
    return <BackdropLoading />;
  }

  return (
    <RouterRoute
      {...rest}
      {...(Component ? { component: Component } : {})}
    />
  );
};

export default Route;
