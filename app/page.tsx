'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

type Level = { id: string; name: string; creator: string; rank: number; points: number; video_url: string | null; description: string | null };
type Profile = { id: string; username: string; role: string };
type RecordRow = { id: string; level_id: string; submitted_by: string; proof_url: string; status: string; note: string | null; profiles?: { username: string } | null; levels?: { name: string; points: number } | null };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase: SupabaseClient | null = supabaseUrl && supabaseKey && !supabaseUrl.includes('YOUR_PROJECT_ID')
  ? createClient(supabaseUrl, supabaseKey) : null;

export default function Home() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState('levels');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  async function loadData() {
    if (!supabase) return;
    const [{ data: levelData }, { data: recordData }] = await Promise.all([
      supabase.from('levels').select('*').order('rank'),
      supabase.from('records').select('id,level_id,submitted_by,proof_url,status,note,profiles(username),levels(name,points)').order('created_at', { ascending: false }),
    ]);
    setLevels((levelData ?? []) as Level[]);
    setRecords((recordData ?? []) as unknown as RecordRow[]);
  }

  async function syncUser() {
    if (!supabase) return;
    const { data: { user: current } } = await supabase.auth.getUser();
    setUser(current ? { id: current.id, email: current.email } : null);
    if (current) {
      const { data } = await supabase.from('profiles').select('*').eq('id', current.id).maybeSingle();
      setProfile(data as Profile | null);
    } else setProfile(null);
  }

  useEffect(() => {
    if (!supabase) return;
    void loadData(); void syncUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void syncUser(); void loadData(); });
    return () => subscription.unsubscribe();
  }, []);

  const accepted = records.filter(r => r.status === 'approved');
  const leaderboard = useMemo(() => {
    const totals = new Map<string, { name: string; points: number; count: number }>();
    accepted.forEach(r => {
      const row = totals.get(r.submitted_by) ?? { name: r.profiles?.username ?? 'Player', points: 0, count: 0 };
      row.points += r.levels?.points ?? 0; row.count += 1; totals.set(r.submitted_by, row);
    });
    return [...totals.entries()].map(([id, value]) => ({ id, ...value })).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  }, [records]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase) return;
    const form = new FormData(event.currentTarget); const email = String(form.get('email')); const password = String(form.get('password'));
    setBusy(true); setMessage('');
    const result = authMode === 'signup'
      ? await supabase.auth.signUp({ email, password, options: { data: { username: String(form.get('username')).trim() } } })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else if (authMode === 'signup') setMessage('Account created. Check your email if confirmation is enabled, then sign in.');
    else { setMessage('Signed in.'); await syncUser(); }
  }

  async function submitRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || !user) return;
    const form = new FormData(event.currentTarget); setBusy(true); setMessage('');
    const { error } = await supabase.from('records').insert({ level_id: form.get('level_id'), proof_url: String(form.get('proof_url')).trim(), note: String(form.get('note')).trim() || null, submitted_by: user.id });
    setBusy(false); setMessage(error ? error.message : 'Record submitted for moderator review.'); if (!error) { event.currentTarget.reset(); await loadData(); }
  }

  async function addLevel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase) return;
    const form = new FormData(event.currentTarget); setBusy(true);
    const { error } = await supabase.from('levels').insert({ name: String(form.get('name')).trim(), creator: String(form.get('creator')).trim(), rank: Number(form.get('rank')), points: Number(form.get('points')), video_url: String(form.get('video_url')).trim() || null, description: String(form.get('description')).trim() || null });
    setBusy(false); setMessage(error ? error.message : 'Level added.'); if (!error) { event.currentTarget.reset(); await loadData(); }
  }

  async function reviewRecord(id: string, status: 'approved' | 'rejected') {
    if (!supabase) return;
    const { error } = await supabase.from('records').update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() }).eq('id', id);
    setMessage(error ? error.message : `Record ${status}.`); await loadData();
  }

  return <main className="shell">
    <header className="topbar"><a className="brand" href="#top"><span className="brand-mark">HD</span><span>HOSSAMY <b>DASH</b><small>COMMUNITY DEMON LIST</small></span></a><a className="game-link" href="https://websim.com/@hossamy2/hossamydash" target="_blank" rel="noreferrer">Play Hossamy Dash ↗</a></header>
    <section className="hero" id="top"><div className="eyebrow"><span className="pulse"/> COMMUNITY-RANKED CHALLENGES</div><h1>THE DEMON<br/><span>LIST</span></h1><p>Prove your skill. Climb the ranks. Become a legend.</p><div className="hero-stats"><div><strong>{levels.length}</strong><span>LEVELS</span></div><div><strong>{accepted.length}</strong><span>VERIFIED RECORDS</span></div><div><strong>{leaderboard.length}</strong><span>PLAYERS</span></div></div><a className="primary-button" href="#list">Explore the list <span>↓</span></a></section>
    {!supabase && <div className="notice"><strong>Almost ready:</strong> connect your Supabase project by adding its URL and anon key as <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> environment variables. Setup steps are in the README.</div>}
    {message && <div className="toast" role="status">{message}<button onClick={() => setMessage('')} aria-label="Dismiss">×</button></div>}
    <section className="content" id="list"><div className="section-heading"><div><div className="eyebrow">THE COMMUNITY STANDARD</div><h2>Leaderboard</h2></div><div className="tabs"><button className={tab === 'levels' ? 'active' : ''} onClick={() => setTab('levels')}>Levels</button><button className={tab === 'players' ? 'active' : ''} onClick={() => setTab('players')}>Players</button><button className={tab === 'submit' ? 'active' : ''} onClick={() => setTab('submit')}>Submit record</button>{profile?.role === 'moderator' && <button className={tab === 'moderate' ? 'active' : ''} onClick={() => setTab('moderate')}>Moderation</button>}</div></div>
      {tab === 'levels' && <div className="table-wrap"><table><thead><tr><th>RANK</th><th>LEVEL</th><th>CREATOR</th><th>POINTS</th><th>RECORDS</th><th>INFO</th></tr></thead><tbody>{levels.map(l => <tr key={l.id}><td><span className="rank">#{l.rank}</span></td><td className="level-name">{l.name}<small>{l.description}</small></td><td>{l.creator}</td><td><span className="points">{l.points} pts</span></td><td>{accepted.filter(r => r.level_id === l.id).length}</td><td>{l.video_url ? <a className="icon-link" href={l.video_url} target="_blank" rel="noreferrer">↗</a> : '—'}</td></tr>)}</tbody></table>{levels.length === 0 && <div className="empty">No levels yet. Check back soon!</div>}</div>}
      {tab === 'players' && <div className="table-wrap"><table><thead><tr><th>RANK</th><th>PLAYER</th><th>POINTS</th><th>VERIFIED RECORDS</th></tr></thead><tbody>{leaderboard.map((p, i) => <tr key={p.id}><td><span className="rank">#{i + 1}</span></td><td className="level-name">{p.name}</td><td><span className="points">{p.points} pts</span></td><td>{p.count}</td></tr>)}</tbody></table>{leaderboard.length === 0 && <div className="empty">No verified records yet. Be the first!</div>}</div>}
      {tab === 'submit' && <div className="panel"><h3>Submit a completion</h3><p>Sign in, choose a level, and include a video link as proof. A moderator will review it.</p>{!user ? <AuthForm mode={authMode} setMode={setAuthMode} onSubmit={handleAuth} busy={busy}/> : levels.length === 0 ? <div className="empty">There are no levels to submit yet.</div> : <form onSubmit={submitRecord} className="form-grid"><label>Level<select required name="level_id"><option value="">Choose a level</option>{levels.map(l => <option key={l.id} value={l.id}>#{l.rank} — {l.name}</option>)}</select></label><label>Proof video URL<input name="proof_url" type="url" placeholder="https://youtube.com/..." required/></label><label className="full">Note (optional)<textarea name="note" rows={3} maxLength={500} placeholder="Anything moderators should know?"/></label><button className="primary-button" disabled={busy}>{busy ? 'Submitting…' : 'Send for review'}</button></form>}</div>}
      {tab === 'moderate' && profile?.role === 'moderator' && <div className="moderator-grid"><div className="panel"><h3>Add a level</h3><form onSubmit={addLevel} className="form-grid"><label>Level name<input name="name" required maxLength={100}/></label><label>Creator<input name="creator" required maxLength={100}/></label><label>Rank<input name="rank" type="number" min="1" required/></label><label>Points<input name="points" type="number" min="0" required/></label><label className="full">Level video URL (optional)<input name="video_url" type="url"/></label><label className="full">Description (optional)<textarea name="description" rows={2} maxLength={500}/></label><button className="primary-button" disabled={busy}>Add level</button></form></div><div className="panel"><h3>Pending records</h3>{records.filter(r => r.status === 'pending').length === 0 && <p className="muted">Nothing waiting for review.</p>}{records.filter(r => r.status === 'pending').map(r => <div className="review-card" key={r.id}><b>{r.profiles?.username ?? 'Player'}</b><span>{r.levels?.name ?? 'Level'} — {r.levels?.points ?? 0} pts</span>{r.note && <p>{r.note}</p>}<a href={r.proof_url} target="_blank" rel="noreferrer">Watch proof ↗</a><div className="review-actions"><button onClick={() => void reviewRecord(r.id, 'approved')}>Approve</button><button onClick={() => void reviewRecord(r.id, 'rejected')}>Reject</button></div></div>)}</div></div>}
    </section>
    <section className="how"><div className="eyebrow">HOW IT WORKS</div><h2>Earn your place.</h2><div className="steps"><article><span>01</span><h3>Beat a level</h3><p>Choose a challenge from the list and complete it in Hossamy Dash.</p></article><article><span>02</span><h3>Submit proof</h3><p>Send your record with a video link for the moderators to review.</p></article><article><span>03</span><h3>Get ranked</h3><p>Once accepted, your points count toward the player leaderboard.</p></article></div></section>
    <footer><span>HOSSAMY DASH DEMON LIST</span><span>MADE FOR THE COMMUNITY · <a href="https://websim.com/@hossamy2/hossamydash" target="_blank" rel="noreferrer">HOSSAMY DASH ↗</a></span></footer>
  </main>;
}

function AuthForm({ mode, setMode, onSubmit, busy }: { mode: 'signin' | 'signup'; setMode: (mode: 'signin' | 'signup') => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit} className="form-grid auth-form">{mode === 'signup' && <label className="full">Player name<input name="username" required minLength={2} maxLength={24} pattern="[A-Za-z0-9_ -]+" placeholder="Your leaderboard name"/></label>}<label className="full">Email<input name="email" type="email" required autoComplete="email"/></label><label className="full">Password<input name="password" type="password" required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}/></label><button className="primary-button" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button><p className="switch-auth">{mode === 'signup' ? 'Already have an account?' : 'New player?'} <button type="button" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>{mode === 'signup' ? 'Sign in' : 'Create one'}</button></p></form>;
}
