import express from "express";
import path from "path";
import { loadConfig } from "~/config/config";

const config = loadConfig("production");
if (config.isErr()) {
  throw config.error;
}

const app = express();
const port = config.value.ASSET_SERVER_PORT;

const assetPath = path.join(config.value.PROJECT_ROOT, "src/backend/assets");

// Serve static files
app.use(express.static(assetPath));

// Start the server
app.listen(port, () => {
  console.log(`✅ Asset server is running on port ${port}`);
  console.log("Serving assets at: " + assetPath);
});
