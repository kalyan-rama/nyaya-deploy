// src/components/GovtPortalScreen.jsx
import React from 'react';
import { useApp } from '../contexts/AppContext';

const STATUS_META = {
  pending:   { bg: '#FFF7ED', color: '#C2410C', label: 'Pending' },
  enquiry:   { bg: '#EFF6FF', color: '#1D4ED8', label: 'Enquiry' },
  confirmed: { bg: '#ECFDF5', color: '#065F46', label: 'Confirmed' },
  resolved:  { bg: '#F3F4F6', color: '#374151', label: 'Resolved' },
};

export default function GovtPortalScreen() {
  const { navigate, complaints, updateComplaintStatus } = useApp();

  const total    = complaints.length;
  const pending  = complaints.filter(c => c.status !== 'resolved').length;
  const resolved = complaints.filter(c => c.status === 'resolved').length;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <button style={S.back} onClick={() => navigate('home')}>‹</button>
          <div style={{ width: 44, height: 44, background: 'white', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🏛️</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "'Playfair Display',serif", color: 'white' }}>Government Portal</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Ministry of Home Affairs · Complaint Oversight</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>Complaints received via NYAYA platform</div>
        <div style={S.statsRow}>
          <div style={S.stat}><div style={S.statVal}>{total}</div><div style={S.statLbl}>Total</div></div>
          <div style={S.stat}><div style={S.statVal}>{pending}</div><div style={S.statLbl}>Pending</div></div>
          <div style={S.stat}><div style={S.statVal}>{resolved}</div><div style={S.statLbl}>Resolved</div></div>
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        <div style={S.sectionTitle}>Complaints Dashboard</div>

        {complaints.length === 0
          ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>No complaints yet</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Complaints filed via NYAYA will appear here</div>
            </div>
          )
          : [...complaints].reverse().map(c => {
              const meta = STATUS_META[c.status] || STATUS_META.pending;
              return (
                <div key={c.id} style={S.row}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#FF6B00', letterSpacing: 1, marginBottom: 2 }}>{c.id}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E', marginBottom: 2 }}>{c.name} · {c.state || '—'}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>{c.category} · {new Date(c.submittedAt).toLocaleDateString('en-IN')}</div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3, lineHeight: 1.5 }}>{(c.description || '').slice(0, 80)}{c.description?.length > 80 ? '...' : ''}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0, marginLeft: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 100, background: meta.bg, color: meta.color }}>{meta.label}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={S.btnApprove} onClick={() => updateComplaintStatus(c.id, 'confirmed')}>✓ Approve</button>
                      <button style={S.btnResolve} onClick={() => updateComplaintStatus(c.id, 'resolved')}>✓ Resolve</button>
                    </div>
                  </div>
                </div>
              );
            })
        }
        <div style={{ height: 100 }} />
      </div>
    </div>
  );
}

const S = {
  page: { background: '#F8F5F0', minHeight: '100vh' },
  header: { background: 'linear-gradient(135deg,#1D4ED8,#1E40AF)', padding: 20, borderRadius: '0 0 20px 20px', marginBottom: 16 },
  back: { background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 },
  stat: { background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: 12, textAlign: 'center' },
  statVal: { fontSize: 22, fontWeight: 900, fontFamily: "'Playfair Display',serif", color: 'white' },
  statLbl: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: 700 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  row: { background: 'white', borderRadius: 12, padding: '14px 16px', boxShadow: '0 2px 16px rgba(0,0,0,0.08)', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  btnApprove: { padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800, background: '#ECFDF5', color: '#065F46', border: '1.5px solid #6EE7B7', fontFamily: "'Nunito',sans-serif", cursor: 'pointer' },
  btnResolve: { padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800, background: '#FEF2F2', color: '#DC2626', border: '1.5px solid #FECACA', fontFamily: "'Nunito',sans-serif", cursor: 'pointer' },
};
