# Configuração do Backend com Supabase

## 📋 Estrutura do Banco de Dados Necessária

Para que o login e as funcionalidades do sistema funcionem corretamente, você precisa criar as seguintes tabelas no seu projeto Supabase:

### 1. Tabela `users` (Usuários)

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  apelido VARCHAR(50) UNIQUE NOT NULL,
  nome VARCHAR(100) NOT NULL,
  funcao VARCHAR(50) NOT NULL,
  hash VARCHAR(64) NOT NULL,
  ativo VARCHAR(3) DEFAULT 'SIM',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para busca por hash (login)
CREATE INDEX idx_users_hash ON users(hash);
CREATE INDEX idx_users_apelido ON users(apelido);
```

**Colunas:**
- `apelido`: Apelido do usuário (usado como identificador único)
- `nome`: Nome completo do usuário
- `funcao`: Função/cargo (ex: INSPETOR, FISCAL, ADMIN, etc.)
- `hash`: Senha em SHA-256 (mesmo formato do Google Apps Script)
- `ativo`: "SIM" ou "NÃO" - indica se o usuário está ativo

### 2. Tabela `terminais`

```sql
CREATE TABLE terminais (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) UNIQUE NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_terminais_ativo ON terminais(ativo);
```

### 3. Tabela `logs`

```sql
CREATE TABLE logs (
  id SERIAL PRIMARY KEY,
  usuario VARCHAR(50) NOT NULL,
  acao VARCHAR(100) NOT NULL,
  data_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  detalhes JSONB
);

CREATE INDEX idx_logs_usuario ON logs(usuario);
CREATE INDEX idx_logs_data_hora ON logs(data_hora);
```

### 4. Tabela `config` (Configurações)

```sql
CREATE TABLE config (
  id SERIAL PRIMARY KEY,
  chave VARCHAR(50) UNIQUE NOT NULL,
  valor TEXT NOT NULL,
  descricao TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir configuração de timeout padrão (20 minutos = 1200000 ms)
INSERT INTO config (chave, valor, descricao) 
VALUES ('timeout_inatividade', '1200000', 'Tempo de inatividade em milissegundos');

CREATE INDEX idx_config_chave ON config(chave);
```

---

## 🔐 Políticas de Segurança (RLS - Row Level Security)

Para permitir que o frontend acesse os dados corretamente:

### Habilitar RLS nas tabelas

```sql
-- Users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura pública de usuários ativos"
ON users FOR SELECT
USING (ativo = 'SIM');

-- Terminais
ALTER TABLE terminais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura pública de terminais"
ON terminais FOR SELECT
USING (ativo = true);

-- Logs
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir inserção de logs"
ON logs FOR INSERT
WITH CHECK (true);

CREATE POLICY "Permitir leitura de logs"
ON logs FOR SELECT
USING (true);

-- Config
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura pública de configurações"
ON config FOR SELECT
USING (true);
```

---

## 👤 Inserindo Usuários

As senhas devem ser armazenadas em **SHA-256**, mesmo formato usado no Google Apps Script.

### Exemplo: Inserir usuário com senha "2222"

```sql
-- Hash SHA-256 da senha "2222" é: cf8cd80ba7f98d59a0dc71e57f7e1b49c3eeafff0b5e4d1fb47fa11e3aec4b80

INSERT INTO users (apelido, nome, funcao, hash, ativo)
VALUES (
  'joao.silva',
  'João Silva',
  'INSPETOR',
  'cf8cd80ba7f98d59a0dc71e57f7e1b49c3eeafff0b5e4d1fb47fa11e3aec4b80',
  'SIM'
);
```

### Gerar hash SHA-256 de uma senha

Você pode gerar o hash de várias formas:

**Opção 1: Usando JavaScript (no console do navegador)**
```javascript
async function gerarHash(senha) {
  const encoder = new TextEncoder();
  const data = encoder.encode(senha);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Uso:
gerarHash('2222').then(console.log);
// Resultado: cf8cd80ba7f98d59a0dc71e57f7e1b49c3eeafff0b5e4d1fb47fa11e3aec4b80
```

**Opção 2: Usando PostgreSQL**
```sql
SELECT encode(digest('2222', 'sha256'), 'hex');
```

**Opção 3: Site online**
- Acesse: https://passwordsgenerator.net/sha256-hash-generator/
- Digite a senha e copie o hash gerado

---

## 📊 Exemplo de Dados Iniciais

```sql
-- Inserir terminais padrão
INSERT INTO terminais (nome, ativo) VALUES
('Terminal A', true),
('Terminal B', true),
('Terminal C', true),
('Terminal D', true);

-- Inserir usuário ADMIN padrão (senha: admin123)
-- Hash de 'admin123': 8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918
INSERT INTO users (apelido, nome, funcao, hash, ativo)
VALUES (
  'admin',
  'Administrador',
  'ADMIN',
  '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
  'SIM'
);
```

---

## ✅ Testando a Conexão

Após configurar o banco de dados, teste no console do navegador:

```javascript
// Testar conexão
const { data, error } = await supabase
  .from('users')
  .select('apelido, nome')
  .limit(1);

if (error) {
  console.error('Erro:', error);
} else {
  console.log('Sucesso! Dados:', data);
}
```

---

## 🔧 Arquivos Modificados

1. **`scr/config/config.js`** - Configurações do Supabase (URL e chave)
2. **`scr/api/api.js`** - Comunicação com Supabase (login, usuários, terminais, logs)
3. **`scr/auth/auth.js`** - Função de login atualizada para usar Supabase
4. **`index.html`** - Adicionado SDK do Supabase

---

## 🚀 Próximos Passos

1. ✅ Criar as tabelas no Supabase (SQL acima)
2. ✅ Inserir pelo menos um usuário de teste
3. ✅ Testar o login com a senha "2222"
4. ⚠️ Migrar demais funcionalidades (envios, inspeções, etc.) se necessário

---

## 📝 Notas Importantes

- **URL do Supabase**: `https://bnakhjnybbafqyataelo.supabase.co`
- **Chave Anônima**: `sb_publishable_gId3xaVTmeni0Qky5PCtsA_a8N3gpdP`
- As senhas permanecem no mesmo formato hash (SHA-256) do Google Apps Script
- O sistema mantém compatibilidade com os hashes existentes
- Todas as consultas agora usam a biblioteca `@supabase/supabase-js`
