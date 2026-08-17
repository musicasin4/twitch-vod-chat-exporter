# Twitch VOD Chat Exporter V4

V4 corrige dois problemas da primeira implementação do conversor:

- `Comment video time` agora procura todos os formatos comuns de timestamp do JSON do TwitchDownloader.
- O download usa `--embed-images`, fazendo o TwitchDownloader incluir os dados de badges da Twitch no JSON.
- O parser aceita `userBadges`/`badges` tanto no objeto da mensagem quanto no comentário.
- O CSV/XLSX mantém exatamente as colunas:
  `Date, Comment video time, Badge, Name, Comment`

O TwitchDownloader documenta que o JSON contém as informações originais do chat e que
`--embed-images` inclui badges/emotes/cheermotes da Twitch no arquivo. O projeto também
documenta que o chatdownload é destinado a VODs, highlights e clips. citeturn3search0turn3search1

## Deploy

Não é necessário Client ID ou Client Secret da Twitch.

Mantenha o Build Command do V3 que instala o TwitchDownloaderCLI.

Após o deploy, `/api/health` deve retornar `version: "4.0.0"` e
`twitchDownloaderInstalled: true`.

## Observação sobre o horário

`Comment video time` é o tempo relativo ao início do VOD, e não a hora do relógio.
Exemplo:

`00:03:16.000` = mensagem enviada aproximadamente 3 min 16 s após o início do VOD.

A Twitch historicamente disponibiliza o offset do comentário em segundos; o próprio
ecossistema do TwitchDownloader também possui recursos específicos relacionados a
timestamps/dispersion. citeturn4search0turn3search5
