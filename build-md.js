/* Regenerates players.md (human/ChatGPT-friendly) from players.json.
   Run:  node build-md.js
   players.json is the single source of truth — do not edit players.md by hand. */
const fs = require("fs");

const players = JSON.parse(fs.readFileSync("players.json", "utf8"));
const POS = { GK:"Goalkeeper", DEF:"Defender", MID:"Midfielder", FWD:"Striker" };

function bornCell(p){
  if(!p.dob) return "";
  if(p.died) return `${p.dob.slice(0,4)}–${p.died.slice(0,4)} (RIP)`;
  return p.dob;
}
function trophies(h){
  if(!h) return "—";
  const parts = [];
  if(h.wc) parts.push(`World Cup ×${h.wc}`);
  if(h.cl) parts.push(`Champions League ×${h.cl}`);
  if(h.bo) parts.push(`Ballon d'Or ×${h.bo}`);
  if(h.co) parts.push(`Continental ×${h.co}`);
  return parts.length ? parts.join(", ") : "—";
}
const esc = s => String(s == null ? "" : s).replace(/\|/g, "\\|");

let md = `# Soccer Players — Master List\n\n`;
md += `**${players.length} players.** This file is auto-generated from \`players.json\` (the single source of truth) by \`build-md.js\`. Do not edit it by hand — edit \`players.json\` and re-run the generator.\n\n`;
md += `Live data: https://tdooher11.github.io/soccer-players/players.json\n\n`;

md += `| # | Player | Country | Position | Team / Status | Born | Trophies | Career clubs |\n`;
md += `|---:|---|---|---|---|---|---|---|\n`;
players.forEach((p, i) => {
  const status = p.currentClub === "Retired" ? (p.died ? "Retired (RIP)" : "Retired / Legend") : p.currentClub;
  md += `| ${i+1} | ${esc(p.name)} | ${esc(p.country)} | ${POS[p.pos] || p.pos || ""} | ${esc(status)} | ${bornCell(p)} | ${esc(trophies(p.honors))} | ${esc((p.clubs||[]).join(" → "))} |\n`;
});

md += `\n## Fun facts\n\n`;
players.forEach(p => {
  if(p.funFact) md += `- **${p.name}** — ${p.funFact}\n`;
});
md += `\n`;

fs.writeFileSync("players.md", md);
console.log(`players.md written (${players.length} players)`);
