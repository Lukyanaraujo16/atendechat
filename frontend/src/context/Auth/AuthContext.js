import React, { createContext, useMemo } from "react";

import useAuth from "../../hooks/useAuth.js";
import { countPostLogin } from "../../utils/postLoginDebug";

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
	const {
		loading,
		user,
		isAuth,
		handleLogin,
		handleLogout,
		getCurrentUserInfo,
		enterSupportMode,
		exitSupportMode,
	} = useAuth();

	countPostLogin("AuthProvider render");

	const value = useMemo(
		() => ({
			loading,
			user,
			isAuth,
			handleLogin,
			handleLogout,
			getCurrentUserInfo,
			enterSupportMode,
			exitSupportMode,
		}),
		[
			loading,
			user,
			isAuth,
			handleLogin,
			handleLogout,
			getCurrentUserInfo,
			enterSupportMode,
			exitSupportMode,
		]
	);

	return (
		<AuthContext.Provider value={value}>
			{children}
		</AuthContext.Provider>
	);
};

export { AuthContext, AuthProvider };
