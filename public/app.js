const $ = id => document.getElementById(id);

let comments = [];
let vodInfo = null;

function escapeCsv(value) {
  const s = value == null ? "" : String(value);
  return '"' + s.replace(/"/g, '""') + '"';
}

function formatOffset(seconds) {
  const n = Number(seconds || 0);
  const ms = Math.round((n % 1) * 1000);
  const total = Math.floor(n);
  const sec = total % 60;
  const min = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  return `${String(hours).padStart(2,"0")}:${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}.${String(ms).padStart(3,"0")}`;
}

function normalizeForExport(rows) {
  return rows.map(r => ({
    Date: r.Date || "",
    "Comment video time": formatOffset(r["Comment video time"]),
    Badge: r.Badge || "",
    Name: r.Name || "",
    Comment: r.Comment || ""
  }));
}

function showStatus(text, error=false) {
  $("status").textContent = text;
  $("status").classList.remove("hidden");
  $("status").classList.toggle("error", error);
}

function renderPreview() {
  const body = $("preview");
  body.innerHTML = "";
  comments.slice(0, 200).forEach(r => {
    const tr = document.createElement("tr");
    const vals = [
      r.Date,
      formatOffset(r["Comment video time"]),
      r.Badge,
      r.Name,
      r.Comment
    ];
    vals.forEach(v => {
      const td = document.createElement("td");
      td.textContent = v ?? "";
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
}

function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function downloadCsv() {
  const rows = normalizeForExport(comments);
  const header = ["Date","Comment video time","Badge","Name","Comment"];
  const csv = [
    header.map(escapeCsv).join(","),
    ...rows.map(r => header.map(h => escapeCsv(r[h])).join(","))
  ].join("\r\n");

  // BOM para Excel reconhecer UTF-8.
  const blob = new Blob(["\uFEFF" + csv], {type:"text/csv;charset=utf-8"});
  downloadBlob(blob, `twitch_${vodInfo?.id || "chat"}_chat.csv`);
}

async function downloadXlsx() {
  $("xlsx").disabled = true;
  showStatus("Gerando arquivo Excel...");
  try {
    const response = await fetch("/api/xlsx", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({comments: normalizeForExport(comments)})
    });
    if (!response.ok) throw new Error(await response.text());
    const blob = await response.blob();
    downloadBlob(blob, `twitch_${vodInfo?.id || "chat"}_chat.xlsx`);
    showStatus("Excel gerado com sucesso.");
  } catch (e) {
    showStatus(e.message || "Não foi possível gerar o Excel.", true);
  } finally {
    $("xlsx").disabled = false;
  }
}

async function startDownload() {
  const vod = $("vod").value.trim();
  if (!vod) {
    showStatus("Informe a URL ou o ID do VOD.", true);
    return;
  }

  comments = [];
  vodInfo = null;
  $("result").classList.add("hidden");
  $("progressWrap").classList.remove("hidden");
  $("progress").style.width = "15%";
  $("download").disabled = true;
  showStatus("Consultando o chat replay da Twitch...");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({vod})
    });

    $("progress").style.width = "75%";
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "Erro ao baixar o chat.");

    comments = data.comments || [];
    if ($("skipEmpty").checked) {
      comments = comments.filter(x => String(x.Comment || "").trim() !== "");
    }

    vodInfo = data.vod || {};
    $("title").textContent = vodInfo.title || `VOD ${vodInfo.id || ""}`;
    $("meta").textContent =
      `${comments.length.toLocaleString("pt-BR")} mensagens` +
      (vodInfo.createdAt ? ` • ${new Date(vodInfo.createdAt).toLocaleString("pt-BR")}` : "");

    renderPreview();
    $("result").classList.remove("hidden");
    $("progress").style.width = "100%";
    showStatus(`Concluído: ${comments.length.toLocaleString("pt-BR")} mensagens.`);
  } catch (e) {
    $("progress").style.width = "0";
    showStatus(e.message || "Falha ao baixar o chat.", true);
  } finally {
    $("download").disabled = false;
  }
}

$("download").addEventListener("click", startDownload);
$("vod").addEventListener("keydown", e => {
  if (e.key === "Enter") startDownload();
});
$("csv").addEventListener("click", downloadCsv);
$("xlsx").addEventListener("click", downloadXlsx);