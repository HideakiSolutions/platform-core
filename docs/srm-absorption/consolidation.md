# Consolidação SRM — estado integrado


Este documento complementa a [entrega original](delivery.md). Os recibos dessa
entrega permanecem históricos e vinculados aos arquivos e pacotes que realmente
validaram. A consolidação posterior teve revisão independente e validações
próprias; não transforma dispensas ou exceções de processo em testes aprovados.

## Integração e correções

| Fonte | PR integrada | Revisão validada | Commit de merge |
| --- | --- | --- | --- |
| backend | [PR 97](https://github.com/HideakiSolutions/backend-core/pull/97) | `5e08875f6d376518edbf39cbf0ae1f39ee256be6` | `0201a02db088015009137c3c9e0b7185a62c7fb3` |
| frontend | [PR 112](https://github.com/HideakiSolutions/frontend-core/pull/112) | `f69c91d6303c8e607e487c5337b95e61f55b96b0` | `133dff69375d44271c26178ac31beded4a9a06f7` |
| platform | [PR 41](https://github.com/HideakiSolutions/platform-core/pull/41) | `bcc5cbee4ab1b032cc7907eed1caf943ec732e93` | `fda19d733ee2fef90d9ff3e22f3e528a9bcb4e74` |
| ecp | [PR 59](https://github.com/HideakiSolutions/enterprise-capability-platform/pull/59) | `1dbbbd1964138b7fb41cb14a0f99f8792600fca1` | `0f5c187e7e35a12aae591af6f5cc9dfe9a72d2c1` |

Os quatro merges acima foram conferidos na observação de 2026-11-14T01:52:03.755479+00:00. A [matriz de componentes](component-matrix.md) separa as 17 origens e as sete superfícies adicionais.


A visão de revisões, merges e hashes desta consolidação está em
[consolidation-current.json](consolidation-current.json). Os contratos adicionais de work items conservam a
admissão da ADR0016 aceita pelo proprietário e a composição autenticada opcional.
A ADR de provider access foi renumerada para `0017`, preservando o corpo aprovado; a ADR `0016` de work items e seu aceite mantêm os bytes originais. A união com `ai.provider-access@0.1.0` resulta em bundle ECP `0.6.0` com
26 capacidades. Os schemas e a implementação de provider access são reutilizados;
o backend consolida também a ancestralidade da PR paralela que reaplicava esse
mesmo candidato. Não há duas engines concorrentes introduzidas pela consolidação.

Cinco defeitos confirmados foram corrigidos no backend e receberam regressões:
minimização de identidade em auditoria Node, inspeção de arrays sem invocar
getters, validação consistente da configuração .NET, transporte de headers SQS
.NET e tratamento tipado terminal de divergência de payload no inbox Node/.NET.
Erros transitórios de persistência continuam sujeitos ao mecanismo de retry.
Os metadados de grafo apontam somente a revisão ECP validada e preservam os
recibos de candidatos anteriores.

No frontend, Checkbox já fazia parte da árvore: o merge registra a ancestralidade
sem repetir o changeset ou alterar a versão `0.13.0`. O Storybook recebeu os
aliases necessários ao pacote de autenticação; a exceção de cobertura para o
helper de apresentação foi justificada pelo mecanismo existente e revisada.

No platform, a rastreabilidade Jira foi alinhada aos contratos admitidos,
`workitem.query@0.1.0` e `workitem.command@0.1.0`. O identificador colidente da
proposta de provider access foi substituído por ADR-PA-001 e depois consolidado como ADR-014, preservando o status Proposed.
Os quatro aliases candidatos são conferidos pelo lock e hashes existentes; a
[ADR-CEP-003](../adr/ADR-CEP-003-provider-access-candidate-aliases.md) continua
**Proposed**. O pin global `contracts-v0.4.0`, a tabela de autoridades e as seis
entradas `unknown` permanecem intactos. O registro local de capacidades e a projeção MCP não ampliam a exposição pública nem habilitam invocações work-item por padrão em gateway, CLI ou MCP. Registro não implica exposição pública,
publicação ou adoção produtiva.

## Evidência e preservação

A PR platform 41 substituiu a 40 após o scanner apontar onze digests de evidência
como possíveis segredos no histórico antigo. A classificação foi confirmada por
hashes dos arquivos ECP e do tarball frontend; a política do scanner não foi
relaxada. A sucessora conserva os mesmos bytes funcionais e representa os digests
em registros tipados. O [arquivo histórico](history/README.md) preserva os bytes
V1 em gzip determinístico, com roundtrip e testes de adulteração inclusive sob
Python otimizado. O helper não usa `assert` para integridade e ancora os dois
conteúdos em digests históricos imutáveis.

A antiga ref remota própria foi removida por comparação do SHA esperado, depois
de preservação local e bundle. Não houve reescrita de main/develop. A reprovação
histórica da PR40 continua reprovada; os sete checks reais da PR41, inclusive
secret-detection, passaram sobre sua própria revisão antes do merge.

Os 34 worktrees limpos comprovadamente integrados e suas branches locais foram
removidos somente após backup e conferência. Quatro registros administrativos de
worktree ausente foram arquivados antes do prune. Checkouts SRM originais,
branches históricas necessárias à recuperação e trabalhos pendentes de outras
iniciativas foram preservados. A topologia é uma observação datada, não promessa
de ausência de WIP futuro.

## Verificação e limites

Consulte [consolidation-current.json](consolidation-current.json) para os resultados finais, revisões e URLs de
CI. A raiz completa dos recibos locais é
`/build/artifacts/srm-consolidation-20261113/`; tentativas reprovadas e filas
NOT_RUN foram preservadas. O pacote Node instalado aprovou 830 casos sem skips na fonte
`160be353d180c8adb404e7a0132dacbafa79a0b0`; o entregável `d84e92…` foi preservado e sua projeção de arquivos de pacote e runtime foi conferida após a união. A CI fresca do HEAD `c942354` também aprovou 830 casos instalados, zero skips; o tarball dessa execução (`25983e78…`) é uma evidência de build separada, sem substituir o entregável. Os 144 arquivos comuns dos dois pacotes são byte-idênticos; o entregável inclui um README adicional. A causa dessa diferença de packlist não foi verificada. Os 267 testes .NET selecionados dessa mesma fase continuam
como evidência histórica. A validação local completa posterior do perfil padrão executou
49 suítes, 1.393 casos e zero skips sobre a fonte de testes
`91c722e47b1a31ea043fdd54829d9a750d46ea92`, com TRXs frescos e o verificador
original. Os perfis de integração com broker e banco ficam fora dessa suíte padrão. O perfil de CI exige exatamente `1393/49`; identidades de teoria
receberam IDs estáveis, preservando os quatro JSONs e suas assertions.

A CI fresca de `c94235444de898ad609e35871a08b6e29b7bd5ae` também aprovou as 49 suítes .NET e 1.393 casos instalados, sem skips; o checkout sintético `9d1f30fb53e094eebe36c3a4c78b5125ec29b3cc` possui a mesma árvore dessa fonte. Essa prova remota é separada da execução local em `91c722e…`.

Na união final do backend, `5e08875f6d376518edbf39cbf0ae1f39ee256be6`, os seis caminhos alterados são de governança e metadados. A comparação independente confirmou 1.075 entradas de runtime, testes, assets, contratos, locks e workflows de runtime iguais à fonte `c942354…`, cuja CI real teve 22 sucessos e a publicação SKIPPED. Essa evidência imutável de runtime foi reaproveitada; o [validate obrigatório da nova revisão](https://github.com/HideakiSolutions/backend-core/actions/runs/43541842713/job/132283952440) passou efetivamente, incluindo os guards históricos JVM e testes afetados. Os jobs adicionais automáticos da nova revisão ainda pendentes na observação ficam **PENDING**, não PASS nem dispensa; seus estados estão no snapshot JSON. A prova de igualdade de entradas não afirma igualdade da árvore inteira, alterada pelos metadados.

A identidade JVM adicionada ao grafo é **retired / historical-source-only**: valida proveniência histórica e ausência dos caminhos atuais, sem declarar SDK atual, publicação ou adoção. A compatibilidade das identidades antigas de event-envelope permanece restrita ao grafo.

Os nove NuGets entregues conservaram seus hashes. Quarenta e três builds
auxiliares de dependências foram usados somente na reprodução da CI e removidos
com seus caches e consumidores temporários. Os hashes e manifestos dos testes
permanecem nos receipts. Mudanças posteriores em testes, metadados e workflow têm
provas específicas de preservação dos arquivos de execução dos produtos.
O ECP reconciliado aprovou 831 testes, com quatro skips declarados, catálogo26,
cobertura oito stacks e gates de compatibilidade/evidência. Seus quatro jobs
reais de PR/push passaram; login e publicação de imagem ficaram SKIPPED.

Uma prova focada posterior confirmou headers SQS entre .NET `Messaging.Sqs@0.1.0-experimental.3` e Node `0.3.0-experimental.2` instalados: duas direções, quatro headers incluindo Unicode, SDKs reais e ACK no LocalStack efêmero. Filas, container, rede, scratch, timer e referência temporária no pass tiveram limpeza confirmada independentemente. O teste usou inbox em memória e mede transporte/marshalling; não repete as provas duráveis históricas nem alega AWS gerenciada. Receipts: `backend-sqs-headers-executor-receipt.json` e `backend-sqs-headers-independent-confrontation.json`.

As provas históricas reais de Keycloak, SQS/LocalStack, React18/19 e jornada
integrada continuam limitadas aos pacotes/revisões dos recibos originais. Esta
consolidação não declara repetição integral desses smokes externos. LocalStack não é AWS
SQS gerenciada. Novas escritas Jira e novos smokes Graph/Teams permanecem
**dispensados pelo proprietário**, não PASS. A exceção de processo da entrega
original continua ACCEPTED_EXCEPTION, preservando seu histórico NONCONFORMANT.

O workflow ECP agora exige acionamento manual explícito para publicar a imagem;
push/PR continuam validando o build. Nenhum acionamento manual de publicação foi feito.
Publicação em registry, release, deploy e adoção de produtos permanecem fora desta
execução. A disponibilidade global de HSEOS e AEW não comprova adoção ou
enforcement; nenhuma instalação nova foi realizada.
