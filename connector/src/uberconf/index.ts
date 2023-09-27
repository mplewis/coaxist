import { parseConfig, writeExternalConfigFiles } from "./uberconf";

async function main() {
  const rootConfigDir = process.env.COAXIST_CONFIG_DIR;
  if (!rootConfigDir) throw new Error("COAXIST_CONFIG_DIR not set");
  const config = await parseConfig(rootConfigDir);
  writeExternalConfigFiles(rootConfigDir, config);
}

if (require.main === module) main();