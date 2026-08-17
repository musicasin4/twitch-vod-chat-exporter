# V5 — badges

- Corrige a extração de badges usando busca recursiva no objeto do comentário.
- Aceita `setID`, `setId`, `set_id`, `badgeID`, `badgeId`, `name`, `type` e `id`.
- Adiciona fallback para flags `isModerator`, `isVip`, `isSubscriber` e
  `isBroadcaster`.
- Converte IDs conhecidos para nomes simples.
- A coluna Badge agora mostra apenas os nomes, por exemplo:
  `moderator`, `vip`, `subscriber`, `broadcaster`.
- `/api/health` passa a reportar `5.0.0`.
