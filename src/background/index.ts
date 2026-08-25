import OBR, { type Metadata } from "@owlbear-rodeo/sdk";
import { getRenderDistance, radiusForRenderDistance } from "../config/localSettings";
import { readBackgroundConfig } from "../config/sceneConfig";
import { RENDER_DISTANCE_EVENT, RENDER_DISTANCE_KEY, VIEWPORT_POLL_INTERVAL_MS } from "../constants";
import { TiledBackgroundRenderer } from "./renderer";

const renderer = new TiledBackgroundRenderer();
let currentConfigFingerprint = "";
let currentRadius = -1;
let pollInProgress = false;
let pollCount = 0;
let operation = Promise.resolve();

function enqueue(task: () => Promise<void>): void {
  operation = operation.then(task, task).catch((cause) => {
    currentConfigFingerprint = "";
    currentRadius = -1;
    console.error("[OBR Battle Mat] Background renderer operation failed.", cause);
  });
}

async function synchronize(metadata?: Metadata): Promise<void> {
  if (!(await OBR.scene.isReady())) {
    currentConfigFingerprint = "";
    currentRadius = -1;
    await renderer.stop();
    return;
  }
  const config = readBackgroundConfig(metadata ?? await OBR.scene.getMetadata());
  const radius = radiusForRenderDistance(getRenderDistance());
  const fingerprint = config ? JSON.stringify(config) : "";
  if (!config?.enabled || !config.image || !config.grid || radius === 0) {
    currentConfigFingerprint = fingerprint;
    currentRadius = radius;
    await renderer.stop();
    return;
  }
  if (fingerprint !== currentConfigFingerprint || !renderer.active) {
    currentConfigFingerprint = fingerprint;
    currentRadius = radius;
    await renderer.start(config, radius);
    await renderer.updateFromViewport();
  } else if (radius !== currentRadius) {
    currentRadius = radius;
    await renderer.setRenderRadius(radius);
  }
}

async function pollViewport(): Promise<void> {
  if (!renderer.active || pollInProgress) return;
  pollInProgress = true;
  try {
    await renderer.updateFromViewport();
    pollCount += 1;
    if (pollCount % 20 === 0) await renderer.validatePool();
  } finally {
    pollInProgress = false;
  }
}

OBR.onReady(() => {
  OBR.scene.onReadyChange(() => enqueue(() => synchronize()));
  OBR.scene.onMetadataChange((metadata) => enqueue(() => synchronize(metadata)));
  window.addEventListener("storage", (event) => {
    if (event.key === RENDER_DISTANCE_KEY) enqueue(() => synchronize());
  });
  window.addEventListener(RENDER_DISTANCE_EVENT, () => enqueue(() => synchronize()));
  window.setInterval(() => {
    void pollViewport().catch((cause) => {
      console.error("[OBR Battle Mat] Viewport update failed.", cause);
    });
  }, VIEWPORT_POLL_INTERVAL_MS);
  enqueue(() => synchronize());
});
