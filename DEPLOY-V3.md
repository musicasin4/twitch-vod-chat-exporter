# Atualização para V3

1. Substitua os arquivos do repositório pelos arquivos desta versão.
2. Faça commit/push na branch `main`.
3. O Render fará um novo deploy.
4. Não é mais necessário `TWITCH_CLIENT_ID`.
5. Não é necessário `TWITCH_CLIENT_SECRET`.
6. Teste:
   `/api/health`

O resultado esperado depois do deploy:

```json
{
  "ok": true,
  "twitchDownloaderInstalled": true,
  "version": "3.0.0"
}
```

Depois teste um VOD público com chat replay.
