# Edição multicamadas

A timeline multicamadas funciona como uma pilha de folhas transparentes. Em qualquer instante, o MP4 Studio procura de cima para baixo e exibe o primeiro clipe que estiver ativo naquele ponto.

## Exemplo prático

Considere três vídeos sobrepostos:

| Tempo global | Faixa 1 | Faixa 2 | Faixa 3 | Saída final |
| --- | --- | --- | --- | --- |
| 0–10 s | visível | visível | visível | Faixa 1 |
| 10–20 s | vazia | visível | visível | Faixa 2 |
| 20–30 s | vazia | oculta | visível | Faixa 3 |
| 30–60 s | vazia | visível | visível | Faixa 2 |

O resultado exportado é uma sequência única: `Faixa 1 → Faixa 2 → Faixa 3 → Faixa 2`.

## Criar a composição

1. Importe os MP4s na biblioteca **Mídias**.
2. Abra **Camadas** — ela já é a ferramenta inicial de novos projetos.
3. Arraste cada vídeo para a faixa desejada.
4. Use **Adicionar faixa** quando precisar de outro nível.
5. Use as setas ao lado do nome da faixa para mudar a prioridade. **Prioridade 1** sempre fica no topo.

Ao abrir um projeto antigo, cada vídeo que ainda não estiver na composição ganha uma faixa estável. O projeto continua salvo automaticamente no SQLite.

## Editar clipes diretamente

- **Mover no tempo:** arraste o corpo do clipe para a esquerda ou direita.
- **Mover entre faixas:** arraste o clipe e solte na faixa de destino.
- **Aparar:** arraste a alça verde ou roxa de uma das bordas.
- **Dividir:** posicione o playhead dentro do clipe e use **Dividir clipe no playhead**.
- **Ocultar um clipe:** selecione-o e use o botão de olho.
- **Ocultar somente um intervalo:** marque entrada e saída e use **Ocultar intervalo marcado**.
- **Excluir:** selecione o clipe e use a lixeira.
- **Valores exatos:** use os campos do painel direito para posição e tempos de fonte.

As operações estruturais participam de **Desfazer/Refazer**. Seleção e movimentação do playhead não poluem o histórico.

## Entender as thumbnails

Cada vídeo tem quadros temporais reais gerados pelo FFmpeg e registrados no SQLite. Dentro de um clipe aparecem somente os quadros cujo timestamp pertence ao seu intervalo de fonte.

- um vídeo retrato mantém thumbnails retrato;
- um vídeo paisagem mantém thumbnails paisagem;
- a imagem inteira usa `contain`, sem cortar o quadro;
- timestamps são ordenados e deduplicados;
- um quadro fora do intervalo aparado não aparece naquele clipe.

## Conferir antes de exportar

O monitor mostra a mídia vencedora no playhead e converte o tempo global para o tempo correto do arquivo-fonte. O selo **Em exibição** informa a faixa e o arquivo usados.

A linha verde **Saída final** mostra somente os segmentos que entrarão no MP4. Clique em um segmento para levar o playhead ao início dele.

## Transições

O padrão é **Corte seco**: um trecho termina e o próximo começa imediatamente.

Para suavizar todas as trocas da composição, selecione **Dissolver** e escolha 0,25 s, 0,5 s ou 1 s. O MP4 Studio aplica dissolve no vídeo e crossfade no áudio. A duração escolhida precisa ser menor que cada trecho visível.

## Exportar

1. Verifique a linha **Saída final**.
2. Escolha a transição.
3. Clique em **Exportar MP4**.
4. Acompanhe o progresso na fila inferior.
5. Use **Baixar** quando o render terminar.

O FFmpeg normaliza dimensões e FPS dos trechos e gera um único MP4 H.264 com áudio AAC quando houver áudio. Os arquivos originais nunca são alterados.

## Mobile

O layout se reorganiza e a timeline pode ser rolada em telas estreitas. A experiência completa de arrastar clipes entre faixas ainda está no roadmap mobile; para composição multicamadas intensiva, use desktop por enquanto.
