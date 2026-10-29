import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import type { Client } from '../types';

interface Ctx {
  clients: Client[];
  activeClientId: number | null;
  setActiveClientId: (id: number | null) => void;
  activeClient: Client | null;
  refresh: () => Promise<void>;
}

const ClientContext = createContext<Ctx | null>(null);

export function ClientProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClientId, setActiveClientIdState] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const list = await window.api.clients.list();
    setClients(list);
  }, []);

  useEffect(() => {
    refresh();
    window.api.settings.get('activeClientId').then((v) => {
      if (v) setActiveClientIdState(Number(v));
    });
  }, [refresh]);

  const setActiveClientId = (id: number | null) => {
    setActiveClientIdState(id);
    window.api.settings.set('activeClientId', id === null ? '' : String(id));
  };

  const activeClient = clients.find((c) => c.id === activeClientId) ?? null;

  return (
    <ClientContext.Provider
      value={{ clients, activeClientId, setActiveClientId, activeClient, refresh }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useClients() {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error('useClients must be inside ClientProvider');
  return ctx;
}
