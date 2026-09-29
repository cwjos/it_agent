import type { KbArticle } from '@/lib/api';

export type MatchedArticle = {
  article: KbArticle;
  score: number;
  matchedKeywords: string[];
};

const categoryKeywords: Record<string, string[]> = {
  'VPN': ['vpn', '远程接入', '远程办公', '808', '掉线', '加密隧道'],
  'Outlook': ['outlook', '邮件', '邮箱', 'exchange', '收发邮件', '发送邮件'],
  '打印机': ['打印', 'printer', 'ip冲突', '脱机', '驱动'],
  '内网访问': ['内网', '内部网站', '业务系统', '门户', '访问不了'],
  '蓝屏': ['蓝屏', 'bsod', '死机', '0x000000', '崩溃'],
  '软件安装': ['安装', '依赖', '权限不足', '.net', '运行库', '管理员'],
  '共享文件夹': ['共享', '文件夹', 'smb', '网络路径', '共享目录'],
  'DNS': ['dns', '域名', '解析', 'nxdomain', 'nslookup', '网页打不开'],
  'Windows Update': ['更新', 'windows update', '补丁', '0x80070005', '0x80244018'],
  '黑屏': ['黑屏', '开机无显示', '无显示', '显示器', '电源灯亮'],
  '账号锁定': ['账号锁定', '密码过期', '登录失败', '锁定', '密码错误'],
  'WiFi': ['wifi', '无线', '无线网络', 'ssid', '无法连接到此网络'],
  'ERP': ['erp', '闪退', '无响应', '业务系统', '应用崩溃'],
  'NAS': ['nas', '备份', '空间不足', '存储', '数据备份'],
  '杀毒': ['杀毒', '病毒', '误报', '拦截', '隔离', '安全软件'],
  'RDP': ['rdp', '远程桌面', '3389', 'mstsc', '远程连接'],
  '时间同步': ['时间', 'ntp', '时间错误', '证书', 'cmos'],
  'C盘': ['c盘', '磁盘空间', '空间不足', '磁盘清理', '系统盘'],
  '浏览器': ['浏览器', '缓存', 'cookie', '网页缓慢', '显示异常', 'chrome', 'edge'],
};

export function searchKnowledgeBase(query: string, articles: KbArticle[]): MatchedArticle[] {
  const lowerQuery = query.toLowerCase();
  const results: MatchedArticle[] = [];

  for (const article of articles) {
    let score = 0;
    const matchedKeywords: string[] = [];

    for (const [catKey, keywords] of Object.entries(categoryKeywords)) {
      for (const kw of keywords) {
        if (lowerQuery.includes(kw.toLowerCase())) {
          if (article.title.toLowerCase().includes(catKey.toLowerCase()) ||
              article.tags?.some(t => t.toLowerCase().includes(kw.toLowerCase())) ||
              article.title.toLowerCase().includes(kw.toLowerCase())) {
            score += 3;
            matchedKeywords.push(kw);
          }
        }
      }
    }

    const titleWords = article.title.toLowerCase().split(/[\s,，、]+/);
    for (const word of titleWords) {
      if (word.length > 1 && lowerQuery.includes(word)) {
        score += 2;
        if (!matchedKeywords.includes(word)) matchedKeywords.push(word);
      }
    }

    for (const tag of article.tags ?? []) {
      if (lowerQuery.includes(tag.toLowerCase())) {
        score += 2;
        if (!matchedKeywords.includes(tag)) matchedKeywords.push(tag);
      }
    }

    if (article.content.toLowerCase().includes(lowerQuery) && lowerQuery.length > 5) {
      score += 1;
    }

    if (score > 0) {
      results.push({ article, score, matchedKeywords });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 3);
}

export type AgentResponse = {
  answer: string;
  thinking: string[];
  matchedArticles: MatchedArticle[];
  shouldCreateTicket: boolean;
  ticketReason: string;
};

export function generateAgentResponse(query: string, articles: KbArticle[]): AgentResponse {
  const matched = searchKnowledgeBase(query, articles);
  const thinking: string[] = [];

  thinking.push(`分析用户输入：「${query}」`);
  thinking.push(`正在检索知识库，共 ${articles.length} 篇文档...`);

  if (matched.length === 0) {
    thinking.push('未匹配到相关知识库文章');
    thinking.push('该问题可能需要人工介入处理');
    return {
      answer: '抱歉，我在知识库中没有找到与您的问题直接相关的解决方案。建议您创建一个工单，我们的技术支持团队会尽快为您处理。\n\n您也可以尝试用更具体的关键词描述问题，例如：VPN连接失败、打印机脱机、Outlook收发邮件等。',
      thinking,
      matchedArticles: [],
      shouldCreateTicket: true,
      ticketReason: '知识库无匹配结果，需人工处理',
    };
  }

  thinking.push(`匹配到 ${matched.length} 篇相关文章：${matched.map(m => `《${m.article.title}》`).join('、')}`);
  thinking.push(`最高匹配度：${matched[0].score} 分`);
  thinking.push('正在生成解决方案...');

  const topArticle = matched[0].article;
  const contentSections = topArticle.content.split('## ');
  const solutionSection = contentSections.find(s => s.startsWith('解决方案'));
  const stepsSection = contentSections.find(s => s.startsWith('排查步骤'));

  let answer = `根据知识库匹配，您的问题可能与 **《${topArticle.title}》** 相关。\n\n`;

  if (stepsSection) {
    answer += `**排查步骤：**\n${stepsSection.replace('排查步骤', '').trim()}\n\n`;
  }

  if (solutionSection) {
    answer += `**解决方案：**\n${solutionSection.replace('解决方案', '').trim()}\n\n`;
  }

  if (matched.length > 1) {
    answer += `**其他可能相关的文章：**\n`;
    matched.slice(1).forEach(m => {
      answer += `- 《${m.article.title}》（匹配度：${m.score}）\n`;
    });
  }

  const shouldCreateTicket = matched[0].score < 4;
  if (shouldCreateTicket) {
    answer += '\n\n如果以上方案未能解决您的问题，建议创建工单由技术人员跟进处理。';
    thinking.push('匹配度较低，建议创建工单');
  }

  return {
    answer,
    thinking,
    matchedArticles: matched,
    shouldCreateTicket,
    ticketReason: shouldCreateTicket ? '匹配度较低，需人工跟进' : '',
  };
}
