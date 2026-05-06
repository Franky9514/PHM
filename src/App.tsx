/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Settings, 
  Database, 
  Cpu, 
  TrendingDown, 
  AlertTriangle, 
  BarChart3, 
  Info, 
  ArrowRight,
  ShieldCheck,
  Zap,
  Clock,
  ChevronRight,
  Search,
  RefreshCw,
  Gauge
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  AreaChart,
  Area,
  ComposedChart,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';

// --- 数据模拟 (映射代码逻辑) ---

// 0. GMM 聚类模拟数据 (Phase 1: 竞争风险事件识别)
const gmmClusterData = [
  { x: 20, y: 30, cluster: 1, name: '模式1: 高压涡轮退化' },
  { x: 25, y: 35, cluster: 1 },
  { x: 18, y: 28, cluster: 1 },
  { x: 70, y: 75, cluster: 2, name: '模式2: 压气机/风扇退化' },
  { x: 75, y: 80, cluster: 2 },
  { x: 68, y: 72, cluster: 2 },
  { x: 45, y: 50, cluster: 0, name: '正常工作区间' },
  { x: 50, y: 45, cluster: 0 },
];

// 1. RUL 预测数据 (真实 vs 预测)
const initialRulData = Array.from({ length: 50 }, (_, i) => ({
  index: i,
  real: Math.max(0, 150 - i * 3 + Math.random() * 5),
  pred: Math.max(0, 148 - i * 2.8 + Math.random() * 8),
}));

// 2. 生存概率曲线 S(t) - 深空探测 DeepHit 逻辑
const survivalData = Array.from({ length: 40 }, (_, i) => ({
  t: i * 5,
  mode1: Math.exp(-i / 15), // 故障模式1概率
  mode2: Math.exp(-i / 25), // 故障模式2概率
  overall: Math.exp(-i / 10), // 综合生存率
}));

// 3. 全局特征重要性 (SHAP Mean Absolute) - 根据文章 3.5.1 排序
const globalImportance = [
  { name: 'S11 (静压)', value: 0.45, color: '#ef4444' },
  { name: 'S4 (总温)', value: 0.38, color: '#f59e0b' },
  { name: 'S12 (燃油比)', value: 0.29, color: '#3b82f6' },
  { name: 'S7 (总压)', value: 0.21, color: '#8b5cf6' },
  { name: 'S3 (出口温度)', value: 0.12, color: '#10b981' },
];

// 4. 时间动态特征重要性 (核心亮点)
const temporalShapData = [
  { 
    stage: '早期 (健康)', 
    importance: [
      { feature: '工况参数', val: 0.6 },
      { feature: 'S7 振动', val: 0.1 },
      { feature: 'S11 流量', val: 0.1 },
      { feature: 'S4 压力', val: 0.15 },
      { feature: 'S3 温度', val: 0.05 }
    ]
  },
  { 
    stage: '中期 (退化)', 
    importance: [
      { feature: '工况参数', val: 0.2 },
      { feature: 'S7 振动', val: 0.35 },
      { feature: 'S11 流量', val: 0.25 },
      { feature: 'S4 压力', val: 0.15 },
      { feature: 'S3 温度', val: 0.05 }
    ]
  },
  { 
    stage: '后期 (失效临界)', 
    importance: [
      { feature: '工况参数', val: 0.05 },
      { feature: 'S7 振动', val: 0.55 },
      { feature: 'S11 流量', val: 0.25 },
      { feature: 'S4 压力', val: 0.1 },
      { feature: 'S3 温度', val: 0.05 }
    ]
  },
];

// --- 组件部分 ---

const Card = ({ title, children, icon: Icon, className = "", headerAction }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${className}`}
  >
    <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-5 h-5 text-indigo-600" />}
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </div>
      {headerAction}
    </div>
    <div className="p-6">
      {children}
    </div>
  </motion.div>
);

const FlowNode = ({ icon: Icon, title, desc, delay = 0 }: any) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.9 }}
    whileInView={{ opacity: 1, scale: 1 }}
    viewport={{ once: true }}
    transition={{ delay }}
    className="flex flex-col items-center flex-1 min-w-[120px]"
  >
    <div className="w-14 h-14 rounded-full bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center text-indigo-600 mb-3 shadow-inner">
      {Icon && <Icon className="w-7 h-7" />}
    </div>
    <span className="text-sm font-bold text-slate-800 mb-1">{title}</span>
    <span className="text-xs text-slate-500 text-center px-1 leading-tight">{desc}</span>
  </motion.div>
);

export default function App() {
  const [activeStage, setActiveStage] = useState(0);
  
  // 模拟输入参数: 3个工况设置 + 21个传感器 (共24个)
  const [inputs, setInputs] = useState(() => {
    const initial: Record<string, string> = {
      os1: '0.00', os2: '0.00', os3: '100.0'
    };
    for (let i = 1; i <= 21; i++) {
      initial[`s${i}`] = (Math.random() * 50 + 20).toFixed(1);
    }
    // 设置一些默认关注的特征 (FD003 特征)
    initial['s3'] = '1580.1';
    initial['s7'] = '553.2';
    initial['s11'] = '47.5';
    initial['s4'] = '1400.6';
    initial['s12'] = '521.4';
    return initial;
  });

  const [prediction, setPrediction] = useState({
    rul: 112,
    riskLevel: 'LOW',
    probability: 0.94,
    gmmMode: {
      mode1: 0.12,
      mode2: 0.08,
      mainEvent: 'NORMAL'
    }
  });

  const [isPredicting, setIsPredicting] = useState(false);

  // 模拟预测函数 (处理 24 个参数的逻辑映射)
  const handlePredict = () => {
    setIsPredicting(true);
    setTimeout(() => {
      // 模拟 FD003 核心敏感参数：s3(温度), s4(压力), s7(振动), s11(流量), s12(电压)
      const s11 = parseFloat(inputs.s11);
      const s4 = parseFloat(inputs.s4);
      const s7 = parseFloat(inputs.s7);
      
      // 这里的逻辑模拟退化趋势
      let baseRul = 180 - (s7 / 10) - (s11 / 2) - (Math.abs(1400 - s4) / 10);
      baseRul = Math.max(5, Math.min(250, baseRul));
      
      let level = 'LOW';
      if (baseRul < 60) level = 'HIGH';
      else if (baseRul < 120) level = 'MEDIUM';

      // 模拟 GMM 竞争风险概率变化
      const m1 = Math.min(0.9, (250 - baseRul) / 300 + (s11 > 50 ? 0.2 : 0));
      const m2 = Math.min(0.9, (250 - baseRul) / 400 + (s7 > 10 ? 0.15 : 0));

      setPrediction({
        rul: Math.round(baseRul),
        riskLevel: level,
        probability: (0.7 + Math.random() * 0.25).toFixed(2) as any,
        gmmMode: {
          mode1: parseFloat(m1.toFixed(2)),
          mode2: parseFloat(m2.toFixed(2)),
          mainEvent: level === 'HIGH' ? (m1 > m2 ? '高压涡轮失效' : '风扇系统失效') : '设备健康'
        }
      });
      setIsPredicting(false);
    }, 800);
  };

  const inputFields = [
    { group: '工况设置', fields: [
      { id: 'os1', label: 'Setting 1' },
      { id: 'os2', label: 'Setting 2' },
      { id: 'os3', label: 'Setting 3' },
    ]},
    { group: '核心传感器 (敏感特征)', fields: [
      { id: 's11', label: 'S11 (静压)', unit: 'psia' },
      { id: 's4', label: 'S4 (总温)', unit: 'K' },
      { id: 's12', label: 'S12 (燃油流量比)', unit: 'pps/psia' },
      { id: 's7', label: 'S7 (总压)', unit: 'psia' },
      { id: 's3', label: 'S3 (出口温度)', unit: 'K' },
    ]},
    { group: '辅助传感器 (S1-S21)', fields: [
      { id: 's1', label: 'S1' }, { id: 's2', label: 'S2' }, { id: 's5', label: 'S5' },
      { id: 's6', label: 'S6' }, { id: 's8', label: 'S8' }, { id: 's9', label: 'S9' },
      { id: 's10', label: 'S10' }, { id: 's13', label: 'S13' }, { id: 's14', label: 'S14' },
      { id: 's15', label: 'S15' }, { id: 's16', label: 'S16' }, { id: 's17', label: 'S17' },
      { id: 's18', label: 'S18' }, { id: 's19', label: 'S19' }, { id: 's20', label: 'S20' },
      { id: 's21', label: 'S21' }
    ]}
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* 导航栏 */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">PHM.Intelligent</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#dashboard" className="hover:text-indigo-600 transition-colors">核心大屏</a>
            <a href="#pipeline" className="hover:text-indigo-600 transition-colors">系统架构</a>
            <a href="#explain" className="hover:text-indigo-600 transition-colors">解析中心</a>
            <button className="bg-indigo-600/10 text-indigo-700 px-4 py-2 rounded-lg hover:bg-indigo-600/20 transition-all font-bold">
              设备状态: 运行中
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-12 space-y-16">
        
        {/* Banner */}
        <section className="relative h-[400px] rounded-3xl overflow-hidden bg-slate-900 flex items-center px-12">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600" />
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0 100 C 20 0 50 0 100 100 Z" fill="rgba(255,255,255,0.1)" />
            </svg>
          </div>
          <div className="relative z-10 max-w-2xl space-y-6">
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider"
            >
              <ShieldCheck className="w-4 h-4" /> DeepHit + RNN Integrated System
            </motion.div>
            <motion.h1 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-6xl font-bold text-white tracking-tight leading-tight"
            >
              工业设备PHM智能系统 <br />
              <span className="text-indigo-400">RUL预测 + 竞争风险分析</span>
            </motion.h1>
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-slate-400 text-lg"
            >
              基于 DeepHit 多风险生存分析与 LSTM 时序建模，提供端到端的设备故障自动识别、退化程度评估及多维可解释性报告。
            </motion.p>
          </div>
        </section>

        {/* 新增：实时风险与参数输入模块 */}
        <section id="dashboard" className="space-y-8">
          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* 1. 风险状态面板 */}
            <div className="lg:col-span-1 space-y-6">
              <Card title="GMM 竞争风险识别 (Phase 1)" icon={Cpu} className="bg-slate-900 border-none text-white overflow-visible">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-bold uppercase">实时无监督聚类状态</span>
                    <div className="px-2 py-0.5 rounded bg-indigo-500 text-[10px] font-bold">GMM ACTIVE</div>
                  </div>
                  <div className="h-32 relative">
                     <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart>
                          <XAxis type="number" dataKey="x" hide />
                          <YAxis type="number" dataKey="y" hide />
                          <ZAxis type="number" range={[50, 400]} />
                          <Scatter name="Clusters" data={gmmClusterData} fill="#4f46e5">
                            {gmmClusterData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.cluster === 1 ? '#f43f5e' : entry.cluster === 2 ? '#f59e0b' : '#10b981'} opacity={0.3} />
                            ))}
                          </Scatter>
                          {/* 当前位置点 */}
                          <Scatter data={[{ x: 50 + (1 - (prediction.rul/250)) * 40, y: 50 + (1 - (prediction.rul/250)) * 40 }]} fill="#fff" shape="circle" isAnimationActive={false} />
                        </ScatterChart>
                     </ResponsiveContainer>
                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-[10px] text-white/50 text-center bg-black/20 p-2 rounded backdrop-blur-sm">
                          Detected Event: <br />
                          <span className="text-indigo-300 font-bold uppercase">{prediction.gmmMode.mainEvent}</span>
                        </div>
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                      <div className="text-[9px] text-slate-400 uppercase">模式1 (CIF1) Prob</div>
                      <div className="text-sm font-black text-rose-400">{(prediction.gmmMode.mode1 * 100).toFixed(1)}%</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                      <div className="text-[9px] text-slate-400 uppercase">模式2 (CIF2) Prob</div>
                      <div className="text-sm font-black text-amber-400">{(prediction.gmmMode.mode2 * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="RUL 风险评估 (Phase 2)" icon={Gauge}>
                <div className="space-y-6 text-center pb-4">
                  <div className="relative inline-flex items-center justify-center">
                      <svg className="w-32 h-32">
                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                        <circle 
                          cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" 
                          strokeDasharray={364.4}
                          strokeDashoffset={364.4 * (1 - (prediction.rul / 250))}
                          strokeLinecap="round"
                          className={`transition-all duration-1000 ${
                            prediction.riskLevel === 'HIGH' ? 'text-red-500' : 
                            prediction.riskLevel === 'MEDIUM' ? 'text-amber-500' : 'text-emerald-500'
                          }`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center space-y-0.5">
                        <span className="text-3xl font-black text-slate-800">{prediction.rul}</span>
                        <span className="text-[8px] font-bold text-slate-500 uppercase">Cycles</span>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <div className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">等级</div>
                        <div className={`text-sm font-black ${
                          prediction.riskLevel === 'HIGH' ? 'text-red-600' : 
                          prediction.riskLevel === 'MEDIUM' ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {prediction.riskLevel}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <div className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">生存率</div>
                        <div className="text-sm font-black text-indigo-600">{(prediction.probability * 100).toFixed(0)}%</div>
                      </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* 2. 参数沙盒预测 */}
            <Card 
              title="预测沙盒 (NASA FD003 24维全参数集)" 
              icon={Search} 
              className="lg:col-span-2"
              headerAction={
                <button 
                  onClick={handlePredict}
                  disabled={isPredicting}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md active:scale-95"
                >
                  {isPredicting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <TrendingDown className="w-3 h-3" />}
                  执行深度推断
                </button>
              }
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500 max-w-md">调整 FD003 完整 24 维参数（3工况+21传感器）。系统将模拟 DeepHit 网络对高维非线性特征的融合计算。</p>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                    <Database className="w-3 h-3" /> CMAPSS_FD003_SET
                  </div>
                </div>
                
                <div className="space-y-8 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {inputFields.map((group, gIdx) => (
                    <div key={gIdx} className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-1 bg-indigo-500 rounded-full" />
                        <h4 className="text-sm font-bold text-slate-800">{group.group}</h4>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {group.fields.map(field => (
                          <div key={field.id} className="space-y-1.5 p-2 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200">
                             <label className="text-[10px] font-bold text-slate-500 flex justify-between">
                               {field.label}
                               {field.unit && <span className="text-indigo-300 font-normal">{field.unit}</span>}
                             </label>
                             <input 
                               type="number"
                               step="0.001"
                               value={(inputs as any)[field.id]}
                               onChange={(e) => setInputs({...inputs, [field.id]: e.target.value})}
                               className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium shadow-sm"
                             />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-indigo-900 rounded-2xl p-6 text-white relative overflow-hidden group shadow-xl">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 animate-pulse" />
                  <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-1">
                        <Zap className="w-3 h-3" /> 实时生存概率分析 $S(t)$
                      </div>
                      <h4 className="text-2xl font-bold">DeepHit RNN 推理结果</h4>
                    </div>
                    <div className="flex items-end gap-3">
                       <div className="text-sm text-indigo-300 mb-2 font-medium italic">Est. RUL Cycles</div>
                       <div className="text-6xl font-black text-white tabular-nums drop-shadow-lg">{prediction.rul}</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

          </div>
        </section>

        {/* 系统架构数据流 */}
        <section id="pipeline" className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-slate-800">核心算法 Pipeline</h2>
            <p className="text-slate-500">从原始传感信号到最终维护决策的 3-Phase 完整链路</p>
          </div>
          <div className="bg-white p-10 rounded-2xl border border-slate-100 flex flex-wrap items-center justify-between gap-8 relative">
            <FlowNode icon={Database} title="数据摄入" desc="CMAPSS FD003 24D" delay={0.1} />
            <div className="hidden lg:block text-slate-300"><ChevronRight /></div>
            <FlowNode icon={Cpu} title="Phase 1: GMM" desc="故障事件识别与风险打标" delay={0.2} />
            <div className="hidden lg:block text-slate-300"><ChevronRight /></div>
            <FlowNode icon={Clock} title="数据工程" desc={`Sliding Window (len=30)`} delay={0.3} />
            <div className="hidden lg:block text-slate-300"><ChevronRight /></div>
            <FlowNode icon={TrendingDown} title="Phase 2: DeepHit" desc="生存动态分析 S(t)" delay={0.4} />
            <div className="hidden lg:block text-slate-300"><ChevronRight /></div>
            <FlowNode icon={BarChart3} title="Phase 3: SurvSHAP" desc="多层级可解释性解析" delay={0.5} />
          </div>
        </section>

        {/* 模块细化说明 */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card title="1. GMM 事件识别 (Phase 1)" icon={Cpu}>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">使用 <strong>高斯混合模型(GMM)</strong> 对历史退化轨迹进行无监督聚类，自动提取潜在的故障事件标签，解决竞争风险建模中的标注缺失问题。</p>
              <div className="bg-slate-900 rounded-lg p-3 font-mono text-[10px] text-indigo-300 space-y-1">
                <p># GMM 聚类映射模式概率</p>
                <p>gmm = GMM(n_components=k)</p>
                <p>event_labels = gmm.predict(history)</p>
              </div>
            </div>
          </Card>
          <Card title="2. DeepHit RNN (Phase 2)" icon={TrendingDown}>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-24 bg-slate-50 border border-indigo-100 rounded-xl flex items-center justify-center relative overflow-hidden">
                   <div className="flex gap-1">
                     {[1,2,3,4,5,6].map(i => (
                       <motion.div 
                        key={i}
                        animate={{ height: [15, 45, 15] }} 
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
                        className="w-1 bg-indigo-500 rounded-full" 
                       />
                     ))}
                   </div>
                </div>
              </div>
              <p className="text-sm text-slate-600">
                结合 <strong>LSTM 双向提取</strong> 与 DeepHit 生存分析层，直接预测生存时间分布与多风险竞争模式。
              </p>
            </div>
          </Card>
          <Card title="3. SurvSHAP 归因 (Phase 3)" icon={BarChart3}>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">基于 <strong>SurvSHAP</strong> 的时间动态属性解析，揭示每个传感器在设备退化不同阶段对风险的具体贡献量。</p>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="text-[9px] text-slate-400 mb-1">归因度: dS(t) / dX</div>
                <div className="h-1.5 bg-indigo-100 rounded-full w-full overflow-hidden">
                    <motion.div animate={{ x: [-100, 200] }} transition={{ duration: 2, repeat: Infinity }} className="h-full w-20 bg-indigo-500" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* 模型结果展示 */}
        <section id="results" className="space-y-8">
          <div className="flex flex-col md:flex-row gap-6">
            <Card title="RUL 寿命预测趋势 (Real vs Pred)" icon={Activity} className="flex-1">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={initialRulData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="index" label={{ value: 'Time Cycle', position: 'insideBottom', offset: -5 }} />
                    <YAxis label={{ value: 'RUL (Cycles)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend verticalAlign="top" height={36}/>
                    <Line type="monotone" dataKey="real" stroke="#1e293b" name="真实 RUL" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="pred" stroke="#4f46e5" name="预测 RUL (DeepHit)" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="生存演化与风险分层 (DeepHit 输出)" icon={TrendingDown} className="flex-1">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={survivalData}>
                    <defs>
                      <linearGradient id="colorOverall" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                    <XAxis dataKey="t" label={{ value: '预测步长 (Cycles)', position: 'insideBottom', offset: -5 }} />
                    <YAxis domain={[0, 1]} label={{ value: '概率 S(t)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px' }} />
                    <Legend verticalAlign="top" height={36}/>
                    <Area type="monotone" dataKey="overall" stroke="#4f46e5" fillOpacity={1} fill="url(#colorOverall)" name="综合生存函数 S(t)" strokeWidth={3} />
                    <Line type="monotone" dataKey="mode1" stroke="#f43f5e" name="模式1 (高压涡轮) CIF" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="mode2" stroke="#f59e0b" name="模式2 (风扇/压气机) CIF" dot={false} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                注：S(t) 表示设备在时间 t 之前不发生故障的概率。DeepHit 模型通过联合建模捕捉多种退化模式（如高压涡轮/风扇退化）的竞争风险关系。评分 S_risk = 1 - S(t) 用于确定维护优先级（风险分层：高/中/低）。
              </div>
            </Card>
          </div>
        </section>

        {/* 特征重要性 */}
        <section id="explain" className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-slate-800">模型可解释性总结</h2>
            <p className="text-slate-500">基于 SHAP 归因的系统决策支持</p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-8">
            {/* 全局特征重要性 */}
            <Card title="全局特征贡献排名" icon={BarChart3}>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={globalImportance} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                      {globalImportance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex gap-4">
                <Info className="w-6 h-6 text-indigo-600 flex-shrink-0" />
                <p className="text-xs text-indigo-800 leading-relaxed italic">
                  * 分析显示 <strong>S11 (静压)</strong> 是影响 RUL 预测的首要特征。这与高压压气机出口静压直接反映燃烧室入口压力及气流稳定性是一致的，是目前 DeepHit 模型最敏感的风险监控点。
                </p>
              </div>
            </Card>

            {/* 时间动态特征重要性 (核心亮点) */}
            <Card title="🔥 时间动态特征演变分析" icon={Clock} className="relative ring-2 ring-indigo-500/20">
              <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
                {temporalShapData.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveStage(i)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                      activeStage === i 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {d.stage}
                  </button>
                ))}
              </div>

              <div className="h-[240px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStage}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={temporalShapData[activeStage].importance}>
                        <XAxis dataKey="feature" tick={{ fontSize: 10 }} />
                        <YAxis hide domain={[0, 0.7]} />
                        <Tooltip />
                        <Bar dataKey="val" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="val" stroke="#f43f5e" dot={{ r: 4 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-6 space-y-3">
                <h4 className="text-sm font-bold text-slate-800">阶段解释：</h4>
                <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {activeStage === 0 && "设备各部件状态良好，此时预测主要依赖工况参数，传感器读数相对稳定。"}
                  {activeStage === 1 && "内部组件开始退化，S7 和 S11 特征的权重显著上升，预示着亚健康状态的开始。"}
                  {activeStage === 2 && "关键传感器主导预测结果。通过捕捉微小的偏离变化，系统能够实现极高精度的临终失效告警。"}
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* 总结 */}
        <section className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-12 text-center space-y-6">
          <h2 className="text-3xl font-bold text-white">智慧运维决策核心</h2>
          <p className="max-w-2xl mx-auto text-indigo-200/70 text-lg">
            本系统不仅能够通过 DeepHit 获取精准的 RUL 预测值，更能揭示失效风险的深层原因。
            通过时间动态属性分析，支持企业从“定期维检”向“状态修、预测修”实现数字化转型。
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <div className="bg-white/10 backdrop-blur-sm px-6 py-4 rounded-2xl border border-white/10 space-y-1">
              <div className="text-3xl font-bold text-white">0.824</div>
              <div className="text-xs text-indigo-300 font-medium uppercase tracking-tighter">C-index (动态排序精度)</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm px-6 py-4 rounded-2xl border border-white/10 space-y-1">
              <div className="text-3xl font-bold text-white">18.6</div>
              <div className="text-xs text-indigo-300 font-medium uppercase tracking-tighter">评估 score (RMSE)</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm px-6 py-4 rounded-2xl border border-white/10 space-y-1">
              <div className="text-3xl font-bold text-white">96.5%</div>
              <div className="text-xs text-indigo-300 font-medium uppercase tracking-tighter">GMM 故障识别召回率</div>
            </div>
          </div>
        </section>

      </main>

      <footer className="bg-white border-t border-slate-200 pt-12 pb-24">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-3 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="w-6 h-6 text-indigo-600" />
              <span className="font-bold text-xl tracking-tight text-slate-800">PHM.Intelligent</span>
            </div>
            <p className="text-sm text-slate-500">
              专业的工业预测性维护解决方案，致力于将 AI 洞察转化为实际的工业价值。
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-4">技术栈</h4>
            <ul className="text-sm text-slate-500 space-y-2">
              <li>Tensorflow / PyTorch</li>
              <li>DeepHit Survival Model</li>
              <li>LSTM Temporal Attention</li>
              <li>GMM Fault Clustering</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">联系我们</h4>
            <p className="text-sm text-slate-500">服务全球范围内的航空、轨道交通与能源行业客户。</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
