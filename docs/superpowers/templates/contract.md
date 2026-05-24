# Contrato: {NomeDoComponenteOuFluxo}

> **Produzido por:** [M{N} — {nome}](../modules/M{N}-{slug}.md)
> **Consumido por:** [M{N+1} — {nome}](../modules/M{N+1}-{slug}.md)
> **Última atualização:** YYYY-MM-DD

---

## Interface pública

### Props / Parâmetros

```typescript
interface {Nome}Props {
  // campo: tipo  // obrigatório ou opcional?
}
```

### Eventos / Callbacks

```typescript
// onEvento: (arg: Tipo) => void
// Quando dispara: descreva a condição
```

### Estados válidos

| Estado | Descrição | Condição de entrada |
|---|---|---|
| `idle` | | |
| `saving` | | |
| `error` | | |

### Tipos de erro esperados

```typescript
// Erros que o consumidor deve tratar
type {Nome}Error = 'not-found' | 'expired' | 'forbidden';
```

---

## Exemplo de uso

```tsx
// Mínimo necessário para usar este componente/hook
<{Nome}
  prop="valor"
  onEvento={(arg) => console.log(arg)}
/>
```

---

## Restrições

O que NÃO é responsabilidade deste contrato:
- Não gerencia estado global de autenticação
- Não faz chamadas à API diretamente ← exemplo, adapte
- ...

---

## Resumo operacional

*Uma frase: o que este contrato expõe e para quê.*
