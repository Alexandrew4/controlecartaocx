// ==========================================
// ESTADO GLOBAL & INICIALIZAÇÃO
// ==========================================
let compras = JSON.parse(localStorage.getItem('compras_cartao')) || [];
let diaVencimento = parseInt(localStorage.getItem('dia_vencimento')) || 10;
let limiteMensal = parseFloat(localStorage.getItem('limite_mensal')) || 2000;
let meuGrafico = null; // Instância do Chart.js

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('data-compra').valueAsDate = new Date();
  
  const inputVencimento = document.getElementById('dia-vencimento');
  const inputLimite = document.getElementById('limite-mensal');

  if (inputVencimento) inputVencimento.value = diaVencimento;
  if (inputLimite) inputLimite.value = limiteMensal;

  if (inputVencimento) {
    inputVencimento.addEventListener('input', (e) => {
      diaVencimento = parseInt(e.target.value) || 10;
      localStorage.setItem('dia_vencimento', diaVencimento);
      renderizarFaturas();
    });
  }

  if (inputLimite) {
    inputLimite.addEventListener('input', (e) => {
      limiteMensal = parseFloat(e.target.value) || 2000;
      localStorage.setItem('limite_mensal', limiteMensal);
      renderizarFaturas();
    });
  }

  const btnExportar = document.getElementById('btn-exportar-json');
  const inputImportar = document.getElementById('input-importar-json');

  if (btnExportar) btnExportar.addEventListener('click', exportarJSON);
  if (inputImportar) inputImportar.addEventListener('change', importarJSON);

  // LISTENERS DO MODAL DE EDIÇÃO
  const formEditarCompra = document.getElementById('form-editar-compra');
  if (formEditarCompra) {
    formEditarCompra.addEventListener('submit', salvarEdicaoCompra);
  }

  const btnCancelarEdicao = document.getElementById('btn-cancelar-edicao');
  if (btnCancelarEdicao) {
    btnCancelarEdicao.addEventListener('click', fecharModalEdicao);
  }

  atualizarDatalistCartoes();
  renderizarFaturas();
});

// ==========================================
// EXTRAÇÃO DE DADOS DA MENSAGEM (SMS / NOTIFICAÇÃO)
// ==========================================
const btnExtrair = document.getElementById('btn-extrair');
if (btnExtrair) {
  btnExtrair.addEventListener('click', () => {
    const texto = document.getElementById('texto-importacao').value.trim();

    if (!texto) {
      alert('Cole o texto da notificação primeiro.');
      return;
    }

    // Extrair Valor
    const regexValor = /(?:R\$\s*|valor\s*)([\d\.]+,\d{2}|\d+[\.,]\d+)/i;
    const matchValor = texto.match(regexValor);
    if (matchValor) {
      const valorTratado = matchValor[1].replace(/\./g, '').replace(',', '.');
      document.getElementById('valor-total').value = parseFloat(valorTratado);
    }

    // Extrair Parcelas
    const regexParcelas = /(\d+)\s*(?:x|vezes)/i;
    const matchParcelas = texto.match(regexParcelas);
    if (matchParcelas) {
      document.getElementById('total-parcelas').value = parseInt(matchParcelas[1], 10);
    } else {
      document.getElementById('total-parcelas').value = 1;
    }

    // Extrair Cartão
    const regexCartaoFinal = /(?:final|\*+)\s*(\d{4})/i;
    const matchCartaoFinal = texto.match(regexCartaoFinal);
    if (matchCartaoFinal) {
      document.getElementById('cartao').value = matchCartaoFinal[1];
    }

    // Extrair Estabelecimento
    const regexLocal = /(?:em|no|na)\s+([A-Z0-9\s]{3,25})/i;
    const matchLocal = texto.match(regexLocal);
    if (matchLocal) {
      let nomeLimpo = matchLocal[1].split(/R\$|valor|\d{2}\/\d{2}/i)[0].trim();
      document.getElementById('estabelecimento').value = nomeLimpo;
    }

    alert('Dados extraídos! Confira os campos antes de salvar.');
  });
}

// ==========================================
// CADASTRO DE COMPRA E PERSISTÊNCIA
// ==========================================
const formCompra = document.getElementById('form-compra');
if (formCompra) {
  formCompra.addEventListener('submit', (e) => {
    e.preventDefault();

    const estabelecimento = document.getElementById('estabelecimento').value.trim();
    const cartao = document.getElementById('cartao').value.trim();
    const valorTotal = parseFloat(document.getElementById('valor-total').value);
    const totalParcelas = parseInt(document.getElementById('total-parcelas').value, 10);
    const dataCompra = document.getElementById('data-compra').value;
    const isRecorrente = document.getElementById('compra-recorrente') ? document.getElementById('compra-recorrente').checked : false;

    if (!estabelecimento || !cartao || isNaN(valorTotal) || !dataCompra) {
      alert('Preencha todos os campos corretamente.');
      return;
    }

    const novaCompra = {
      id: Date.now(),
      grupoRecorrenciaId: isRecorrente ? 'rec_' + Date.now() : null,
      recorrente: isRecorrente,
      estabelecimento,
      cartao,
      valorTotal,
      totalParcelas: isRecorrente ? 1 : (totalParcelas || 1),
      dataCompra
    };

    compras.push(novaCompra);
    salvarECarregar();

    e.target.reset();
    document.getElementById('texto-importacao').value = '';
    document.getElementById('data-compra').valueAsDate = new Date();
    document.getElementById('total-parcelas').value = 1;
    if (document.getElementById('compra-recorrente')) {
      document.getElementById('compra-recorrente').checked = false;
    }
  });
}

function salvarECarregar() {
  localStorage.setItem('compras_cartao', JSON.stringify(compras));
  atualizarDatalistCartoes();
  renderizarFaturas();
}

function excluirCompra(id, grupoRecorrenciaId = null) {
  if (grupoRecorrenciaId) {
    const opcao = confirm(
      "Esta é uma compra recorrente.\n\n" +
      "Clique [OK] para excluir TODAS as recorrências deste serviço.\n" +
      "Clique [Cancelar] para remover apenas esta transação."
    );

    if (opcao) {
      compras = compras.filter(c => c.grupoRecorrenciaId !== grupoRecorrenciaId);
    } else {
      compras = compras.filter(c => c.id !== id);
    }
  } else {
    if (confirm('Deseja remover esta compra?')) {
      compras = compras.filter(c => c.id !== id);
    }
  }
  salvarECarregar();
}

// ==========================================
// MÓDULO DE EDIÇÃO / ALTERAÇÃO DE REGISTRO
// ==========================================
function abrirModalEdicao(id) {
  const compra = compras.find(c => c.id === id);
  if (!compra) return;

  document.getElementById('edit-id').value = compra.id;
  document.getElementById('edit-estabelecimento').value = compra.estabelecimento;
  document.getElementById('edit-cartao').value = compra.cartao;
  document.getElementById('edit-valor-total').value = compra.valorTotal;
  document.getElementById('edit-total-parcelas').value = compra.totalParcelas;
  document.getElementById('edit-data-compra').value = compra.dataCompra;

  const modal = document.getElementById('modal-edicao');
  if (modal) modal.style.display = 'flex';
}

function fecharModalEdicao() {
  const modal = document.getElementById('modal-edicao');
  if (modal) modal.style.display = 'none';
}

function salvarEdicaoCompra(e) {
  e.preventDefault();

  const id = parseInt(document.getElementById('edit-id').value, 10);
  const index = compras.findIndex(c => c.id === id);

  if (index === -1) {
    alert('Registro não encontrado.');
    return;
  }

  const estabelecimento = document.getElementById('edit-estabelecimento').value.trim();
  const cartao = document.getElementById('edit-cartao').value.trim();
  const valorTotal = parseFloat(document.getElementById('edit-valor-total').value);
  const totalParcelas = parseInt(document.getElementById('edit-total-parcelas').value, 10);
  const dataCompra = document.getElementById('edit-data-compra').value;

  if (!estabelecimento || !cartao || isNaN(valorTotal) || !dataCompra) {
    alert('Preencha todos os campos corretamente.');
    return;
  }

  compras[index].estabelecimento = estabelecimento;
  compras[index].cartao = cartao;
  compras[index].valorTotal = valorTotal;
  compras[index].totalParcelas = compras[index].recorrente ? 1 : (totalParcelas || 1);
  compras[index].dataCompra = dataCompra;

  salvarECarregar();
  fecharModalEdicao();
}

function atualizarDatalistCartoes() {
  const datalist = document.getElementById('lista-cartoes');
  if (!datalist) return;
  const cartoesUnicos = [...new Set(compras.map(c => c.cartao))];
  datalist.innerHTML = cartoesUnicos.map(c => `<option value="${c}">`).join('');
}

// ==========================================
// BACKUP (EXPORTAR / IMPORTAR JSON)
// ==========================================
function exportarJSON() {
  const dados = { diaVencimento, limiteMensal, compras };
  const jsonStr = JSON.stringify(dados, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `backup_faturas_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function importarJSON(evento) {
  const arquivo = evento.target.files[0];
  if (!arquivo) return;

  const leitor = new FileReader();
  leitor.onload = function(e) {
    try {
      const dados = JSON.parse(e.target.result);
      if (dados.compras && Array.isArray(dados.compras)) {
        compras = dados.compras;
        if (dados.diaVencimento) diaVencimento = dados.diaVencimento;
        if (dados.limiteMensal) limiteMensal = dados.limiteMensal;

        if (document.getElementById('dia-vencimento')) document.getElementById('dia-vencimento').value = diaVencimento;
        if (document.getElementById('limite-mensal')) document.getElementById('limite-mensal').value = limiteMensal;

        localStorage.setItem('dia_vencimento', diaVencimento);
        localStorage.setItem('limite_mensal', limiteMensal);
        salvarECarregar();

        alert('Backup importado com sucesso!');
      } else {
        alert('Formato de arquivo JSON inválido.');
      }
    } catch (erro) {
      alert('Erro ao ler o arquivo JSON: ' + erro.message);
    }
  };

  leitor.readAsText(arquivo);
  evento.target.value = '';
}

// ==========================================
// CÁLCULOS
// ==========================================
function calcularFaturas() {
  const faturas = {};
  const diaFechamento = Math.max(1, diaVencimento - 7);

  compras.forEach(compra => {
    const [anoStr, mesStr, diaStr] = compra.dataCompra.split('-');
    let ano = parseInt(anoStr, 10);
    let mes = parseInt(mesStr, 10) - 1;
    let dia = parseInt(diaStr, 10);

    if (dia >= diaFechamento) {
      mes += 1;
    }

    const ciclos = compra.recorrente ? 6 : compra.totalParcelas;
    const valorParcela = compra.valorTotal / (compra.recorrente ? 1 : compra.totalParcelas);

    for (let i = 0; i < ciclos; i++) {
      const dataParcela = new Date(ano, mes + i, 1);
      const chaveMesAno = `${dataParcela.getFullYear()}-${String(dataParcela.getMonth() + 1).padStart(2, '0')}`;

      if (!faturas[chaveMesAno]) {
        faturas[chaveMesAno] = { mesAno: chaveMesAno, total: 0, cartoes: {} };
      }

      if (!faturas[chaveMesAno].cartoes[compra.cartao]) {
        faturas[chaveMesAno].cartoes[compra.cartao] = { subtotal: 0, itens: [] };
      }

      faturas[chaveMesAno].total += valorParcela;
      faturas[chaveMesAno].cartoes[compra.cartao].subtotal += valorParcela;
      faturas[chaveMesAno].cartoes[compra.cartao].itens.push({
        idCompra: compra.id,
        grupoRecorrenciaId: compra.grupoRecorrenciaId || null,
        recorrente: compra.recorrente || false,
        estabelecimento: compra.estabelecimento,
        valorParcela: valorParcela,
        parcelaAtual: i + 1,
        totalParcelas: ciclos
      });
    }
  });

  return faturas;
}

// ==========================================
// RENDERIZAÇÃO DO GRÁFICO (PROJEÇÃO 6 MESES)
// ==========================================
function renderizarGraficoProjecao(faturas) {
  const canvas = document.getElementById('grafico-faturas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const labels = [];
  const valores = [];
  const hoje = new Date();

  for (let i = 0; i < 6; i++) {
    const dataMes = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const chave = `${dataMes.getFullYear()}-${String(dataMes.getMonth() + 1).padStart(2, '0')}`;

    labels.push(`${mesesNomes[dataMes.getMonth()]}/${String(dataMes.getFullYear()).slice(-2)}`);
    valores.push(faturas[chave] ? faturas[chave].total : 0);
  }

  if (meuGrafico) {
    meuGrafico.destroy();
  }

  meuGrafico = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Total da Fatura (R$)',
        data: valores,
        backgroundColor: valores.map(v => v > limiteMensal && limiteMensal > 0 ? '#e53e3e' : '#3182ce'),
        borderRadius: 6,
        maxBarThickness: 45
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => ` Total: R$ ${context.raw.toFixed(2)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => `R$ ${value}`
          }
        }
      }
    }
  });
}

// ==========================================
// RENDERIZAÇÃO DAS FATURAS
// ==========================================
function renderizarFaturas() {
  const container = document.getElementById('lista-faturas');
  if (!container) return;

  const faturas = calcularFaturas();
  
  renderizarGraficoProjecao(faturas);

  const mesesOrdenados = Object.keys(faturas).sort();

  container.innerHTML = '';

  if (mesesOrdenados.length === 0) {
    container.innerHTML = '<p class="mensagem-vazia">Nenhuma compra cadastrada no navegador.</p>';
    return;
  }

  mesesOrdenados.forEach(chaveMesAno => {
    const fatura = faturas[chaveMesAno];
    const [ano, mes] = chaveMesAno.split('-');
    const dataVencimentoFormatada = `${String(diaVencimento).padStart(2, '0')}/${mes}/${ano}`;

    const porcentagem = limiteMensal > 0 ? Math.min((fatura.total / limiteMensal) * 100, 100) : 0;
    const porcentagemReal = limiteMensal > 0 ? ((fatura.total / limiteMensal) * 100).toFixed(1) : 0;

    let classeCor = '';
    if (fatura.total > limiteMensal && limiteMensal > 0) {
      classeCor = 'excedido';
    } else if (porcentagem > 85) {
      classeCor = 'alerta';
    }

    let htmlCartoes = '';
    Object.keys(fatura.cartoes).forEach(nomeCartao => {
      const grupoCartao = fatura.cartoes[nomeCartao];

      const htmlItens = grupoCartao.itens.map(item => {
        const tagInfo = item.recorrente
          ? `<span class="badge-recorrente" style="background-color: #805ad5; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; margin-left: 6px;">Recorrente</span>`
          : `<small>(${item.parcelaAtual}/${item.totalParcelas})</small>`;

        const idGrupo = item.grupoRecorrenciaId ? `'${item.grupoRecorrenciaId}'` : 'null';

        return `
          <li style="${item.recorrente ? 'background-color: #faf5ff; padding: 8px; border-radius: 6px; margin-bottom: 4px;' : ''}">
            <div class="item-info">
              <strong>${item.estabelecimento}</strong>
              ${tagInfo}
            </div>
            <div class="item-acoes" style="display: flex; align-items: center; gap: 8px;">
              <strong style="${item.recorrente ? 'color: #6b46c1;' : ''}">R$ ${item.valorParcela.toFixed(2)}</strong>
              <button class="btn-editar" onclick="abrirModalEdicao(${item.idCompra})" title="Editar lançamento">✏️</button>
              <button class="btn-excluir" onclick="excluirCompra(${item.idCompra}, ${idGrupo})" title="Excluir lançamento">✕</button>
            </div>
          </li>
        `;
      }).join('');

      htmlCartoes += `
        <div class="grupo-cartao">
          <div class="header-cartao">
            <span class="nome-cartao">
              <span class="badge-cartao">Cartão</span> ${nomeCartao}
            </span>
            <span class="subtotal-cartao">Subtotal: R$ ${grupoCartao.subtotal.toFixed(2)}</span>
          </div>
          <ul class="lista-itens">
            ${htmlItens}
          </ul>
        </div>
      `;
    });

    container.innerHTML += `
      <div class="card-fatura">
        <div class="header-fatura">
          <h3>
            Fatura ${mes}/${ano} 
            <span class="data-vencimento-tag">(Vencimento: ${dataVencimentoFormatada})</span>
          </h3>
          <span class="total-fatura">R$ ${fatura.total.toFixed(2)}</span>
        </div>

        <div class="progresso-container">
          <div class="progresso-barra ${classeCor}" style="width: ${porcentagem}%;"></div>
        </div>
        <div class="info-limite">
          ${porcentagemReal}% do limite configurado (R$ ${limiteMensal.toFixed(2)})
        </div>

        ${htmlCartoes}
      </div>
    `;
  });
}
