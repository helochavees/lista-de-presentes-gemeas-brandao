# CLAUDE.md

## Visao geral

Site de convite para cha de bebe da Sarah Brandao. Os convidados acessam, veem os detalhes do evento, escolhem um presente da lista e pagam via Pix. A Sarah gerencia tudo pelo painel admin.

## Como funciona o fluxo

1. Convidado abre o link do site
2. Ve a capa com nome, data, horario e local
3. Rola pra baixo e ve a lista de mimos (presentes com foto e valor)
4. Clica num presente → digita o nome → o site gera um codigo Pix copia e cola
5. Convidado cola no app do banco e faz o Pix
6. Clica "Ja enviei o Pix" → presente aparece como "Presenteado por [nome]"
7. Mais abaixo, convidado confirma presenca (nome + quantas pessoas)

## Stack

- **Frontend**: React 19 + TypeScript + Vite — tudo num arquivo so: `frontend/src/App.tsx`
- **Backend**: Python + Flask — tudo num arquivo so: `backend/app.py`
- **Banco**: SQLite — arquivo `backend/data/cha.db` (criado automaticamente)
- **Fotos**: pasta `backend/data/gifts/` (criada automaticamente)

## Como rodar

**Windows**: dar dois cliques em `run.bat`

**Manual** (abrir 2 terminais):
```
Terminal 1: cd backend → python app.py
Terminal 2: cd frontend → npm install → npm run dev
```

- Site: http://localhost:5173
- Admin: http://localhost:5173/#admin (senha: `admin123`)

## Estrutura do projeto

```
backend/
  app.py              # Todo o backend (rotas, banco, autenticacao, Pix)
  requirements.txt    # Dependencias Python (flask)

frontend/
  src/
    App.tsx           # Todo o frontend (componentes, estilos, tudo)
    main.tsx          # Entry point — NAO ALTERAR
  index.html          # HTML base — NAO ALTERAR
  vite.config.ts      # Config do Vite — NAO ALTERAR

run.bat               # Roda o site no Windows (abre backend + frontend)
build.py              # Gera executavel (nao usado no deploy)
AGENTS.md             # Instrucoes pro agente de IA
README.md             # Documentacao
```

## O que pode alterar

| Arquivo | Pode alterar? | O que tem |
|---------|---------------|-----------|
| `frontend/src/App.tsx` | SIM | Todo o frontend, textos, cores, componentes |
| `backend/app.py` | SIM | Rotas, banco, logica do backend |
| `backend/requirements.txt` | SIM | Dependencias Python |
| `frontend/package.json` | SIM (com cuidado) | Dependencias Node |
| `run.bat` | SIM | Script de inicializacao |
| `main.tsx` | NAO | Entry point do React |
| `index.html` | NAO | HTML base |
| `vite.config.ts` | NAO | Config do Vite |

## Configuracao do evento

No comeco de `frontend/src/App.tsx`, tem um objeto `CONFIG`:

```typescript
const CONFIG = {
  momName: "Sarah Brandao",           // Nome da mae
  babyLine: "Celebrando a chegada...", // Frase do bebe
  dateText: "Domingo, 06 de setembro", // Data
  timeText: "16 horas",                // Horario
  locationName: "Alphaville Eusebio",  // Nome do local
  locationAddress: "Eusebio — Ceara",  // Endereco
  pixKey: "SUA-CHAVE-PIX-AQUI",       // Chave Pix
  pixReceiverName: "Sarah Brandao",    // Nome no Pix
  pixCity: "Eusebio",                  // Cidade no Pix
};
```

Pra alterar dados do evento, e so mexer nesse objeto. Nao precisa mexer em mais nada.

## Como o Pix funciona

O site gera um codigo Pix padrao BR Code (EMV) seguindo as regras do Banco Central. O codigo inclui:
- Chave Pix (do CONFIG)
- Valor do presente
- Nome do recebedor
- Cidade

O convidado copia esse codigo e cola no app do banco. O valor ja vem preenchido.

**Funcoes envolvidas** (em `App.tsx`):
- `normalize()` — remove acentos e caracteres especiais
- `emv()` — monta campos no formato EMV
- `crc16()` — calcula checksum obrigatorio
- `buildPixCode()` — junta tudo e gera o codigo final

## Painel de Admin

Acessa por `http://localhost:5173/#admin` (senha: `admin123`)

**Abas:**
- **Mimos**: adicionar, editar e excluir presentes (com foto)
- **Reservas**: ver quem presenteou o que, excluir se precisar
- **Presencas**: ver quem confirmou presenca, excluir se precisar
- **Registrar**: cadastrar presente manualmente (pra quando alguem entrega em maos)

**Como a autenticacao funciona:**
- POST `/api/admin/login` com a senha → retorna um token
- Todas as rotas admin precisam do header `Authorization: Bearer <token>`
- O token fica salvo no sessionStorage do navegador
- Tokens sao armazenados em memoria (somem quando o servidor reinicia)

## Banco de dados

**Tabela `gifts`** — presentes disponiveis:
- `id` (TEXT, chave primaria) — identificador unico
- `name` (TEXT) — nome do presente
- `value` (REAL, nullable) — valor em reais (null = valor livre)

**Tabela `reservations`** — presentes dados:
- `gift_id` (TEXT, chave primaria, FK gifts.id) — qual presente
- `guest_name` (TEXT) — nome do convidado
- `amount` (REAL) — valor pago
- `created_at` (TEXT) — data ISO 8601

**Tabela `rsvps`** — confirmacoes de presenca:
- `id` (INTEGER, chave primaria autoincrement)
- `name` (TEXT) — nome do convidado
- `people` (INTEGER) — quantas pessoas
- `created_at` (TEXT) — data ISO 8601

**Seed**: quando o banco e criado pela primeira vez, os 13 presentes padrao sao inseridos automaticamente (funcao `_ensure_default_gifts` em `app.py`). Depois, os presentes sao gerenciados pelo painel admin.

## Endpoints da API

### Publico (qualquer um acessa)

| Metodo | Rota | O que faz |
|--------|------|-----------|
| GET | `/api/gifts` | Lista todos os presentes (com `photo_url`) |
| GET | `/api/gifts/<id>/photo` | Retorna a foto do presente |
| GET | `/api/reservations` | Lista reservas (quem presenteou) |
| POST | `/api/reservations` | Cria reserva (convidado presenteia) |
| GET | `/api/rsvps` | Lista presencas confirmadas |
| POST | `/api/rsvps` | Confirma presenca |

### Admin (precisa de token)

| Metodo | Rota | O que faz |
|--------|------|-----------|
| POST | `/api/admin/login` | Login (retorna token) |
| GET | `/api/admin/dashboard` | Dados combinados (reservas + rsvps) |
| POST | `/api/admin/gifts` | Cria presente (multipart: name, value, photo) |
| PUT | `/api/admin/gifts/<id>` | Edita presente |
| DELETE | `/api/admin/gifts/<id>` | Exclui presente (e foto e reservas) |
| DELETE | `/api/admin/gifts/<id>/photo` | Remove foto do presente |
| POST | `/api/admin/reservations` | Cria reserva manual |
| DELETE | `/api/admin/reservations/<gift_id>` | Exclui reserva |
| DELETE | `/api/admin/rsvps/<id>` | Exclui confirmacao de presenca |

## Componentes do frontend

Todos em `frontend/src/App.tsx`:

- **`App`** (export default) — componente raiz, gerencia roteamento e estado global
- **`LandingPage`** — pagina principal (hero, detalhes, presentes, RSVP)
- **`GiftModal`** — modal que abre quando clica num presente (passo 1: nome, passo 2: Pix)
- **`AdminLoginPage`** — tela de login do admin
- **`AdminDashboard`** — painel admin (tabs, tabelas, formularios)
- **`Ornament`** — divisor decorativo

## Estilos

Todos os estilos estao na constante `css` no final de `App.tsx`, dentro de um template literal (crases).

**Variaveis de cor** (em `.page`):
```css
--porcelana: #FBF7F4;  /* fundo claro */
--rose: #F1E3DF;       /* fundo rosado */
--rosa-antigo: #C89B94; /* rosa suave */
--dourado: #B08D57;    /* dourado (bordas, detalhes) */
--tinta: #3C2F2F;      /* texto escuro */
```

**Fontes:**
- `Cormorant Garamond` — titulos (serifada, elegante)
- `Jost` — corpo do texto (sans-serif, moderna)

**Padrao dos componentes:**
- Cards: classe `frame` (borda dourada + fundo claro)
- Botoes: `btn btn-solid` (preenchido) ou `btn btn-outline` (so borda)
- Inputs: classe `input`
- Secoes: `section` (ou `section rose` pra fundo rosado)

## Convencoes

- **Textos visiveis**: em portugues, direto no JSX
- **Variaveis/funcoes**: em ingles
- **Nomes de componentes**: PascalCase
- **Nomes de funcoes auxiliares**: camelCase
- **CSS**: classes kebab-case
- **IDs de presentes**: kebab-case (ex: `fralda-rn`, `kit-banho`)
- **Datas**: ISO 8601 no banco, formatadas com `toLocaleDateString("pt-BR")` no frontend
