/**
 * Utilitários básicos da aplicação
 */

// ====================================================================
// UTILITÁRIOS DE DOM
// ====================================================================
function getEl(id) { 
  return document.getElementById(id); 
}

function logDebug(...args) { 
  console.log('[PENSO]', ...args); 
}

// ====================================================================
// HASH - Criptografia de senha
// ====================================================================
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ====================================================================
// MODAL CONTROLLER
// ====================================================================
class ModalController {
  constructor(modalId) {
    this.modal = getEl(modalId);
    if (!this.modal) return;
    this.content = this.modal.querySelector('.modal-content');
    this.isOpen = false;
    this.handleBackgroundClick = this.handleBackgroundClick.bind(this);
    this.handleEsc = this.handleEsc.bind(this);
  }

  open() {
    if (!this.modal || this.isOpen) return;
    this.modal.classList.add('is-open');
    document.body.classList.add('no-scroll');
    this.isOpen = true;
    this.modal.addEventListener('click', this.handleBackgroundClick);
    document.addEventListener('keydown', this.handleEsc);
    const firstFocusable = this.modal.querySelector('input, button, a, select, textarea');
    if (firstFocusable) firstFocusable.focus();
  }

  close() {
    if (!this.modal || !this.isOpen) return;
    this.modal.classList.add('is-closing');
    setTimeout(() => {
      this.modal.classList.remove('is-open', 'is-closing');
      document.body.classList.remove('no-scroll');
      this.isOpen = false;
      this.modal.removeEventListener('click', this.handleBackgroundClick);
      document.removeEventListener('keydown', this.handleEsc);
    }, 220);
  }

  handleBackgroundClick(e) { 
    if (e.target === this.modal) this.close(); 
  }

  handleEsc(e) { 
    if (e.key === 'Escape') this.close(); 
  }
}

// ====================================================================
// FORMATAÇÃO DE DATA E HORA
// ====================================================================
/**
 * Formata uma data para DD/MM/YYYY, corrigindo problemas de fuso horário.
 * - Se for string ISO (YYYY-MM-DD), extrai diretamente.
 * - Se for objeto Date, usa getDate, getMonth, getFullYear (fuso local).
 * - Caso contrário, tenta extrair uma data no formato dd/mm/aaaa.
 */
function formatarData(data) {
  if (!data) return 'N/I';

  // Caso seja string ISO (YYYY-MM-DD)
  if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}/.test(data)) {
    const partes = data.split('-');
    // Pode vir com hora "YYYY-MM-DD HH:mm:ss"
    const dia = partes[2].substring(0, 2);
    return `${dia}/${partes[1]}/${partes[0]}`;
  }

  // Caso seja objeto Date
  if (data instanceof Date) {
    const dia = data.getDate().toString().padStart(2, '0');
    const mes = (data.getMonth() + 1).toString().padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  // Tentar extrair via regex
  const match = String(data).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) return match[0];

  return 'N/I';
}

function formatarHora(hora) {
  if (!hora) return 'N/I';
  
  if (hora instanceof Date) {
    const horas = hora.getHours().toString().padStart(2, '0');
    const minutos = hora.getMinutes().toString().padStart(2, '0');
    return `${horas}:${minutos}`;
  }
  
  if (typeof hora === 'string') {
    if (hora.includes('T')) {
      const match = hora.match(/T(\d{2}):(\d{2})/);
      if (match) return `${match[1]}:${match[2]}`;
    }
    if (hora.match(/^\d{2}:\d{2}/)) return hora;
  }
  
  return 'N/I';
}

// Exportar para escopo global
window.getEl = getEl;
window.formatarData = formatarData;
window.formatarHora = formatarHora;
window.ModalController = ModalController;
window.hashPassword = hashPassword;
window.logDebug = logDebug;
