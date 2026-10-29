import { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'setup',         label: 'Campaign Setup',  icon: '📋' },
  { id: 'contacts',      label: 'Upload Contacts', icon: '👥' },
  { id: 'preview',       label: 'Preview Drafts',  icon: '✉️' },
  { id: 'send',          label: 'Send & Export',   icon: '🚀' },
  { id: 'conversations', label: 'Conversations',   icon: '📬' },
];

const TONES = [
  { value: 'professional', label: 'Professional', desc: 'Formal and polished'  },
  { value: 'friendly',     label: 'Friendly',     desc: 'Warm and approachable'},
  { value: 'direct',       label: 'Direct',       desc: 'Brief and to the point'},
  { value: 'warm',         label: 'Warm',         desc: 'Personal and caring'  },
];

const DEFAULT_FORM = {
  mission: '', sender_name: 'A1 SEO Dynamics', sender_company: 'A1 SEO Dynamics',
  offer: '', call_to_action: 'would you be open to a quick 15-minute call next week',
  tone: 'professional', signature: '', sender_email: '',
};

const STATUS_COLORS = {
  active:        'badge-active',
  progressing:   'badge-progressing',
  not_interested:'badge-closed',
  closed:        'badge-closed',
  limit_reached: 'badge-warn',
  out_of_office: 'badge-warn',
};

const STATUS_LABELS = {
  active:        'Active',
  progressing:   '🔥 Progressing',
  not_interested:'Not Interested',
  closed:        'Closed',
  limit_reached: 'Limit Reached',
};

// ─── Reusable components ──────────────────────────────────────────────────────

function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`toast toast-${type}`}>
      <span>{type === 'success' ? '✅' : '❌'}</span>
      <span>{message}</span>
      <button onClick={onClose} className="toast-close">×</button>
    </div>
  );
}

function PendingReplyCard({ email, pending, onApprove, onCancel }) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [editedBody, setEditedBody] = useState(pending.body);

  useEffect(() => {
    setEditedBody(pending.body);
    const generatedAt = new Date(pending.generated_at).getTime();
    const updateTime = () => {
      const now = Date.now();
      const diff = 300000 - (now - generatedAt); // 5 mins = 300,000 ms
      setTimeLeft(Math.max(0, diff));
    };
    updateTime();
    const int = setInterval(updateTime, 1000);
    return () => clearInterval(int);
  }, [pending]);

  const mins = Math.floor(timeLeft / 60000);
  const secs = Math.floor((timeLeft % 60000) / 1000).toString().padStart(2, '0');

  return (
    <div className="conv-msg" style={{border: '2px solid var(--primary)', background: 'rgba(5, 150, 105, 0.05)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem'}}>
        <strong>⏳ Draft Pending Approval</strong>
        <span style={{color: 'var(--primary)', fontWeight: 'bold'}}>
          Sends automatically in {mins}:{secs}
        </span>
      </div>
      <div>
        <label style={{fontSize:'0.8rem', fontWeight:'bold', color:'var(--muted)'}}>Subject: {pending.subject}</label>
      </div>
      <textarea
        style={{width:'100%', minHeight:'120px', marginTop:'0.5rem', padding:'0.5rem', borderRadius:'4px', border:'1px solid var(--border)'}}
        value={editedBody}
        onChange={e => setEditedBody(e.target.value)}
      />
      <div style={{display:'flex', gap:'0.5rem', marginTop:'0.5rem'}}>
        <button className="btn btn-primary btn-sm" onClick={() => onApprove(email, editedBody)}>✅ Approve & Send</button>
        <button className="btn btn-ghost btn-sm" onClick={() => onCancel(email)}>❌ Cancel</button>
      </div>
    </div>
  );
}

function StepIndicator({ steps, current, completed, onNavigate }) {
  return (
    <div className="step-indicator">
      {steps.map((step, i) => {
        const isDone   = completed.includes(step.id);
        const isActive = current === step.id;
        const canClick = isDone || step.id === 'conversations';
        return (
          <div key={step.id} className={`step-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
            <button
              className="step-circle-btn"
              onClick={() => canClick && onNavigate(step.id)}
              style={{ cursor: canClick ? 'pointer' : 'default' }}
              title={canClick ? `Go to ${step.label}` : undefined}
            >
              <div className="step-circle">{isDone ? '✓' : step.icon}</div>
            </button>
            <span className="step-label">{step.label}</span>
            {i < steps.length - 1 && <div className={`step-line ${isDone ? 'done' : ''}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Setup ────────────────────────────────────────────────────────────

function SetupStep({ formData, onChange, onNext }) {
  const [errors, setErrors] = useState({});
  const validate = () => {
    const e = {};
    if (!formData.mission.trim())        e.mission = 'Required.';
    if (!formData.offer.trim())          e.offer   = 'Required.';
    if (!formData.call_to_action.trim()) e.cta     = 'Required.';
    return e;
  };
  const next = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({}); onNext();
  };
  return (
    <div className="step-content">
      <div className="step-header">
        <h2>📋 Campaign Setup</h2>
        <p>Define who you are and what this campaign is about. The AI will use all of this to write unique emails for each lead.</p>
      </div>
      <div className="field-section">
        <h3>Sender</h3>
        <div className="field-row">
          <div className="field-group"><label>Your Name</label><input className="field-input" type="text" name="sender_name" value={formData.sender_name} onChange={onChange} /></div>
          <div className="field-group"><label>Company</label><input className="field-input" type="text" name="sender_company" value={formData.sender_company} onChange={onChange} /></div>
        </div>
      </div>
      <div className="field-section">
        <h3>Mission</h3>
        <p className="field-hint">What does your company do and who do you help?</p>
        <textarea className={`field-input field-textarea ${errors.mission ? 'field-error' : ''}`} name="mission" rows={3} value={formData.mission} onChange={onChange} placeholder="we help SaaS companies book more demos with SEO and targeted outreach" />
        {errors.mission && <span className="error-msg">{errors.mission}</span>}
      </div>
      <div className="field-section">
        <h3>Offer</h3>
        <p className="field-hint">What specific value are you giving this person?</p>
        <textarea className={`field-input field-textarea ${errors.offer ? 'field-error' : ''}`} name="offer" rows={2} value={formData.offer} onChange={onChange} placeholder="a free SEO audit and 3-step lead generation plan" />
        {errors.offer && <span className="error-msg">{errors.offer}</span>}
      </div>
      <div className="field-row">
        <div className="field-group" style={{ flex: 2 }}>
          <label>Call to Action</label>
          <p className="field-hint">What do you want them to do?</p>
          <input className={`field-input ${errors.cta ? 'field-error' : ''}`} type="text" name="call_to_action" value={formData.call_to_action} onChange={onChange} />
          {errors.cta && <span className="error-msg">{errors.cta}</span>}
        </div>
        <div className="field-group">
          <label>Tone</label>
          <p className="field-hint">AI writing style.</p>
          <div className="tone-grid">
            {TONES.map(t => (
              <button key={t.value} type="button" className={`tone-option ${formData.tone === t.value ? 'selected' : ''}`} onClick={() => onChange({ target: { name: 'tone', value: t.value } })}>
                <strong>{t.label}</strong><span>{t.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="field-section">
        <h3>Signature <span className="optional-tag">Optional</span></h3>
        <textarea className="field-input field-textarea" name="signature" rows={2} value={formData.signature} onChange={onChange} placeholder="WhatsApp: +1 234 567 890&#10;Cal.com/yourname" />
      </div>
      <div className="step-actions">
        <button className="btn btn-primary" onClick={next}>Continue to Contacts →</button>
      </div>
    </div>
  );
}

// ─── Step 2: Contacts ─────────────────────────────────────────────────────────

function ContactsStep({ contacts, onGenerate, onGenerateAI, loading, aiLoading, onBack }) {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith('.csv')) setFile(f);
  };

  return (
    <div className="step-content">
      <div className="step-header">
        <h2>👥 Upload Your Leads</h2>
        <p>Upload a CSV. Only <code>email</code> is required — more columns = more personalization for the AI.</p>
      </div>
      <div className="csv-format-card">
        <h4>📌 Supported columns</h4>
        <div className="csv-columns">
          {['email ✱','first_name','last_name','company','role','website','notes'].map(c=>(
            <span key={c} className={`csv-col ${c.includes('✱')?'required':''}`}>{c}</span>
          ))}
        </div>
        <a href="/api/sample-csv" className="link-subtle">⬇ Download sample CSV</a>
      </div>
      <div
        className={`drop-zone ${dragOver?'drag-over':''} ${file?'has-file':''}`}
        onDragOver={e=>{e.preventDefault();setDragOver(true);}}
        onDragLeave={()=>setDragOver(false)}
        onDrop={handleDrop}
        onClick={()=>inputRef.current.click()}
      >
        <input ref={inputRef} type="file" accept=".csv" style={{display:'none'}} onChange={e=>setFile(e.target.files[0])} />
        {file ? <><div className="drop-icon">📄</div><strong>{file.name}</strong><span className="drop-sub">Click to change</span></>
               : <><div className="drop-icon">📂</div><strong>Drag & drop CSV</strong><span className="drop-sub">or click to browse</span></>}
      </div>
      {contacts.length > 0 && (
        <div className="contacts-loaded">
          <h4>✅ {contacts.length} contacts loaded</h4>
          <div className="contacts-mini-table">
            <table>
              <thead><tr><th>Email</th><th>Name</th><th>Company</th><th>Role</th></tr></thead>
              <tbody>{contacts.slice(0,5).map((c,i)=>(
                <tr key={i}><td>{c.email}</td><td>{[c.first_name,c.last_name].filter(Boolean).join(' ')||'—'}</td><td>{c.company||'—'}</td><td>{c.role||'—'}</td></tr>
              ))}</tbody>
            </table>
            {contacts.length > 5 && <p className="table-more">…and {contacts.length-5} more</p>}
          </div>
        </div>
      )}

      {/* Generation mode selection */}
      <div className="gen-mode-cards">
        <div className="gen-mode-card gen-mode-ai">
          <div className="gen-mode-icon">🤖</div>
          <div className="gen-mode-body">
            <h4>AI-Generated <span className="badge-new">Recommended</span></h4>
            <p>GPT-4o writes a unique, deeply personalized email for each contact based on their company, role, and notes. Requires OpenAI API key in .env.</p>
          </div>
          <button className="btn btn-primary" onClick={() => onGenerateAI(file)} disabled={aiLoading || loading || (!file && contacts.length === 0)}>
            {aiLoading ? <><span className="spinner" /> Generating with AI…</> : '🤖 Generate with AI'}
          </button>
        </div>
        <div className="gen-mode-card">
          <div className="gen-mode-icon">📝</div>
          <div className="gen-mode-body">
            <h4>Template-Based</h4>
            <p>Fast, instant generation using the mission, offer, and CTA you entered. Works without an AI key.</p>
          </div>
          <button className="btn btn-outline" onClick={() => onGenerate(file)} disabled={loading || aiLoading || (!file && contacts.length === 0)}>
            {loading ? <><span className="spinner" /> Generating…</> : '📝 Generate from Template'}
          </button>
        </div>
      </div>

      <div className="step-actions">
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
      </div>
    </div>
  );
}

// ─── AI Generation Progress Modal ────────────────────────────────────────────

function AIGenerateProgress({ progress, onClose }) {
  const { items = [], total = 0, done = false, error = null } = progress;
  const completed = items.filter(i => i.status === 'done' || i.status === 'fallback').length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="gmail-overlay">
      <div className="gmail-modal">
        <div className="gmail-modal-header">
          <span className="gmail-modal-icon">🤖</span>
          <div>
            <h3>{done ? 'AI Generation Complete' : 'AI Writing Your Emails…'}</h3>
            <p>{done ? `${completed} emails ready` : 'GPT-4o is crafting personalized copy for each lead'}</p>
          </div>
        </div>
        {error && <div className="gmail-error">❌ {error}</div>}
        <div className="gmail-progress-bar-track">
          <div className="gmail-progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="gmail-progress-pct">{pct}% — {completed} of {total}</div>
        <div className="gmail-email-list">
          {items.map((item, i) => (
            <div key={i} className={`gmail-email-item gmail-email-${item.status === 'done' ? 'sent' : item.status === 'fallback' ? 'failed' : 'sending'}`}>
              <span className="gmail-email-icon">{item.status==='done'?'✅':item.status==='fallback'?'⚠️':'⏳'}</span>
              <span className="gmail-email-addr">{item.email}</span>
              {item.subject && <span style={{fontSize:'0.78rem',color:'var(--muted)',marginLeft:'auto'}}>{item.subject?.slice(0,40)}</span>}
            </div>
          ))}
        </div>
        {done && <button className="btn btn-primary" style={{marginTop:20,width:'100%'}} onClick={onClose}>View Drafts →</button>}
      </div>
    </div>
  );
}

// ─── Step 3: Preview ──────────────────────────────────────────────────────────

function PreviewStep({ drafts, onUpdateDraft, onNext, onBack }) {
  const [active, setActive] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (drafts[active]) {
      setEditedSubject(drafts[active].subject);
      setEditedBody(drafts[active].body);
      setIsEditing(false);
    }
  }, [active, drafts]);

  if (!drafts.length) return (
    <div className="step-content">
      <div className="step-header"><h2>✉️ Draft Preview</h2><p>No drafts yet — go back and generate them first.</p></div>
      <div className="step-actions"><button className="btn btn-ghost" onClick={onBack}>← Back</button></div>
    </div>
  );

  const draft = drafts[active];

  const handleSave = async () => {
    setSaving(true);
    const success = await onUpdateDraft(draft.email, editedSubject, editedBody);
    if (success) setIsEditing(false);
    setSaving(false);
  };

  return (
    <div className="step-content">
      <div className="step-header">
        <h2>✉️ Preview Drafts</h2>
        <p>Review every personalized email. Click a name on the left to read that message. You can now edit the copy directly!</p>
      </div>
      <div className="preview-layout">
        <div className="draft-sidebar">
          <div className="draft-count">{drafts.length} emails ready</div>
          {drafts.map((d,i)=>(
            <button key={i} type="button" className={`draft-row ${active===i?'active':''}`} onClick={()=>setActive(i)}>
              <div className="draft-row-email">{d.email}</div>
              <div className="draft-row-subject">{d.subject}</div>
              <span className={`badge badge-${d.status}`}>{d.status}</span>
            </button>
          ))}
        </div>
        <div className="draft-viewer">
          <div className="draft-meta-row">
            <div className="meta-item"><span>To</span><strong>{draft.email}</strong></div>
            <div className="meta-item" style={{flex: 1}}>
              <span>Subject</span>
              {isEditing ? (
                <input
                  className="field-input field-small"
                  style={{width: '100%', fontWeight: 'bold', marginTop: '4px'}}
                  value={editedSubject}
                  onChange={e => setEditedSubject(e.target.value)}
                />
              ) : (
                <strong>{draft.subject}</strong>
              )}
            </div>
            <div className="meta-item"><span>Status</span><span className={`badge badge-${draft.status}`}>{draft.status}</span></div>
          </div>
          
          {isEditing ? (
            <textarea
              className="field-input draft-body-edit"
              style={{width:'100%', minHeight:'300px', marginTop:'1rem', padding:'1rem', fontFamily:'inherit', lineHeight:1.6}}
              value={editedBody}
              onChange={e => setEditedBody(e.target.value)}
            />
          ) : (
            <pre className="draft-body">{draft.body}</pre>
          )}

          <div className="draft-viewer-actions" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'1.5rem', borderTop:'1px solid var(--border)', paddingTop:'1.5rem'}}>
            <div style={{display:'flex', gap:'0.75rem'}}>
              {isEditing ? (
                <>
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? <><span className="spinner"/> Saving…</> : '💾 Save Changes'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => { setIsEditing(false); setEditedSubject(draft.subject); setEditedBody(draft.body); }} disabled={saving}>
                    Cancel
                  </button>
                </>
              ) : (
                <button className="btn btn-outline" onClick={() => setIsEditing(true)}>
                  ✏️ Edit Draft
                </button>
              )}
            </div>
            {!isEditing && (
              <a href={draft.gmail_url} target="_blank" rel="noreferrer" className="btn btn-outline">📨 Open in Gmail</a>
            )}
          </div>
        </div>
      </div>
      <div className="step-actions">
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn btn-primary" onClick={onNext} disabled={isEditing}>Continue to Send →</button>
      </div>
    </div>
  );
}

// ─── Gmail Send Progress Modal ────────────────────────────────────────────────

function GmailProgress({ progress, onClose }) {
  const { items=[], total=0, done=false, sent=0, failed=0, error=null } = progress;
  const pct = total > 0 ? Math.round((items.length / total) * 100) : 0;
  return (
    <div className="gmail-overlay">
      <div className="gmail-modal">
        <div className="gmail-modal-header">
          <span className="gmail-modal-icon">📧</span>
          <div>
            <h3>{done ? 'Sending Complete' : 'Sending via Gmail…'}</h3>
            <p>{done ? `${sent} sent · ${failed} failed` : 'Chrome is composing and sending your emails'}</p>
          </div>
        </div>
        {error && <div className="gmail-error">❌ {error}</div>}
        {!error && <>
          <div className="gmail-progress-bar-track"><div className="gmail-progress-bar-fill" style={{width:`${pct}%`}} /></div>
          <div className="gmail-progress-pct">{pct}% — {items.length} of {total}</div>
          <div className="gmail-email-list">
            {items.map((item,i)=>(
              <div key={i} className={`gmail-email-item gmail-email-${item.status}`}>
                <span className="gmail-email-icon">{item.status==='sent'?'✅':item.status==='failed'?'❌':'⏳'}</span>
                <span className="gmail-email-addr">{item.email}</span>
                {item.error && <span className="gmail-email-err">{item.error}</span>}
              </div>
            ))}
          </div>
        </>}
        {(done || error) ? <button className="btn btn-primary" style={{marginTop:20,width:'100%'}} onClick={onClose}>Done</button>
                         : <p className="gmail-notice">⚠️ Do not close Chrome while sending.</p>}
      </div>
    </div>
  );
}

// ─── Step 4: Send ─────────────────────────────────────────────────────────────

function SendStep({ drafts, formData, onChange, onSMTP, loading, onBack, onDraftsUpdate }) {
  const sentCount   = drafts.filter(d=>d.status==='sent').length;
  const failedCount = drafts.filter(d=>d.status==='failed').length;
  const [gmailLimit, setGmailLimit] = useState(Math.min(5, drafts.length));
  const [gmailProgress, setGmailProgress] = useState(null);
  const esRef = useRef(null);

  const handleGmailSend = () => {
    if (esRef.current) esRef.current.close();
    setGmailProgress({ items:[], total:gmailLimit, done:false, sent:0, failed:0, error:null });
    const es = new EventSource(`/api/send-gmail?limit=${gmailLimit}`);
    esRef.current = es;
    es.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      if (data.fatal) { setGmailProgress(p=>({...p,done:true,error:data.error})); es.close(); return; }
      if (data.done)  { setGmailProgress(p=>({...p,done:true,sent:data.sent,failed:data.failed})); fetch('/api/state').then(r=>r.json()).then(s=>onDraftsUpdate(s.drafts||[])); es.close(); return; }
      if (data.status) {
        setGmailProgress(p => {
          const items = p.items.filter(it=>it.index!==data.index || data.status==='sending');
          if (data.status !== 'sending') items.push(data);
          return {...p, items, total:data.total};
        });
      }
    };
    es.onerror = () => { setGmailProgress(p=>p?.done?p:{...p,done:true,error:'Connection to server lost.'}); es.close(); };
  };

  return (
    <>
      {gmailProgress && <GmailProgress progress={gmailProgress} onClose={()=>setGmailProgress(null)} />}
      <div className="step-content">
        <div className="step-header">
          <h2>🚀 Send & Export</h2>
          <p>Choose how to deliver your emails. The inbox monitor (next tab) will watch for replies and auto-respond 24/7.</p>
        </div>
        {(sentCount > 0 || failedCount > 0) && (
          <div className="send-result">✅ <strong>{sentCount} sent</strong>{failedCount>0&&<>&nbsp;·❌<strong>{failedCount} failed</strong></>}</div>
        )}
        <div className="send-cards">
          <div className="send-card send-card-featured">
            <div className="send-card-badge">Recommended</div>
            <div className="send-card-icon">🤖</div>
            <h3>Gmail Automation</h3>
            <p>Controls Chrome directly to send from your Gmail account.<br/><strong>Close all Chrome windows first.</strong></p>
            <div className="send-card-actions">
              <div className="gmail-limit-row">
                <label htmlFor="gmailLimit">Emails to send</label>
                <input id="gmailLimit" type="number" min={1} max={drafts.length} value={gmailLimit} onChange={e=>setGmailLimit(Math.max(1,Math.min(drafts.length,Number(e.target.value))))} className="field-input field-small" style={{width:80}} />
                <span className="gmail-limit-of">of {drafts.length}</span>
              </div>
              <button className="btn btn-primary" onClick={handleGmailSend} disabled={!drafts.length}>🤖 Send via Gmail</button>
            </div>
          </div>
          <div className="send-card">
            <div className="send-card-icon">📥</div>
            <h3>Export</h3>
            <p>Download your {drafts.length} emails to review or import elsewhere.</p>
            <div className="send-card-actions">
              <a href="/api/download/csv"  className="btn btn-outline">⬇ CSV</a>
              <a href="/api/download/json" className="btn btn-outline">⬇ JSON</a>
            </div>
          </div>
          <div className="send-card">
            <div className="send-card-icon">⚡</div>
            <h3>SMTP Send</h3>
            <p>Send via SMTP credentials in your <code>.env</code> file.</p>
            <div className="send-card-actions">
              <div className="field-group" style={{margin:0}}><label>Sender Email</label><input className="field-input" type="email" name="sender_email" value={formData.sender_email} onChange={onChange} placeholder="you@example.com" /></div>
              <button className="btn btn-outline" onClick={onSMTP} disabled={loading||!formData.sender_email}>
                {loading ? <><span className="spinner"/>Sending…</> : '⚡ Send via SMTP'}
              </button>
            </div>
          </div>
        </div>
        <div className="step-actions">
          <button className="btn btn-ghost" onClick={onBack}>← Back</button>
          <button className="btn btn-primary" style={{background:'linear-gradient(135deg,#059669,#065f46)'}} onClick={() => {}}>
            <span onClick={() => document.querySelector('[data-step="conversations"]')?.click()}>View Conversations →</span>
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Step 5: Conversations ────────────────────────────────────────────────────

function ConversationsStep({ onBack }) {
  const [monitorStatus, setMonitorStatus] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [loadingToggle, setLoadingToggle] = useState(false);
  const pollRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([
        fetch('/api/inbox/status').then(r=>r.json()),
        fetch('/api/conversations').then(r=>r.json()),
      ]);
      setMonitorStatus(s);
      setConversations(c.conversations || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Poll every 30s to refresh conversation state
    pollRef.current = setInterval(fetchStatus, 30000);
    return () => clearInterval(pollRef.current);
  }, [fetchStatus]);

  const toggleMonitor = async () => {
    setLoadingToggle(true);
    const action = monitorStatus?.running ? 'stop' : 'start';
    try {
      await fetch(`/api/inbox/${action}`, { method: 'POST' });
      await fetchStatus();
    } catch { /* ignore */ }
    setLoadingToggle(false);
  };

  const handleApprovePending = async (email, body) => {
    try {
      await fetch(`/api/conversations/${encodeURIComponent(email)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body })
      });
      fetchStatus();
    } catch { /* ignore */ }
  };

  const handleCancelPending = async (email) => {
    try {
      await fetch(`/api/conversations/${encodeURIComponent(email)}/cancel`, { method: 'POST' });
      fetchStatus();
    } catch { /* ignore */ }
  };

  const selectedConv = conversations.find(c => c.email === selectedEmail);

  const statusCounts = {
    active:       conversations.filter(c=>c.status==='active').length,
    progressing:  conversations.filter(c=>c.status==='progressing').length,
    closed:       conversations.filter(c=>['not_interested','closed','limit_reached'].includes(c.status)).length,
  };

  return (
    <div className="step-content">
      <div className="step-header">
        <h2>📬 Conversations</h2>
        <p>The inbox monitor watches your Gmail for replies and auto-responds using AI — your 24/7 virtual sales rep.</p>
      </div>

      {/* Monitor control */}
      <div className={`monitor-card ${monitorStatus?.running ? 'monitor-running' : 'monitor-stopped'}`}>
        <div className="monitor-info">
          <div className={`monitor-dot ${monitorStatus?.running ? 'dot-live' : 'dot-off'}`} />
          <div>
            <strong>{monitorStatus?.running ? 'Inbox Monitor Running' : 'Inbox Monitor Stopped'}</strong>
            <p className="monitor-sub">
              {monitorStatus?.running
                ? `Checking every ${monitorStatus.poll_interval_seconds / 60} min · Last checked: ${monitorStatus.last_checked ? new Date(monitorStatus.last_checked).toLocaleTimeString() : 'never'}`
                : 'Start to watch for replies and auto-respond automatically'}
            </p>
          </div>
        </div>
        <button className={`btn ${monitorStatus?.running ? 'btn-danger-outline' : 'btn-primary'}`} onClick={toggleMonitor} disabled={loadingToggle}>
          {loadingToggle ? <span className="spinner" /> : monitorStatus?.running ? '⏹ Stop Monitor' : '▶ Start Monitor'}
        </button>
      </div>

      {/* Stats row */}
      {conversations.length > 0 && (
        <div className="conv-stats">
          <div className="conv-stat"><span>{conversations.length}</span><label>Total Threads</label></div>
          <div className="conv-stat conv-stat-hot"><span>{statusCounts.progressing}</span><label>Progressing 🔥</label></div>
          <div className="conv-stat"><span>{statusCounts.active}</span><label>Active</label></div>
          <div className="conv-stat conv-stat-muted"><span>{statusCounts.closed}</span><label>Closed</label></div>
        </div>
      )}

      {conversations.length === 0 ? (
        <div className="conv-empty">
          <div style={{fontSize:'2.5rem'}}>📭</div>
          <strong>No conversations yet</strong>
          <p>Send your campaign then start the inbox monitor. Replies will appear here and get auto-responded.</p>
        </div>
      ) : (
        <div className="conv-layout">
          {/* Left: thread list */}
          <div className="conv-list">
            {conversations.map(conv => (
              <button key={conv.email} type="button" className={`conv-item ${selectedEmail===conv.email?'active':''}`} onClick={()=>setSelectedEmail(conv.email)}>
                <div className="conv-item-header">
                  <span className="conv-email">{conv.email}</span>
                  <span className={`badge ${STATUS_COLORS[conv.status]||'badge-active'}`}>{STATUS_LABELS[conv.status]||conv.status}</span>
                </div>
                <div className="conv-item-foot">
                  <span>{conv.messages?.length||0} messages</span>
                  {conv.pending_auto_reply 
                    ? <span style={{color:'var(--primary)', fontWeight:'bold'}}>⏳ 1 pending reply</span> 
                    : <span>{conv.auto_reply_count} auto-replies</span>}
                </div>
              </button>
            ))}
          </div>

          {/* Right: thread view */}
          <div className="conv-thread">
            {selectedConv ? (
              <>
                <div className="conv-thread-header">
                  <strong>{selectedConv.email}</strong>
                  <span className={`badge ${STATUS_COLORS[selectedConv.status]||'badge-active'}`}>{STATUS_LABELS[selectedConv.status]||selectedConv.status}</span>
                </div>
                <div className="conv-messages">
                  {selectedConv.pending_auto_reply && (
                    <PendingReplyCard
                      email={selectedConv.email}
                      pending={selectedConv.pending_auto_reply}
                      onApprove={handleApprovePending}
                      onCancel={handleCancelPending}
                    />
                  )}
                  {selectedConv.messages?.map((msg, i) => (
                    <div key={i} className={`conv-msg conv-msg-${msg.direction}`}>
                      <div className="conv-msg-meta">
                        <span>{msg.direction === 'sent' ? '📤 You' : '📥 Them'}</span>
                        <span className="conv-msg-class">{msg.classification||''}</span>
                        <span>{msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}</span>
                      </div>
                      <pre className="conv-msg-body">{msg.body}</pre>
                      {msg.error && <div className="conv-msg-error">⚠️ {msg.error}</div>}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="conv-thread-empty">← Select a contact to view the full conversation thread</div>
            )}
          </div>
        </div>
      )}

      <div className="step-actions">
        <button className="btn btn-ghost" onClick={onBack}>← Back to Send</button>
        <button className="btn btn-ghost" onClick={fetchStatus}>🔄 Refresh</button>
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [step, setStep]               = useState('setup');
  const [completed, setCompleted]     = useState([]);
  const [formData, setFormData]       = useState(DEFAULT_FORM);
  const [contacts, setContacts]       = useState([]);
  const [drafts, setDrafts]           = useState([]);
  const [loading, setLoading]         = useState(false);
  const [aiLoading, setAiLoading]     = useState(false);
  const [aiProgress, setAiProgress]   = useState(null);
  const [toast, setToast]             = useState(null);
  const aiEsRef = useRef(null);

  useEffect(() => {
    fetch('/api/state').then(r=>r.json()).then(data => {
      if (data.form_data && Object.keys(data.form_data).length) setFormData(p=>({...p,...data.form_data}));
      if (data.contacts?.length) setContacts(data.contacts);
      if (data.drafts?.length)   { setDrafts(data.drafts); setCompleted(['setup','contacts','preview']); }
    }).catch(()=>{});
  }, []);

  const showToast = (msg, type='success') => setToast({ message:msg, type });
  const handleChange = e => setFormData(p=>({...p,[e.target.name]:e.target.value}));
  const markDone = id => setCompleted(p=>p.includes(id)?p:[...p,id]);
  const goTo = id => { setStep(id); window.scrollTo({top:0,behavior:'smooth'}); };

  // Template generate
  const handleGenerate = async (file) => {
    setLoading(true);
    const data = new FormData();
    Object.keys(formData).forEach(k=>data.append(k,formData[k]));
    if (file) data.append('contacts_file',file);
    try {
      const res = await fetch('/api/generate',{method:'POST',body:data});
      const result = await res.json();
      if (!res.ok) showToast(result.error,'error');
      else { setContacts(result.contacts); setDrafts(result.drafts); showToast(result.message,'success'); markDone('setup'); markDone('contacts'); goTo('preview'); }
    } catch(err) { showToast(String(err),'error'); }
    setLoading(false);
  };

  // AI generate via SSE
  const handleGenerateAI = (file) => {
    if (!file && contacts.length === 0) return;
    if (aiEsRef.current) aiEsRef.current.close();

    const formPayload = new FormData();
    Object.keys(formData).forEach(k => formPayload.append(k, formData[k]));
    if (file) formPayload.append('contacts_file', file);

    setAiLoading(true);
    setAiProgress({ items:[], total:0, done:false, error:null });

    // POST to generate-ai then read SSE
    fetch('/api/generate-ai', { method:'POST', body:formPayload })
      .then(res => {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const read = () => reader.read().then(({ done, value }) => {
          if (done) { setAiLoading(false); return; }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            try {
              const data = JSON.parse(line.slice(5).trim());
              if (data.done) {
                setContacts(data.contacts);
                setDrafts(data.drafts);
                setAiProgress(p=>({...p, done:true, total:data.drafts?.length||0}));
                markDone('setup'); markDone('contacts');
                setAiLoading(false);
              } else if (data.index !== undefined) {
                setAiProgress(p => ({
                  ...p,
                  total: data.total,
                  items: [...p.items.filter(i=>i.index!==data.index), data],
                }));
              }
            } catch { /* skip malformed event */ }
          }
          read();
        });
        read();
      })
      .catch(err => { showToast(String(err),'error'); setAiLoading(false); });
  };

  const handleSMTP = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/send-smtp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sender_email:formData.sender_email})});
      const result = await res.json();
      if (!res.ok) showToast(result.error,'error');
      else { setDrafts(result.drafts); showToast(result.message,'success'); markDone('send'); }
    } catch(err) { showToast(String(err),'error'); }
    setLoading(false);
  };

  const handleUpdateDraft = async (email, subject, body) => {
    try {
      const res = await fetch('/api/drafts/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, subject, body })
      });
      const result = await res.json();
      if (!res.ok) {
        showToast(result.error, 'error');
        return false;
      }
      setDrafts(result.drafts);
      showToast('Draft saved successfully.', 'success');
      return true;
    } catch (err) {
      showToast(String(err), 'error');
      return false;
    }
  };

  const handleReset = async () => {
    await fetch('/api/reset',{method:'POST'});
    setContacts([]); setDrafts([]); setCompleted([]);
    showToast('Session reset.','success'); goTo('setup');
  };

  return (
    <div className="app-shell">
      {toast && <Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)} />}
      {aiProgress && <AIGenerateProgress progress={aiProgress} onClose={()=>{ setAiProgress(null); if (drafts.length) goTo('preview'); }} />}

      <nav className="top-nav">
        <div className="nav-brand">
          <span className="nav-logo">A1</span>
          <div><div className="nav-title">A1 SEO Dynamics</div><div className="nav-sub">AI Marketing Agent</div></div>
        </div>
        <div className="nav-right">
          {drafts.length > 0 && <div className="nav-stats"><span>👥 {contacts.length}</span><span>✉️ {drafts.length}</span></div>}
          {drafts.length > 0 && <button className="btn btn-ghost btn-sm" onClick={handleReset}>Reset</button>}
        </div>
      </nav>

      <div className="page-body">
        <StepIndicator steps={STEPS} current={step} completed={completed} onNavigate={goTo} />
        <div className="card">
          {step==='setup'         && <SetupStep         formData={formData} onChange={handleChange} onNext={()=>{markDone('setup');goTo('contacts');}} />}
          {step==='contacts'      && <ContactsStep      contacts={contacts} loading={loading} aiLoading={aiLoading} onGenerate={handleGenerate} onGenerateAI={handleGenerateAI} onBack={()=>goTo('setup')} />}
          {step==='preview'       && <PreviewStep       drafts={drafts} onUpdateDraft={handleUpdateDraft} onNext={()=>{markDone('preview');goTo('send');}} onBack={()=>goTo('contacts')} />}
          {step==='send'          && <SendStep          drafts={drafts} formData={formData} onChange={handleChange} onSMTP={handleSMTP} loading={loading} onBack={()=>goTo('preview')} onDraftsUpdate={setDrafts} />}
          {step==='conversations' && <ConversationsStep onBack={()=>goTo('send')} />}
        </div>
      </div>
    </div>
  );
}
