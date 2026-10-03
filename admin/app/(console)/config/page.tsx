import { currentAdmin } from '@/lib/auth';
import { listConfigs } from '@/lib/store';
import ConfigEditor from './editor';

export const dynamic = 'force-dynamic';

export default async function ConfigPage() {
  const session = await currentAdmin();
  const canEdit = session?.role === 'ops' || session?.role === 'super';
  const configs = listConfigs();

  return (
    <>
      <h1 className="page-title">运营配置</h1>
      <p className="page-sub">
        key-value 配置（公告 notice / 活动位 home_banner / 双倍战利 ad_double_loot / 平衡 balance.*），保存即版本 +1
      </p>

      {canEdit && (
        <div className="section">
          <h2>编辑配置</h2>
          <ConfigEditor existingKeys={configs.map((c) => c.key)} />
        </div>
      )}

      <div className="section">
        <h2>已发布配置（{configs.length}）</h2>
        {configs.length === 0 ? (
          <div className="empty">暂无配置</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>key</th>
                <th>版本</th>
                <th>启用</th>
                <th>value 预览</th>
                <th>更新人</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c) => (
                <tr key={c.key}>
                  <td style={{ color: 'var(--primary)' }}>{c.key}</td>
                  <td>v{c.version}</td>
                  <td>{c.enabled ? '是' : '否'}</td>
                  <td title={JSON.stringify(c.value)}>
                    {JSON.stringify(c.value)?.slice(0, 60)}
                    {JSON.stringify(c.value)?.length > 60 ? '…' : ''}
                  </td>
                  <td>{c.updated_by ?? '-'}</td>
                  <td>{new Date(c.updated_at).toLocaleString('zh-CN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
