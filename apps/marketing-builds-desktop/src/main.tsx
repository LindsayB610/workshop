import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { SlatePreview } from "./tools/slate/SlatePreview";
import "./styles/app.css";

const Root = import.meta.env.DEV && import.meta.env.VITE_SLATE_PREVIEW === "true" ? SlatePreview : App;

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
