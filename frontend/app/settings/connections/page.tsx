'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { Connection } from '@sql-assistant/shared';
import styles from './page.module.css';
import { apiUrl } from '../../../lib/api';

type FormValues = {
  name: string;
  host: string;
  port: number;
  database_name: string;
  username: string;
  password: string;
};

type TestState = { status: 'idle' | 'loading' | 'ok' | 'error'; message?: string };

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [testStates, setTestStates] = useState<Record<number, TestState>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { port: 1433 } });

  const load = () =>
    fetch(apiUrl('/api/connections'))
      .then(r => r.json() as Promise<Connection[]>)
      .then(setConnections)
      .catch(() => {});

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    reset({ name: '', host: '', port: 1433, database_name: '', username: '', password: '' });
    setEditingId('new');
  };

  const openEdit = (conn: Connection) => {
    reset({
      name:          conn.name,
      host:          conn.host,
      port:          conn.port,
      database_name: conn.database_name,
      username:      conn.username,
      password:      '',
    });
    setEditingId(conn.id);
  };

  const cancel = () => setEditingId(null);

  const testConnection = async (id: number) => {
    setTestStates(prev => ({ ...prev, [id]: { status: 'loading' } }));
    try {
      const res  = await fetch(apiUrl(`/api/connections/${id}/test`), { method: 'POST' });
      const data = await res.json() as { ok: boolean; error?: string };
      setTestStates(prev => ({
        ...prev,
        [id]: data.ok
          ? { status: 'ok',    message: 'Connected successfully' }
          : { status: 'error', message: data.error ?? 'Connection failed' },
      }));
      await load(); // refresh is_active flag
    } catch {
      setTestStates(prev => ({ ...prev, [id]: { status: 'error', message: 'Network error' } }));
    }
  };

  const onSubmit = async (data: FormValues) => {
    setSaving(true);
    try {
      let savedId: number;

      if (editingId === 'new') {
        const res  = await fetch(apiUrl('/api/connections'), {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(data),
        });
        const conn = await res.json() as Connection;
        savedId = conn.id;
      } else {
        const body: Partial<FormValues> = { ...data };
        if (!body.password) delete body.password; // keep existing password if blank
        await fetch(apiUrl(`/api/connections/${editingId}`), {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
        });
        savedId = editingId as number;
      }

      await load();
      setEditingId(null);
      testConnection(savedId); // auto-test after save — fire and forget
    } finally {
      setSaving(false);
    }
  };

  const deleteConn = async (id: number) => {
    await fetch(apiUrl(`/api/connections/${id}`), { method: 'DELETE' });
    setDeleteConfirm(null);
    setTestStates(prev => { const n = { ...prev }; delete n[id]; return n; });
    await load();
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>Connections</h1>
        {editingId === null && (
          <button className={styles.addBtn} onClick={openAdd}>+ Add connection</button>
        )}
      </div>

      {/* Empty state */}
      {connections.length === 0 && editingId === null && (
        <p className={styles.empty}>No connections yet. Add one to get started.</p>
      )}

      {/* Connection list */}
      {connections.length > 0 && (
        <ul className={styles.list}>
          {connections.map(conn => {
            const test = testStates[conn.id];
            return (
              <li key={conn.id} className={styles.card}>
                <div className={styles.cardBody}>
                  <div className={styles.cardInfo}>
                    <span className={styles.connName}>{conn.name}</span>
                    <span className={styles.connMeta}>
                      {conn.host}:{conn.port} · {conn.database_name} · {conn.username}
                    </span>
                    {conn.last_tested_at && (
                      <span className={styles.connMeta}>
                        Last tested: {new Date(conn.last_tested_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className={styles.cardRight}>
                    {conn.is_active === 1 && (
                      <span className={styles.badgeActive}>Active</span>
                    )}
                    {test?.status === 'ok'      && <span className={styles.statusOk}>✓ {test.message}</span>}
                    {test?.status === 'error'   && <span className={styles.statusError}>✗ {test.message}</span>}
                    {test?.status === 'loading' && <span className={styles.statusLoading}>Testing…</span>}
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <button
                    className={styles.actionBtn}
                    onClick={() => testConnection(conn.id)}
                    disabled={test?.status === 'loading'}
                  >
                    Test
                  </button>
                  <button className={styles.actionBtn} onClick={() => openEdit(conn)}>
                    Edit
                  </button>
                  {deleteConfirm === conn.id ? (
                    <>
                      <button
                        className={styles.actionBtnDanger}
                        onClick={() => deleteConn(conn.id)}
                      >
                        Confirm delete
                      </button>
                      <button
                        className={styles.actionBtn}
                        onClick={() => setDeleteConfirm(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className={styles.actionBtnDanger}
                      onClick={() => setDeleteConfirm(conn.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add / Edit form */}
      {editingId !== null && (
        <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
          <h2 className={styles.formHeading}>
            {editingId === 'new' ? 'Add Connection' : 'Edit Connection'}
          </h2>

          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Display name</span>
              <input
                className={styles.input}
                {...register('name', { required: 'Required' })}
                placeholder="Production DB"
              />
              {errors.name && <span className={styles.fieldError}>{errors.name.message}</span>}
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Host</span>
              <input
                className={styles.input}
                {...register('host', { required: 'Required' })}
                placeholder="server.example.com"
              />
              {errors.host && <span className={styles.fieldError}>{errors.host.message}</span>}
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Port</span>
              <input
                className={styles.input}
                type="number"
                {...register('port', { valueAsNumber: true, min: 1, max: 65535 })}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Database</span>
              <input
                className={styles.input}
                {...register('database_name', { required: 'Required' })}
                placeholder="MyDatabase"
              />
              {errors.database_name && (
                <span className={styles.fieldError}>{errors.database_name.message}</span>
              )}
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Username</span>
              <input
                className={styles.input}
                {...register('username', { required: 'Required' })}
                placeholder="sa"
                autoComplete="username"
              />
              {errors.username && (
                <span className={styles.fieldError}>{errors.username.message}</span>
              )}
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>
                Password
                {editingId !== 'new' && (
                  <span className={styles.fieldHint}> — leave blank to keep current</span>
                )}
              </span>
              <input
                className={styles.input}
                type="password"
                {...register('password', {
                  required: editingId === 'new' ? 'Required' : false,
                })}
                autoComplete="new-password"
              />
              {errors.password && (
                <span className={styles.fieldError}>{errors.password.message}</span>
              )}
            </label>
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? 'Saving…' : editingId === 'new' ? 'Add connection' : 'Save changes'}
            </button>
            <button type="button" className={styles.cancelBtn} onClick={cancel}>
              Cancel
            </button>
          </div>

          <p className={styles.saveHint}>
            Connection will be tested automatically after saving.
          </p>
        </form>
      )}
    </div>
  );
}
