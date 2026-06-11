# Bolões ativos: listagem e ingresso restritos a bolões ATIVO

**Data:** 2026-06-11
**Branch:** `feat/boloes-ativos-ingresso`

## Problema

Hoje a regra de status (`ATIVO`/`INATIVO`) de um bolão não é aplicada nos fluxos de listagem e ingresso:

- A tela `/boloes` (`GET /boloes/meus` → `listarMeus`) lista **todos** os bolões do usuário, sem filtrar por status.
- O ingresso (`entrarViaConvite` e `aprovarMembro`, ambos via `adicionarMembro`) **não** verifica o status do bolão.
- A tela de convite (`/convite/[codigo]`) decide seu estado apenas a partir de `lookupConvite().valido`, que reflete somente a expiração — ignora `status`.

## Objetivo

1. `/boloes` lista **apenas** bolões com `status = ATIVO`.
2. Ingresso só é permitido em bolões `ATIVO` (validado no backend).
3. Ao abrir o link de convite de um bolão desativado, o botão de entrar fica **desabilitado** e uma **mensagem** é exibida.

## Abordagem escolhida

**Regra na camada de serviço** (`BolaoService`), que é o ponto único por onde passam todos os fluxos. Vantagens: uma fonte de verdade, mínima superfície de mudança, e o backend rejeita ingresso mesmo em chamadas diretas à API.

Alternativas descartadas:
- **Guard no controller** (`BolaoAtivoGuard`): espalha a lógica entre guard e service e ainda exigiria mudanças próprias em `listarMeus`/`lookupConvite`.
- **Só frontend**: sem proteção no backend; qualquer POST direto ingressaria num bolão inativo.

## Design

### 1. Backend — listagem (`listarMeus`)

Adicionar `status: BolaoStatus.ATIVO` ao `where`:

```ts
where: { membros: { some: { usuarioId } }, status: BolaoStatus.ATIVO },
```

Bolões inativos somem de `/boloes` para todos, **inclusive membros existentes** (decisão do usuário: "some da lista"). O bolão global (sempre `ATIVO`) não é afetado.

### 2. Backend — bloqueio de ingresso (`adicionarMembro`)

`adicionarMembro` é o choke point de convite e aprovação do moderador. Após buscar o bolão (já existe `findUnique` + `NotFoundException`), adicionar:

```ts
if (bolao.status !== BolaoStatus.ATIVO) {
  throw new BadRequestException('Este bolão está desativado e não aceita novos participantes.');
}
```

Cobre `entrarViaConvite` e `aprovarMembro` de uma só vez.

### 3. Backend — lookup do convite (`lookupConvite`)

Expor o status do bolão no retorno, com um novo campo `bolaoAtivo: boolean`. `valido` mantém o significado atual ("convite existe e não expirou"), permitindo ao frontend distinguir três casos: convite inexistente/expirado, bolão inativo, e tudo certo.

```ts
return {
  valido,
  bolaoAtivo: convite.bolao.status === BolaoStatus.ATIVO,
  bolaoId: convite.bolaoId,
  // ...demais campos
};
```

No caminho de convite não encontrado, retornar `bolaoAtivo: false` junto dos demais `null`.

### 4. Frontend — tela de convite (`/convite/[codigo]`)

Novo estado **`inativo`**, distinto de `invalido`:

- **`invalido`** (inexistente/expirado): permanece como está ("⚠️ Convite inválido").
- **`inativo`** (convite válido, bolão desativado): mostra o card com nome/descrição/criador, mas:
  - botão **"Entrar no Bolão"** desabilitado (estilo esmaecido);
  - mensagem acima do botão: *"Este bolão está desativado e não está aceitando novos participantes."*

Lógica no `useEffect`:

```ts
if (!data.valido) { setEstado('invalido'); return; }
if (!data.bolaoAtivo) { setConvite(data); setEstado('inativo'); return; }
setConvite(data);
setEstado(user ? 'pronto' : 'nao-autenticado');
```

O estado `inativo` é tratado **antes** da bifurcação autenticado/não-autenticado, de forma que prevalece em ambos os casos — um visitante deslogado também vê a mensagem de bolão desativado em vez do fluxo de "entre para participar".

Defesa em profundidade: mesmo que o clique seja forçado, o backend (parte 2) rejeita.

### 5. Frontend — tipos e testes

- `ConviteInfo` (em `convite/[codigo]/page.tsx`) ganha `bolaoAtivo: boolean`.
- Testes:
  - `listarMeus` filtra inativos;
  - `adicionarMembro` rejeita bolão inativo;
  - `lookupConvite` retorna `bolaoAtivo`;
  - tela de convite renderiza o estado desabilitado com a mensagem.

## Fora de escopo

- Fluxo de pagamento.
- Admin de status do bolão (já existe).
- Rankings de bolões inativos.

## Documentação

Atualizar o `README.md` para refletir a nova regra de negócio: listagem e ingresso restritos a bolões ativos; link de convite de bolão desativado exibe botão desabilitado + mensagem.
