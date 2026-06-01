# Cadastro Invite-Only + Google OAuth com Telefone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restringir a criação de conta a portadores de convite de bolão, habilitar registro via Google OAuth pelo fluxo de convite, e coletar telefone de novos usuários Google.

**Architecture:** Backend torna `conviteToken` obrigatório no DTO de registro e pré-valida o convite antes de criar o usuário. No frontend, a tela de convite ganha um botão "Registrar com Google" que salva o token no `sessionStorage`; o callback do OAuth lê esse token e, se o novo usuário não tem telefone, redireciona para uma nova página `/completar-perfil`.

**Tech Stack:** NestJS (backend), Next.js 14 App Router (frontend), Prisma, class-validator, Jest, pnpm workspaces.

---

## File Map

| Ação | Arquivo |
|------|---------|
| Modify | `apps/backend/src/auth/dto/register.dto.ts` |
| Modify | `apps/backend/src/auth/auth.service.ts` |
| Modify | `apps/backend/src/auth/auth.service.spec.ts` |
| Modify | `apps/backend/src/usuario/dto/update-usuario.dto.ts` |
| Modify | `apps/backend/src/usuario/usuario.service.ts` |
| Modify | `apps/frontend/src/app/(auth)/login/page.tsx` |
| Modify | `apps/frontend/src/app/convite/[codigo]/page.tsx` |
| Modify | `apps/frontend/src/app/(auth)/registrar/page.tsx` |
| Create | `apps/frontend/src/app/completar-perfil/page.tsx` |
| Modify | `apps/frontend/src/app/auth/callback/page.tsx` |

---

## Task 1: Backend — conviteToken obrigatório + pré-validação (TDD)

**Files:**
- Modify: `apps/backend/src/auth/auth.service.spec.ts`
- Modify: `apps/backend/src/auth/dto/register.dto.ts`
- Modify: `apps/backend/src/auth/auth.service.ts`

- [ ] **Step 1: Atualizar o arquivo de testes (os testes vão falhar — isso é esperado)**

Substitua o conteúdo completo de `apps/backend/src/auth/auth.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { InscricaoWindowService } from '../inscricao-window/inscricao-window.service';
import { BolaoService } from '../bolao/bolao.service';

const prismaMock = {
  usuario: { findUnique: jest.fn(), create: jest.fn() },
  bolaoMembro: { create: jest.fn() },
  ranking: { create: jest.fn() },
};

const mailerMock = { sendMail: jest.fn() };
const inscricaoMock = { assertAberta: jest.fn() };
const bolaoMock = { entrarViaConvite: jest.fn(), lookupConvite: jest.fn() };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('token') } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('secret') } },
        { provide: 'MAILER', useValue: mailerMock },
        { provide: InscricaoWindowService, useValue: inscricaoMock },
        { provide: BolaoService, useValue: bolaoMock },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    inscricaoMock.assertAberta.mockResolvedValue(undefined);
    bolaoMock.lookupConvite.mockResolvedValue({ valido: true });
  });

  it('registrar lança ConflictException se e-mail já existe', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ id: '1', email: 'a@a.com' });
    await expect(
      service.registrar({ nome: 'Test', email: 'a@a.com', senha: '12345678', telefone: '(11) 91234-5678', conviteToken: 'token-abc' }),
    ).rejects.toThrow(ConflictException);
  });

  it('registrar cria usuário e entra no bolão global', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    prismaMock.usuario.create.mockResolvedValue({ id: 'new-id', email: 'b@b.com', nome: 'Test' });
    await service.registrar({ nome: 'Test', email: 'b@b.com', senha: '12345678', telefone: '(11) 91234-5678', conviteToken: 'token-abc' });
    expect(prismaMock.bolaoMembro.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bolaoId: '00000000-0000-0000-0000-000000000001' }),
      }),
    );
  });

  it('registrar lança ForbiddenException quando janela está fechada', async () => {
    inscricaoMock.assertAberta.mockRejectedValueOnce(new ForbiddenException('Inscrições encerradas.'));
    await expect(
      service.registrar({ nome: 'Test', email: 'c@c.com', senha: '12345678', telefone: '(11) 91234-5678', conviteToken: 'token-abc' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prismaMock.usuario.create).not.toHaveBeenCalled();
  });

  it('registrar inclui telefone na criação do usuário', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    prismaMock.usuario.create.mockResolvedValue({ id: 'new-id', email: 'b@b.com', nome: 'Test' });
    await service.registrar({ nome: 'Test', email: 'b@b.com', senha: '12345678', telefone: '(11) 91234-5678', conviteToken: 'token-abc' });
    expect(prismaMock.usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ telefone: '(11) 91234-5678' }),
      }),
    );
  });

  it('login lança UnauthorizedException se e-mail não existe', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'x@x.com', senha: '12345678' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('barra usuário inativo no login', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: 'u1', email: 'a@a.com', senhaHash: 'hash', emailVerificado: true,
      ativo: false, role: 'USER',
    });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    await expect(service.login({ email: 'a@a.com', senha: 'x' }))
      .rejects.toThrow('Sua conta está desativada.');
  });

  it('envia e-mail de confirmação com URL /auth/confirmar-email', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    prismaMock.usuario.create.mockResolvedValue({ id: 'new-id', email: 'b@b.com', nome: 'Test' });
    await service.registrar({ nome: 'Test', email: 'b@b.com', senha: '12345678', telefone: '(11) 91234-5678', conviteToken: 'token-abc' });
    const html: string = mailerMock.sendMail.mock.calls[0][0].html;
    expect(html).toContain('/auth/confirmar-email?token=');
  });

  it('registrar chama entrarViaConvite com o token fornecido', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    prismaMock.usuario.create.mockResolvedValue({ id: 'new-id', email: 'b@b.com', nome: 'Test', role: 'USER' });
    bolaoMock.entrarViaConvite.mockResolvedValue({});
    await service.registrar({
      nome: 'Test', email: 'b@b.com', senha: '12345678',
      telefone: '(11) 91234-5678', conviteToken: 'token-abc',
    });
    expect(bolaoMock.entrarViaConvite).toHaveBeenCalledWith(
      { id: 'new-id', role: 'USER' },
      'token-abc',
    );
  });

  it('registrar não cria usuário quando convite é inválido', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    bolaoMock.lookupConvite.mockResolvedValue({ valido: false });
    await expect(
      service.registrar({ nome: 'Test', email: 'b@b.com', senha: '12345678', telefone: '(11) 91234-5678', conviteToken: 'token-ruim' }),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.usuario.create).not.toHaveBeenCalled();
  });

  it('registrar chama lookupConvite com o token antes de criar usuário', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    prismaMock.usuario.create.mockResolvedValue({ id: 'new-id', email: 'b@b.com', nome: 'Test', role: 'USER' });
    await service.registrar({ nome: 'Test', email: 'b@b.com', senha: '12345678', telefone: '(11) 91234-5678', conviteToken: 'token-abc' });
    expect(bolaoMock.lookupConvite).toHaveBeenCalledWith('token-abc');
  });
});
```

- [ ] **Step 2: Rodar os testes — confirmar que falham**

```
pnpm --filter @bolao/backend test -- --testPathPattern=auth.service.spec --no-coverage
```

Esperado: falhas em testes que chamam `lookupConvite` (método ainda não existe no mock / service ainda não o chama).

- [ ] **Step 3: Atualizar `register.dto.ts` — tornar conviteToken obrigatório**

Substitua o conteúdo de `apps/backend/src/auth/dto/register.dto.ts`:

```ts
import { IsEmail, IsString, MinLength, MaxLength, Matches, IsNotEmpty } from 'class-validator';

export class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(60)
  nome: string;

  @IsEmail()
  email: string;

  @IsString()
  @Matches(/^\(\d{2}\) \d{5}-\d{4}$/, { message: 'Formato inválido. Use (99) 99999-9999.' })
  telefone: string;

  @IsString() @MinLength(8)
  senha: string;

  @IsNotEmpty()
  @IsString()
  conviteToken: string;
}
```

- [ ] **Step 4: Atualizar `auth.service.ts` — adicionar pré-validação**

Substitua o conteúdo de `apps/backend/src/auth/auth.service.ts`:

```ts
import { Injectable, ConflictException, UnauthorizedException, BadRequestException, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { BOLAO_GLOBAL_ID } from '@bolao/shared';
import { InscricaoWindowService } from '../inscricao-window/inscricao-window.service';
import { BolaoService } from '../bolao/bolao.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    @Inject('MAILER') private mailer: any,
    private inscricaoWindow: InscricaoWindowService,
    private bolaoService: BolaoService,
  ) {}

  async registrar(dto: RegisterDto) {
    await this.inscricaoWindow.assertAberta();

    const existe = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (existe) throw new ConflictException('E-mail já cadastrado.');

    const conviteInfo = await this.bolaoService.lookupConvite(dto.conviteToken);
    if (!conviteInfo.valido) throw new BadRequestException('Convite inválido ou expirado.');

    const senhaHash = await bcrypt.hash(dto.senha, 12);
    const usuario = await this.prisma.usuario.create({
      data: { nome: dto.nome, email: dto.email, senhaHash, telefone: dto.telefone },
    });

    await this.prisma.bolaoMembro.create({
      data: { bolaoId: BOLAO_GLOBAL_ID, usuarioId: usuario.id },
    });
    await this.prisma.ranking.create({
      data: { bolaoId: BOLAO_GLOBAL_ID, usuarioId: usuario.id },
    });

    await this.enviarEmailConfirmacao(usuario.id, usuario.email);

    await this.bolaoService.entrarViaConvite({ id: usuario.id, role: usuario.role }, dto.conviteToken);

    return { message: 'Cadastro realizado. Verifique seu e-mail.' };
  }

  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (!usuario || !usuario.senhaHash) throw new UnauthorizedException('Credenciais inválidas.');

    const senhaValida = await bcrypt.compare(dto.senha, usuario.senhaHash);
    if (!senhaValida) throw new UnauthorizedException('Credenciais inválidas.');

    if (!usuario.emailVerificado) {
      throw new UnauthorizedException('Confirme seu e-mail antes de entrar.');
    }

    if (!usuario.ativo) {
      throw new UnauthorizedException('Sua conta está desativada.');
    }

    return this.gerarTokens(usuario.id, usuario.email, usuario.role);
  }

  async gerarTokens(usuarioId: string, email: string, role: string) {
    const payload = { sub: usuarioId, email, role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN'),
      }),
    ]);
    return { accessToken, refreshToken };
  }

  async confirmarEmail(token: string) {
    try {
      const payload = await this.jwt.verifyAsync(token, { secret: this.config.get('JWT_SECRET') });
      if (payload.type !== 'email-confirm') throw new Error();
      await this.prisma.usuario.update({
        where: { id: payload.sub },
        data: { emailVerificado: true },
      });
      return { message: 'E-mail confirmado.' };
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
  }

  async esqueceuSenha(email: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (!usuario) return { message: 'Se o e-mail existir, você receberá as instruções.' };

    const token = await this.jwt.signAsync(
      { sub: usuario.id, type: 'reset-password' },
      { secret: this.config.get('JWT_SECRET'), expiresIn: '1h' },
    );
    const url = `${this.config.get('APP_URL')}/auth/nova-senha?token=${token}`;
    await this.mailer.sendMail({
      to: email,
      subject: 'Recuperação de senha — Bolão Trovão',
      html: `<p>Clique para redefinir: <a href="${url}">${url}</a></p>`,
    });
    return { message: 'Se o e-mail existir, você receberá as instruções.' };
  }

  async redefinirSenha(token: string, novaSenha: string) {
    try {
      const payload = await this.jwt.verifyAsync(token, { secret: this.config.get('JWT_SECRET') });
      if (payload.type !== 'reset-password') throw new Error();
      const senhaHash = await bcrypt.hash(novaSenha, 12);
      await this.prisma.usuario.update({
        where: { id: payload.sub },
        data: { senhaHash },
      });
      return { message: 'Senha redefinida.' };
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
  }

  private async enviarEmailConfirmacao(usuarioId: string, email: string) {
    const token = await this.jwt.signAsync(
      { sub: usuarioId, type: 'email-confirm' },
      { secret: this.config.get('JWT_SECRET'), expiresIn: '24h' },
    );
    const url = `${this.config.get('APP_URL')}/auth/confirmar-email?token=${token}`;
    await this.mailer.sendMail({
      to: email,
      subject: 'Confirme seu e-mail — Bolão Trovão',
      html: `<p>Clique para confirmar: <a href="${url}">${url}</a></p>`,
    });
  }
}
```

- [ ] **Step 5: Rodar os testes — confirmar que passam**

```
pnpm --filter @bolao/backend test -- --testPathPattern=auth.service.spec --no-coverage
```

Esperado: todos os testes passam. Se algum falhar, leia a mensagem de erro e corrija antes de continuar.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/auth/dto/register.dto.ts apps/backend/src/auth/auth.service.ts apps/backend/src/auth/auth.service.spec.ts
git commit -m "feat: conviteToken obrigatório no registro + pré-validação antes de criar usuário"
```

---

## Task 2: Backend — telefone no UpdateUsuarioDto e no perfil

**Files:**
- Modify: `apps/backend/src/usuario/dto/update-usuario.dto.ts`
- Modify: `apps/backend/src/usuario/usuario.service.ts`

- [ ] **Step 1: Adicionar telefone ao UpdateUsuarioDto**

Substitua o conteúdo de `apps/backend/src/usuario/dto/update-usuario.dto.ts`:

```ts
import { IsOptional, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class UpdateUsuarioDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60)
  nome?: string;

  @IsOptional() @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\(\d{2}\) \d{5}-\d{4}$/, { message: 'Formato inválido. Use (99) 99999-9999.' })
  telefone?: string;
}
```

- [ ] **Step 2: Incluir telefone na query de perfil**

Em `apps/backend/src/usuario/usuario.service.ts`, adicione `telefone: true` ao `select` do método `perfil()`:

```ts
async perfil(usuarioId: string) {
  const usuario = await this.prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      nome: true,
      email: true,
      telefone: true,
      avatarUrl: true,
      role: true,
      criadoEm: true,
      bolaoFavoritoId: true,
    },
  });
  if (!usuario) throw new NotFoundException();
  return usuario;
}
```

- [ ] **Step 3: Rodar os testes do usuario.service para confirmar que não quebramos nada**

```
pnpm --filter @bolao/backend test -- --testPathPattern=usuario.service.spec --no-coverage
```

Esperado: todos os testes passam (a mudança no select é aditiva).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/usuario/dto/update-usuario.dto.ts apps/backend/src/usuario/usuario.service.ts
git commit -m "feat: adicionar telefone ao UpdateUsuarioDto e ao select de perfil"
```

---

## Task 3: Frontend — remover "Criar conta" da tela de login

**Files:**
- Modify: `apps/frontend/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Remover o bloco "Criar conta" e o hook useInscricaoStatus**

Edite `apps/frontend/src/app/(auth)/login/page.tsx`:

1. Remova a linha de import do hook (linha 8):
   ```ts
   import { useInscricaoStatus } from '@/hooks/useInscricaoStatus';
   ```

2. Remova a declaração do hook dentro de `LoginForm` (linha 17):
   ```ts
   const { abertas } = useInscricaoStatus();
   ```

3. Substitua o bloco condicional do rodapé (linhas 87-91) deixando apenas o link de "Esqueceu a senha?":

```tsx
<div className="text-center text-sm text-gray-400">
  <Link href="/esqueceu-senha" className="hover:text-white block">Esqueceu a senha?</Link>
</div>
```

O arquivo final do componente `LoginForm` fica sem qualquer referência a `abertas` ou `useInscricaoStatus`.

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/app/(auth)/login/page.tsx
git commit -m "feat: remover botão criar conta da tela de login"
```

---

## Task 4: Frontend — botão "Registrar com Google" na página de convite

**Files:**
- Modify: `apps/frontend/src/app/convite/[codigo]/page.tsx`

- [ ] **Step 1: Adicionar o botão Google no estado nao-autenticado**

Em `apps/frontend/src/app/convite/[codigo]/page.tsx`, localize o bloco `if (estado === 'nao-autenticado')` (linha 72). Dentro do `<div>` que contém os dois botões, adicione um terceiro botão **após** o botão "Criar conta":

```tsx
if (estado === 'nao-autenticado') {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-trovao-card border border-trovao-border rounded-2xl p-8 text-center space-y-4">
        <div className="text-4xl">⚡</div>
        <h1 className="text-white font-bold text-lg">{convite?.bolaoNome}</h1>
        {convite?.descricao && <p className="text-trovao-muted text-sm">{convite.descricao}</p>}
        <p className="text-trovao-muted text-xs">Convidado por {convite?.criadorNome}</p>
        <p className="text-trovao-muted text-sm">Entre ou crie uma conta para participar.</p>
        <button onClick={() => router.push(`/login?redirect=/convite/${codigo}`)}
          className="w-full py-2 bg-trovao-gold text-trovao-base text-sm font-bold rounded-lg hover:opacity-90 transition-opacity">
          Fazer login
        </button>
        <button onClick={() => router.push(`/registrar?convite=${codigo}`)}
          className="w-full py-2 bg-trovao-surface border border-trovao-border text-trovao-muted text-sm rounded-lg hover:text-white transition-colors">
          Criar conta
        </button>
        <a
          href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/auth/google`}
          onClick={() => sessionStorage.setItem('convitePendente', codigo)}
          className="block w-full py-2 bg-trovao-surface border border-trovao-border text-trovao-muted text-sm rounded-lg hover:text-white transition-colors text-center"
        >
          Registrar com Google
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/app/convite/[codigo]/page.tsx
git commit -m "feat: botão registrar com Google na página de convite"
```

---

## Task 5: Frontend — guard de convite na página /registrar

**Files:**
- Modify: `apps/frontend/src/app/(auth)/registrar/page.tsx`

- [ ] **Step 1: Substituir guard de janela por guard de convite**

Substitua o conteúdo completo de `apps/frontend/src/app/(auth)/registrar/page.tsx`:

```tsx
'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

function mascaraTelefone(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 2) return `(${nums}`;
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
}

function RegistrarForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conviteToken = searchParams.get('convite');
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', senha: '' });
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const data = await api.post<{ message: string }>('/auth/registrar', { ...form, conviteToken });
      setSucesso(data.message);
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao cadastrar.');
    } finally {
      setLoading(false);
    }
  }

  if (!conviteToken) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-gray-900 rounded-xl p-8 text-center max-w-sm space-y-4">
        <p className="text-red-400">
          Você precisa de um convite para criar uma conta.
        </p>
        <Link href="/login" className="text-yellow-400 hover:underline block">Voltar ao login</Link>
      </div>
    </div>
  );

  if (sucesso) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-gray-900 rounded-xl p-8 text-center max-w-sm space-y-4">
        <p className="text-green-400">{sucesso}</p>
        <Link href="/login" className="text-yellow-400 hover:underline block">Ir para login</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm bg-gray-900 rounded-xl p-8 space-y-6">
        <h1 className="text-xl font-bold text-center">Criar conta</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {erro && <p className="text-red-400 text-sm">{erro}</p>}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Nome</label>
            <input type="text" value={form.nome} required
              onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input type="email" value={form.email} required
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Telefone</label>
            <input type="tel" inputMode="tel" value={form.telefone} required
              placeholder="(11) 91234-5678"
              onChange={e => setForm(p => ({ ...p, telefone: mascaraTelefone(e.target.value) }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Senha</label>
            <input type="password" value={form.senha} required
              onChange={e => setForm(p => ({ ...p, senha: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-yellow-400 text-gray-900 font-bold py-2 rounded-lg hover:bg-yellow-300 disabled:opacity-50">
            {loading ? 'Cadastrando...' : 'Cadastrar'}
          </button>
        </form>
        <div className="text-center text-sm text-gray-400">
          <Link href="/login" className="hover:text-white">Já tem conta? Entrar</Link>
        </div>
      </div>
    </div>
  );
}

export default function RegistrarPage() {
  return (
    <Suspense>
      <RegistrarForm />
    </Suspense>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/app/(auth)/registrar/page.tsx
git commit -m "feat: guard de convite na página de registro"
```

---

## Task 6: Frontend — nova página /completar-perfil

**Files:**
- Create: `apps/frontend/src/app/completar-perfil/page.tsx`

- [ ] **Step 1: Criar a página**

Crie `apps/frontend/src/app/completar-perfil/page.tsx` com o seguinte conteúdo:

```tsx
'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

function mascaraTelefone(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 2) return `(${nums}`;
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
}

function CompletarPerfilForm() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const convite = searchParams.get('convite');
  const [telefone, setTelefone] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await api.patch('/usuarios/me', { telefone });
      if (convite) {
        try {
          await api.post(`/boloes/entrar/${convite}`);
        } catch {
          // already a member or bolão full — proceed anyway
        }
      }
      router.replace('/jogos');
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao salvar telefone.');
    } finally {
      setSalvando(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm bg-gray-900 rounded-xl p-8 space-y-6">
        <h1 className="text-xl font-bold text-center text-white">Complete seu perfil</h1>
        <p className="text-gray-400 text-sm text-center">
          Para participar do bolão, precisamos do seu telefone.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {erro && <p className="text-red-400 text-sm text-center">{erro}</p>}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Telefone</label>
            <input
              type="tel"
              inputMode="tel"
              value={telefone}
              required
              placeholder="(11) 91234-5678"
              onChange={e => setTelefone(mascaraTelefone(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
            />
          </div>
          <button
            type="submit"
            disabled={salvando}
            className="w-full bg-yellow-400 text-gray-900 font-bold py-2 rounded-lg hover:bg-yellow-300 disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Confirmar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CompletarPerfilPage() {
  return (
    <Suspense>
      <CompletarPerfilForm />
    </Suspense>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/app/completar-perfil/page.tsx
git commit -m "feat: página completar-perfil para novos usuários Google"
```

---

## Task 7: Frontend — atualizar callback do OAuth

**Files:**
- Modify: `apps/frontend/src/app/auth/callback/page.tsx`

- [ ] **Step 1: Substituir o conteúdo do callback**

Substitua o conteúdo completo de `apps/frontend/src/app/auth/callback/page.tsx`:

```tsx
'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { setAccessToken } from '@/lib/auth';
import { api } from '@/lib/api';
import type { Usuario } from '@/types/api';

function CallbackContent() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      router.replace('/login');
      return;
    }

    setAccessToken(token);

    const convitePendente = sessionStorage.getItem('convitePendente');

    if (!convitePendente) {
      router.replace('/jogos');
      return;
    }

    api.get<Usuario>('/usuarios/me')
      .then(user => {
        sessionStorage.removeItem('convitePendente');
        if (!user.telefone) {
          router.replace(`/completar-perfil?convite=${convitePendente}`);
        } else {
          api.post(`/boloes/entrar/${convitePendente}`)
            .catch(() => {})
            .finally(() => router.replace('/jogos'));
        }
      })
      .catch(() => {
        router.replace('/jogos');
      });
  }, [params, router]);

  return <span className="text-gray-400">Autenticando...</span>;
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Suspense fallback={<span className="text-gray-400">Carregando...</span>}>
        <CallbackContent />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 2: Rodar typecheck para confirmar que não há erros de tipo**

```
pnpm --filter @bolao/frontend exec tsc --noEmit
```

Esperado: sem erros. Se aparecer erro de tipo, leia e corrija antes de continuar.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/app/auth/callback/page.tsx
git commit -m "feat: callback OAuth orquestra convite pendente e coleta de telefone"
```

---

## Task 8: Validação final — rodar todos os testes do backend

- [ ] **Step 1: Rodar suite completa**

```
pnpm --filter @bolao/backend test --no-coverage
```

Esperado: todos os testes passam. Se algum falhar, leia o erro e corrija.

- [ ] **Step 2: Commit do plano de implementação**

```bash
git add docs/superpowers/plans/2026-06-01-cadastro-invite-only.md
git commit -m "docs: plano de implementação cadastro invite-only"
```
