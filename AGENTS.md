# Fluxo de atualização

- Após cada atualização do projeto na VPS, envie também as alterações correspondentes para `https://github.com/sopacrazy/shots`, na branch `main`.
- Essa sincronização foi solicitada pelo usuário e não exige nova confirmação a cada atualização.
- Antes do envio, confira os arquivos incluídos: nunca versionar `.env`, credenciais, vídeos, bancos de dados, backups ou dados privados da VPS.
- Preserve os demais serviços da VPS. Reinicie somente o serviço deste projeto quando necessário.
- Confirme o resultado do deploy e do envio ao GitHub. Se uma etapa falhar, informe qual ficou pendente; não declare sincronização concluída.
