import { contextBridge, ipcRenderer } from 'electron';

const api = {
  clients: {
    list: () => ipcRenderer.invoke('clients:list'),
    get: (id: number) => ipcRenderer.invoke('clients:get', id),
    create: (data: any) => ipcRenderer.invoke('clients:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('clients:update', id, data),
    setStage: (id: number, stage: string) => ipcRenderer.invoke('clients:setStage', id, stage),
    delete: (id: number) => ipcRenderer.invoke('clients:delete', id),
  },
  social: {
    listForClient: (clientId: number) => ipcRenderer.invoke('social:listForClient', clientId),
    create: (data: any) => ipcRenderer.invoke('social:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('social:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('social:delete', id),
    open: (url: string) => ipcRenderer.invoke('social:open', url),
  },
  notes: {
    listForClient: (clientId: number) => ipcRenderer.invoke('notes:listForClient', clientId),
    create: (data: any) => ipcRenderer.invoke('notes:create', data),
    update: (id: number, body: string) => ipcRenderer.invoke('notes:update', id, body),
    delete: (id: number) => ipcRenderer.invoke('notes:delete', id),
  },
  websiteLogins: {
    listForClient: (clientId: number) => ipcRenderer.invoke('websiteLogins:listForClient', clientId),
    create: (data: any) => ipcRenderer.invoke('websiteLogins:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('websiteLogins:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('websiteLogins:delete', id),
    open: (url: string) => ipcRenderer.invoke('websiteLogins:open', url),
  },
  tasks: {
    list: (filter?: any) => ipcRenderer.invoke('tasks:list', filter),
    create: (data: any) => ipcRenderer.invoke('tasks:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('tasks:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('tasks:delete', id),
    dueAlerts: () => ipcRenderer.invoke('tasks:dueAlerts'),
  },
  tracker: {
    start: (opts: any) => ipcRenderer.invoke('tracker:start', opts),
    pause: () => ipcRenderer.invoke('tracker:pause'),
    resume: () => ipcRenderer.invoke('tracker:resume'),
    stop: () => ipcRenderer.invoke('tracker:stop'),
    status: () => ipcRenderer.invoke('tracker:status'),
    todaySession: (clientId: number | null) => ipcRenderer.invoke('tracker:todaySession', clientId),
    entries: (filter?: any) => ipcRenderer.invoke('tracker:entries', filter),
    screenshots: (entryId: number) => ipcRenderer.invoke('tracker:screenshots', entryId),
    readScreenshot: (filePath: string) => ipcRenderer.invoke('tracker:readScreenshot', filePath),
    openScreenshotsDir: () => ipcRenderer.invoke('tracker:openScreenshotsDir'),
    onScreenshot: (cb: (payload: any) => void) => {
      const listener = (_e: any, payload: any) => cb(payload);
      ipcRenderer.on('tracker:screenshot', listener);
      return () => ipcRenderer.removeListener('tracker:screenshot', listener);
    },
    onStatusChange: (cb: (payload: any) => void) => {
      const listener = (_e: any, payload: any) => cb(payload);
      ipcRenderer.on('tracker:statusChange', listener);
      return () => ipcRenderer.removeListener('tracker:statusChange', listener);
    },
  },
  app: {
    onNotify: (cb: (payload: { type: string; title: string; description?: string }) => void) => {
      const listener = (_e: any, payload: any) => cb(payload);
      ipcRenderer.on('app:notify', listener);
      return () => ipcRenderer.removeListener('app:notify', listener);
    },
    getRunInBackground: () => ipcRenderer.invoke('app:getRunInBackground'),
    setRunInBackground: (v: boolean) => ipcRenderer.invoke('app:setRunInBackground', v),
    refreshTray: () => ipcRenderer.invoke('app:refreshTray'),
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
  },
  expenses: {
    list: (filter?: any) => ipcRenderer.invoke('expenses:list', filter),
    create: (data: any) => ipcRenderer.invoke('expenses:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('expenses:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('expenses:delete', id),
    exportCsv: (filter?: any) => ipcRenderer.invoke('expenses:exportCsv', filter),
  },
  proposals: {
    list: (filter?: any) => ipcRenderer.invoke('proposals:list', filter),
    get: (id: number) => ipcRenderer.invoke('proposals:get', id),
    nextNumber: () => ipcRenderer.invoke('proposals:nextNumber'),
    create: (data: any) => ipcRenderer.invoke('proposals:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('proposals:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('proposals:delete', id),
    exportPdf: (id: number) => ipcRenderer.invoke('proposals:exportPdf', id),
    convertToInvoice: (id: number) => ipcRenderer.invoke('proposals:convertToInvoice', id),
  },
  checklists: {
    listForClient: (clientId: number) => ipcRenderer.invoke('checklists:listForClient', clientId),
    create: (data: any) => ipcRenderer.invoke('checklists:create', data),
    toggle: (id: number) => ipcRenderer.invoke('checklists:toggle', id),
    delete: (id: number) => ipcRenderer.invoke('checklists:delete', id),
  },
  clients_ext: {
    setContract: (id: number, data: any) => ipcRenderer.invoke('clients:setContract', id, data),
  },
  exports: {
    invoicesCsv: (filter?: any) => ipcRenderer.invoke('exports:invoicesCsv', filter),
    timeEntriesCsv: (filter?: any) => ipcRenderer.invoke('exports:timeEntriesCsv', filter),
    clientsCsv: () => ipcRenderer.invoke('exports:clientsCsv'),
  },
  invoices: {
    list: (filter?: any) => ipcRenderer.invoke('invoices:list', filter),
    get: (id: number) => ipcRenderer.invoke('invoices:get', id),
    nextNumber: () => ipcRenderer.invoke('invoices:nextNumber'),
    create: (data: any) => ipcRenderer.invoke('invoices:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('invoices:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('invoices:delete', id),
    renderHtml: (id: number | null, sample = false) =>
      ipcRenderer.invoke('invoices:renderHtml', id, sample),
    exportPdf: (id: number) => ipcRenderer.invoke('invoices:exportPdf', id),
    exportSamplePdf: () => ipcRenderer.invoke('invoices:exportSamplePdf'),
    fromTimeEntries: (opts: any) => ipcRenderer.invoke('invoices:fromTimeEntries', opts),
  },
  reports: {
    clientHtml: (clientId: number) => ipcRenderer.invoke('reports:clientHtml', clientId),
    clientPdf: (clientId: number) => ipcRenderer.invoke('reports:clientPdf', clientId),
    weeklyPdf: (opts: any) => ipcRenderer.invoke('reports:weeklyPdf', opts),
  },
  agency: {
    get: () => ipcRenderer.invoke('agency:get'),
    set: (payload: any) => ipcRenderer.invoke('agency:set', payload),
    uploadLogo: () => ipcRenderer.invoke('agency:uploadLogo'),
    clearLogo: () => ipcRenderer.invoke('agency:clearLogo'),
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
  },
  stats: {
    dashboard: (clientId?: number | null) => ipcRenderer.invoke('stats:dashboard', clientId),
    revenueByMonth: () => ipcRenderer.invoke('stats:revenueByMonth'),
    timeByClient: () => ipcRenderer.invoke('stats:timeByClient'),
    pipelineValue: () => ipcRenderer.invoke('stats:pipelineValue'),
    overdueInvoices: () => ipcRenderer.invoke('stats:overdueInvoices'),
    contractAlerts: () => ipcRenderer.invoke('stats:contractAlerts'),
  },
  backup: {
    export: () => ipcRenderer.invoke('backup:export'),
    import: () => ipcRenderer.invoke('backup:import'),
    openDataFolder: () => ipcRenderer.invoke('backup:openDataFolder'),
  },
  ai: {
    status: () => ipcRenderer.invoke('ai:status'),
    setProvider: (p: string) => ipcRenderer.invoke('ai:setProvider', p),
    setKey: (provider: string, key: string) => ipcRenderer.invoke('ai:setKey', provider, key),
    clearKey: (provider: string) => ipcRenderer.invoke('ai:clearKey', provider),
    setModel: (provider: string, model: string) => ipcRenderer.invoke('ai:setModel', provider, model),
    testKey: (provider: string, key: string) => ipcRenderer.invoke('ai:testKey', provider, key),
    listOllamaModels: (url?: string) => ipcRenderer.invoke('ai:listOllamaModels', url),
    generatePlan: (opts: any) => ipcRenderer.invoke('ai:generatePlan', opts),
    onPlanProgress: (cb: (p: { batch: number; total: number; label: string; collected: number }) => void) => {
      const l = (_e: any, p: any) => cb(p);
      ipcRenderer.on('ai:plan-progress', l);
      return () => ipcRenderer.removeListener('ai:plan-progress', l);
    },
    onPlanChunk: (cb: (p: { text: string }) => void) => {
      const l = (_e: any, p: any) => cb(p);
      ipcRenderer.on('ai:plan-chunk', l);
      return () => ipcRenderer.removeListener('ai:plan-chunk', l);
    },
    generate: (opts: any, requestId: string) => ipcRenderer.invoke('ai:generate', opts, requestId),
    onChunk: (cb: (p: { requestId: string; text: string }) => void) => {
      const l = (_e: any, p: any) => cb(p);
      ipcRenderer.on('ai:chunk', l);
      return () => ipcRenderer.removeListener('ai:chunk', l);
    },
    onDone: (cb: (p: { requestId: string; text: string; usage?: any }) => void) => {
      const l = (_e: any, p: any) => cb(p);
      ipcRenderer.on('ai:done', l);
      return () => ipcRenderer.removeListener('ai:done', l);
    },
    onError: (cb: (p: { requestId: string; error: string }) => void) => {
      const l = (_e: any, p: any) => cb(p);
      ipcRenderer.on('ai:error', l);
      return () => ipcRenderer.removeListener('ai:error', l);
    },
  },
  seo: {
    status: (p?: string) => ipcRenderer.invoke('seo:status', p),
    launch: (p?: string) => ipcRenderer.invoke('seo:launch', p),
    openInBrowser: () => ipcRenderer.invoke('seo:openInBrowser'),
    setPath: () => ipcRenderer.invoke('seo:setPath'),
  },
  content: {
    list: (filter?: any) => ipcRenderer.invoke('content:list', filter),
    create: (data: any) => ipcRenderer.invoke('content:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('content:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('content:delete', id),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
