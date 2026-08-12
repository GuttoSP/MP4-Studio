# Como contribuir

Obrigado por contribuir com o MP4 Studio.

## Antes de começar

- não adicione mídias reais, bancos SQLite, renders, logs ou configurações pessoais;
- use somente fixtures sintéticas e pequenas nos testes;
- abra uma issue para erros reproduzíveis e alterações que mudem comportamento;
- mantenha cada commit focado em uma alteração considerável.

## Ambiente

```powershell
npm install
npm test
npm run build
```

Os testes de integração com FFmpeg podem ser executados separadamente:

```powershell
npm run test:integration
```

## Pull requests

Inclua na descrição:

- o problema resolvido;
- o comportamento esperado;
- os testes executados;
- screenshots desktop e mobile quando houver mudança visual.

Nunca inclua conteúdo de projetos locais ou arquivos editados pelo usuário.
