import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import { disableNativeContextMenu } from "./lib/disableNativeContextMenu";
import "./styles/globals.css";

disableNativeContextMenu();

const container = document.getElementById("root");
createRoot(container!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
