# AGENTS.md

## Quem vai usar

A dona do projeto nao e programadora. Ela vai pedir alteracoes no site e o agente deve fazer as mudancas direto no codigo, sempre explicando o que fez de forma simples.

## Como trabalhar

- Alterar so o necessario — nao refatorar coisas que funcionam
- Depois de cada mudanca, rodar `npm run build` no frontend e `python3 -c "import py_compile; py_compile.compile('backend/app.py')"` no backend pra garantir que nao quebrou
- Se algo der erro, explicar o problema em portugues simples antes de tentar arrumar
- Nunca apagar dados do banco (`backend/data/cha.db`) sem pedir confirmacao
- Nunca alterar `main.tsx`, `index.html`, `vite.config.ts`
- Explicar o que fez em portugues simples, sem jargao tecnico
- Se a pedida for grande, quebrar em passos e ir fazendo um por vez

## Exemplos de pedidos que ela pode fazer

### "Quero mudar a data do evento"
→ Alterar `CONFIG.dateText` e `CONFIG.timeText` em `frontend/src/App.tsx`
→ Se tiver texto com a data em outro lugar (ex: "Até o dia 06 de setembro!"), procurar e alterar tambem

### "Quero mudar a cor do site"
→ Alterar as variaveis de cor em `.page { --porcelana; --rose; --rosa-antigo; --dourado; --tinta; }` no CSS
→ Explicar qual cor afeta o que (fundo, bordas, texto, etc)

### "Quero adicionar uma secao nova (ex: localizacao com mapa)"
→ Criar uma nova `<section>` dentro do JSX de `LandingPage`
→ Adicionar estilos na constante `css`
→ Se precisar de mapa, usar iframe do Google Maps

### "Quero trocar a fonte"
→ Alterar o `@import` do Google Fonts no comeco do CSS
→ Alterar `font-family` nos lugares apropriados

### "Quero adicionar um campo no formulario de presenca"
→ Alterar o JSX do formulario em `LandingPage`
→ Alterar o estado (`useState`) correspondente
→ Alterar o endpoint `POST /api/rsvps` no backend
→ Alterar a tabela `rsvps` no banco (CREATE TABLE + ALTER TABLE)

### "Quero adicionar um countdown (contagem regressiva)"
→ Criar componente `Countdown` em `App.tsx`
→ Usar `setInterval` pra atualizar a cada segundo
→ Estilizar com CSS

### "Quero mudar o layout dos presentes"
→ Alterar o CSS de `.gifts` (grid) e `.gift` (cards)
→ Pode mudar colunas, espacamento, alinhamento

### "Quero adicionar musica de fundo"
→ Adicionar tag `<audio>` no JSX com `autoplay` e `loop`
→ Adicionar botao pra mutar/desmutar
→ Cuidado: navegadores bloqueiam autoplay sem interacao do usuario

### "Quero adicionar mais opcoes de presente"
→ Pode fazer pelo painel admin (aba Mimos)
→ Ou alterar `DEFAULT_GIFTS` no `backend/app.py` pra mudar os padroes

### "Quero mudar a senha do admin"
→ Alterar `ADMIN_PASSWORD` no `backend/app.py`

## Alteracoes comuns e como fazer

### Alterar dados do evento (nome, data, local, Pix)

Editar o objeto `CONFIG` no comeco de `frontend/src/App.tsx`.

### Alterar textos visiveis

Procurar o texto no `frontend/src/App.tsx` e alterar direto. Todos os textos estao nesse arquivo.

### Alterar cores/estilos

Os estilos estao na constante `css` no final de `frontend/src/App.tsx`, dentro de um template literal (crases). As variaveis de cor estao em `.page { --porcelana; --rose; --rosa-antigo; --dourado; --tinta; }`.

### Alterar presentes padrao

Os presentes que aparecem quando o banco e criado pela primeira vez estao em `DEFAULT_GIFTS` no `backend/app.py`. Depois que o banco ja existe, os presentes sao editados pelo painel admin.

### Adicionar funcionalidade no frontend

1. Criar o componente dentro de `App.tsx` (antes de `ChaDeBebe`)
2. Adicionar o estado necessario no componente pai
3. Renderizar no JSX
4. Adicionar estilos na constante `css`

### Adicionar rota no backend

1. Criar a funcao em `app.py`
2. Decorar com `@app.route(...)` 
3. Se for admin, adicionar `@_require_admin`
4. Usar `get_db()` pra acessar o banco
5. Retornar `jsonify(...)` ou `send_from_directory(...)`

### Adicionar coluna no banco

1. Alterar o `CREATE TABLE` em `get_db()` em `app.py`
2. Se o banco ja existir, adicionar `ALTER TABLE` logo abaixo (o CREATE TABLE tem `IF NOT EXISTS`)
3. Atualizar os endpoints que usam essa tabela

## Limitacoes do SQLite

- Nao suporta `ALTER COLUMN` — nao da pra renomear colunas
- Pra remover coluna, precisa recriar a tabela
- Tipos sao flexiveis (TEXT, INTEGER, REAL, BLOB, NULL)
- Primario autoincrement so com `INTEGER PRIMARY KEY AUTOINCREMENT`

## Erros comuns

- **"Module not found"**: rodar `pip install flask` ou `npm install`
- **"Port already in use"**: ja tem um servidor rodando, fechar a outra janela
- **Foto nao aparece**: verificar se o arquivo existe em `backend/data/gifts/`
- **Admin nao loga**: a senha e `admin123`, ou a que estiver em `ADMIN_PASSWORD` no `app.py`
- **Build falha**: rodar `cd frontend && npm install` antes de `npm run build`

## Deploy (futuro)

O site roda com Flask servindo os arquivos estaticos. Pra deploy:
1. `cd frontend && npm run build`
2. Copiar `frontend/dist/*` pra `backend/static/`
3. Rodar `backend/app.py` com gunicorn

Plataformas sugeridas: Render.com (gratuito), Railway.app, Fly.io
