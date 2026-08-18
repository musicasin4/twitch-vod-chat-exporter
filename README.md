# Twitch VOD Chat Exporter V8

V8 adiciona uma prévia de chat paginada e visualmente mais próxima do chat da Twitch.

- 100 / 250 / 500 / 1.000 mensagens por página ou todas.
- Paginação sem alterar o conjunto de mensagens exportado.
- Badges mostrados como imagens na prévia.
- Nome de exibição mostrado na cor do usuário.
- Tempo da prévia e do CSV/XLSX no formato `00:00:00`.
- CSV/XLSX continuam usando o nome textual do badge e a cor hexadecimal.
- `Subscriber` mantém o número de meses.
- `findComments()` e `firstNumber()` são mantidos para evitar o erro da V7.

A imagem do badge vem dos metadados `twitchBadges` incorporados pelo TwitchDownloader
quando `--embed-images` é usado.
