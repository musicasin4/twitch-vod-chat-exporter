# V4

## Correções

1. O conversor anterior assumia poucos nomes de campos para o timestamp. A V4 aceita
   `contentOffsetSeconds`, `content_offset_seconds`, `contentOffset`, `offsetSeconds`,
   `offset` e outros formatos.
2. O download agora usa `--embed-images`, conforme documentado pelo TwitchDownloader,
   para incluir badges da Twitch no JSON.
3. O parser aceita badges em `message.userBadges`, `message.badges`,
   `comment.userBadges` e `comment.badges`.
4. `/api/health` agora reporta `4.0.0`.

## Importante

O valor em `Comment video time` é relativo ao começo do VOD. A coluna `Date` continua
sendo o timestamp absoluto da mensagem.
