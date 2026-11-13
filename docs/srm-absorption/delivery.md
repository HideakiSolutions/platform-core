# Absorção SRM — entrega experimental e gates pendentes

Classificação: **componentes experimentais utilizáveis em consumidores isolados; objetivo
integral ainda incompleto**. As capacidades selecionadas foram incorporadas aos contratos
existentes, com adapters opcionais, pacotes locais e consumidores de referência. Os alvos
externos restantes, as operações Jira de escrita e a admissão do novo contrato de work items continuam pendentes. Isso não é uma
declaração de disponibilidade de produção, publicação ou adoção.

## Resultado utilizável

- Backend Node: fundamentos determinísticos, configuração tipada, Pino/redaction,
  instrumentação OTel, recorder/sinks de auditoria, autorização local opcional,
  aprovação persistente com CAS/outbox, Graph, sessão/SAML, MFA/Redis, clientes ECP
  e transporte SQS opcional.
- Backend .NET: extensões nos pacotes existentes, adapters Graph/SAML/MFA/Redis/SQS,
  persistência de aprovação PostgreSQL, notificações ECP, OTel e cliente experimental
  de work items. Result e TimeProvider foram reutilizados.
- Runtime ECP: providers SMTP/Teams opcionais; provider Jira e projeção CQRS
  experimental com journal durável, auditoria transacional, dry-run e retomada.
  Os novos contratos `workitem.query`/`workitem.command` não entram no catálogo ou
  dispatcher padrão. Os clientes fixam o profile `workitems-cqrs/0.1.0-draft.1`.
- React/Helix: composição opcional de ações de login, loading/erro/retry e cenários
  reutilizáveis de navegação, tabela e indicadores. Keycloak e APIs anteriores
  continuam disponíveis.

Os 17 pacotes de origem e 120 módulos `src/` têm rastreabilidade e hashes em
[traceability.json](traceability.json). Nenhuma autoridade `unknown` foi promovida;
o pin `contracts-v0.4.0` permanece inalterado. Marcas, avatares, `.env`, dados de
demonstração e políticas de cliente foram excluídos.

## Verificação e artefatos

A raiz dos artefatos locais é `/build/artifacts/srm-absorption/`. Os recibos originais
contêm hashes e escopo; não foram substituídos por uma narrativa de sucesso. O
[índice de evidências](evidence-summary.json) fixa checksums e revisões dos resultados.

| Entrega | Evidência e limite |
| --- | --- |
| .NET source | 48 projetos, 1.242 testes aprovados, zero falhas; `evidence/dotnet-work-items-solution.json`. |
| .NET pacotes | 51 NuGets no feed local; 48 projetos e 1.242 testes novamente aprovados em consumidor isolado, zero skips. Integridade dos arquivos restaurados e source revision verificados. O teste não usa ProjectReference para produção. |
| Node | Suíte completa de 717 testes antes da última correção de vínculo do journal; depois dela, 108 testes focados, typecheck, build e instalação/tamper do pacote aprovados. Recibos preservam essa sequência, sem somar contagens como uma nova suíte. |
| React | Cinco tarballs instalados; React 18.3.1 e 19.2.6: 42 testes em cada, typecheck e bundle sem dependências backend; axe/teclado/foco/temas no escopo dos testes. Não é smoke de IdP ou revisão visual em produção. |
| ECP | 816 testes executados, quatro ignorados, sem falhas; contratos, registry de 23 capacidades e coverage aprovados. |
| Integração work items | Clientes .NET/Node instalados, HTTP real e PostgreSQL compartilhado com TLS verificado; **Jira simulado**. Criação única entre stacks, retomada parcial, estimativa distinta de trabalho realizado, dry-runs sem efeitos e rollback da auditoria. |
| Jira real somente leitura | Duas credenciais/sites autorizados: autenticação, projetos/tipos, item/busca e transições; neutral get/search/transitions passaram, somente GET e zero mutações. A projeção de parent foi corrigida após diagnóstico independente. |
| Infra compartilhada | Smokes reais de Redis (OTP/TOTP concorrentes), PostgreSQL (aprovações/journal) e SMTP no Mailpit. Os recibos detalham concorrência, recuperação e limpeza. |
| Dependências e código | Auditorias dos novos adapters sem vulnerabilidades reportadas nos recibos; typecheck/compilação, gates dos repositórios e diff-check. Varredura limitada de padrões de segredos nos arquivos alterados passou; não equivale a um scanner exaustivo. |
| Revisão independente | Duas passagens; achados corrigidos, três rodadas no runtime WorkItems; limites e evidências em [independent-review.md](independent-review.md). |

A instalação local usa arquivos `.tgz`/`.nupkg` empacotados, sem dependências `file:`
do ZIP. Esses artefatos não foram publicados em registry.

## Pendências que impedem encerrar o objetivo integral

1. Identificar os alvos restantes: Graph tenant/perfil, Teams canal, SQS fila e IdP
   realm/tenant/jornada de step-up. Jira de escrita exige projeto de teste e autorização
   explícita; as duas credenciais existentes já foram usadas com êxito somente para leitura. O usuário informou
   que credenciais existem em `pass`; o bloqueio é a identificação dos ambientes
   de teste, não uma alegação de falta de credenciais. Não foi usado um projeto
   Jira de cliente por inferência.
2. Executar os smokes externos e a jornada integrada nesses alvos. HTTP/PG com Jira
   simulado não comprova Jira real, autenticação HTTP de produção ou concorrência
   HTTP entre SDKs. Consultas reais de itens com parent passaram nos dois sites após enriquecimento autorizado
   do projeto do pai; identidade ou projeto divergente continuam negados. Escritas reais
   não foram tentadas nem ficam autorizadas por esse resultado de leitura.
3. Aceite do proprietário para admissão dos novos contratos CQRS, promoção e
   metadados canônicos de serviço. A implementação experimental concreta já está
   disponível para revisão; o aceite não bloqueou seu desenvolvimento.

`validate-srm-absorption.py --require-complete` **rejeita corretamente esta entrega
incompleta**. Os gates não foram reduzidos. Publicação, merge e deploy estão fora do
escopo automático; sua ausência não foi disfarçada como adoção.

## Uso e rollback

Consulte os READMEs dos adapters e os consumidores em
`node/examples/work-items-ecp-harness.mjs`, `dotnet/examples/srm-absorption-consumer`
e `react/examples/`. Os smokes são opt-in, usam referências de pass e registram
somente evidência sanitizada. Migrações são aplicadas pela aplicação consumidora;
as bibliotecas não provisionam serviços compartilhados.

Para rollback, remova a composição e as referências experimentais e drene
consumidores SQS. Preserve journal, outbox e registros de aprovação até reconciliar
efeitos incertos; nunca apague um claim para fabricar uma nova tentativa. A adição
Jira usa namespace de fingerprint/journal separado e não reinterpreta registros
experimentais anteriores. Sessão da aplicação, validação de tokens e MFA opcional
não substituem implicitamente enrollment/recuperação/autenticação padrão do IdP.

Os problemas observados em infraestrutura foram registrados: INFRA-0034 (reset de
port-forward, mitigado pelo acesso LAN documentado) e INFRA-0044 (instalação frontend
concluída com cache; autenticação remota do registry não comprovada causalmente).
Ativação AEW e enforcement global dos consumidores permanecem **não verificados**.
