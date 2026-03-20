import fs from "fs";
import path from "path";

const filePath = path.join(
  process.cwd(),
  "src",
  "integrations",
  "supabase",
  "types.ts",
);
console.log(`Reading ${filePath}`);
try {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").slice(0, 300);
  console.log(lines.join("\n"));
} catch (err) {
  console.error("Error reading file:", err);
}
