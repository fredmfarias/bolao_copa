# Tela de Regulamento

**Data:** 2026-06-01
**Status:** Aprovado

## Objetivo

Criar uma página pública de regulamento acessível pela tela de login, com as regras do bolão para todos os participantes — pontuação universal, disposições gerais e condições específicas por tipo de bolão (Trovão, Global e outros).

---

## Rota e Arquitetura

- **Rota:** `/regulamento`
- **Arquivo:** `apps/frontend/src/app/regulamento/page.tsx`
- **Visibilidade:** pública — sem autenticação, sem chamadas ao backend
- **Componente UI:** `Accordion` do shadcn/ui (já presente no projeto)
- **Tema:** padrão dark da aplicação (`bg-gray-900`, `text-yellow-400`, `bg-gray-800`)

### Acesso via Login

Adicionar link "Regulamento" no bloco de links do rodapé da página de login (`apps/frontend/src/app/(auth)/login/page.tsx`), ao lado dos links existentes ("Esqueceu a senha?", "Criar conta").

---

## Estrutura do Accordion

Quatro seções expansíveis. A primeira abre por padrão.

### 1. Disposições Gerais

- O bolão tem intuito exclusivo de diversão e entretenimento entre amigos e familiares, sem fins lucrativos.
- Ao participar, o usuário aceita este regulamento e isenta os organizadores de qualquer responsabilidade material ou moral.
- É permitida uma aposta por jogo, podendo ser alterada quantas vezes o usuário desejar até **1 hora antes** do início da partida.
- O sistema encerra as apostas automaticamente no prazo; nenhuma alteração é permitida após o corte.
- Os palpites dos demais participantes ficam visíveis **somente após** o encerramento das apostas daquele jogo.
- **Limite de apostas idênticas:** máximo de **18 apostas com o mesmo placar** na fase de grupos e **8** na fase eliminatória por usuário.
- Participantes sem pagamento confirmado (nos bolões que cobram taxa) serão removidos do bolão.

### 2. Valor e Pagamento

#### Bolão Global
- **Gratuito.** Sem taxa de inscrição e sem premiação.

#### Bolão Família Trovão
- **Taxa de inscrição:** R$ 50,00
- **Chave PIX (telefone):** `83988269825`
- **PIX Copia e Cola:**
  ```
  00020126730014BR.GOV.BCB.PIX0114+55839882698250233Inscrição Bolão Da Família Trovão520400005303986540550.005802BR5925Fred Augusto de Melo Fari6009SAO PAULO62140510b39ukQVYm66304DA4A
  ```
  — campo exibido com botão **Copiar** (feedback visual "Copiado!" por 2 s via `navigator.clipboard.writeText`)
- Após o pagamento, avisar Fred Farias via WhatsApp: **(83) 98826-9825**

#### Outros Bolões
- Valor e forma de pagamento **combinados previamente com Fred Farias** via WhatsApp **(83) 98826-9825**.
- A precificação e a premiação são definidas exclusivamente pelo **moderador do bolão**.
- **Fred Farias não tem qualquer responsabilidade legal** sobre bolões de terceiros. O intuito é puramente recreativo.

### 3. Sistema de Pontuação

Pontuação universal para todos os bolões.

| Acerto | Pontos |
|---|---|
| Placar exato do jogo | **10 pts** |
| Placar exato do vencedor (sem acertar o do perdedor) | **6 pts** |
| Empate correto (sem acertar o placar exato) | **5 pts** |
| Placar exato do perdedor (sem acertar o do vencedor) | **4 pts** |
| Vencedor correto (sem acertar nenhum placar) | **2 pts** |

> Os pontos **não são cumulativos** — o máximo por jogo é o placar exato × o peso daquele jogo.

#### Multiplicadores de Peso

| Situação | Peso |
|---|---|
| Jogos de seleções ex-campeãs mundiais | **x2** |
| Jogos do Brasil (qualquer fase) | **x3** |
| Todos os jogos da 2ª fase (mata-mata) | **x2** |
| Brasil na 2ª fase | **x3** |

**Exemplos de pontuação:**
- Placar exato em jogo normal: 10 pts
- Placar exato em jogo de ex-campeã: 10 × 2 = **20 pts**
- Placar exato em jogo do Brasil: 10 × 3 = **30 pts**
- Acerto do vencedor em jogo da 2ª fase: 2 × 2 = **4 pts**

#### Limite de Apostas Idênticas
- Fase de grupos: máximo de **18 apostas com o mesmo placar**
- Fase eliminatória: máximo de **32 apostas com o mesmo placar**

### 4. Premiação

#### Bolão Global
- **Sem premiação.** Participação gratuita e sem distribuição de prêmios.

#### Bolão Família Trovão
Os 5 participantes com maior pontuação ao fim do bolão recebem:

| Posição | Percentual do total arrecadado |
|---|---|
| 1º lugar | 45% |
| 2º lugar | 25% |
| 3º lugar | 15% |
| 4º lugar | 10% |
| 5º lugar | 5% |

**Critérios de desempate (em ordem):**
1. Maior número de placares exatos
2. Maior número de acertos do placar do vencedor
3. E assim sucessivamente, seguindo a ordem da tabela de pontuação
4. Persistindo o empate: a premiação das posições empatadas é somada e dividida igualmente

#### Outros Bolões
- Premiação definida exclusivamente pelo moderador. Fred Farias não tem responsabilidade sobre a distribuição de prêmios de bolões de terceiros.

---

## Implementação do Botão Copiar

```tsx
const [copiado, setCopiado] = useState(false);

async function copiarPix() {
  await navigator.clipboard.writeText(PIX_COPIA_COLA);
  setCopiado(true);
  setTimeout(() => setCopiado(false), 2000);
}
```

Botão exibe "Copiar" em estado normal e "Copiado!" com cor verde por 2 s após o clique.

---

## Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `apps/frontend/src/app/regulamento/page.tsx` | Criar |
| `apps/frontend/src/app/(auth)/login/page.tsx` | Adicionar link "Regulamento" |
