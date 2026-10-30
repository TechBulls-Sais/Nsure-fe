import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./ui/kit.css";
import "./ui/navigation.css";
import { MotionProvider } from "./ui/animated";
import { ConfirmProvider } from "./ui/overlay";
import { applyTheme } from "./ui/theme";
import { ToastProvider } from "./ui/toast";

applyTheme();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MotionProvider>
      <ToastProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </ToastProvider>
    </MotionProvider>
  </React.StrictMode>,
);
