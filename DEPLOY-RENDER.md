# Publicar em ~5 minutos

## 1. GitHub

Crie um repositório, por exemplo:

`twitch-vod-chat-exporter`

Envie o conteúdo desta pasta para a raiz do repositório.

## 2. Render

Abra o dashboard do Render e:

**New → Web Service → conecte GitHub → selecione o repositório**

Configuração:

- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Instance Type: Free

O `render.yaml` também contém essa configuração.

## 3. Variável secreta

Em Environment Variables, crie:

`TWITCH_CLIENT_ID`

Valor: Client ID do seu aplicativo Twitch.

Não crie `TWITCH_CLIENT_SECRET` para este projeto e não publique nenhum secret no GitHub.

## 4. Deploy

Clique em **Create Web Service**.

Após terminar, abra a URL `https://NOME.onrender.com`.

## 5. Atualizações

Com o GitHub conectado, novos commits no branch configurado podem disparar novos deploys automaticamente.
