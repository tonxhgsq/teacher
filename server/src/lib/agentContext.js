import { db } from '../db/schema.js';

const parse = (s, fb) => { try { return JSON.parse(s); } catch { return fb; } };

export async function buildTeacherAgentMessages(messages, ownerUserId = null) {
  const { rows } = ownerUserId
    ? await db.execute({ sql: 'SELECT id, name, grade, status, weak_points, recent_errors, suggestion FROM students WHERE owner_user_id = ? ORDER BY id LIMIT 20', args: [ownerUserId] })
    : await db.execute('SELECT id, name, grade, status, weak_points, recent_errors, suggestion FROM students ORDER BY id LIMIT 20');
  const students = rows.map(s => ({
    id: Number(s.id),
    name: s.name,
    grade: s.grade,
    status: s.status,
    weakPoints: parse(s.weak_points, []),
    recentErrors: parse(s.recent_errors, []).slice(0, 5),
    suggestion: s.suggestion || ''
  }));

  const system = `你是一个面向小学数学老师的 AI 助教，回答要简洁、具体、可执行。
1. 帮老师查询学生学情、薄弱点、近期错题。
2. 帮老师生成练习建议、家长反馈话术。
3. 涉及发给家长的内容，要温和、具体，不制造焦虑。
4. 不要透露其他学生隐私；不要在家长群语境下做班级排名或风险比较。
5. 如果需要系统执行动作，只说明建议和下一步，不要假装已经执行。
6. 不要使用 Markdown 表格。请用短段落、项目符号或编号列表回答。
7. 回答尽量控制在 3-6 行；如果内容较多，先给结论，再给 2-3 条建议。
8. 本产品核心是错题识别、考察点判断、错因归类和针对性练习，不要使用“作业完成率”作为评价口径。

当前学生档案摘要：
${JSON.stringify(students, null, 2)}`;

  return [{ role: 'system', content: system }, ...messages];
}
