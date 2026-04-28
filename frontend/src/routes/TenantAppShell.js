import React, { useContext } from "react";
import { Redirect } from "react-router-dom";

import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import LoggedInLayout from "../layout";
import { canAccessSaasPlatform } from "../utils/platformUser";

/**
 * Garante que Super Admin sem empresa nunca monta o shell tenant (drawer, chats, socket de fila).
 */
export default function TenantAppShell({ children }) {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return <BackdropLoading />;
  }

  if (canAccessSaasPlatform(user)) {
    return <Redirect to="/saas" />;
  }

  return <LoggedInLayout>{children}</LoggedInLayout>;
}
