'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require poll';

var callGetStatus = rpc.declare({
	object: 'luci.ups-manager',
	method: 'get_status',
	expect: { '': {} }
});

function formatRuntimeMinutes(seconds) {
	if (seconds === null || seconds === undefined || isNaN(seconds) || seconds <= 0) {
		return '-- мин';
	}
	var s = parseInt(seconds, 10);
	var m = Math.round(s / 60);
	if (m < 60) return m + ' мин';
	var h = Math.floor(m / 60);
	var remM = m % 60;
	return h + ' ч ' + (remM > 0 ? remM + ' мин' : '');
}

return view.extend({
	pollInterval: 3,
	isPaused: false,

	load: function() {
		return callGetStatus();
	},

	render: function(status) {
		var self = this;
		status = status || {};

		var container = E('div', { 'class': 'cbi-map ups-manager-ui-exact' });

		var styleNode = E('style', {}, [
			'.ups-manager-ui-exact { max-width: 1280px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Helvetica Neue", Arial, sans-serif; color: var(--proton-fg, #1e293b); }',
			'.dark-mode .ups-manager-ui-exact { color: var(--text-color-highest, #f8fafc); }',
			'.ups-panel-card { background: var(--proton-card-solid, var(--background-color-low, #ffffff)); border: 1px solid var(--proton-border, var(--cbi-section-border, #e2e8f0)); border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 1.25rem; box-shadow: var(--proton-shadow-sm, 0 1px 4px rgba(0,0,0,0.03)); }',
			'.dark-mode .ups-panel-card { background: var(--proton-card-solid, #1e293b); border-color: var(--proton-border, var(--text-color-high, #334155)); }',
			'.ups-top-status { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; }',
			'.ups-sub-caption { font-size: 0.75rem; font-weight: 700; color: var(--text-color-medium, #94a3b8); letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 0.4rem; }',
			'.ups-main-title { font-size: 1.5rem; font-weight: 800; display: flex; align-items: center; gap: 0.6rem; margin: 0; line-height: 1.2; }',
			'.ups-alert-desc { font-size: 0.85rem; color: var(--text-color-medium, #64748b); margin: 0.5rem 0 0 0; display: flex; align-items: center; gap: 0.35rem; }',
			'.dark-mode .ups-alert-desc { color: var(--text-color-medium, #94a3b8); }',
			'.ups-top-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.25rem; }',
			'@media (max-width: 900px) { .ups-top-metrics { grid-template-columns: repeat(2, 1fr); } }',
			'@media (max-width: 500px) { .ups-top-metrics { grid-template-columns: 1fr; } }',
			'.ups-metric-tile { background: var(--proton-card-solid, var(--background-color-low, #ffffff)); border: 1px solid var(--proton-border, var(--cbi-section-border, #e2e8f0)); border-radius: 12px; padding: 1.25rem 1.5rem; box-shadow: var(--proton-shadow-sm, 0 1px 4px rgba(0,0,0,0.03)); display: flex; flex-direction: column; justify-content: space-between; min-height: 110px; }',
			'.dark-mode .ups-metric-tile { background: var(--proton-card-solid, #1e293b); border-color: var(--proton-border, var(--text-color-high, #334155)); }',
			'.ups-tile-title { font-size: 0.8rem; font-weight: 600; color: var(--text-color-medium, #64748b); margin-bottom: 0.5rem; }',
			'.dark-mode .ups-tile-title { color: var(--text-color-medium, #94a3b8); }',
			'.ups-tile-value { font-size: 1.75rem; font-weight: 800; line-height: 1.1; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.4rem; font-variant-numeric: tabular-nums; }',
			'.ups-tile-source { font-size: 0.75rem; color: var(--text-color-medium, #94a3b8); margin: 0; }',
			'.ups-twocol-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.25rem; }',
			'@media (max-width: 900px) { .ups-twocol-grid { grid-template-columns: 1fr; } }',
			'.ups-section-heading { font-size: 0.95rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem; margin: 0 0 1.25rem 0; color: var(--text-color-high, #0f172a); }',
			'.dark-mode .ups-section-heading { color: var(--text-color-highest, #f8fafc); }',
			'.ups-table-rows { width: 100%; border-collapse: collapse; }',
			'.ups-table-rows td { padding: 0.75rem 0; border-bottom: 1px solid var(--proton-border-light, #f1f5f9); font-size: 0.85rem; }',
			'.dark-mode .ups-table-rows td { border-bottom-color: var(--proton-border, var(--text-color-high, #334155)); }',
			'.ups-table-rows tr:last-child td { border-bottom: none; }',
			'@media (max-width: 600px) { .ups-table-rows tr { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; } .ups-table-rows td { display: block; padding: 0.6rem 0; border-bottom: none !important; } .ups-table-rows tr { border-bottom: 1px solid var(--proton-border-light, #f1f5f9); } .dark-mode .ups-table-rows tr { border-bottom-color: var(--proton-border, var(--text-color-high, #334155)); } .ups-table-rows tr:last-child { border-bottom: none; } .ups-label-col { width: auto !important; flex: 1 1 0; min-width: 0; max-width: 62%; overflow-wrap: anywhere; } .ups-val-col { width: auto !important; flex: 0 1 auto; min-width: 0; text-align: right; white-space: normal; overflow-wrap: anywhere; max-width: 38%; } .ups-table-rows { display: block; width: 100%; } .ups-table-rows tbody { display: block; width: 100%; } }',
			'.ups-label-col { color: var(--text-color-high, #475569); width: 45%; }',
			'.dark-mode .ups-label-col { color: var(--text-color-medium, #94a3b8); }',
			'.ups-val-col { text-align: right; font-weight: 600; color: var(--text-color-high, #0f172a); font-variant-numeric: tabular-nums; width: 55%; }',
			'.dark-mode .ups-val-col { color: var(--text-color-highest, #f8fafc); }',
			'.ups-badge-pill { display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }',
			'.badge-green { background: var(--proton-bg-secondary, #ecfdf5); color: var(--proton-success, #059669); border: 1px solid var(--proton-border, #a7f3d0); }',
			'.dark-mode .badge-green { background: rgba(5,150,105,0.2); color: var(--proton-success, #34d399); border-color: rgba(5,150,105,0.4); }',
			'.badge-blue { background: var(--proton-accent-glow, rgba(59,130,246,0.18)); color: var(--proton-accent, #2563eb); border: 1px solid var(--proton-border, #bfdbfe); }',
			'.dark-mode .badge-blue { background: var(--proton-accent-glow, rgba(37,99,235,0.2)); color: var(--proton-accent, #60a5fa); border-color: rgba(37,99,235,0.4); }',
			'.badge-gray { background: var(--proton-bg-secondary, var(--background-color-low, #f8fafc)); color: var(--text-color-medium, #64748b); border: 1px solid var(--proton-border, var(--border-color-high, #e2e8f0)); }',
			'.dark-mode .badge-gray { background: var(--proton-bg-hover, #334155); color: var(--text-color-medium, #94a3b8); border-color: var(--proton-border, var(--text-color-high, #475569)); }',
			'.badge-red { background: rgba(239,68,68,0.18); color: var(--proton-danger, #dc2626); border: 1px solid var(--proton-border, #fecaca); }',
			'.dark-mode .badge-red { background: rgba(220,38,38,0.2); color: var(--proton-danger, #f87171); border-color: rgba(220,38,38,0.4); }',
			'.ups-progress-wrap { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; font-size: 0.85rem; font-weight: 600; }',
			'.ups-progress-bar { width: 100%; height: 12px; background: var(--proton-bg-secondary, var(--background-color-low, #f1f5f9)); border: 1px solid var(--proton-border, var(--text-color-medium, #94a3b8)); border-radius: 6px; overflow: hidden; margin-bottom: 1.25rem; box-sizing: border-box; }',
			'.dark-mode .ups-progress-bar { background: var(--proton-bg-hover, #334155); }',
			'.ups-progress-fill { height: 100%; border-radius: 5px; transition: width 0.4s ease, background-color 0.4s ease; } .ups-progress-fill.lvl-high { background: var(--proton-success, #10b981); } .ups-progress-fill.lvl-mid { background: var(--proton-warning, #f59e0b); } .ups-progress-fill.lvl-low { background: var(--proton-danger, #ef4444); }',
			'.ups-btn-refresh { background: var(--proton-bg-secondary, var(--background-color-low, #f8fafc)); border: 1px solid var(--proton-border, #cbd5e1); border-radius: 8px; padding: 0.4rem 0.85rem; font-size: 0.85rem; font-weight: 600; color: var(--text-color-high, #334155); cursor: pointer; display: flex; align-items: center; gap: 0.4rem; transition: all 0.2s; }',
			'.ups-btn-refresh:hover { background: var(--proton-bg-hover, rgba(148,163,184,0.35)); }',
			'.dark-mode .ups-btn-refresh { background: var(--proton-bg-hover, #334155); border-color: var(--proton-border, var(--text-color-high, #475569)); color: var(--text-color-highest, #f8fafc); }',
			'.ups-batt-shell { position: relative; width: 100%; max-width: 280px; height: 64px; margin: 0.75rem auto 1rem; border: 2px solid rgba(255,255,255,0.28); border-radius: 10px; background: var(--proton-bg-secondary, var(--background-color-low, #e2e8f0)); box-sizing: border-box; }',
			'.ups-batt-shell::after { content: ""; position: absolute; right: -8px; top: 22%; height: 56%; width: 6px; border-radius: 3px; background: rgba(255,255,255,0.28); }',
			'.light-mode .ups-batt-shell, .ups-batt-shell { border-color: var(--proton-border, #cbd5e1); } .ups-batt-shell::after { background: var(--proton-border, #cbd5e1); }',
			'.ups-batt-fill { height: 100%; border-radius: 8px; transition: width 0.7s ease, background 0.7s ease; }',
			'.ups-batt-fill.lvl-green { background: linear-gradient(90deg, #16a34a, #22c55e); }',
			'.ups-batt-fill.lvl-yellow { background: linear-gradient(90deg, #ca8a04, #eab308); }',
			'.ups-batt-fill.lvl-orange { background: linear-gradient(90deg, #ea580c, #f97316); }',
			'.ups-batt-fill.lvl-red { background: linear-gradient(90deg, #dc2626, #ef4444); }',
			'.ups-batt-label { position: absolute; top: 50%; left: 0; right: 0; transform: translateY(-50%); text-align: center; font-size: 22px; font-weight: 700; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.75); pointer-events: none; }',
			'.ups-batt-compact { width: calc(100% - 10px); max-width: none; height: 36px; margin: 8px 0 6px 0; }',
			'.ups-batt-compact .ups-batt-label { font-size: 18px; }'
		]);

		// 1. Top Status Banner Card
		var topBanner = E('div', { 'class': 'ups-panel-card', 'id': 'ups-banner-card' }, self.renderTopBanner(status));

		// 2. Four Core Metric Tiles
		var topMetrics = E('div', { 'class': 'ups-top-metrics', 'id': 'ups-metrics-grid' }, self.renderTopMetrics(status));

		// 3. Left & Right Two-Column Section
		var twoCol = E('div', { 'class': 'ups-twocol-grid' }, [
			// Left Card: Battery Capacity & Charging State
			E('div', { 'class': 'ups-panel-card', 'id': 'card-battery-detail' }, self.renderBatteryDetail(status)),

			// Right Card: Topology & Power Path
			E('div', { 'class': 'ups-panel-card', 'id': 'card-topology-detail' }, self.renderTopologyDetail(status))
		]);

		// 4. Bottom Topology Strip Card
		var bottomTopology = E('div', { 'class': 'ups-panel-card', 'id': 'card-bottom-topology' }, self.renderBottomTopology(status));

		dom.append(container, [styleNode, topBanner, topMetrics, twoCol, bottomTopology]);

		// Auto polling
		poll.add(function() {
			if (self.isPaused) return Promise.resolve();
			return callGetStatus().then(function(newStatus) {
				self.updateAll(newStatus);
			});
		}, self.pollInterval);

		return container;
	},

	renderTopBanner: function(status) {
		var isOnline = status && status.connected && status.is_online;
		var isOnBattery = status && status.connected && status.is_on_battery;
		var isLowBattery = status && status.connected && status.is_low_battery;
		var isConnected = status && status.connected;

		var iconColor = 'var(--proton-danger, #ef4444)';
		var titleText = 'Офлайн / устройство отключено';
		var descText = 'Онлайн-ИБП не обнаружен (тайм-аут прямого USB-подключения к плате или драйвер NUT не запущен)';

		if (isConnected) {
			if (isLowBattery) {
				iconColor = 'var(--proton-danger, #dc2626)';
				titleText = 'Критическое предупреждение / батарея сильно разряжена';
				descText = 'ИБП работает от батареи, и заряд ниже порога защитного выключения. Немедленно сохраните данные!';
			} else if (isOnBattery) {
				iconColor = 'var(--proton-warning, #d97706)';
				titleText = 'Внимание / сеть отключена (питание от батареи)';
				descText = 'Питание от сети прервано, ИБП мгновенно перешёл на встроенный инвертор.';
			} else if (isOnline) {
				iconColor = 'var(--proton-success, #10b981)';
				titleText = 'Норма / питание от сети';
				descText = 'Связь с ИБП в норме, качество сети стабильно, подключённые устройства защищены от скачков и перепадов напряжения.';
			} else {
				iconColor = 'var(--proton-accent, #3b82f6)';
				titleText = 'Готов / режим ожидания';
				descText = 'Связь с оборудованием ИБП в норме:' + (status.status || 'READY');
			}
		}

		var self = this;
		return [
			E('div', { 'class': 'ups-top-status' }, [
				E('div', {}, [
					E('div', { 'class': 'ups-sub-caption' }, 'POWER STATUS'),
					E('h2', { 'class': 'ups-main-title' }, [
						E('span', { 'style': 'display:inline-block;width:18px;height:18px;border-radius:50%;background:' + iconColor + ';' }),
						titleText
					]),
					E('p', { 'class': 'ups-alert-desc' }, [
						E('span', {}, isConnected ? '✓' : '⚠️'),
						descText
					])
				]),
				E('button', {
					'class': 'ups-btn-refresh',
					'click': function() {
						return callGetStatus().then(function(newStatus) {
							self.updateAll(newStatus);
							ui.addNotification(null, E('p', {}, _('Данные обновлены')), 'info');
						});
					}
				}, [
					E('span', {}, '🔄'),
					_('Обновить данные')
				])
			])
		];
	},

	renderTopMetrics: function(status) {
		var isConnected = status && status.connected;
		var isOnline = isConnected && status.is_online;
		var isBattery = isConnected && status.is_on_battery;

		// 1. 供电状态
		var pwrStateText = 'Офлайн, не подключён';
		var pwrStateColor = 'var(--proton-danger, #ef4444)';
		var pwrSubText = 'OFFLINE';
		if (isConnected) {
			if (isBattery) {
				pwrStateText = 'Работа от батареи';
				pwrStateColor = 'var(--proton-warning, #d97706)';
				pwrSubText = 'ON BATTERY';
			} else if (isOnline) {
				pwrStateText = 'Питание от сети';
				pwrStateColor = 'var(--proton-success, #10b981)';
				pwrSubText = 'ONLINE';
			} else {
				pwrStateText = status.status || 'Готов';
				pwrStateColor = 'var(--proton-accent, #3b82f6)';
				pwrSubText = 'STANDBY';
			}
		}

		// 2. 电池电量
		var chargeVal = (isConnected && (status.battery_charge_calc !== null && status.battery_charge_calc !== undefined)) ? status.battery_charge_calc : ((isConnected && status.battery_charge !== null) ? status.battery_charge : 0);
		var chargeColor = chargeVal <= 20 ? 'var(--proton-danger, #ef4444)' : (chargeVal <= 50 ? 'var(--proton-warning, #d97706)' : 'var(--proton-accent, #2563eb)');

		// 3. 预计续航
		var runtimeText = (isConnected && status.battery_runtime) ? formatRuntimeMinutes(status.battery_runtime) : ((isConnected && status.battery_runtime_est) ? formatRuntimeMinutes(status.battery_runtime_est) : '-- мин');

		// 4. 负载占比
		var loadVal = (isConnected && status.load_percent !== null) ? status.load_percent : 0;
		var loadColor = loadVal >= 85 ? '#ef4444' : (loadVal >= 65 ? '#f97316' : (loadVal >= 40 ? '#eab308' : '#22c55e'));
		var loadSub = (isConnected && status.nominal_power && status.power !== null && status.power !== undefined) ? (Math.round(status.power) + ' Вт из ' + Math.round(status.nominal_power) + ' Вт') : _('Текущая нагрузка ИБП');

		var battCls = chargeVal >= 60 ? 'lvl-green' : (chargeVal >= 35 ? 'lvl-yellow' : (chargeVal >= 20 ? 'lvl-orange' : 'lvl-red'));

		return [
			// Metric 1
			E('div', { 'class': 'ups-metric-tile' }, [
				E('div', { 'class': 'ups-tile-title' }, _('Состояние питания')),
				E('div', { 'class': 'ups-tile-value', 'style': 'color:' + pwrStateColor + ';font-size:1.45rem;' }, [
					E('span', { 'style': 'display:inline-block;width:14px;height:14px;border-radius:50%;background:' + pwrStateColor + ';' }),
					pwrStateText
				]),
				E('p', { 'class': 'ups-tile-source' }, pwrSubText)
			]),

			// Metric 2
			E('div', { 'class': 'ups-metric-tile' }, [
				E('div', { 'class': 'ups-tile-title' }, _('Заряд батареи')),
				E('div', { 'class': 'ups-batt-shell ups-batt-compact' }, [
					E('div', { 'class': 'ups-batt-fill ' + battCls, 'style': 'width:' + chargeVal + '%;' }),
					E('div', { 'class': 'ups-batt-label' }, [ (chargeVal < 100 && isOnline) ? '⚡ ' : '', chargeVal + '%' ])
				]),
				E('p', { 'class': 'ups-tile-source' }, (isConnected && status.battery_voltage) ? (status.battery_voltage + ' V · battery.charge') : _('Источник: battery.charge'))
			]),

			// Metric 3
			E('div', { 'class': 'ups-metric-tile' }, [
				E('div', { 'class': 'ups-tile-title' }, _('Ожидаемое время работы')),
				E('div', { 'class': 'ups-tile-value', 'style': 'color:var(--text-color-high, #475569);' }, runtimeText),
				E('p', { 'class': 'ups-tile-source' }, (isConnected && status.battery_runtime) ? _('Источник: battery.runtime') : ((isConnected && status.battery_runtime_est) ? _('Расчёт: заряд × ёмкость / нагрузка (оценка)') : _('Источник: battery.runtime')))
			]),

			// Metric 4
			E('div', { 'class': 'ups-metric-tile' }, [
				E('div', { 'class': 'ups-tile-title' }, _('Загрузка')),
				E('div', { 'class': 'ups-tile-value', 'style': 'color:' + loadColor + ';' }, loadVal + '%'),
				E('p', { 'class': 'ups-tile-source' }, loadSub)
			])
		];
	},

	renderBatteryDetail: function(status) {
		var isConnected = status && status.connected;
		var chargeVal = (isConnected && (status.battery_charge_calc !== null && status.battery_charge_calc !== undefined)) ? status.battery_charge_calc : ((isConnected && status.battery_charge !== null) ? status.battery_charge : 0);

		var inputV = (isConnected && status.input_voltage) ? (status.input_voltage + ' V') : '0.0 V';
		var outputV = (isConnected && status.output_voltage) ? (status.output_voltage + ' V') : '0.0 V';
		var battV = (isConnected && status.battery_voltage) ? (status.battery_voltage + ' V') : '0.0 V';

		var powerW = (isConnected && status.power !== null && status.power !== undefined) ? status.power : 0;
		var loadPct = (isConnected && status.load_percent !== null) ? status.load_percent : 0;
		var vaEst = Math.round(powerW / 0.6);

		var freq = (isConnected && status.input_freq) ? status.input_freq : '0.0';
		var tempReal = (isConnected && status.temperature !== null && status.temperature !== undefined && parseFloat(status.temperature) > 0);

		var usbDesc = isConnected ?
			('Прямая связь USB-HID с платой (VendorId: ' + (status.vendorid || '0764') + ' ProductId: ' + (status.productid || '0501') + ') - 🟢 онлайн') :
			('Прямая связь USB-HID с платой (VendorId: 0764 ProductId: 0501) - 🔴 офлайн, не подключён');

		return [
			E('h3', { 'class': 'ups-section-heading' }, ['🔋 ', _('Ёмкость батареи и состояние заряда/разряда')]),
			E('table', { 'class': 'ups-table-rows' }, [
				E('tr', {}, [
					E('td', { 'class': 'ups-label-col' }, _('Входное напряжение сети')),
					E('td', { 'class': 'ups-val-col' }, inputV)
				]),
				E('tr', {}, [
					E('td', { 'class': 'ups-label-col' }, _('Выходное напряжение питания')),
					E('td', { 'class': 'ups-val-col' }, outputV)
				]),
				E('tr', {}, [
					E('td', { 'class': 'ups-label-col' }, _('Общее напряжение батареи')),
					E('td', { 'class': 'ups-val-col', 'style': 'color:var(--proton-accent, #2563eb);' }, battV)
				]),
				E('tr', {}, [
					E('td', { 'class': 'ups-label-col' }, _('Выходная мощность (активная/полная)')),
					E('td', { 'class': 'ups-val-col' }, powerW + ' W / ' + vaEst + ' VA (' + loadPct + '%)')
				]),
				E('tr', {}, [
					E('td', { 'class': 'ups-label-col' }, tempReal ? _('Частота сети / внутренняя температура') : _('Частота сети')),
					E('td', { 'class': 'ups-val-col' }, freq + ' Hz' + (tempReal ? ' · ' + status.temperature + ' °C' : ''))
				]),
				E('tr', {}, [
					E('td', { 'class': 'ups-label-col' }, _('Скорость вентилятора охлаждения')),
					E('td', { 'class': 'ups-val-col', 'style': 'color:var(--proton-accent, #2563eb);' }, (isConnected && status.fan_speed !== null && status.fan_speed !== undefined && parseFloat(status.fan_speed) > 0) ? (status.fan_speed + ' RPM') : ('⚡ ' + _('Бесшумное охлаждение без вентилятора')))
				]),
				E('tr', {}, [
					E('td', { 'class': 'ups-label-col' }, _('Способ связи и сбора данных')),
					E('td', { 'class': 'ups-val-col', 'style': 'color:' + (isConnected ? 'var(--proton-success, #059669)' : 'var(--proton-danger, #dc2626)') + ';font-size:0.8rem;' }, usbDesc)
				])
			])
		];
	},

	renderTopologyDetail: function(status) {
		var isConnected = status && status.connected;
		var isOnline = isConnected && status.is_online;
		var isBattery = isConnected && status.is_on_battery;

		var ecoText = 'Офлайн';
		var bypassBadge = isOnline ? E('span', { 'class': 'ups-badge-pill badge-green' }, _('Готов')) : E('span', { 'class': 'ups-badge-pill badge-gray' }, _('Офлайн'));
		var invBadge = isConnected ? E('span', { 'class': 'ups-badge-pill badge-green' }, _('Онлайн')) : E('span', { 'class': 'ups-badge-pill badge-gray' }, _('Офлайн'));
		var chgText = isOnline ? 'Подзаряд (поддержание)' : (isBattery ? 'Разряд' : 'Офлайн');
		var busReal = (isConnected && status.bus_voltage !== null && status.bus_voltage !== undefined && parseFloat(status.bus_voltage) > 0);
		var statusStr = ' ' + ((status && status.status) ? status.status : '') + ' ';
		var avrText, avrStyle;
		if (isBattery) { avrText = _('Не используется (работа от батареи)'); avrStyle = 'color:var(--proton-accent, #2563eb);'; }
		else if (statusStr.indexOf(' TRIM ') >= 0) { avrText = _('Понижение напряжения (TRIM)'); avrStyle = 'color:var(--proton-warning, #d97706);font-weight:600;'; }
		else if (statusStr.indexOf(' BOOST ') >= 0) { avrText = _('Повышение напряжения (BOOST)'); avrStyle = 'color:var(--proton-warning, #d97706);font-weight:600;'; }
		else if (isOnline) { avrText = _('Прямой проход (Норма)'); avrStyle = 'color:var(--proton-success, #059669);font-weight:600;'; }
		else { avrText = _('Офлайн'); avrStyle = 'color:var(--text-color-medium, #64748b);'; }
		var synText = isOnline ? E('span', { 'style': 'color:var(--proton-success, #059669);font-weight:600;' }, _('Синхронизировано')) : E('span', { 'style': 'color:var(--proton-accent, #2563eb);font-weight:600;' }, _('Не синхронизировано'));

		var rows = [
			E('tr', {}, [
				E('td', { 'class': 'ups-label-col' }, _('Режим энергосбережения ECO')),
				E('td', { 'class': 'ups-val-col' }, ecoText)
			]),
			E('tr', {}, [
				E('td', { 'class': 'ups-label-col' }, _('Статический байпас (Bypass)')),
				E('td', { 'class': 'ups-val-col' }, [bypassBadge])
			]),
			E('tr', {}, [
				E('td', { 'class': 'ups-label-col' }, _('Состояние инвертора')),
				E('td', { 'class': 'ups-val-col' }, [invBadge])
			]),
			E('tr', {}, [
				E('td', { 'class': 'ups-label-col' }, _('Состояние выпрямителя и зарядки')),
				E('td', { 'class': 'ups-val-col' }, chgText)
			])
		];

		if (busReal) {
			rows.push(E('tr', {}, [
				E('td', { 'class': 'ups-label-col' }, _('Высокое напряжение шины постоянного тока (Bus)')),
				E('td', { 'class': 'ups-val-col' }, status.bus_voltage + ' V DC')
			]));
		}

		rows.push(E('tr', {}, [
			E('td', { 'class': 'ups-label-col' }, _('Стабилизатор напряжения (AVR)')),
			E('td', { 'class': 'ups-val-col', 'style': avrStyle }, avrText)
		]));

		rows.push(E('tr', {}, [
			E('td', { 'class': 'ups-label-col' }, _('Синхронизация с сетью (PLL)')),
			E('td', { 'class': 'ups-val-col' }, [synText])
		]));

		return [
			E('h3', { 'class': 'ups-section-heading' }, ['⚡ ', _('Топология и путь питания (ECO / байпас / инвертор)')]),
			E('table', { 'class': 'ups-table-rows', 'style': 'margin-top:1.6rem;' }, rows)
		];
	},

	renderBottomTopology: function(status) {
		var isConnected = status && status.connected;
		var modelTitle = (status && status.model) ? (status.manufacturer ? status.manufacturer + ' ' + status.model : status.model) : _('CPS UT650EGC / Santak Castle 1K');

		var badgeNode = isConnected ?
			E('span', { 'class': 'ups-badge-pill badge-green' }, '🟢 ' + _('Связь в норме (прямое USB-подключение)')) :
			E('span', { 'class': 'ups-badge-pill badge-red' }, '🔴 ' + _('Офлайн, не подключён (USB/последовательный сервер отключён)'));

		return [
			E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;' }, [
				E('div', { 'style': 'font-size:0.95rem;font-weight:700;display:flex;align-items:center;gap:0.5rem;color:var(--text-color-high, #0f172a);' }, [
					'⚡ ',
					_('Направление потока питания и переключение режимов (') + modelTitle + ')'
				]),
				E('div', {}, [badgeNode])
			])
		];
	},

	updateAll: function(status) {
		status = status || {};

		var bCard = document.getElementById('ups-banner-card');
		if (bCard) dom.content(bCard, this.renderTopBanner(status));

		var mGrid = document.getElementById('ups-metrics-grid');
		if (mGrid) dom.content(mGrid, this.renderTopMetrics(status));

		var battCard = document.getElementById('card-battery-detail');
		if (battCard) dom.content(battCard, this.renderBatteryDetail(status));

		var topoCard = document.getElementById('card-topology-detail');
		if (topoCard) dom.content(topoCard, this.renderTopologyDetail(status));

		var btmCard = document.getElementById('card-bottom-topology');
		if (btmCard) dom.content(btmCard, this.renderBottomTopology(status));
	}
});
