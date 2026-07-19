/* Western Sun-sign calculator. Uses the Gregorian birth date only. */
(function (root) {
  'use strict';

  const SIGNS = [
    {
      id: 'capricorn', symbol: '♑', start: 1222, end: 119,
      zh: { name: '摩羯座', element: '土象', modality: '本位', ruler: '土星', keywords: ['结构', '责任', '长期建设'], summary: '习惯先确认责任与路径，再把目标拆成可持续的阶段。', work: '适合有标准、可累积且能看见长期成果的任务。', relation: '重视承诺与可靠，也需要给感受留出表达空间。', growth: '别让“必须做好”延迟了及时求助和小步试错。' },
      en: { name: 'Capricorn', element: 'Earth', modality: 'Cardinal', ruler: 'Saturn', keywords: ['Structure', 'Responsibility', 'Long-term building'], summary: 'You often clarify responsibility and a workable path before turning a goal into sustainable stages.', work: 'You tend to do well with standards, cumulative progress and visible long-term outcomes.', relation: 'Reliability and commitment matter, while feelings still need room to be expressed.', growth: 'Do not let the need to do things properly delay asking for help or running a small test.' }
    },
    {
      id: 'aquarius', symbol: '♒', start: 120, end: 218,
      zh: { name: '水瓶座', element: '风象', modality: '固定', ruler: '天王星 / 土星', keywords: ['独立', '系统', '创新'], summary: '容易从系统和长期角度理解问题，重视独立判断与观念空间。', work: '适合改善方法、连接群体或处理未来导向的议题。', relation: '需要平等与思想交流，但不宜用理性取代情绪回应。', growth: '把新观点变成能被他人验证和参与的实际步骤。' },
      en: { name: 'Aquarius', element: 'Air', modality: 'Fixed', ruler: 'Uranus / Saturn', keywords: ['Independence', 'Systems', 'Innovation'], summary: 'You often approach questions through systems and the long view, valuing independent judgment and room for ideas.', work: 'You may thrive when improving methods, connecting groups or exploring future-facing problems.', relation: 'Equality and intellectual connection matter, but reasoning should not replace an emotional response.', growth: 'Turn an original perspective into practical steps that other people can test and join.' }
    },
    {
      id: 'pisces', symbol: '♓', start: 219, end: 320,
      zh: { name: '双鱼座', element: '水象', modality: '变动', ruler: '海王星 / 木星', keywords: ['感受', '想象', '共情'], summary: '对氛围和潜在联系较敏感，常从感受、图像与整体意义理解事情。', work: '适合创意、服务、叙事或需要同理心的场景。', relation: '容易体谅他人，同时需要明确边界和可核对的承诺。', growth: '把直觉写成具体假设，再用事实、时间和边界验证。' },
      en: { name: 'Pisces', element: 'Water', modality: 'Mutable', ruler: 'Neptune / Jupiter', keywords: ['Sensitivity', 'Imagination', 'Empathy'], summary: 'You may be highly responsive to atmosphere and subtle connections, reading situations through feeling, imagery and overall meaning.', work: 'Creative, service-oriented, narrative or empathy-led work can be especially engaging.', relation: 'Compassion comes naturally, while clear boundaries and checkable commitments remain essential.', growth: 'Turn intuition into a concrete hypothesis, then test it against facts, time and boundaries.' }
    },
    {
      id: 'aries', symbol: '♈', start: 321, end: 419,
      zh: { name: '白羊座', element: '火象', modality: '本位', ruler: '火星', keywords: ['启动', '直接', '勇气'], summary: '倾向在行动中建立信心，面对新局时容易先迈出第一步。', work: '适合需要启动、开拓、快速决策和明确负责的任务。', relation: '欣赏坦率与活力，冲突时需先降速再回到共同目标。', growth: '在行动前加一个短暂的风险检查，避免把果断变成急进。' },
      en: { name: 'Aries', element: 'Fire', modality: 'Cardinal', ruler: 'Mars', keywords: ['Initiative', 'Directness', 'Courage'], summary: 'Confidence often grows through action, and you may be quick to take the first step in a new situation.', work: 'You may enjoy launching, exploring, deciding quickly and owning a clear area of responsibility.', relation: 'Candour and vitality matter; during conflict, slow down before returning to the shared goal.', growth: 'Add a brief risk check before acting so decisiveness does not become haste.' }
    },
    {
      id: 'taurus', symbol: '♉', start: 420, end: 520,
      zh: { name: '金牛座', element: '土象', modality: '固定', ruler: '金星', keywords: ['稳定', '价值', '持续'], summary: '重视稳定的节奏与可感知的价值，常通过持续投入建立信任。', work: '适合需要耐心、品质、资源管理和长线积累的任务。', relation: '看重安全感与一致行动，也需要为变化保留协商空间。', growth: '定期检查“坚持”是否仍有回报，必要时允许更换方法。' },
      en: { name: 'Taurus', element: 'Earth', modality: 'Fixed', ruler: 'Venus', keywords: ['Stability', 'Value', 'Persistence'], summary: 'You often value a steady rhythm and tangible value, building trust through consistent investment.', work: 'Patient work involving quality, resources and long-term accumulation may suit you well.', relation: 'Security and consistent action matter, while change still needs room for negotiation.', growth: 'Check whether persistence still produces value, and allow the method to change when needed.' }
    },
    {
      id: 'gemini', symbol: '♊', start: 521, end: 621,
      zh: { name: '双子座', element: '风象', modality: '变动', ruler: '水星', keywords: ['好奇', '联结', '灵活'], summary: '常通过提问、比较和交流掌握环境，能快速在不同观点之间移动。', work: '适合资讯、沟通、学习、营销或需要多线连接的任务。', relation: '需要持续对话和思想流动，重要议题则应明确结论与跟进。', growth: '少一点无限展开，多一个完成标准和固定复盘时间。' },
      en: { name: 'Gemini', element: 'Air', modality: 'Mutable', ruler: 'Mercury', keywords: ['Curiosity', 'Connection', 'Adaptability'], summary: 'Questions, comparisons and conversation help you map a situation, and you can move quickly between viewpoints.', work: 'Information, communication, learning, marketing or multi-channel coordination may be engaging.', relation: 'Ongoing dialogue matters; important issues still need a clear conclusion and follow-through.', growth: 'Replace endless expansion with one completion standard and a scheduled review.' }
    },
    {
      id: 'cancer', symbol: '♋', start: 622, end: 722,
      zh: { name: '巨蟹座', element: '水象', modality: '本位', ruler: '月亮', keywords: ['安全', '照顾', '记忆'], summary: '对关系氛围与归属感较敏感，习惯先确保基础安稳再向外推进。', work: '适合服务、管理客户经验、承接长期关系与组织记忆。', relation: '会用行动照顾重要的人，同时需要直接说出需要与界限。', growth: '区分当下事实与旧经验触发的防卫，不必独自承担所有情绪。' },
      en: { name: 'Cancer', element: 'Water', modality: 'Cardinal', ruler: 'Moon', keywords: ['Security', 'Care', 'Memory'], summary: 'You may be highly aware of relational atmosphere and belonging, preferring to secure the base before moving outward.', work: 'Service, customer experience, long-term relationships and organisational memory can be strengths.', relation: 'Care is often shown through action; needs and limits still deserve direct words.', growth: 'Separate present facts from a defensive response triggered by an older experience.' }
    },
    {
      id: 'leo', symbol: '♌', start: 723, end: 822,
      zh: { name: '狮子座', element: '火象', modality: '固定', ruler: '太阳', keywords: ['表达', '创造', '担当'], summary: '希望把价值清楚地表达出来，容易在有责任感和可见成果的情境中发挥。', work: '适合创意领导、公开呈现、品牌或需要鼓舞他人的任务。', relation: '重视忠诚与认可，也要保留他人的舞台和反馈空间。', growth: '让自信与可修正并存，把反馈当成作品升级而不是否定。' },
      en: { name: 'Leo', element: 'Fire', modality: 'Fixed', ruler: 'Sun', keywords: ['Expression', 'Creation', 'Ownership'], summary: 'You may want value to be seen and expressed clearly, thriving where responsibility and visible outcomes meet.', work: 'Creative leadership, presentation, brand work or encouraging others may be rewarding.', relation: 'Loyalty and recognition matter, and other people also need room for their voice and feedback.', growth: 'Let confidence and revision coexist; treat feedback as an upgrade rather than a rejection.' }
    },
    {
      id: 'virgo', symbol: '♍', start: 823, end: 922,
      zh: { name: '处女座', element: '土象', modality: '变动', ruler: '水星', keywords: ['分析', '改善', '服务'], summary: '擅长发现细节差异和可改善之处，常通过整理与优化建立掌控感。', work: '适合研究、运营、质量控制、编辑与流程改进。', relation: '会用实际帮助表达关心，建议前先确认对方此刻是否需要方案。', growth: '设定“足够好”标准，避免完善细节挤压了交付和休息。' },
      en: { name: 'Virgo', element: 'Earth', modality: 'Mutable', ruler: 'Mercury', keywords: ['Analysis', 'Improvement', 'Service'], summary: 'You may quickly notice details and opportunities to improve, gaining clarity through organisation and refinement.', work: 'Research, operations, quality, editing and process improvement can fit this pattern.', relation: 'Care may be expressed through practical help; check whether advice is wanted before offering a solution.', growth: 'Define what is good enough so detail work does not crowd out delivery and rest.' }
    },
    {
      id: 'libra', symbol: '♎', start: 923, end: 1023,
      zh: { name: '天秤座', element: '风象', modality: '本位', ruler: '金星', keywords: ['平衡', '合作', '审美'], summary: '容易同时看见不同立场，倾向通过协商、比较与共同标准推进。', work: '适合协作、设计、谈判、客户关系与需要权衡的任务。', relation: '重视互惠与体面沟通，但必须把真实偏好也放进协商中。', growth: '为决定设时限与核心标准，不用延后选择来维持表面平静。' },
      en: { name: 'Libra', element: 'Air', modality: 'Cardinal', ruler: 'Venus', keywords: ['Balance', 'Collaboration', 'Aesthetics'], summary: 'You may see several sides at once and move through negotiation, comparison and shared standards.', work: 'Collaboration, design, negotiation, client relationships and balanced judgment may fit well.', relation: 'Mutuality and thoughtful communication matter, but your real preference must also enter the negotiation.', growth: 'Give decisions a deadline and a core standard instead of delaying choice to preserve surface calm.' }
    },
    {
      id: 'scorpio', symbol: '♏', start: 1024, end: 1122,
      zh: { name: '天蝎座', element: '水象', modality: '固定', ruler: '冥王星 / 火星', keywords: ['深度', '专注', '转化'], summary: '倾向穿过表面理解动机和核心矛盾，一旦投入便容易保持高强度专注。', work: '适合研究、调查、危机处理、资源整合与需要保密的任务。', relation: '重视真诚和深度信任，也需要直接确认而不是以猜测测试对方。', growth: '在高强度投入中安排退出条件，让专注不至于变成控制。' },
      en: { name: 'Scorpio', element: 'Water', modality: 'Fixed', ruler: 'Pluto / Mars', keywords: ['Depth', 'Focus', 'Transformation'], summary: 'You may look beneath the surface for motives and core tensions, sustaining intense focus once committed.', work: 'Research, investigation, crisis work, resource integration and confidential matters may suit you.', relation: 'Honesty and deep trust matter; direct confirmation works better than testing someone through assumptions.', growth: 'Define exit conditions for high-intensity commitments so focus does not become control.' }
    },
    {
      id: 'sagittarius', symbol: '♐', start: 1123, end: 1221,
      zh: { name: '射手座', element: '火象', modality: '变动', ruler: '木星', keywords: ['探索', '意义', '扩展'], summary: '容易被新视野、更大图景与值得追求的意义驱动。', work: '适合学习、教学、跨文化、传播与需要扩展边界的任务。', relation: '需要直率与成长空间，同时要把大方向落成可兑现的小承诺。', growth: '扩展前先检查资源和收尾能力，避免下一个可能性中断现在的交付。' },
      en: { name: 'Sagittarius', element: 'Fire', modality: 'Mutable', ruler: 'Jupiter', keywords: ['Exploration', 'Meaning', 'Expansion'], summary: 'New horizons, a wider picture and a meaningful pursuit may be powerful sources of motivation.', work: 'Learning, teaching, cross-cultural work, publishing and boundary-expanding projects may appeal.', relation: 'Candour and room to grow matter; broad intentions still need small promises that can be kept.', growth: 'Check resources and closure capacity before expanding so the next possibility does not interrupt delivery.' }
    }
  ];

  function validDate(year, month, day) {
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return date.getUTCFullYear() === Number(year) && date.getUTCMonth() + 1 === Number(month) && date.getUTCDate() === Number(day);
  }

  function calculate(input) {
    const year = Number(input && (input.year || input.y));
    const month = Number(input && (input.month || input.m));
    const day = Number(input && (input.day || input.d));
    if (!validDate(year, month, day)) throw new Error('Invalid Gregorian birth date');
    const key = month * 100 + day;
    const sign = SIGNS.find(item => item.start <= item.end
      ? key >= item.start && key <= item.end
      : key >= item.start || key <= item.end);
    return Object.assign({ year, month, day }, sign);
  }

  function localize(result, language) {
    if (!result) return null;
    const copy = language === 'en' ? result.en : result.zh;
    return Object.assign({ id: result.id, symbol: result.symbol, birthday: `${result.year}-${String(result.month).padStart(2, '0')}-${String(result.day).padStart(2, '0')}` }, copy);
  }

  root.TianjiAstrology = { SIGNS, calculate, localize };
})(typeof window !== 'undefined' ? window : globalThis);
