const express = require("express");
const path = require("path");
const XLSX = require("xlsx");

const app = express();
const PORT = process.env.PORT || 3000;

// Twitch's public Client IDs are intended for Helix.
// The historical VOD chat operation is an undocumented GQL operation
// used by Twitch's web client and rejects third-party Client IDs.
const GQL_CLIENT_ID =
  process.env.TWITCH_GQL_CLIENT_ID ||
  "kimne78kx3ncx6brgo4mv6wki5h1ko";

const GQL_URL = "https://gql.twitch.tv/gql";
const QUERY_HASH =
  "b70a3591ff0f4e0313d126c6a1502d79a1c02baebb288227c582044aa76adf6a";

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

function extractVodId(input) {
  const value = String(input || "").trim();
  if (/^\d+$/.test(value)) return value;
  const m = value.match(/(?:twitch\.tv\/)?videos\/(\d+)/i);
  return m ? m[1] : null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function twitchGraphQL(vodId, variables) {
  const payload = [{
    operationName: "VideoCommentsByOffsetOrCursor",
    variables: { videoID: vodId, ...variables },
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash: QUERY_HASH
      }
    }
  }];

  const response = await fetch(GQL_URL, {
    method: "POST",
    headers: {
      "Client-ID": GQL_CLIENT_ID,
      "Content-Type": "application/json",
      "Origin": "https://www.twitch.tv",
      "Referer": "https://www.twitch.tv/"
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const err = new Error(`Resposta inválida da Twitch (HTTP ${response.status}).`);
    err.status = 502;
    throw err;
  }

  if (!response.ok) {
    const msg = data?.message || `Twitch respondeu HTTP ${response.status}.`;
    const err = new Error(msg);
    err.status = response.status;
    throw err;
  }

  if (data?.[0]?.errors?.length) {
    const err = new Error(data[0].errors.map(e => e.message).join("; "));
    err.status = 502;
    throw err;
  }

  const video = data?.[0]?.data?.video;
  if (!video) {
    const err = new Error("VOD não encontrado ou chat replay indisponível.");
    err.status = 404;
    throw err;
  }

  return video;
}

function badgeNames(message) {
  return (message?.userBadges || [])
    .map(b => `${b?.setID || ""}:${b?.version || ""}`)
    .join("|");
}

function fragmentsToText(message) {
  return (message?.fragments || []).map(f => f?.text || "").join("");
}

function normalizeComment(node) {
  const message = node?.message || {};
  const commenter = node?.commenter || {};
  return {
    Date: node?.createdAt || "",
    "Comment video time": Number(node?.contentOffsetSeconds || 0),
    Badge: badgeNames(message),
    Name: commenter.displayName || commenter.login || "",
    Comment: fragmentsToText(message)
  };
}

app.post("/api/chat", async (req, res) => {
  try {
    const vodId = extractVodId(req.body?.vod);
    if (!vodId) {
      return res.status(400).json({
        error: "Informe uma URL de VOD da Twitch ou um ID numérico."
      });
    }

    const comments = [];
    let cursor = null;
    let pages = 0;

    while (true) {
      const video = await twitchGraphQL(
        vodId,
        cursor ? { cursor } : { contentOffsetSeconds: 0 }
      );

      const edges = video.comments?.edges || [];
      for (const edge of edges) {
        if (edge?.node) comments.push(normalizeComment(edge.node));
      }

      pages++;
      const pageInfo = video.comments?.pageInfo || {};
      if (!pageInfo.hasNextPage || !edges.length) break;

      cursor = edges[edges.length - 1]?.cursor;
      if (!cursor) break;

      await sleep(120);
    }

    res.json({
      vod: {
        id: vodId,
        title: "",
        createdAt: "",
        lengthSeconds: null
      },
      count: comments.length,
      pages,
      comments
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({
      error: err.message || "Erro inesperado ao baixar o chat."
    });
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
  } catch {
    res.status(500).send("Erro ao gerar XLSX.");
  }
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Twitch VOD Chat Exporter: http://0.0.0.0:${PORT}`);
});
