# Licença por cliente, teste grátis e atualização

## Ligar o licenciamento (uma vez)
1. `node ferramentas/licenca.js chaves` cria `licenca-privada.pem` (SECRETA: faça backup, nunca publique) e grava a chave pública em `license-pub.js`.
2. Gere os instaladores depois disso (Actions ou `npm run dist`). Dali em diante o app tem **14 dias de teste** e depois pede licença.

## Emitir a licença de um cliente
O cliente abre *Ativar licença*, vê o **código do computador** e manda para você (botão do WhatsApp já faz isso).

    node ferramentas/licenca.js emitir --cliente "Academia X" --ate 2027-12-31
    node ferramentas/licenca.js emitir --cliente "Academia X" --maquina ABCD-1234-EF56   # presa a um computador

Envie a chave (texto longo) ao cliente, que cola em *Ativar licença*. Sem `--ate`, não vence.

## Limites honestos
- É proteção contra uso casual, não contra quem sabe programar. Funciona offline.
- Se perder `licenca-privada.pem`, terá de gerar novas chaves e reemitir as licenças.

## Aviso de versão nova
O app lê `https://raw.githubusercontent.com/paulosoujava/BJJArena/main/version.json` (modelo em `ferramentas/version.json`). Ao lançar uma versão, suba esse arquivo com a nova `version`, `url` e `notas`. O app só **avisa** e abre a página de download: não instala sozinho (isso exige instaladores assinados).

## Assinatura dos instaladores (remove os avisos de "desenvolvedor desconhecido")
- **Mac:** conta Apple Developer (US$ 99/ano). Cadastre nos *Secrets* do GitHub: `CSC_LINK` (certificado .p12 em base64), `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
- **Windows:** certificado de assinatura de código: `WIN_CSC_LINK` e `WIN_CSC_KEY_PASSWORD`.
O workflow já lê esses segredos; sem eles, gera instaladores sem assinatura.
