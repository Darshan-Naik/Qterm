import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/globals.css";

// Radix UI ContextMenu handles its own preventDefault(), so we only need to
// block the native menu where Radix didn't handle it.
import { disableNativeContextMenu } from "./lib/disableNativeContextMenu";
disableNativeContextMenu();

const container = document.getElementById("root");
createRoot(container!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
