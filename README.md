# Twitch VOD Chat Exporter V6

A V6 adiciona duas informações pedidas ao export:

- **meses de inscrição** no badge `Subscriber`;
- **cor do usuário** como hexadecimal (`#RRGGBB`).

## Como a cor é obtida

O chat replay da Twitch coloca a cor no próprio objeto `message` como `userColor`.
Exemplos reais do formato do chat incluem:

`"userColor": "#1E90FF"`

e, quando o usuário não tem uma cor definida, `userColor` pode ser `null`. citeturn5search1

A Twitch Chat Downloader também adicionou explicitamente a cor do usuário ao
export e mantém esse dado no histórico do projeto. citeturn3search0

O nosso parser procura:

- `message.userColor`
- `message.user_color`
- `comment.userColor`
- `comment.user_color`
- `commenter.color`

Cores nomeadas também são convertidas para hex.

## Subscriber + meses

Os badges do comentário são estruturas com `setID` e `version`. Para o badge
`subscriber`, o `version` representa o nível/tempo do badge e pode ser usado
como número de meses. Uma implementação de referência do ecossistema Twitch
faz exatamente esse cruzamento e expõe `months` a partir da versão do badge.
citeturn5search2

Assim, o export fica, por exemplo:

`Subscriber 12 meses`

`Moderator`

`VIP`

`Broadcaster`

ou:

`Subscriber 24 meses | VIP`

## Colunas

```text
Date
Comment video time
Badge
Name
Color
Comment
```

Exemplo:

```text
2026-08-09T19:04:19.622Z
00:03:16.000
Subscriber 12 meses
jozinho
#1E90FF
online só agora?
```

A cor é exportada como texto hexadecimal para funcionar no CSV e no Excel.

## Fonte

O Twitch Chat Downloader atual informa que seu export contém cor de usuário e
badges, e o TwitchDownloader possui suporte a badges no chat render. citeturn3search0turn0search2
