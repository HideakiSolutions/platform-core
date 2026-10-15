# Normalização dos cores

Este pacote registra a onda 0 do programa de normalização e consolidação. Use o [baseline](BASELINE-20261015.md) para interpretar a proveniência e os limites; execute [inventory.py](inventory.py) para uma nova observação e [test_inventory.py](test_inventory.py) para verificar o comportamento do coletor.

A observação de fontes não comprova conformidade, instalação, adoção, durabilidade ou execução dos produtos. As seis frentes e os critérios de aceite do programa permanecem pendentes até suas provas específicas.

## Reprodução

```bash
python3 docs/implementation/core-normalization/inventory.py \
  --root /workspace/github/hideaki-solutions-core \
  --historical-root /workspace/local/core-consolidation-20260907 \
  --output /workspace/local/core-normalization-20261015/evidence/baseline-new.json
python3 -m unittest discover -s docs/implementation/core-normalization -p 'test_*.py' -v
```

O coletor não faz fetch, checkout, alteração de refs ou instalação. Cada nova execução observa o estado atual e recebe timestamp próprio. A escrita usa modo exclusivo e rejeita qualquer destino existente, inclusive evidência congelada. A reprodução depende dos mesmos objetos Git, arquivos e worktrees. O JSON exporta caminhos, status e hashes; não exporta diffs, conteúdo de arquivos ou URLs dos remotos. Os registros de artefatos cobrem caminhos rastreados e não ignorados; saídas de build ignoradas não são inspecionadas.

`integrated` significa somente ancestral da referência oficial observada. `candidate` significa commit fora dessa ancestralidade, exigindo revisão por capacidade. `blocked` significa referência oficial ou commit não verificável. Aliases de um SHA são registrados; não provam entregas duplicadas. `duplicate` exige que todos os commits exclusivos sem merges sejam equivalentes por patch-id a patches da oficial (`git cherry`); a equivalência não comprova igualdade semântica nem autoriza descarte. Nenhum trabalho é automaticamente descartado ou classificado como superado. O destino de candidato/bloqueado é revisão por capacidade, sem autorização de merge implícita.

## Governança consultada

- `/home/annonymous/.claude/AGENTS.md`, especialmente §§3f, 3h, 3i e 3k.
- Produtor `2b4d6f37caf748947cca8195f16b8534b5c8ab9e`, sob `/workspace/local/tooling/hseos-releases/`: `.enterprise/policies/governance-discovery.md`, `.enterprise/.specs/core/_INDEX.md`, `.enterprise/.specs/constitution/Enterprise-Constitution.md`, `core/AGENT RULES STANDARD.md` e `core/Git Flow & Release Governance Standard.md`.

Aplicação/enforcement e ativação AEW não foram verificados por este coletor. Não há criação de contrato compartilhado nem alteração do grafo de capacidades nesta entrega.

## Revisão 1 — baseline parcial

Leia [REVIEW1-20261015.md](REVIEW1-20261015.md). A onda 0 permanece **parcial**: capacidade semântica, ownership e dependências reais exigem análise manual. O coletor apresenta apenas escopos candidatos derivados de caminhos, merge-base e relações de ancestralidade entre refs. Nenhum sinal estático aprova entrega.

## Evidência versionada

Os três snapshots congelados também estão em [evidence/manifest.json](evidence/manifest.json),
comprimidos de forma determinística. O manifesto registra SHA-256 dos bytes
comprimidos e originais. Isso preserva a observação original em Git; uma execução
nova do coletor continua sendo uma nova observação, nunca substituição do baseline.

## Execução transversal

Consulte [EXECUTION-20261015.md](EXECUTION-20261015.md) para entregas verificadas, dimensões bloqueadas e critérios ainda pendentes.
