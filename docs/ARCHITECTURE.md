# 哔哩哔哩网页版触控手势插件技术实现与原理解说

本文档深度剖析 **Bilibili Touch Controller** 插件的底层架构、手势识别状态机、防误触拦截机制以及针对 Windows 触屏与 Chromium 内核的适配方案。

---

## 1. 核心痛点与技术挑战

### 1.1 Windows 触控屏在 Web 端的问题
在 Windows 触控设备（Surface 系列、二合一平板笔记本等）上访问 Bilibili 网页版时，由于网页播放器仅针对鼠标设计，会产生以下冲突：
1. **合成鼠标事件（Synthetic Mouse Events）**：触摸抬起后，Chromium 会在触点位置模拟分发 `mousedown`、`mouseup` 和 `click` 事件。这直接导致用户在屏幕上划动手势时，松手瞬间被误判为“点击视频画面”，触发播放器的播放/暂停切换。
2. **浏览器默认手势冲突**：Edge / Chrome 在 Windows 下默认启用了边缘滑动手势导航（前进/后退）、触控滑动滚动页面或双指缩放。若未正确设置 CSS 触控策略与事件阻止，滑动手势会被浏览器截获。
3. **SPA 页面动态生命周期**：B 站采用单页面应用架构（SPA），在换 P、进入番剧/影视、推荐视频无刷新跳转时，底层 `<video>` 标签与播放器容器会被动态重建，静态事件绑定会迅速失效。

---

## 2. 架构设计与手势状态机

插件采用分层架构设计：

```
+-------------------------------------------------------------+
|                     用户手指触摸 (Touch Input)                |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|           Pointer Event Capture Layer (触控捕获层)            |
|       touch-action: none !important; pointer-events: auto;  |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                 手势识别与仲裁器 (Gesture Arbiter)             |
|                                                             |
|   1. 触摸开始: 记录起始坐标 (startX, startY), 启动 400ms 长按定时器 |
|   2. 移动判定:                                               |
|      - 位移 > 14px -> 取消长按, 锁定手势方向                   |
|      - |ΔX| >= |ΔY| -> 锁定为【水平 Seek 手势】               |
|      - |ΔY| > |ΔX| 且位于左半屏 -> 锁定为【亮度调节手势】      |
|      - |ΔY| > |ΔX| 且位于右半屏 -> 锁定为【音量调节手势】      |
|   3. 静止长按 > 400ms -> 激活【2.0x~3.0x 高速播放】           |
|   4. 原地轻点 -> 触发【双击判定 / 单击唤醒控制栏】             |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|      执行引擎 (DOM / Video Control)   +   HUD 渲染引擎        |
|  - video.currentTime = targetTime    - 毛玻璃 OSD 浮层       |
|  - video.volume = targetVolume       - 进度条 / 时间差提示条   |
|  - video.style.filter = brightness   - 波纹反馈动效           |
|  - video.playbackRate = 2.0x         - 呼吸指示器             |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|           防误触与幽灵点击拦截器 (Ghost Click Suppressor)       |
|    - 阻止事件冒泡与默认行为 (stopPropagation / preventDefault)   |
|    - 设定 400ms 捕获拦截窗口，彻底吞噬后续合成的 click 事件       |
|    - 底部 55px 控制栏区域保留穿透，不影响原生进度条/设置点击     |
+-------------------------------------------------------------+
```

---

## 3. 关键算法与实现细节

### 3.1 水平滑动进度换算 (Seek Algorithm)
水平滑动进度采用线性敏感度映射公式：
$$\Delta t = \frac{\Delta x}{W_{\text{container}}} \times S_{\text{sensitivity}}$$
$$t_{\text{target}} = \text{clamp}(0, D, t_{\text{start}} + \Delta t)$$

- $W_{\text{container}}$：播放器容器的实时像素宽度。
- $S_{\text{sensitivity}}$：滑动跨度灵敏度（可在设置面板中调节，默认 90 秒，支持 30s ~ 240s）。
- $D$：当前视频总时长（`video.duration`）。
- $t_{\text{start}}$：手指按下时的视频初始时间戳。

在滑动过程中，仅实时计算并更新 HUD 上的目标时间预览与进度条，**不频繁触发视频 seek**（避免频繁解码导致卡顿）；只有当手指离开屏幕（`pointerup`）时，才执行最终的 `video.currentTime = targetSeekTime`。

### 3.2 垂直滑动分区调控
根据触摸起始点的 X 坐标将屏幕划分为左右双区：
- **左侧半屏 ($X_{\text{start}} < 0.5 \times W$)**：控制视频画面亮度。
  - 通过 CSS Filter 实现平滑亮度调节：`video.style.filter = 'brightness(' + brightness + ')'`。
  - 亮度调节范围限制在 `20% ~ 200%`，避免画面全黑或严重过曝。
- **右侧半屏 ($X_{\text{start}} \ge 0.5 \times W$)**：控制视频原生音量。
  - 直接写入 HTML5 Video 的 `video.volume` 属性（`0.0 ~ 1.0`）。

### 3.3 幽灵点击拦截机制 (Ghost Click Suppression)
当一次滑动、亮度调整或长按手势结束时，设置一个时间戳门限：
```javascript
this.suppressClickUntil = Date.now() + 400;
```
在播放器顶层以 **捕获阶段 (Capture Phase)** 监听 `click` 和 `dblclick` 事件：
```javascript
const suppressHandler = (e) => {
  if (Date.now() < this.suppressClickUntil) {
    e.stopPropagation();
    e.preventDefault();
  }
};
this.container.addEventListener('click', suppressHandler, true);
this.container.addEventListener('dblclick', suppressHandler, true);
```
彻底阻断 Windows 合成鼠标点击穿透至 B 站播放器核心，解决“滑动快进完视频自动暂停”的顽疾。

### 3.4 动态 DOM 监听与 SPA 路由适应
利用 `MutationObserver` 监控 DOM 树变动，同时配合 URL 历史变更（`popstate`）与周期性健康检查，确保在任何分 P 切换或推荐视频跳转后，手势控制器都能在第一时间自动无缝挂载。

---

## 4. 扩展配置与存储设计
- 采用 `chrome.storage.sync` 实现配置跨设备同步（若未登录账号则自动降级为本地存储）。
- 监听 `chrome.storage.onChanged` 事件，实现弹窗设置修改后**无需刷新网页，毫秒级热更新**生效。
