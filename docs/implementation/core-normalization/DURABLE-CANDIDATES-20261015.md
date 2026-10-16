# Reconciliação estática de candidatos duráveis — 2026-10-15

Foram consultadas 386 revisões Git pinadas dos cinco cores (31 platform, 180 DS, 63 backend, 96 frontend, 16 mobile), união do inventário congelado com refs observadas. Nenhum checkout original foi alterado e nenhum banco ou broker foi acessado. Os detalhes de SHA, path, hash e limites estão no JSON acompanhante; o índice bruto preserva todos os matches para triagem humana.

As dez células .NET/Node/Python/Go/Rust × PostgreSQL × RabbitMQ/Kafka permanecem **NOT_VERIFIED**, com gate bloqueado pela falta de prova própria da combinação. Isto não afirma inexistência global de implementação.

Priorizar revisão dos ports .NET Outbox/Inbox e leases legacy `52873b5`/V2 `c0ccb85`, preservando suas interfaces e limites. O V2 já declara identidade tenant/consumidor/mensagem, fencing e extensão transacional, mas sua implementação fornecida é em memória. Publishers RabbitMQ/Kafka em `b6931b9` possuem candidatos concretos de confirmação/entrega; seus testes de transporte não demonstram atomicidade SQL, concorrência entre processos, crash/recovery ou ACK/offset após efeito persistente. Os arquivos de teste foram lidos, não executados.

Preservar as referências Node/Python/Go em memória e suas provas de configuração. Elas não devem ser promovidas a duráveis. Rust não teve match de mensageria no escopo de extensões/revisões pesquisado; descobrir explicitamente repositório/owner é próximo passo, sem transformar resultado limitado em ausência global.

Nenhum candidato foi descartado ou declarado superado. Matches restantes continuam destinados à triagem manual no scan bruto; dependências sem validação semântica permanecem desconhecidas. A alegação histórica de 330 registros é apenas insumo: unidades, completude e resultados antigos não foram recertificados.
