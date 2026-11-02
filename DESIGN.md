# RSI Agent — 设计文档

> 状态：草案 v0.1
> 范围：L3（agent 修改自身代码）
> 目标：建立一个可审计、可回滚、能长期运行的自我改进闭环，而不是追求“能力爆炸”。

---

## 0. 一句话

一个在隔离沙箱里反复修改自身代码、用固定评测集筛选、只保留可验证改进的 agent。

核心不是“改自己”，而是**让“什么算改进”无法被被改的一方操纵**。

---

## 1. 目标与非目标

### 目标

1. 自动完成闭环：读失败案例 → 提出代码改动 → 沙箱评测 → 保留提升且无回归的版本。
2. 每一轮可复现：同样的起点、同样的评测、同样的预算，能得到可比较的结果。
3. 每一轮可回滚：任何一次晋升都有 tag、diff、评测报告，一条命令退回。
4. 度量“元能力”：改进后的版本，是否更容易产生下一次改进。

### 非目标

1. 不做无人类监督的开放式能力增长。
2. 不允许修改评测器、沙箱、预算、日志、权限边界。
3. 不做生产环境自动部署。
4. 不追求通用 AGI；只在限定任务族上做纵向优化。

---

## 2. 威胁模型

L3 和 L1/L2 的区别是：被优化的对象和执行优化的主体是同一份代码。这带来几类必须提前防住的问题。

| 威胁 | 具体表现 | 防护 |
|---|---|---|
| 奖励黑客 | 改测试、跳过用例、mock 掉真实调用、写死期望值 | 隐藏测试；测试文件改动单独标记；变异测试 |
| 护栏移除 | 删权限检查、关日志、改 sandbox 配置 | harness 在可变范围外；路径白名单 |
| 资源滥用 | 死循环、并发爆炸、刷 token | 预算守卫、超时、并发上限 |
| 供应链 | 引入新依赖、执行任意脚本 | 依赖 allowlist；禁网；只允许锁文件内依赖 |
| 数据外泄 | 读环境变量/密钥、联网外传 | 环境变量清洗；无网络；只读挂载 |
| 评估污染 | train/holdout 泄漏、指标自欺 | holdout 对 Mutator 不可见；指标由 harness 计算 |
| 评审疲劳 | 人类不再认真看 diff | 强制抽检；高风险路径 100% 人工 |

> 原则：**被评测的东西，不能参与评测。**

---

## 3. 架构

```
┌─────────────────────────────────────────────────────────┐
│  Immutable Harness（不在可变范围）                       │
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐             │
│  │ Task Set │   │ Sandbox  │   │  Budget  │             │
│  │ train/   │   │ Runner   │   │  Guard   │             │
│  │ holdout  │   │          │   │          │             │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘             │
│       │              │              │                   │
│       └──────────────┼──────────────┘                   │
│                      ▼                                  │
│              ┌──────────────┐                           │
│              │  Evaluator   │                           │
│              └──────┬───────┘                           │
│                     │ metrics                           │
│                     ▼                                   │
│              ┌──────────────┐     ┌──────────────┐      │
│              │  Selector    │────▶│  Archivist   │      │
│              └──────┬───────┘     └──────────────┘      │
└─────────────────────┼───────────────────────────────────┘
                      │ promote / reject
                      ▼
┌─────────────────────────────────────────────────────────┐
│  Mutable Scope（agent 可以改）                           │
│                                                         │
│  agent/          prompts/          tools/               │
│  tests/ (标记)    docs/            配置（受限）          │
└─────────────────────────────────────────────────────────┘
                      ▲
                      │ patch
              ┌───────┴────────┐
              │    Mutator     │
              │  (LLM + tools) │
              └───────┬────────┘
                      │
              ┌───────┴────────┐
              │ Candidate Store│  git branch / worktree
              └────────────────┘
```

### 组件职责

| 组件 | 职责 | 是否可变 |
|---|---|---|
| Task Set | 训练/验证/隐藏测试任务 | 否 |
| Sandbox Runner | 起容器、限资源、禁网、收日志 | 否 |
| Evaluator | 跑测试/基准，计算指标 | 否 |
| Budget Guard | token/时间/并发上限 | 否 |
| Selector | 帕累托筛选，拒绝回归 | 否 |
| Archivist | 血统 DAG、指标、产物 | 否 |
| Mutator | 读失败案例，生成补丁 | **是** |
| Candidate Store | 每个候选一个 git 分支 | 否 |
| Human Gate | 晋升审批、抽检 | 否 |

### 主循环

```
baseline = evaluate(current)
for generation in 1..N:
    failures = sample_failures(baseline, train)
    candidates = mutator.propose(failures, current, k)
    for c in candidates:
        if not budget.allow(c): break
        result = evaluator.run(c)          # 隔离沙箱
        archive.add(c, result)
    winner = selector.pick(archive, current)
    if winner.regression or winner.gain < threshold:
        continue
    if touches_immutable_paths(winner): reject + alert
    if needs_human(winner): await approval
    current = promote(winner)
```

---

## 4. 可变边界

### 允许修改

- `agent/`：agent 的决策逻辑、工具调用编排
- `prompts/`：system prompt、子 agent prompt
- `tools/`：工具实现（受依赖 allowlist 限制）
- `tests/`：**允许改，但会单独标记，且不计入分数提升的来源**
- `docs/`：说明文档

### 禁止修改

- `harness/`：评测、沙箱、预算、日志、选择器
- `tasks/`：评测集与隐藏测试
- `.github/`：CI、权限、机器人配置
- 依赖清单与锁文件（新增依赖需人工批准）
- 任何安全/权限相关配置

### 强制规则

1. diff 命中禁止路径 → 自动拒绝，并记录一次“越界尝试”。
2. 测试文件改动 → 单独 review，且该候选的分数不因测试改动而提高。
3. 连续 N 次越界 → 暂停整个循环，人工介入。

---

## 4.5 Git / GitHub 作为安全基底

L3 的核心矛盾：执行改进的主体，和被改进的对象，是同一份代码。Git 和 GitHub 在这里不是“代码托管”，而是**外部状态机和外部审批人**。

### 4.5.1 三层隔离

| 层 | 作用 | 失效后果 |
|---|---|---|
| Git 分支 / 标签 | 每个候选独立 worktree；每次晋升打 tag | 可回滚到最后已知良好状态 |
| PR + CI | 改动必须过隐藏测试和静态检查 | 坏改动进不了 main |
| 权限 | agent 只能推分支、开 PR；不能合并、不能改 workflow | 即使 agent 想删护栏也做不到 |

> 只有 Git 没有权限隔离，等于一本记录它如何把自己改坏的日志。

### 4.5.2 权限模型

| 身份 | 允许 | 禁止 |
|---|---|---|
| Agent（GitHub App） | 推分支；开 PR；读 CI 结果 | 合并、改 workflow、改 branch protection、读 secrets、改仓库设置 |
| Human | 审批、合并、改 workflow | 日常不直接改 `agent/` |
| CI | 读代码、跑测试、写结果 | 不持有模型 API key；不写仓库 |

实现建议：

- 用 GitHub App 或 fine-grained PAT，只给 `contents: write`（分支）和 `pull_requests: write`。
- App 的 installation token 一小时过期，按需签发；私钥放在仓库外，不进入沙箱。
- **不要用 classic PAT + `repo` scope**，那等于给了改一切的权利。
- 仓库默认 `GITHUB_TOKEN` 权限设为 read-only，workflow 里显式声明最小权限。
- Agent 的 token 放在独立环境，不进入沙箱。
- Bot 用独立账号，不开 2FA 恢复权限，不和人类账号共用凭据。

### 4.5.3 自我修改的 PR 流程

```
1. agent 从 main 建分支 rsi/gen-<n>/<candidate>
2. 在分支上改代码并提交
3. push 分支，开 PR；body 写：改了什么、为什么、评测结果
4. CI 跑：单元测试 + 隐藏测试 + lint + 变异测试抽检
5. 若 diff 触及 harness/tasks/.github → 自动 fail，标记越界
6. Selector 比较指标；不达标 → 关 PR，记录
7. 达标 → 等待人工 review
8. 人类合并 → 打 tag v<gen>.<n> → 下一轮
```

关键点：

- **agent 永远不直接 push main**，即使技术上能做，branch protection 也会拒绝。
- **PR 是唯一入口**，讨论、CI、回滚都挂在 PR 上。
- **合并权在人**，不在 agent。

### 4.5.4 仓库配置清单

- [ ] `main` 开启 branch protection：require PR、require status checks、require CODEOWNERS、no force push、no bypass
- [ ] `harness/`、`tasks/`、`.github/` 加 CODEOWNERS，只由人类审批
- [ ] Actions 默认权限 read-only；禁止 workflow 自修改
- [ ] 隐藏测试放独立私有仓库，通过只读 deploy key 在 CI 拉取；agent 无权限
- [ ] 不在 PR 工作流里注入 secrets；避免 `pull_request_target`
- [ ] 开启 secret scanning / push protection
- [ ] 每次晋升打 tag，tag 也保护；保留至少 30 天
- [ ] 远程仓库做镜像备份，防止历史被改写
- [ ] 每周做一次回滚演练：随机挑一个 tag，验证能恢复

### 4.5.5 GitHub 特有的坑

1. **`pull_request_target` + secrets**：PR 代码在目标分支上下文执行，极易泄漏密钥。不要用。
2. **同仓库分支的 PR 能拿到 secrets**：隐藏测试不要放在同仓库 workflow 里，放私有仓库或外部服务。
3. **Workflow 也是代码**：agent 如果能改 `.github/workflows`，就能让 CI 永远绿。必须锁死。
4. **Force push**：关闭。回滚用 `git revert`，不改写历史。
5. **Submodule / 依赖**：agent 可以引入恶意依赖；用 allowlist + 锁文件校验。
6. **本地 `reset --hard` 不可怕**，远程 main 才是事实来源；前提是 agent 推不上去。

---

## 5. 评测设计（最关键）

### 任务集

- 50–200 个仓库级任务，每个任务有可执行测试。
- 来源：公开 benchmark（SWE-bench 风格）+ 自建任务 + 真实 issue 回放。
- 划分：
  - `train`：Mutator 可见，用于找失败模式
  - `val`：用于选择，不直接给 Mutator 看
  - `holdout`：只在最终评估用，全程隔离

### 指标

| 指标 | 说明 |
|---|---|
| task pass rate | 主指标 |
| regression rate | 原本通过、修改后失败的比率 |
| cost per task | token + 时间 |
| wall time | 端到端耗时 |
| patch acceptance | 人类/Selector 接受率 |
| meta-gain | 第 N+1 代相对第 N 代的“单位改进成本”变化 |

### 防作弊

1. **隐藏测试**：Mutator 看不到全部断言。
2. **变异测试**：定期往代码里注入 bug，确认测试能抓到。
3. **canary 任务**：几个极简任务，分数异常下降说明评测被污染。
4. **随机种子**：任务顺序、数据、并发都固定种子。
5. **重复运行**：每个候选至少跑 3 次，取中位数，避免抖动。
6. **显著性门槛**：提升小于阈值（例如 3%）不晋升。

### 统计

- 不比较单次运行，比较分布。
- 记录置信区间；样本不足时标记为“未决”，不晋升。

---

## 6. 沙箱与执行

- 宿主：Windows 11 + WSL2/Docker（评测在容器内，agent 在宿主）。
- 每次评测一个临时容器：只读挂载代码，写入 `/tmp`。
- 默认禁网；需要联网的任务单独标记、单独审批。
- 资源限制：CPU 2 核、内存 4 GB、单任务 10 分钟。
- 密钥：沙箱内不注入任何密钥；环境变量白名单。
- 产物：stdout/stderr、测试报告、diff、资源使用，全部归档。

---

## 7. 成本模型

单候选成本：

```
cost = model_calls × avg_tokens × price
     + eval_time × compute_price
     + retry_overhead
```

控制手段：

1. **级联评测**：先跑快测试，只有通过者才跑慢基准。
2. **缓存**：相同 diff 的评测结果直接复用。
3. **早停**：连续失败 3 个任务即终止该候选。
4. **预算守卫**：日预算、单轮预算、单候选预算三层。
5. **并发上限**：默认 2，避免成本失控。

粗算：假设每候选 8 次模型调用、每次 20k token、$3/M token，单候选约 $0.5；一轮 20 个候选约 $10；每天 5 轮约 $50。先按 $20/天做上限。

---

## 8. 安全与治理

1. **人工审批门**：
   - 触及禁止路径
   - 新增依赖
   - 需要联网
   - 连续晋升超过 3 代
2. **审计日志**：append-only，记录谁、何时、改了什么、评测结果。
3. **Kill switch**：一条命令停止循环、冻结所有候选。
4. **回滚**：每次晋升打 tag；`rsi rollback <tag>` 恢复。
5. **异常检测**：
   - 测试文件删除/跳过
   - 断言数量骤降
   - 运行时间异常缩短
   - 网络/文件系统越界

---

## 9. 里程碑

| 阶段 | 内容 | 验收标准 |
|---|---|---|
| **M0**（第 1 周） | 独立仓库 + 权限隔离 + 10 个任务 + 手工补丁 | 坏补丁被 CI 拦；好补丁能合并；回滚演练通过 |
| **M1**（第 2 周） | Bot 账号 + PR 流水线；agent 提第一个不碰 harness 的 PR | 越界路径自动拒绝；PR 必须人工合并 |
| **M2**（第 3–4 周） | 自我修改 `agent/`；多代；tag / rollback | 连续 5 代无回归；任意 tag 可恢复 |
| **M3**（第 5–6 周） | 长循环 + meta-gain 度量 | 单位改进成本下降，或明确证明没有 |

直接 L3 的前提是 M0 的权限和评测先到位；否则不是 L3，是事故。

> M0 是最重要的一步。评测不可信，后面全是幻觉。

---

## 10. 失败模式与应对

| 失败模式 | 早期信号 | 应对 |
|---|---|---|
| 奖励黑客 | 测试改动变多、断言变少 | 禁止路径、变异测试、人工抽检 |
| 过拟合 | train 涨、holdout 平 | 扩大 holdout、正则化任务族 |
| 成本失控 | 单轮成本超预算 | 预算守卫、级联、早停 |
| 测试抖动 | 同候选分数波动大 | 重复运行、固定种子、隔离环境 |
| 模型漂移 | 换模型后基线变化 | 固定模型版本；换模型重跑基线 |
| 评审疲劳 | 人工开始批量 approve | 抽检 + 高风险 100% 人工 |
| 沙箱逃逸 | 越界文件/网络访问 | 只读挂载、禁网、seccomp、审计 |

---

## 11. 与 opencode 的关系

两种集成方式：

1. **opencode 插件**：`rsi` 插件提供 `/rsi run`、`/rsi status`、`/rsi rollback`，用 SDK 驱动 Mutator。
2. **独立 harness**：通过 API 调用模型，opencode 只作为编码工具之一。

建议先做独立 harness（可控），稳定后再包一层插件。这样即使插件 API 变化，核心也不受影响。

---

## 12. 开放问题

1. “自我”的边界：只改代码，还是也改 prompt/工具？建议先只改 `agent/`。
2. 元能力怎么度量：单位改进成本是否随代际下降？需要更长的实验。
3. holdout 多大才够：任务族太窄会过拟合，太宽则信号弱。
4. 人类评审带宽：每天能认真看几个 diff？这决定循环速度。
5. 是否允许 Mutator 读自己的历史失败记录？允许会加速，也可能强化错误模式。

---

## 13. 参考资料

- Darwin Gödel Machine（Sakana AI）
- STOP: Self-Taught Optimizer
- AlphaEvolve（DeepMind）/ OpenEvolve
- ShinkaEvolve（Sakana AI）
- Gödel Agent
- DSPy / TextGrad
- SWE-bench / SWE-bench Verified

---

## 14. 下一步

1. 评审本设计，确认可变边界、权限模型和评测指标。
2. 建独立仓库：branch protection、CODEOWNERS、bot 账号、最小权限 token。
3. 做 M0：10 个任务 + 手写补丁，先验证 CI 和回滚。
4. M0 通过后，接 Mutator，让 agent 开第一个自我修改 PR。

> 如果 M0 都做不到“坏补丁被拦、好补丁能合、任意 tag 能回滚”，就不要进入 M1。
