# Hub Digital MdP — Sistema de Registo (MVP)

Quiosque (participantes) + Staff (coordenação), alinhado ao protótipo HTML e à proposta conceptual (Pessoas, Presenças, Uso de PC, Atribuição mensal).

## O que está incluído

| Área | Funções |
|------|---------|
| **Quiosque** | Código → validar → Presença (aula) ou escolher PC-01…PC-20 |
| **Staff** | Pessoa nova + código automático `P-00001`, lista, atribuição mensal, registos de hoje |
| **Export** | Backup JSON + CSV do dia (staff) |
| **Privacidade** | Quiosque só mostra o primeiro nome; não lista terceiros |

## Base de dados — solução recomendada

| Opção | Custo | Offline | Multi-dispositivo | Recomendado para |
|-------|-------|---------|-------------------|------------------|
| **localStorage (já activo)** | Grátis | Sim | Não (só 1 PC/tablet) | **Demo e testes** |
| **Supabase** | Grátis (tier free) | Não | Sim | **Produção no HUB** |
| Power Apps + Dataverse | Licenças Microsoft | Depende | Sim | Só se a NRC validar licenças |
| Google Sheets | Grátis | Não | Sim | Formulários simples (ficha pré/pós) |

**Porquê não Dataverse no MVP?** A proposta oficial é válida a longo prazo, mas depende de licenciamento e ambiente Microsoft ainda por confirmar. Este código permite demo **hoje** e migração para Supabase **sem reescrever a interface**.

### Modo demo (padrão)

1. Abre `index.html` no browser (Chrome/Edge).
2. Staff → PIN `1234` → cria pessoas → gera códigos.
3. Quiosque → introduz o código → presença ou PC.
4. Dados ficam **neste dispositivo** (localStorage).

### Modo produção (Supabase — grátis)

1. Cria projecto em [https://supabase.com](https://supabase.com).
2. No SQL Editor, corre o ficheiro `supabase-schema.sql`.
3. Em **Project Settings → API**, copia `URL` e `anon key`.
4. Em `db.js`, altera:

```js
const DB_CONFIG = {
  mode: "supabase",
  supabaseUrl: "https://xxxx.supabase.co",
  supabaseAnonKey: "eyJhbG...",
};
```

5. Publica a pasta em GitHub Pages ou Netlify.

## Estrutura de ficheiros

```
hub-registo-mdp/
├── index.html
├── styles.css
├── db.js          ← localStorage + gancho Supabase
├── app.js         ← Quiosque + Staff
├── supabase-schema.sql
└── README.md
```

## Fluxo diário

1. Staff regista participantes e imprime/escreve códigos nos cartões.
2. (Opcional) Atribui PC fixo do mês a cada aluno.
3. No horário de aula, o jovem introduz o código no quiosque → **Presença**.
4. Fora de aula ou comunidade → **Usar um computador** → escolhe PC livre.
5. Staff consulta o separador **Hoje** e exporta CSV se precisar de relatório.

## Segurança (antes de produção)

- Trocar `STAFF_PIN` em `app.js`.
- Em Supabase: políticas RLS (só staff autenticado escreve pessoas; quiosque só cria presença/uso).
- Não usar PIN `1234` em ambiente real.
- Definir retenção de dados com a coordenação NRC.

## Ligação à ficha de diagnóstico

Este sistema trata **quem está no HUB e o que fez** (presença / PC).  
A ficha pré/pós (literacia digital) continua noutro formulário (HTML + Google Sheet).  
O **mesmo código** `P-00001` pode ser usado nos dois sítios para cruzar dados.

## Publicar online (link único)

```bash
git init
git add .
git commit -m "Hub registo MdP MVP"
# GitHub Pages ou Netlify Drop
```

## Roadmap sugerido

1. Demo local com localStorage  
2. Supabase + link público  
3. Fechar utilização de PC (check-out) e estado Available/In Use em tempo real  
4. Sessões de aula (S01–S20) como na proposta Dataverse  
5. Avaliar Power Platform **só** se a NRC confirmar licenças  
