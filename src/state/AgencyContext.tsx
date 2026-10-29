import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import type { AgencyInfo } from '../types';

interface Ctx {
  agency: AgencyInfo;
  refresh: () => Promise<void>;
}

const AgencyContext = createContext<Ctx | null>(null);

const empty: AgencyInfo = {
  name: 'A1 Technovation',
  address: '',
  email: '',
  phone: '',
  website: '',
  currency: 'USD',
  logo_data_url: '',
  primary_color: '#3b6ef5',
  invoice_footer: '',
  invoice_prefix: 'INV-',
};

export function AgencyProvider({ children }: { children: ReactNode }) {
  const [agency, setAgency] = useState<AgencyInfo>(empty);

  const refresh = useCallback(async () => {
    const a = await window.api.agency.get();
    setAgency(a);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <AgencyContext.Provider value={{ agency, refresh }}>{children}</AgencyContext.Provider>;
}

export function useAgency() {
  const ctx = useContext(AgencyContext);
  if (!ctx) throw new Error('useAgency must be inside AgencyProvider');
  return ctx;
}
