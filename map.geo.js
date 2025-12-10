/**
 * Rectangle — 判断是否属于中国境内（含排除区）
 * 完全对应 PHP Rectangle 类
 */
class Rectangle {
  constructor(lng1, lat1, lng2, lat2) {
    this._west = Math.min(lng1, lng2);
    this._north = Math.max(lat1, lat2);
    this._east = Math.max(lng1, lng2);
    this._south = Math.min(lat1, lat2);
  }

  contain(lon, lat) {
    return (
      this._west <= lon &&
      this._east >= lon &&
      this._north >= lat &&
      this._south <= lat
    );
  }

  static initData() {
    if (!Rectangle._region) {
      Rectangle._region = [
        new Rectangle(79.446200, 49.220400, 96.330000, 42.889900),
        new Rectangle(109.687200, 54.141500, 135.000200, 39.374200),
        new Rectangle(73.124600, 42.889900, 124.143255, 29.529700),
        new Rectangle(82.968400, 29.529700, 97.035200, 26.718600),
        new Rectangle(97.025300, 29.529700, 124.367395, 20.414096),
        new Rectangle(107.975793, 20.414096, 111.744104, 17.871542),
      ];
    }

    if (!Rectangle._exclude) {
      Rectangle._exclude = [
        new Rectangle(119.921265, 25.398623, 122.497559, 21.785006),
        new Rectangle(101.865200, 22.284000, 106.665000, 20.098800),
        new Rectangle(106.452500, 21.542200, 108.051000, 20.487800),
        new Rectangle(109.032300, 55.817500, 119.127000, 50.325700),
        new Rectangle(127.456800, 55.817500, 137.022700, 49.557400),
        new Rectangle(131.266200, 44.892200, 137.022700, 42.569200),
        new Rectangle(73.124600, 35.398637, 77.948114, 29.529700),
      ];
    }
  }

  /** 判断是否属于中国（排除香港/澳门/台湾等区域） */
  static isInChina(lon, lat) {
    Rectangle.initData();
    for (let region of Rectangle._region) {
      if (region.contain(lon, lat)) {
        for (let exclude of Rectangle._exclude) {
          if (exclude.contain(lon, lat)) {
            return false;
          }
        }
        return true;
      }
    }
    return false;
  }
}

/**
 * Coordtransform — 坐标系转换（BD09 / GCJ02 / WGS84）
 * 完全对应 PHP Coordtransform 类
 */
class Coordtransform {
  static x_PI = Math.PI * 3000.0 / 180.0;
  static PI = Math.PI;
  static a = 6378245.0;
  static ee = 0.00669342162296594323;

  /** BD09 → GCJ02 */
  static bd09ToGcj02(lng, lat) {
    const x = lng - 0.0065;
    const y = lat - 0.006;
    const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * this.x_PI);
    const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * this.x_PI);
    return [z * Math.cos(theta), z * Math.sin(theta)];
  }

  /** GCJ02 → BD09 */
  static gcj02ToBd09(lng, lat) {
    const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * this.x_PI);
    const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * this.x_PI);
    return [
      z * Math.cos(theta) + 0.0065,
      z * Math.sin(theta) + 0.006
    ];
  }

  /** WGS84 → GCJ02 */
  static wgs84ToGcj02(lng, lat) {
    if (!Rectangle.isInChina(lng, lat)) return [lng, lat];
    return this._transform(lng, lat);
  }

  /** GCJ02 → WGS84 */
  static gcj02ToWgs84(lng, lat) {
    if (!Rectangle.isInChina(lng, lat)) return [lng, lat];
    const t = this._transform(lng, lat);
    return [lng * 2 - t[0], lat * 2 - t[1]];
  }

  /** BD09 → WGS84（你最主要使用的功能） */
  static bd09ToWgs84(lng, lat) {
    if (!Rectangle.isInChina(lng, lat)) return [lng, lat];
    const gcj = this.bd09ToGcj02(lng, lat);
    return this.gcj02ToWgs84(gcj[0], gcj[1]);
  }

  /** WGS84 → BD09 */
  static wgs84ToBd09(lng, lat) {
    if (!Rectangle.isInChina(lng, lat)) return [lng, lat];
    const gcj = this.wgs84ToGcj02(lng, lat);
    return this.gcj02ToBd09(gcj[0], gcj[1]);
  }

  /** 内部使用：WGS84 ⇄ GCJ02 变换公式 */
  static _transform(lng, lat) {
    let dLat = this._transformLat(lng - 105.0, lat - 35.0);
    let dLng = this._transformLng(lng - 105.0, lat - 35.0);
    const radLat = lat / 180.0 * this.PI;
    let magic = Math.sin(radLat);
    magic = 1 - this.ee * magic * magic;
    const sqrtMagic = Math.sqrt(magic);

    dLat = (dLat * 180.0) / ((this.a * (1 - this.ee)) / (magic * sqrtMagic) * this.PI);
    dLng = (dLng * 180.0) / (this.a / sqrtMagic * Math.cos(radLat) * this.PI);

    return [lng + dLng, lat + dLat];
  }

  static _transformLat(lng, lat) {
    let ret =
      -100.0 + 2.0 * lng + 3.0 * lat +
      0.2 * lat * lat + 0.1 * lng * lat +
      0.2 * Math.sqrt(Math.abs(lng));

    ret += (20.0 * Math.sin(6.0 * lng * this.PI) +
      20.0 * Math.sin(2.0 * lng * this.PI)) * 2.0 / 3.0;

    ret += (20.0 * Math.sin(lat * this.PI) +
      40.0 * Math.sin(lat / 3.0 * this.PI)) * 2.0 / 3.0;

    ret += (160.0 * Math.sin(lat / 12.0 * this.PI) +
      320 * Math.sin(lat * this.PI / 30.0)) * 2.0 / 3.0;

    return ret;
  }
}


let _markerPoints = [];
const TRANSLATE_CONCURRENCY = 2;
const TRANSLATE_TIMEOUT_MS = 45000;
const TRANSLATE_RETRY = 2;
const TRANSLATE_FALLBACK = true;
const _translateCache = new Map();
const _translateQueue = createConcurrencyQueue(TRANSLATE_CONCURRENCY);


// 清理 OSM / 翻译请求中的原始文本：去标签、收敛空白、选择中文优先的多语并列项。
function cleanOsmText(text) {
  if (!text) return "";
  if (typeof text !== 'string') text = String(text);

  // 去掉 HTML 标签
  let s = text.replace(/<[^>]+>/g, '');

  // 多语言并列（例如：韩国 / 南韓）优先保留含汉字的项
  if (s.includes('/')) {
    const parts = s.split('/').map(t => t.trim()).filter(Boolean);
    const cn = parts.find(p => /[\u4e00-\u9fa5]/.test(p));
    s = cn || parts[0] || s;
  }

  // 合并多空白为单空格并去首尾空格
  s = s.replace(/\s+/g, ' ').trim();

  // 移除纯数字邮编（长度 3-6）和常见噪声
  s = s.replace(/\b\d{3,6}\b/g, '').replace(/\b\d{3}-\d{4}\b/g, '');

  return s;
}

// 清洗并格式化最终输出文本（不做繁简转换，保持原文）
async function cleanTranslatedText(text, poi) {
  if (!text) return "";

  // 1) 去掉多语言并列，例如：韩国 / 南韓 -> 优先含汉字的项
  if (text.includes("/")) {
    let parts = text.split("/").map(t => t.trim()).filter(Boolean);
    const cn = parts.find(p => /[\u4e00-\u9fa5]/.test(p));
    text = cn || parts[0] || text;
  }

  // 2) 合并空白并去首尾
  text = text.replace(/\s+/g, ' ').trim();

  // 3) 去掉邮编
  text = text.replace(/\b\d{3,6}\b/g, '').replace(/\b\d{3}-\d{4}\b/g, '');

  // 4) 切分为 token，去重并保留原序
  const tokens = text.split(/\s+/).filter(Boolean);
  const uniq = [];
  for (let t of tokens) if (uniq.indexOf(t) === -1) uniq.push(t);

  // 5) 最多取前三段（国家、州、省/县）
  let base = uniq.slice(0, 6).join(' ');

  // 6) 如果有 poi，则原样追加（不再额外转换）
  if (poi) base += `（附近：${poi}）`;

  return base.trim();
}

async function translateAddressComponents(addrObj, poi) {
  if (!addrObj || typeof addrObj !== 'object') return '';

  const order = [
    'country',
    'state', 'state_district', 'region',
    'county',
    'city', 'municipality', 'town', 'suburb', 'village', 'neighbourhood',
    'road', 'house_number'
  ];

  let parts = [];
  const seen = new Set();

  for (let key of order) {
    let raw = addrObj[key];
    if (!raw) continue;

    // ---------- ① 基础归一化（保持原文） ----------
    raw = String(raw);

    // ---------- ② 去掉斜杠并列 ----------
    raw = raw.split(/[\/;；]/)[0].trim();
    if (!raw) continue;

    // ---------- ③ 去重 ----------
    if (seen.has(raw)) continue;
    seen.add(raw);

    // ---------- ④ 除国家外，英文才需要翻译 ----------
    let translated = raw;
    if (key === "country") {
      try { translated = await ensureTranslatedToZh(raw); } catch (e) { }
    } else if (/^[\x00-\x7F]+$/.test(raw)) {
      try { translated = await ensureTranslatedToZh(raw); } catch (e) { }
    }

    // ---------- ⑤ 翻译结果直接使用（不做繁简转换） ----------

    if (translated) parts.push(translated);
  }

  // ---------- ⑥ 去重 + 不再 3 级限制 ----------
  const uniq = [...new Set(parts)];

  return uniq.join(" ");
}

function fetchWithTimeout(url, opts = {}, timeout = TRANSLATE_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), timeout);
    fetch(url, opts).then(r => {
      clearTimeout(timer);
      resolve(r);
    }).catch(err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Fetch with retries and timeout. Returns the Response or throws.
 * attempts: number of attempts (>=1)
 */
async function fetchWithRetries(url, opts = {}, attempts = 2, timeout = TRANSLATE_TIMEOUT_MS) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetchWithTimeout(url, opts, timeout);
      return res;
    } catch (err) {
      lastErr = err;
      // small backoff
      await new Promise(r => setTimeout(r, 200 * (i + 1)));
    }
  }
  throw lastErr || new Error('fetch failed');
}
function createConcurrencyQueue(concurrency = TRANSLATE_CONCURRENCY) {
  const queue = [];
  let running = 0;

  function runNext() {
    if (running >= concurrency || queue.length === 0) return;

    const { fn, resolve, reject } = queue.shift();
    running++;

    fn().then(res => {
      running--;
      resolve(res);
      runNext();
    }).catch(err => {
      running--;
      reject(err);
      runNext();
    });
  }

  return {
    push(fn) {
      return new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        setTimeout(runNext, 0);
      });
    }
  };
}

async function ensureTranslatedToZh(text) {
  if (!text) return text;

  // 第一轮：auto 检测
  const auto = await doTranslateToZh(text, "auto");
  if (/[\u4e00-\u9fff]/.test(auto)) return auto;

  // 第二轮：强制从英文翻译
  const en = await doTranslateToZh(text, "en");
  if (/[\u4e00-\u9fff]/.test(en)) return en;

  // 兜底：原文附加（保持可读）
  if (auto !== text) return auto;
  return `${auto}（${text}）`;
}

async function doTranslateToZh(text, src = 'auto') {
  if (!text) return text;
  const key = text + "|" + src;
  if (_translateCache.has(key)) return _translateCache.get(key);

  const url = "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t"
    + `&sl=${encodeURIComponent(src)}&tl=zh-CN&q=${encodeURIComponent(text)}`;

  let resText = "";
  try {
    const resp = await fetchWithTimeout(url, {}, TRANSLATE_TIMEOUT_MS);
    resText = await resp.text();
  } catch (e) {
    return text; // 网络失败则保留原文
  }

  if (!resText || resText.startsWith("<")) return text;

  let data;
  try { data = JSON.parse(resText); }
  catch { return text; }

  let translated = "";
  if (Array.isArray(data) && Array.isArray(data[0])) {
    translated = data[0].map(x => x[0]).join("").trim();
  } else {
    translated = String(data || "").trim();
  }

  _translateCache.set(key, translated);
  return translated;
}



// 外部主函数：接收 OSM 的 display_name 或 address JSON，返回 Promise<简体中文字符串>
async function translateOsmToZh(osmTextOrObj) {
  // 如果传入的是对象（nominatim 的 address 或完整 result），优先提取 display_name / name / address fields
  let raw = "";
  if (!osmTextOrObj) return "";

  if (typeof osmTextOrObj === "string") {
    raw = osmTextOrObj;
  } else if (typeof osmTextOrObj === "object") {
    // 尝试优先字段
    raw = osmTextOrObj.display_name || osmTextOrObj.name || osmTextOrObj.address || JSON.stringify(osmTextOrObj);
  } else {
    raw = String(osmTextOrObj);
  }

  const cleaned = cleanOsmText(raw);
  if (!cleaned) return "";

  if (_translateCache.has(cleaned)) return _translateCache.get(cleaned);

  const translated = await _translateQueue.push(() => doTranslateToZh(cleaned));
  return translated;
}

$(function () {
  var map = new BMapGL.Map("map_canvas");
  map.enableDragging();
  map.enableScrollWheelZoom();
  var point = new BMapGL.Point(114.057868, 22.543099);
  map.centerAndZoom(point, 10);

  var mapTypeCtrl = new BMapGL.MapTypeControl({
    // 控件上可以显示的地图类型
    mapTypes: [
      BMAP_NORMAL_MAP,     // 普通图
      BMAP_EARTH_MAP       // 地球模式（3D地球）
    ]
  });
  map.addControl(mapTypeCtrl);

  var myGeo = new BMapGL.Geocoder();
  var result = [];
  var exportName = "";
  var n = 1;

  // 全屏切换按钮事件
  $('#fullscreenBtn').on('click', function () {
    // 切换容器的 fullscreen 样式
    $('#inner').toggleClass('fullscreen');
    // 修改按钮文字
    var text = $('#inner').hasClass('fullscreen') ? '退出全屏' : '全屏模式';
    $('#fullscreenBtn').text(text);
    // ⚡ 保留切换前的中心
    var center = map.getCenter();
    var zoom = map.getZoom();
    // ⚡ 通知地图容器大小已变化
    setTimeout(function () {
      map.checkResize(); // 必须，否则大小变化不生效
      map.centerAndZoom(center, zoom); // 保持原中心和缩放
    }, 200); // 设置一点延时，确保 DOM 已经完成 resize
  });

  // 全局运行状态标志，防止重复点击
  let isRunning = false;

  $('#toLatLngBtn').on('click', function (e) {
    e.stopImmediatePropagation();

    // ------------------- 并发控制逻辑 -------------------
    if (isRunning) {
      alert("任务正在执行中，请稍候再试...");
      return;
    }
    isRunning = true; // 标记任务开始

    exportName = "通过地址解析经纬度-" + (n++);
    result = [["序号", "输入地址", "解析纬度", "解析经度", "返回信息"]];
    $('#showResults').html("").fadeIn();
    map.clearOverlays();

    var addrs = $('#addr').val().split('\n').filter(line => line.trim() !== '');
    var tasks = addrs.map((addr, i) => ({ index: i + 1, value: addr }));

    $("#status").html("开始解析...");

    // runGeoQueue(tasks, workerFn, callback, 并行数)
    runGeoQueue(tasks, geoSearch, function () {
      console.log("地址解析全部完成");
      $("#status").html("解析完成");
      // 任务全部完成后，统一调整视野，让所有标注可见
      if (_markerPoints.length > 0) {
        try {
          map.setViewport(_markerPoints, { enableAnimation: true });
        } catch (e) {
          console.warn('setViewport 失败', e);
        }
        _markerPoints = []; // 清空，为下一批数据准备
      }
      // ------------------- 任务结束，释放锁 -------------------
      isRunning = false;
    }, 2);
  });

  $('#toAddressBtn').on('click', function (e) {
    e.stopImmediatePropagation();

    // ------------------- 并发控制逻辑 -------------------
    if (isRunning) {
      alert("任务正在执行中，请稍候再试...");
      return;
    }
    isRunning = true; // 标记任务开始

    exportName = "通过经纬度解析地址-" + (n++);
    result = [["序号", "输入经度", "输入纬度", "解析地址", "返回信息"]];
    $('#showResults').html("").fadeIn();
    map.clearOverlays();

    var pairs = $('#latLng').val().split('\n').filter(line => line.trim() !== '');
    var tasks = pairs.map((pair, i) => ({ index: i + 1, value: pair }));

    $("#status").html("开始解析...");

    runGeoQueue(tasks, geoParse, function () {
      console.log("经纬度解析全部完成");
      $("#status").html("解析完成");
      // 任务全部完成后，统一调整视野，让所有标注可见
      if (_markerPoints.length > 0) {
        try {
          map.setViewport(_markerPoints, { enableAnimation: true });
        } catch (e) {
          console.warn('setViewport 失败', e);
        }
        _markerPoints = []; // 清空，为下一批数据准备
      }
      // ------------------- 任务结束，释放锁 -------------------
      isRunning = false;
    }, 2);
  });

  // 创建标注并支持点击后居中
  function addMarker(lng, lat, text) {
    var point = new BMapGL.Point(lng, lat);
    var marker = new BMapGL.Marker(point);

    // small label offset to reduce overlap / visual jumping
    var label = new BMapGL.Label(text, { offset: new BMapGL.Size(10, -10) });
    marker.setLabel(label);

    marker.addEventListener("click", function () {
      // 点击时再聚焦到该点（保留交互），否则不要频繁 centerAndZoom
      map.centerAndZoom(point, 12);
    });
    map.addOverlay(marker);

    // 收集点，任务完成后统一 setViewport
    _markerPoints.push(point);
  }

  /**
 * 智能双向验证地理编码：先正向，再逆向校验，不符则用 OSM
 */
  function geoSearch(i, addr, done, timeoutMs = 8000) {
    let timeoutId;
    let finished = false;

    function finish(str, data) {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutId);
      $('#showResults').append(str);
      result[i] = data;
      done();
    }

    timeoutId = setTimeout(() => {
      console.warn('geoSearch 超时', { index: i, addr: addr, timeoutMs });
      finish(`${addr}：解析超时<br>`, [i, addr, '', '', '解析超时']);
    }, timeoutMs);

    const isChinese = /[\u4e00-\u9fa5]/.test(addr);
    const geo = new BMapGL.Geocoder();

    // Step 1️⃣ 正向地理编码
    geo.getPoint(addr, function (point) {
      if (!point) {
        osmSearch(addr);
        return;
      }
      const bdLng = point.lng;
      const bdLat = point.lat;

      const inChina = Rectangle.isInChina(bdLng, bdLat);
      geo.getLocation(point, function (rs) {
        if (!rs || !rs.address) {
          osmSearch(addr);
          return;
        }

        const reverseAddr = rs.address || "";
        const reliable =
          reverseAddr.includes(addr) ||
          (rs.addressComponents && addr.includes(rs.addressComponents.city));

        if (!reliable) {
          osmSearch(addr);
          return;
        }

        // ------- 🚀 国内：输出 WGS84 + 地图显示保持 BD09 --------
        if (inChina) {
          const wgs = Coordtransform.bd09ToWgs84(bdLng, bdLat);
          const wgsLng = wgs[0].toFixed(6);
          const wgsLat = wgs[1].toFixed(6);

          const str = `${addr}：${wgsLat},${wgsLng}（WGS84转换自百度）<br>`;
          addMarker(bdLng, bdLat, i + ":" + addr);

          finish(str, [i, addr, wgsLat, wgsLng, "百度 + WGS84转换"]);
        } else {
          // ------- 🌍 国外：保持原样（OSM属于WGS84） --------
          const str = `${addr}：${bdLat},${bdLng}（百度坐标，不在国内区域）<br>`;
          addMarker(bdLng, bdLat, i + ":" + addr);

          finish(str, [i, addr, bdLat, bdLng, "百度（国外）"]);
        }
      });
    });


    /** 🌍 OSM 搜索逻辑（支持中文 + 自动翻译） */
    function osmSearch(keyword) {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(keyword)}&limit=1&addressdetails=1`;
      fetchWithRetries(url, { headers: { 'Accept-Language': 'zh-CN' } }, 3, 10000)
        .then(res => res.json())
        .then(data => {
          if (data && data.length > 0) {
            const d = data[0];
            const lat = parseFloat(d.lat).toFixed(6);
            const lng = parseFloat(d.lon).toFixed(6);
            // const addrText = d.display_name;
            // const str = `${addr}：${lat},${lng}（${addrText}）<br>`;
            // addMarker(lng, lat, i + ":" + str);
            // finish(str, [i, addr, lat, lng, addrText]);
            const str = `${addr}：${lat},${lng}<br>`;
            addMarker(lng, lat, i + ":" + str);
            finish(str, [i, addr, lat, lng]);
          } else if (isChinese) {
            translateAndSearch(keyword);
          } else {
            finish(`${addr}：未找到结果<br>`, [i, addr, '', '', '未找到结果']);
          }
        })
        .catch(err => {
          console.warn("OSM 查询失败", err);
          finish(`${addr}：请求错误<br>`, [i, addr, '', '', '请求错误']);
        });
    }

    /** 🌐 翻译中文 → 英文（带日志 + 超时保护 + 防止提前finish） */
    function translateAndSearch(keyword) {
      clearTimeout(timeoutId); // 避免翻译时被误判超时
      const api = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t&q=${encodeURIComponent(keyword)}`;
      console.log("🌐 开始翻译：", keyword);
      fetchWithRetries(api, {}, 2, 10000)
        .then(res => res.json())
        .then(json => {
          console.log("✅ 翻译返回：", json);
          const translated = json?.[0]?.[0]?.[0];
          if (translated) {
            console.log(`🌏 翻译 '${keyword}' → '${translated}'`);
            osmSearch(translated);
          } else {
            console.warn("⚠️ 翻译无效结果，直接用原中文查询");
            osmSearch(keyword);
          }
        })
        .catch(err => {
          console.warn("翻译失败：", err);
          osmSearch(keyword);
        });
    }
  }

  // =========================================================
  //  OSM 逆地理 + 清洗 + 翻译为简体中文 的完整 geoParse
  // =========================================================
  async function geoParse(i, str, done, timeoutMs = 30000) {

    str = str.toString().replace(/\s+/g, "").replace('，', ',').split(',');
    const lat = parseFloat(str[0]);
    const lng = parseFloat(str[1]);

    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
      const failText = str.join(',') + ': 解析失败<br>';
      $('#showResults').append(failText);
      result[i] = [i, lat || "", lng || "", "非经纬度", ""];
      done();
      return;
    }

    let finished = false;
    let timeoutId;

    function finish(text, data) {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutId);
      $('#showResults').append(text + '<br>');
      result[i] = data;
      done();
    }

    const lat6 = lat.toFixed(6);
    const lng6 = lng.toFixed(6);

    timeoutId = setTimeout(() => {
      console.warn('geoParse 超时', { index: i, lat: lat6, lng: lng6, timeoutMs });
      const text = `${lat6},${lng6}：解析超时`;
      finish(text, [i, lat6, lng6, "解析超时", ""]);
    }, timeoutMs);

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat6}&lon=${lng6}&zoom=18&addressdetails=1`;
    fetchWithRetries(url, { headers: { 'Accept-Language': 'zh-CN' } }, 3, 10000)
      .then(res => res.json())
      .then(async data => {

        if (!data || !data.address) {
          const text = `${lat6},${lng6}：国外接口错误`;
          finish(text, [i, lat6, lng6, "国外接口错误", ""]);
          return;
        }

        const poiName = data.name || "";

        // ① 拼接原始地址（translateAddressComponents 是 async，需要 await）
        let combined = "";
        try {
          combined = await translateAddressComponents(data.address || {}, poiName);
        } catch (e) {
          combined = buildAddressForTranslate(data);
        }

        // ② 异步翻译 road 和 POI 字段（修正版）
        let addrObj = data.address || {};
        let road = addrObj.road ? cleanOsmText(addrObj.road) : "";
        let poi = poiName ? cleanOsmText(poiName) : "";
        let roadZh = road;
        let poiZh = poi;

        if (road) {
          // 用 ensureTranslatedToZh 翻译并在有中文时取代
          const tRoad = await ensureTranslatedToZh(road);
          if (tRoad && /[\u4e00-\u9fff]/.test(tRoad)) roadZh = tRoad;
        }

        if (poi) {
          const tPoi = await ensureTranslatedToZh(poi);
          if (tPoi && /[\u4e00-\u9fff]/.test(tPoi)) poiZh = tPoi;
        }

        // ③ 替换 combined 中的 road 和 poi 为翻译结果
        // 类型保护，确保 combined 为字符串
        if (typeof combined !== 'string') combined = String(combined || '');
        let zhText = combined.replace(road, roadZh).replace(poi, poiZh);
        // 🎯 新增：最终全文翻译 → 中文（自动检测日语）
        try {
          zhText = await ensureTranslatedToZh(zhText);
        } catch (e) { }

        zhText = await cleanTranslatedText(zhText, poiZh);

        addMarker(lng, lat, i + ":" + zhText);

        finish(`${lat6},${lng6}：${zhText}`,
          [i, lat6, lng6, zhText, JSON.stringify(data)]
        );
      })
      .catch(err => {
        console.warn("OSM 请求失败", err);
        const text = `${lat6},${lng6}：解析超时`;
        finish(text, [i, lat6, lng6, "解析超时", ""]);
      });
  }

  $('#clearAddress').on('click', () => $('#addr').val(""));
  $('#clearlnglat').on('click', () => $('#latLng').val(""));
  $('#clearResult').on('click', () => $('#showResults').html("等待解析"));
  $("#exportResult").on('click', () => exportsCSV(result, exportName));
});

/**
 * 限制并发执行任务的核心函数（最大并发数 limit）
 * @param tasks Array<{index, value}>
 * @param handler function(index, value, done)
 * @param doneCallback 全部完成回调
 * @param limit 并发数
 */
function runGeoQueue(tasks, handler, doneCallback, limit) {
  var queue = tasks.slice(0); // 任务克隆
  var running = 0;
  var max = limit || 10;
  var total = tasks.length;
  var completed = 0;

  function next() {
    while (running < max && queue.length > 0) {
      var t = queue.shift();
      running++;
      console.log("开始任务", t.index, t.value);
      handler(t.index, t.value, function () {
        running--;
        completed++;
        if (completed >= total) {
          if (typeof doneCallback === 'function') doneCallback();
        } else {
          next();
        }
      });
    }
  }

  next();
}

/**
 * [escapeCSV 转义CSV内容]
 * @return {String}       [转义后的内容]
 * @param value
 */
function escapeCSV(value) {
  if (value == null) return '';
  var str = value.toString();
  // 如果包含逗号、双引号、换行符，则需要用双引号包围，并对内部 " 转义
  if (/["\n\r,]/.test(str)) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * [exportsCSV 导出数据到CSV]
 * @param  {Array}  [_body=[]]      [内容]
 * @param  {String} [name='excel'}] [文件名]
 * @return {[type]}                 [无]
 */
function exportsCSV(_body, name) {
  var output = _body.map(row => { // 格式化表内容
    // 先将每个单元格的内容进行转义
    return row.map(escapeCSV).join(','); // 使用分号分隔
  })
  console.log("output", output)
  if (!window.Blob) {
    alert("你的浏览器不支持!")
    return
  }
  // 创建一个文件CSV文件
  var BOM = '\uFEFF' // 中文乱码问题
  var blob = new Blob([BOM + output.join("\n")], { type: 'text/csv' })
  // IE
  if (navigator.msSaveOrOpenBlob) {
    // 解决大文件下载失败
    // 保存到本地文件
    navigator.msSaveOrOpenBlob(blob, `${name}.csv`)
  } else {
    var downloadLink = document.createElement('a')
    downloadLink.setAttribute('href', URL.createObjectURL(blob)) // 因为url有最大长度限制，encodeURI是会把字符串转化为url，超出限制长度部分数据丢失导致下载失败,为此我采用创建Blob（二进制大对象）的方式来存放缓存数据，具体代码如下：
    downloadLink.download = `${name}.csv`
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
  }
}


