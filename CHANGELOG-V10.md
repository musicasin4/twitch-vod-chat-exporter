# V10 — correção dos badges na prévia

- Corrige o caminho das imagens dos badges.
- Usa o mesmo GraphQL de badges que o TwitchDownloader usa.
- Badges específicos do canal sobrescrevem os globais.
- Adiciona proxy local `/api/image` para evitar falhas de carregamento do CDN no navegador.
- Usa os bytes incorporados pelo TwitchDownloader como fallback, quando disponíveis.
- A prévia tenta a URL original como segundo fallback.
- O CSV/XLSX continua usando apenas o nome do badge.
