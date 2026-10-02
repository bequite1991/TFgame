import { listReleases } from '@/lib/store';
import ReleaseForm from './form';

export const dynamic = 'force-dynamic';

export default function ReleasesPage() {
  const releases = listReleases();

  return (
    <>
      <h1 className="page-title">发布登记</h1>
      <p className="page-sub">build_id（node build.mjs 输出，如 b1002-1530）与微信版本 / git commit 的对应关系</p>

      <div className="section">
        <h2>新增 / 更新登记</h2>
        <ReleaseForm />
      </div>

      <div className="section">
        <h2>已登记构建（{releases.length}）</h2>
        {releases.length === 0 ? (
          <div className="empty">暂无登记</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>build_id</th>
                <th>微信版本</th>
                <th>git commit</th>
                <th>状态</th>
                <th>备注</th>
                <th>登记时间</th>
              </tr>
            </thead>
            <tbody>
              {releases.map((r) => (
                <tr key={r.build_id}>
                  <td style={{ color: 'var(--primary)' }}>{r.build_id}</td>
                  <td>{r.wx_version ?? '-'}</td>
                  <td>{r.git_commit ? r.git_commit.slice(0, 10) : '-'}</td>
                  <td><span className={`tag ${r.status}`}>{r.status}</span></td>
                  <td>{r.notes ?? '-'}</td>
                  <td>{new Date(r.released_at).toLocaleString('zh-CN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
