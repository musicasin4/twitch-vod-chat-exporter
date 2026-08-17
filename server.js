const express = require("express");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { spawn } = require("child_process");
const XLSX = require("xlsx");

const app = express();
const PORT = process.env.PORT || 3000;
const CLI = process.env.TWITCHDOWNLOADER_PATH ||
  path.join(__dirname, "bin", "TwitchDownloaderCLI");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function extractVodId(input) {
  const value = String(input || "").trim();
  if (/^\d+$/.test(value)) return value;

  const patterns = [
    /twitch\.tv\/videos\/(\d+)/i,
    /\/videos\/(\d+)/i
  ];

  for (const p of patterns) {
    const m = value.match(p);
    if (m) return m[1];
  }

  return null;
}

function runChatDownloader(vodId, outputFile) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(CLI)) {
      return reject(new Error(
        "TwitchDownloaderCLI não está instalado. Verifique o build do Render."
      ));
    }

    const args = [
      "chatdownload",
      "--id", vodId,
      "--compression", "None",
      "--embed-images",
      "--bttv=false",
      "--ffz=false",
      "--stv=false",
      "--threads", "1",
      "--log-level", "Status,Info,Warning,Error",
      "--banner=false",
      "--collision", "Overwrite",
      "-o", outputFile
    ];

    const child = spawn(CLI, args, {
      cwd: path.dirname(CLI),
      env: process.env
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", chunk => { stdout += chunk.toString(); });
    child.stderr.on("data", chunk => { stderr += chunk.toString(); });

    child.on("error", err => reject(err));

    child.on("close", code => {
      if (code !== 0) {
        const details = (stderr || stdout).trim();
        return reject(new Error(
          details || `TwitchDownloader terminou com código ${code}.`
        ));
      }
      resolve({ stdout, stderr });
    });
  });
}

function badgeString(message) {
  const badges = message?.userBadges || message?.badges || [];
  return badges.map(b => {
    const set = b?.setID ?? b?.setId ?? b?.name ?? "";
    const version = b?.version ?? "";
    return version ? `${set}:${version}` : set;
  }).filter(Boolean).join("|");
}

function messageText(message) {
  if (typeof message === "string") return message;
  if (!message) return "";

  if (typeof message.text === "string") return message.text;

  if (Array.isArray(message.fragments)) {
    return message.fragments.map(f => f?.text || "").join("");
  }

  return "";
}

function findComments(root) {
  if (!root || typeof root !== "object") return [];

  // Current TwitchDownloader JSON: comments is usually an array.
  if (Array.isArray(root.comments)) return root.comments;

  // GraphQL-shaped/older representations.
  if (Array.isArray(root.comments?.edges)) {
    return root.comments.edges.map(x => x?.node).filter(Boolean);
  }

  if (Array.isArray(root.data?.comments)) return root.data.comments;
  if (Array.isArray(root.data?.comments?.edges)) {
    return root.data.comments.edges.map(x => x?.node).filter(Boolean);
  }

  return [];
}

function firstNumber(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      const n = Number(obj[key]);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function badgeString(comment) {
  const message = comment?.message || {};
  const badgeLists = [
    message.userBadges,
    message.badges,
    comment?.userBadges,
    comment?.badges
  ];

  for (const badges of badgeLists) {
    if (!Array.isArray(badges) || !badges.length) continue;

    const result = badges.map(b => {
      if (typeof b === "string") return b;
      const set = b?.setID ?? b?.setId ?? b?.name ?? b?.badgeID ?? b?.badgeId ?? "";
      const version = b?.version ?? b?.versionID ?? b?.versionId ?? "";
      return version ? `${set}:${version}` : set;
    }).filter(Boolean);

    if (result.length) return result.join("|");
  }

  return "";
}

function messageText(message) {
  if (typeof message === "string") return message;
  if (!message) return "";

  if (typeof message.text === "string") return message.text;

  if (Array.isArray(message.fragments)) {
    return message.fragments.map(f => f?.text || "").join("");
  }

  return "";
}

function normalizeChat(json) {
  const comments = findComments(json);

  return comments.map(c => {
    const commenter = c?.commenter || c?.user || c?.author || {};
    const message = c?.message || c?.content || {};

    const offset = firstNumber(c, [
      "contentOffsetSeconds",
      "content_offset_seconds",
      "contentOffset",
      "offsetSeconds",
      "offset",
      "videoTimeSeconds",
      "video_time_seconds"
    ]);

    return {
      Date: c?.createdAt || c?.created_at || c?.timestamp || "",
      "Comment video time": offset,
      Badge: badgeString(c),
      Name: commenter.displayName || commenter.login || commenter.name || "",
      Comment: messageText(message)
    };
  });
}

app.post("/api/chat", async (req, res) => {
  const vodId = extractVodId(req.body?.vod);
  if (!vodId) {
    return res.status(400).json({
      error: "Informe uma URL de VOD da Twitch ou um ID numérico."
    });
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "twitch-chat-"));
  const jsonFile = path.join(tempDir, `${crypto.randomUUID()}.json`);

  try {
    const result = await runChatDownloader(vodId, jsonFile);

    if (!fs.existsSync(jsonFile)) {
      throw new Error("O TwitchDownloader não gerou o arquivo de chat.");
    }

    const raw = fs.readFileSync(jsonFile, "utf8");
    const parsed = JSON.parse(raw);
    const comments = normalizeChat(parsed);

    if (!comments.length) {
      throw new Error(
        "O download terminou, mas o VOD não retornou mensagens de chat."
      );
    }

    res.json({
      vod: { id: vodId },
      count: comments.length,
      comments
    });
  } catch (err) {
    console.error("CHAT DOWNLOAD ERROR:", err);
    res.status(502).json({
      error: err.message || "Não foi possível baixar o chat.",
      details: process.env.NODE_ENV === "development" ? String(err.stack || "") : undefined
    });
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
});

app.post("/api/xlsx", (req, res) => {
  try {
    const rows = Array.isArray(req.body?.comments) ? req.body.comments : [];
    if (!rows.length) return res.status(400).send("Nenhuma mensagem.");

    const sheet = XLSX.utils.json_to_sheet(rows, {
      header: ["Date", "Comment video time", "Badge", "Name", "Comment"]
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Chat");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx"
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="twitch-chat.xlsx"'
    );
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao gerar XLSX.");
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    twitchDownloaderInstalled: fs.existsSync(CLI),
    version: "4.0.0"
  });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Twitch VOD Chat Exporter V3 listening on ${PORT}`);
});
