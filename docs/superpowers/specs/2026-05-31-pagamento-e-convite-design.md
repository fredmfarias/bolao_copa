# Design: Status de Pagamento + Convite para Novos Usuários + Telefone no Cadastro

**Data:** 2026-05-31  
**Branch:** equaliza

---

## Contexto

Três melhorias relacionadas ao fluxo de moderação e entrada no bolão:

1. **Status de pagamento** — moderador controla manualmente se cada participante pagou ou não.
2. **Convite para novos usuários** — pessoa sem conta clica no link de convite, cria conta e entra no bolão em um único fluxo.
3. **Telefone obrigatório no cadastro** — campo `(99) 99999-9999` adicionado ao registro.

---

## Feature 1: Status de Pagamento

### Banco de dados

Novo enum `StatusPagamento` com valores `PENDENTE` e `PAGO`.
Campo `statusPagamento StatusPagamento @default(PENDENTE)` adicionado ao model `BolaoMembro`.
Migration Prisma não quebra dados existentes — todos os registros existentes ficam `PENDENTE`.

```prisma
enum StatusPagamento {
  PENDENTE
  PAGO
}

model BolaoMembro {
  // campos existentes...
  statusPagamento StatusPagamento @default(PENDENTE)
}
```

### Backend

**Novo endpoint:**
```
PATCH /boloes/:bolaoId/membros/:usuarioId/pagamento
Guard: JwtAuthGuard + BolaoModeradorGuard
Body: { status: 'PENDENTE' | 'PAGO' }
```

**Novo DTO:** `UpdatePagamentoStatusDto` com campo `status: StatusPagamento`.

**Novo método em `BolaoService`:**
```ts
atualizarPagamento(bolaoId: string, usuarioId: string, status: StatusPagamento)
```
Faz `prisma.bolaoMembro.update` filtrando por `{ bolaoId_usuarioId: { bolaoId, usuarioId } }`.

O campo `statusPagamento` já vem nas respostas de `obter()` sem alteração, pois o include de `membros` retorna todos os campos do model.

**Enum exportado em `@bolao/shared`** para uso compartilhado frontend/backend.

### Frontend — `ModeradorPanel`

Cada linha de membro ganha um badge de pagamento clicável posicionado antes dos botões de ação:

- `PENDENTE`: badge âmbar (`bg-yellow-500/20 text-yellow-400`), texto "Pendente"
- `PAGO`: badge verde (`bg-green-500/20 text-green-400`), texto "Pago"

Clicar no badge chama `PATCH /boloes/:bolaoId/membros/:usuarioId/pagamento` alternando para o status oposto. Enquanto aguarda resposta, o badge fica desabilitado (opacity-50). Após sucesso, chama `onAtualizado()` para recarregar os dados.

O tipo `BolaoMembro` em `src/types/api.ts` recebe o campo `statusPagamento: 'PENDENTE' | 'PAGO'`.

---

## Feature 2: Convite para Novos Usuários

### Fluxo completo

```
1. Usuário clica em /convite/TOKEN (não autenticado)
2. Página mostra info do bolão + dois botões: "Fazer login" e "Criar conta"
3. "Criar conta" → /registrar?convite=TOKEN
4. Usuário preenche nome, email, telefone, senha e envia
5. Backend: valida janela de inscrições → cria usuário → entra no bolão global → entra no bolão do convite
6. Se janela fechada: bloqueia todo o registro (403, mesma mensagem atual)
7. Se convite inválido/expirado: bloqueia o registro com mensagem de erro
8. Frontend exibe: "Cadastro realizado. Verifique seu e-mail — ao confirmar, você já estará no bolão."
9. Usuário confirma e-mail → faz login → vê o bolão na listagem
```

### Backend — `RegisterDto`

Adicionar campo opcional:
```ts
conviteToken?: string;
```

### Backend — `AuthService.registrar()`

Após criar o usuário e adicioná-lo ao bolão global, se `dto.conviteToken` estiver presente:

1. Chamar `bolaoService.entrarViaConvite(novoUsuario, dto.conviteToken)`
2. O método já checa `inscricaoWindow.assertAberta` internamente — não precisa de checagem dupla
3. Se o convite for inválido ou expirado, propagar a exceção (o registro é bloqueado)

`BolaoService` precisa ser injetado em `AuthService` (adicionar ao módulo de auth).

### Frontend — `/convite/[codigo]` (estado `nao-autenticado`)

Adicionar botão secundário abaixo do "Fazer login":
```tsx
<button onClick={() => router.push(`/registrar?convite=${codigo}`)}>
  Criar conta
</button>
```

### Frontend — `/registrar`

- Ler `useSearchParams().get('convite')` para obter o token
- Incluir `conviteToken` no body do POST se presente
- Mensagem de sucesso (com ou sem convite): *"Cadastro realizado. Verifique seu e-mail."*
- Nenhuma mudança visual no formulário além do campo de telefone (ver Feature 3)

---

## Feature 3: Telefone Obrigatório no Cadastro

### Banco de dados

Campo `telefone String` adicionado ao model `Usuario` (obrigatório, sem unique).
Migration Prisma com `ALTER TABLE usuario ADD COLUMN telefone TEXT NOT NULL DEFAULT ''` — o default vazio é apenas para a migration; novos cadastros sempre enviam o valor.

```prisma
model Usuario {
  // campos existentes...
  telefone String
}
```

### Backend — `RegisterDto`

Campo obrigatório com validação de formato:
```ts
@IsString()
@Matches(/^\(\d{2}\) \d{5}-\d{4}$/, { message: 'Formato inválido. Use (99) 99999-9999.' })
telefone: string;
```

Campo incluído no `prisma.usuario.create` em `AuthService.registrar()`.

### Frontend — `/registrar`

Campo `telefone` adicionado ao formulário entre "email" e "senha".
Máscara aplicada no `onChange` — formatação progressiva:
- `11` → `(11`
- `119` → `(11) 9`
- `11912345678` → `(11) 91234-5678`

Lógica de máscara inline no componente (sem biblioteca externa).

```tsx
function mascaraTelefone(valor: string) {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 2) return `(${nums}`;
  if (nums.length <= 7) return `(${nums.slice(0,2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`;
}
```

O campo usa `type="tel"` e `inputMode="numeric"`.

---

## Fora de escopo

- Integração com sistema de pagamento automático
- Histórico de transições de pagamento
- Verificação de telefone via SMS
- Notificação ao moderador quando alguém entra via convite
- Reenvio automático do convite após registro
