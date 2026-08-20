# Twitch VOD Chat Exporter V10

V10 adiciona uma prévia interativa do chat inspirada no Twitch Chat Downloader.

- badges por URL real do Twitch;
- emotes Twitch por URL do CDN;
- emotes BTTV, FFZ e 7TV quando disponíveis;
- busca por nome de exibição ou palavra;
- clique no nome para filtrar o usuário;
- menu de exibição de tempo em português;
- Tempo do VOD (padrão);
- Hora real (Brasília);
- Data e hora reais (Brasília);
- paginação;
- CSV/XLSX continuam exportando nome do badge e cor hexadecimal.

O TwitchDownloader é executado com `--embed-images --bttv=true --ffz=true --stv=true`, seguindo a própria documentação do projeto para emotes e badges.


## V11

### Abrir o VOD no tempo da mensagem

O horário mostrado na coluna `Tempo` agora é clicável. Ao clicar, a página abre uma nova aba no VOD usando o parâmetro de tempo da Twitch, por exemplo:

`https://www.twitch.tv/videos/123456789?t=1h2m3s`

A Twitch documenta o parâmetro `time` no player de VOD e o formato `1h2m3s`.

### Modo escuro

O menu `•••` ganhou a opção `Modo escuro`. A preferência é salva no navegador.


## V12

O modo escuro agora é controlado por um botão fixo no canto inferior direito. O menu de opções contém somente os modos de horário. No modo escuro, tempo e nome não recebem fundo ou cor roxa artificial: o tempo permanece neutro e o nome mantém a cor original do usuário.
