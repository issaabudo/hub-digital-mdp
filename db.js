/**
 * Camada de dados do Hub Digital MdP
 *
 * MODO DEMO (padrão): localStorage — funciona offline, sem conta.
 * MODO PRODUÇÃO: Supabase (grátis) — ver README e CONFIG abaixo.
 *
 * Porquê não Dataverse/Power Apps no MVP?
 * - Licenciamento Microsoft pode bloquear o HUB
 * - Dependência de ambiente NRC ainda por validar
 * - localStorage + Supabase cobrem demo e produção com custo zero
 */

const DB_CONFIG = {
  // "local" | "supabase"
  mode: "supabase",

  // Preencher só quando fores para Supabase (https://supabase.com)
  supabaseUrl: "https://przxpowvyedzndjyowtf.supabase.co",
  supabaseAnonKey: "sb_publishable_rPT4_OrdX2sOk7E0aL06rQ_mXS6zeha",
};

const STORAGE_KEY = "hub_mdp_db_v1";

function emptyDb() {
  return {
    meta: { counter: 0 },
    pessoas: {}, // codigo -> { nome, tipo, perfil, status, criadoEm }
    presencas: [], // { id, codigo, data, hora, motivo, source }
    uso_computador: [], // { id, codigo, computador, horaInicio, horaFim, data, status }
    atribuicao_mensal: {}, // codigo -> { computador }
    computadores: buildPcs(),
  };
}

function buildPcs() {
  const pcs = {};
  for (let i = 1; i <= 20; i++) {
    const code = "PC-" + String(i).padStart(2, "0");
    pcs[code] = { codigo: code, status: "Available", active: true };
  }
  return pcs;
}

function uid() {
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDb();
    const data = JSON.parse(raw);
    if (!data.computadores) data.computadores = buildPcs();
    if (!data.meta) data.meta = { counter: 0 };
    return data;
  } catch {
    return emptyDb();
  }
}

function saveLocal(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** API unificada usada pela app */
const HubDB = {
  _cache: null,
  _supabase: null,

  async init() {
    if (DB_CONFIG.mode === "supabase" && DB_CONFIG.supabaseUrl && DB_CONFIG.supabaseAnonKey) {
      // Carrega SDK só se configurado (CDN)
      if (!window.supabase) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      this._supabase = window.supabase.createClient(
        DB_CONFIG.supabaseUrl,
        DB_CONFIG.supabaseAnonKey
      );
      return "supabase";
    }
    this._cache = loadLocal();
    return "local";
  },

  _get() {
    if (!this._cache) this._cache = loadLocal();
    return this._cache;
  },

  _persist() {
    saveLocal(this._get());
  },

  async getPerson(code) {
    code = String(code || "").trim().toUpperCase();
    if (this._supabase) {
      const { data, error } = await this._supabase
        .from("pessoas")
        .select("*")
        .eq("codigo", code)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
    const p = this._get().pessoas[code];
    return p ? { codigo: code, ...p } : null;
  },

  async nextCode() {
    if (this._supabase) {
      // RPC ou tabela meta — no local usamos contador simples
      const { data, error } = await this._supabase.rpc("next_participant_code");
      if (!error && data) return data;
      // fallback: contar linhas
      const { count } = await this._supabase
        .from("pessoas")
        .select("*", { count: "exact", head: true });
      return "P-" + String((count || 0) + 1).padStart(5, "0");
    }
    const db = this._get();
    db.meta.counter = (db.meta.counter || 0) + 1;
    this._persist();
    return "P-" + String(db.meta.counter).padStart(5, "0");
  },

  async createPerson({ nome, tipo, perfil, status = "Active" }) {
    const codigo = await this.nextCode();
    const row = {
      nome: nome.trim(),
      tipo,
      perfil,
      status,
      criadoEm: new Date().toISOString(),
    };
    if (this._supabase) {
      const { error } = await this._supabase.from("pessoas").insert({ codigo, ...row });
      if (error) throw error;
      return { codigo, ...row };
    }
    const db = this._get();
    db.pessoas[codigo] = row;
    this._persist();
    return { codigo, ...row };
  },

  async listPeople() {
    if (this._supabase) {
      const { data, error } = await this._supabase.from("pessoas").select("*").order("codigo");
      if (error) throw error;
      return data || [];
    }
    const db = this._get();
    return Object.entries(db.pessoas).map(([codigo, p]) => ({ codigo, ...p }));
  },

  async addPresenca({ codigo, data, hora, motivo, source = "Kiosk" }) {
    const row = { id: uid(), codigo, data, hora, motivo, source };
    if (this._supabase) {
      const { error } = await this._supabase.from("presencas").insert(row);
      if (error) throw error;
      return row;
    }
    const db = this._get();
    db.presencas.push(row);
    this._persist();
    return row;
  },

  async addUsoPc({ codigo, computador, data, horaInicio }) {
    const row = {
      id: uid(),
      codigo,
      computador,
      data,
      horaInicio,
      horaFim: null,
      status: "Active",
    };
    if (this._supabase) {
      const { error } = await this._supabase.from("uso_computador").insert(row);
      if (error) throw error;
      // opcional: actualizar estado do PC
      await this._supabase
        .from("computadores")
        .update({ status: "In Use" })
        .eq("codigo", computador);
      return row;
    }
    const db = this._get();
    db.uso_computador.push(row);
    if (db.computadores[computador]) {
      db.computadores[computador].status = "In Use";
    }
    this._persist();
    return row;
  },

  async closeUsoPc(id, computador) {
    const horaFim = new Date().toISOString();
    if (this._supabase) {
      await this._supabase
        .from("uso_computador")
        .update({ horaFim, status: "Closed" })
        .eq("id", id);
      await this._supabase
        .from("computadores")
        .update({ status: "Available" })
        .eq("codigo", computador);
      return;
    }
    const db = this._get();
    const u = db.uso_computador.find((x) => x.id === id);
    if (u) {
      u.horaFim = horaFim;
      u.status = "Closed";
    }
    if (db.computadores[computador]) {
      db.computadores[computador].status = "Available";
    }
    this._persist();
  },

  async getPcs() {
    if (this._supabase) {
      const { data, error } = await this._supabase.from("computadores").select("*");
      if (error) throw error;
      return data || [];
    }
    return Object.values(this._get().computadores);
  },

  async getAtribuicoes() {
    if (this._supabase) {
      const { data, error } = await this._supabase.from("atribuicao_mensal").select("*");
      if (error) throw error;
      return data || [];
    }
    const db = this._get();
    return Object.entries(db.atribuicao_mensal).map(([codigo, v]) => ({
      codigo,
      computador: v.computador,
    }));
  },

  async setAtribuicao(codigo, computador) {
    codigo = codigo.toUpperCase();
    computador = computador.toUpperCase();
    if (this._supabase) {
      const { error } = await this._supabase
        .from("atribuicao_mensal")
        .upsert({ codigo, computador });
      if (error) throw error;
      return;
    }
    const db = this._get();
    db.atribuicao_mensal[codigo] = { computador };
    this._persist();
  },

  async removeAtribuicao(codigo) {
    codigo = codigo.toUpperCase();
    if (this._supabase) {
      await this._supabase.from("atribuicao_mensal").delete().eq("codigo", codigo);
      return;
    }
    const db = this._get();
    delete db.atribuicao_mensal[codigo];
    this._persist();
  },

  async clearAtribuicoes() {
    if (this._supabase) {
      await this._supabase.from("atribuicao_mensal").delete().neq("codigo", "");
      return;
    }
    const db = this._get();
    db.atribuicao_mensal = {};
    this._persist();
  },

  async getHoje(data) {
    if (this._supabase) {
      const [p, u] = await Promise.all([
        this._supabase.from("presencas").select("*").eq("data", data),
        this._supabase.from("uso_computador").select("*").eq("data", data),
      ]);
      return {
        presencas: p.data || [],
        usos: u.data || [],
      };
    }
    const db = this._get();
    return {
      presencas: db.presencas.filter((x) => x.data === data),
      usos: db.uso_computador.filter((x) => x.data === data),
    };
  },

  /** Exportar tudo (backup / Excel) */
  exportJson() {
    return JSON.stringify(this._get(), null, 2);
  },

  exportCsvHoje(data) {
    const { presencas, usos } = {
      presencas: this._get().presencas.filter((x) => x.data === data),
      usos: this._get().uso_computador.filter((x) => x.data === data),
    };
    const lines = ["tipo,hora,codigo,detalhe"];
    presencas.forEach((p) => {
      lines.push(`presenca,${p.hora},${p.codigo},${p.motivo}`);
    });
    usos.forEach((u) => {
      const h = (u.horaInicio || "").slice(11, 16);
      lines.push(`uso_pc,${h},${u.codigo},${u.computador}`);
    });
    return lines.join("\n");
  },

  resetDemo() {
    this._cache = emptyDb();
    this._persist();
  },
};
