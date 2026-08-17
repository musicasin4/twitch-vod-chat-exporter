const express = require("express");
const path = require("path");
const XLSX = require("xlsx");

const app = express();
const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.TWITCH_CLIENT_ID;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

function extractVodId(input) {
  const value = String(input || "").trim();

  // Aceita ID puro.
  if (/^\d+$/.test(value)) return value;

  // Aceita https://www.twitch.tv/videos/123456789
  const m = value.match(/twitch\.tv\/videos\/(\d+)/i);
  if (m) return m[1];

  // Aceita alguns formatos com query/hash.
  const m2 = value.match(/\/videos\/(\d+)/i);
  if (m2) return m2[1];

  return null;
}

async function twitchGraphQL(vodId, variables) {
  if (!CLIENT_ID) {
    const err = new Error("TWITCH_CLIENT_ID não configurado.");
    err.status = 500;
    throw err;
  }

  const body = [{
    operationName: "VideoCommentsByOffsetOrCursor",
    variables: { videoID: vodId, ...variables },
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash: "b70a3591ff0f4e0313d126c6a1502d79a1c02baebb288227c582044aa76adf6a"
      }
    }
  }];

  const response = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: {
      "Client-ID": CLIENT_ID,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch {
    const err = new Error(`Resposta inválida da Twitch (${response.status}).`);
    err.status = 502;
    throw err;
  }

  if (!response.ok) {
    const err = new Error(data?.message || `Twitch respondeu HTTP ${response.status}.`);
    err.status = response.status;
    throw err;
  }

  if (data?.[0]?.errors?.length) {
    const err = new Error(data[0].errors.map(e => e.message).join("; "));
    err.status = 502;
    throw err;
  }

  return data?.[0]?.data?.video || null;
}

function badgeNames(message) {
  const badges = message?.userBadges || [];
  return badges.map(b => {
    const set = b?.setID || "";
    const version = b?.version || "";
    return version ? `${set}:${version}` : set;
  }).join("|");
}

function fragmentsToText(message) {
  return (message?.fragments || []).map(f => f?.text || "").join("");
}

function normalizeComment(node) {
  const createdAt = node?.createdAt || node?.created_at || "";
  const offset = Number(node?.contentOffsetSeconds || 0);
  const commenter = node?.commenter || {};
  const message = node?.message || {};

  return {
    Date: createdAt,
    "Comment video time": offset,
    Badge: badgeNames(message),
    Name: commenter.displayName || commenter.login || "",
    Comment: fragmentsToText(message)
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Baixa todas as páginas do chat. O endpoint usado é o GraphQL interno
// da reprodução de VOD; ele não faz parte do Helix público da Twitch.
app.post("/api/chat", async (req, res) => {
  try {
    const vodId = extractVodId(req.body?.vod);
    if (!vodId) {
      return res.status(400).json({ error: "Informe uma URL de VOD da Twitch ou um ID numérico." });
    }

    const comments = [];
    let cursor = null;
    let page = 0;
    let firstOffset = 0;
    let videoInfo = null;

    while (true) {
      const variables = cursor
        ? { cursor }
        : { contentOffsetSeconds: firstOffset };

      const video = await twitchGraphQL(vodId, variables);

      if (!video) {
        return res.status(404).json({
          error: "VOD não encontrado, indisponível ou sem chat replay."
        });
      }

      videoInfo = {
        id: vodId,
        title: video.title || "",
        createdAt: video.createdAt || "",
        lengthSeconds: video.lengthSeconds || null
      };

      const edges = video.comments?.edges || [];

      for (const edge of edges) {
        if (edge?.node) comments.push(normalizeComment(edge.node));
      }

      page++;
      const pageInfo = video.comments?.pageInfo || {};
      if (!pageInfo.hasNextPage || !edges.length) break;

      cursor = edges[edges.length - 1]?.cursor;
      if (!cursor) break;

      // Pequena pausa para reduzir a chance de rate-limit.
      await sleep(120);
    }

    res.json({
      vod: videoInfo,
      count: comments.length,
      comments
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({
      error: err.message || "Erro inesperado ao baixar o chat."
    });
  }
});

// Exportação XLSX no servidor, útil para chats muito grandes.
// Recebe as linhas já coletadas pelo navegador.
app.post("/api/xlsx", (req, res) => {
  try {
    const rows = Array.isArray(req.body?.comments) ? req.body.comments : [];
    if (!rows.length) return res.status(400).send("Nenhuma mensagem para exportar.");

    const sheet = XLSX.utils.json_to_sheet(rows, {
      header: ["Date", "Comment video time", "Badge", "Name", "Comment"]
    });

    // Tempo relativo como texto HH:MM:SS.mmm para manter a precisão.
    if (sheet["B1"]) sheet["B1"].v = "Comment video time";

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Chat");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
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

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Twitch VOD Chat Exporter: http://localhost:${PORT}`);
});
