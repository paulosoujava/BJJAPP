> **Já configurado:** o projeto Supabase `bjj-arena` está criado, o SQL já foi executado e a página pública fica em https://bjjapp-app.vercel.app/inscricao.html. No app, basta clicar em *Link de inscrição*: o link é criado e o WhatsApp abre para você divulgar. Os passos abaixo servem para refazer em outro projeto.

# Link de inscrição online (passo a passo, ~10 minutos)

O link público usa o **Supabase** (gratuito) para guardar as inscrições. O app só lê as inscrições do seu campeonato, com uma chave secreta que fica no seu computador.

1. Crie uma conta em supabase.com e um projeto novo (guarde a senha do banco).
2. No projeto: **SQL Editor > New query**, cole todo o conteúdo de `migrations/000_inscricoes_online.sql` e clique **Run**.
3. Em **Project Settings > API**, copie o **Project URL** e a chave **anon / publishable**.
4. Publique `inscricao.html` junto do seu site (por exemplo na pasta do site no Vercel, ficando `https://SEU-SITE/inscricao.html`).
5. No BJJ Arena: dê um nome ao campeonato, vá em **Inscritos > Link de inscrição**, preencha URL, chave e o endereço da página e clique **Criar link de inscrição**.
6. Use **Copiar link** ou **Enviar pelo WhatsApp**. As inscrições chegam em *Atualizar* (e a cada 30 s com o painel aberto). **Adicionar todas as novas** coloca os atletas na lista de inscritos.
7. Para fechar, use **Encerrar inscrições**.

**Link mais curto (opcional):** abra `inscricao.html`, preencha `url` e `key` na linha `window.BJJ_CFG` e marque, no app, "Minha página já tem a conexão preenchida".

**Segurança:** ninguém lê as tabelas direto (RLS ligado). A chave de administração do campeonato é gerada no seu computador e nunca vai no link. O peso informado pelo atleta é só uma declaração; a pesagem oficial continua no app.

**Testar sem internet/Supabase:** `node online/mock-server.js` sobe um servidor de teste local (use `http://localhost:54321` como URL e qualquer chave de 20+ caracteres).
