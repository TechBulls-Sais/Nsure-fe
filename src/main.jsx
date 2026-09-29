import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { MotionProvider } from "./ui/animated";
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MotionProvider>
      <App />
    </MotionProvider>
  </React.StrictMode>,
);
