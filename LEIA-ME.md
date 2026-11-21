# BJJ Arena — versão 1.6.0

Programa para Mac que cadastra lutadores, monta as chaves do campeonato, controla o placar e mostra tudo em TV/telão.

## Instalar (cliente)

- **Windows**: dê dois cliques em `BJJ-Arena-…-win-x64.exe` e siga o assistente.
- **Mac**: abra o `.dmg` (arm64 = Macs M1/M2/M3/M4; x64 = Macs Intel) e arraste **BJJ Arena** para Aplicativos.
- **Linux**: `.deb` (Ubuntu/Debian: dois cliques) ou `.AppImage` (marque como executável e abra).

Sem certificado de assinatura, Windows (SmartScreen: "Mais informações → Executar assim mesmo") e Mac (botão direito → Abrir) mostram um aviso na primeira vez. Para vender sem aviso, assine o app (Apple Developer ID + notarização; certificado de assinatura de código no Windows).

## Gerar os instaladores (você)

1. Suba esta pasta no GitHub (repositório de código, pode ser privado).
2. Aba **Actions → Gerar instaladores → Run workflow** (ou crie uma tag `v1.5.0`). Em poucos minutos saem o `.exe`, os `.dmg` e o `.AppImage`/`.deb` em *Artifacts* (ou na *Release*, se usou tag).
3. Localmente: `npm install` e `npm run dist` gera só o instalador do sistema em que você está (pasta `dist/`).

## Passo a passo do campeonato

0. **Início**: ao abrir, informe uma vez o **nome** e a **data** do campeonato.
1. **Cadastro**: nome, peso e faixa de cada lutador. Se a faixa não estiver na lista, escolha **Outra…** e escreva o nome (ex.: Cinza, Amarela). Ela vira uma categoria própria, aparece nos tempos por faixa e fica salva para os próximos cadastros.
2. **Pesagem**: confira o peso real; marque quem faltou (WO).
3. **Configuração**: número de tatames, tempo de luta (único ou por faixa), punições automáticas e "todos contra todos" para 3 lutadores.
4. **Gerar chaves**. Cada categoria (faixa + peso) vira uma chave.
5. **Telão** (botão ou **Cmd+T**): abre uma janela separada para o público. Sempre abre em tela cheia: no segundo monitor/TV, se houver; com uma tela só, em um espaço próprio do Mac (volte ao painel com Ctrl + setas ou deslizando 3 dedos; feche o telão com Cmd + W).

## Telão

Modos: **revezar** (alterna chaves, chamada e pódio a cada 15 s), **chaves** (espelha a aba do operador), **chamada** (por tatame) e **pódio**. Quando o operador abre uma luta, o telão mostra o placar ao vivo.

## Placar e atalhos

| Ação | Lado A | Lado B |
|---|---|---|
| Queda (2) | Q | U |
| Raspagem (2) | W | I |
| Joelho na barriga (2) | E | O |
| Passagem de guarda (3) | A | J |
| Montada (4) | S | K |
| Pegada de costas (4) | D | L |
| Vantagem | Z | N |
| Punição | X | M |

**Espaço** inicia/pausa o relógio, **Backspace** desfaz. A 2ª punição dá vantagem ao adversário, a 3ª dá 2 pontos e a 4ª desclassifica (pode desligar em Configuração). Há botão de pausa por lesão.

## Pódio e todos contra todos

Ouro, prata e dois bronzes (semifinalistas). Cada colocado mostra o **total de pontos** que fez no campeonato e o **motivo** (ex.: "Venceu a final por pontos (4 × 0)", "Perdeu a semifinal por finalização"). Nos todos contra todos aparecem as vitórias e o saldo. Chaves de 3 lutadores viram todos contra todos, com desempate por vitórias, saldo de pontos, pontos, vantagens e punições. Se ainda empatar, o operador define a classificação manualmente.

## Ajustar depois do sorteio

Botão **Ajustar** na chave: marcar falta (WO), trocar um lutador por outro, e as lutas contra ausentes são decididas automaticamente.

## Tatames

Cada chave pode ser atribuída a um tatame. A aba **Chamada** mostra a fila de lutas por tatame e "Em luta". Atenção: só um placar/relógio roda por vez no programa.

## Avisos e confirmações

Campos obrigatórios (nome do campeonato, nome, peso e faixa do lutador) são validados com pop-up de erro. O programa pede confirmação antes de **iniciar** o campeonato, gerar chaves de novo (apaga resultados), remover lutador depois das chaves, limpar a lista, **encerrar** o campeonato, excluir do histórico e **fechar o programa** (X da janela).

## Histórico de campeonatos

Informe o **nome** e a **data** do campeonato (painel 2). Ao clicar em **Encerrar campeonato** (ou em **Limpar lista**, quando já houve lutas), tudo é guardado no **Histórico** e a lista de lutadores e as chaves ficam zeradas para o próximo evento. O botão **Histórico** (canto superior direito da tela principal, também no resumo das chaves e em **Arquivo → Histórico de campeonatos**, atalho Cmd + Shift + H) mostra os campeonatos separados por dia, com:

- campeões por categoria (ouro, prata e bronze) com pontos e motivo;
- todas as lutas de cada chave: fase, atletas, pontos, vantagens, punições, vencedor e como venceu;
- todos os participantes, com campanha (vitórias e derrotas), pontos e resultado final, incluindo quem faltou.

Se não houve nenhuma luta decidida, nada é guardado no histórico.

## Dados

Tudo é salvo automaticamente no computador. Se o Mac avisar que o app é de desenvolvedor não identificado: botão direito no app → Abrir.
