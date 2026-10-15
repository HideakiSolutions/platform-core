# Execução do programa — 2026-10-15

Estado: **PARCIAL; não encerrado**. Nenhuma frente é aprovada por testes de uma dimensão diferente. As branches de trabalho precisam de PR e revisão de mantenedor antes de integração oficial. Não houve publicação, tag, deploy ou migração de produto.

| Frente | Implementação e evidência atual | Aceite ainda pendente |
|---|---|---|
| 1. Conformidade | Resolvers existentes reconciliados; integridade e preflight de referências em quatro runtimes; intakes por conteúdo/versão no CI; testes negativos; instalação isolada .NET/Python/Go/Node | CI remoto e revisão integrada; fechamento integral de todas as projeções, inclusive Rust |
| 2. Comportamento | Proposta audit-jcs-sha256/v1 e oráculos Node/Python: 33 vetores, 12 projeções estruturais, seis testes stdlib, incluindo negativos; histórico instalado revalidado | Auditoria legada Python/.NET mantém FAIL cruzado; implementação de produção/admissão do novo protocolo e demais contratos comportamentais entre stacks |
| 3. Outbox/Inbox | Contrato neutro proposto, 18 casos/58 passos; Inbox .NET versionada preservando interfaces legadas; referência em memória explicitamente não durável | As dez células PostgreSQL × RabbitMQ/Kafka × cinco stacks permanecem BLOCKED; faltam adapters e provas de durabilidade |
| 4. Adoção | Seis pacotes Cambio Real reconciliados em revisão pinada; 42 referências verificadas; prova de seis tarballs registry em consumidor sintético; catálogo separa implementação/publicação/instalação/uso/extensão | Instalação no consumidor real não verificada; sete pacotes não admitidos no grafo canônico; proposta não altera automaticamente relações; completude BLOCKED |
| 5. Mobile | Geração determinística a partir dos temas ativos pinados; APIs Hx históricas preservadas; instalação isolada; implementação Flutter experimental transferida a mobile e consumida por DS mediante snapshot íntegro | Equivalência visual e revisão de engenharia/design; CI remoto e revisão integrada; não há alegação de adoção registry para snapshots locais |
| 6. Consolidação | Inventário congelado por SHA/hash, candidatos de conformidade e leases selecionados por capacidade, cinco branches isoladas de integração | Baseline semântico parcial; destinos finais dos demais candidatos, PRs protegidos e provas da revisão efetivamente integrada |

## Evidências reproduzíveis

- Inventário: [manifesto dos snapshots congelados](evidence/manifest.json), [baseline](BASELINE-20261015.md) e [revisão](REVIEW1-20261015.md). Dez testes do coletor passaram. Os 330 registros de setembro são insumo histórico, não certificação atual.
- Contratos de mensageria: `messaging/conformance/delivery-v1/manifest.json` e `durable-matrix.json`. Corpus SHA-256 `b8cc52608d3c82a163da65b26866141316cdcd7993f37797654a7e7e48c83849`.
- Auditoria proposta: `audit/conformance/jcs-v1/`; perfil numérico restritivo explícito e timestamps UTC sem perda de nanossegundos. ADR-013 é proposta, não alteração do leitor histórico. Oráculos internos não constituem novos SDKs públicos.
- Backend: `docs/contracts/ISOLATED-INSTALLATION.md`, recibos versionados e ferramentas de reprodução. Alvo develop reconciliado: .NET 41 pacotes/42 projetos/923 testes na revisão e473d0d; Node 405, Python 353 e Go 315 na revisão 6ea3de0, complementados por cinco casos instalados por runtime em e473d0d. Zero skips obrigatórios. Recibos finais e scripts estão em docs/contracts/evidence/ no PR backend #34. Integrações reais de banco/broker não são selecionadas por essas suítes padrão.
- Frontend: `docs/evidence/adoption/`, catálogo gerado e proposta separada de admissão. Instalar artefatos em fixture sintética não prova instalação no Cambio Real.
- Mobile/DS: locks de fontes e snapshots, recibos de geração e instalação; nenhuma dependência de checkout irmão nas provas oficiais novas.

## Revisão e limites

Cada entrega recebeu revisão cética independente. Achados de referências opcionais não resolvidas, metadados de intake incompletos, integridade da proposta de auditoria e identidade de artefatos foram corrigidos sem reduzir gates. Recibos antigos ou interrompidos permanecem preservados com seus limites/supersessões. FAIL/BLOCKED de V2, Android e templates não foram convertidos em PASS.

A área de execução `/workspace/local/core-normalization-20261015` preserva artefatos instaláveis, logs e worktrees. Os checkouts originais e alterações preexistentes dos templates foram preservados. Publicação, implantação, remoção do legado e conclusão integral dessas iniciativas permanecem fora do escopo.

## Governança e autorização

Escopo explícito: platform-core, design-system-core, backend-core, frontend-core, mobile-core e dois templates inventariados sob o agregador hideaki-solutions-core. O agregador não é um repositório Git. Decisão do usuário: manter configuração atual, sem instalar HSEOS.

Aplicam-se `/home/annonymous/.claude/AGENTS.md` e o produtor global `2b4d6f37caf748947cca8195f16b8534b5c8ab9e`, especialmente governance-discovery, Constituição, índice core e Git Flow. CONTRIBUTING exige revisão de mantenedor; DS exige engenharia e design. Disponibilidade de ferramentas não comprova enforcement. AEW permanece NOT VERIFIED para ativação/enforcement.

## PRs de integração

- [platform-core #20](https://github.com/HideakiSolutions/platform-core/pull/20), alvo develop: baseline e contratos propostos.
- [backend-core #34](https://github.com/HideakiSolutions/backend-core/pull/34), alvo develop: resolvers, intakes, leases e provas instaladas, preservando JsonSchema.Net 9.4/per-store e pilotos oficiais.
- [frontend-core #101](https://github.com/HideakiSolutions/frontend-core/pull/101), alvo develop: catálogo verificável e proposta separada de grafo.
- [mobile-core #13](https://github.com/HideakiSolutions/mobile-core/pull/13), alvo develop: geração e implementação Flutter.
- [design-system-core #75](https://github.com/HideakiSolutions/design-system-core/pull/75), alvo develop, depende de mobile #13: consolidação do ownership Flutter.

Todos em rascunho, sem merge. CONTRIBUTING exige revisão de mantenedor, e DS exige engenharia e design. Backend foi reconciliado com develop `5056242`; diferenças preexistentes main/develop estão registradas no PR #34 e bloqueiam promoção sem estratégia versionada revisada.

Revisão cética final conferiu 41 pacotes NuGet restaurados, 923 casos em 42 projetos, arquivos instalados Node/Python/Go (37/32/84), hashes de artefatos/logs e o suplemento de cinco fixtures por runtime. São provas por revisão e dimensão: não representam novas suítes completas dos três runtimes em e473d0d. Auditoria legada instalada foi reexecutada na fonte reconciliada: seis verificações locais PASS e seis cruzadas FAIL; protocolo JCS de produção permanece NOT_IMPLEMENTED.

A revisão DS conferiu 43 arquivos selados, 41 vínculos de fonte, 21 entradas do tar e 113 testes Flutter. O receipt runtime DS tem SHA-256 `af31a92ab12706cbc6cfb6d40032c9fdb997fee46f33adaa492514c7cdf5e681`. O fechamento posterior de component bindings conferiu 26 inputs físicos, 15 testes e seis comandos em revisão imutável 1ee3ee0; a evidência runtime permaneceu byte a byte preservada. Reconciliar as ancestralidades oficiais de frontend e mobile não alterou as árvores testadas.

## Revalidação remota e candidatos duráveis

O [CI mobile 38811622716](https://github.com/HideakiSolutions/mobile-core/actions/runs/38811622716) passou em `2ed292d`: geração/negativos/TypeScript, Flutter analyze/test e instalação isolada. O recibo baixado está congelado no manifesto, SHA-256 original `236aa260bfd943343e93d2abae3f70395d44f5e4372c0bed10bb901efedee45a`. Ele mantém registry NOT_VERIFIED e equivalência visual BLOCKED; nenhum resultado local virou prova visual.

A [triagem de candidatos duráveis](DURABLE-CANDIDATES-20261015.md) consultou 386 revisões pinadas e identificou 15 fontes para análise semântica. O JSON e o índice bruto estão no manifesto. Dez células permanecem sem prova própria; nenhum serviço foi acessado e nenhum candidato foi descartado ou certificado como durável.

## Estado observado de CI

Platform #20 passou no run 38811985519 e mobile #13 passou no run 38811622716. No backend #34, a execução 38817030241 já aprovou build/test .NET e a execução 38817030190 aprovou Node; Go e instalação Python 3.12 ainda estavam pendentes na consulta de fechamento. DS #75 ainda executava validate no run 38817029295. Frontend conserva falha intencional do gate de adoção: os sete pacotes ausentes do grafo canônico não foram admitidos automaticamente; package-tests passou na execução anterior. Esses estados são observações datadas, não aprovação antecipada de novos commits ou da revisão integrada.
