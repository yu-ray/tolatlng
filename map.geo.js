
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

      // ------------------- 任务结束，释放锁 -------------------
      isRunning = false;
    }, 2);
  });

  // 创建标注并支持点击后居中
  function addMarker(lng, lat, text) {
    // 创建坐标点
    var point = new BMapGL.Point(lng, lat);

    // 创建 Marker
    var marker = new BMapGL.Marker(point);

    // 创建文本标签
    var label = new BMapGL.Label(text, {});
    marker.setLabel(label);

    // 点击 Marker 时，把它移到地图中心
    marker.addEventListener("click", function () {
      // 将这个点设置为中心，缩放级别保持一致
      map.centerAndZoom(point, 10);
    });

    // 添加到地图
    map.addOverlay(marker);
    // 设置地图中心
    map.centerAndZoom(point, 10);
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
      finish(`${addr}：解析超时<br>`, [i, addr, '', '', '解析超时']);
    }, timeoutMs);

    const isChinese = /[\u4e00-\u9fa5]/.test(addr);
    const geo = new BMapGL.Geocoder();

    // Step 1️⃣ 正向地理编码
    geo.getPoint(addr, function (point) {
      if (!point) {
        // 百度解析失败，直接 OSM
        osmSearch(addr);
        return;
      }

      const { lng, lat } = point;

      // Step 2️⃣ 判断是否在中国境内（粗过滤）
      if (lng < 73 || lng > 136 || lat < 3 || lat > 54) {
        console.log(`🌍 ${addr} 坐标在中国外，使用 OSM`);
        osmSearch(addr);
        return;
      }

      // Step 3️⃣ 百度逆地理编码验证结果
      geo.getLocation(point, function (rs) {
        if (!rs || !rs.address) {
          console.log(`⚠️ ${addr} 逆地理编码失败，尝试 OSM`);
          osmSearch(addr);
          return;
        }

        const reverseAddr = rs.address || "";
        const match = reverseAddr.includes(addr) || (rs.addressComponents && addr.includes(rs.addressComponents.city));

        if (match) {
          // ✅ 一致，认为是国内正确结果
          const str = `${addr}：${lat},${lng}（百度地图）<br>`;
          addMarker(lng, lat, i + ":" + str);
          finish(str, [i, addr, lat, lng, "百度地图"]);
        } else {
          // ❌ 不匹配，百度结果可能错误
          console.log(`🚫 ${addr} 正反不匹配，使用 OSM`);
          osmSearch(addr);
        }
      });
    });

    /** 🌍 OSM 搜索逻辑（支持中文 + 自动翻译） */
    function osmSearch(keyword) {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(keyword)}&limit=1&addressdetails=1`;
      fetch(url, { headers: { 'Accept-Language': 'zh-CN' } })
        .then(res => res.json())
        .then(data => {
          if (data && data.length > 0) {
            const d = data[0];
            const lat = parseFloat(d.lat).toFixed(6);
            const lng = parseFloat(d.lon).toFixed(6);
            const addrText = d.display_name;
            const str = `${addr}：${lat},${lng}（${addrText}）<br>`;
            addMarker(lng, lat, i + ":" + str);
            finish(str, [i, addr, lat, lng, addrText]);
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

      fetch(api)
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


  /**
  * 对经纬度进行逆地理解析（坐标 -> 地址），带超时处理
  * 自动区分国内/国外调用百度或OSM接口
  */
  function geoParse(i, str, done, timeoutMs = 5000) {
    str = str.toString().replace(/\s+/g, "").replace('，', ',').split(',');
    const lat = parseFloat(str[0]);
    const lng = parseFloat(str[1]);

    // 校验输入是否为有效经纬度
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
      const failText = str.join(',') + ': 解析失败<br>';
      $('#showResults').append(failText);
      result[i] = [i, lat || "", lng || "", "非经纬度", ""];
      done();
      return;
    }

    let finished = false;
    let timeoutId;

    // 封装统一的结束逻辑
    function finish(text, data) {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutId);
      $('#showResults').append(text + '<br>');
      result[i] = data;
      done();
    }

    // 设置超时保护
    timeoutId = setTimeout(() => {
      const text = lat + ',' + lng + ': 解析超时';
      finish(text, [i, lat, lng, "解析超时", ""]);
    }, timeoutMs);

    const lat6 = lat.toFixed(6);
    const lng6 = lng.toFixed(6);

    // 判断是否在中国范围
    const isChina =
      lng > 73 && lng < 136 &&
      lat > 3 && lat < 54;

    if (isChina) {
      // 🇨🇳 国内：使用百度地图逆地理编码
      const point = new BMapGL.Point(lng, lat);
      myGeo.getLocation(point, function (rs) {
        if (rs) {
          const addr = rs.address || "未知位置";
          const poi = rs.surroundingPois && rs.surroundingPois[0]
            ? `（附近：${rs.surroundingPois[0].title}）`
            : "";
          const text = `${lat6},${lng6}：${addr}${poi}`;
          addMarker(lng, lat, i + ":" + text);
          finish(text, [i, lat6, lng6, addr + poi, JSON.stringify(rs)]);
        } else {
          const text = `${lat6},${lng6}：解析失败`;
          finish(text, [i, lat6, lng6, "解析失败", ""]);
        }
      });
    } else {
      // 🌍 国外：使用 OSM Nominatim 接口
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat6}&lon=${lng6}&zoom=18&addressdetails=1`;

      fetch(url, {
        headers: {
          'Accept-Language': 'zh-CN'
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.address) {
            const addrParts = [];
            const a = data.address;
            if (a.country) addrParts.push(a.country);
            if (a.state) addrParts.push(a.state);
            if (a.city || a.town || a.village) addrParts.push(a.city || a.town || a.village);
            if (a.road || a.suburb) addrParts.push(a.road || a.suburb);
            const addr = addrParts.join(' ');
            const poi = data.name ? `（附近：${data.name}）` : "";
            const text = `${lat6},${lng6}：${addr}${poi}`;
            addMarker(lng, lat, i + ":" + text);
            finish(text, [i, lat6, lng6, addr + poi, JSON.stringify(data)]);
          } else {
            const text = `${lat6},${lng6}：国外接口错误`;
            finish(text, [i, lat6, lng6, "国外接口错误", ""]);
          }
        })
        .catch(err => {
          console.warn("OSM 请求失败", err);
          const text = `${lat6},${lng6}：解析超时`;
          finish(text, [i, lat6, lng6, "解析超时", ""]);
        });
    }
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
    // downloadLink.href = uri
    downloadLink.setAttribute('href', URL.createObjectURL(blob)) // 因为url有最大长度限制，encodeURI是会把字符串转化为url，超出限制长度部分数据丢失导致下载失败,为此我采用创建Blob（二进制大对象）的方式来存放缓存数据，具体代码如下：
    downloadLink.download = `${name}.csv`
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
  }
}

// 让 Ctrl+A 只选中“解析结果”框内文字
document.getElementById('showResults').addEventListener('keydown', function (e) {
  // Ctrl+A
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    e.preventDefault(); // 阻止浏览器默认全选页面
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(this); // 选中当前元素内容
    sel.removeAllRanges();
    sel.addRange(range);
  }
});

