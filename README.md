# Cha de Bebe — Sarah Brandao

## Como o site funciona

O site e um convite digital para o cha de bebe da Sarah. Quando alguem abre o link, ve:

1. **Capa** — nome da mae, data, horario e local do evento
2. **Detalhes** — quando e onde vai acontecer
3. **Lista de Mimos** — os presentes que a mamae escolheu, cada um com foto e valor
4. **Confirmar Presenca** — formulario para o convidado dizer que vai ir

### Presentes e Pix

- Cada presente aparece como um card com foto, nome e valor
- Quando alguem clica em "Presentear via Pix", abre um modal pedindo o nome da pessoa
- O site gera um codigo Pix (copia e cola) com o valor ja preenchido
- A pessoa cola no app do banco e faz o Pix
- Depois de confirmar, o presente aparece como "Presenteado por [nome]" para todo mundo ver
- Nao e possivel presentear o mesmo item duas vezes

### Confirmar Presenca

- O convidado digita o nome e quantas pessoas vao
- Clica em "Confirmar" e pronto

### Painel de Admin (para a Sarah)

- No rodapé do site tem um link "admin"
- Acessa pelo endereco do site + `/#admin` (ex: `http://localhost:5000/#admin`)
- Senha padrao: `gemeas0609`
- Dentro do painel a Sarah pode:
  - **Mimos**: adicionar, editar e excluir presentes da lista (com foto!)
  - **Reservas**: ver quem presenteou o que, e excluir se precisar
  - **Presencas**: ver quem confirmou presenca, e excluir se precisar
  - **Registrar**: cadastrar manualmente um presente (para quando alguem entrega em maos e nao fez pelo Pix)

---

## Como rodar o site no computador (passo a passo)

### Primeira vez — instalar as ferramentas

Voce precisa de duas coisas instaladas no computador:

#### 1. Python
- Acesse: https://www.python.org/downloads/
- Baixe a versao mais recente
- **IMPORTANTE**: na instalacao, marque a opcao **"Add Python to PATH"**
- Clique em "Install Now"

#### 2. Node.js
- Acesse: https://nodejs.org/
- Baixe a versao "LTS" (a que tem o botao verde)
- Instale normalmente, clicando em "Next" em tudo

Depois de instalar os dois, **feche e abra o terminal** (ou reinicie o computador) para as coisas funcionarem.

---

### Rodando o site

#### Jeito facil (Windows)

Depois de instalar Python e Node.js, e so dar dois cliques no arquivo **`run.bat`** na pasta do projeto.

Ele vai:
- Instalar tudo que precisa automaticamente
- Abrir o site no navegador sozinho
- Rodar o backend e o frontend ao mesmo tempo

Para ver o painel de admin, acesse: **http://localhost:5173/#admin** (senha: `gemeas0609`)

Para parar, feche a janela preta que abriu ou aperte `Ctrl+C`.

#### Jeito manual (2 terminais)

Se preferir rodar manualmente, abra **dois terminais** (Prompt de Comando, PowerShell, ou Terminal do VS Code).

**Terminal 1 — Backend:**
```bash
cd backend
python app.py
```
*(se nao funcionar, tente `python3 app.py`)*

**Terminal 2 — Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Depois abra o navegador em: **http://localhost:5173**

Painel de admin: **http://localhost:5173/#admin** (senha: `gemeas0609`)

---

### Parar de rodar

Para parar, va em cada terminal e aperte `Ctrl + C`.


---

### Alterar a senha do admin

Abra o arquivo `backend/app.py` e procure a linha:

```python
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "gemeas0609")
```

Troque `gemeas0609` pela senha que voce quiser.

### Alterar a chave Pix

Abra o arquivo `frontend/src/App.tsx` e procure:

```typescript
pixKey: "SUA-CHAVE-PIX-AQUI",
```

Troque pela sua chave Pix (CPF, e-mail, celular ou chave aleatoria).

### Alterar dados do evento

No mesmo arquivo `frontend/src/App.tsx`, procure a secao `CONFIG` e altere:

- `momName` — nome da mae
- `babyLine` — frase do bebe
- `dateText` — data do evento
- `timeText` — horario
- `locationName` — nome do local
- `locationAddress` — endereco
- `pixReceiverName` — nome cadastrado na chave Pix
- `pixCity` — cidade cadastrada na chave Pix
