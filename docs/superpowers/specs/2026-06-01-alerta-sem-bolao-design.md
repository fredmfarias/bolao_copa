# Design: Alerta de usuário sem bolão privado

**Data:** 2026-06-01  
**Status:** Aprovado

## Contexto

Usuários que entram via OAuth (Google) sem ter um convite passam pelo fluxo de autenticação sem serem bloqueados pelo guard de invite-only. Eles terminam como membros apenas do bolão global (`BOLAO_GLOBAL_ID`). Na página "Meus Bolões", esses usuários não recebem nenhum feedback claro sobre sua situação.

## Objetivo

Exibir um banner informativo na página de Meus Bolões quando o usuário só tem o bolão global, orientando-o a solicitar um convite ao moderador.

## Escopo

- **Afetado:** apenas `apps/frontend/src/app/(app)/boloes/page.tsx`
- **Não afetado:** backend, outras páginas, fluxo de autenticação

## Lógica de detecção

Após o fetch de `/boloes/meus` ser concluído, deriva um booleano:

```ts
const semBolaoReal = !loading && meus.length === 1 && meus[0].id === BOLAO_GLOBAL_ID;
```

Cobre os casos:
- Usuário com apenas o bolão global → `true` (alerta visível)
- Usuário com bolões reais além do global → `false` (alerta oculto)
- Usuário com zero bolões (estado improvável) → `false` (seguro por não satisfazer `length === 1`)

Nenhuma chamada extra ao backend é necessária.

## UI do banner

Renderizado entre o título "Meus Bolões" e a grade de cards, apenas quando `semBolaoReal === true`.

**Texto:**
> ⚠ Você ainda não participa de nenhum bolão privado. Entre em contato com o moderador do seu bolão para solicitar um convite.

**Estilo:**
```
bg-yellow-900/40 border border-yellow-600/50 text-yellow-200 rounded-lg px-4 py-3
```
Consistente com a paleta escura do projeto (trovao-card/trovao-border). Sem ação, sem fechar, sem botão.

O bolão global continua aparecendo normalmente na grade abaixo do banner.

## Comportamento esperado

| Situação | Banner | Lista |
|----------|--------|-------|
| Só bolão global | Visível | Bolão global aparece |
| Bolões reais + global | Oculto | Todos os bolões aparecem |
| Carregando | Oculto | Spinner |

## Testes

- Verificar que `semBolaoReal` é `true` quando mock retorna `[{ id: BOLAO_GLOBAL_ID }]`
- Verificar que `semBolaoReal` é `false` quando mock retorna dois ou mais bolões
- Verificar que o banner renderiza com o texto correto quando a condição é verdadeira
- Verificar que o banner não renderiza quando a condição é falsa
