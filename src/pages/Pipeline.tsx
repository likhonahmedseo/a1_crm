import { useEffect, useState, useCallback, useRef } from 'react';
import { useClients } from '../state/ClientContext';
import { useAgency } from '../state/AgencyContext';
import type { Client, PipelineStage } from '../types';

const STAGES: { id: PipelineStage; label: string; color: string }[] = [
  { id: 'lead', label: 'Lead', color: 'bg-slate-500' },
  { id: 'contacted', label: 'Contacted', color: 'bg-blue-500' },
  { id: 'proposal', label: 'Proposal', color: 'bg-amber-500' },
  { id: 'won', label: 'Won', color: 'bg-emerald-500' },
  { id: 'lost', label: 'Lost', color: 'bg-red-500' },
];

export default function Pipeline() {
  const { clients, refresh } = useClients();
  const { agency } = useAgency();
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [overStage, setOverStage] = useState<PipelineStage | null>(null);
  const lastMove = useRef(0);

  const grouped: Record<string, Client[]> = {};
  for (const s of STAGES) grouped[s.id] = [];
  for (const c of clients) {
    const stage = (c.stage || 'lead') as PipelineStage;
    if (grouped[stage]) grouped[stage].push(c);
    else grouped['lead'].push(c);
  }

  const stageTotal = (stage: PipelineStage) =>
    grouped[stage].reduce((s, c) => s + (Number(c.deal_value) || 0), 0);

  const onDragStart = (e: React.DragEvent, id: number) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e: React.DragEvent, stage: PipelineStage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overStage !== stage && Date.now() - lastMove.current > 16) {
      setOverStage(stage);
      lastMove.current = Date.now();
    }
  };
  const onDrop = async (e: React.DragEvent, stage: PipelineStage) => {
    e.preventDefault();
    setOverStage(null);
    if (draggingId === null) return;
    const client = clients.find((c) => c.id === draggingId);
    if (client && client.stage !== stage) {
      await window.api.clients.setStage(draggingId, stage);
      await refresh();
    }
    setDraggingId(null);
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Sales Pipeline</h1>
        <p className="text-sm text-slate-500">Drag clients between stages to update their deal status.</p>
      </div>
      <div className="flex-1 grid grid-cols-5 gap-3 overflow-x-auto min-h-0">
        {STAGES.map((s) => (
          <div
            key={s.id}
            onDragOver={(e) => onDragOver(e, s.id)}
            onDragLeave={() => setOverStage(null)}
            onDrop={(e) => onDrop(e, s.id)}
            className={`flex flex-col bg-slate-50 border ${
              overStage === s.id ? 'border-brand-500 ring-2 ring-brand-200' : 'border-slate-200'
            } rounded-lg min-h-[200px]`}
          >
            <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${s.color}`} />
                <span className="font-semibold text-sm">{s.label}</span>
                <span className="text-xs text-slate-500">{grouped[s.id].length}</span>
              </div>
              <div className="text-xs text-slate-500">
                {agency.currency} {stageTotal(s.id).toLocaleString()}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {grouped[s.id].length === 0 && (
                <div className="text-xs text-slate-400 text-center py-4">Drop clients here</div>
              )}
              {grouped[s.id].map((c) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, c.id)}
                  onDragEnd={() => { setDraggingId(null); setOverStage(null); }}
                  className={`bg-white border border-slate-200 rounded-md p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition ${
                    draggingId === c.id ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                    <div className="font-medium text-sm flex-1 truncate">{c.name}</div>
                  </div>
                  {c.company && <div className="text-xs text-slate-500 mt-0.5 truncate">{c.company}</div>}
                  {c.deal_value > 0 && (
                    <div className="text-xs font-semibold text-emerald-600 mt-1.5">
                      {agency.currency} {Number(c.deal_value).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
