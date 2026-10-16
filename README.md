# Platform Core

Platform Core é a base tecnológica compartilhada utilizada para construção de aplicações web, mobile e serviços backend.

Este repositório contém abstrações, bibliotecas e padrões arquiteturais reutilizáveis que servem como fundação para múltiplos produtos e projetos.

## Objetivo

Centralizar componentes estruturais da plataforma para garantir:

- padronização arquitetural
- reutilização de código
- consistência operacional
- redução de tempo de desenvolvimento
- facilidade de manutenção

## Escopo

Este repositório contém componentes genéricos e independentes de domínio.

Exemplos:

- utilitários compartilhados
- abstrações de infraestrutura
- bibliotecas comuns
- ferramentas de observabilidade
- autenticação base
- padrões de logging
- mecanismos de configuração
- helpers de integração

## Estrutura

Inventário derivado dos diretórios do repositório. Status: **ativo** = contrato JSON Schema presente sem aviso de substituição; **stub deprecado** = schema que apenas delega ao ECP (Enterprise Capability Platform); **proposto** = contrato ou perfil sem aceite/admissão. "Ativo" descreve o contrato, não instalação, publicação ou adoção por produtos (ver [CAPABILITY-MATURITY](docs/CAPABILITY-MATURITY.md)).

| Módulo | Status | Observação |
|--------|--------|------------|
| ai | ativo | token-usage, guardrail-result, mcp-tool-descriptor |
| approval | ativo | approval-request |
| audit | ativo (schema legado) | perfil de retenção 2.0.0 aceito (ADR-011); perfil JCS v1 **proposto** (ADR-013) |
| auth | stub deprecado | `auth-provider` delega a `security.authn` (ECP) |
| authorization | ativo | decision |
| configuration | ativo | config-provider |
| data | ativo | data-contract |
| directory | ativo | membership, org-node |
| feature-flags | ativo | feature-flag |
| governance | ativo | capability-intake e capability-intake-v2 |
| logging | ativo | log-entry |
| messaging | stub deprecado + proposto | `event-envelope` delega a `messaging.event-envelope` (ECP); `delivery-lease-v1` **proposto** (ADR-012) |
| multi-tenancy | ativo | tenant-context |
| notifications | ativo | notification-intent, delivery-result |
| observability | ativo | health-check |
| secrets | ativo | secret-reference |
| security | ativo | security-headers |
| utils | sem contrato | apenas documentação de padrões |

Diretórios de apoio: `docs/` (arquitetura, ADRs, guidelines, normalização), `scripts/` e `tools/` (validação), `templates/` (novo módulo).

Maturidade por capacidade (contrato, referência, durável, adotado): [docs/CAPABILITY-MATURITY.md](docs/CAPABILITY-MATURITY.md).

## Princípios

1. Independência de domínio
2. Reutilização entre projetos
3. Baixo acoplamento
4. Alta coesão
5. Extensibilidade

## Dependência

Projetos de produto podem depender deste repositório; o core nunca depende de produto (ver [ARCHITECTURE.md](ARCHITECTURE.md)).

```
Product → Core
Core → (nenhum produto)
```

## Uso

Este repositório **não publica bibliotecas nem pacotes**: contém JSON Schema, fixtures, documentação e scripts de validação (o `package.json` da raiz é privado e serve apenas à validação de contratos; nenhum workflow de publicação de pacotes foi encontrado). Não há instalação via registry a partir daqui.

Consumo: referencie cada contrato por identidade (`$id`), versão e integridade (digest) da fonte, e valide com o próprio schema. Consumo local (`file:` ou snapshot/cópia vendorizada) é diferente de instalação via registry e não comprova publicação nem adoção. Pacotes por stack, quando existem, são projetados nos repositórios core de cada stack (por exemplo `backend-core`), fora deste repositório.

## Licença / Propriedade

Este repositório contém tecnologia base reutilizável e independente de implementação de cliente específico.

Componentes desenvolvidos especificamente para projetos clientes devem ser mantidos em repositórios próprios.
