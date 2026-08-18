# V7

- Corrigido o problema principal dos badges.
- O export agora usa `twitchBadges` incorporado pelo TwitchDownloader.
- Cruza `message.user_badges` por `_id` + `version`.
- Usa `versions[version].title` para obter o nome real mostrado pelo TwitchDownloader.
- Suporta badges globais e específicos do canal.
- Subscriber continua exibindo o número de meses.
- Name agora usa `commenter.displayName` antes de login.
- Color continua sendo exportada.
- Health: `7.0.0`.
