import { topScores } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default function ScoresPage() {
  const scores = topScores(100);

  return (
    <>
      <h1 className="page-title">积分榜 TOP100</h1>
      <p className="page-sub">按单局综合积分排序（通关 10000 + 波次×100 + 击杀×10 − 漏怪×50）</p>

      <div className="section">
        {scores.length === 0 ? (
          <div className="empty">暂无成绩，等待客户端上报 game_end 事件</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>#</th>
                <th>openid</th>
                <th>章节</th>
                <th>难度</th>
                <th>结果</th>
                <th>评级</th>
                <th>波次</th>
                <th>击杀</th>
                <th>漏怪</th>
                <th>用时(s)</th>
                <th>积分</th>
                <th>构建</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((sc, i) => (
                <tr key={sc.id}>
                  <td>{i + 1}</td>
                  <td title={sc.openid}>{sc.openid.slice(0, 12)}{sc.openid.length > 12 ? '…' : ''}</td>
                  <td>{sc.level_id}</td>
                  <td>{sc.difficulty}</td>
                  <td><span className={`tag ${sc.result}`}>{sc.result}</span></td>
                  <td>{sc.grade ?? '-'}</td>
                  <td>{sc.wave_reached}</td>
                  <td>{sc.kills}</td>
                  <td>{sc.leaks}</td>
                  <td>{sc.duration_sec}</td>
                  <td style={{ color: 'var(--primary)', fontWeight: 700 }}>{sc.points}</td>
                  <td>{sc.build_id ?? '-'}</td>
                  <td>{new Date(sc.created_at).toLocaleString('zh-CN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
