# Design: Cadastro invite-only + Google OAuth com telefone

**Data:** 2026-06-01  
**Status:** Aprovado

## Contexto

Hoje qualquer pessoa pode criar uma conta em `/registrar`. O objetivo é restringir o cadastro a quem recebeu um convite de bolão (`BolaoConvite`), eliminar o botão "Criar conta" da tela de login, habilitar registro via Google OAuth pelo fluxo de convite, e garantir que novos usuários Google informem seu telefone.

## Escopo

- **Dentro:** obrigatoriedade de convite no registro email/senha; botão Google na página de convite; coleta de telefone pós-OAuth para novos usuários Google; ajustes de testes.
- **Fora:** sistema de convite novo (usa `BolaoConvite` existente); forçar telefone em usuários Google antigos; mudanças na `InscricaoWindowService`.

---

## Backend

### 1. `register.dto.ts` — conviteToken obrigatório

Remover `@IsOptional()` e o `?` de `conviteToken`. Adicionar `@IsNotEmpty()`.

```ts
@IsNotEmpty()
@IsString()
conviteToken: string;
```

### 2. `auth.service.ts` — pré-validação do convite

Em `registrar()`, chamar `bolaoService.lookupConvite(dto.conviteToken)` **antes** de `usuario.create`. Evita criar usuário órfão se o token for inválido/expirado.

Ordem final de `registrar()`:
1. `inscricaoWindow.assertAberta()`
2. Verificar unicidade do e-mail
3. **`bolaoService.lookupConvite(dto.conviteToken)`** — lança `BadRequestException` se inválido
4. `bcrypt.hash` + `usuario.create`
5. Entrar no bolão global + criar ranking
6. Enviar e-mail de confirmação
7. `bolaoService.entrarViaConvite(usuario, dto.conviteToken)`

### 3. `update-usuario.dto.ts` — campo telefone

Adicionar `telefone` para permitir que novos usuários Google gravem o telefone via `PATCH /usuarios/me`:

```ts
@IsOptional()
@IsString()
@Matches(/^\(\d{2}\) \d{5}-\d{4}$/, { message: 'Formato inválido. Use (99) 99999-9999.' })
telefone?: string;
```

### 4. Testes `auth.service.spec.ts`

- Adicionar `lookupConvite: jest.fn()` ao `bolaoMock`
- Todos os calls de `registrar()` existentes passam a incluir `conviteToken: 'token-abc'` e `bolaoMock.lookupConvite.mockResolvedValue({})`
- Remover teste "registrar não chama entrarViaConvite quando conviteToken ausente" (conviteToken deixa de ser opcional)
- Adicionar teste: "registrar chama lookupConvite antes de criar usuário" — verifica que `lookupConvite` é chamado e que, se lançar exceção, `usuario.create` não é invocado
- Nota: a validação de conviteToken ausente/inválido no nível HTTP é garantida pelo `ValidationPipe` do NestJS (DTO obrigatório) — não precisa de teste no service

---

## Frontend

### 5. `login/page.tsx` — remover "Criar conta"

Remover o bloco condicional `abertas ? <Link href="/registrar">...` (linhas 87-91) e o hook `useInscricaoStatus` que só servia a esse propósito.

### 6. `convite/[codigo]/page.tsx` — botão "Registrar com Google"

No estado `nao-autenticado`, adicionar terceiro botão abaixo dos existentes:

```tsx
<a
  href={`${process.env.NEXT_PUBLIC_API_URL}/auth/google`}
  onClick={() => sessionStorage.setItem('convitePendente', codigo)}
  className="..."
>
  Registrar com Google
</a>
```

Os botões "Fazer login" e "Criar conta" permanecem.

### 7. `auth/callback/page.tsx` — orquestrar pós-OAuth

Nova lógica no `useEffect` após `setAccessToken(token)`:

```
convitePendente = sessionStorage.getItem('convitePendente')

se convitePendente:
  busca GET /usuarios/me
  se telefone === '':
    sessionStorage.removeItem('convitePendente')
    redireciona para /completar-perfil?convite={convitePendente}
  senão:
    POST /boloes/entrar/{convitePendente}  (falha silenciosa se já for membro)
    sessionStorage.removeItem('convitePendente')
    redireciona para /jogos
senão:
  redireciona para /jogos
```

### 8. `app/completar-perfil/page.tsx` — nova página

Nova página protegida (redireciona para `/login` se não autenticado).

- Lê `?convite=` da URL
- Campo de telefone com `mascaraTelefone` (mesma função já usada em `/registrar`)
- Ao submeter:
  1. `PATCH /usuarios/me` com `{ telefone }`
  2. Se `convite` presente: `POST /boloes/entrar/{convite}`
  3. Redireciona para `/jogos`

### 9. `registrar/page.tsx` — guard de convite

- Remover `useInscricaoStatus` e o bloco `!abertas`
- Adicionar guard `!conviteToken`: exibe mensagem "Você precisa de um convite para criar uma conta" com link para `/login`
- O `body` sempre inclui `conviteToken` (não é mais condicional)

---

## Fluxos resumidos

**Registro email/senha:**
```
/convite/{token} → "Criar conta" → /registrar?convite={token} → POST /auth/registrar → e-mail de confirmação → /login
```

**Registro Google (novo usuário):**
```
/convite/{token} → "Registrar com Google" (salva token no sessionStorage) → /auth/google → Google → /auth/callback → sem telefone → /completar-perfil?convite={token} → PATCH /usuarios/me + POST /boloes/entrar → /jogos
```

**Login Google (usuário existente):**
```
/login → "Entrar com Google" → /auth/google → Google → /auth/callback → sem convitePendente → /jogos
```

**Login Google via convite (usuário existente com telefone):**
```
/convite/{token} → "Registrar com Google" (salva token) → /auth/callback → telefone preenchido → POST /boloes/entrar + /jogos
```
