import { join } from "path";
import { loadOrInitUberConf, writeExternalConfigFiles } from "./uberconf";

async function main() {
  const rootConfigDir = process.env.COAXIST_ROOT_CONFIG_DIR;
  if (!rootConfigDir) throw new Error("COAXIST_ROOT_CONFIG_DIR not set");
  const path = join(rootConfigDir, "config.yaml");
  const config = await loadOrInitUberConf(path);
  writeExternalConfigFiles(rootConfigDir, config);
}

if (require.main === module) main();
