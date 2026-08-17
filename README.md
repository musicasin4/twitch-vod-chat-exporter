# Twitch VOD Chat Exporter V3

## Por que a V3 existe?

A implementação anterior chamava diretamente o GraphQL interno da Twitch. Em 2026 a
Twitch passou a exigir uma verificação de integridade nesse fluxo, causando:

`failed integrity check`

A V3 abandona essa chamada direta e usa o **TwitchDownloaderCLI**, projeto open-source
que possui um comando específico `chatdownload` para baixar o chat de VODs. O projeto
documenta suporte a VODs, highlights e clips e gera JSON/HTML/TXT. 

O servidor converte o JSON para:

`Date,"Comment video time",Badge,Name,Comment`

e oferece CSV e XLSX.

## Deploy no Render

Não precisa de Client ID nem Client Secret da Twitch.

O `render.yaml` baixa automaticamente a versão Linux x64 do TwitchDownloaderCLI
durante o build e instala o binário em `bin/TwitchDownloaderCLI`.

Build:

`npm install` + download do CLI

Start:

`npm start`

## Importante

O TwitchDownloaderCLI também depende de mecanismos de acesso da Twitch e pode ter
limitações para VODs privados, sub-only ou indisponíveis. Consulte a documentação
do projeto para detalhes.

Projeto TwitchDownloader:
https://github.com/lay295/TwitchDownloader
