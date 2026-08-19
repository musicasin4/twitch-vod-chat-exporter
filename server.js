const express = require("express");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { spawn } = require("child_process");
const https = require("https");
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
      "--bttv=true",
      "--ffz=true",
      "--stv=true",
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

function getEmbeddedBadgeMap(root) {
  const map = new Map();
  const sources = [
    root?.twitchBadges,
    root?.embedded?.twitchBadges,
    root?.embeddedData?.twitchBadges,
    root?.data?.twitchBadges
  ].filter(Array.isArray);

  for (const list of sources) {
    for (const badge of list) {
      if (!badge || typeof badge !== "object") continue;

      const setId = String(
        badge.name ??
        badge.setID ??
        badge.setId ??
        badge.set_id ??
        ""
      ).trim();

      if (!setId) continue;

      const versions = badge.versions || badge.versionsById || {};
      const versionMap = new Map();

      if (Array.isArray(versions)) {
        for (const v of versions) {
          if (!v || typeof v !== "object") continue;
          const id = String(v.version ?? v.id ?? v.versionID ?? "").trim();
          if (id) versionMap.set(id, v);
        }
      } else if (versions && typeof versions === "object") {
        for (const [id, v] of Object.entries(versions)) {
          versionMap.set(String(id), v || {});
        }
      }

      map.set(setId.toLowerCase(), { setId, versions: versionMap });
    }
  }

  return map;
}

function badgeObjectsFromMessage(comment) {
  const message = comment?.message || {};
  return [
    message.user_badges,
    message.userBadges,
    message.badges,
    comment?.user_badges,
    comment?.userBadges,
    comment?.badges
  ].filter(Array.isArray).flat();
}

function rawBadgeParts(badge) {
  if (typeof badge === "string") {
    const parts = badge.split("/");
    return {
      setId: String(parts[0] || "").trim(),
      version: String(parts[1] || "").trim()
    };
  }

  if (!badge || typeof badge !== "object") {
    return { setId: "", version: "" };
  }

  return {
    setId: String(
      badge._id ??
      badge.setID ??
      badge.setId ??
      badge.set_id ??
      badge.badgeID ??
      badge.badgeId ??
      badge.name ??
      badge.type ??
      ""
    ).trim(),
    version: String(
      badge.version ??
      badge.versionID ??
      badge.versionId ??
      badge.id ??
      ""
    ).trim()
  };
}

function resolveBadges(comment, root) {
  const map = getEmbeddedBadgeMap(root);
  const result = [];

  for (const badge of badgeObjectsFromMessage(comment)) {
    const { setId, version } = rawBadgeParts(badge);
    if (!setId) continue;

    const entry = map.get(setId.toLowerCase());
    const versionData = entry?.versions?.get(version);

    let title = String(versionData?.title ?? entry?.setId ?? setId).trim();

    if (
      setId.toLowerCase() === "subscriber" &&
      version &&
      !/\b\d+\s*(meses?|months?)\b/i.test(title)
    ) {
      title = `${title} ${version} meses`;
    }

    const url = String(
      versionData?.url ??
      versionData?.imageUrl ??
      versionData?.image_url ??
      badge?.url ??
      badge?.imageUrl ??
      ""
    ).trim();

    if (title || url) {
      const duplicate = result.find(
        x => x.setId.toLowerCase() === setId.toLowerCase() &&
             x.version === version
      );
      if (!duplicate) result.push({ setId, version, title: title || setId, url });
    }
  }

  if (!result.length) {
    const message = comment?.message || {};
    const roleFlags = [
      ["Broadcaster", ["isBroadcaster", "is_broadcaster"]],
      ["Moderator", ["isModerator", "is_moderator", "mod"]],
      ["VIP", ["isVip", "isVIP", "is_vip", "vip"]],
      ["Subscriber", ["isSubscriber", "is_subscriber", "subscriber"]]
    ];
    for (const [name, keys] of roleFlags) {
      if (keys.some(k => message?.[k] === true || comment?.[k] === true)) {
        if (!result.some(x => x.title.toLowerCase().startsWith(name.toLowerCase()))) {
          result.push({ setId: name.toLowerCase(), version: "", title: name, url: "" });
        }
      }
    }
  }
  return result;
}

function badgeString(comment, root) {
  return resolveBadges(comment, root).map(x => x.title).filter(Boolean).join(" | ");
}

const NAMED_TWITCH_COLORS = {
  blue: "#0000FF",
  blueviolet: "#8A2BE2",
  cadetblue: "#5F9EA0",
  chocolate: "#D2691E",
  coral: "#FF7F50",
  dodgerblue: "#1E90FF",
  firebrick: "#B22222",
  goldenrod: "#DAA520",
  green: "#008000",
  hotpink: "#FF69B4",
  mediumblue: "#0000CD",
  orangered: "#FF4500",
  red: "#FF0000",
  seagreen: "#2E8B57",
  springgreen: "#00FF7F",
  yellowgreen: "#9ACD32"
};

function normalizeUserColor(value) {
  if (value === null || value === undefined) return "";

  const color = String(value).trim();
  if (!color) return "";

  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.toUpperCase();
  if (/^[0-9a-fA-F]{6}$/.test(color)) return `#${color.toUpperCase()}`;

  const named = NAMED_TWITCH_COLORS[color.toLowerCase()];
  return named || color;
}

function extractUserColor(comment) {
  const message = comment?.message || {};

  return normalizeUserColor(
    message.userColor ??
    message.user_color ??
    comment?.userColor ??
    comment?.user_color ??
    comment?.commenter?.color ??
    comment?.commenter?.userColor ??
    ""
  );
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
  if (Array.isArray(root.comments)) return root.comments;
  if (root.comments && Array.isArray(root.comments.edges)) {
    return root.comments.edges.map(x => x?.node).filter(Boolean);
  }
  if (root.data && Array.isArray(root.data.comments)) return root.data.comments;
  if (root.data?.comments && Array.isArray(root.data.comments.edges)) {
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


const TWITCH_PUBLIC_CLIENT_ID = process.env.TWITCH_CLIENT_ID || "kimne78kx3ncx6brgo4mv6wki5h1ko";

async function twitchGql(query) {
  const r = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-ID": TWITCH_PUBLIC_CLIENT_ID
    },
    body: JSON.stringify({ query, variables: {} })
  });
  if (!r.ok) throw new Error(`Twitch GQL HTTP ${r.status}`);
  const data = await r.json();
  if (data?.errors?.length) throw new Error(data.errors[0].message || "Twitch GQL error");
  return data?.data || {};
}

async function getVodOwner(vodId) {
  try {
    const data = await twitchGql(
      `query{video(id:"${vodId}"){title,createdAt,lengthSeconds,owner{id,displayName,login}}}`
    );
    return data.video || {};
  } catch (e) {
    console.warn("Could not load VOD owner metadata:", e.message);
    return {};
  }
}

async function getJson(url) {
  const r = await fetch(url, { headers: { "User-Agent": "Twitch-VOD-Chat-Exporter/9.0" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

async function getThirdPartyEmotes(ownerId) {
  const map = new Map();
  const add = (code, url, provider) => {
    if (!code || !url || map.has(code)) return;
    map.set(code, { url, provider, name: code });
  };

  const tasks = [];
  tasks.push(getJson("https://api.betterttv.net/3/cached/emotes/global")
    .then(list => list.forEach(e => add(e.code, `https://cdn.betterttv.net/emote/${e.id}/2x`, "BTTV")))
    .catch(e => console.warn("BTTV global emotes:", e.message)));
  tasks.push(getJson("https://api.betterttv.net/3/cached/frankerfacez/emotes/global")
    .then(list => list.forEach(e => add(e.code, e.animated
      ? `https://cdn.betterttv.net/frankerfacez_emote/${e.id}/animated/2`
      : `https://cdn.betterttv.net/frankerfacez_emote/${e.id}/2`, "FFZ")))
    .catch(e => console.warn("FFZ global emotes:", e.message)));
  tasks.push(getJson("https://7tv.io/v3/emote-sets/global")
    .then(obj => (obj.emotes || []).forEach(e => {
      const files = e?.data?.host?.files || [];
      const f = files.find(x => String(x.format).toLowerCase() === "webp") || files[0];
      if (f && e?.data?.host?.url) add(e.name, `https:${e.data.host.url}/2x.${f.format}`, "7TV");
    }))
    .catch(e => console.warn("7TV global emotes:", e.message)));

  if (ownerId) {
    tasks.push(getJson(`https://api.betterttv.net/3/cached/users/twitch/${ownerId}`)
      .then(obj => [...(obj.channelEmotes || []), ...(obj.sharedEmotes || [])]
        .forEach(e => add(e.code, `https://cdn.betterttv.net/emote/${e.id}/2x`, "BTTV")))
      .catch(e => console.warn("BTTV channel emotes:", e.message)));
    tasks.push(getJson(`https://api.betterttv.net/3/cached/frankerfacez/users/twitch/${ownerId}`)
      .then(list => list.forEach(e => add(e.code, e.animated
        ? `https://cdn.betterttv.net/frankerfacez_emote/${e.id}/animated/2`
        : `https://cdn.betterttv.net/frankerfacez_emote/${e.id}/2`, "FFZ")))
      .catch(e => console.warn("FFZ channel emotes:", e.message)));
    tasks.push(getJson(`https://7tv.io/v3/users/twitch/${ownerId}`)
      .then(async user => {
        const setId = user?.emote_set_id;
        if (!setId) return;
        const set = await getJson(`https://7tv.io/v3/emote-sets/${setId}`);
        (set.emotes || []).forEach(e => {
          const files = e?.data?.host?.files || [];
          const f = files.find(x => String(x.format).toLowerCase() === "webp") || files[0];
          if (f && e?.data?.host?.url) add(e.name, `https:${e.data.host.url}/2x.${f.format}`, "7TV");
        });
      })
      .catch(e => console.warn("7TV channel emotes:", e.message)));
  }

  await Promise.all(tasks);
  return map;
}

async function getChatBadgeMap(ownerId) {
  const map = new Map();
  try {
    const q = `query{badges{imageURL(size:DOUBLE),description,title,setID,version}}`;
    const data = await twitchGql(q);
    for (const b of data.badges || []) {
      const setId = String(b.setID || "").trim().toLowerCase();
      const version = String(b.version || "").trim();
      if (setId && version) map.set(`${setId}:${version}`, {
        title: b.title || setId,
        url: b.imageURL || ""
      });
    }
  } catch (e) {
    console.warn("Global Twitch badges:", e.message);
  }

  if (ownerId) {
    try {
      const q = `query{user(id:${JSON.stringify(String(ownerId))}){broadcastBadges{imageURL(size:DOUBLE),description,title,setID,version}}}`;
      const data = await twitchGql(q);
      for (const b of data.user?.broadcastBadges || []) {
        const setId = String(b.setID || "").trim().toLowerCase();
        const version = String(b.version || "").trim();
        if (setId && version) map.set(`${setId}:${version}`, {
          title: b.title || setId,
          url: b.imageURL || ""
        });
      }
    } catch (e) {
      console.warn("Channel Twitch badges:", e.message);
    }
  }
  return map;
}

function extractFragments(comment) {
  const message = comment?.message || {};
  return Array.isArray(message.fragments) ? message.fragments : [];
}

function firstPartyEmoteUrl(id) {
  return `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(id)}/default/dark/2.0`;
}

function buildMessageParts(comment, thirdPartyMap) {
  const fragments = extractFragments(comment);
  const out = [];
  const addText = text => { if (text) out.push({ type: "text", text }); };

  for (const f of fragments) {
    const text = String(f?.text ?? "");
    const id = f?.emoticon?.emoticon_id ?? f?.emoticon?.emote_id ?? f?.emoticonId;
    if (id) {
      out.push({ type: "emote", text, url: firstPartyEmoteUrl(id), provider: "Twitch" });
      continue;
    }

    if (!text) continue;
    if (!thirdPartyMap.size) { addText(text); continue; }

    const codes = [...thirdPartyMap.keys()].sort((a,b) => b.length-a.length);
    const escaped = codes.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!escaped.length) { addText(text); continue; }
    const re = new RegExp(`(^|\\s)(${escaped.join("|")})(?=$|\\s)`, "g");
    let last = 0, m;
    while ((m = re.exec(text))) {
      addText(text.slice(last, m.index + m[1].length));
      const code = m[2];
      const emote = thirdPartyMap.get(code);
      out.push({ type: "emote", text: code, url: emote.url, provider: emote.provider });
      last = re.lastIndex;
    }
    addText(text.slice(last));
  }

  if (!out.length) out.push({ type: "text", text: messageText(comment?.message || {}) });
  return out;
}

function normalizeChat(json, thirdPartyMap, badgeMap) {
  const comments = findComments(json);
  return comments.map(c => {
    const commenter = c?.commenter || c?.user || c?.author || {};
    const message = c?.message || c?.content || {};
    const offset = firstNumber(c, [
      "contentOffsetSeconds", "content_offset_seconds", "contentOffset",
      "offsetSeconds", "offset", "videoTimeSeconds", "video_time_seconds"
    ]);

    const badges = badgeObjectsFromMessage(c).map(b => rawBadgeParts(b));
    const badgeData = badges.map(({setId, version}) => {
      const key = `${setId.toLowerCase()}:${version}`;
      const embedded = getEmbeddedBadgeMap(json).get(setId.toLowerCase())?.versions?.get(version);
      const known = badgeMap.get(key) || embedded || {};
      let title = String(known.title ?? setId).trim();
      if (setId.toLowerCase() === "subscriber" && version && !/\b\d+\s*(meses?|months?)\b/i.test(title)) {
        title = `${title} ${version} meses`;
      }
      const url = String(
        known.url ?? known.imageUrl ?? known.image_url ??
        known.image_url_2x ?? known.imageURL ?? ""
      ).trim();
      return {setId, version, title, url};
    }).filter(x => x.title || x.url);

    return {
      Date: c?.createdAt || c?.created_at || c?.timestamp || "",
      "Comment video time": offset,
      Badge: badgeData.map(x => x.title).filter(Boolean).join(" | "),
      BadgeImages: badgeData,
      Name: commenter.displayName ?? commenter.display_name ?? commenter.login ?? commenter.name ?? "",
      Color: extractUserColor(c),
      Comment: messageText(message),
      MessageParts: buildMessageParts(c, thirdPartyMap)
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
    const vodInfo = await getVodOwner(vodId);
    const ownerId = vodInfo?.owner?.id || "";
    const [thirdPartyMap, badgeMap] = await Promise.all([
      getThirdPartyEmotes(ownerId),
      getChatBadgeMap(ownerId)
    ]);
    const comments = normalizeChat(parsed, thirdPartyMap, badgeMap);

    if (!comments.length) {
      throw new Error(
        "O download terminou, mas o VOD não retornou mensagens de chat."
      );
    }

    res.json({
      vod: { id: vodId, title: vodInfo?.title || "", createdAt: vodInfo?.createdAt || "", owner: vodInfo?.owner || {} },
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
      header: ["Date", "Comment video time", "Badge", "Name", "Color", "Comment"]
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
    version: "9.0.0"
  });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Twitch VOD Chat Exporter V3 listening on ${PORT}`);
});
