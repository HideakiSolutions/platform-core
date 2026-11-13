# Absorção SRM — continuação da implementação e admissão separada

Classificação: **implementação experimental utilizável em consumidores instalados;
implementação e admissão local concluídas após aceite explícito do proprietário**. Publicação em registry,
merge, deploy e adoção de produtos permanecem fora desta execução.

## Resultado utilizável

O motor Jira existente serve os profiles `workitems-cqrs/0.1.0` e
`workitems-cqrs/0.1.0-draft.1`. O primeiro usa schemas ECP canônicos versionados
admitidos após o aceite; o segundo permanece explícito para compatibilidade.
Fingerprints, cursores e journals incluem o profile: não há migração ou reinterpretação
implícita de registros. Contexto autenticado vem do host; actor/tenant do corpo são
somente declarações vinculadas a esse contexto. Ausência ou divergência é negada
antes de provider/journal, inclusive em dry-run. Conexão, projeto, objeto retornado
em busca e referências de pai exigem autorização.

Em ECP, `capabilities/workitem.query` e `capabilities/workitem.command` contêm schemas, conformance, políticas,
provider Jira, OpenAPI, AsyncAPI, MCP desabilitado e metadados das duas capacidades.
`CanonicalWorkItems` é composição opcional e reutiliza o mesmo motor/provider.
Nenhuma rota foi habilitada no gateway padrão. AsyncAPI declara explicitamente que
transições locais de journal/auditoria não são publicação em broker. Não se afirma
entrega de eventos externos, exposição pública ou disponibilidade de produção.

A ADR estratégica **0016** foi aceita explicitamente pelo proprietário com “Autorizado!” em resposta à solicitação de aceite da ADR e fechamento excepcional. O preview aditivo
`0.6.0` é gerado em cópia isolada pelo script `prepare_work_items_bundle.py`, com
os validadores existentes de schema/governança, registry, coverage e policy de
implementações novas. Após o aceite, os dois contratos 0.1.0 foram copiados para `capabilities/`, o
bundle local avançou para `0.6.0` e o catálogo contém 25 capacidades. Gateway,
CLI e geradores MCP/demo/SDK genérico respeitam os flags de exposição; os novos
contratos continuam exigindo composição explícita autenticada. Platform-core
preserva o pin `contracts-v0.4.0` e as seis autoridades `unknown`; o vínculo
aditivo da nova superfície está em `docs/architecture/contract-authority/work-items-admission.json`. No catálogo local,
implementações ficam `planned` até publicação e evidência HTTPS CI exigidas pela
Decision0013; evidências suplementares registram implementação/instalação locais.
Isso não é promoção disfarçada ou URL de CI inventada.

## Evidências desta continuação

Raiz: `/build/artifacts/srm-absorption/`. O índice
[evidence-summary.json](evidence-summary.json) fixa revisões, arquivos e hashes.
Os recibos anteriores, inclusive tentativas reprovadas, permanecem preservados.

| Critério | Resultado verificável e limite |
| --- | --- |
| ECP | Na admissão autorizada: 825 testes, quatro skipped declarados, sem falhas; registry com 25 capacidades, coverage oito stacks, compatibilidade aditiva, policy de implementações e quality gates aprovados. O resultado anterior 823 permanece preservado. Sete regressões novas cobrem profiles, isolamento, contexto e autorização individual. |
| Clientes Node | Pacote `@hideakisolutions/platform-node@0.3.0-experimental.1`; 101 testes, typecheck/build, instalação, validators dos dois profiles e tamper checks aprovados. |
| Cliente .NET | `Hideakisolutions.Platform.WorkItems.Ecp@0.1.0-experimental.2`; 153 testes source e 153 via NuGet instalado aprovados, zero skips. Resultado final dos 48 projetos instalados: 1.310 testes aprovados, zero falhas/skips; 45 resultados iniciais e três revalidações após corrigir configuração do harness, sem alegar uma única execução integral verde. |
| HTTP + PostgreSQL canônico | Oito cenários aprovados com clientes instalados: criação única entre stacks, retomada Node→.NET, consultas, estimativa distinta de trabalho real, dry-run sem efeitos, contexto obrigatório e rollback transacional de auditoria. TLS PG verificado. **Identidade sintética e Jira double**, explicitamente declarados. Schema/HTTP/scratch removidos. |
| Segurança de dependências | Auditorias Node produção e .NET transitivas sem vulnerabilidades reportadas. AST/compilação/typecheck/diff-check e varreduras limitadas de padrões de segredos nos arquivos alterados; não equivalem a SAST exaustivo. |
| SQS | Baseline em LocalStack por digest com publicação/consumo cruzados .NET/Node, duplicação, reentrega pré-ACK, retry limitado, quarentena e drain. Persistência PG na composição .NET e SQLite WAL/FULL no harness Node, explicitamente identificados. Integração com emulador, **não AWS gerenciada**. O final4 aprovou os cenários nas duas direções e conferiu cinco DLLs instaladas contra os NuGets selecionados. |
| Identidade | Standalone real no Keycloak compartilhado: PKCE, sessão, enrollment TOTP/código errado, JWT assinado ACR1→2, assertions SAML assinadas aceitas em adapters Node/.NET instalados e replay/correlação negados. O final4 confirmou consumo atômico com um vencedor em quatro entregas simultâneas e logout HTTP 2xx verificado. Realm exclusivo temporário; não valida o mapeamento padrão de roles Keycloak. |
| React/Helix | Pacotes instalados, jornada teclado/foco/loading/erro/retry; recibos anteriores preservam React18/19 e 42 testes em cada. Jornada de IdP desta continuação usa os tarballs existentes, sem reempacotar UI não alterada. |
| Jornada integrada | O mesmo contexto real do Keycloak e event_id atravessaram autorização, SQS, PostgreSQL, replay Redis e Mailpit no final4, incluindo Graph/Teams/Jira como recording doubles identificados pelos adapters/providers existentes. Seus recibos estão encadeados por SHA-256. Não houve novas chamadas externas desses três providers. |
| Revisão cética | Achados de autorização, metadata/policy do candidato e higiene/atomicidade do harness foram examinados e corrigidos. Confronto final confirmou correções, hashes e higiene. Findings técnicos CLOSED; fechamento excepcional autorizado pelo proprietário, preservando o desvio histórico. |

As leituras Jira reais nos dois sites e os testes anteriores de comandos, retomada,
persistência, Graph/Teams e infraestrutura compartilhada continuam referenciados;
não foram substituídos por novas alegações. Os 17 pacotes e 120 módulos de origem
mantêm hashes em [traceability.json](traceability.json). Marcas, avatares, `.env`,
dados de demonstração e políticas de clientes não foram absorvidos.

## Dispensado pelo aceite do proprietário

Somente os seguintes gates são `WAIVED`, conforme o plano fornecido no pedido de
implementação e [acceptance-decisions.json](acceptance-decisions.json):

- Novas escritas Jira: não executadas; evidências reais de leitura e testes de
  comandos/retomada/persistência preservados.
- Novos smokes externos Graph e Teams: origem produtiva informada pelo proprietário;
  conformidade dos adapters mantida, **sem nova validação em produção**.

O validator não permite dispensar identidade, SQS ou qualquer outro gate; tampouco
permite apagar gates ou marcar PASS sem evidência vinculada por hash.

## Processo e fechamento

O gate ECP inicial falhou pelo e-mail Git pessoal fora do padrão configurado. Após
a autorização explícita do proprietário, a configuração aceitou exatamente
`marciohideaki@gmail.com`, preservando os endereços `@hideakisolutions.local`,
incluindo admin, e a regra contra atribuição de IA. A falha original foi mantida;
nenhuma identidade foi impersonada. O proprietário também determinou manter a
configuração atual de HSEOS, sem nova instalação.

O desenvolvimento do harness de identidade ultrapassou três tentativas antes do
diagnóstico independente exigido. Isso é **não conformidade de processo**, não
conformidade retroativa. O revisor confirmou causas e mudança de abordagem; a
composição passou a usar seed Base32 manual, submit nativo e cliente SAML dedicado
à identidade, sem relaxar adapters. Os recibos de tentativas e o desvio foram
preservados. Detalhes em `backend-core/node/docs/srm-identity-validation.md`.

A verificação funcional está concluída: final2 preserva React19 e o final4 React18
inclui os três doubles na mesma jornada. A revisão independente confirmou os
recibos, hashes e a higiene; findings técnicos estão encerrados. O proprietário respondeu “Autorizado!” ao aceite da [ADR0016 no ECP](/workspace/github/hideaki-solutions-core/.wt/srm-ecp/documentation/decisions/0016-work-items-strategic-admission.md)
e ao fechamento excepcional desta entrega. A revisão de processo recebe
**ACCEPTED_EXCEPTION**, nunca um PASS de teste: o histórico continua NONCONFORMANT.
A admissão local dos contratos foi aplicada após o aceite e passou os gates
correspondentes. O registro literal, digest do documento revisado e escopo estão
em `ECP/proposals/work-items/owner-acceptance.json`.

O validator final confirma 17 pacotes, 120 módulos e seis autoridades preservadas,
com zero entregas funcionais abertas. A matriz distingue as três dispensas de
smoke da exceção de processo autorizada e da admissão efetivamente verificada.
`--require-complete` só passa após validar a autorização por hash, preservar o
histórico do desvio, comprovar o catálogo/bundle 0.6.0 e encerrar o confronto final.
O aceite vale somente para esta entrega e não altera a política geral de correções.

A divergência de bytes no cache NuGet global foi mitigada com restore isolado,
source mapping exclusivo e hashes contra os pacotes selecionados (INFRA-0051).
O Podman retornou 125 durante remoção da rede rootless; objetos próprios ausentes,
nenhuma referência de processo própria, helpers anteriores ao teste e zero eventos
de volume foram verificados sem matar processos compartilhados (INFRA-0052).
As duas issues permanecem com limites e mitigação, sem remediação global inferida.

Os consumidores preparados e o venv de validação foram removidos após revisão,
com recibo de preparação arquivado por digest. Filas, containers, redes, schemas,
chaves Redis, realms, entradas temporárias de pass e scratch próprios têm comprovação
de limpeza nos recibos. Pacotes e evidências sanitizadas foram preservados.

## Uso, rollback e higiene

Use somente composição host opcional e pacotes locais instalados; examples/scenarios
são consumidores de teste identificados. Remova referências experimentais para
rollback e drene SQS antes de desmontar. Preserve journal/audit/outbox até reconciliar
efeitos incertos; não apague claims para fabricar retry. Bibliotecas não criam
serviços compartilhados nem realms. Recursos exclusivos desta execução têm cleanup
em finally/trap e evidências sanitizadas; segredos temporários são revogados/removidos
do pass. A configuração compartilhada existente permanece sob sua autoridade.

Ativação AEW e enforcement global nos consumidores permanecem **não verificados**;
ferramentas globais disponíveis não comprovam adoção ou proteção automática.

## Fechamento após autorização

A revisão independente da admissão foi concluída em duas passagens e confirmou os
arquivos aprovados, os hashes do bundle e do vínculo aditivo, os 825 testes ECP e
as nove regressões do aceite. Nenhum achado técnico bloqueante permaneceu. A matriz
fecha a admissão com PASS e a revisão com ACCEPTED_EXCEPTION, vinculada à decisão
explícita do proprietário. O histórico do desvio permanece NONCONFORMANT.
Implementação e admissão local ficam concluídas conforme o aceite revisado;
publicação, release, merge, deploy e adoção não foram realizados.
