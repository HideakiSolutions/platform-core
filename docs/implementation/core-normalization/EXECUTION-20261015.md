# Execução do programa — 2026-10-15

Estado: **PARCIAL; não encerrado**. Nenhuma frente é aprovada por testes de uma dimensão diferente. As branches de trabalho precisam de PR e revisão de mantenedor antes de integração oficial. Não houve publicação, tag, deploy ou migração de produto.

| Frente | Implementação e evidência atual | Aceite ainda pendente |
|---|---|---|
| 1. Conformidade | Resolvers existentes reconciliados; integridade e preflight de referências em quatro runtimes; intakes por conteúdo/versão no CI; testes negativos; instalação isolada .NET/Python/Go/Node | CI remoto e revisão integrada; fechamento integral de todas as projeções, inclusive Rust |
| 2. Comportamento | Proposta audit-jcs-sha256/v1 e oráculos Node/Python: 33 vetores, 12 projeções estruturais, seis gates adversariais; histórico instalado revalidado | Auditoria legada Python/.NET mantém FAIL cruzado; implementação de produção/admissão do novo protocolo e demais contratos comportamentais entre stacks |
| 3. Outbox/Inbox | Contrato neutro proposto, 18 casos/58 passos; Inbox .NET versionada preservando interfaces legadas; referência em memória explicitamente não durável | As dez células PostgreSQL × RabbitMQ/Kafka × cinco stacks permanecem BLOCKED; faltam adapters e provas de durabilidade |
| 4. Adoção | Seis pacotes Cambio Real reconciliados em revisão pinada; 42 imports; prova de seis tarballs registry em consumidor sintético; catálogo separa implementação/publicação/instalação/uso/extensão | Instalação no consumidor real não verificada; sete pacotes não admitidos no grafo canônico; proposta não altera automaticamente relações; completude BLOCKED |
| 5. Mobile | Geração determinística a partir dos temas ativos pinados; APIs Hx históricas preservadas; instalação isolada; implementação Flutter experimental transferida a mobile e consumida por DS mediante snapshot íntegro | Equivalência visual e revisão de engenharia/design; CI remoto e revisão integrada; não há alegação de adoção registry para snapshots locais |
| 6. Consolidação | Inventário congelado por SHA/hash, candidatos de conformidade e leases selecionados por capacidade, cinco branches isoladas de integração | Baseline semântico parcial; destinos finais dos demais candidatos, PRs protegidos e provas da revisão efetivamente integrada |

## Evidências reproduzíveis

- Inventário: [manifesto dos snapshots congelados](evidence/manifest.json), [baseline](BASELINE-20261015.md) e [revisão](REVIEW1-20261015.md). Dez testes do coletor passaram. Os 330 registros de setembro são insumo histórico, não certificação atual.
- Contratos de mensageria: `messaging/conformance/delivery-v1/manifest.json` e `durable-matrix.json`. Corpus SHA-256 `b8cc52608d3c82a163da65b26866141316cdcd7993f37797654a7e7e48c83849`.
- Auditoria proposta: `audit/conformance/jcs-v1/`; perfil numérico restritivo explícito e timestamps UTC sem perda de nanossegundos. ADR-013 é proposta, não alteração do leitor histórico. Oráculos internos não constituem novos SDKs públicos.
- Backend: `docs/contracts/ISOLATED-INSTALLATION.md`, recibos versionados e ferramentas de reprodução. Instalados: .NET 41 pacotes/42 projetos/785 testes; Python 231; Go 244 em 20 pacotes. Integrações reais de banco/broker não são selecionadas por essas suítes padrão.
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
- [frontend-core #101](https://github.com/HideakiSolutions/frontend-core/pull/101), alvo develop: catálogo verificável e proposta separada de grafo.
- [mobile-core #13](https://github.com/HideakiSolutions/mobile-core/pull/13), alvo develop: geração e implementação Flutter.
- [design-system-core #75](https://github.com/HideakiSolutions/design-system-core/pull/75), alvo develop, depende de mobile #13: consolidação do ownership Flutter.

Todos em rascunho, sem merge. Revisão remota e CI não são presumidos pelos resultados locais. Backend: reconciliação adicional necessária com develop `5056242`, que contém resolver .NET 9.4/per-store, pilotos e mudanças oficiais não presentes em main; os resultados anteriores de instalação permanecem vinculados às revisões declaradas, sem certificar antecipadamente esse novo alvo.

Revisão independente final conferiu os 41 arquivos NuGet efetivamente restaurados e os hashes do validador/log (42 projetos/785 testes), adulterações do frontend e a selagem DS: 43 arquivos de evidência, 41 vínculos de fonte, 21 entradas do tar e 113 testes Flutter. O receipt DS tem SHA-256 `af31a92ab12706cbc6cfb6d40032c9fdb997fee46f33adaa492514c7cdf5e681`. Reconciliar as ancestralidades oficiais de frontend e mobile não alterou as árvores testadas.
