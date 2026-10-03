import { currentAdmin, maskOpenid } from '@/lib/auth';
import { listUsers } from '@/lib/store';
import UserActions from './actions';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  // middleware 已保证已登录，此处取角色做展示控制
  const session = await currentAdmin();
  const role = session?.role ?? 'readonly';
  const users = listUsers();

  return (
    <>
      <h1 className="page-title">用户列表</h1>
      <p className="page-sub">
        共 {users.length} 人（登录或上报事件自动建档，按最近活跃排序）
        {role === 'readonly' ? ' · 只读模式，openid 已脱敏' : ''}
      </p>

      <div className="section">
        {users.length === 0 ? (
          <div className="empty">暂无用户，等待客户端登录或携带 openid 上报</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>openid</th>
                <th>军衔</th>
                <th>积分</th>
                <th>单局最高</th>
                <th>已通关章节</th>
                <th>状态</th>
                <th>最近活跃</th>
                {role !== 'readonly' && <th>操作</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                // readonly 下 key 也不能用原始 openid（会序列化进 RSC payload 造成泄漏）
                <tr key={role === 'readonly' ? `m${i}` : u.openid}>
                  <td title={role === 'readonly' ? undefined : u.openid}>
                    {role === 'readonly'
                      ? maskOpenid(u.openid)
                      : u.openid.slice(0, 16) + (u.openid.length > 16 ? '…' : '')}
                  </td>
                  <td>{u.rank}</td>
                  <td>{u.points}</td>
                  <td>{u.best_single}</td>
                  <td>{u.cleared.length ? u.cleared.join(', ') : '-'}</td>
                  <td><span className={`tag ${u.status}`}>{u.status}</span></td>
                  <td>{new Date(u.last_seen_at).toLocaleString('zh-CN')}</td>
                  {role !== 'readonly' && (
                    <td><UserActions openid={u.openid} banned={u.status === 'banned'} role={role} /></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
