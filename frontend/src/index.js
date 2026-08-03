import React from "react";
import ReactDOM from "react-dom";

import App from "./App";
import AppErrorBoundary from "./components/AppErrorBoundary";

ReactDOM.render(
	<AppErrorBoundary>
		<App />
	</AppErrorBoundary>,
	document.getElementById("root")
);

/** Service worker: desliga Workbox/PWA; OneSignal permanece isolado. */


// ReactDOM.render(
// 	<React.StrictMode>
// 		<CssBaseline>
// 			<App />
// 		</CssBaseline>,
//   </React.StrictMode>

// 	document.getElementById("root")
// );
