import "dotenv/config";
import { initDb } from "./db/init.js";
import { createApp } from "./app.js";

const port = Number(process.env.PORT || 4000);
initDb();
const app = createApp();
app.listen(port, () => {
  console.log(`SellerFix backend listening on http://localhost:${port}`);
});
