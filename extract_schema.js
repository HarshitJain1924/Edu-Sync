import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "src/integrations/supabase/types.ts");

try {
  let content = fs.readFileSync(filePath);
  // detected encoding? assume utf-8 first, if it looks like nulls, try utf16le
  let text = content.toString("utf-8");
  if (text.includes("\u0000")) {
    text = content.toString("utf16le");
  }

  // Find "Tables" section
  const start = text.indexOf("Tables: {");
  if (start === -1) {
    console.log('Could not find "Tables: {" in file.');
    // print first 500 chars to debug
    console.log(text.substring(0, 500));
  } else {
    // Print the next 2000 chars which should cover most table names
    console.log(text.substring(start, start + 5000));
  }
} catch (e) {
  console.error(e);
}
