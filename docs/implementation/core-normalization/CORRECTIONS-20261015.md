# Correção dos achados — continuação de 2026-10-15

O PR backend #34 recebeu as correções em `81c6e95` e o candidato Go em
`bef3219`. A revisão final `865d6ed` também vincula Go ao intake proposto e sela as provas no próprio backend; oito intakes passaram estruturalmente. Nenhum merge oficial foi realizado. Esta atualização sucede os
registros históricos de EXECUTION-20261015.md sem substituir suas provas.

## Gates de instalação

Doze `assert` do verificador Node/Python/Go foram convertidos em verificações
explícitas, que continuam operando sob `python -OO`. A fonte precisa estar limpa,
incluindo arquivos não rastreados; HEAD e hash dos caminhos/bytes rastreados são
confrontados antes/depois. Fixtures efetivamente copiadas rejeitam arquivos ignorados
não rastreados e symlinks, inclusive schemas selecionados dinamicamente.

O helper .NET confronta TRX por projeto, assembly, caso, execução, definições e
contadores. Resumos de stdout não aprovam mais a suíte. As exclusões correspondem
às regras de cada origem copiada, após um achado independente sobre logs ignorados
no vendor. O CI retém os TRX. Doze guardas de runtime e nove de .NET passaram em
modo otimizado; logs e recibo permanecem na área de evidências.

A instalação Node real passou **444 casos**, zero skips e 17 exports, em `01d0d84` com
verificador otimizado. O nome histórico do diretório `4f73aea` não identifica a fonte:
o receipt registra `01d0d845e806224e6f50e7b5ca2c543be3a36d49` e o hash do helper.
O tar possui SHA-256 `4d4ad79ff30b4e9f2f98d5669f3a1d5f0cdb182927f8674c765c5a0d563fa8d2`.

## Projeção Go de auditoria

A operação explícita `audit/jcsv1` reutiliza o contrato e corpus de platform
`e82ef12d90598ed9433bb87d5deeeb04b03f58cf`, sem alterar os leitores legados.
Schemas embarcados são idênticos aos canônicos, com integridade pinada e resolução
nativa offline. O runtime não procura checkouts irmãos. ADR-013 continua proposta;
nenhuma admissão, publicação ou nova família de SDK foi criada.

A revisão cética encontrou reuso de mapa nos testes negativos, que poderia mascarar
falhas. Cada caso agora parte de mapa novo e exige baseline positivo. A revisão
estática passou após a correção. Fonte e instalação isolada em `bd63d5b` passaram
**358 casos cada**, zero skips, incluindo 33 vetores comuns. O helper externo tem
SHA-256 `5e306a26c244417800e43558b39645d1a638ce8a9f98ed570824e867e4f6198a`.
O ZIP local possui SHA-256 `bdf386da48ef99d3fa06a9b55ffcd484ce08e5fa71e0168088dcfe1903f7fce9`.
A revisão candidata não é relabelada como a revisão do PR: as provas integradas
remotas são registradas separadamente ao concluírem.

## Limites e evidências

Os recibos e as revisões céticas estão congelados no manifesto de evidências.
Cinco negativos Go reprovaram pelas causas esperadas: corpus ausente, vazio e
adulterado, schema embarcado adulterado e seleção esperada zero. O manifesto
Go sela 12 arquivos; seus hashes foram confrontados independentemente. O mínimo
Go 1.23 ainda não foi executado localmente; a prova local usa Go 1.26.8.
A execução remota do head final `865d6ed` está pendente neste registro.
A rodada funcional anterior `bef3219` passou a instalação Go no run38825852751:
358 casos, zero skips, Go 1.23.12. O receipt aponta ao merge sintético
`a50de625a0f8860c239e4da8f57f7e2283dd83f2`, cuja árvore é idêntica à de
`bef3219`; pais e árvore foram confrontados e congelados. Isso verifica o mínimo
no CI, preservando o limite da prova local em Go 1.26.8. Na rodada
anterior `81c6e95`, PostgreSQL 10, Go 315 e .NET 923/42 passaram;
os 42 TRX foram confrontados independentemente. O checkout .NET foi o merge
sintético `942960fa50e49e80e542546aa5a8197cb19ce580`, com pais develop `5056242`
e head `81c6e95` e árvore `996c2f5b8e2891be4d4c53350dda476ef2318333`, idêntica
à do head. Os 42 arquivos NuGet foram re-hasheados; o cache restaurado não foi
baixado para confronto independente. Três runs anteriores ainda na fila foram cancelados
como supersedidos (38825566277/38825566264/38825566234), preservando seus estados;
nenhum job de outra iniciativa foi interrompido.

Permanecem pendentes JCS .NET/Rust, demais normalizações comportamentais, admissão
de contratos/grafo, dez células de transporte, equivalência visual, triagem
semântica e revisão/integração oficial. Conformidade legada cruzada conserva seis
FAIL históricos revalidados. O programa permanece PARCIAL.
