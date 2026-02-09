import fs from "fs";
import path from "path";

export const getPortForSite = async (siteName) => {
  const filePath = path.resolve(__dirname, "../../site-ports.json");
  if (!fs.existsSync(filePath)) return null;
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return data[siteName];
};
