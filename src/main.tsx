import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./lib/i18n";
import "./index.css";
import { App } from "./App";
import { startErrorReporting } from "./lib/errorReport";
import { startSession } from "./lib/session";

startErrorReporting();
startSession();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
