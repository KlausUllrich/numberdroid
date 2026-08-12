import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./meta/MetaGame.css";
import "./ui-polish.css";

const root = document.getElementById("root");
if (!root) throw new Error("Numberdroid: #root fehlt.");
createRoot(root).render(<StrictMode><App /></StrictMode>);


if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => undefined));
}
