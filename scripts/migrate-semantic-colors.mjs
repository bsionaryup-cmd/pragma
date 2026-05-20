/**
 * One-time migration helper — replaces hardcoded Tailwind colors with PRAGMA semantic tokens.
 */
import fs from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), "src");

const REPLACEMENTS = [
  [/\bbg-zinc-\d+\b/g, "bg-muted"],
  [/\bbg-neutral-\d+\b/g, "bg-muted"],
  [/\bbg-gray-\d+\b/g, "bg-muted"],
  [/\bbg-slate-\d+\b/g, "bg-muted"],
  [/\btext-zinc-\d+\b/g, "text-muted-foreground"],
  [/\btext-neutral-\d+\b/g, "text-muted-foreground"],
  [/\btext-gray-\d+\b/g, "text-muted-foreground"],
  [/\btext-slate-\d+\b/g, "text-muted-foreground"],
  [/\bborder-zinc-\d+\b/g, "border-border"],
  [/\bborder-neutral-\d+\b/g, "border-border"],
  [/\bborder-gray-\d+\b/g, "border-border"],
  [/\bborder-slate-\d+\b/g, "border-border"],
  [/\bbg-black\/\d+\b/g, "bg-overlay"],
  [/\btext-white\/80\b/g, "text-primary-foreground/80"],
  [/\btext-white\/90\b/g, "text-primary-foreground/90"],
  [/\btext-white\b/g, "text-primary-foreground"],
  [/\bbg-white\/10\b/g, "bg-primary-foreground/10"],
  [/\bbg-white\/5\b/g, "bg-primary-foreground/5"],
  [/\bbg-white\b/g, "bg-card"],
  [/\bhover:bg-white\/90\b/g, "hover:bg-primary-foreground/90"],
  [/\bfrom-white\/20\b/g, "from-primary-foreground/20"],
  [/\btext-rose-600\b/g, "text-danger"],
  [/\btext-rose-700\b/g, "text-danger"],
  [/\bborder-rose-\d+\b/g, "border-danger/30"],
  [/\bbg-rose-\d+\b/g, "bg-danger/10"],
  [/\bhover:bg-rose-\d+\b/g, "hover:bg-danger/15"],
  [/\btext-emerald-\d+\b/g, "text-success"],
  [/\bbg-emerald-\d+\b/g, "bg-success"],
  [/\bborder-emerald-\d+\b/g, "border-success/30"],
  [/\btext-amber-\d+\b/g, "text-warning"],
  [/\bbg-amber-\d+\b/g, "bg-warning"],
  [/\bborder-amber-\d+\b/g, "border-warning/30"],
  [/\bfrom-violet-\d+\b/g, "from-primary"],
  [/\bto-violet-\d+\b/g, "to-primary"],
  [/\btext-violet-\d+\b/g, "text-primary"],
  [/\bbg-violet-\d+\b/g, "bg-primary"],
  [/\bdark:bg-input\/30\b/g, "bg-card"],
  [/\bdark:bg-destructive\/60\b/g, "bg-destructive"],
  [/\bdark:focus-visible:ring-destructive\/40\b/g, "focus-visible:ring-destructive/40"],
  [/\bdark:hover:bg-accent\/50\b/g, "hover:bg-accent"],
  [/\bdark:border-input\b/g, "border-border"],
  [/\bdark:bg-zinc-\d+\b/g, "bg-muted"],
  [/\bdark:text-zinc-\d+\b/g, "text-muted-foreground"],
  [/\blight:/g, "LIGHTPLACEHOLDER:"],
];

const SKIP_FILES = new Set(["globals.css", "colors.ts"]);

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (name === "node_modules") continue;
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, files);
    else if (/\.(tsx|ts|css)$/.test(name) && !SKIP_FILES.has(name))
      files.push(p);
  }
  return files;
}

let changed = 0;
for (const file of walk(ROOT)) {
  let content = fs.readFileSync(file, "utf8");
  const original = content;
  for (const [re, sub] of REPLACEMENTS) {
    content = content.replace(re, sub);
  }
  content = content.replace(/LIGHTPLACEHOLDER:/g, "light:");
  if (content !== original) {
    fs.writeFileSync(file, content);
    changed++;
    console.log(path.relative(process.cwd(), file));
  }
}
console.log(`\nUpdated ${changed} files.`);
