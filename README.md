# Twitch VOD Chat Exporter V5

A V5 corrige a coluna `Badge`.

O TwitchDownloader documenta que o chat JSON contém dados ricos e que
`--embed-images` inclui badges e emotes da Twitch no arquivo. Também documenta
`chatupdate --embed-missing` para completar badges que não estejam no JSON. citeturn1search1

A V5 não depende apenas de um único caminho do JSON. Ela procura badges em:
- `message.userBadges`
- `message.badges`
- `comment.userBadges`
- `comment.badges`
- outros campos contendo `badge`
- estruturas aninhadas de até quatro níveis

Também aceita os nomes de campos de badge mais comuns (`setID`, `setId`,
`badgeID`, `badgeId`, `name`, `type`, `id`).

## Formato

A coluna Badge usa somente o nome do badge, como você pediu:

`broadcaster|moderator|subscriber`

Exemplos:

`moderator`

`subscriber`

`subscriber|vip`

`broadcaster`

Para subscriber, a versão do badge (meses) não é colocada no campo; o objetivo
é manter a coluna simples, no estilo do ExportComments.

## Importante

`--embed-images` é usado durante o download, mas as imagens em si não são
colocadas no CSV/XLSX. A coluna contém os nomes dos badges.

O TwitchDownloader também oferece `chatupdate --embed-missing` para baixar
badges ausentes de um JSON já existente. citeturn1search1turn1search0

Não é necessário Client ID ou Client Secret da Twitch.
