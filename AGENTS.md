# Regras permanentes deste projeto

## Proteção absoluta das alterações locais do usuário

- No início de qualquer tarefa, execute somente `git status --porcelain` ou equivalente que mostre nomes e estados, sem abrir o conteúdo ou o diff.
- Todo arquivo já modificado, removido, renomeado, staged ou não rastreado nesse inventário inicial pertence exclusivamente ao usuário.
- Nunca leia, abra, analise, mostre, compare por diff, formate, edite, mova, remova, prepare, faça commit ou envie ao GitHub um arquivo pertencente ao usuário.
- Nunca use `git add -A`, `git add .` ou outra preparação ampla. Adicione somente caminhos explicitamente criados ou alterados pelo agente na tarefa atual.
- Antes de cada commit e push, compare apenas os nomes de `git status --porcelain` com o inventário inicial. Se houver um arquivo inesperado, interrompa a publicação sem abrir seu conteúdo.
- Se uma alteração solicitada precisar tocar um arquivo que já pertence ao usuário, pare e peça que o usuário resolva ou autorize uma estratégia específica. A autorização para trabalhar no projeto não autoriza inspecionar aquela alteração local.
- Alterações que apareçam durante a execução e não tenham sido produzidas pelo agente também devem ser tratadas como pertencentes ao usuário.

## Dados e mídia

- Nunca publique `data/`, bancos SQLite, logs, renders, mídia importada, arquivos temporários ou conteúdo de projetos reais.
- Testes devem usar somente mídia sintética criada pelo próprio teste.
- Não inspecione o conteúdo audiovisual ou os metadados de arquivos que o usuário editar ou importar pelo MP4 Studio.

## GitHub

- Faça commits focados para alterações consideráveis e envie cada commit aprovado para `origin`.
- Registre erros reproduzíveis em uma issue. Ao corrigir, referencie o commit e feche a issue.
- Não force push e não reescreva histórico remoto.
