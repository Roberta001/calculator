
import React, { useState, useMemo } from 'react';
import { InputState, VideoType, RankingType, CalculationResults } from './types';

// Default formulas matching the standard Python logic
const DEFAULT_FORMULAS = {
  fixA: `// 修正系数A: 搬运稿硬币得分补偿 / Fix A: Coin compensation for reposts
if (coins <= 0) return 0;
if (type === 'ORIGINAL') return 1; // 原创为1 / Original is 1

// 搬运: 计算比例 / Repost: Calculate ratio
const val = (views + 20 * bookmarks + 40 * coins + 10 * likes) / (200 * coins);
return Math.ceil(Math.max(1, val) * 100) / 100;`,

  fixB: `// 修正系数B: 播放抑制 (云视听等) / Fix B: View suppression
if (views + 20 * bookmarks <= 0) return 0;

const num = 3 * Math.max(0, 20 * coins * fixA + 10 * likes);
const den = views + 20 * bookmarks;

// 限制在 0~1 之间 / Clamp between 0 and 1
return Math.ceil(Math.min(1, num / den) * 100) / 100;`,

  fixC: `// 修正系数C: 点赞抑制 (梗曲等) / Fix C: Like suppression
if (likes + bookmarks <= 0) return 0;

const num = likes + bookmarks + 20 * coins * fixA;
const den = 2 * likes + 2 * bookmarks;

return Math.ceil(Math.min(1, num / den) * 100) / 100;`,

  fixD: `// 修正系数D: 评论异常抑制 / Fix D: Comment anomaly suppression
if (comments <= 0) return 0;

const favLike = Math.max(1, bookmarks + likes);
const ratio = Math.min(1, favLike / (favLike + 0.1 * comments));

// Power of 20
return Math.ceil(Math.pow(ratio, 20) * 100) / 100;`
};

const App: React.FC = () => {
  const [inputs, setInputs] = useState<InputState>({
    views: 0,
    bookmarks: 0,
    coins: 0,
    likes: 0,
    danmaku: 0,
    comments: 0,
    shares: 0,
    type: VideoType.ORIGINAL,
    rankingType: RankingType.DAILY_WEEKLY,
    useCustomFormulas: false,
    customFormulas: DEFAULT_FORMULAS,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInputs((prev) => ({
      ...prev,
      [name]: value === '' ? 0 : Math.max(0, parseInt(value, 10) || 0),
    }));
  };

  const handleTypeChange = (type: VideoType) => {
    setInputs((prev) => ({ ...prev, type }));
  };

  const handleRankingChange = (rankingType: RankingType) => {
    setInputs((prev) => ({ ...prev, rankingType }));
  };

  const toggleCustomFormulas = () => {
    setInputs(prev => ({ ...prev, useCustomFormulas: !prev.useCustomFormulas }));
  };

  const handleFormulaChange = (key: keyof InputState['customFormulas'], value: string) => {
    setInputs(prev => ({
      ...prev,
      customFormulas: { ...prev.customFormulas, [key]: value }
    }));
  };

  const results = useMemo((): CalculationResults => {
    const { views, bookmarks, coins: rawCoins, likes, danmaku, comments, shares, type, rankingType, useCustomFormulas, customFormulas } = inputs;

    // Helper functions matching Python script logic
    const safeDiv = (num: number, den: number) => (den === 0 ? 0 : num / den);
    const ceil2 = (val: number) => Math.ceil(val * 100) / 100;
    const floor2 = (val: number) => Math.floor(val * 100) / 100;

    // Special case: "fake coin" rule
    let coins = rawCoins;
    if (coins === 0 && views > 0 && bookmarks > 0 && likes > 0) {
      coins = 1;
    }

    let fixA = 0, fixB = 0, fixC = 0, fixD = 0;

    // --- Correction Factor Calculation (Standard vs Custom) ---
    if (!useCustomFormulas) {
      // Standard Logic
      // Fix A
      if (coins > 0) {
        if (type === VideoType.ORIGINAL) {
          fixA = 1;
        } else {
          const val = Math.max(1, safeDiv(views + 20 * bookmarks + 40 * coins + 10 * likes, 200 * coins));
          fixA = ceil2(val);
        }
      }

      // Fix B
      if (views + 20 * bookmarks > 0) {
        const val = Math.min(1, safeDiv(3 * Math.max(0, 20 * coins * fixA + 10 * likes), views + 20 * bookmarks));
        fixB = ceil2(val);
      }

      // Fix C
      if (likes + bookmarks > 0) {
        const val = Math.min(1, safeDiv(likes + bookmarks + 20 * coins * fixA, 2 * likes + 2 * bookmarks));
        fixC = ceil2(val);
      }

      // Fix D
      if (comments > 0) {
        const favLike = Math.max(1, bookmarks + likes);
        const val = Math.pow(Math.min(1, safeDiv(favLike, favLike + 0.1 * comments)), 20);
        fixD = ceil2(val);
      }
    } else {
      // Custom Logic using Function constructor
      const createFn = (body: string, args: string[]) => {
        try {
          return new Function(...args, body);
        } catch (e) {
          console.error("Formula parse error", e);
          return () => 0;
        }
      };

      const evalFn = (fn: Function, args: any[]) => {
        try {
          const res = fn(...args);
          return typeof res === 'number' && !isNaN(res) ? res : 0;
        } catch (e) {
          console.error("Formula execution error", e);
          return 0;
        }
      };

      // Execute in order as dependencies exist (B and C depend on A)
      // Context for Fix A
      const fnA = createFn(customFormulas.fixA, ['views', 'bookmarks', 'coins', 'likes', 'danmaku', 'comments', 'shares', 'type']);
      fixA = evalFn(fnA, [views, bookmarks, coins, likes, danmaku, comments, shares, type]);

      // Context for Fix B (includes fixA)
      const fnB = createFn(customFormulas.fixB, ['views', 'bookmarks', 'coins', 'likes', 'danmaku', 'comments', 'shares', 'type', 'fixA']);
      fixB = evalFn(fnB, [views, bookmarks, coins, likes, danmaku, comments, shares, type, fixA]);

      // Context for Fix C (includes fixA)
      const fnC = createFn(customFormulas.fixC, ['views', 'bookmarks', 'coins', 'likes', 'danmaku', 'comments', 'shares', 'type', 'fixA']);
      fixC = evalFn(fnC, [views, bookmarks, coins, likes, danmaku, comments, shares, type, fixA]);

      // Context for Fix D
      const fnD = createFn(customFormulas.fixD, ['views', 'bookmarks', 'coins', 'likes', 'danmaku', 'comments', 'shares', 'type']);
      fixD = evalFn(fnD, [views, bookmarks, coins, likes, danmaku, comments, shares, type]);
    }

    let viewR = 0, favoriteR = 0, coinR = 0, likeR = 0, danmakuR = 0, replyR = 0, shareR = 0;

    // Score multipliers logic (Standard)
    if (rankingType === RankingType.DAILY_WEEKLY) {
      viewR = views <= 0 ? 0 : Math.max(ceil2(Math.min(safeDiv(Math.max(fixA * coins + bookmarks, 0) * 10, views), 1)), 0);
      favoriteR = bookmarks <= 0 ? 0 : Math.max(ceil2(Math.min(safeDiv((bookmarks + 2 * fixA * coins) * 10, bookmarks * 10 + views) * 20, 20)), 0);
      coinR = (fixA * coins * 40 + views) <= 0 ? 0 : Math.max(ceil2(Math.min(safeDiv(fixA * coins * 40, fixA * coins * 20 + views) * 40, 40)), 0);
      likeR = likes <= 0 ? 0 : Math.max(floor2(Math.min(5, safeDiv(Math.max(fixA * coins + bookmarks, 0), likes * 20 + views) * 100)), 0);
    } else {
      viewR = views <= 0 ? 0 : Math.max(ceil2(Math.min(safeDiv(Math.max(fixA * coins + bookmarks, 0) * 15, views), 1)), 0);
      favoriteR = bookmarks <= 0 ? 0 : Math.max(ceil2(Math.min(safeDiv((bookmarks + 2 * fixA * coins) * 10, bookmarks * 10 + views) * 20, 20)), 0);
      coinR = (fixA * coins * 40 + views) <= 0 ? 0 : Math.max(ceil2(Math.min(safeDiv(fixA * coins * 40, fixA * coins * 20 + views) * 40, 40)), 0);
      likeR = likes <= 0 ? 0 : Math.max(ceil2(Math.min(5, safeDiv(Math.max(fixA * coins + bookmarks, 0), likes * 20 + views) * 100)), 0);
    }

    // V2 extra scores
    danmakuR = danmaku <= 0 ? 0 : Math.max(ceil2(Math.min(100, safeDiv(Math.max(0, 20 * Math.max(0, comments) + bookmarks + likes), Math.max(1, danmaku, danmaku + comments)))), 0);
    replyR = comments <= 0 ? 0 : Math.max(ceil2(Math.min(safeDiv(400 * comments + 10 * likes + 10 * bookmarks, 200 * comments + views) * 20, 40)), 0);
    shareR = shares <= 0 ? 0 : Math.max(ceil2(Math.min(safeDiv(2 * fixA * coins + bookmarks, 5 * shares + likes) * 10, 10)), 0);

    // Offsets for Annual/Special
    if (rankingType === RankingType.ANNUAL_SPECIAL) {
      viewR = viewR / 2 + 0.5;
      favoriteR = favoriteR / 2 + 10;
      coinR = coinR / 2 + 20;
      likeR = likeR / 2 + 2.5;
      replyR = replyR / 2 + 20;
      shareR = shareR / 2 + 5;
    }

    const viewScore = views * viewR;
    const bookmarkScore = bookmarks * favoriteR;
    const coinScore = coins * coinR * fixA;
    const likeScore = likes * likeR;
    const danmakuScore = danmaku * danmakuR;
    const commentScore = comments * replyR * fixD;
    const shareScore = shares * shareR;

    const subTotal = viewScore + bookmarkScore + coinScore + likeScore + danmakuScore + commentScore + shareScore;
    const totalScore = Math.round(fixB * fixC * subTotal);

    return {
      fixA, fixB, fixC, fixD,
      corrections: {
        views: viewR, bookmarks: favoriteR, coins: coinR, likes: likeR, danmaku: danmakuR, comments: replyR, shares: shareR
      },
      scores: {
        views: viewScore, bookmarks: bookmarkScore, coins: coinScore, likes: likeScore, danmaku: danmakuScore, comments: commentScore, shares: shareScore
      },
      totalScore
    };
  }, [inputs]);

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8">
      {/* Input Section */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <InputGroup label="播放量 (Views)" name="views" value={inputs.views} onChange={handleInputChange} />
          <InputGroup label="收藏量 (Bookmarks)" name="bookmarks" value={inputs.bookmarks} onChange={handleInputChange} />
          <InputGroup label="硬币量 (Coins)" name="coins" value={inputs.coins} onChange={handleInputChange} />
          <InputGroup label="点赞量 (Likes)" name="likes" value={inputs.likes} onChange={handleInputChange} />
          <InputGroup label="弹幕量 (Danmaku)" name="danmaku" value={inputs.danmaku} onChange={handleInputChange} />
          <InputGroup label="评论量 (Comments)" name="comments" value={inputs.comments} onChange={handleInputChange} />
          <InputGroup label="分享量 (Shares)" name="shares" value={inputs.shares} onChange={handleInputChange} />
          
          <div className="flex flex-col space-y-2">
            <span className="text-sm font-medium text-gray-700">榜单类型 (Ranking Type)</span>
            <select
              value={inputs.rankingType}
              onChange={(e) => handleRankingChange(e.target.value as RankingType)}
              className="block w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900"
            >
              <option value={RankingType.DAILY_WEEKLY}>日刊 / 周刊</option>
              <option value={RankingType.MONTHLY}>月刊</option>
              <option value={RankingType.ANNUAL_SPECIAL}>年刊 / 特刊</option>
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
           <div className="flex flex-col space-y-2 w-full sm:w-auto">
             <span className="text-sm font-medium text-gray-700 block">视频类型 (Video Type)</span>
             <div className="flex bg-gray-100 rounded-lg p-1 max-w-xs">
                <button
                  onClick={() => handleTypeChange(VideoType.ORIGINAL)}
                  className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${
                    inputs.type === VideoType.ORIGINAL ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  原创
                </button>
                <button
                  onClick={() => handleTypeChange(VideoType.REPOST)}
                  className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${
                    inputs.type === VideoType.REPOST ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  搬运
                </button>
              </div>
           </div>
           
           <div className="flex items-center space-x-2">
              <label htmlFor="customFormulaToggle" className="text-sm font-medium text-gray-700">启用自定义公式</label>
              <button 
                id="customFormulaToggle"
                onClick={toggleCustomFormulas}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${inputs.useCustomFormulas ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition transition-transform ${inputs.useCustomFormulas ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
           </div>
        </div>
        
        {inputs.useCustomFormulas && (
          <div className="pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <FormulaEditor 
              label="Fix A (硬币补偿)" 
              value={inputs.customFormulas.fixA} 
              onChange={(val) => handleFormulaChange('fixA', val)}
              variables={['views', 'bookmarks', 'coins', 'likes', 'type']} 
            />
            <FormulaEditor 
              label="Fix B (播放抑制)" 
              value={inputs.customFormulas.fixB} 
              onChange={(val) => handleFormulaChange('fixB', val)}
              variables={['views', 'bookmarks', 'coins', 'likes', 'fixA']} 
            />
            <FormulaEditor 
              label="Fix C (点赞抑制)" 
              value={inputs.customFormulas.fixC} 
              onChange={(val) => handleFormulaChange('fixC', val)}
              variables={['bookmarks', 'coins', 'likes', 'fixA']} 
            />
            <FormulaEditor 
              label="Fix D (评论抑制)" 
              value={inputs.customFormulas.fixD} 
              onChange={(val) => handleFormulaChange('fixD', val)}
              variables={['bookmarks', 'likes', 'comments']} 
            />
          </div>
        )}
      </section>

      {/* Main Result Display */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-blue-600 text-white rounded-2xl shadow-xl p-8 flex flex-col items-center justify-center space-y-2">
            <h2 className="text-lg font-medium opacity-90 text-center uppercase tracking-widest">最终总得分 (Total Score)</h2>
            <p className="text-6xl font-bold tracking-tighter">
              {results.totalScore.toLocaleString()}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">修正系数 (Correction Factors)</h3>
            <div className="grid grid-cols-2 gap-4">
              <FactorDisplay label="fixA" value={results.fixA} description={inputs.useCustomFormulas ? "Custom" : "硬币补偿"} />
              <FactorDisplay label="fixB" value={results.fixB} description={inputs.useCustomFormulas ? "Custom" : "播放抑制"} />
              <FactorDisplay label="fixC" value={results.fixC} description={inputs.useCustomFormulas ? "Custom" : "点赞抑制"} />
              <FactorDisplay label="fixD" value={results.fixD} description={inputs.useCustomFormulas ? "Custom" : "评论抑制"} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">分数详情 (Score Breakdown)</h3>
          </div>
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">互动类别</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">补正系数 (R)</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">基础得分</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <Row label="播放分 (View)" corr={results.corrections.views} score={results.scores.views} />
              <Row label="收藏分 (Bookmark)" corr={results.corrections.bookmarks} score={results.scores.bookmarks} />
              <Row label="硬币分 (Coin)" corr={results.corrections.coins} score={results.scores.coins} extra="* fixA" />
              <Row label="点赞分 (Like)" corr={results.corrections.likes} score={results.scores.likes} />
              <Row label="弹幕分 (Danmaku)" corr={results.corrections.danmaku} score={results.scores.danmaku} />
              <Row label="评论分 (Comment)" corr={results.corrections.comments} score={results.scores.comments} extra="* fixD" />
              <Row label="分享分 (Share)" corr={results.corrections.shares} score={results.scores.shares} />
            </tbody>
          </table>
          <div className="p-4 bg-gray-50 text-xs text-gray-400 italic">
            * 最终总得分 = round(fixB * fixC * Σ各互动得分)
          </div>
        </div>
      </div>
    </div>
  );
};

interface InputGroupProps {
  label: string;
  name: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const InputGroup: React.FC<InputGroupProps> = ({ label, name, value, onChange }) => (
  <div className="flex flex-col space-y-1.5">
    <label htmlFor={name} className="text-sm font-medium text-gray-700">{label}</label>
    <input
      type="number"
      id={name}
      name={name}
      value={value === 0 ? '' : value}
      placeholder="0"
      onChange={onChange}
      className="block w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900 placeholder-gray-400"
    />
  </div>
);

const FormulaEditor: React.FC<{ label: string; value: string; onChange: (v: string) => void; variables: string[] }> = ({ label, value, onChange, variables }) => (
  <div className="flex flex-col space-y-2">
    <div className="flex justify-between items-end">
      <label className="text-xs font-bold uppercase text-gray-600 tracking-wider">{label}</label>
      <span className="text-[10px] text-gray-400 font-mono" title="Available variables">
        ({variables.join(', ')})
      </span>
    </div>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-32 p-3 text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none text-gray-800"
      spellCheck={false}
      placeholder="// Enter JavaScript code here... return a number."
    />
  </div>
);

const FactorDisplay: React.FC<{ label: string; value: number; description?: string }> = ({ label, value, description }) => (
  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col items-center">
    <span className="text-[10px] font-bold text-gray-400 mb-0.5">{label}</span>
    <span className="text-xl font-mono font-semibold text-gray-800">{value.toFixed(2)}</span>
    {description && <span className="text-[10px] text-gray-400 mt-1">{description}</span>}
  </div>
);

const Row: React.FC<{ label: string; corr: number; score: number; extra?: string }> = ({ label, corr, score, extra }) => (
  <tr className="hover:bg-gray-50/50 transition-colors">
    <td className="px-6 py-4 text-sm text-gray-700 font-medium">
      {label}
      {extra && <span className="ml-1 text-[10px] text-gray-400 font-normal">{extra}</span>}
    </td>
    <td className="px-6 py-4 text-sm text-blue-600 font-mono">× {corr.toFixed(2)}</td>
    <td className="px-6 py-4 text-sm text-gray-900 text-right font-semibold">{score.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
  </tr>
);

export default App;
