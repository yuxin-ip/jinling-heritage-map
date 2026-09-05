'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, cloudConfigured } from '@/lib/supabase';
import type { CloudRecords, PersonalPhoto } from '@/lib/visit-records';

const bucket = 'heritage-photos';
const empty = { records: {} as CloudRecords, photos: [] as PersonalPhoto[] };

export function useHeritageCloud() {
  const [user, setUser] = useState<User | null>(null);
  const [snapshot, setSnapshot] = useState(empty);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const activeUser = useRef<string | null>(null);
  const generation = useRef(0);
  const operation = useRef(false);

  const refresh = useCallback(async (owner: string) => {
    if (!supabase) return;
    const request = ++generation.current;
    const { data: members, error: memberError } = await supabase
      .from('heritage_members')
      .select('user_id')
      .eq('user_id', owner);
    if (memberError || !members?.length)
      throw new Error('当前账号尚未获准使用同步，请先完成云端项目配置。');
    const records: CloudRecords = {};
    const photos: PersonalPhoto[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase
        .from('heritage_records')
        .select('record_key,value')
        .eq('user_id', owner)
        .order('record_key')
        .range(offset, offset + 499);
      if (error) throw error;
      for (const row of data || []) records[row.record_key] = row.value;
      if (!data || data.length < 500) break;
    }
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await supabase
        .from('heritage_photos')
        .select('id,point_key,storage_path,filename')
        .eq('user_id', owner)
        .order('id')
        .range(offset, offset + 99);
      if (error) throw error;
      if (data?.length) {
        const signed = await supabase.storage.from(bucket).createSignedUrls(
          data.map((row) => row.storage_path),
          3600,
        );
        if (
          signed.error ||
          signed.data?.some((item) => item.error || !item.signedUrl)
        )
          throw new Error('照片链接读取失败，请重试同步。');
        data.forEach((row, index) =>
          photos.push({ ...row, url: signed.data![index].signedUrl! }),
        );
      }
      if (!data || data.length < 100) break;
    }
    if (activeUser.current === owner && request === generation.current) {
      setSnapshot({ records, photos });
      setReady(true);
      setError('');
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      const next = session?.user ?? null;
      const changed = activeUser.current !== (next?.id ?? null);
      activeUser.current = next?.id ?? null;
      setUser(next);
      if (changed) {
        generation.current++;
        setSnapshot(empty);
        setReady(false);
        setError('');
        setMessage('');
      }
      if (next && (changed || _event === 'INITIAL_SESSION')) {
        // Run database requests outside the auth callback's lock.
        setTimeout(() => {
          if (alive)
            void refresh(next.id).catch(() => {
              if (activeUser.current === next.id)
                setError('无法读取云端记录，请检查网络及账号权限后重试。');
            });
        }, 0);
      }
    });
    return () => {
      alive = false;
      activeUser.current = null;
      generation.current++;
      subscription.unsubscribe();
    };
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const update = () => {
      if (!operation.current && document.visibilityState === 'visible')
        void refresh(user.id).catch(() =>
          setError('同步失败，保留上次已读取的数据。请重试。'),
        );
    };
    window.addEventListener('focus', update);
    const timer = window.setInterval(update, 60000);
    return () => {
      window.removeEventListener('focus', update);
      window.clearInterval(timer);
    };
  }, [user, refresh]);

  async function run(task: () => Promise<void>, success: string) {
    if (operation.current) return false;
    operation.current = true;
    generation.current++;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await task();
      setMessage(success);
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : '操作未完成，请检查网络后重试。',
      );
      return false;
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  async function save(recordKey: string, value: string) {
    const owner = user?.id;
    if (!supabase || !owner || !ready) return false;
    return run(async () => {
      const { error } = await supabase!
        .from('heritage_records')
        .upsert(
          { user_id: owner, record_key: recordKey, value },
          { onConflict: 'user_id,record_key' },
        );
      if (error) throw new Error('未能保存到云端，请检查网络或账号权限。');
      if (activeUser.current === owner)
        setSnapshot((current) => ({
          ...current,
          records: { ...current.records, [recordKey]: value },
        }));
    }, '已保存到云端');
  }

  async function upload(point: string, files: File[]) {
    const owner = user?.id;
    if (!supabase || !owner || !ready || !files.length) return false;
    return run(async () => {
      if (files.length > 10) throw new Error('每次最多上传10张照片。');
      if (
        files.some(
          (file) =>
            !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
            file.size > 10 * 1024 * 1024 ||
            !file.size,
        )
      )
        throw new Error(
          '请选择10MB以内的 JPG、PNG 或 WebP 照片；HEIC 请先转换为 JPG。',
        );
      let completed = 0;
      try {
        for (const file of files) {
          const id = crypto.randomUUID();
          const extension =
            file.type === 'image/png'
              ? 'png'
              : file.type === 'image/webp'
                ? 'webp'
                : 'jpg';
          const storage_path = `${owner}/${id}.${extension}`;
          const stored = await supabase!.storage
            .from(bucket)
            .upload(storage_path, file, {
              contentType: file.type,
              upsert: false,
            });
          if (stored.error)
            throw new Error('照片上传失败，请检查网络和存储空间。');
          const metadata = await supabase!
            .from('heritage_photos')
            .insert({
              id,
              user_id: owner,
              point_key: point,
              storage_path,
              filename: file.name.slice(0, 250),
            });
          if (metadata.error) {
            await supabase!.storage.from(bucket).remove([storage_path]);
            throw new Error('照片信息保存失败，请重试。');
          }
          completed++;
        }
        await refresh(owner);
      } catch (cause) {
        await refresh(owner).catch(() => {});
        throw new Error(
          `${completed ? `已保存${completed}张，其余未完成。` : ''}${cause instanceof Error ? cause.message : '请重试上传。'}`,
        );
      }
    }, '照片已保存到云端');
  }

  return {
    configured: cloudConfigured,
    user,
    ready,
    busy,
    message,
    error,
    ...snapshot,
    save,
    upload,
    importAnswers: (answers: Record<string, string>) =>
      run(async () => {
        if (!supabase || !user || !ready)
          throw new Error('请先登录并读取云端记录。');
        const rows = Object.entries(answers).map(([id, value]) => ({
          user_id: user.id,
          record_key: `confirmation:${id}`,
          value,
        }));
        if (!rows.length) return;
        const { error } = await supabase
          .from('heritage_records')
          .upsert(rows, {
            onConflict: 'user_id,record_key',
            ignoreDuplicates: true,
          });
        if (error) throw new Error('导入未完成，请重试。');
        await refresh(user.id);
      }, '已导入本机确认结果，云端已有记录保持不变'),
    login: (email: string, password: string) =>
      run(async () => {
        if (!supabase) throw new Error('跨设备同步尚未配置。');
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw new Error('登录失败，请检查邮箱和密码。');
      }, '登录成功，正在读取云端记录'),
    logout: () =>
      run(async () => {
        const result = await supabase?.auth.signOut({ scope: 'local' });
        if (result?.error) throw new Error('退出失败，请重试。');
      }, '已退出当前设备'),
    sync: () =>
      run(async () => {
        if (user) await refresh(user.id);
      }, '已读取云端最新记录'),
  };
}
