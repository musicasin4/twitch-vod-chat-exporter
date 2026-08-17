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

const BADGE_NAMES = {
  broadcaster: "broadcaster",
  moderator: "moderator",
  vip: "vip",
  subscriber: "subscriber",
  founder: "founder",
  partner: "partner",
  staff: "staff",
  admin: "admin",
  global_mod: "global_mod",
  turbo: "turbo",
  premium: "prime",
  prime: "prime",
  bits: "bits",
  bits_badge: "bits",
  artist: "artist",
  predictions: "predictions",
  sub_gifter: "sub_gifter",
  sub_gift: "sub_gifter",
  no_audio: "no_audio",
  no_video: "no_video",
  twitchbot: "twitchbot"
};

function normalizeBadgeName(value) {
  const key = String(value ?? "").trim().toLowerCase();
  if (!key) return "";

  // Twitch set IDs are the most useful value for an export.
  if (BADGE_NAMES[key]) return BADGE_NAMES[key];

  // Some badge schemas expose a human-readable display name instead.
  const cleaned = key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned;
}

function badgeEntryToName(badge) {
  if (typeof badge === "string") {
    return normalizeBadgeName(badge);
  }

  if (!badge || typeof badge !== "object") return "";

  const set =
    badge.setID ??
    badge.setId ??
    badge.set_id ??
    badge.badgeID ??
    badge.badgeId ??
    badge.name ??
    badge.type ??
    badge.id ??
    "";

  return normalizeBadgeName(set);
}

function findBadgeArrays(value, depth = 0, found = []) {
  if (!value || typeof value !== "object" || depth > 4) return found;

  if (Array.isArray(value)) {
    // A Twitch badge array normally contains objects with setID/version.
    if (value.some(x =>
      typeof x === "string" ||
      (x && typeof x === "object" &&
        ("setID" in x || "setId" in x || "badgeID" in x || "badgeId" in x))
    )) {
      found.push(value);
    }
    for (const item of value) {
      if (item && typeof item === "object") {
        findBadgeArrays(item, depth + 1, found);
      }
    }
    return found;
  }

  for (const [key, val] of Object.entries(value)) {
    if (/badge/i.test(key) && Array.isArray(val)) {
      found.push(val);
    } else if (val && typeof val === "object") {
      findBadgeArrays(val, depth + 1, found);
    }
  }

  return found;
}

function badgeString(comment) {
  const arrays = findBadgeArrays(comment);
  const names = [];

  for (const badges of arrays) {
    for (const badge of badges) {
      const name = badgeEntryToName(badge);
      if (name && !names.includes(name)) names.push(name);
    }
  }

  // Fallback for schemas that expose role flags but not the badge array.
  // This also makes exports useful when a badge image could not be embedded.
  const message = comment?.message || {};
  const roleFlags = [
    ["broadcaster", ["isBroadcaster", "is_broadcaster"]],
    ["moderator", ["isModerator", "is_moderator", "mod"]],
    ["vip", ["isVip", "isVIP", "is_vip", "vip"]],
    ["subscriber", ["isSubscriber", "is_subscriber", "subscriber"]]
  ];

  for (const [name, keys] of roleFlags) {
    if (keys.some(k => message?.[k] === true || comment?.[k] === true)) {
      if (!names.includes(name)) names.push(name);
    }
  }

  return names.join("|");
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
    version: "5.0.0"
  });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Twitch VOD Chat Exporter V3 listening on ${PORT}`);
});
