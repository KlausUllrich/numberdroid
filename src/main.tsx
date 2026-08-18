import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { LevelCompilerWorkbench } from "./levelgen/LevelCompilerWorkbench";
import "./styles.css";
import "./meta/MetaGame.css";
import "./ui-polish.css";
import "./art-direction.css";
import "./levelgen/LevelCompilerWorkbench.css";
import "./meta/RobotGrounding.css";

const runtimeParams = new URLSearchParams(window.location.search);
document.documentElement.dataset.groundingDebug = runtimeParams.get("groundingDebug") === "1" ? "1" : "0";
document.documentElement.dataset.buildSha = import.meta.env.VITE_BUILD_SHA ?? "local";

const root = document.getElementById("root");
if (!root) throw new Error("Numberdroid: #root fehlt.");

const levelgenPreview = runtimeParams.get("levelgen");
const content = levelgenPreview === "ts01" ? <LevelCompilerWorkbench /> : <App />;
createRoot(root).render(<StrictMode>{content}</StrictMode>);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => undefined));
}
