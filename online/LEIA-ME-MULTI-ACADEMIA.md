# BJJ Arena · vendendo para várias academias

## Como funciona
- **Você (root)** entra com seu e-mail e senha na própria tela de login do app (web e desktop). O sistema reconhece o e-mail root e abre o **painel de academias**.
- No painel você cadastra cada academia: nome, responsável, CPF, WhatsApp, e-mail, valor, vencimento. O **login da academia é o e-mail** informado e a **senha provisória** é gerada com os 4 últimos dígitos do CPF + um código aleatório (ex.: `4725-k7mq`).
- Botão **Compartilhar no WhatsApp** abre a conversa com a academia já com link, login e senha provisória.
- Botão de status **LIBERADO / BLOQUEADO**: bloqueada (ou com vencimento passado) a academia vê uma tela animada convidando a falar com você no WhatsApp (48 99629-7813).
- No **primeiro acesso** a academia troca a senha e cadastra Instagram, YouTube, telefone, e-mail, site, cidade, endereço e horários. Só depois o sistema é liberado. Esses dados ficam guardados para a futura listagem pública de academias.
- Os **campeonatos pertencem à academia**: cada academia tem seus dados em chave própria no computador e os links de inscrição online são criados em nome dela (e só funcionam com a academia liberada).

## Segurança
- Senhas guardadas só como hash (bcrypt) no Supabase. A senha do root **não está em nenhum arquivo** do projeto nem no GitHub.
- Bloqueio de 15 min após 5 tentativas erradas por e-mail. Sessão do root: 8 h. Sessão da academia: 30 dias, revalidada a cada 5 min e ao voltar à janela.
- Sem internet, a academia continua usando por até 7 dias com o último estado válido (vencimento e status são conferidos localmente).
- **Troque a senha root** em “Alterar minha senha” por uma forte (12+ caracteres).

## Trocar a senha root esquecida
Rode `online/root-seed.sql.modelo` no SQL Editor do Supabase com e-mail e senha novos (não salve a senha em arquivo).

## Limitações honestas
- A trava da versão desktop é no aplicativo: quem sabe mexer no código consegue contornar. Serve para uso comercial comum, não é proteção anti-pirataria.
- Os campeonatos ficam no computador/navegador de cada academia (sem sincronizar na nuvem).
- CPF fica guardado em texto no banco (para o painel root). Trate como dado pessoal (LGPD).
- O plano gratuito do Supabase pausa o projeto após 7 dias sem uso; para vender, considere o plano Pro.
