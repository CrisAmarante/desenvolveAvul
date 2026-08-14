# Configuração do Supabase para Login

## Visão Geral
O sistema foi atualizado para suportar autenticação via Supabase, mantendo o método antigo (Google Apps Script) como fallback.

## Passo a Passo para Configurar

### 1. Criar Projeto no Supabase
1. Acesse https://supabase.com
2. Crie uma nova organização/projeto
3. Anote a URL do projeto e a chave anon/public

### 2. Criar Tabela `inspetores`
No SQL Editor do Supabase, execute:

```sql
CREATE TABLE inspetores (
  id SERIAL PRIMARY KEY,
  apelido TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  funcao TEXT NOT NULL,
  hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  ativo TEXT DEFAULT 'SIM',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índice para busca por apelido
CREATE INDEX idx_inspetores_apelido ON inspetores(apelido);

-- Criar índice para filtro por ativo
CREATE INDEX idx_inspetores_ativo ON inspetores(ativo);

-- Policy para permitir leitura pública (necessário para login)
ALTER TABLE inspetores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura pública para login" 
ON inspetores FOR SELECT 
USING (true);
```

### 3. Migrar Dados dos Inspetores
Você precisa migrar os dados da planilha Google para o Supabase. Para cada inspetor:

1. Gere um salt único: `crypto.randomUUID()`
2. Calcule o hash: `await hashPassword(senha, salt)`
3. Insira no Supabase:

```sql
INSERT INTO inspetores (apelido, nome, funcao, hash, salt, ativo)
VALUES ('apelido', 'Nome Completo', 'FUNCAO', 'hash_calculado', 'salt_gerado', 'SIM');
```

### 4. Atualizar Configuração no Código
Edite o arquivo `scr/config/config.js`:

```javascript
const SUPABASE_URL = "https://SEU_PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "SUA_CHAVE_ANON";
```

### 5. Testar o Login
1. Abra a aplicação no navegador
2. Clique em "Área logada"
3. Digite o PIN de um inspetor cadastrado no Supabase
4. O sistema tentará autenticar via Supabase primeiro
5. Se falhar, usará o método antigo (Google Apps Script) como fallback

## Estrutura da Tabela

| Campo   | Tipo    | Descrição                          |
|---------|---------|------------------------------------|
| id      | SERIAL  | ID único (auto-incremento)         |
| apelido | TEXT    | Apelido do inspetor (único)        |
| nome    | TEXT    | Nome completo                      |
| funcao  | TEXT    | Função (INSPETOR, FISCAL, etc.)    |
| hash    | TEXT    | Hash da senha (SHA-256 + salt)     |
| salt    | TEXT    | Salt único para cada usuário       |
| ativo   | TEXT    | 'SIM' ou 'NÃO'                     |
| created_at | TIMESTAMP | Data de criação              |
| updated_at | TIMESTAMP | Data de atualização          |

## Script de Migração (Exemplo)

Se você tiver acesso aos dados atuais, pode usar este script Node.js para migrar:

```javascript
const crypto = require('crypto');

async function hashPassword(password, salt) {
  return crypto.createHash('sha256')
    .update(password + salt)
    .digest('hex');
}

// Para cada inspetor:
const salt = crypto.randomUUID();
const hash = await hashPassword('PIN_DO_INSPECTOR', salt);

// INSERT no Supabase com os valores calculados
```

## Troubleshooting

### Login não funciona
1. Verifique se o Supabase está inicializado (console.log deve mostrar "✅ Supabase inicializado")
2. Confira se a tabela `inspetores` existe e tem dados
3. Verifique as policies de RLS (Row Level Security)
4. Teste a conexão diretamente no navegador:
   ```javascript
   const { data, error } = await supabaseClient
     .from('inspetores')
     .select('apelido')
     .limit(1);
   console.log(data, error);
   ```

### Erro de CORS
Certifique-se de que a URL do seu projeto está correta e que o Supabase permite requisições do seu domínio.

### Performance
- A tabela deve ter índices nos campos `apelido` e `ativo`
- Considere adicionar cache local se houver muitos inspetores

## Rollback (Voltar ao Método Antigo)

Se precisar desativar o Supabase temporariamente:

1. Comente a linha do SDK no `index.html`:
   ```html
   <!-- <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> -->
   ```

2. O sistema automaticamente usará apenas o método Google Apps Script.
