import React from "react";
import ReactDOM from "react-dom";

import App from "./App";

ReactDOM.render(
	<App />,
	document.getElementById("root")
);

/** Service worker: OneSignal (quando ativo) ou PWA mínimo — registo em `oneSignalService.bootstrapPushAndPwaServiceWorker`. */

// ReactDOM.render(
// 	<React.StrictMode>
// 		<CssBaseline>
// 			<App />
// 		</CssBaseline>,
//   </React.StrictMode>

// 	document.getElementById("root")
// );
