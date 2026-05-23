import type { AppUser, Cell, CellReport, Person } from "@/lib/data";
import { roleLabels } from "@/lib/data";
import { getCellStats, getOverallStats } from "@/lib/reports";

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildReportSummary({
  user,
  cells,
  people,
  reports,
}: {
  user: AppUser;
  cells: Cell[];
  people: Person[];
  reports: CellReport[];
}) {
  const overall = getOverallStats(cells, people);
  const attendance = overall.people ? Math.round((overall.present / overall.people) * 100) : 0;

  return [
    "Ovelhas - Relatorio de celulas",
    "By Savio Cipriano",
    `Responsavel: ${user.name} (${roleLabels[user.role]})`,
    `Celulas: ${overall.cells}`,
    `Pessoas acompanhadas: ${overall.people}`,
    `Presenca nas celulas: ${attendance}%`,
    `Pessoas no culto: ${overall.servicePresent}`,
    `Pessoas em atencao: ${overall.attention}`,
    `Progresso medio no discipulado: ${overall.averageProgress}%`,
    "",
    "Relatorios recentes:",
    ...reports.slice(0, 5).map((report) => `- ${report.cellName} (${report.meetingDate}): ${report.highlights}`),
  ].join("\n");
}

export function buildReportHtml({
  user,
  cells,
  people,
  reports,
}: {
  user: AppUser;
  cells: Cell[];
  people: Person[];
  reports: CellReport[];
}) {
  const overall = getOverallStats(cells, people);
  const attendance = overall.people ? Math.round((overall.present / overall.people) * 100) : 0;
  const generatedAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());

  const cellRows = cells
    .map((cell) => {
      const stats = getCellStats(cell, people);
      return `
        <tr>
          <td>
            <strong>${escapeHtml(cell.name)}</strong>
            <span>${escapeHtml(cell.neighborhood)} - ${escapeHtml(cell.meetingDay)}, ${escapeHtml(cell.meetingTime)}</span>
          </td>
          <td>${escapeHtml(cell.leaderName)}</td>
          <td>${stats.total}</td>
          <td>${stats.present}</td>
          <td>${stats.servicePresent}</td>
          <td>${stats.attention}</td>
          <td>${stats.averageProgress}%</td>
        </tr>
      `;
    })
    .join("");

  const reportCards = reports.length
    ? reports
        .slice(0, 8)
        .map(
          (report) => `
            <article class="report-card">
              <div class="report-head">
                <div>
                  <p class="eyebrow">${escapeHtml(report.meetingDate)}</p>
                  <h3>${escapeHtml(report.cellName)}</h3>
                  <p>Lider: ${escapeHtml(report.leaderName)}</p>
                </div>
                <strong>${escapeHtml(report.presentCount)} presentes</strong>
              </div>
              <div class="mini-grid">
                <span><b>${escapeHtml(report.visitorsCount)}</b> visitantes</span>
                <span><b>${escapeHtml(report.serviceCount)}</b> culto</span>
                <span><b>${escapeHtml(report.decisionsCount)}</b> decisoes</span>
              </div>
              <p>${escapeHtml(report.highlights || "Sem destaques registrados.")}</p>
              ${
                report.needs
                  ? `<p><b>Acompanhar:</b> ${escapeHtml(report.needs)}</p>`
                  : ""
              }
              ${
                report.prayerRequests
                  ? `<p><b>Oracao:</b> ${escapeHtml(report.prayerRequests)}</p>`
                  : ""
              }
            </article>
          `,
        )
        .join("")
    : `<div class="empty">Nenhum relatorio recente registrado.</div>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Relatorio Ovelhas</title>
  <style>
    :root {
      color: #17211d;
      background: #f7f8f3;
      font-family: Inter, Arial, sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f7f8f3; }
    .page { max-width: 1040px; margin: 0 auto; padding: 32px 20px 48px; }
    .cover {
      border-radius: 24px;
      padding: 32px;
      color: white;
      background: linear-gradient(135deg, #064e3b, #0f766e 48%, #2563eb);
      box-shadow: 0 18px 45px rgba(15, 23, 42, 0.16);
    }
    .brand { display: flex; align-items: center; gap: 14px; margin-bottom: 28px; }
    .logo {
      width: 52px; height: 52px; border-radius: 16px;
      display: grid; place-items: center;
      color: #064e3b; background: #ecfdf5; font-weight: 900; font-size: 24px;
    }
    .brand strong { display: block; font-size: 20px; }
    .brand span { display: block; color: #d1fae5; font-size: 13px; margin-top: 3px; }
    h1 { margin: 0; font-size: clamp(30px, 6vw, 54px); line-height: 1; letter-spacing: 0; }
    .cover p { max-width: 720px; color: #dbeafe; line-height: 1.65; }
    .meta { margin-top: 22px; display: flex; flex-wrap: wrap; gap: 10px; }
    .pill { border-radius: 999px; padding: 9px 13px; background: rgba(255,255,255,.14); font-size: 13px; font-weight: 700; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
    .stat { border-radius: 18px; padding: 18px; background: white; border: 1px solid #e5e7eb; }
    .stat span { color: #64748b; font-size: 12px; font-weight: 800; text-transform: uppercase; }
    .stat strong { display: block; color: #0f172a; font-size: 30px; margin-top: 8px; }
    section { margin-top: 20px; border-radius: 22px; padding: 24px; background: white; border: 1px solid #e5e7eb; }
    h2 { margin: 0 0 16px; font-size: 22px; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; }
    th { text-align: left; color: #64748b; font-size: 12px; text-transform: uppercase; padding: 12px; border-bottom: 1px solid #e5e7eb; }
    td { padding: 14px 12px; border-bottom: 1px solid #eef2f7; vertical-align: top; }
    td span { display: block; color: #64748b; font-size: 12px; margin-top: 4px; }
    .reports { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .report-card { border-radius: 18px; background: #f8fafc; padding: 16px; border: 1px solid #eef2f7; }
    .report-head { display: flex; justify-content: space-between; gap: 16px; align-items: start; }
    .report-head h3 { margin: 3px 0; font-size: 18px; }
    .report-head p { margin: 0; color: #64748b; font-size: 13px; }
    .report-head strong { white-space: nowrap; border-radius: 12px; padding: 8px 10px; background: white; color: #065f46; font-size: 12px; }
    .eyebrow { color: #047857 !important; font-size: 11px !important; font-weight: 900; text-transform: uppercase; }
    .mini-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 14px 0; }
    .mini-grid span { border-radius: 12px; background: white; padding: 10px; color: #64748b; font-size: 12px; text-align: center; }
    .mini-grid b { display: block; color: #0f172a; font-size: 18px; }
    .report-card p { color: #475569; line-height: 1.55; font-size: 14px; }
    .empty { border-radius: 16px; padding: 20px; background: #f8fafc; color: #64748b; }
    .footer { margin-top: 18px; color: #64748b; font-size: 12px; text-align: center; }
    @media (max-width: 760px) {
      .page { padding: 16px 12px 32px; }
      .cover { padding: 24px; border-radius: 20px; }
      .stats { grid-template-columns: repeat(2, 1fr); }
      .reports { grid-template-columns: 1fr; }
      section { padding: 18px; border-radius: 18px; overflow-x: auto; }
      table { min-width: 720px; }
    }
    @media print {
      body { background: white; }
      .page { max-width: none; padding: 0; }
      .cover, section, .stat { box-shadow: none; }
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="cover">
      <div class="brand">
        <div class="logo">O</div>
        <div>
          <strong>Ovelhas</strong>
          <span>Nenhuma pessoa sem cuidado - by Savio Cipriano</span>
        </div>
      </div>
      <h1>Relatorio de celulas</h1>
      <p>Resumo preparado para acompanhamento pastoral, supervisao de celulas e cuidado com o discipulado.</p>
      <div class="meta">
        <span class="pill">Responsavel: ${escapeHtml(user.name)}</span>
        <span class="pill">Perfil: ${escapeHtml(roleLabels[user.role])}</span>
        <span class="pill">Gerado em: ${escapeHtml(generatedAt)}</span>
      </div>
    </header>

    <div class="stats">
      <div class="stat"><span>Celulas</span><strong>${overall.cells}</strong></div>
      <div class="stat"><span>Pessoas</span><strong>${overall.people}</strong></div>
      <div class="stat"><span>Presenca</span><strong>${attendance}%</strong></div>
      <div class="stat"><span>Atencao</span><strong>${overall.attention}</strong></div>
    </div>

    <section>
      <h2>Indicadores por celula</h2>
      <table>
        <thead>
          <tr>
            <th>Celula</th>
            <th>Lider</th>
            <th>Pessoas</th>
            <th>Presentes</th>
            <th>Culto</th>
            <th>Alertas</th>
            <th>Discipulado</th>
          </tr>
        </thead>
        <tbody>${cellRows}</tbody>
      </table>
    </section>

    <section>
      <h2>Relatorios recentes</h2>
      <div class="reports">${reportCards}</div>
    </section>

    <p class="footer">Relatorio gerado pelo Ovelhas, by Savio Cipriano. Para salvar como PDF, use imprimir e escolha salvar em PDF.</p>
  </main>
</body>
</html>`;
}

export function downloadReportHtml(args: Parameters<typeof buildReportHtml>[0]) {
  const html = buildReportHtml(args);
  const date = new Date().toISOString().slice(0, 10);
  const fileName = `relatorio-ovelhas-${slug(args.user.name)}-${date}.html`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
