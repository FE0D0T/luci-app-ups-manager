'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require poll';

var callGetHistory = rpc.declare({
	object: 'luci.ups-manager',
	method: 'get_history',
	params: ['range'],
	expect: { '': {} }
});

var callGetStatus = rpc.declare({
	object: 'luci.ups-manager',
	method: 'get_status',
	expect: { '': {} }
});

var RANGES = [
	{ h: 1,   label: '1 час',   range: 'raw' },
	{ h: 6,   label: '6 часов', range: 'minute' },
	{ h: 24,  label: '24 часа', range: 'minute' },
	{ h: 168, label: '7 дней',  range: 'minute' }
];

var CHARTS = [
	{
		id: 'voltage', icon: '🔌', title: 'Входное и выходное напряжение (В)',
		series: [
			{ key: 'v',  color: '#2563eb', label: 'Вход от сети' },
			{ key: 'vo', color: '#10b981', label: 'Выход инвертора' }
		],
		extra: { key: 'vmin', color: '#f97316', label: 'Мин. вход за минуту', dashed: true },
		minSpan: 10
	},
	{
		id: 'battery', icon: '🔋', title: 'Заряд батареи и загрузка (%)',
		series: [
			{ key: 'c', color: '#10b981', label: 'Заряд батареи (%)' },
			{ key: 'l', color: '#f59e0b', label: 'Загрузка (%)' }
		],
		fixedMin: 0, fixedMax: 100
	},
	{
		id: 'power', icon: '⚡', title: 'Мощность нагрузки (Вт)',
		series: [ { key: 'p', color: '#8b5cf6', label: 'Мощность (Вт)' } ],
		minSpan: 50, baselineZero: true
	},
	{
		id: 'frequency', icon: '〰️', title: 'Частота сети и выхода (Гц)',
		series: [
			{ key: 'ifq', color: '#6366f1', label: 'Входная частота' },
			{ key: 'ofq', color: '#06b6d4', label: 'Выходная частота' }
		],
		requires: ['ifq', 'ofq'], minSpan: 2
	},
	{
		id: 'temperature', icon: '🌡️', title: 'Температура ИБП (°C)',
		series: [ { key: 'temp', color: '#e11d48', label: 'Температура' } ],
		requires: ['temp'], minSpan: 4
	}
];

function pad2(n) { return ('0' + n).slice(-2); }

function formatHM(ts) {
	var d = new Date(ts * 1000);
	return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function formatTime(ts) {
	var d = new Date(ts * 1000);
	return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
}

function formatDay(ts) {
	var d = new Date(ts * 1000);
	return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1);
}

function fmtNum(v, d) {
	if (v === null || v === undefined || isNaN(v)) return '--';
	return (+v).toFixed(d);
}

// "Beautiful" axis scale: rounded steps 1/2/5*10^n
function niceScale(min, max, count) {
	if (max <= min) max = min + 1;
	var raw = (max - min) / count;
	var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
	var norm = raw / mag;
	var step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
	if (step <= 0) step = 1;
	var lo = Math.floor(min / step) * step;
	var hi = Math.ceil(max / step) * step;
	var ticks = [];
	for (var t = lo; t <= hi + step * 0.5; t += step) ticks.push(t);
	return { lo: lo, hi: hi, ticks: ticks, step: step };
}

function pickTimeStep(spanSec) {
	var steps = [300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400];
	for (var i = 0; i < steps.length; i++) {
		if (spanSec / steps[i] <= 6) return steps[i];
	}
	return 86400;
}

function seriesHasData(points, key) {
	for (var i = 0; i < points.length; i++) {
		var v = points[i][key];
		if (v !== null && v !== undefined && v > 0) return true;
	}
	return false;
}

function statsFor(points, key, dropZero) {
	var vals = [];
	for (var i = 0; i < points.length; i++) {
		var v = points[i][key];
		if (v === null || v === undefined || isNaN(v)) continue;
		if (dropZero && +v === 0) continue;
		vals.push(+v);
	}
	if (!vals.length) return null;
	var min = vals[0], max = vals[0], sum = 0;
	for (var j = 0; j < vals.length; j++) {
		if (vals[j] < min) min = vals[j];
		if (vals[j] > max) max = vals[j];
		sum += vals[j];
	}
	return { min: min, max: max, avg: sum / vals.length };
}

function tipRow(color, label, value) {
	return '<div><span style="color:' + color + ';font-weight:700;">●</span> ' +
		label + ': <b>' + value + '</b></div>';
}

return view.extend({
	rangeIdx: 0,
	historyData: [],
	currentStatus: null,
	autoRefresh: true,
	chartCtx: {},
	chartTip: {},

	load: function() {
		return Promise.all([
			callGetHistory(RANGES[this.rangeIdx].range),
			callGetStatus()
		]);
	},

	render: function(res) {
		var self = this;
		self.currentStatus = res[1] || {};
		self.historyData = (res[0] && res[0].points) ? res[0].points : [];

		var container = E('div', { 'class': 'cbi-map', 'style': 'max-width:1240px;margin:0 auto;' }, [
			E('h2', { 'class': 'cbi-map-title', 'style': 'font-size:1.25rem;font-weight:700;' }, _('График истории питания')),
			E('div', { 'class': 'cbi-map-descr', 'style': 'color:var(--text-color-medium, #64748b);margin-bottom:1.25rem;' },
				_('Запись входного и выходного напряжения, частоты, заряда, загрузки, мощности и температуры. Все данные хранятся только в оперативной памяти (tmpfs), SD-карта не изнашивается. Наведите курсор на график — покажутся точные значения в каждой точке.'))
		]);

		// Toolbar: range buttons + actions
		var rangeButtons = [];
		RANGES.forEach(function(r, i) {
			rangeButtons.push(E('button', {
				'class': 'cbi-button ' + (i === self.rangeIdx ? 'cbi-button-apply' : 'cbi-button-neutral'),
				'click': function() { self.changeRange(i, this); }
			}, _(r.label)));
		});

		var toolbar = E('div', {
			'style': 'background:var(--background-color-low, #ffffff);border:1px solid #e2e8f0;border-radius:10px;padding:0.75rem 1.25rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;'
		}, [
			E('div', { 'style': 'display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;' },
				[E('span', { 'style': 'font-weight:600;font-size:0.85rem;color:var(--text-color-high, #334155);' }, _('Диапазон времени:'))].concat(rangeButtons)),
			E('div', { 'style': 'display:flex;gap:0.5rem;flex-wrap:wrap;' }, [
				E('button', {
					'class': 'cbi-button cbi-button-neutral',
					'id': 'ups-auto-btn',
					'click': function() { self.toggleAuto(this); }
				}, self.autoRefresh ? _('Авто: вкл (30 с)') : _('Авто: выкл')),
				E('button', {
					'class': 'cbi-button cbi-button-neutral',
					'click': function() { self.exportCSV(); }
				}, _('Экспорт CSV')),
				E('button', {
					'class': 'cbi-button cbi-button-action',
					'click': function() { self.refreshData(); }
				}, _('Обновить график'))
			])
		]);

		// Current readings strip
		var statsStrip = E('div', {
			'id': 'ups-stats-strip',
			'style': 'background:var(--background-color-low, #ffffff);border:1px solid #e2e8f0;border-radius:10px;padding:0.7rem 1.25rem;margin-bottom:1rem;display:flex;flex-wrap:wrap;gap:1.25rem;'
		});

		// Outage summary bar
		var outageBar = E('div', {
			'id': 'ups-outage-bar',
			'style': 'margin-bottom:1rem;padding:0.45rem 1rem;border-radius:8px;background:rgba(148,163,184,0.12);font-size:0.85rem;'
		});

		dom.append(container, [toolbar, statsStrip, outageBar]);

		// Chart cards
		CHARTS.forEach(function(ch) {
			var legend = ch.series.map(function(s) {
				return E('span', { 'style': 'color:' + s.color + ';font-weight:bold;' }, '— ' + _(s.label) + '  ');
			});
			if (ch.extra) {
				legend.push(E('span', { 'style': 'color:' + ch.extra.color + ';font-weight:bold;' }, '- - ' + _(ch.extra.label)));
			}

			var card = E('div', {
				'class': 'cbi-section',
				'style': 'background:var(--background-color-low, #ffffff);border:1px solid #e2e8f0;border-radius:12px;padding:1.25rem;margin-bottom:1.25rem;box-shadow:0 2px 8px rgba(0,0,0,0.04);'
			}, [
				E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;flex-wrap:wrap;gap:0.5rem;' }, [
					E('span', { 'style': 'font-weight:700;font-size:0.95rem;color:var(--text-color-high, #1e293b);' }, [ch.icon + ' ', _(ch.title)]),
					E('span', { 'style': 'font-size:0.8rem;' }, legend)
				]),
				E('div', {
					'id': 'chart-stats-' + ch.id,
					'style': 'font-size:0.78rem;color:var(--text-color-medium, #64748b);margin-bottom:0.6rem;'
				}),
				E('div', { 'id': 'chart-' + ch.id, 'style': 'position:relative;width:100%;height:260px;' })
			]);

			dom.append(container, [card]);
		});

		// Tooltip containers + hover handlers (bound once; innerHTML redraw keeps listeners on the box)
		CHARTS.forEach(function(ch) {
			var box = document.getElementById('chart-' + ch.id);
			if (!box) return;
			var tip = E('div', {
				'style': 'position:absolute;top:8px;right:8px;display:none;background:rgba(15,23,42,0.92);color:#f8fafc;border-radius:8px;padding:0.5rem 0.7rem;font-size:0.75rem;line-height:1.5;box-shadow:0 4px 12px rgba(0,0,0,0.3);pointer-events:none;white-space:nowrap;'
			});
			self.chartTip[ch.id] = tip;
			box.addEventListener('mousemove', function(e) { self.handleHover(ch.id, e, box); });
			box.addEventListener('mouseleave', function() {
				tip.style.display = 'none';
				var cr = document.getElementById('cross-' + ch.id);
				if (cr) cr.style.display = 'none';
				var dots = box.querySelectorAll('circle[id^="dot-' + ch.id + '-"]');
				for (var i = 0; i < dots.length; i++) dots[i].style.display = 'none';
			});
		});

		window.setTimeout(function() { self.drawAll(); }, 80);

		// Auto refresh every 30 s (reads tmpfs via rpcd, no flash writes)
		poll.add(function() {
			if (!self.autoRefresh) return Promise.resolve();
			var range = RANGES[self.rangeIdx].range;
			return Promise.all([callGetHistory(range), callGetStatus()]).then(function(r) {
				self.historyData = (r[0] && r[0].points) ? r[0].points : self.historyData;
				self.currentStatus = r[1] || self.currentStatus;
				self.drawAll();
			});
		}, 30);

		return container;
	},

	changeRange: function(idx, btn) {
		this.rangeIdx = idx;
		var self = this;
		callGetHistory(RANGES[idx].range).then(function(res) {
			self.historyData = (res && res.points) ? res.points : [];
			self.drawAll();
		});
		var parent = btn.parentElement;
		var btns = parent.querySelectorAll('button');
		for (var i = 0; i < btns.length; i++) btns[i].className = 'cbi-button cbi-button-neutral';
		btn.className = 'cbi-button cbi-button-apply';
	},

	toggleAuto: function(btn) {
		this.autoRefresh = !this.autoRefresh;
		btn.textContent = this.autoRefresh ? _('Авто: вкл (30 с)') : _('Авто: выкл');
	},

	refreshData: function() {
		var self = this;
		var range = RANGES[self.rangeIdx].range;
		return Promise.all([callGetHistory(range), callGetStatus()]).then(function(res) {
			self.historyData = (res[0] && res[0].points) ? res[0].points : self.historyData;
			self.currentStatus = res[1] || self.currentStatus;
			self.drawAll();
			ui.addNotification(null, E('p', {}, _('График истории обновлён')), 'info');
		});
	},

	getPreparedPoints: function() {
		var pts = this.historyData || [];
		var now = Math.floor(Date.now() / 1000);

		if (pts.length < 2) {
			var st = this.currentStatus || {};
			var curV = st.input_voltage || 220;
			var curVo = st.output_voltage || 220;
			var curC = (st.battery_charge_calc !== null && st.battery_charge_calc !== undefined) ? st.battery_charge_calc : (st.battery_charge || 100);
			var curL = st.load_percent || 10;
			var curP = st.power || 50;
			var curF = st.input_freq || 50;
			var curT = st.temperature || 0;
			var curBv = st.battery_voltage || 0;
			return [
				{ t: now - 300, v: curV, vo: curVo, c: curC, l: curL, p: curP, ob: 0, vmin: 0, obc: 0, ifq: curF, ofq: curF, temp: curT, bv: curBv },
				{ t: now - 150, v: curV, vo: curVo, c: curC, l: curL, p: curP, ob: 0, vmin: 0, obc: 0, ifq: curF, ofq: curF, temp: curT, bv: curBv },
				{ t: now,       v: curV, vo: curVo, c: curC, l: curL, p: curP, ob: 0, vmin: 0, obc: 0, ifq: curF, ofq: curF, temp: curT, bv: curBv }
			];
		}

		var cutoff = now - (RANGES[this.rangeIdx].h * 3600);
		var filtered = pts.filter(function(p) { return p.t >= cutoff; });
		if (filtered.length < 2) return pts.slice(-50);
		return filtered;
	},

	outageSegments: function(points) {
		var segs = [], start = null, last = null;
		for (var i = 0; i < points.length; i++) {
			var ob = (points[i].ob > 0 || points[i].obc > 0);
			if (ob) {
				if (start === null) start = points[i].t;
				last = points[i].t;
			} else if (start !== null) {
				segs.push([start, last]);
				start = null;
			}
		}
		if (start !== null) segs.push([start, last]);
		return segs;
	},

	findClosest: function(pts, t) {
		var lo = 0, hi = pts.length - 1;
		while (hi - lo > 1) {
			var mid = (lo + hi) >> 1;
			if (pts[mid].t < t) lo = mid; else hi = mid;
		}
		return (Math.abs(pts[lo].t - t) <= Math.abs(pts[hi].t - t)) ? lo : hi;
	},

	buildStripHTML: function(st) {
		st = st || {};
		function tile(label, value, color) {
			return '<div style="min-width:90px;"><div style="font-size:0.7rem;font-weight:700;color:var(--text-color-medium,#94a3b8);text-transform:uppercase;letter-spacing:0.04em;">' + _(label) + '</div>' +
				'<div style="font-size:1.05rem;font-weight:800;color:' + color + ';font-variant-numeric:tabular-nums;">' + value + '</div></div>';
		}
		var modeBadge;
		if (st.is_on_battery) {
			modeBadge = '<div style="min-width:90px;"><div style="font-size:0.7rem;font-weight:700;color:var(--text-color-medium,#94a3b8);text-transform:uppercase;">' + _('Питание') + '</div><div style="display:inline-block;padding:2px 10px;border-radius:9999px;font-size:0.8rem;font-weight:700;background:rgba(239,68,68,0.18);color:#dc2626;">' + _('От батареи') + '</div></div>';
		} else {
			modeBadge = '<div style="min-width:90px;"><div style="font-size:0.7rem;font-weight:700;color:var(--text-color-medium,#94a3b8);text-transform:uppercase;">' + _('Питание') + '</div><div style="display:inline-block;padding:2px 10px;border-radius:9999px;font-size:0.8rem;font-weight:700;background:rgba(5,150,105,0.18);color:#059669;">' + _('От сети') + '</div></div>';
		}
		var tiles = [modeBadge];
		tiles.push(tile(_('Сеть'), fmtNum(st.input_voltage, 1) + ' В', '#2563eb'));
		tiles.push(tile(_('Выход'), fmtNum(st.output_voltage, 1) + ' В', '#10b981'));
		tiles.push(tile(_('Частота'), fmtNum(st.input_freq, 1) + ' Гц', '#6366f1'));
		tiles.push(tile(_('Заряд'), fmtNum(st.battery_charge, 0) + ' %', '#10b981'));
		tiles.push(tile(_('Загрузка'), fmtNum(st.load_percent, 0) + ' %', '#f59e0b'));
		tiles.push(tile(_('Мощность'), fmtNum(st.power, 1) + ' Вт', '#8b5cf6'));
		tiles.push(tile(_('Температура'), fmtNum(st.temperature, 1) + ' °C', '#e11d48'));
		tiles.push(tile(_('Батарея'), fmtNum(st.battery_voltage, 2) + ' В', '#64748b'));
		return tiles.join('');
	},

	renderOutageBar: function(points) {
		var el = document.getElementById('ups-outage-bar');
		if (!el) return;
		var segs = this.outageSegments(points);
		if (!segs.length) {
			el.innerHTML = '<span style="color:#059669;font-weight:600;">✓ ' + _('За выбранный период отключений сети не зафиксировано') + '</span>';
			return;
		}
		var total = 0;
		for (var i = 0; i < segs.length; i++) total += Math.max(60, segs[i][1] - segs[i][0]);
		var mins = Math.round(total / 60);
		var txt = total >= 3600 ? Math.floor(mins / 60) + ' ч ' + (mins % 60) + ' мин' : mins + ' мин';
		el.innerHTML = '<span style="color:#dc2626;font-weight:700;">⚠️ ' + _('Отключений сети: ') + segs.length + ' · ' + _('суммарно без питания: ') + txt + '</span>' +
			' <span style="color:#64748b;font-size:0.8rem;">· ' + _('красные зоны на графиках — питание от батареи') + '</span>';
	},

	renderChartStats: function(ch, points) {
		var all = ch.series.slice();
		if (ch.extra) all.push(ch.extra);
		var parts = [];
		for (var i = 0; i < all.length; i++) {
			var sr = all[i];
			var dropZero = (sr.key === 'vmin' || sr.key === 'ifq' || sr.key === 'ofq' || sr.key === 'temp');
			var st = statsFor(points, sr.key, dropZero);
			if (!st) continue;
			parts.push('<span style="color:' + sr.color + ';font-weight:700;">' + _(sr.label) + '</span> ' +
				_('мин') + ' <b>' + fmtNum(st.min, 1) + '</b> · ' + _('сред') + ' <b>' + fmtNum(st.avg, 1) + '</b> · ' + _('макс') + ' <b>' + fmtNum(st.max, 1) + '</b>');
		}
		return parts.join('<span style="color:#cbd5e1;">&nbsp;|&nbsp;</span>');
	},

	drawAll: function() {
		var self = this;
		var points = this.getPreparedPoints();

		this.renderOutageBar(points);
		var strip = document.getElementById('ups-stats-strip');
		if (strip) strip.innerHTML = this.buildStripHTML(this.currentStatus);

		CHARTS.forEach(function(ch) {
			var el = document.getElementById('chart-' + ch.id);
			var statsEl = document.getElementById('chart-stats-' + ch.id);
			if (!el) return;

			var avail = true;
			if (ch.requires) {
				avail = false;
				for (var i = 0; i < ch.requires.length; i++) {
					if (seriesHasData(points, ch.requires[i])) { avail = true; break; }
				}
			}
			if (!avail) {
				el.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.85rem;">' +
					_('Драйвер NUT этого ИБП не сообщает эти данные — график недоступен') + '</div>';
				if (statsEl) statsEl.innerHTML = '';
				return;
			}

			self.drawChart(ch, points, el);
			if (statsEl) statsEl.innerHTML = self.renderChartStats(ch, points);

			// Re-attach tooltip element (innerHTML wipe removed it)
			if (self.chartTip[ch.id]) el.appendChild(self.chartTip[ch.id]);
		}, self);
	},

	drawChart: function(ch, points, el) {
		var vbW = 900, vbH = 260;
		var pad = { top: 14, right: 18, bottom: 30, left: 48 };
		var chartW = vbW - pad.left - pad.right;
		var chartH = vbH - pad.top - pad.bottom;

		var tMin = points[0].t;
		var tMax = points[points.length - 1].t;
		if (tMax <= tMin) tMax = tMin + 10;

		var keys = ch.series.map(function(s) { return s.key; });
		if (ch.extra) keys.push(ch.extra.key);

		var lo = Infinity, hi = -Infinity;
		if (ch.fixedMin !== undefined) {
			lo = ch.fixedMin; hi = ch.fixedMax;
		} else {
			for (var i = 0; i < points.length; i++) {
				for (var k = 0; k < keys.length; k++) {
					var v = points[i][keys[k]];
					if (v !== null && v !== undefined && v > 0) {
						if (v < lo) lo = v;
						if (v > hi) hi = v;
					}
				}
			}
			if (lo > hi) { lo = 0; hi = ch.minSpan; }
			var padY = (hi - lo) * 0.08;
			if (padY < 0.5) padY = 0.5;
			lo -= padY; hi += padY;
			if (hi - lo < ch.minSpan) {
				var mid = (hi + lo) / 2;
				lo = mid - ch.minSpan / 2; hi = mid + ch.minSpan / 2;
			}
			if (ch.baselineZero && lo > 0) lo = 0;
		}

		var sc = niceScale(lo, hi, 4);

		var getX = function(t) { return pad.left + ((t - tMin) / (tMax - tMin)) * chartW; };
		var getY = function(val) {
			var clamped = Math.max(sc.lo, Math.min(sc.hi, val));
			return pad.top + chartH - ((clamped - sc.lo) / (sc.hi - sc.lo)) * chartH;
		};

		var svg = ['<svg viewBox="0 0 ' + vbW + ' ' + vbH + '" style="width:100%;height:100%;font-family:inherit;" preserveAspectRatio="xMidYMid meet">'];

		// Horizontal grid + Y labels
		for (var g = 0; g < sc.ticks.length; g++) {
			var yv = getY(sc.ticks[g]);
			svg.push('<line x1="' + pad.left + '" y1="' + yv.toFixed(1) + '" x2="' + (pad.left + chartW) + '" y2="' + yv.toFixed(1) + '" stroke="#e2e8f0" stroke-width="1" />');
			var lbl = sc.step < 1 ? sc.ticks[g].toFixed(1) : String(Math.round(sc.ticks[g]));
			svg.push('<text x="' + (pad.left - 8) + '" y="' + (yv + 4).toFixed(1) + '" font-size="11" text-anchor="end" fill="#94a3b8">' + lbl + '</text>');
		}

		// Vertical grid + time labels (aligned to local-time boundaries)
		var tstep = pickTimeStep(tMax - tMin);
		var tz = new Date().getTimezoneOffset() * 60;
		var t0 = Math.ceil((tMin + tz) / tstep) * tstep - tz;
		for (var tt = t0; tt <= tMax; tt += tstep) {
			var x = getX(tt);
			svg.push('<line x1="' + x.toFixed(1) + '" y1="' + pad.top + '" x2="' + x.toFixed(1) + '" y2="' + (pad.top + chartH) + '" stroke="#f1f5f9" stroke-width="1" />');
			var tl = tstep >= 86400 ? formatDay(tt) : formatHM(tt);
			svg.push('<text x="' + x.toFixed(1) + '" y="' + (pad.top + chartH + 16) + '" font-size="11" fill="#94a3b8" text-anchor="middle">' + tl + '</text>');
		}

		// Outage zones (red shaded bands)
		var segs = this.outageSegments(points);
		for (var s = 0; s < segs.length; s++) {
			var x1 = getX(Math.max(segs[s][0], tMin));
			var x2 = getX(Math.min(segs[s][1], tMax));
			if (x2 - x1 < 2) x2 = x1 + 2;
			svg.push('<rect x="' + x1.toFixed(1) + '" y="' + pad.top + '" width="' + (x2 - x1).toFixed(1) + '" height="' + chartH + '" fill="rgba(239,68,68,0.14)" />');
		}

		// Area fills + lines
		var seriesList = ch.series.slice();
		if (ch.extra) seriesList.push(ch.extra);
		for (var si = 0; si < seriesList.length; si++) {
			var sr = seriesList[si];
			var d = [];
			for (var pi = 0; pi < points.length; pi++) {
				var val = points[pi][sr.key];
				if (val === null || val === undefined) val = 0;
				d.push((pi === 0 ? 'M' : 'L') + getX(points[pi].t).toFixed(1) + ',' + getY(val).toFixed(1));
			}
			var path = d.join(' ');
			if (!sr.dashed) {
				var fillPath = path + ' L' + getX(points[points.length - 1].t).toFixed(1) + ',' + (pad.top + chartH) + ' L' + getX(points[0].t).toFixed(1) + ',' + (pad.top + chartH) + ' Z';
				svg.push('<path d="' + fillPath + '" fill="' + sr.color + '" fill-opacity="0.07" stroke="none" />');
			}
			var attrs = sr.dashed ? ' stroke-dasharray="4,3" stroke-width="1.5"' : ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
			svg.push('<path d="' + path + '" fill="none" stroke="' + sr.color + '"' + attrs + ' />');
			svg.push('<circle id="dot-' + ch.id + '-' + si + '" cx="-10" cy="-10" r="4" fill="' + sr.color + '" stroke="#fff" stroke-width="1.5" style="display:none" />');
		}

		// Axes
		svg.push('<line x1="' + pad.left + '" y1="' + (pad.top + chartH) + '" x2="' + (pad.left + chartW) + '" y2="' + (pad.top + chartH) + '" stroke="#cbd5e1" stroke-width="1.5" />');
		svg.push('<line x1="' + pad.left + '" y1="' + pad.top + '" x2="' + pad.left + '" y2="' + (pad.top + chartH) + '" stroke="#cbd5e1" stroke-width="1.5" />');

		// Crosshair for tooltip
		svg.push('<line id="cross-' + ch.id + '" x1="-10" y1="' + pad.top + '" x2="-10" y2="' + (pad.top + chartH) + '" stroke="#334155" stroke-width="1" stroke-dasharray="3,3" style="display:none" />');

		svg.push('</svg>');
		el.innerHTML = svg.join('');

		this.chartCtx[ch.id] = {
			points: points, pad: pad, chartW: chartW, chartH: chartH,
			tMin: tMin, tMax: tMax, sc: sc,
			seriesList: seriesList, vbW: vbW, vbH: vbH
		};
	},

	handleHover: function(id, e, box) {
		var ctx = this.chartCtx[id];
		var tip = this.chartTip[id];
		if (!ctx || !tip) return;

		var svg = box.querySelector('svg');
		if (!svg) { tip.style.display = 'none'; return; }

		var rect = svg.getBoundingClientRect();
		var scale = Math.min(rect.width / ctx.vbW, rect.height / ctx.vbH);
		if (scale <= 0) return;
		var offX = (rect.width - ctx.vbW * scale) / 2;
		var xvb = (e.clientX - rect.left - offX) / scale;

		var cr = document.getElementById('cross-' + id);
		if (xvb < ctx.pad.left || xvb > ctx.pad.left + ctx.chartW) {
			tip.style.display = 'none';
			if (cr) cr.style.display = 'none';
			return;
		}

		var t = ctx.tMin + ((xvb - ctx.pad.left) / ctx.chartW) * (ctx.tMax - ctx.tMin);
		var idx = this.findClosest(ctx.points, t);
		var p = ctx.points[idx];
		var cx = ctx.pad.left + ((p.t - ctx.tMin) / (ctx.tMax - ctx.tMin)) * ctx.chartW;

		if (cr) {
			cr.setAttribute('x1', cx.toFixed(1));
			cr.setAttribute('x2', cx.toFixed(1));
			cr.style.display = '';
		}

		for (var k = 0; k < ctx.seriesList.length; k++) {
			var sr = ctx.seriesList[k];
			var dot = document.getElementById('dot-' + id + '-' + k);
			if (!dot) continue;
			var val = p[sr.key];
			if (val === null || val === undefined || val <= 0) { dot.style.display = 'none'; continue; }
			dot.setAttribute('cx', cx.toFixed(1));
			dot.setAttribute('cy', ctx.pad.top + ctx.chartH - ((Math.max(ctx.sc.lo, Math.min(ctx.sc.hi, val)) - ctx.sc.lo) / (ctx.sc.hi - ctx.sc.lo)) * ctx.chartH);
			dot.style.display = '';
		}

		var wide = (ctx.tMax - ctx.tMin) > 2 * 86400;
		var html = '<div style="font-weight:700;margin-bottom:2px;">' + (wide ? formatDay(p.t) + ' ' + formatHM(p.t) : formatHM(p.t)) + '</div>';
		html += tipRow('#2563eb', _('Сеть'), fmtNum(p.v, 1) + ' В');
		html += tipRow('#10b981', _('Выход'), fmtNum(p.vo, 1) + ' В');
		if (p.vmin > 0) html += tipRow('#f97316', _('Мин. вход'), fmtNum(p.vmin, 1) + ' В');
		html += tipRow('#10b981', _('Заряд'), fmtNum(p.c, 0) + ' %');
		html += tipRow('#f59e0b', _('Загрузка'), fmtNum(p.l, 0) + ' %');
		html += tipRow('#8b5cf6', _('Мощность'), fmtNum(p.p, 1) + ' Вт');
		if (p.ifq > 0) html += tipRow('#6366f1', _('Частота вх'), fmtNum(p.ifq, 1) + ' Гц');
		if (p.ofq > 0) html += tipRow('#06b6d4', _('Частота вых'), fmtNum(p.ofq, 1) + ' Гц');
		if (p.temp > 0) html += tipRow('#e11d48', _('Температура'), fmtNum(p.temp, 1) + ' °C');
		if (p.bv > 0) html += tipRow('#64748b', _('Батарея'), fmtNum(p.bv, 2) + ' В');
		html += '<div style="margin-top:2px;font-weight:700;color:' + (p.ob > 0 ? '#f87171' : '#34d399') + ';">' +
			(p.ob > 0 ? '⚠️ ' + _('Питание от батареи') : _('Питание от сети')) + '</div>';

		tip.innerHTML = html;
		tip.style.display = '';
	},

	exportCSV: function() {
		var points = this.getPreparedPoints();
		var lines = ['Timestamp,DateTime,InputVoltage_V,OutputVoltage_V,BatteryCharge_Pct,Load_Pct,Power_W,OnBattery,InputMin_V,InputFreq_Hz,OutputFreq_Hz,Temperature_C,BatteryVoltage_V'];
		for (var i = 0; i < points.length; i++) {
			var p = points[i];
			var dt = new Date(p.t * 1000).toISOString();
			lines.push([p.t, dt, p.v || 0, p.vo || 0, p.c || 0, p.l || 0, p.p || 0, p.ob || 0, p.vmin || 0, p.ifq || 0, p.ofq || 0, p.temp || 0, p.bv || 0].join(','));
		}

		var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
		var url = URL.createObjectURL(blob);
		var a = document.createElement('a');
		a.href = url;
		a.download = 'ups_manager_history_' + Math.floor(Date.now() / 1000) + '.csv';
		a.click();
		URL.revokeObjectURL(url);
	}
});
