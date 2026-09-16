// ARMAZENAMENTO DAS COMPRAS NO LOCALSTORAGE
let compras = JSON.parse(localStorage.getItem('compras_cartao')) || [];
let diaVencimento = parseInt(localStorage.getItem('dia_vencimento')) || 10;
let limiteMensal = parseFloat(localStorage.getItem('limite_mensal')) || 2000;

document.addEventListener('DOMContentLoaded', () => {
  // Preenche a data da compra com a data atual por padrão
  document.getElementById('data-compra').valueAsDate = new Date();
  
  // Carrega configurações salvas
  const inputVencimento = document.getElementById('dia-vencimento');
  const inputLimite = document.getElementById('limite-mensal');

  inputVencimento.value = diaVencimento;
  inputLimite.value = limiteMensal;

  // Listeners para atualização em tempo real das configurações
  inputVencimento.addEventListener('input', (e) => {
    diaVencimento = parseInt(e.target.value) || 10;
    localStorage.setItem('dia_vencimento', diaVencimento);
    renderizarFaturas();
  });

  inputLimite.addEventListener('input', (e) => {
    limiteMensal = parseFloat(e.target.value) || 2000;
    localStorage.setItem('limite_mensal', limiteMensal);
    renderizarFaturas();
  });

  // Listeners para Exportação e Importação de JSON
  document.getElementById('btn-exportar-json').addEventListener('click', exportarJSON);
  document.getElementById('input-importar-json').addEventListener('change', importarJSON);

  atualizarDatalistCartoes();
  renderizarFaturas();
});

// EXTRAÇÃO DE DADOS DA MENSAGEM (ATUALIZADO E REFINADO)
document.getElementById('btn-extrair').addEventListener('click', () => {
  const texto = document.getElementById('texto-importacao').value.trim();

  if (!texto) {
    alert('Cole o texto da notificação primeiro.');
    return;
  }

  // 1. Extrair Valor (ex: R$ 113,04 | R$58,48 | valor: 150.00)
  const regexValor = /(?:R\$\s*|valor\s*)([\d\.]+,\d{2}|\d+[\.,]\d+)/i;
  const matchValor = texto.match(regexValor);
  if (matchValor) {
    // Remove pontos de milhar e substitui vírgula decimal por ponto
    const valorTratado = matchValor[1].replace(/\./g, '').replace(',', '.');
    document.getElementById('valor-total').value = parseFloat(valorTratado);
  }

  // 2. Extrair Parcelas (ex: 3x, em 12x, em 2 vezes, 5 vezes)
  const regexParcelas = /(\d+)\s*(?:x|vezes)/i;
  const matchParcelas = texto.match(regexParcelas);
  if (matchParcelas) {
    document.getElementById('total-parcelas').value = parseInt(matchParcelas[1]);
  } else {
    document.getElementById('total-parcelas').value = 1;
  }

  // 3. Extrair Apenas os Dígitos Finais do Cartão (ex: "final 8810" ou "**** 8810" -> preenche apenas "8810")
  const regexCartaoFinal = /(?:final|\*+)\s*(\d{4})/i;
  const matchCartaoFinal = texto.match(regexCartaoFinal);
  if (matchCartaoFinal) {
    document.getElementById('cartao').value = matchCartaoFinal[1]; // Preenche apenas os 4 números
  }

  // 4. Extrair Estabelecimento (Procura texto após "em " ou "no ")
  const regexLocal = /(?:em|no|na)\s+([A-Z0-9\s]{3,25})/i;
  const matchLocal = texto.match(regexLocal);
  if (matchLocal) {
    // Limpa possíveis termos de valor/data concatenados ao nome do estabelecimento
    let nomeLimpo = matchLocal[1]
      .split(/R\$|valor|\d{2}\/\d{2}/i)[0]
      .trim();
    document.getElementById('estabelecimento').value = nomeLimpo;
  }

  alert('Dados extraídos! Confira os campos do formulário antes de salvar.');
});

// SUBMISSÃO DO FORMULÁRIO DE CADASTRO
document.getElementById('form-compra').addEventListener('submit', (e) => {
  e.preventDefault();

  const estabelecimento = document.getElementById('estabelecimento').value.trim();
  const cartao = document.getElementById('cartao').value.trim();
  const valorTotal = parseFloat(document.getElementById('valor-total').value);
  const totalParcelas = parseInt(document.getElementById('total-parcelas').value);
  const dataCompra = document.getElementById('data-compra').value;

  if (!estabelecimento || !cartao || isNaN(valorTotal) || isNaN(totalParcelas) || !dataCompra) {
    alert('Preencha todos os campos corretamente.');
    return;
  }

  const novaCompra = {
    id: Date.now(),
    estabelecimento,
    cartao,
    valorTotal,
    totalParcelas,
    dataCompra
  };

  compras.push(novaCompra);
  salvarECarregar();
  e.target.reset();
  document.getElementById('texto-importacao').value = '';
  document.getElementById('data-compra').valueAsDate = new Date();
});

function salvarECarregar() {
  localStorage.setItem('compras_cartao', JSON.stringify(compras));
  atualizarDatalistCartoes();
  renderizarFaturas();
}

function excluirCompra(id) {
  compras = compras.filter(c => c.id !== id);
  salvarECarregar();
}

// AUTOCOMPLETAR NOMES DE CARTÃO NO INPUT
function atualizarDatalistCartoes() {
  const datalist = document.getElementById('lista-cartoes');
  const cartoesUnicos = [...new Set(compras.map(c => c.cartao))];
  datalist.innerHTML = cartoesUnicos.map(c => `<option value="${c}">`).join('');
}

// FUNCIONALIDADE DE BACKUP (EXPORTAR / IMPORTAR JSON)
function exportarJSON() {
  const dados = {
    diaVencimento,
    limiteMensal,
    compras
  };

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

        document.getElementById('dia-vencimento').value = diaVencimento;
        document.getElementById('limite-mensal').value = limiteMensal;

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

// CÁLCULO DAS FATURAS COM ESTRUTURA E SUBTOTAL POR CARTÃO
function calcularFaturas() {
  const faturas = {};

  compras.forEach(compra => {
    const [anoStr, mesStr] = compra.dataCompra.split('-');
    let ano = parseInt(anoStr);
    let mes = parseInt(mesStr) - 1;

    const valorParcela = compra.valorTotal / compra.totalParcelas;

    for (let i = 0; i < compra.totalParcelas; i++) {
      const dataParcela = new Date(ano, mes + i, 1);
      const chaveMesAno = `${dataParcela.getFullYear()}-${String(dataParcela.getMonth() + 1).padStart(2, '0')}`;

      if (!faturas[chaveMesAno]) {
        faturas[chaveMesAno] = {
          mesAno: chaveMesAno,
          dataObjeto: dataParcela,
          total: 0,
          cartoes: {}
        };
      }

      if (!faturas[chaveMesAno].cartoes[compra.cartao]) {
        faturas[chaveMesAno].cartoes[compra.cartao] = {
          subtotal: 0,
          itens: []
        };
      }

      faturas[chaveMesAno].total += valorParcela;
      faturas[chaveMesAno].cartoes[compra.cartao].subtotal += valorParcela;
      faturas[chaveMesAno].cartoes[compra.cartao].itens.push({
        idCompra: compra.id,
        estabelecimento: compra.estabelecimento,
        valorParcela: valorParcela,
        parcelaAtual: i + 1,
        totalParcelas: compra.totalParcelas
      });
    }
  });

  return faturas;
}

// RENDERIZAÇÃO DAS FATURAS NA TELA
function renderizarFaturas() {
  const container = document.getElementById('lista-faturas');
  const faturas = calcularFaturas();
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

    const porcentagem = Math.min((fatura.total / limiteMensal) * 100, 100);
    const porcentagemReal = ((fatura.total / limiteMensal) * 100).toFixed(1);

    let classeCor = '';
    if (fatura.total > limiteMensal) {
      classeCor = 'excedido';
    } else if (porcentagem > 85) {
      classeCor = 'alerta';
    }

    let htmlCartoes = '';
    Object.keys(fatura.cartoes).forEach(nomeCartao => {
      const grupoCartao = fatura.cartoes[nomeCartao];

      const htmlItens = grupoCartao.itens.map(item => `
        <li>
          <div class="item-info">
            <strong>${item.estabelecimento}</strong>
            <small>(${item.parcelaAtual}/${item.totalParcelas})</small>
          </div>
          <div class="item-acoes">
            <strong>R$ ${item.valorParcela.toFixed(2)}</strong>
            <button class="btn-excluir" onclick="excluirCompra(${item.idCompra})" title="Excluir compra inteira">✕</button>
          </div>
        </li>
      `).join('');

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

    const htmlFatura = `
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

    container.innerHTML += htmlFatura;
  });
}

