# Bolões ativos: listagem e ingresso — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restringir a listagem `/boloes` e o ingresso a bolões com `status = ATIVO`, e exibir botão desabilitado + mensagem na tela de convite quando o bolão estiver desativado.

**Architecture:** Toda a regra fica na camada de serviço (`BolaoService`), ponto único por onde passam listagem, convite e aprovação. O backend filtra (`listarMeus`), rejeita ingresso (`adicionarMembro`) e expõe o status (`lookupConvite`). O frontend de convite ganha um estado `inativo` que prevalece antes da bifurcação autenticado/não-autenticado. A página `/boloes` não muda — ela já renderiza o que a API retorna.

**Tech Stack:** NestJS 10 + Prisma, Jest (ts-jest) no backend; Next.js 14 + React Testing Library no frontend. Enum `BolaoStatus` em `@bolao/shared`.

**Spec:** `docs/superpowers/specs/2026-06-11-boloes-ativos-ingresso-design.md`

---

## File Structure

- `apps/backend/src/bolao/bolao.service.ts` — `listarMeus` (filtro), `adicionarMembro` (bloqueio), `lookupConvite` (campo `bolaoAtivo`).
- `apps/backend/src/bolao/bolao.service.spec.ts` — testes de serviço (novos + ajuste de 1 fixture existente).
- `apps/frontend/src/app/convite/[codigo]/page.tsx` — tipo `ConviteInfo`, estado `inativo`, render desabilitado.
- `apps/frontend/src/__tests__/ConvitePage.test.tsx` — teste do estado inativo (+ ajuste da fixture `conviteValido`).
- `README.md` — nova regra de negócio.

---

## Task 1: Backend — `listarMeus` lista apenas bolões ATIVO

**Files:**
- Modify: `apps/backend/src/bolao/bolao.service.ts:38-44`
- Test: `apps/backend/src/bolao/bolao.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Adicione este teste ao final do `describe('BolaoService', ...)` em `apps/backend/src/bolao/bolao.service.spec.ts` (antes do `});` final):

```ts
it('listarMeus filtra por status ATIVO', async () => {
  prismaMock.bolao.findMany.mockResolvedValue([]);
  await service.listarMeus('u1');
  expect(prismaMock.bolao.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { membros: { some: { usuarioId: 'u1' } }, status: BolaoStatus.ATIVO },
    }),
  );
});
```

Adicione `BolaoStatus` ao import existente de `@bolao/shared` no topo do arquivo de teste (linha 5):

```ts
import { BolaoMembroPapel, BolaoStatus } from '@bolao/shared';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && pnpm test -- bolao.service.spec --t "listarMeus filtra por status ATIVO"`
Expected: FAIL — o `where` atual não contém `status`.

- [ ] **Step 3: Write minimal implementation**

Em `apps/backend/src/bolao/bolao.service.ts`, no método `listarMeus` (linha ~39), adicione `status` ao `where`:

```ts
  async listarMeus(usuarioId: string) {
    return this.prisma.bolao.findMany({
      where: { membros: { some: { usuarioId } }, status: BolaoStatus.ATIVO },
      include: { _count: { select: { membros: { where: { usuario: { ativo: true } } } } } },
      orderBy: { criadoEm: 'asc' },
    });
  }
```

`BolaoStatus` já está importado de `@bolao/shared` no topo do arquivo (linha 9) — não precisa adicionar import.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && pnpm test -- bolao.service.spec --t "listarMeus filtra por status ATIVO"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/bolao/bolao.service.ts apps/backend/src/bolao/bolao.service.spec.ts
git commit -m "feat: listarMeus filtra bolões por status ATIVO"
```

---

## Task 2: Backend — `adicionarMembro` rejeita bolão inativo

`adicionarMembro` é o choke point de `entrarViaConvite` e `aprovarMembro`. Adicionar a checagem aqui cobre os dois fluxos. **Atenção:** um teste existente (`entrarViaConvite passa quando admin`) mocka `bolao.findUnique` sem `status` e vai quebrar — este task também o corrige.

**Files:**
- Modify: `apps/backend/src/bolao/bolao.service.ts:149-166`
- Test: `apps/backend/src/bolao/bolao.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Adicione ao `describe` em `bolao.service.spec.ts`:

```ts
it('adicionarMembro lança BadRequestException se o bolão está inativo', async () => {
  prismaMock.bolao.findUnique.mockResolvedValue({
    id: 'b1', maxParticipantes: 10, status: BolaoStatus.INATIVO,
  });
  await expect(service.adicionarMembro('b1', 'u1')).rejects.toThrow(BadRequestException);
  expect(prismaMock.bolaoMembro.create).not.toHaveBeenCalled();
});

it('adicionarMembro cria membro quando o bolão está ativo', async () => {
  prismaMock.bolao.findUnique.mockResolvedValue({
    id: 'b1', maxParticipantes: 10, status: BolaoStatus.ATIVO,
  });
  prismaMock.bolaoMembro.findUnique.mockResolvedValue(null);
  prismaMock.bolaoMembro.count.mockResolvedValue(0);
  prismaMock.bolaoMembro.create.mockResolvedValue({ bolaoId: 'b1', usuarioId: 'u1' });
  prismaMock.ranking.create.mockResolvedValue({});
  await service.adicionarMembro('b1', 'u1');
  expect(prismaMock.bolaoMembro.create).toHaveBeenCalledWith({
    data: { bolaoId: 'b1', usuarioId: 'u1' },
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && pnpm test -- bolao.service.spec --t "adicionarMembro lança BadRequestException se o bolão está inativo"`
Expected: FAIL — hoje `adicionarMembro` não checa status e cria o membro.

- [ ] **Step 3: Write minimal implementation**

Em `apps/backend/src/bolao/bolao.service.ts`, no `adicionarMembro`, logo após a verificação de `!bolao` (linha ~151), adicione o bloqueio:

```ts
  async adicionarMembro(bolaoId: string, usuarioId: string) {
    const bolao = await this.prisma.bolao.findUnique({ where: { id: bolaoId } });
    if (!bolao) throw new NotFoundException('Bolão não encontrado.');
    if (bolao.status !== BolaoStatus.ATIVO) {
      throw new BadRequestException('Este bolão está desativado e não aceita novos participantes.');
    }

    const jaEMembro = await this.prisma.bolaoMembro.findUnique({
      where: { bolaoId_usuarioId: { bolaoId, usuarioId } },
    });
    if (jaEMembro) throw new ConflictException('Você já é membro deste bolão.');
    // ...restante inalterado
```

`BadRequestException` e `BolaoStatus` já estão importados no topo do arquivo.

- [ ] **Step 4: Corrigir o teste existente que quebra**

O teste `entrarViaConvite passa quando admin` (linha ~102) mocka o bolão sem `status`. Atualize aquele mock para incluir `status: BolaoStatus.ATIVO`:

```ts
    prismaMock.bolao.findUnique.mockResolvedValue({ id: 'b1', maxParticipantes: 10, status: BolaoStatus.ATIVO });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/backend && pnpm test -- bolao.service.spec`
Expected: PASS — todos os testes do arquivo, incluindo os dois novos e o ajustado.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/bolao/bolao.service.ts apps/backend/src/bolao/bolao.service.spec.ts
git commit -m "feat: bloqueia ingresso em bolão inativo em adicionarMembro"
```

---

## Task 3: Backend — `lookupConvite` expõe `bolaoAtivo`

**Files:**
- Modify: `apps/backend/src/bolao/bolao.service.ts:132-147`
- Test: `apps/backend/src/bolao/bolao.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Adicione ao `describe` em `bolao.service.spec.ts`:

```ts
it('lookupConvite retorna bolaoAtivo=false quando o bolão está inativo', async () => {
  prismaMock.bolaoConvite.findUnique.mockResolvedValue({
    bolaoId: 'b1',
    expiraEm: null,
    bolao: { nome: 'Bolão X', descricao: null, status: BolaoStatus.INATIVO },
    criadoPor: { nome: 'Fred' },
  });
  const r = await service.lookupConvite('tok');
  expect(r.valido).toBe(true);
  expect(r.bolaoAtivo).toBe(false);
});

it('lookupConvite retorna bolaoAtivo=true quando o bolão está ativo', async () => {
  prismaMock.bolaoConvite.findUnique.mockResolvedValue({
    bolaoId: 'b1',
    expiraEm: null,
    bolao: { nome: 'Bolão X', descricao: null, status: BolaoStatus.ATIVO },
    criadoPor: { nome: 'Fred' },
  });
  const r = await service.lookupConvite('tok');
  expect(r.bolaoAtivo).toBe(true);
});

it('lookupConvite retorna bolaoAtivo=false quando o convite não existe', async () => {
  prismaMock.bolaoConvite.findUnique.mockResolvedValue(null);
  const r = await service.lookupConvite('tok');
  expect(r.valido).toBe(false);
  expect(r.bolaoAtivo).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && pnpm test -- bolao.service.spec --t "lookupConvite retorna bolaoAtivo"`
Expected: FAIL — `bolaoAtivo` é `undefined` no retorno atual.

- [ ] **Step 3: Write minimal implementation**

Em `apps/backend/src/bolao/bolao.service.ts`, substitua o corpo de `lookupConvite` (linhas ~132-147):

```ts
  async lookupConvite(token: string) {
    const convite = await this.prisma.bolaoConvite.findUnique({
      where: { token },
      include: { bolao: true, criadoPor: { select: { nome: true } } },
    });
    if (!convite) {
      return {
        valido: false, bolaoAtivo: false, bolaoId: null,
        bolaoNome: null, descricao: null, criadorNome: null, expiraEm: null,
      };
    }
    const valido = !convite.expiraEm || convite.expiraEm > new Date();
    return {
      valido,
      bolaoAtivo: convite.bolao.status === BolaoStatus.ATIVO,
      bolaoId: convite.bolaoId,
      bolaoNome: convite.bolao.nome,
      descricao: convite.bolao.descricao,
      criadorNome: convite.criadoPor.nome,
      expiraEm: convite.expiraEm?.toISOString() ?? null,
    };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && pnpm test -- bolao.service.spec`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/bolao/bolao.service.ts apps/backend/src/bolao/bolao.service.spec.ts
git commit -m "feat: lookupConvite expõe bolaoAtivo"
```

---

## Task 4: Frontend — tela de convite com estado `inativo`

**Files:**
- Modify: `apps/frontend/src/app/convite/[codigo]/page.tsx`
- Test: `apps/frontend/src/__tests__/ConvitePage.test.tsx`

- [ ] **Step 1: Write the failing test**

Primeiro, atualize a fixture `conviteValido` em `ConvitePage.test.tsx` (linha ~32) para incluir `bolaoAtivo: true` — senão os testes existentes cairiam no estado `inativo`:

```ts
const conviteValido = {
  valido: true,
  bolaoAtivo: true,
  bolaoId: 'bolao-b',
  bolaoNome: 'Bolão da Firma',
  descricao: null,
  criadorNome: 'Fred',
  expiraEm: null,
};
```

Depois adicione estes testes ao final do arquivo:

```ts
it('exibe botão desabilitado e mensagem quando o bolão está inativo', async () => {
  mockApiGet.mockResolvedValue({ ...conviteValido, bolaoAtivo: false });
  render(<ConvitePage />);
  const botao = await screen.findByRole('button', { name: /entrar no bolão/i });
  expect(botao).toBeDisabled();
  expect(screen.getByText(/desativado e não está aceitando novos participantes/i)).toBeInTheDocument();
});

it('mostra o nome do bolão no estado inativo', async () => {
  mockApiGet.mockResolvedValue({ ...conviteValido, bolaoAtivo: false });
  render(<ConvitePage />);
  expect(await screen.findByText('Bolão da Firma')).toBeInTheDocument();
});

it('não chama a API de entrar quando o bolão está inativo', async () => {
  mockApiGet.mockResolvedValue({ ...conviteValido, bolaoAtivo: false });
  render(<ConvitePage />);
  const botao = await screen.findByRole('button', { name: /entrar no bolão/i });
  await userEvent.click(botao);
  expect(mockApiPost).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/frontend && pnpm test -- ConvitePage`
Expected: FAIL — o estado `inativo` ainda não existe; o botão não está desabilitado e a mensagem não aparece.

- [ ] **Step 3: Write minimal implementation — tipo e estado**

Em `apps/frontend/src/app/convite/[codigo]/page.tsx`:

3a. Adicione `bolaoAtivo` à interface `ConviteInfo` (linha ~10):

```ts
interface ConviteInfo {
  valido: boolean;
  bolaoAtivo: boolean;
  bolaoId: string | null;
  bolaoNome: string | null;
  descricao: string | null;
  criadorNome: string | null;
  expiraEm: string | null;
}
```

3b. Adicione `'inativo'` ao type `Estado` (linha ~19):

```ts
type Estado = 'carregando' | 'invalido' | 'inativo' | 'nao-autenticado' | 'pronto' | 'entrando' | 'sucesso';
```

3c. No `useEffect`, trate `bolaoAtivo` antes da bifurcação autenticado/não-autenticado (linhas ~32-38):

```ts
    api.get<ConviteInfo>(`/convites/${codigo}`)
      .then(data => {
        if (!data.valido) { setEstado('invalido'); return; }
        setConvite(data);
        if (!data.bolaoAtivo) { setEstado('inativo'); return; }
        setEstado(user ? 'pronto' : 'nao-autenticado');
      })
      .catch(() => setEstado('invalido'));
```

- [ ] **Step 4: Write minimal implementation — render do estado `inativo`**

Adicione este bloco logo após o bloco `if (estado === 'invalido') { ... }` (depois da linha ~77) e antes de `if (estado === 'nao-autenticado')`:

```tsx
  if (estado === 'inativo') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-trovao-card border border-trovao-border rounded-2xl p-8 text-center space-y-4">
          <div className="text-4xl">⚡</div>
          <h1 className="text-white font-bold text-lg">{convite?.bolaoNome}</h1>
          {convite?.descricao && <p className="text-trovao-muted text-sm">{convite.descricao}</p>}
          <p className="text-trovao-muted text-xs">Convidado por {convite?.criadorNome}</p>
          <p className="text-trovao-red text-sm">
            Este bolão está desativado e não está aceitando novos participantes.
          </p>
          <button
            disabled
            className="w-full py-3 bg-trovao-gold text-trovao-base text-sm font-bold rounded-xl opacity-50 cursor-not-allowed"
          >
            Entrar no Bolão
          </button>
          <Link
            href={`/regulamento?from=/convite/${codigo}`}
            className="block text-trovao-muted text-xs hover:text-white transition-colors"
          >
            Regulamento
          </Link>
        </div>
      </div>
    );
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/frontend && pnpm test -- ConvitePage`
Expected: PASS — incluindo os testes existentes (graças ao `bolaoAtivo: true` na fixture).

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/app/convite/[codigo]/page.tsx apps/frontend/src/__tests__/ConvitePage.test.tsx
git commit -m "feat: estado inativo na tela de convite (botão desabilitado + mensagem)"
```

---

## Task 5: README + verificação final

**Files:**
- Modify: `README.md:18-19`

- [ ] **Step 1: Atualizar o README com a nova regra**

Na seção **Funcionalidades** de `README.md`, no item **Grupos (Bolões)** (linha ~9), acrescente a regra de bolões ativos. Substitua a linha:

```markdown
- **Grupos (Bolões)** — crie grupos privados com código de convite ou participe do bolão global automático
```

por:

```markdown
- **Grupos (Bolões)** — crie grupos privados com código de convite ou participe do bolão global automático. A tela "Meus Bolões" lista apenas bolões **ativos** e só é possível ingressar em bolões ativos; abrir o link de convite de um bolão desativado exibe o botão de entrar desabilitado com uma mensagem explicativa
```

- [ ] **Step 2: Rodar a suíte de testes do backend e frontend**

Run: `cd apps/backend && pnpm test -- bolao.service.spec`
Expected: PASS

Run: `cd apps/frontend && pnpm test -- ConvitePage BolaoesPage`
Expected: PASS

- [ ] **Step 3: Typecheck do backend**

Run: `cd apps/backend && pnpm exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: regra de bolões ativos no README"
```

---

## Self-Review (notas do autor do plano)

- **Cobertura do spec:** parte 1 (listagem) → Task 1; parte 2 (ingresso) → Task 2; parte 3 (convite desabilitado) → Tasks 3+4; tipos/testes → Tasks 1-4; doc → Task 5. ✅
- **Defesa em profundidade:** botão desabilitado (Task 4) + rejeição backend (Task 2). ✅
- **Riscos de regressão sinalizados:** fixture `conviteValido` (Task 4 Step 1) e mock `entrarViaConvite passa quando admin` (Task 2 Step 4) precisam de ajuste — ambos documentados nos próprios steps.
- **Consistência de nomes:** campo `bolaoAtivo` usado de forma idêntica em backend (Task 3) e frontend (Task 4).
