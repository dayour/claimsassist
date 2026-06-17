import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyTheme, getSavedTheme } from "./lib/theme";

// Apply the saved theme before the first paint to avoid a flash of the default.
applyTheme(getSavedTheme());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
