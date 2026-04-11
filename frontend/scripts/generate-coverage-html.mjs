import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';

const root = resolve(process.cwd());
const summaryPath = resolve(root, 'coverage', 'coverage-summary.json');
const outputPath = resolve(root, 'coverage', 'frontend-coverage.html');

const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const total = summary.total;

const files = Object.entries(summary)
  .filter(([k]) => k !== 'total')
  .map(([file, data]) => ({
    file: relative(root, file).split(sep).join('/'),
    statements: data.statements.pct,
    branches: data.branches.pct,
    functions: data.functions.pct,
    lines: data.lines.pct,
  }))
  .sort((a, b) => a.file.localeCompare(b.file));

const color = (pct) => {
  if (pct >= 80) return '#22c55e';
  if (pct >= 50) return '#eab308';
  return '#ef4444';
};

const bar = (pct) => `
  <div style="display:flex;align-items:center;">
    <div style="position:relative;width:120px;height:14px;background:#e5e7eb;border-radius:3px;overflow:hidden;">
      <div style="width:${pct}%;height:100%;background:${color(pct)};"></div>
    </div>
    <span style="margin-left:8px;font-variant-numeric:tabular-nums;font-size:12px;color:#334155;">${pct.toFixed(1)}%</span>
  </div>
`;

const row = (f) => `
  <tr>
    <td style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#0f172a;">${f.file}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${bar(f.statements)}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${bar(f.branches)}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${bar(f.functions)}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${bar(f.lines)}</td>
  </tr>
`;

const totalCard = (label, pct) => `
  <div style="flex:1;min-width:180px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px 24px;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;font-weight:600;">${label}</div>
    <div style="font-size:32px;font-weight:700;color:${color(pct)};margin-top:8px;">${pct.toFixed(1)}%</div>
  </div>
`;

const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Frontend Coverage Report</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 32px; }
  .wrap { max-width: 1200px; margin: 0 auto; }
  h1 { margin: 0 0 6px; font-size: 26px; }
  .subtitle { color: #64748b; font-size: 14px; margin-bottom: 28px; }
  .totals { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 32px; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  th { text-align: left; padding: 12px; background: #f1f5f9; font-size: 11px; text-transform: uppercase; color: #475569; letter-spacing: 0.8px; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #f8fafc; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>Frontend Coverage Report</h1>
    <div class="subtitle">Generated ${timestamp} UTC &middot; ${files.length} files</div>
    <div class="totals">
      ${totalCard('Statements', total.statements.pct)}
      ${totalCard('Branches', total.branches.pct)}
      ${totalCard('Functions', total.functions.pct)}
      ${totalCard('Lines', total.lines.pct)}
    </div>
    <table>
      <thead>
        <tr>
          <th>File</th>
          <th>Statements</th>
          <th>Branches</th>
          <th>Functions</th>
          <th>Lines</th>
        </tr>
      </thead>
      <tbody>
        ${files.map(row).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;

writeFileSync(outputPath, html, 'utf8');
console.log(`Wrote ${outputPath}`);
