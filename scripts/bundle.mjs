// Assembles the ES modules of src/<stem>/ back into the single ES module the integration serves
// (custom_components/proxmox_panel/frontend/<stem>.js): the modules listed by the entry file, in that order, with
// their imports of one another removed. They come from one file and share its names, so nothing else changes:
// comments and the order of the code stay as written.
// - `export` is kept only on the declarations the entry file re-exports (the file's own exports); the other
//   `export`s only join the modules and are dropped.
// - An import of a file outside src/<stem>/ (proxmox-common.js…) is kept where it first appears, its path rewritten
//   for the assembled file; the same names imported again by a later module are dropped.
// The result is parsed as a module: an import of another module of src/<stem>/ left in it fails the build.
import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "acorn";

const root = fileURLToPath(new URL("..", import.meta.url));
const SIDE = /^import "(\.{1,2}\/[^"]+)";$/gm;
const PUBLIC = /^export \{ ([\w, ]+) \} from "\.\/[^"]+";$/gm;
const parseModule = (code) => parse(code, { ecmaVersion: "latest", sourceType: "module" });
const declared = (d) => (d.type === "VariableDeclaration" ? d.declarations.map((x) => x.id.name) : [d.id.name]);

/** src/<stem>/index.js assembled into the module written to `out` (both relative to the repository root). */
export const bundle = (entry, out) => {
  const path = join(root, entry);
  const dir = dirname(path);
  const outDir = dirname(join(root, out));
  const index = readFileSync(path, "utf8");
  const exported = new Set([...index.matchAll(PUBLIC)].flatMap((m) => m[1].split(", ")));
  const imported = new Map(); // external file -> names already imported
  const outside = (from, spec) => {
    const target = resolve(dirname(from), spec);
    if (target.startsWith(`${dir}/`)) return null;
    const r = relative(outDir, target);
    return { target, spec: r.startsWith(".") ? r : `./${r}` };
  };
  const parts = [...index.matchAll(SIDE)].map((m) => {
    const file = join(dir, m[1]);
    const code = readFileSync(file, "utf8");
    const edits = [];
    for (const n of parseModule(code).body) {
      const cut = () => edits.push([n.start, code[n.end] === "\n" ? n.end + 1 : n.end, ""]);
      const respec = (ext) => edits.push([n.source.start, n.source.end, JSON.stringify(ext.spec)]);
      if (n.type === "ImportDeclaration") {
        const ext = outside(file, n.source.value);
        if (!ext) cut();
        else {
          const seen = imported.get(ext.target) ?? new Set();
          const names = n.specifiers.map((s) => `${s.imported?.name ?? "default"} as ${s.local.name}`);
          if (seen.size && names.every((x) => seen.has(x))) cut();
          else if (seen.size) throw new Error(`${entry}: ${m[1]} imports ${names.filter((x) => !seen.has(x)).join(", ")} from ${ext.spec}, not imported by an earlier module`);
          else {
            imported.set(ext.target, new Set(names));
            respec(ext);
          }
        }
      } else if (n.type === "ExportNamedDeclaration" && n.source) {
        const ext = outside(file, n.source.value);
        if (!ext) throw new Error(`${entry}: ${m[1]} re-exports a module of the folder`);
        respec(ext);
      } else if (n.type === "ExportNamedDeclaration" && n.declaration) {
        if (!declared(n.declaration).every((x) => exported.has(x))) edits.push([n.start, n.declaration.start, ""]);
      } else if (/^Export/.test(n.type)) throw new Error(`${entry}: ${m[1]}: unsupported ${n.type}`);
    }
    let text = code;
    for (const [a, b, t] of edits.sort((x, y) => y[0] - x[0])) text = text.slice(0, a) + t + text.slice(b);
    return text.replace(/^\n+/, "");
  });
  const code = `${parts.map((p) => p.replace(/\n+$/, "")).join("\n\n")}\n`;
  for (const n of parseModule(code).body)
    if ((n.type === "ImportDeclaration" || n.source) && !outside(join(root, out), n.source.value)) throw new Error(`${entry}: ${n.source.value} left in the bundle`);
  return code;
};
