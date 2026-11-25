# Banco de dados (Supabase) · migrações

Cada arquivo muda o banco uma vez, **em ordem**. Todos podem ser rodados de novo sem estragar nada.
Para aplicar: Supabase → **SQL Editor** → cole o arquivo → **Run**.

| Arquivo | O que faz | Versão do app |
|---|---|---|
| `000_inscricoes_online.sql` | Inscrição online pelo link (eventos e inscritos) | 1.6 |
| `001_multi_academia.sql` | Login, academias, painel root, liberar/bloquear | 1.8.0 |
| `002_sincronizacao.sql` | Campeonato guardado na nuvem (web e desktop iguais) | 1.8.1 |
| `003_sessao_unica_backup_erros.sql` | Um aparelho por vez, versões salvas (backup) e registro de erros | 1.9.0 |

Regras para as próximas:
- Nunca editar um arquivo que já rodou em produção: criar o próximo número (`004_…`).
- Nenhuma senha, chave secreta ou dado de cliente dentro dos arquivos.
- Testar primeiro num projeto Supabase de teste, depois em produção.
- A senha do root é criada com `../root-seed.sql.modelo` (preencher na hora, não salvar).
