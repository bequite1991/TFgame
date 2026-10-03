import { statsSummary } from '@/lib/store';

export const dynamic = 'force-dynamic';

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export default function DashboardPage() {
  const s = statsSummary();

  return (
    <>
      <h1 className="page-title">总览看板</h1>
      <p className="page-sub">核心指标与关卡漏斗（来源：/api/collect 上报事件）</p>

      <div className="cards">
        <div className="card">
          <div className="label">启动次数 app_launch</div>
          <div className="value accent">{s.app_launch}</div>
        </div>
        <div className="card">
          <div className="label">开局数 game_start</div>
          <div className="value accent">{s.game_start}</div>
        </div>
        <div className="card">
          <div className="label">完局数 game_end</div>
          <div className="value">{s.game_end}</div>
        </div>
        <div className="card">
          <div className="label">胜 / 负</div>
          <div className="value">
            <span style={{ color: 'var(--good)' }}>{s.win}</span>
            {' / '}
            <span style={{ color: 'var(--bad)' }}>{s.lose}</span>
          </div>
        </div>
        <div className="card">
          <div className="label">胜率（win / game_end）</div>
          <div className="value good">{pct(s.win_rate)}</div>
        </div>
        <div className="card">
          <div className="label">分享点击 share_click</div>
          <div className="value accent">{s.share_click}</div>
        </div>
        <div className="card">
          <div className="label">事件总量</div>
          <div className="value">{s.total_events}</div>
        </div>
      </div>

      <div className="section">
        <h2>关卡 × 难度 漏斗</h2>
        {s.funnel.length === 0 ? (
          <div className="empty">暂无数据，等待客户端上报</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>章节</th>
                <th>难度</th>
                <th>开局</th>
                <th>完局</th>
                <th>胜利</th>
                <th>胜率</th>
                <th style={{ width: '30%' }}>胜率条</th>
                <th>失败均到波次</th>
              </tr>
            </thead>
            <tbody>
              {s.funnel.map((f) => (
                <tr key={`${f.level_id}-${f.difficulty}`}>
                  <td>第 {f.level_id} 章</td>
                  <td>{f.difficulty}</td>
                  <td>{f.starts}</td>
                  <td>{f.ends}</td>
                  <td>{f.wins}</td>
                  <td>{pct(f.win_rate)}</td>
                  <td>
                    <div className="bar">
                      <i style={{ width: `${Math.round(f.win_rate * 100)}%` }} />
                    </div>
                  </td>
                  <td>{f.avg_wave_lost || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <h2>分享渠道 & 评级分布</h2>
        <div className="form-row">
          <table className="data">
            <thead>
              <tr>
                <th>分享渠道</th>
                <th>次数</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(s.share_by_channel).length === 0 ? (
                <tr>
                  <td colSpan={2} className="empty">暂无</td>
                </tr>
              ) : (
                Object.entries(s.share_by_channel).map(([ch, n]) => (
                  <tr key={ch}>
                    <td>{ch}</td>
                    <td>{n}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <table className="data">
            <thead>
              <tr>
                <th>评级 grade</th>
                <th>局数</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(s.grade_dist).length === 0 ? (
                <tr>
                  <td colSpan={2} className="empty">暂无（需客户端上报 game_end.grade）</td>
                </tr>
              ) : (
                ['S', 'A', 'B', 'D'].map((grade) => (
                  <tr key={grade}>
                    <td>{grade}</td>
                    <td>{s.grade_dist[grade] ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <table className="data">
            <thead>
              <tr>
                <th>开局难度</th>
                <th>次数</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(s.difficulty_dist).length === 0 ? (
                <tr>
                  <td colSpan={2} className="empty">暂无</td>
                </tr>
              ) : (
                Object.entries(s.difficulty_dist).map(([diff, n]) => (
                  <tr key={diff}>
                    <td>{diff}</td>
                    <td>{n}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
