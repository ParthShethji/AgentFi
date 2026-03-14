import express from "express";
import dotenv from "dotenv";
import lendingRoutes = require("./lending.routes");

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", frontendOrigin);
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "agentfi-lending-api" });
});

app.use("/lending", lendingRoutes);

app.listen(port, () => {
  console.log(`[api] AgentFi backend running on port ${port}`);
});
