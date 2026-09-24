import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Plugin } from "vite";
export function pwaVersion(): Plugin {
 return { name:"memorate-pwa-version", apply:"build", async closeBundle() {
   const root="dist/client";
   try {
     const paths=(await readdir(root,{recursive:true})).filter(p=>/\.(?:js|css)$/.test(p)&&p!=="sw.js").sort();
     const hash=createHash("sha256");for(const path of paths)hash.update(await readFile(join(root,path)));
     const source=await readFile("public/sw.js","utf8");hash.update(source);
     await writeFile(join(root,"sw.js"),source.replace('memorate-shell-v5',`memorate-shell-${hash.digest("hex").slice(0,16)}`));
   } catch(error) { if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error; }
 }};
}
