/**
 * Hub Digital MdP — Quiosque + Staff
 * Baseado no protótipo e na proposta de controlo (MVP).
 */

const STAFF_PIN = "1234"; // Trocar antes de produção

let view = "kiosk"; // kiosk | staff
let kioskStep = "code"; // code | menu | pcgrid | done
let kioskPerson = null;
let kioskTurno = null;
let staffOn = false;
let staffTab = "nova"; // nova | atrib | hoje | pessoas
let lastMsg = "";
let dbMode = "local";

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

const todayStr = () => {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
};

const timeStr = () => {
  const d = new Date();
  return (
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0")
  );
};

function turnoAgora() {
  const d = new Date();
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 8 && h < 12) return "manha";
  if (h >= 13.5 && h < 15.5) return "tarde";
  return null;
}

function appEl() {
  return document.getElementById("app");
}

function render() {
  if (view === "kiosk") renderKiosk();
  else renderStaff();
}

function renderKiosk() {
  let html =
    '<div class="topbar"><div class="brand">Hub Digital MdP</div>' +
    '<button type="button" class="ghost" onclick="App.toStaffLogin()">Acesso Staff</button></div>';

  if (kioskStep === "code") {
    html +=
      "<h1>Introduza o seu código</h1><div class=\"card\">" +
      '<label>Código</label><input id="codeInput" placeholder="Ex: P-00001" autocomplete="off" autofocus />' +
      (lastMsg ? '<div class="err">' + esc(lastMsg) + "</div>" : "") +
      '<button type="button" class="btn" onclick="App.submitCode()">Entrar</button></div>';
  } else if (kioskStep === "menu") {
    const nome = (kioskPerson.nome || "").split(" ")[0] || "visitante";
    const isAluno = (kioskPerson.perfil || "").startsWith("Aluno");
    const podeAula =
      kioskTurno &&
      isAluno &&
      ((kioskTurno === "manha" && kioskPerson.perfil === "Aluno-Manha") ||
        (kioskTurno === "tarde" && kioskPerson.perfil === "Aluno-Tarde"));

    html +=
      "<h1>Bem-vindo(a)</h1><div class=\"card\"><div class=\"greet\">Olá, " +
      esc(nome) +
      "!</div>";
    if (podeAula) {
      html +=
        '<button type="button" class="btn" onclick="App.marcarPresenca()">Presença — Aula (' +
        (kioskTurno === "manha" ? "Manhã" : "Tarde") +
        ")</button>";
    } else if (isAluno && !kioskTurno) {
      html +=
        '<p class="small">Fora do horário de aula. Podes registar uso de computador.</p>';
    }
    html +=
      '<button type="button" class="btn alt" onclick="App.toPcGrid()">Usar um computador</button>' +
      '<button type="button" class="btn ghostbtn" onclick="App.resetKiosk()">Cancelar</button></div>';
  } else if (kioskStep === "pcgrid") {
    html += '<h1>Escolha o computador</h1><div class="card"><div class="grid" id="pcGrid">';
    for (let i = 1; i <= 20; i++) {
      const code = "PC-" + String(i).padStart(2, "0");
      html +=
        '<button type="button" class="pc" data-pc="' +
        code +
        '" onclick="App.escolherPc(\'' +
        code +
        "')\">" +
        code +
        "</button>";
    }
    html +=
      '</div><button type="button" class="btn ghostbtn" onclick="App.resetKiosk()">Cancelar</button></div>';
  } else if (kioskStep === "done") {
    html +=
      '<div class="card"><div class="msg ok">' +
      esc(lastMsg) +
      "</div>" +
      '<button type="button" class="btn" style="margin-top:14px" onclick="App.resetKiosk()">Concluído</button></div>';
  }

  html +=
    '<div class="footer">NRC · Hub Digital, Mocímboa da Praia · modo ' +
    esc(dbMode) +
    "</div>";
  appEl().innerHTML = html;

  // Marcar PCs ocupados
  if (kioskStep === "pcgrid") {
    HubDB.getPcs().then((pcs) => {
      pcs.forEach((p) => {
        if (p.status === "In Use") {
          const el = document.querySelector('[data-pc="' + p.codigo + '"]');
          if (el) {
            el.classList.add("busy");
            el.disabled = true;
          }
        }
      });
    });
  }
}

function renderStaff() {
  if (!staffOn) {
    appEl().innerHTML =
      '<div class="topbar"><div class="brand">Hub Digital MdP</div>' +
      '<button type="button" class="ghost" onclick="App.toKiosk()">← Quiosque</button></div>' +
      "<h1>Acesso restrito</h1><div class=\"card\">" +
      '<label>PIN da equipa</label><input id="pinInput" type="password" inputmode="numeric" />' +
      '<p class="small">PIN de demonstração: 1234 (substituir antes de produção).</p>' +
      (lastMsg ? '<div class="err">' + esc(lastMsg) + "</div>" : "") +
      '<button type="button" class="btn" onclick="App.checkPin()">Entrar</button></div>';
    return;
  }

  let html =
    '<div class="topbar"><div class="brand">Hub Digital MdP — Staff</div>' +
    '<button type="button" class="ghost" onclick="App.toKiosk()">← Quiosque</button></div>';

  html +=
    '<div class="tabs">' +
    tabBtn("nova", "Pessoa Nova") +
    tabBtn("pessoas", "Lista") +
    tabBtn("atrib", "Atribuição") +
    tabBtn("hoje", "Hoje") +
    "</div>";

  if (staffTab === "nova") html += renderNova();
  if (staffTab === "pessoas") html += '<div id="pessoasBox" class="card">A carregar…</div>';
  if (staffTab === "atrib") html += '<div id="atribBox" class="card">A carregar…</div>';
  if (staffTab === "hoje") html += '<div id="hojeBox" class="card">A carregar…</div>';

  html +=
    '<div class="toolbar">' +
    '<button type="button" class="ghost" onclick="App.exportBackup()">Exportar backup JSON</button>' +
    '<button type="button" class="ghost" onclick="App.exportCsv()">Exportar CSV de hoje</button>' +
    (dbMode === "local"
      ? '<button type="button" class="ghost" onclick="App.resetDemo()">Limpar dados demo</button>'
      : "") +
    "</div>";

  html +=
    '<div class="footer">Staff · dados em ' +
    esc(dbMode) +
    (dbMode === "local" ? " (só neste dispositivo)" : "") +
    "</div>";

  appEl().innerHTML = html;

  if (staffTab === "pessoas") loadPessoas();
  if (staffTab === "atrib") loadAtribuicao();
  if (staffTab === "hoje") loadHoje();
}

function tabBtn(id, label) {
  return (
    '<button type="button" class="tab ' +
    (staffTab === id ? "on" : "") +
    '" onclick="App.setTab(\'' +
    id +
    "')\">" +
    label +
    "</button>"
  );
}

function renderNova() {
  return (
    '<div class="card">' +
    '<label>Nome completo</label><input id="novoNome" autocomplete="name" />' +
    '<label>Tipo</label><select id="novoTipo"><option>Externo</option><option>Interno</option></select>' +
    '<label>Perfil</label><select id="novoPerfil">' +
    '<option value="Comunidade">Comunidade</option>' +
    '<option value="Aluno-Manha">Aluno-Manhã</option>' +
    '<option value="Aluno-Tarde">Aluno-Tarde</option>' +
    '<option value="Admin">Admin</option></select>' +
    '<button type="button" class="btn" onclick="App.gerarPessoa()">Gerar Código</button>' +
    '<div id="codigoResult"></div></div>'
  );
}

async function loadPessoas() {
  const box = document.getElementById("pessoasBox");
  try {
    const list = await HubDB.listPeople();
    let rows = "";
    list.forEach((p) => {
      rows +=
        "<tr><td>" +
        esc(p.codigo) +
        "</td><td>" +
        esc(p.nome) +
        "</td><td>" +
        esc(p.perfil) +
        "</td><td>" +
        esc(p.tipo) +
        "</td></tr>";
    });
    box.innerHTML =
      "<table><tr><th>Código</th><th>Nome</th><th>Perfil</th><th>Tipo</th></tr>" +
      (rows || '<tr><td colspan="4" class="small">Ainda sem pessoas registadas.</td></tr>') +
      "</table>";
  } catch (e) {
    box.innerHTML = '<p class="err">Erro ao carregar lista.</p>';
  }
}

async function loadAtribuicao() {
  const box = document.getElementById("atribBox");
  try {
    const rowsData = await HubDB.getAtribuicoes();
    let rows = "";
    for (const d of rowsData) {
      const p = await HubDB.getPerson(d.codigo);
      rows +=
        "<tr><td>" +
        esc(d.codigo) +
        "</td><td>" +
        esc(p ? p.nome : "—") +
        "</td><td>" +
        esc(d.computador) +
        '</td><td><button type="button" class="ghost" onclick="App.removerAtrib(\'' +
        esc(d.codigo) +
        "')\">Remover</button></td></tr>";
    }
    box.innerHTML =
      "<table><tr><th>Código</th><th>Nome</th><th>PC</th><th></th></tr>" +
      (rows || '<tr><td colspan="4" class="small">Sem atribuições ainda.</td></tr>') +
      "</table>" +
      '<hr class="hr" />' +
      '<label>Código do aluno</label><input id="atribCodigo" placeholder="Ex: P-00001" />' +
      '<label>Computador</label><input id="atribPc" placeholder="Ex: PC-03" />' +
      '<button type="button" class="btn" onclick="App.atribuir()">Atribuir</button>' +
      '<button type="button" class="btn ghostbtn" onclick="App.limparAtrib()">Limpar todas (nova turma)</button>';
  } catch (e) {
    box.innerHTML = '<p class="err">Erro ao carregar atribuições.</p>';
  }
}

async function loadHoje() {
  const box = document.getElementById("hojeBox");
  const t = todayStr();
  try {
    const { presencas, usos } = await HubDB.getHoje(t);
    const items = [];
    for (const r of presencas) {
      items.push({ hora: r.hora, codigo: r.codigo, desc: r.motivo });
    }
    for (const r of usos) {
      items.push({
        hora: (r.horaInicio || "").slice(11, 16) || "—",
        codigo: r.codigo,
        desc: "Uso " + r.computador + (r.status === "Active" ? " (activo)" : ""),
      });
    }
    items.sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));

    let rows = "";
    for (const it of items) {
      const p = await HubDB.getPerson(it.codigo);
      rows +=
        "<tr><td>" +
        esc(it.hora) +
        "</td><td>" +
        esc(it.codigo) +
        "</td><td>" +
        esc(p ? p.nome : "—") +
        "</td><td>" +
        esc(it.desc) +
        "</td></tr>";
    }

    box.innerHTML =
      '<div class="stats">' +
      "<div class=\"stat\"><strong>" +
      presencas.length +
      "</strong><span>Presenças</span></div>" +
      "<div class=\"stat\"><strong>" +
      usos.length +
      "</strong><span>Usos de PC</span></div>" +
      "<div class=\"stat\"><strong>" +
      items.length +
      "</strong><span>Total</span></div></div>" +
      "<table><tr><th>Hora</th><th>Código</th><th>Nome</th><th>Motivo</th></tr>" +
      (rows || '<tr><td colspan="4" class="small">Sem registos hoje ainda.</td></tr>') +
      "</table>";
  } catch (e) {
    box.innerHTML = '<p class="err">Erro ao carregar registos de hoje.</p>';
  }
}

window.App = {
  toStaffLogin() {
    view = "staff";
    lastMsg = "";
    render();
  },
  toKiosk() {
    view = "kiosk";
    lastMsg = "";
    render();
  },
  setTab(t) {
    staffTab = t;
    render();
  },
  checkPin() {
    const v = document.getElementById("pinInput").value;
    if (v === STAFF_PIN) {
      staffOn = true;
      lastMsg = "";
      render();
    } else {
      lastMsg = "PIN incorreto.";
      render();
    }
  },
  async submitCode() {
    const code = document.getElementById("codeInput").value.trim().toUpperCase();
    if (!code) {
      lastMsg = "Escreve o teu código.";
      render();
      return;
    }
    try {
      const p = await HubDB.getPerson(code);
      if (!p || p.status === "Inactive") {
        lastMsg = "Código não encontrado. Pede à equipa para te registar.";
        render();
        return;
      }
      kioskPerson = { ...p, codigo: code };
      kioskTurno = turnoAgora();
      kioskStep = "menu";
      lastMsg = "";
      render();
    } catch (e) {
      lastMsg = "Erro de ligação. Tenta de novo.";
      render();
    }
  },
  async marcarPresenca() {
    const motivo = kioskTurno === "manha" ? "Aula-Manha" : "Aula-Tarde";
    try {
      await HubDB.addPresenca({
        codigo: kioskPerson.codigo,
        data: todayStr(),
        hora: timeStr(),
        motivo,
        source: "Kiosk",
      });
      lastMsg = "Presença registada. Bom trabalho!";
      kioskStep = "done";
      render();
    } catch (e) {
      lastMsg = "Não foi possível registar. Tenta de novo.";
      kioskStep = "done";
      render();
    }
  },
  toPcGrid() {
    kioskStep = "pcgrid";
    render();
  },
  async escolherPc(pc) {
    try {
      const pcs = await HubDB.getPcs();
      const info = pcs.find((x) => x.codigo === pc);
      if (info && info.status === "In Use") {
        lastMsg = pc + " está ocupado. Escolhe outro.";
        kioskStep = "pcgrid";
        render();
        return;
      }
      await HubDB.addUsoPc({
        codigo: kioskPerson.codigo,
        computador: pc,
        data: todayStr(),
        horaInicio: new Date().toISOString(),
      });
      lastMsg = "Registado em " + pc + ". Bom trabalho!";
      kioskStep = "done";
      render();
    } catch (e) {
      lastMsg = "Erro ao registar PC.";
      kioskStep = "done";
      render();
    }
  },
  resetKiosk() {
    kioskStep = "code";
    kioskPerson = null;
    kioskTurno = null;
    lastMsg = "";
    render();
  },
  async gerarPessoa() {
    const nome = document.getElementById("novoNome").value.trim();
    const tipo = document.getElementById("novoTipo").value;
    const perfil = document.getElementById("novoPerfil").value;
    if (!nome) {
      alert("Escreve o nome.");
      return;
    }
    try {
      const person = await HubDB.createPerson({ nome, tipo, perfil });
      document.getElementById("codigoResult").innerHTML =
        '<div class="codebox">' +
        esc(person.codigo) +
        '</div><p class="small">Escreve este código no cartão do participante.</p>';
      document.getElementById("novoNome").value = "";
    } catch (e) {
      alert("Erro ao criar pessoa.");
    }
  },
  async atribuir() {
    const code = document.getElementById("atribCodigo").value.trim().toUpperCase();
    const pc = document.getElementById("atribPc").value.trim().toUpperCase();
    if (!code || !pc) return;
    const p = await HubDB.getPerson(code);
    if (!p) {
      alert("Código não encontrado.");
      return;
    }
    await HubDB.setAtribuicao(code, pc);
    loadAtribuicao();
  },
  async removerAtrib(code) {
    await HubDB.removeAtribuicao(code);
    loadAtribuicao();
  },
  async limparAtrib() {
    if (!confirm("Limpar todas as atribuições desta turma?")) return;
    await HubDB.clearAtribuicoes();
    loadAtribuicao();
  },
  exportBackup() {
    const blob = new Blob([HubDB.exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "hub-mdp-backup-" + todayStr() + ".json";
    a.click();
  },
  exportCsv() {
    const blob = new Blob([HubDB.exportCsvHoje(todayStr())], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "hub-mdp-hoje-" + todayStr() + ".csv";
    a.click();
  },
  resetDemo() {
    if (!confirm("Apagar todos os dados deste dispositivo?")) return;
    HubDB.resetDemo();
    alert("Dados limpos.");
    render();
  },
};

(async function init() {
  try {
    dbMode = await HubDB.init();
  } catch (e) {
    dbMode = "local";
    console.warn("Fallback local", e);
  }
  render();
})();
