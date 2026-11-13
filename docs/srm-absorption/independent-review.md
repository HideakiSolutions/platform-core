# Revisão independente da absorção SRM

Data: 2026-11-13. Escopo: alterações experimentais inspecionadas nos checkouts
`srm-frontend`, `srm-backend` e `srm-ecp`. Os caminhos de código abaixo são relativos
ao respectivo checkout. Este documento registra revisão e evidência de trabalho;
não concede admissão de contratos, publicação, merge, deploy ou adoção.

## Método e limites

Cada entrega passou por leitura cega contra os critérios recebidos, seguida de
confronto das alegações com código corrigido, testes disponíveis e recibos. As
correções de implementação ficaram com seus executores. O limite é de três rodadas
corretivas por entrega; ao atingir o limite, interromper repetições e diagnosticar
ou mudar a abordagem, preservando os gates. Nenhuma política foi reduzida para
obter aprovação.

A leitura cobriu integralmente as novas superfícies de login, Jira, Graph Node,
SAML, MFA, notificações ECP, SQS e OTel indicadas nesta revisão. A inspeção dos
demais módulos SRM foi amostral; isso não equivale a revisão integral de todo o
backend. O estado revisado contém alterações ainda sem commit. Recibos anteriores
a mudanças posteriores não aprovam automaticamente essas mudanças.

Governança consultada: contrato global `/home/annonymous/.claude/AGENTS.md`,
contrato local ECP e produtor
`enterprise-hseos@25e673ff9c7e9dee99ef88a554cc9144d99c5b40`, incluindo
`governance-discovery.md`, índice core e Constituição. Ativação AEW e enforcement
dos consumidores permanecem não verificados nesta revisão.

## Achados e fechamento

| Superfície e localização | Achado da leitura cega | Fechamento verificado |
|---|---|---|
| Backend `node/src/directory-graph/index.ts`, `GraphClientCredentials.getToken` | Busca de segredo pendurada mantinha a renovação compartilhada pendente indefinidamente; o timeout começava depois da busca. | Deadline passou a envolver segredo, fetch e corpo; `finally` limpa a renovação. Regressão de recuperação adicionada. |
| Mesmo módulo, composição de cloud | Diretório aceitava US/China, enquanto o provedor concreto emitia tokens somente para a cloud pública. | Provedor concreto declara `resourceOrigin`; composição incompatível é rejeitada. |
| Graph Node e .NET, grupos e cadeia de gestores | Grupos eram marcados como transitivos sem conhecer sua relação direta; os novos adaptadores divergiam da cadeia existente em direção ou origem de cada salto. | Flags desconhecidas são omitidas; cadeia usa `current -> manager` em cada salto, conforme implementação/testes síncronos existentes e fixture comum. A hipótese inicial de inverter a API pelo nome `manager_of` foi retirada após confronto com essas fontes. |
| Backend `.NET Auditing/AuditRecorder.cs`, `AuditRedactor` | Apenas o último segmento do caminho era examinado; `credentials.password.value` e caminhos indexados podiam persistir segredo. | Todos os segmentos `.[]/` são examinados antes de append/seal. Nomes de actor/resource também são redigidos, preservando IDs. Regressões adicionadas. |
| Backend `.NET Security.Mfa/OtpChallenges.cs`, binding | Serialização padrão divergente de `JSON.stringify` para Unicode podia produzir escopos diferentes entre stacks. | Encoder comum ECMAScript explícito; fixture compara hashes de contexto e credencial com emoji e separadores Unicode. O teste revelou a divergência antes da correção. |
| ECP `runtimes/python/ecp_runtime/srm_notifications.py`, SMTP | `SMTPRecipientsRefused` de destinatário único com RCPT 450 era tratado como falha genérica; o double anterior retornava um mapa que não representava esse caso real. | Exceção específica classifica recusa temporária como deferred/throttled; regressão usa a exceção real. |
| Mesmo módulo, `_mailbox` | `Address` pode lançar `HeaderParseError`, fora do tratamento de `ValueError`, quebrando o envelope de erro explícito. | Erro convertido em `ValueError` sanitizado; casos `a@`, `a@@b` e endereço entre sinais angulares cobertos. |
| Backend `node/src/identity-saml/index.ts`, `validate` | Qualquer requisição pendente do mesmo escopo podia ser aceita sem vínculo com o navegador iniciador. | `expectedRequestId` externo protegido é obrigatório; comparação antes do consumo de estado e após obter XML autenticado. `createLoginRequest` fornece o ID gerado. |
| Backend `.NET Security.Authn.Saml/SamlAssertionAdapter.cs`, assinatura | Allowlist de assinatura não constituía gate explícito para digest SHA1. | Gate SHA256/SHA512 e allowlist de transforms inspecionados. Execução comunicada: 23 testes .NET aprovados, incluindo rejeição de fixture assinada RSA256 com digest SHA1; não executada nesta revisão. |
| Backend SQS Node e .NET, resolução de tenant | Resolver que ignorasse cancelamento podia impedir timeout e shutdown. Na primeira versão .NET, erro transitório também virava quarentena imediata. | Leitura tem espera limitada; negação permanente é distinta de falha transitória, com retry limitado e novo deadline de limpeza. Efeitos transacionais não são abandonados por corrida artificial de timeout. |
| Backend `.NET Messaging.Sqs/SqsConsumer.cs`, lease | Lease retornada não era confrontada com o contexto esperado antes do handler. | Validação de tenant, consumer, event ID, token, fence e expiração adicionada antes dos efeitos. |
| Backend `.NET Notifications.Ecp/EcpNotifications.cs`, resolução | Callback não recebia tenant; endereço explícito podia ser substituído pela resolução. | Callback recebe tenant e endereço explícito prevalece. Regressão usa mesmo principal em tenants distintos. |
| Mesmo módulo, canais e recibos | Canais duplicados repetiam invocação; lista vazia não produzia outcomes. Recibo genérico não preservava correlação para confronto. | Snapshot distinto de canais com fallback; correlação preservada e confrontada quando presente. Omissão continua aceita porque o contrato ECP a torna opcional, como no cliente Node. |

Não foi demonstrada corrida de duplicação no executor Jira: `begin` vincula o
plano, claim é atômica, pending/uncertain não expiram automaticamente e falha em
persistir o resultado mantém o claim bloqueado. Dry-run ocorre antes de journal
ou transporte; estimativa usa timetracking, sem criar worklog.

No Approval PostgreSQL Node, a leitura confirmou CAS com lock, deduplicação de
operação e escrita de decisão/audit/execution outbox na mesma transação, além de
claim e ACK com fence. A leitura cega posterior do wrapper e store PostgreSQL
.NET confirmou a mesma estrutura transacional, hashes compatíveis e validações
de contexto, sem achado material. O confronto posterior com o log do consumidor
instalado e a fonte do smoke confirmou o escopo de CAS em oito processos,
deduplicação, rollback/retry e recuperação fenced, descrito na tabela de evidência.
Não foi executada aqui disputa mista Node/.NET. Na leitura SQS/OTel, não restou achado material após as
correções: ACK segue confirmação durável, quarentena exige confirmação e chave
idempotente; propagação OTel é restrita a headers de trace e rotas permitidas,
sem instalar exporters. As garantias dependentes dos ports permanecem obrigações
das implementações injetadas.

Adendo de observabilidade .NET: a opção `EnableOtlpExport` conserva o default
`true` e condiciona apenas a instalação dos exporters existentes. Leitura do teste
de loopback confirma escopo de cliente HTTP: traceparent W3C recebido, span client
e duração do `System.Net.Http`. Não comprova collector remoto ou instrumentação
completa de servidor. Não foi encontrado defeito material nessa alteração limitada.
No Jira, consultas adicionais continuam GET; reconciliação explícita apenas marca
resultado remoto verificado como completed, sem resetar uncertainty para repost.

## Verificação executada nesta revisão

- Repro pequeno do travamento de renovação Graph, antes da correção: duas chamadas
  expiraram no prazo do chamador, com apenas uma busca de segredo iniciada.
- Probes da biblioteca padrão confirmaram a hierarquia de `SMTPRecipientsRefused`
  e os casos que lançam `HeaderParseError`; nenhum envio externo nesses probes.
- Probe direto do engine Node confirmou rejeição de aprovação já expirada mesmo
  com timestamp de decisão retroativo; a hipótese de bypass não se confirmou.
- Frozen install frontend com políticas intactas: 482 entradas de supply chain
  aprovadas, 388 pacotes reutilizados e zero downloads. Token foi obtido de pass
  somente para o ambiente do subprocesso, sem registrar valores. Isso não prova
  autenticação remota no registry; INFRA-0044 permanece aberta com evidência nova.
- Verificador frontend final, sob `heavy-run --mem 3G`, com Node 24: cinco tarballs
  instalados em consumidores isolados React 18.3.1 e 19.2.6, typecheck, 42 testes
  aprovados em cada versão e bundle Vite sem dependências backend detectadas pelo
  gate. Recibo: `/build/artifacts/srm-absorption/frontend-auth-consumers.json`.
  SHA256 final do tarball auth:
  `e8cfa9dc518c4807c23793119c23981f00b23fe4792219e996690f1029ab3b41`.

O primeiro rerun frontend falhou por ausência de dependências instaladas; foi
repetido somente depois de restaurar o pré-requisito. O recibo antigo não foi
tratado como prova desse rerun. Índice e lint das issues de infraestrutura
passaram após atualização de INFRA-0044.

## Evidência inspecionada, executada em outros gates

Base dos arquivos: `/build/artifacts/srm-absorption/`.

| Recibo ou log lido | Fato sustentado |
|---|---|
| `evidence/jira-postgres-smoke.json` | Recibo atualizado PASS: seis checks, incluindo claim único entre oito processos, retomada, conflito de plano, bloqueio de uncertain, reconciliação explícita sem repost e retry de rejeição conhecida; TLS peer-verified e schema removido. |
| `evidence/mfa-redis-smoke.json` | PASS: consumo único OTP oito processos/TOTP quatro, contexto, tentativas, expiração e cooldown; chaves próprias removidas. |
| `evidence/approval-postgres-smoke.json` | PASS: oito processos/um CAS vencedor, outbox audit/execution, tenant/dedupe, fencing e rollback; TLS peer-verified e schema removido. |
| `evidence/smtp-mailpit-smoke.json` | PASS: TLS com identidade verificada, auth após STARTTLS e mensagem sintética aceita no Mailpit; run `198ee8b5-fe49-4567-a741-1b35d62c0b99`, sem mailbox externa. |
| `evidence/dotnet-live-redis.log` | Consumidor NuGet instalado; OTP vinte concorrentes/um sucesso e TOTP vinte/um; custom CA; chaves residuais com TTL até 120s. |
| `evidence/dotnet-notifications-ecp.log` | Resultado final: 20 testes aprovados, zero falhos e zero ignorados. |
| `evidence/dotnet-observability.log` | Oito testes aprovados, zero falhos e zero ignorados; escopo HTTP client de loopback descrito acima. |
| `evidence/dotnet-live-postgres.log` | Consumidor NuGet instalado; PASS CAS em oito processos, um vencedor/sete conflitos, operação deduplicada, audit/execution atômicos, rollback/retry e recuperação de lease com fence antigo rejeitado. Fonte `dotnet/examples/srm-absorption-consumer/ApprovalPostgresSmoke.cs` também inspecionada. O log não imprime configuração TLS; injeção de CA/SNI foi comunicada pelo gate executor. Cleanup está no `finally` do smoke. |

Foram também confrontadas alegações de suites focadas Node/.NET com código e
regressões disponíveis. Contagens comunicadas sem execução própria ou leitura do
log correspondente são alegações dos executores, não resultados produzidos por
esta revisão. Não foi executada uma suíte backend completa nesta revisão.
Após o confronto inicial, foram comunicados resultados reais de ferramenta:
SAML .NET 23 aprovados, incluindo a negativa específica de digest SHA1, e SQS
.NET 16 aprovados, incluindo as correções de resolução e lease. O stdout original
dessas execuções não foi salvo em arquivo e não foi recriado como se fosse log.

## Pendências e fronteiras de aprovação

- SAML/SQS .NET: código corrigido e resultados comunicados confrontados; os
  recibos finais de testes/empacotamento permanecem responsabilidade do gate de
  entrega, com a distinção de evidência descrita acima.
- Approval assíncrono PostgreSQL .NET: duas passagens concluídas sem achado material;
  escopo e limites da evidência live registrados acima.
- No fechamento anterior à investigação de 2026-11-13T15:32Z, Graph, Jira,
  Teams, SQS e IdP não tinham integração live comprovada por esta revisão.
  O adendo 0068 abaixo registra a validação posterior de leitura Jira. Comandos
  Jira e integrações live Graph/Teams/SQS/IdP continuam fora da evidência aprovada.
- Tarballs/NuGets locais demonstram instalação no escopo testado; não demonstram
  publicação, adoção ou comportamento em produção.
- Correlação omitida em recibo ECP é permitida pelo contrato. O cliente verifica
  igualdade quando ela está presente; não oferece binding universal na ausência.
- O comentário de contrato sobre a origem de `manager_of` diverge do comportamento
  síncrono existente. A revisão preservou esse comportamento e não autorizou
  redefinição de contrato.

Ausência de achado material aberto nas partes fechadas não conclui a absorção.
A matriz de aceitação, gates finais e pendências acima continuam independentes.

## Adendo: candidato WorkItems CQRS

Foi revisado o runtime explícito `ecp_runtime/experimental_work_items.py`, os cinco
schemas draft e as projeções `node/src/work-items-ecp` e
`.NET Hideakisolutions.Platform.WorkItems.Ecp`. O perfil é
`workitems-cqrs/0.1.0-draft.1`. Busca em `capabilities/`, catálogo e dispatcher ECP
não encontrou registro ou exposição default dessas operações. Esse resultado é
limitado aos arquivos pesquisados e não admite o contrato nem autoriza endpoint
público. Clientes e harness permanecem candidatos explícitos.

| Achado cego/confronto | Correção e evidência de fechamento |
|---|---|
| `_get` validava projeto, mas uma resposta para outro item do mesmo projeto redirecionava a mutação depois da autorização do item solicitado. | Exige igualdade da chave retornada com a referência autorizada antes do efeito. Repro próprio com pedido `TEST-1` e resposta `OTHER-9`: antes executava PUT em `OTHER-9`; depois retorna failed sem POST/PUT. |
| `_item` inventava o projeto do parent a partir do projeto do child. | Na estratégia anterior à investigação live de 2026-11-13T15:32Z, passou a rejeitar referência sem projeto comprovado: o fake deixou de produzir referência falsa e retornou `provider_failure`. A entrega 0068, revisada abaixo, acrescenta enriquecimento autorizado antes da projeção pura e valida leitura de amostras parentadas reais. |
| Busca/transitions não reavaliavam cancelamento depois do GET final. | Checkpoints adicionados após ambos os reads. Repro próprio de cancelamento durante search mudou de `ok` para `failed/cancelled`; regressão cobre ambas as operações. |
| Node aceitava journal de resume com execução/fingerprint diferentes dos solicitados. | Binding explícito de `execution_id` e `plan_sha256` reinspecionado, com regressão. |
| .NET aceitava `actual_work.started_at` divergente e backlog `partial` com todos os itens completed. | Instantes são comparados, aceitando offset equivalente; partial exige item incompleto e conserva conjunto/ordem original de IDs. TRX final focado lido: 85 executados/aprovados, zero falhos. |
| Critérios de paging/audit não estavam satisfeitos apenas pelo cursor assinado e journal antigo. | Histórico assinado de hashes, limitado a 24 tokens, detecta ciclos e retorna partial. Contexto de auditoria é copiado de forma imutável; begin/claim/complete/fail/reconcile escrevem auditoria na mesma transação do journal. Recibo final e fonte do smoke confirmam rollback quando a escrita de audit é rejeitada. |

O confronto não encontrou outro defeito material aberto nesse escopo após três
rodadas corretivas do runtime. Qualquer falha posterior exige diagnóstico
independente ou mudança de abordagem, sem mais ciclos de pequenos ajustes nem
redução dos gates.

A leitura confirmou contexto autenticado separado, binding tenant/actor/connection,
autorização object/collection e projeto verificado no servidor, JQL composto por
valores escapados, cursor HMAC vinculado ao contexto, dry-run antes de
transport/segredos/journal e namespace de journal disjunto. Outcomes são JSON
opaco; registros Jira anteriores não são reinterpretados. Pending/uncertain
continuam impedindo repost cego; estimate e actual work permanecem separados.
As projeções validam snapshots locais de cinco schemas por SHA, sem SDK Jira.

Evidência desta revisão: probes determinísticos acima, leitura do source corrigido
e `/build/artifacts/srm-absorption/evidence/dotnet-work-items/work-items-ecp.trx`.
Foi comunicado PASS de 23 testes focados finais do runtime. Foram também lidos os
gates finais: `evidence/ecp-work-items-final-gates.log` registra 808 testes,
quatro skips e aprovação de contratos, registry com 23 capabilities e coverage;
`evidence/dotnet-work-items-solution.json` registra exit 0, 48 projetos e 1242
testes aprovados, zero falhos. São gates executados fora desta revisão, não
execuções próprias.

O recibo `evidence/work-items-installed-http-postgres.json` e a fonte ECP
`scripts/smoke_work_items_clients.py` foram lidos no confronto final. Registram
PASS com HTTP real de loopback, PostgreSQL compartilhado com TLS `verify-full` e
clientes Node/.NET instalados: mesmo create produz uma criação, queries e comandos
neutros atravessam HTTP, actual work ocorre uma vez, backlog parcial Node é
retomado no cliente .NET sem duplicar parent, previews não alteram journal/provider,
audit preserva contexto e rejeição forçada de audit desfaz a transição do journal.
O schema e servidor HTTP são removidos antes do recibo de sucesso.

O provider desse smoke é expressamente `recording-jira-double-not-live-jira`. O
servidor injeta identidade sintética fixa; não comprova autenticação HTTP de
produção. Os fluxos entre SDKs são sequenciais; não se afirma teste concorrente de
comandos HTTP. Queries de itens parentados não foram demonstradas naquele
smoke; a entrega 0068 abaixo registra a verificação posterior com GETs reais.
Os testes daquele smoke não equivalem a integração com Jira real, aceitação do
proprietário, promoção do contrato ou adoção por consumidores reais. A revisão do
candidato fecha sem achado material aberto no escopo confrontado; a admissão
permanece independente e pendente.

## Adendo 0068: diagnóstico e leitura Jira real

Escopo autorizado: somente leitura com as duas credenciais existentes indicadas
pelo proprietário. Não houve autorização de comandos Jira. A implementação da
nova estratégia e sua primeira revisão são uma entrega distinta, apoiada em
diagnóstico independente depois de atingido o limite de três rodadas anterior.
Referência ECP: `docs/experimental/work-items/ADR-READONLY-PARENT-PROJECTION.md`.
Revisão ECP conferida ao fechamento:
`77ac826a05eb9348745802aac5806a338e7c6d11`, checkout sem alterações pendentes.

Os recibos iniciais de 2026-11-13T15:32–15:33Z foram preservados como
`jira-live-readonly-*-attempt1.json`. Autenticação e reads internos passaram;
get/search neutros falharam. A investigação desta revisão executou somente GETs,
com a guarda de transporte, e produziu apenas shapes/booleans/causas, sem persistir
conteúdo, IDs ou títulos de itens nem valores de credenciais. Nos dois ambientes:

- Parent e seus fields existiam, mas `parent.fields.project` estava ausente.
- Projeto, título, tipo e status do child eram válidos para a projeção.
- Remover apenas parent da cópia em memória fazia a projeção passar; remover
  apenas description mantinha a falha. O ADF não era a causa dessas amostras.
- GET mínimo do parent com `fields=project` comprovou chave exata e mesmo projeto.
  Enriquecer apenas essa metadata na cópia fez get e search passarem.

A leitura cega da nova entrega confirmou `_project_item` antes da projeção pura:
projeto do child verificado, autorização object do parent antes do GET adicional,
segmento percent-encoded no origin configurado, somente `fields=project`, chave
exata e mesmo projeto exigidos. O cache é local à requisição, limitado a 100
parents; não há caminhada recursiva de ancestrais. A cópia enriquecida preserva
o objeto original. Negação, identidade/projeto divergentes e cancelamento continuam
falhas explícitas, sem inferência de projeto ou omissão silenciosa do parent.

`JiraHttpTransport.request_bounded` limita o timeout passado ao transporte ao menor
valor entre budget restante e configuração, sem alterar o timeout compartilhado.
A guarda read-only também cobre essa chamada. Transportes legados injetados
continuam responsáveis por cumprir seus limites, conforme a composição existente.
Os testes lidos cobrem negação antes do GET, chave/projeto ausentes ou divergentes,
child estrangeiro, cache por requisição, ausência de recursão, cancelamento e
isolamento do timeout. Não foi encontrado achado material aberto nesta entrega.

No confronto final, foram lidos estes recibos sob
`/build/artifacts/srm-absorption/evidence/`:

| Evidência | Resultado no escopo registrado |
|---|---|
| `jira-live-readonly-cambioreal.json`, observado em 2026-11-13T15:37:44Z | PASS: dez checks; doze GETs e zero mutações. Inclui get/search/transitions neutros. |
| `jira-live-readonly-4smart.json`, observado em 2026-11-13T15:38:09Z | PASS: dez checks; doze GETs e zero mutações. Inclui get/search/transitions neutros. |
| `jira-parent-projection-tests.log` | 28 testes aprovados, zero falhos. |
| `ecp-jira-live-readonly-gates.log` | 816 testes, quatro skips, contratos/governança, registry com 23 capabilities e coverage aprovados. |

A primeira tentativa do gate foi preservada em
`ecp-jira-live-readonly-gates-attempt1.log`: um failure e três errors decorrentes
do heading obrigatório ausente no intent. O heading foi corrigido antes do rerun;
a evidência negativa não foi sobrescrita nem tratada como PASS.

O resultado atual comprova reads nas amostras dos dois sites autorizados. Não
comprova comandos, todas as combinações de hierarquia/paginação/ACL, exposição de
serviço público, admissão do draft, publicação ou adoção. A revisão alterou somente
este relatório; as correções de implementação ficaram com o executor.
