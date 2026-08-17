# Twitch VOD Chat Exporter — Render

Aplicação Node.js/Express para exportar o chat replay de VODs da Twitch para CSV e Excel.

## Deploy no Render

1. Crie um repositório no GitHub e envie todos os arquivos deste projeto.
2. Entre no Render e escolha **New → Web Service**.
3. Conecte o repositório.
4. O `render.yaml` já define:
   - Node
   - `npm install`
   - `npm start`
   - plano Free
   - `TWITCH_CLIENT_ID` como variável secreta
5. No serviço, preencha `TWITCH_CLIENT_ID` com o Client ID do seu aplicativo Twitch.
6. Faça o deploy.

Depois do deploy o Render fornecerá uma URL pública `*.onrender.com`.

## Twitch Client ID

Crie um aplicativo em:

https://dev.twitch.tv/console/apps

Use apenas o Client ID no Render. Nunca coloque o Client Secret no frontend.

## Rodar localmente

```bash
npm install
```

PowerShell:

```powershell
$env:TWITCH_CLIENT_ID="SEU_CLIENT_ID"
npm start
```

Abra `http://localhost:3000`.

## Limitações

O histórico completo do chat replay de VOD não é exposto pela Twitch através de um endpoint Helix público. A aplicação usa o GraphQL interno usado pela reprodução de VOD, portanto essa parte pode mudar sem aviso.

O plano Free do Render é adequado para testes/projetos pessoais, mas possui limitações e o serviço pode entrar em suspensão após período de inatividade.

## Deploy automático

Ao conectar o GitHub ao Render, novos pushes no branch configurado podem disparar novos deploys automaticamente.
