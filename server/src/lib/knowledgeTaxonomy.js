export const KNOWLEDGE_TAXONOMY = [
  {
    id: 'calculation',
    label: '计算',
    topics: ['整数计算', '等差数列', '小数计算', '定义新运算', '数列与数表', '整数裂项', '分数计算与比大小', '方程', '等比数列', '高斯记号'],
  },
  {
    id: 'word_problem',
    label: '应用题',
    topics: ['和差倍', '鸡兔同笼', '盈亏问题', '周期问题', '间隔问题', '方阵', '平均数', '年龄问题', '页码问题', '牛吃草问题', '分数应用题', '比例应用题', '工程问题', '浓度问题', '经济问题'],
  },
  {
    id: 'geometry',
    label: '几何',
    topics: ['点线角', '周长', '几何思想', '几何变换', '等积变形', '一半模型', '格点面积', '勾股定理', '等高模型', '鸟头模型', '燕尾模型', '沙漏模型', '圆与扇形', '长方体与立方体', '水中浸物'],
  },
  {
    id: 'counting',
    label: '计数',
    topics: ['枚举法', '树形图', '加乘原理', '标数法', '递推计数', '传球法', '插空法', '捆绑法', '图形计数', '对应法'],
  },
  {
    id: 'travel',
    label: '行程',
    topics: ['基本相遇与追及', '火车过桥', '流水行船', '环形跑道', '时钟问题', '间隔发车', '扶梯问题', '接送问题', '空中加油', '多人多次相遇', '分段行程', '比例行程'],
  },
  {
    id: 'number_theory',
    label: '数论',
    topics: ['奇数与偶数', '整除特性', '质数与合数', '分解质因数', '因数个数', '循环小数', '大因小倍', '余数问题', '不定方程'],
  },
  {
    id: 'combinatorics',
    label: '组合问题',
    topics: ['找规律', '加减法数字谜', '乘除法数字谜', '数阵图', '幻方', '统筹最优问题', '必胜策略', '逻辑推理', '最值问题', '抽屉原理', '构造与论证'],
  },
];

export const KNOWLEDGE_POINTS = KNOWLEDGE_TAXONOMY.flatMap(domain => domain.topics);
export const KNOWLEDGE_POINT_SET = new Set(KNOWLEDGE_POINTS);

export function normalizeKnowledgePoint(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (KNOWLEDGE_POINT_SET.has(text)) return text;
  return KNOWLEDGE_POINTS.find(point => text.includes(point)) || '';
}

export function findKnowledgeCategory(value) {
  const point = normalizeKnowledgePoint(value);
  if (!point) return null;
  const domain = KNOWLEDGE_TAXONOMY.find(item => item.topics.includes(point));
  return domain ? { id: domain.id, label: domain.label, knowledgePoint: point } : null;
}

export function knowledgeTaxonomyForClient() {
  return KNOWLEDGE_TAXONOMY.map(domain => ({
    id: domain.id,
    label: domain.label,
    children: [
      {
        id: `${domain.id}_topics`,
        label: '二级分类',
        children: domain.topics.map((label, index) => ({
          id: `${domain.id}_${index + 1}`,
          label,
        })),
      },
    ],
  }));
}
