import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Finder } from "./src/finder";
import "./src/styles.css";

/**
 * Standalone entry for the static guest build.
 *
 * The bundle is served from inside the emulated Linux, so the project list
 * cannot be fetched from the host's `/api/github` yet; pass an empty source
 * and let the Finder render its empty state until the sim bridge lands.
 */
const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <Finder source="" />
    </StrictMode>,
  );
}
