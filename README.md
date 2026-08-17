# Twitch VOD Chat Exporter V2

Esta versão corrige o erro `The "Client-ID" header is invalid`.

A versão anterior enviava o Client ID criado no Developer Console para
`gql.twitch.tv/gql`. Esse endpoint interno rejeita Client IDs de terceiros.
A V2 usa o Client ID público do cliente web da Twitch para a operação de chat replay.

## Render

Não é mais necessário configurar `TWITCH_CLIENT_ID` no Render para o chat.

Se o serviço já existe, basta fazer o deploy desta versão. O `render.yaml` configura
Node, `npm install`, `npm start` e o plano Free.

## Limitação

O histórico do chat de VOD não possui endpoint Helix público documentado. Esta solução
usa `VideoCommentsByOffsetOrCursor`, uma operação GraphQL interna/não documentada.
A Twitch pode alterar ou bloquear esse endpoint.

O projeto é independente da Twitch e deve ser usado respeitando os termos aplicáveis.

## Local

```bash
npm install
npm start
```

Abra `http://localhost:3000`.
