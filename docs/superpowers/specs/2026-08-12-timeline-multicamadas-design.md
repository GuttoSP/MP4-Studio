# Timeline multicamadas — design

## Objetivo

Transformar a timeline atual em uma composição de várias faixas empilhadas. Em qualquer instante, o vídeo exibido e exportado é o primeiro clipe ativo encontrado de cima para baixo. Uma lacuna, um clipe oculto ou um trecho removido torna a faixa transparente naquele intervalo e revela a primeira faixa inferior disponível.

O resultado exportado é um único MP4 composto somente pelos intervalos que têm conteúdo visível. Intervalos sem nenhum clipe ativo são omitidos. A mudança entre vencedores é um corte seco por padrão e pode usar uma dissolução opcional.

## Vocabulário e regra de prioridade

- **Faixa:** uma linha horizontal da timeline. A Faixa 1 é a superior e tem maior prioridade.
- **Clipe:** uma referência não destrutiva a um intervalo de uma mídia, posicionada no tempo global.
- **Ativo:** clipe habilitado e cobrindo o instante global consultado.
- **Oculto:** clipe preservado no projeto, mas ignorado na composição e na exportação.
- **Vencedor:** primeiro clipe ativo encontrado da faixa superior para a inferior.
- **Composição resolvida:** sequência ordenada de intervalos vencedores usada por prévia, faixa de saída e FFmpeg.

Exemplo com cinco vídeos de 60 segundos alinhados em `00:00`:

1. A Faixa 1 conserva apenas `00:00–00:10`; ela vence nos primeiros dez segundos.
2. A Faixa 2 permanece ativa em `00:00–00:20` e `00:30–01:00`; ela vence em `00:10–00:20` e `00:30–01:00`.
3. A Faixa 2 fica oculta entre `00:20–00:30`; a Faixa 3 vence nesse intervalo.
4. As Faixas 4 e 5 só aparecem onde todas as superiores estiverem transparentes.

## Abordagens consideradas

### 1. Máscaras de visibilidade sobre vídeos inteiros

Cada faixa armazenaria apenas uma lista de intervalos ativos/inativos. É simples para o exemplo inicial, mas fica confuso ao arrastar, aparar ou reutilizar várias partes do mesmo vídeo.

### 2. Clipes posicionados em faixas — escolhida

Cada faixa contém clipes com posição global e intervalo de origem. Cortar, aparar, mover, duplicar, ocultar e revelar são operações naturais e não destrutivas. Um resolvedor puro calcula os vencedores e serve como fonte única para a interface, a prévia e a exportação.

### 3. Composição calculada apenas na interface

O React decidiria o que mostrar e o backend receberia uma lista já concatenada sem modelo compartilhado. É a alternativa mais curta, mas cria risco de a exportação divergir do que o usuário viu.

## Modelo persistido

O estado salvo no SQLite continua usando o JSON versionado do projeto. Não é necessária uma nova tabela.

```ts
type TimelineTrack = {
  id: string;
  name: string;
  clips: TimelineLayerClip[];
};

type TimelineLayerClip = {
  id: string;
  assetId: string;
  timelineStart: number;
  sourceStart: number;
  sourceEnd: number;
  enabled: boolean;
};

type TimelineTransition = {
  type: 'none' | 'dissolve';
  duration: 0 | 0.25 | 0.5 | 1;
};
```

O `EditorState` recebe `tracks`, `selectedTrackId`, `selectedClipId` e `timelineTransition`. Projetos antigos sem `tracks` são hidratados com uma faixa por vídeo, na ordem da biblioteca, cada clipe iniciado em `00:00`. A primeira faixa é sempre a superior.

Invariantes:

- `sourceEnd > sourceStart`;
- `timelineStart >= 0`;
- a duração global do clipe é `sourceEnd - sourceStart`;
- clipes da mesma faixa não podem se sobrepor após uma operação;
- todas as operações respeitam pelo menos um frame da mídia;
- IDs de mídias inexistentes são descartados na hidratação.

## Resolvedor de composição

Um módulo puro recebe faixas e mídias e devolve `ResolvedTimelineSegment[]`.

1. Coleta início e fim de todos os clipes habilitados.
2. Ordena e remove limites repetidos.
3. Para cada intervalo adjacente, procura o primeiro clipe que cobre o ponto médio, começando pela Faixa 1.
4. Converte o intervalo global em `sourceStart/sourceEnd` da mídia vencedora.
5. Une segmentos adjacentes do mesmo clipe quando a origem também for contínua.
6. Descarta intervalos sem vencedor.

Esse resultado controla simultaneamente:

- o vídeo mostrado no monitor no playhead;
- a faixa superior “Saída”, com thumbnails apenas dos trechos vencedores;
- o payload enviado para exportação;
- a duração estimada e o grafo FFmpeg.

## Interface e interações

A aba inicial passa a incluir **Camadas**. As ferramentas atuais de cortar, mesclar, lado a lado, crop, frame, GIF e ajustes continuam disponíveis.

Na aba Camadas:

- uma faixa “Saída” mostra a sequência final resolvida;
- as faixas de vídeo aparecem empilhadas, com Faixa 1 no topo;
- cada clipe mostra somente frames reais compreendidos entre `sourceStart` e `sourceEnd`;
- áreas encobertas por faixas superiores ficam visualmente atenuadas;
- clipes ocultos ficam hachurados, sem participar da saída;
- o usuário arrasta uma mídia da biblioteca para uma faixa e para o tempo desejado;
- o corpo do clipe move horizontalmente; uma alça permite soltá-lo em outra faixa;
- alças esquerda/direita alteram entrada e saída sem modificar o original;
- tesoura divide o clipe selecionado no playhead;
- ocultar alterna `enabled`; excluir remove a referência do clipe;
- botões adicionam, reordenam e renomeiam faixas;
- campos numéricos continuam disponíveis para tempo global, posição, entrada e saída;
- o playhead, zoom e atalhos permanecem operáveis por mouse, toque e teclado.

Operações inválidas — sobreposição na mesma faixa, duração menor que um frame ou mídia inexistente — são recusadas sem alterar o estado e geram uma mensagem clara.

## Thumbnails e prévia

As thumbnails existentes continuam sendo JPEGs temporais gerados pelo FFmpeg e catalogados no SQLite. A timeline carrega todas as filmstrips necessárias em paralelo e filtra cada uma pelo intervalo de origem do clipe. Retrato permanece retrato, paisagem permanece paisagem e o frame inteiro usa `object-fit: contain`.

O monitor consulta o resolvedor no tempo global. Quando o vencedor muda, troca a mídia e converte o playhead global para o tempo de origem correspondente. Durante reprodução, o relógio continua global; ao alcançar um limite de composição, o monitor avança para o próximo vencedor sem depender da mídia selecionada na biblioteca.

## Exportação FFmpeg

`EditorOperation` recebe `timeline`. O frontend envia a composição resolvida em ordem, nunca o conteúdo binário ou caminhos locais.

O backend valida novamente cada segmento, normaliza resolução, proporção, FPS e áudio, e então:

- com `transition.type = none`, concatena os segmentos com corte seco;
- com `transition.type = dissolve`, encadeia `xfade` e `acrossfade`;
- limita automaticamente a duração da dissolução à metade do menor segmento vizinho;
- cria áudio silencioso para um vencedor sem áudio, mantendo sincronismo;
- aplica crop, rotação, velocidade, volume e configurações de saída depois de resolver a composição;
- informa progresso usando a duração final, já descontadas as sobreposições da dissolução.

O alvo visual usa o primeiro segmento vencedor como referência quando a altura de saída está em “Original”. Outras mídias são contidas e centralizadas no mesmo canvas para evitar deformação.

## Compatibilidade e escopo

- Arquivos originais permanecem intocados.
- SQLite persiste faixas, clipes, seleção e transição no projeto.
- Undo/redo cobre toda alteração estrutural.
- As operações antigas continuam exportando pelos fluxos existentes.
- Opacidade parcial, keyframes, múltiplos áudios simultâneos, transições diferentes por corte e efeitos avançados ficam fora desta entrega.
- Mobile continuará marcado como em desenvolvimento; a timeline multicamada terá rolagem horizontal e vertical funcional, mas não fechará a issue de compatibilidade total sem nova QA.

## Testes e aceite

1. O resolvedor reproduz exatamente o exemplo `0–10` Faixa 1, `10–20` Faixa 2, `20–30` Faixa 3 e `30–60` Faixa 2.
2. Dividir, ocultar, excluir, mover entre faixas e aparar produzem estado persistível e reversível.
3. Um trecho superior oculto revela imediatamente o vencedor inferior na prévia e na faixa Saída.
4. Thumbnails do clipe pertencem somente ao intervalo de origem e preservam a proporção.
5. A serialização envia segmentos na mesma ordem mostrada na faixa Saída.
6. Validação rejeita sobreposição inválida, mídia externa ao projeto e segmentos vazios.
7. FFmpeg gera MP4 reproduzível com corte seco e com dissolução, incluindo troca entre mídias com dimensões e áudio diferentes.
8. A suíte integral, o build, a API real, a prévia desktop e o estado mobile são verificados antes da publicação.
