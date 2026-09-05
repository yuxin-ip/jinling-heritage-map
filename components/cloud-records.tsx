'use client';
import { useState } from 'react';
import { Cloud, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { useHeritageCloud } from '@/hooks/use-heritage-cloud';
import type { HeritageSite } from '@/lib/heritage-data';
import { pointKey, recordKey } from '@/lib/visit-records';
import type { Answers } from '@/lib/confirmations';

type CloudState = ReturnType<typeof useHeritageCloud>;

export function CloudAccount({
  cloud,
  localAnswers,
}: {
  cloud: CloudState;
  localAnswers: Answers;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  async function importConfirmations() {
    await cloud.importAnswers(localAnswers);
  }
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Cloud />
        {cloud.user ? '我的同步' : '跨设备同步'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="cloud-dialog">
          <DialogHeader>
            <DialogTitle>跨设备同步</DialogTitle>
            <DialogDescription>
              同一账号登录后，共享照片、到访状态与确认结果。新增照片仅你可见。
            </DialogDescription>
          </DialogHeader>
          {!cloud.configured ? (
            <p>
              同步功能已准备好，云端项目尚未配置。启用后可在这里登录，并在各地点上传照片或记录状态。
            </p>
          ) : !cloud.user ? (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                await cloud.login(email.trim(), password);
                setPassword('');
              }}
            >
              <label htmlFor="cloud-email">邮箱</label>
              <Input
                id="cloud-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <label htmlFor="cloud-password">密码</label>
              <Input
                id="cloud-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <Button disabled={cloud.busy} type="submit">
                {cloud.busy ? '正在登录…' : '登录'}
              </Button>
              <p>使用项目管理员为你创建的账号。此公开网页不开放注册。</p>
            </form>
          ) : (
            <div className="cloud-account-actions">
              <p>{cloud.user.email}</p>
              <p>
                {cloud.ready
                  ? '记录已载入。回到页面时会刷新，也可手动同步。'
                  : '正在读取记录；如读取失败，请重试同步。'}
              </p>
              <Button disabled={cloud.busy} onClick={() => void cloud.sync()}>
                同步最新记录
              </Button>
              {Object.keys(localAnswers).some(
                (id) => cloud.records[`confirmation:${id}`] === undefined,
              ) && (
                <Button
                  disabled={cloud.busy || !cloud.ready}
                  variant="outline"
                  onClick={() => void importConfirmations()}
                >
                  导入本机已有确认结果
                </Button>
              )}
              <Button
                disabled={cloud.busy}
                variant="outline"
                onClick={() => void cloud.logout()}
              >
                退出当前设备
              </Button>
            </div>
          )}
          {cloud.error && (
            <p role="alert" className="cloud-error">
              {cloud.error}
            </p>
          )}
          {cloud.message && <p role="status">{cloud.message}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RecordEditor({
  cloud,
  site,
  initialChild = '',
}: {
  cloud: CloudState;
  site: HeritageSite;
  initialChild?: string;
}) {
  const [child, setChild] = useState(initialChild);
  const key = pointKey(site.id, child);
  const selected = child
    ? site.subItems?.find((item) => item.name === child)
    : site;
  const canEdit = cloud.ready && Boolean(cloud.user) && !cloud.busy;
  return (
    <section className="record-editor">
      <h3>记录这次探访</h3>
      {site.subItems && (
        <label>
          记录到哪个子项
          <select
            value={child}
            onChange={(event) => setChild(event.target.value)}
          >
            <option value="">仅记录到国保单位（具体子项未确定）</option>
            {site.subItems.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {site.subItems && !child && (
        <p>
          单位级记录只计入单位到访，不会把所有子项标记为去过。确认照片属于哪处后，请选择具体子项再上传。
        </p>
      )}
      <fieldset className="record-buttons">
        <legend>到访情况</legend>
        <label className={`upload-photo ${!canEdit ? 'disabled' : ''}`}>
          <Upload size={16} />
          上传照片
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={!canEdit}
            onChange={async (event) => {
              const files = Array.from(event.target.files || []);
              event.target.value = '';
              await cloud.upload(key, files);
            }}
          />
        </label>
        <Button
          size="sm"
          disabled={!canEdit}
          variant={
            cloud.records[recordKey(key, 'visit')] === 'visited-no-photo'
              ? 'default'
              : 'outline'
          }
          onClick={() =>
            void cloud.save(recordKey(key, 'visit'), 'visited-no-photo')
          }
        >
          去过但无照片
        </Button>
        <Button
          size="sm"
          disabled={!canEdit}
          variant={
            cloud.records[recordKey(key, 'visit')] === 'unvisited'
              ? 'default'
              : 'outline'
          }
          onClick={() => void cloud.save(recordKey(key, 'visit'), 'unvisited')}
        >
          尚未去过
        </Button>
        <Button
          size="sm"
          disabled={!canEdit}
          variant="outline"
          onClick={() => void cloud.save(recordKey(key, 'visit'), 'auto')}
        >
          按照片判断
        </Button>
      </fieldset>
      <fieldset className="record-buttons">
        <legend>开放情况</legend>
        {(
          [
            ['closed', '不对外开放'],
            ['open', '对外开放'],
            ['unknown', '不确定'],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            disabled={!canEdit}
            variant={
              (cloud.records[recordKey(key, 'access')] || 'unknown') === value
                ? 'default'
                : 'outline'
            }
            onClick={() => void cloud.save(recordKey(key, 'access'), value)}
          >
            {label}
          </Button>
        ))}
      </fieldset>
      <p>
        上传
        JPG、PNG、WebP；每张不超过10MB，每次最多10张。“不对外开放”单独统计，不改变是否去过。
      </p>
      {!canEdit && !cloud.busy && (
        <p>
          {!cloud.configured
            ? '等待配置云端项目后启用上传和记录。'
            : !cloud.user
              ? '请先点击顶部“跨设备同步”登录。'
              : '请等待云端记录读取完成。'}
        </p>
      )}
      {cloud.busy && <p role="status">正在保存，请稍候…</p>}
      {cloud.error && (
        <p role="alert" className="cloud-error">
          {cloud.error}
        </p>
      )}
      {cloud.message && <p role="status">{cloud.message}</p>}
      {child && selected?.photos?.length ? (
        <div className="photo-grid">
          {selected.photos.map((url) => (
            <a href={url} target="_blank" rel="noreferrer" key={url}>
              <img src={url} alt={`${child}现场照片`} loading="lazy" />
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}
