// ====================================================================
// PAINEL DE ADMINISTRAÇÃO - Módulo independente
// ====================================================================

// Variáveis globais do módulo
let adminData = {
  usuarios: [],
  permissoes: {},
  perfis: [],
  modais: [],
  avisosComuns: [],
  avisosLogados: [],
  configPersonalizacao: {
    banner_fundo: null,
    banner_fundo_ativo: 'NÃO',
    btn_relatorios_estilo: 'normal',
    btn_inspecao_estilo: 'normal',
    btn_envio_estilo: 'normal',
    nome_sistema: 'PENSO'
  }
};

let modalEditando = null;

// ====================================================================
// INICIALIZAÇÃO (chamada apenas para ADMIN/GERENTE)
// ====================================================================
function inicializarAdmin() {
  const role = localStorage.getItem('inspectorRole');
  if (role === 'ADMIN' || role === 'GERENTE') {
    criarBotaoAdmin();
    carregarPersonalizacao();
    carregarAvisos();
  }
}

function criarBotaoAdmin() {
  if (document.getElementById('btn-admin-flutuante')) return;
  
  const btn = document.createElement('button');
  btn.id = 'btn-admin-flutuante';
  btn.className = 'btn-admin';
  btn.innerHTML = '<i class="fas fa-crown"></i>';
  btn.onclick = abrirModalAdmin;
  document.body.appendChild(btn);
}

// ====================================================================
// ABRIR/FECHAR MODAL ADMIN
// ====================================================================
function abrirModalAdmin() {
  let modal = document.getElementById('modal-admin-panel');
  if (!modal) {
    criarModalAdmin();
    modal = document.getElementById('modal-admin-panel');
  }
  modal.classList.add('is-open');
  carregarDadosAdmin();
}

function fecharModalAdmin() {
  const modal = document.getElementById('modal-admin-panel');
  if (modal) modal.classList.remove('is-open');
}

function criarModalAdmin() {
  const modalHtml = `
    <div id="modal-admin-panel" class="modal">
      <div class="modal-content admin-modal-content">
        <div class="modal-header">
          <h2 class="modal-title"><i class="fas fa-shield-alt"></i> Painel de Administração</h2>
          <button class="modal-close" onclick="fecharModalAdmin()">×</button>
        </div>
        <div id="admin-panel-conteudo"></div>
      </div>
    </div>
    <div id="modal-editar-botoes" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title" id="modal-botoes-titulo">Editar Botões</h2>
          <button class="modal-close" onclick="fecharModalEditarBotoes()">×</button>
        </div>
        <div id="editar-botoes-conteudo"></div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// ====================================================================
// CARREGAMENTO DE DADOS (JSONP)
// ====================================================================
function carregarDadosAdmin() {
  mostrarLoadingAdmin();
  carregarUsuariosAdmin();
  carregarPermissoesAdmin();
  carregarModaisAdmin();
  carregarListaAvisos();
  carregarPersonalizacao();
}

function mostrarLoadingAdmin() {
  const container = document.getElementById('admin-panel-conteudo');
  if (container) {
    container.innerHTML = '<div style="text-align:center; padding:40px;">⏳ Carregando dados...</div>';
  }
}

function carregarUsuariosAdmin() {
  const callbackName = 'carregarUsuariosCallback_' + Date.now();
  window[callbackName] = function(dados) {
    adminData.usuarios = dados;
    renderizarAdminPanel();
    delete window[callbackName];
  };
  const script = document.createElement('script');
  script.src = `${URL_PLANILHA}?acao=get_usuarios&callback=${callbackName}`;
  document.body.appendChild(script);
}

function carregarPermissoesAdmin() {
  const callbackName = 'carregarPermissoesCallback_' + Date.now();
  window[callbackName] = function(dados) {
    if (dados.perfis && dados.permissoes) {
      adminData.perfis = dados.perfis;
      adminData.permissoes = dados.permissoes;
    }
    renderizarAdminPanel();
    delete window[callbackName];
  };
  const script = document.createElement('script');
  script.src = `${URL_PLANILHA}?acao=get_permissoes&callback=${callbackName}`;
  document.body.appendChild(script);
}

function carregarModaisAdmin() {
  const callbackName = 'carregarModaisCallback_' + Date.now();
  window[callbackName] = function(dados) {
    adminData.modais = dados;
    renderizarAdminPanel();
    delete window[callbackName];
  };
  const script = document.createElement('script');
  script.src = `${URL_PLANILHA}?acao=get_modais&callback=${callbackName}`;
  document.body.appendChild(script);
}

function carregarListaAvisos() {
  const callbackName = 'carregarAvisosLista_' + Date.now();
  window[callbackName] = function(dados) {
    if (dados && !dados.erro) {
      adminData.avisosComuns = dados.comuns || [];
      adminData.avisosLogados = dados.logados || [];
      renderizarAdminPanel();
    }
    delete window[callbackName];
  };
  const script = document.createElement('script');
  script.src = `${URL_PLANILHA}?acao=get_avisos&perfil=ADMIN&callback=${callbackName}`;
  document.body.appendChild(script);
}

function carregarPersonalizacao() {
  const callbackName = 'carregarPersonalizacao_' + Date.now();
  window[callbackName] = function(dados) {
    if (dados && !dados.erro) {
      adminData.configPersonalizacao = { ...adminData.configPersonalizacao, ...dados };
      renderizarAdminPanel();
      aplicarPersonalizacaoPublica();
    }
    delete window[callbackName];
  };
  const script = document.createElement('script');
  script.src = `${URL_PLANILHA}?acao=get_personalizacao&callback=${callbackName}`;
  document.body.appendChild(script);
}

// ====================================================================
// RENDERIZAÇÃO DO PAINEL (TABS)
// ====================================================================
function renderizarAdminPanel() {
  const container = document.getElementById('admin-panel-conteudo');
  if (!container) return;
  
  const html = `
    <div class="admin-tabs">
      <button class="admin-tab active" data-tab="usuarios">👥 Usuários</button>
      <button class="admin-tab" data-tab="permissoes">🔐 Permissões</button>
      <button class="admin-tab" data-tab="modais">📋 Modais</button>
      <button class="admin-tab" data-tab="avisos">📢 Avisos</button>
      <button class="admin-tab" data-tab="personalizacao">🎨 Personalização</button>
    </div>
    <div class="admin-panel-body">
      <div id="tab-usuarios" class="tab-content">${renderizarTabUsuarios()}</div>
      <div id="tab-permissoes" class="tab-content" style="display:none;">${renderizarTabPermissoes()}</div>
      <div id="tab-modais" class="tab-content" style="display:none;">${renderizarTabModais()}</div>
      <div id="tab-avisos" class="tab-content" style="display:none;">${renderizarTabAvisos()}</div>
      <div id="tab-personalizacao" class="tab-content" style="display:none;">${renderizarTabPersonalizacao()}</div>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Eventos das abas
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabId = tab.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
      const tabContent = document.getElementById(`tab-${tabId}`);
      if (tabContent) tabContent.style.display = 'block';
    });
  });
}

function renderizarTabUsuarios() {
  const usuarios = adminData.usuarios || [];
  let html = `
    <div class="admin-form">
      <h4>➕ Novo Usuário</h4>
      <div class="form-row">
        <input type="text" id="novo-apelido" placeholder="Apelido" required>
        <input type="text" id="novo-nome" placeholder="Nome completo" required>
        <select id="nova-funcao">
          <option value="ADMIN">ADMIN</option><option value="GERENTE">GERENTE</option>
          <option value="FISCAL">FISCAL</option><option value="INSPETOR">INSPETOR</option>
          <option value="ENCARREGADO">ENCARREGADO</option>
          <option value="PLANTONISTA">PLANTONISTA</option><option value="SAF">SAF</option>
        </select>
        <input type="password" id="nova-senha" placeholder="Senha (PIN)">
        <button class="btn-salvar" onclick="window.criarUsuario()">Criar</button>
      </div>
    </div>
    <table class="admin-table"><thead><tr><th>Apelido</th><th>Nome</th><th>Função</th><th>Status</th><th>Ações</th></tr></thead><tbody>
  `;
  usuarios.forEach(user => {
    html += `<tr>
      <td>${user.apelido}</td><td>${user.nome || '-'}</td><td>${user.funcao || '-'}</td>
      <td><span style="color: ${user.ativo === 'SIM' ? '#10b981' : '#ef4444'}">${user.ativo === 'SIM' ? '✅ Ativo' : '❌ Inativo'}</span></td>
      <td>
        <button class="btn-editar" onclick="window.editarUsuario('${user.apelido}')">✏️</button>
        <button class="btn-excluir" onclick="window.excluirUsuario('${user.apelido}')">🗑️</button>
        <button class="btn-salvar" onclick="window.toggleUsuarioStatus('${user.apelido}', '${user.ativo === 'SIM' ? 'NÃO' : 'SIM'}')">
          ${user.ativo === 'SIM' ? '🔴 Desativar' : '🟢 Ativar'}
        </button>
      </td>
    </tr>`;
  });
  html += `</tbody></table>`;
  return html;
}

function renderizarTabPermissoes() {
  const permissoes = adminData.permissoes || {};
  const perfis = adminData.perfis || [];
  let html = `<div class="permissoes-grid">`;
  for (const [func, perfisPerm] of Object.entries(permissoes)) {
    html += `<div class="perm-item"><div class="perm-func">${func}</div><div class="perm-perfis">`;
    for (const perfil of perfis) {
      const checked = perfisPerm[perfil] === true;
      html += `<label class="perm-perfil"><input type="checkbox" data-func="${func}" data-perfil="${perfil}" ${checked ? 'checked' : ''} onchange="window.atualizarPermissao(this)"><span>${perfil}</span></label>`;
    }
    html += `</div></div>`;
  }
  html += `</div>`;
  return html;
}

function renderizarTabModais() {
  const modais = adminData.modais || [];
  let html = `
    <div class="admin-form">
      <h4>➕ Novo Modal</h4>
      <div class="form-row">
        <input type="text" id="novo-modal-id" placeholder="ID do Modal" required>
        <input type="text" id="novo-modal-titulo" placeholder="Título" required>
        <button class="btn-salvar" onclick="window.criarModal()">Criar Modal</button>
      </div>
    </div>
    <table class="admin-table"><thead><tr><th>ID</th><th>Título</th><th>Status</th><th>Botões</th><th>Ações</th></tr></thead><tbody>
  `;
  modais.forEach(modal => {
    let botoesHtml = modal.botoes?.map(b => b.nome).join(', ') || '-';
    html += `<tr>
      <td>${modal.id}</td><td>${modal.titulo}</td>
      <td><span style="color: ${modal.ativo === 'SIM' ? '#10b981' : '#ef4444'}">${modal.ativo === 'SIM' ? '✅ Ativo' : '❌ Inativo'}</span></td>
      <td>${botoesHtml}</td>
      <td>
        <button class="btn-editar" onclick="window.editarModal('${modal.id}')">✏️ Editar Botões</button>
        <button class="btn-salvar" onclick="window.toggleModalStatus('${modal.id}', '${modal.ativo === 'SIM' ? 'NÃO' : 'SIM'}')">
          ${modal.ativo === 'SIM' ? '🔴 Desativar' : '🟢 Ativar'}
        </button>
      </td>
    </tr>`;
  });
  html += `</tbody></table>`;
  return html;
}

function renderizarTabAvisos() {
  return `
    <div class="admin-form">
      <h4>➕ Novo Aviso</h4>
      <div class="form-row">
        <input type="text" id="novo-aviso-titulo" placeholder="Título" style="flex:2;">
        <input type="text" id="novo-aviso-mensagem" placeholder="Mensagem" style="flex:3;">
        <select id="novo-aviso-perfil"><option value="TODOS">Todos</option><option value="FISCAL">FISCAL</option><option value="INSPETOR">INSPETOR</option><option value="ENCARREGADO">ENCARREGADO</option><option value="ADMIN">ADMIN</option><option value="GERENTE">GERENTE</option><option value="SAF">SAF</option><option value="PLANTONISTA">PLANTONISTA</option></select>
        <select id="novo-aviso-local"><option value="comum">Área comum</option><option value="logado">Área logada</option></select>
      </div>
      <div class="form-row">
        <input type="date" id="novo-aviso-data-inicio"><input type="date" id="novo-aviso-data-fim">
        <input type="color" id="novo-aviso-cor-fundo" value="#fff3cd"><input type="color" id="novo-aviso-cor-texto" value="#856404">
      </div>
      <button class="btn-salvar" onclick="window.criarAviso()">Criar Aviso</button>
    </div>
    <table class="admin-table"><thead><tr><th>Título</th><th>Mensagem</th><th>Perfil</th><th>Local</th><th>Validade</th><th>Status</th><th>Ações</th></tr></thead><tbody id="lista-avisos-tbody"></tbody></table>
  `;
}

function renderizarTabPersonalizacao() {
  const cfg = adminData.configPersonalizacao;
  return `
    <div class="admin-form">
      <h4>🎨 Personalização da Aplicação</h4>
      <div class="form-row">
        <label>Imagem de fundo (URL do Drive):</label>
        <input type="text" id="personalizacao-banner" value="${cfg.banner_fundo || ''}">
        <label><input type="checkbox" id="personalizacao-banner-ativo" ${cfg.banner_fundo_ativo === 'SIM' ? 'checked' : ''}> Usar imagem personalizada</label>
      </div>
      <div class="form-row">
        <label>Nome do sistema:</label>
        <input type="text" id="personalizacao-nome" value="${cfg.nome_sistema || 'PENSO'}">
      </div>
      <div class="form-row">
        <label>Estilo botão relatórios:</label>
        <select id="personalizacao-btn-relatorios"><option value="normal" ${cfg.btn_relatorios_estilo === 'normal' ? 'selected' : ''}>Normal</option><option value="destaque" ${cfg.btn_relatorios_estilo === 'destaque' ? 'selected' : ''}>Destaque</option></select>
        <label>Estilo botão inspeção:</label>
        <select id="personalizacao-btn-inspecao"><option value="normal" ${cfg.btn_inspecao_estilo === 'normal' ? 'selected' : ''}>Normal</option><option value="destaque" ${cfg.btn_inspecao_estilo === 'destaque' ? 'selected' : ''}>Destaque</option></select>
      </div>
      <button class="btn-salvar" onclick="window.salvarPersonalizacao()">💾 Salvar Personalização</button>
    </div>
  `;
}

// ====================================================================
// FUNÇÕES CRUD (expostas globalmente)
// ====================================================================
window.criarUsuario = function() {
  const apelido = document.getElementById('novo-apelido')?.value.trim();
  const nome = document.getElementById('novo-nome')?.value.trim();
  const funcao = document.getElementById('nova-funcao')?.value;
  const senha = document.getElementById('nova-senha')?.value;
  if (!apelido || !nome || !senha) return alert('Preencha todos os campos');
  enviarAdminAction('salvar_usuario', { usuario: { apelido, nome, funcao, senha, ativo: 'SIM' }, acao: 'criar' });
};

window.editarUsuario = function(apelido) {
  const user = adminData.usuarios.find(u => u.apelido === apelido);
  if (!user) return;
  const novaSenha = prompt(`Editar ${apelido}\nDeixe em branco para manter a senha:`, '');
  if (novaSenha === null) return;
  const novoNome = prompt('Nome:', user.nome) || user.nome;
  const novaFuncao = prompt('Função:', user.funcao) || user.funcao;
  enviarAdminAction('salvar_usuario', { usuario: { apelido, nome: novoNome, funcao: novaFuncao, senha: novaSenha || null, ativo: user.ativo }, acao: 'editar' });
};

window.excluirUsuario = function(apelido) {
  if (confirm(`Excluir ${apelido}?`)) enviarAdminAction('salvar_usuario', { usuario: { apelido }, acao: 'excluir' });
};

window.toggleUsuarioStatus = function(apelido, novoStatus) {
  const user = adminData.usuarios.find(u => u.apelido === apelido);
  if (user) enviarAdminAction('salvar_usuario', { usuario: { apelido, nome: user.nome, funcao: user.funcao, ativo: novoStatus }, acao: 'editar' });
};

window.atualizarPermissao = function(checkbox) {
  enviarAdminAction('atualizar_permissao', { funcionalidade: checkbox.dataset.func, perfil: checkbox.dataset.perfil, valor: checkbox.checked });
};

window.criarModal = function() {
  const id = document.getElementById('novo-modal-id')?.value.trim();
  const titulo = document.getElementById('novo-modal-titulo')?.value.trim();
  if (!id || !titulo) return alert('Preencha ID e Título');
  enviarAdminAction('salvar_modal', { modal: { id, titulo, ativo: 'SIM', botoes: [] }, acao: 'criar' });
};

window.editarModal = function(modalId) {
  const modal = adminData.modais.find(m => m.id === modalId);
  if (modal) abrirEditorBotoes(modal);
};

window.toggleModalStatus = function(modalId, novoStatus) {
  enviarAdminAction('salvar_modal', { modal: { id: modalId, ativo: novoStatus, botoes: [] }, acao: 'editar' });
};

window.criarAviso = function() {
  const titulo = document.getElementById('novo-aviso-titulo')?.value.trim();
  const mensagem = document.getElementById('novo-aviso-mensagem')?.value.trim();
  const perfil_destino = document.getElementById('novo-aviso-perfil')?.value;
  const local = document.getElementById('novo-aviso-local')?.value;
  const data_inicio = document.getElementById('novo-aviso-data-inicio')?.value;
  const data_fim = document.getElementById('novo-aviso-data-fim')?.value;
  const cor_fundo = document.getElementById('novo-aviso-cor-fundo')?.value;
  const cor_texto = document.getElementById('novo-aviso-cor-texto')?.value;
  if (!titulo || !mensagem) return alert('Preencha título e mensagem');
  enviarAdminAction('salvar_aviso', { aviso: { titulo, mensagem, perfil_destino, local, data_inicio, data_fim, cor_fundo, cor_texto, ativo: 'SIM' }, acao: 'criar' });
};

window.salvarPersonalizacao = function() {
  const personalizacao = {
    banner_fundo: document.getElementById('personalizacao-banner')?.value,
    banner_fundo_ativo: document.getElementById('personalizacao-banner-ativo')?.checked ? 'SIM' : 'NÃO',
    nome_sistema: document.getElementById('personalizacao-nome')?.value,
    btn_relatorios_estilo: document.getElementById('personalizacao-btn-relatorios')?.value,
    btn_inspecao_estilo: document.getElementById('personalizacao-btn-inspecao')?.value
  };
  enviarAdminAction('salvar_personalizacao', { personalizacao });
};

// Editor de botões
function abrirEditorBotoes(modal) {
  const modalEditor = document.getElementById('modal-editar-botoes');
  const container = document.getElementById('editar-botoes-conteudo');
  if (!modalEditor || !container) return;
  document.getElementById('modal-botoes-titulo').textContent = `Editar Botões - ${modal.titulo}`;
  
  let html = `<div style="padding:20px;"><div id="lista-botoes-editor">`;
  if (modal.botoes && modal.botoes.length) {
    modal.botoes.forEach((botao, idx) => {
      html += `<div class="admin-form" data-idx="${idx}"><div class="form-row">
        <input type="text" value="${botao.nome}" placeholder="Nome" class="botao-nome-${idx}" style="flex:2;">
        <input type="text" value="${botao.url}" placeholder="URL" class="botao-url-${idx}" style="flex:3;">
        <input type="text" value="${botao.icone || 'fa-link'}" placeholder="Ícone" class="botao-icone-${idx}" style="flex:1;">
        <button class="btn-excluir" onclick="window.removerBotaoEditor(${idx})">❌</button>
      </div></div>`;
    });
  }
  html += `</div><button class="btn-secundario" onclick="window.adicionarBotaoEditor()">+ Adicionar Botão</button>
    <div class="form-row" style="margin-top:20px;"><button class="btn-principal" onclick="window.salvarBotoesEditor('${modal.id}')">💾 Salvar</button>
    <button class="btn-secundario" onclick="fecharModalEditarBotoes()">Cancelar</button></div></div>`;
  container.innerHTML = html;
  modalEditor.classList.add('is-open');
  window.modalEditando = modal;
}

window.adicionarBotaoEditor = function() {
  const container = document.getElementById('lista-botoes-editor');
  const idx = Date.now();
  container.insertAdjacentHTML('beforeend', `<div class="admin-form" data-idx="${idx}"><div class="form-row">
    <input type="text" placeholder="Nome" class="botao-nome-${idx}" style="flex:2;">
    <input type="text" placeholder="URL" class="botao-url-${idx}" style="flex:3;">
    <input type="text" placeholder="Ícone" class="botao-icone-${idx}" style="flex:1;" value="fa-link">
    <button class="btn-excluir" onclick="window.removerBotaoEditor(${idx})">❌</button>
  </div></div>`);
};

window.removerBotaoEditor = function(idx) {
  const el = document.querySelector(`[data-idx="${idx}"]`);
  if (el) el.remove();
};

window.salvarBotoesEditor = function(modalId) {
  const botoes = [];
  document.querySelectorAll('#lista-botoes-editor .admin-form').forEach(container => {
    const idx = container.dataset.idx;
    const nome = document.querySelector(`.botao-nome-${idx}`)?.value.trim();
    const url = document.querySelector(`.botao-url-${idx}`)?.value.trim();
    const icone = document.querySelector(`.botao-icone-${idx}`)?.value.trim() || 'fa-link';
    if (nome && url) botoes.push({ nome, url, icone });
  });
  if (!botoes.length) return alert('Adicione pelo menos um botão');
  enviarAdminAction('salvar_modal', { modal: { id: modalId, titulo: window.modalEditando?.titulo, ativo: 'SIM', botoes }, acao: 'editar' });
  fecharModalEditarBotoes();
};

function fecharModalEditarBotoes() {
  const modal = document.getElementById('modal-editar-botoes');
  if (modal) modal.classList.remove('is-open');
}

function enviarAdminAction(acao, dados) {
  const callbackName = 'adminActionCallback_' + Date.now();
  window[callbackName] = function(resposta) {
    if (resposta.sucesso) { alert('✅ Operação realizada!'); carregarDadosAdmin(); }
    else alert('❌ Erro: ' + (resposta.erro || 'Falha'));
    delete window[callbackName];
  };
  const params = new URLSearchParams();
  params.append('acao', acao);
  params.append('dados', JSON.stringify(dados));
  params.append('callback', callbackName);
  params.append('usuario', localStorage.getItem('inspectorApelido') || 'admin');
  const script = document.createElement('script');
  script.src = `${URL_PLANILHA}?${params.toString()}`;
  script.onerror = () => { delete window[callbackName]; alert('Erro de conexão'); };
  document.body.appendChild(script);
}

// ====================================================================
// FUNÇÕES PÚBLICAS PARA APLICAÇÃO (avisos e personalização)
// ====================================================================
function aplicarPersonalizacaoPublica() {
  const cfg = adminData.configPersonalizacao;
  if (cfg.banner_fundo_ativo === 'SIM' && cfg.banner_fundo) {
    document.body.classList.add('custom-bg');
    document.body.style.setProperty('--custom-bg-image', `url('${cfg.banner_fundo}')`);
  } else {
    document.body.classList.remove('custom-bg');
  }
  const titulo = document.querySelector('.titulo');
  if (titulo && cfg.nome_sistema) {
    titulo.innerHTML = `<i class="fas fa-clipboard-list"></i> ${cfg.nome_sistema} - Prancheta Eletrônica`;
  }
  const btnRelatorios = document.querySelector('.card-relatorio');
  if (btnRelatorios) {
    if (cfg.btn_relatorios_estilo === 'destaque') btnRelatorios.classList.add('btn-destaque-card');
    else btnRelatorios.classList.remove('btn-destaque-card');
  }
}

function carregarAvisosPublicos() {
  const callbackName = 'carregarAvisosPublicos_' + Date.now();
  const hoje = new Date().toISOString().split('T')[0];
  const perfil = localStorage.getItem('inspectorRole') || 'TODOS';
  window[callbackName] = function(dados) {
    if (dados && !dados.erro) exibirAvisosPublicos(dados, perfil);
    delete window[callbackName];
  };
  const script = document.createElement('script');
  script.src = `${URL_PLANILHA}?acao=get_avisos&perfil=${perfil}&data=${hoje}&callback=${callbackName}`;
  document.body.appendChild(script);
}

function exibirAvisosPublicos(dados, perfil) {
  const containerComum = document.getElementById('aviso-comum-container');
  const containerLogado = document.getElementById('aviso-logado-container');
  if (containerComum) {
    const avisosComuns = (dados.comuns || []).filter(a => a.perfil_destino === 'TODOS' || a.perfil_destino === perfil);
    containerComum.innerHTML = avisosComuns.map(aviso => `
      <div class="aviso-comum" style="background: ${aviso.cor_fundo}; color: ${aviso.cor_texto};">
        <div><strong>${aviso.titulo}</strong><br>${aviso.mensagem}</div>
        <button class="fechar-aviso" onclick="this.parentElement.remove()">×</button>
      </div>
    `).join('');
  }
  if (containerLogado && perfil !== 'TODOS') {
    const avisosLogados = (dados.logados || []).filter(a => a.perfil_destino === 'TODOS' || a.perfil_destino === perfil);
    containerLogado.innerHTML = avisosLogados.map(aviso => `
      <div class="aviso-logado" style="border-left-color: var(--accent)">
        <div class="aviso-titulo">📢 ${aviso.titulo}</div>
        <div class="aviso-mensagem">${aviso.mensagem}</div>
      </div>
    `).join('');
  }
}

// Exporta funções necessárias para uso global
window.inicializarAdmin = inicializarAdmin;
window.fecharModalAdmin = fecharModalAdmin;
window.carregarAvisosPublicos = carregarAvisosPublicos;
window.aplicarPersonalizacaoPublica = aplicarPersonalizacaoPublica;