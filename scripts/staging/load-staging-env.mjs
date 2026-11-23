/** Load staging env without falling back to operational .env.local */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
config({ path: resolve(root, ".env") });
const stagingPath = resolve(root, ".env.staging");
if (!existsSync(stagingPath)) {
  console.error("❌ Falta .env.staging — copia .env.staging.example y configura Neon staging.");
  process.exit(1);
}
config({ path: stagingPath, override: true });

// Never keep operational local overrides if accidentally set in shell
delete process.env.NEXT_PUBLIC_CLERK_PROXY_URL;
delete process.env.CLERK_PROXY_URL;
