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
|   4. 原地轻点 -> 触发【双击切换全屏 / 单击唤醒控制栏】          |
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

### 3.2 垂直滑动分区调控与画面防过曝自适应算法
根据触摸起始点的 X 坐标将屏幕划分为左右双区：
- **左侧半屏 ($X_{\text{start}} < 0.5 \times W$)**：控制视频画面亮度（防过曝 Tone-Mapping 曲线调光）。
  - **暗部下调 ($\le 100\%$)**：采用平滑线性亮度缩减 `brightness(val)`，最低限制至 20%，保持暗部柔和不发灰。
  - **亮部提升 ($> 100\%$)**：传统线性倍增会导致高光死白、严重过曝。本插件创新采用**高光软压缩与对比度/饱和度动态补偿算法**：
    $$\text{lift} = \text{brightness}(1 + x \times 0.32)$$
    $$\text{contrast} = \text{contrast}(1 - x \times 0.14)$$
    $$\text{saturate} = \text{saturate}(1 + x \times 0.08)$$
    其中 $x = \text{val} - 1.0$。通过柔和提升暗部与中间调、压缩过亮高光并微幅补偿色彩饱和度，实现画质通透、明亮且绝不过曝的自然提亮效果。
- **右侧半屏 ($X_{\text{start}} \ge 0.5 \times W$)**：控制视频原生音量。
  - 直接写入 HTML5 Video 的 `video.volume` 属性（`0.0 ~ 1.0`）。

### 3.3 幽灵点击与 Windows 触屏右键弹窗拦截机制 (Ghost Click & Context Menu Suppression)
在 Windows 触控系统上，长按屏幕会被系统默认识别为“鼠标右键”，并在松手时分发 `contextmenu` 事件，导致弹出系统菜单或 B 站播放器右键菜单。

为此，插件采用了**全链路防误触双重拦截技术**：
1. **右键事件多级捕获吞噬**：
   在 `pointerdown`、手势滑动及长按加速开始/松手阶段，设置上下文菜单拦截时间窗 `suppressContextMenuUntil`，并在捕获阶段拦截 `this.container`、`this.touchLayer` 和 `window` 的所有 `contextmenu` 事件：
   ```javascript
   const suppressContextMenuHandler = (e) => {
     if (this.isLongPressing || this.hasExecutedGesture || this.isTracking || Date.now() < this.suppressContextMenuUntil || e.pointerType === 'touch') {
       e.preventDefault();
       e.stopPropagation();
       e.stopImmediatePropagation();
       this.dismissBiliContextMenu();
       return false;
     }
   };
   ```
2. **主动清理残留菜单 DOM**：
   在手势开始及结束时，主动遍历并关闭已渲染的 `.bpx-player-contextmenu` 元素，确保画面绝对干净。
3. **合成鼠标点击拦截**：
   设定 `suppressClickUntil` 门限，彻底吞噬手势抬手后产生的合成 `click` 与 `dblclick` 事件。

### 3.4 视频关键帧截图与雪碧图实时寻址与动态缩放算法 (Video Frame Sprite Preview & Aspect Ratio Adaptation)
为了在触控快速滑动快进/快退（Seek）时实现 60 FPS 丝滑的高清关键帧预览，插件采用了**自主雪碧图投影引擎为主、原生进度条反射为辅的双通道架构**，彻底解决了关键帧预览尺寸变形或仅显示局部一角的适配难题：

1. **关键帧画幅动态感知与 HUD 视口自适应**：
   - 优先读取官方 Videoshot 关键帧的真实几何尺寸比例（`img_x_size / img_y_size`），兜底结合 HTML5 Video 固有尺寸（`videoWidth / videoHeight`，兼容 16:9、4:3、21:9 宽画幅及 9:16 竖屏短视频）；
   - 动态计算并赋予 HUD 预览视口 `boxW` 与 `boxH`（横屏最大 160px，高度按画幅等比压缩，限制在 54px ~ 110px；竖屏最大 110px，宽度按画幅等比缩放），杜绝固定宽高引起的单帧拉伸形变或黑边。

2. **自主 Videoshot 引擎与二进制时间轴微秒寻址（Primary Channel）**：
   - 深度支持多 P 连播与番剧/电影多集（通过 URL、`__INITIAL_STATE__` 自动捕获 `bvid` 与 `cid`，生成状态缓存键 `${bvid}_${cid}`）；
   - 异步加载官方关键帧雪碧图（通常 10 列 x 10 行，共 100 帧/图），并利用内存 Image 对象进行预热缓存；
   - **二进制 `pvdata` 索引解析**：若视频提供二进制 `.bin` 索引文件，插件通过 `DataView` 实时反序列化 16 位大端无符号时间戳数组，并在手势滑动时通过 $O(\log N)$ 二分查找精确定位目标帧，彻底消除线性比例估算在未填满雪碧图尾部出现的黑屏与漂移；
   - **雪碧图无损等比投影定理**：
     无论原始雪碧图单帧是 160x90、320x180 还是其他分辨率，整张雪碧图的 CSS `background-size` 统一映射为：
     $$\text{background-size} = (C \times W_{\text{box}})\text{px} \quad (R \times H_{\text{box}})\text{px}$$
     目标关键帧的视口起始偏移量映射为：
     $$\text{background-position} = (-c \times W_{\text{box}})\text{px} \quad (-r \times H_{\text{box}})\text{px}$$
     在 HUD 容器中单帧像素与视口尺寸达成 100% 物理贴合，杜绝放大或裁剪。

3. **原生播放器反射与双模式解析（Secondary Channel）**：
   - 当自主 API 尚未返回时，向原生播放器分发 `mousemove` 激活其内部状态；
   - **CSS Sprite 镜像重投影**：提取原生帧坐标 $(X_{\text{native}}, Y_{\text{native}})$，利用 `window.getComputedStyle` 提取真实单帧与网格尺寸，进行行列归一化重新投影计算，修复了首帧 $(0, 0)$ 误识别为单图导致拉伸的严重缺陷；
   - **独立 DataURL 兼容**：若捕获到真实的 base64 裁剪数据流，以单帧无裁切模式完整渲染。

### 3.5 动态 DOM 监听与 SPA 路由适应
利用 `MutationObserver` 监控 DOM 树变动，同时配合 URL 历史变更（`popstate`）与周期性健康检查，确保在任何分 P 切换或推荐视频跳转后，手势控制器与雪碧图数据都能在第一时间自动无缝挂载。

---

## 4. 扩展配置与存储设计
- 采用 `chrome.storage.sync` 实现配置跨设备同步（若未登录账号则自动降级为本地存储）。
- 监听 `chrome.storage.onChanged` 事件，实现弹窗设置修改后**无需刷新网页，毫秒级热更新**生效。
