import { listUsers } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default function UsersPage() {
  const users = listUsers();

  return (
    <>
      <h1 className="page-title">用户列表</h1>
      <p className="page-sub">共 {users.length} 人（由上报事件中的 openid 自动建档，按最近活跃排序）</p>

      <div className="section">
        {users.length === 0 ? (
          <div className="empty">暂无用户，等待客户端携带 openid 上报</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>openid</th>
                <th>军衔</th>
                <th>已通关章节</th>
                <th>累计积分</th>
                <th>状态</th>
                <th>首登</th>
                <th>最近活跃</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.openid}>
                  <td title={u.openid}>{u.openid.slice(0, 16)}{u.openid.length > 16 ? '…' : ''}</td>
                  <td>{u.rank}</td>
                  <td>{u.cleared.length ? u.cleared.join(', ') : '-'}</td>
                  <td>{u.score_total}</td>
                  <td><span className={`tag ${u.status}`}>{u.status}</span></td>
                  <td>{new Date(u.created_at).toLocaleString('zh-CN')}</td>
                  <td>{new Date(u.last_seen_at).toLocaleString('zh-CN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
