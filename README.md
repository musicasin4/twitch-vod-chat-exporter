# Twitch VOD Chat Exporter V7

A V7 usa os metadados de badges que o próprio TwitchDownloader incorpora ao JSON.

O TwitchDownloader constrói `twitchBadges` a partir dos badges globais e dos
badges específicos do canal e guarda, por versão, `title`, `description` e URL.
É essa informação que o renderizador usa para exibir os badges. citeturn4search0turn1search0

## Badge

Para cada mensagem:

```text
message.user_badges
        ↓
_id + version
        ↓
twitchBadges
        ↓
versions[version].title
        ↓
nome real do badge
```

Exemplos:

```text
Moderator
Artist
VIP
Bot Badge
Subscriber 12 meses
```

Badges específicos do canal também são suportados.

## Nome

A coluna `Name` usa o nome de exibição:

1. `commenter.displayName`
2. `commenter.display_name`
3. `commenter.login`
4. `commenter.name`

Isso evita exportar o login quando o usuário possui um nome de exibição
diferente. A Twitch diferencia explicitamente `display-name` do nome de usuário. citeturn0search5turn0search7

## Colunas

```text
Date
Comment video time
Badge
Name
Color
Comment
```

`Color` continua sendo a cor hexadecimal do usuário quando fornecida pelo chat.

O TwitchDownloader documenta que `--embed-images` incorpora badges no JSON e
que o `chatdownload` é destinado a VODs, highlights e clips. citeturn0search2turn1search1
