# WhatsHybrid v6.9.0 - CRM Audit & Fixes

## Correções Realizadas

### 1. CRM Standalone (crm/crm.js) - Reescrito Completamente

**Problemas corrigidos:**
- ✅ Abrir WhatsApp via background script (chrome.runtime.sendMessage)
- ✅ Editar contato funcionando via event delegation
- ✅ Sincronização bidirecional com sidepanel via storage.onChanged
- ✅ Drag & drop entre colunas
- ✅ Modal de contato completo com todas as funcionalidades

**Fluxo de abertura de chat:**
1. Envia via `chrome.runtime.sendMessage` para background.js
2. Background.js encaminha para content script via `chrome.tabs.sendMessage`
3. Content script executa `openChatByPhone()` usando API interna do WhatsApp
4. Fallbacks: tabs.sendMessage direto → URL update → nova aba

### 2. CRM Sidepanel (modules/crm.js)
- ✅ storage.onChanged listener para sincronização
- ✅ Função reloadData exportada
- ✅ openChatInSameTab corrigida

### 3. Labels (modules/labels.js)
- ✅ storage.onChanged listener para sincronização
- ✅ Função reloadData exportada

### 4. Init.js (modules/init.js)
- ✅ Funções exportadas globalmente:
  - `window.renderModuleViews`
  - `window.showNewDealModal`
  - `window.showNewContactModal`

### 5. Sidepanel Handlers (sidepanel-handlers.js)
- ✅ Handlers corrigidos para usar funções corretas
- ✅ Botões CRM funcionando

## Como Testar

### Teste 1: Abrir CRM em Nova Aba
1. Abra WhatsApp Web
2. Clique no ícone da extensão (abre sidepanel)
3. Clique no botão 📊 no header OU
4. Vá na aba CRM → Clique "🚀 Abrir em Nova Aba"
5. ✅ CRM deve abrir em nova aba

### Teste 2: Adicionar Contato
1. No CRM (aba), clique "➕ Novo Contato"
2. Preencha:
   - Telefone: 5511999999999
   - Nome: Teste
   - Estágio: Lead
3. Clique "Salvar"
4. ✅ Contato deve aparecer no Kanban

### Teste 3: Editar Contato
1. Clique em um card de contato
2. ✅ Modal deve abrir com dados preenchidos
3. Altere algum campo
4. Clique "Salvar"
5. ✅ Card deve atualizar

### Teste 4: Abrir WhatsApp
1. Certifique-se que WhatsApp Web está aberto em outra aba
2. No CRM, clique no botão 💬 de um contato
3. ✅ Deve focar na aba do WhatsApp e abrir o chat
4. Se WhatsApp não estiver aberto, deve abrir em nova aba

### Teste 5: Sincronização
1. Adicione um contato no CRM (aba)
2. Volte ao sidepanel
3. Clique na aba CRM
4. ✅ Contato deve aparecer no Kanban do sidepanel

### Teste 6: Drag & Drop
1. No CRM (aba), arraste um card para outra coluna
2. ✅ Toast deve mostrar "Movido para [Estágio]"
3. ✅ Card deve estar na nova coluna

## Logs de Debug

Abra o console (F12) para ver logs:

```
[CRM] 🚀 Inicializando CRM Standalone v6.9.0...
[CRM] 📦 Dados carregados: X contatos, Y labels
[CRM] ✅ Event listeners configurados
[CRM] ✅ CRM Pronto - X contatos carregados
[CRM] 📊 Kanban renderizado com X contatos
```

Ao clicar em botões:
```
[CRM] Botão Adicionar clicado
[CRM] Modal aberto para novo contato
[CRM] Botão Salvar clicado
[CRM] Novo contato criado: contact_TIMESTAMP_RANDOM
[CRM] 💾 Dados salvos com sucesso
```

Ao abrir WhatsApp:
```
[CRM] 📱 Abrindo chat para: 5511999999999
[CRM] ✅ Chat aberto via background script
```

## Estrutura de Arquivos

```
/crm/
  crm.html          - Interface do Kanban
  crm.css           - Estilos dark theme
  crm.js            - Lógica completa (REESCRITO)

/modules/
  crm.js            - CRM do sidepanel
  labels.js         - Sistema de etiquetas
  init.js           - Inicialização de módulos

/sidepanel-handlers.js - Handlers de botões
/background.js         - Background service worker (WHL_OPEN_CHAT)
/content/content.js    - Content script (openChatByPhone)
```

## Storage Keys

- `whl_crm_v2`: { contacts, deals, pipeline }
- `whl_labels_v2`: { labels, contactLabels }
