// Vercel serverless entry. Build first (`npm run build`); routes /mcp here via vercel.json.
import { handleMcp } from "../dist/http.js";

export default async function handler(req, res) {
  await handleMcp(req, res);
}
