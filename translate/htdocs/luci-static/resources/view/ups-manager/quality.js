'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require uci';

var callGetStatus = rpc.declare({
	object: 'luci.ups-manager',
	method: 'get_status',
	expect: { '': {} }
});

var callGetRawData = rpc.declare({
	object: 'luci.ups-manager',
	method: 'get_raw_data',
	expect: { '': {} }
});

var callGetQualityEvents = rpc.declare({
	object: 'luci.ups-manager',
	method: 'get_quality_events',
	expect: { '': {} }
});

var callClearQualityEvents = rpc.declare({
	object: 'luci.ups-manager',
	method: 'clear_quality_events',
	expect: { '': {} }
});

var DEFAULT_RULES = {
	hide_unsupported: '0',
	status_overload_sev: 'critical',
	status_bypass_sev: 'warning',
	status_replace_batt_sev: 'warning',
	status_selftest_fail_sev: 'warning',
	in_volt_low_trig: '190',
	in_volt_low_rec: '200',
	in_volt_low_sev: 'warning',
	in_volt_high_trig: '250',
	in_volt_high_rec: '245',
	in_volt_high_sev: 'warning',
	out_volt_low_trig: '190',
	out_volt_low_rec: '200',
	out_volt_low_sev: 'warning',
	out_volt_high_trig: '250',
	out_volt_high_rec: '245',
	out_volt_high_sev: 'warning',
	in_freq_low_trig: '47',
	in_freq_low_rec: '48',
	in_freq_low_sev: 'warning',
	in_freq_high_trig: '53',
	in_freq_high_rec: '52',
	in_freq_high_sev: 'warning',
	temp_high_trig: '50',
	temp_high_rec: '45',
	temp_high_sev: 'warning',
	load_high_trig: '80',
	load_high_rec: '75',
	load_high_sev: 'warning',
	load_crit_trig: '95',
	load_crit_rec: '90',
	load_crit_sev: 'critical'
};

return view.extend({
	activeFilter: 'all',
	rulesData: {},
	statusData: {},
	eventsList: [],

	load: function() {
		return Promise.all([
			callGetStatus().catch(function() { return {}; }),
			callGetQualityEvents().catch(function() { return { events: [] }; }),
			uci.load('ups_manager').catch(function() { return {}; })
		]);
	},

	render: function(data) {
		var self = this;
		this.statusData = data[0] || {};
		var eventData = data[1] || {};
		this.eventsList = eventData.events || [];

		// Read UCI config
		this.rulesData = {};
		for (var k in DEFAULT_RULES) {
			var val = uci.get('ups_manager', 'quality', k);
			this.rulesData[k] = (val !== null && val !== undefined && val !== '') ? String(val) : DEFAULT_RULES[k];
		}

		var container = E('div', { 'class': 'cbi-map ups-quality-container' });

		var styleNode = E('style', {}, [
			'.ups-quality-container { max-width: 1280px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Helvetica Neue", Arial, sans-serif; color: #1e293b; }',
			'.dark-mode .ups-quality-container { color: var(--text-color-highest, #f8fafc); }',
			'.pq-card { background: var(--background-color-low, #ffffff); border: 1px solid var(--cbi-section-border, #e2e8f0); border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }',
			'.dark-mode .pq-card { background: #1e293b; border-color: var(--text-color-high, #334155); }',
			'.pq-header-top { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; }',
			'.pq-subtag-row { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem; }',
			'.pq-subtag-title { font-size: 0.75rem; font-weight: 700; color: #3b82f6; letter-spacing: 0.05em; text-transform: uppercase; }',
			'.pq-main-title { font-size: 1.6rem; font-weight: 800; margin: 0; line-height: 1.2; color: var(--text-color-high, #0f172a); }',
			'.dark-mode .pq-main-title { color: var(--text-color-highest, #f8fafc); }',
			'.pq-main-desc { font-size: 0.85rem; color: var(--text-color-medium, #64748b); margin: 0.45rem 0 0 0; }',
			'.dark-mode .pq-main-desc { color: var(--text-color-medium, #94a3b8); }',
			'.pq-summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-top: 1.25rem; }',
			'@media (max-width: 900px) { .pq-summary-grid { grid-template-columns: repeat(2, 1fr); } }',
			'@media (max-width: 500px) { .pq-summary-grid { grid-template-columns: 1fr; } }',
			'.pq-summary-tile { background: var(--background-color-low, #f8fafc); border: 1px solid #edf2f7; border-radius: 10px; padding: 1rem 1.25rem; }',
			'.dark-mode .pq-summary-tile { background: #0f172a; border-color: var(--text-color-high, #334155); }',
'.pq-summary-k { font-size: 0.8rem; font-weight: 600; color: var(--text-color-medium, #64748b); margin-bottom: 0.4rem; }',
			'.dark-mode .pq-summary-k { color: var(--text-color-medium, #94a3b8); }',
			'.pq-summary-v { font-size: 1.55rem; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; }',
			'.pq-section-heading { font-size: 1.05rem; font-weight: 700; display: flex; align-items: center; gap: 0.45rem; margin: 0; }',
			'.pq-section-desc { font-size: 0.82rem; color: var(--text-color-medium, #64748b); margin: 0.35rem 0 1.1rem 0; }',
			'.dark-mode .pq-section-desc { color: var(--text-color-medium, #94a3b8); }',
			'.pq-metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }',
			'@media (max-width: 900px) { .pq-metrics-grid { grid-template-columns: repeat(2, 1fr); } }',
			'@media (max-width: 600px) { .pq-metrics-grid { grid-template-columns: 1fr; } }',
			'.pq-metric-item { background: var(--background-color-low, #ffffff); border: 1px solid var(--border-color-high, #e2e8f0); border-radius: 10px; padding: 1rem 1.25rem; display: flex; flex-direction: column; justify-content: space-between; min-height: 125px; }',
			'.dark-mode .pq-metric-item { background: #1e293b; border-color: var(--text-color-high, #334155); }',
			'.pq-metric-header { display: flex; justify-content: space-between; align-items: center; }',
			'.pq-metric-label { font-size: 0.92rem; font-weight: 700; color: var(--text-color-high, #1e293b); }',
			'.dark-mode .pq-metric-label { color: var(--text-color-highest, #f8fafc); }',
			'.pq-metric-val { font-size: 1.85rem; font-weight: 800; margin: 0.6rem 0; font-variant-numeric: tabular-nums; }',
			'.pq-metric-footer { display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-color-medium, #94a3b8); }',
			'.pq-metric-mono { font-family: monospace; color: var(--text-color-medium, #94a3b8); font-size: 0.72rem; }',
			'.badge-pill { display: inline-flex; align-items: center; gap: 0.3rem; padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }',
			'.badge-pill-green { background: rgba(16,185,129,0.22); color: #059669; }',
			'.badge-pill-red { background: rgba(239,68,68,0.22); color: #dc2626; }',
			'.badge-pill-gray { background: var(--background-color-low, #f1f5f9); color: var(--text-color-medium, #64748b); }',
			'.text-unsupported { font-size: 0.78rem; color: var(--text-color-medium, #94a3b8); font-weight: 500; }',
			'.pq-rules-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }',
			'@media (max-width: 1100px) { .pq-rules-grid { grid-template-columns: repeat(2, 1fr); } }',
			'@media (max-width: 600px) { .pq-rules-grid { grid-template-columns: 1fr; } }',
			'.pq-rule-card { background: var(--background-color-low, #ffffff); border: 1px solid var(--border-color-high, #e2e8f0); border-radius: 10px; padding: 1rem 1.15rem; display: flex; flex-direction: column; justify-content: space-between; }',
			'.dark-mode .pq-rule-card { background: #1e293b; border-color: var(--text-color-high, #334155); }',
			'.pq-rule-card.unsupported-hidden { display: none !important; }',
			'.pq-rule-title { font-size: 0.92rem; font-weight: 700; color: var(--text-color-high, #1e293b); }',
			'.dark-mode .pq-rule-title { color: var(--text-color-highest, #f8fafc); }',
			'.pq-rule-fields { display: flex; flex-direction: column; gap: 0.6rem; }',
			'.pq-rule-inputs-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }',
			'.pq-input-group label { display: block; font-size: 0.72rem; color: var(--text-color-medium, #64748b); margin-bottom: 0.25rem; }',
			'.dark-mode .pq-input-group label { color: var(--text-color-medium, #94a3b8); }',
			'.pq-input-group input, .pq-input-group select { width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.35rem 0.5rem; font-size: 0.85rem; background: var(--background-color-high, #ffffff); color: var(--text-color-high, #0f172a); box-sizing: border-box; }',
			'.dark-mode .pq-input-group input, .dark-mode .pq-input-group select { background: var(--background-color-high, #0f172a); color: var(--text-color-highest, #ffffff); border-color: var(--text-color-medium, #475569); }',
			'.pq-rule-unsupported-note { font-size: 0.72rem; color: var(--text-color-medium, #94a3b8); margin-top: 0.6rem; display: flex; align-items: center; gap: 0.35rem; }',
			'.pq-event-item { background: var(--background-color-low, #ffffff); border: 1px solid var(--border-color-high, #e2e8f0); border-radius: 10px; padding: 0.9rem 1.25rem; margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }',
			'.dark-mode .pq-event-item { background: #1e293b; border-color: var(--text-color-high, #334155); }',
			'.pq-event-left { display: flex; align-items: center; gap: 1rem; }',
			'.pq-circle-icon { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }',
			'.pq-circle-icon.recovered { background: rgba(16,185,129,0.22); }',
			'.pq-circle-icon.recovered .pq-dot { width: 14px; height: 14px; border-radius: 50%; background: #10b981; }',
			'.pq-circle-icon.ongoing { background: rgba(239,68,68,0.22); }',
			'.pq-circle-icon.ongoing .pq-dot { width: 14px; height: 14px; border-radius: 50%; background: #ef4444; }',
			'.pq-event-main-line { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.25rem; }',
			'.pq-event-name { font-size: 0.95rem; font-weight: 700; color: var(--text-color-high, #0f172a); }',
			'.dark-mode .pq-event-name { color: var(--text-color-highest, #f8fafc); }',
			'.pq-event-val { font-size: 0.92rem; font-weight: 700; font-family: monospace; color: var(--text-color-high, #1e293b); }',
			'.dark-mode .pq-event-val { color: var(--text-color-highest, #f8fafc); }',
			'.pq-event-subline { font-size: 0.78rem; color: var(--text-color-medium, #94a3b8); }',
			'.pq-tab-btn { border: none; background: transparent; padding: 5px 14px; font-size: 0.82rem; font-weight: 500; color: var(--text-color-medium, #64748b); border-radius: 6px; cursor: pointer; transition: all 0.2s; }',
			'.pq-tab-btn.active { background: var(--background-color-low, #ffffff); color: var(--text-color-high, #0f172a); font-weight: 700; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }',
			'.dark-mode .pq-tab-btn.active { background: #334155; color: #ffffff; }'
		]);

		container.appendChild(styleNode);

		// Render Top Header Card
		container.appendChild(this.renderHeaderCard());

		// Render Current Metrics Card
		container.appendChild(this.renderCurrentMetricsCard());

		// Render Alarm Rules Card
		container.appendChild(this.renderRulesCard());

		// Render Events Card
		container.appendChild(this.renderEventsCard());

		return container;
	},

	renderHeaderCard: function() {
		var self = this;
		var status = this.statusData;
		var isConnected = status && status.connected;

		// Calculate ongoing anomaly count
		// Счётчики из журнала качества (quality_events.tsv): дата в формате ГГГГ/ММ/ДД ЧЧ:ММ:СС
		var evs = this.eventsList || [];
		var nowD = new Date();
		var todayKey = nowD.getFullYear() + '/' + ('0' + (nowD.getMonth() + 1)).slice(-2) + '/' + ('0' + nowD.getDate()).slice(-2);
		var todayCount = evs.filter(function(e) { return String(e.time || '').slice(0, 10) === todayKey; }).length;
		var journalOngoing = evs.filter(function(e) { return e.status === 'ongoing'; }).length;
		var lastEvent = evs.length ? evs[0] : null;
		var lastTitle = lastEvent ? (lastEvent.title || '') : _('Нет событий');

		var ongoingCount = 0;
		if (!isConnected || !status.is_online) ongoingCount++;
		if (status.load_percent && status.load_percent > 80) ongoingCount++;
		if (status.input_voltage && (status.input_voltage < 190 || status.input_voltage > 250)) ongoingCount++;

		var isAllNormal = ongoingCount === 0;
		var topBadge = isAllNormal ?
			E('span', { 'class': 'badge-pill badge-pill-green' }, ['🟢 ', _('Всё в норме')]) :
			E('span', { 'class': 'badge-pill badge-pill-red' }, ['🔴 ', _('Есть отклонения')]);

		var refreshBtn = E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'style': 'display:inline-flex;align-items:center;gap:0.4rem;padding:0.4rem 0.9rem;border-radius:8px;',
			'click': function(ev) {
				var btn = ev.target;
				btn.disabled = true;
				self.refreshAll().then(function() {
					btn.disabled = false;
				});
			}
		}, ['🔄 ', _('Обновить данные')]);

		var card = E('div', { 'class': 'pq-card', 'id': 'pq-top-header-card' }, [
			E('div', { 'class': 'pq-header-top' }, [
				E('div', {}, [
					E('div', { 'class': 'pq-subtag-row' }, [
						E('span', { 'class': 'pq-subtag-title' }, 'POWER QUALITY MONITORING'),
						topBadge
					]),
					E('h2', { 'class': 'pq-main-title' }, _('Качество электроэнергии')),
					E('p', { 'class': 'pq-main-desc' }, _('Контроль напряжения, частоты, температуры, нагрузки и предупреждений ИБП.'))
				]),
				E('div', {}, [refreshBtn])
			]),
			E('div', { 'class': 'pq-summary-grid', 'id': 'pq-summary-grid' }, [
				E('div', { 'class': 'pq-summary-tile' }, [
					E('div', { 'class': 'pq-summary-k' }, _('Общее состояние')),
					E('div', { 'class': 'pq-summary-v', 'style': 'color:' + (isAllNormal ? '#059669' : '#dc2626') }, isAllNormal ? _('Всё в норме') : _('Есть отклонения'))
				]),
				E('div', { 'class': 'pq-summary-tile' }, [
					E('div', { 'class': 'pq-summary-k' }, _('Активных отклонений')),
					E('div', { 'class': 'pq-summary-v', 'style': 'color:#dc2626;' }, String(Math.max(ongoingCount, journalOngoing)))
				]),
				E('div', { 'class': 'pq-summary-tile' }, [
					E('div', { 'class': 'pq-summary-k' }, _('Отклонений за сегодня')),
					E('div', { 'class': 'pq-summary-v', 'style': 'color:#2563eb;' }, String(todayCount))
				]),
				E('div', { 'class': 'pq-summary-tile' }, [
					E('div', { 'class': 'pq-summary-k' }, _('Последнее отклонение')),
					E('div', { 'class': 'pq-summary-v', 'style': 'font-size:1.25rem;color:var(--text-color-high, #1e293b);' }, lastTitle)
				])
			])
		]);

		return card;
	},

	renderCurrentMetricsCard: function() {
		var status = this.statusData;
		var isConnected = status && status.connected;

		// 1. Input Voltage
		var inV = (isConnected && status.input_voltage !== null && status.input_voltage !== undefined) ? Number(status.input_voltage).toFixed(1) : '0.0';
		var inVAbnormal = !isConnected || inV < 190 || inV > 250;
		var inVBadge = inVAbnormal ? E('span', { 'class': 'badge-pill badge-pill-red' }, _('Отклонение')) : E('span', { 'class': 'badge-pill badge-pill-green' }, _('Норма'));

		// 2. Output Voltage
		var outV = (isConnected && status.output_voltage !== null && status.output_voltage !== undefined) ? Number(status.output_voltage).toFixed(1) : '0.0';
		var outVAbnormal = !isConnected || outV < 190 || outV > 250;
		var outVBadge = outVAbnormal ? E('span', { 'class': 'badge-pill badge-pill-red' }, _('Отклонение')) : E('span', { 'class': 'badge-pill badge-pill-green' }, _('Норма'));

		// 3. Input Frequency
		var inF = (isConnected && status.input_freq !== null && status.input_freq !== undefined) ? Number(status.input_freq).toFixed(1) : '0.0';
		var inFAbnormal = !isConnected || inF < 47 || inF > 53;
		var inFBadge = inFAbnormal ? E('span', { 'class': 'badge-pill badge-pill-red' }, _('Отклонение')) : E('span', { 'class': 'badge-pill badge-pill-green' }, _('Норма'));

		// 4. UPS Load
		var load = (isConnected && status.load_percent !== null && status.load_percent !== undefined) ? Math.round(status.load_percent) : 0;
		var loadAbnormal = load >= 80;
		var loadBadge = loadAbnormal ? E('span', { 'class': 'badge-pill badge-pill-red' }, _('Отклонение')) : E('span', { 'class': 'badge-pill badge-pill-green' }, _('Норма'));

		// 5. Temperature (Check if hardware supports it)
		var hasTemp = isConnected && status.temperature !== null && status.temperature !== undefined && status.temperature !== '' && !isNaN(status.temperature);
		var tempVal = hasTemp ? (Number(status.temperature).toFixed(1) + ' °C') : _('неизвестно');
		var tempBadge = hasTemp ?
			(status.temperature > 50 ? E('span', { 'class': 'badge-pill badge-pill-red' }, _('Отклонение')) : E('span', { 'class': 'badge-pill badge-pill-green' }, _('Норма'))) :
			E('span', { 'class': 'text-unsupported' }, _('Не поддерживается'));

		// 6. UPS Status
		var statusText = isConnected ? (status.status || 'OL') : 'OFFLINE';
		var statusIsOnline = isConnected && status.is_online;
		var statusBadge = statusIsOnline ? E('span', { 'class': 'badge-pill badge-pill-green' }, _('Норма')) : E('span', { 'class': 'badge-pill badge-pill-red' }, _('Отклонение'));

		return E('div', { 'class': 'pq-card' }, [
			E('h3', { 'class': 'pq-section-heading' }, ['📊 ', _('Текущие показатели')]),
			E('p', { 'class': 'pq-section-desc' }, _('Данные о качестве электроэнергии, доступные ИБП в настоящий момент.')),
			E('div', { 'class': 'pq-metrics-grid', 'id': 'pq-metrics-grid' }, [
				// Card 1
				E('div', { 'class': 'pq-metric-item' }, [
					E('div', { 'class': 'pq-metric-header' }, [
						E('span', { 'class': 'pq-metric-label' }, _('Входное напряжение')),
						inVBadge
					]),
					E('div', { 'class': 'pq-metric-val', 'style': 'color:' + (inVAbnormal ? '#dc2626' : '#059669') }, inV + ' V'),
					E('div', { 'class': 'pq-metric-footer' }, [
						E('span', {}, _('Норма: 190 ~ 250 В')),
						E('span', { 'class': 'pq-metric-mono' }, 'input.voltage')
					])
				]),

				// Card 2
				E('div', { 'class': 'pq-metric-item' }, [
					E('div', { 'class': 'pq-metric-header' }, [
						E('span', { 'class': 'pq-metric-label' }, _('Выходное напряжение')),
						outVBadge
					]),
					E('div', { 'class': 'pq-metric-val', 'style': 'color:' + (outVAbnormal ? '#dc2626' : '#059669') }, outV + ' V'),
					E('div', { 'class': 'pq-metric-footer' }, [
						E('span', {}, _('Норма: 190 ~ 250 В')),
						E('span', { 'class': 'pq-metric-mono' }, 'output.voltage')
					])
				]),

				// Card 3
				E('div', { 'class': 'pq-metric-item' }, [
					E('div', { 'class': 'pq-metric-header' }, [
						E('span', { 'class': 'pq-metric-label' }, _('Входная частота')),
						inFBadge
					]),
					E('div', { 'class': 'pq-metric-val', 'style': 'color:' + (inFAbnormal ? '#dc2626' : '#059669') }, inF + ' Hz'),
					E('div', { 'class': 'pq-metric-footer' }, [
						E('span', {}, _('Норма: 47 ~ 53 Гц')),
						E('span', { 'class': 'pq-metric-mono' }, 'input.frequency')
					])
				]),

				// Card 4
				E('div', { 'class': 'pq-metric-item' }, [
					E('div', { 'class': 'pq-metric-header' }, [
						E('span', { 'class': 'pq-metric-label' }, _('Загрузка ИБП')),
						loadBadge
					]),
					E('div', { 'class': 'pq-metric-val', 'style': 'color:#2563eb;' }, load + ' %'),
					E('div', { 'class': 'pq-metric-footer' }, [
						E('span', {}, _('Норма: < 80 %')),
						E('span', { 'class': 'pq-metric-mono' }, 'ups.load')
					])
				]),

				// Card 5
				E('div', { 'class': 'pq-metric-item' }, [
					E('div', { 'class': 'pq-metric-header' }, [
						E('span', { 'class': 'pq-metric-label' }, _('Температура ИБП')),
						tempBadge
					]),
					E('div', { 'class': 'pq-metric-val', 'style': 'color:' + (hasTemp ? '#1e293b' : '#64748b') }, tempVal),
					E('div', { 'class': 'pq-metric-footer' }, [
						E('span', {}, _('Норма: < 50 °C')),
						E('span', { 'class': 'pq-metric-mono' }, 'battery.temperature')
					])
				]),

				// Card 6
				E('div', { 'class': 'pq-metric-item' }, [
					E('div', { 'class': 'pq-metric-header' }, [
						E('span', { 'class': 'pq-metric-label' }, _('Статус предупреждений ИБП')),
						statusBadge
					]),
					E('div', { 'class': 'pq-metric-val', 'style': 'color:' + (statusIsOnline ? '#059669' : '#2563eb') }, statusText),
					E('div', { 'class': 'pq-metric-footer' }, [
						E('span', {}, _('Норма: OL (питание от сети)')),
						E('span', { 'class': 'pq-metric-mono' }, 'ups.status')
					])
				])
			])
		]);
	},

	renderRulesCard: function() {
		var self = this;
		var r = this.rulesData;
		var isHideUnsupported = r.hide_unsupported === '1';

		var hideCheckbox = E('input', {
			'type': 'checkbox',
			'id': 'pq-hide-unsupported-check',
			'style': 'cursor:pointer;',
			'change': function(ev) {
				var checked = ev.target.checked;
				self.rulesData.hide_unsupported = checked ? '1' : '0';
				var items = document.querySelectorAll('.pq-rule-card.is-unsupported');
				for (var i = 0; i < items.length; i++) {
					if (checked) {
						items[i].classList.add('unsupported-hidden');
					} else {
						items[i].classList.remove('unsupported-hidden');
					}
				}
			}
		});
		if (isHideUnsupported) hideCheckbox.checked = true;

		var restoreBtn = E('button', {
			'class': 'btn cbi-button cbi-button-neutral',
			'style': 'border-radius:6px;padding:0.35rem 0.75rem;font-size:0.82rem;',
			'click': function() {
				if (!confirm(_('Восстановить все правила качества электроэнергии к заводским значениям?'))) return;
				for (var k in DEFAULT_RULES) {
					var el = document.getElementById('rule-input-' + k);
					if (el) el.value = DEFAULT_RULES[k];
					self.rulesData[k] = DEFAULT_RULES[k];
				}
				hideCheckbox.checked = false;
				var items = document.querySelectorAll('.pq-rule-card.is-unsupported');
				for (var i = 0; i < items.length; i++) items[i].classList.remove('unsupported-hidden');
				ui.addNotification(null, E('p', {}, _('Значения восстановлены. Нажмите «Сохранить правила», чтобы они действовали постоянно.')), 'info');
			}
		}, ['🔄 ', _('Восстановить по умолчанию')]);

		var saveBtn = E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'style': 'border-radius:6px;padding:0.35rem 0.85rem;font-size:0.82rem;',
			'click': function(ev) {
				var btn = ev.target;
				btn.disabled = true;

				// Harvest form values
				for (var k in DEFAULT_RULES) {
					var el = document.getElementById('rule-input-' + k);
					if (el) {
						self.rulesData[k] = el.value;
						uci.set('ups_manager', 'quality', k, el.value);
					}
				}
				uci.set('ups_manager', 'quality', 'hide_unsupported', hideCheckbox.checked ? '1' : '0');

				return uci.save().then(function() {
					return uci.apply();
				}).then(function() {
					btn.disabled = false;
					ui.addNotification(null, E('p', {}, _('Правила предупреждений и защиты качества электроэнергии сохранены и применены.')), 'info');
				}).catch(function(err) {
					btn.disabled = false;
					ui.addNotification(null, E('p', {}, _('Ошибка сохранения: ') + (err.message || err)), 'error');
				});
			}
		}, ['💾 ', _('Сохранить правила')]);

		return E('div', { 'class': 'pq-card' }, [
			E('div', { 'style': 'display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;margin-bottom:1rem;' }, [
				E('div', {}, [
					E('h3', { 'class': 'pq-section-heading' }, ['🔔 ', _('Правила предупреждений')]),
					E('p', { 'class': 'pq-section-desc', 'style': 'margin-bottom:0;' }, _('Настройка предупреждений о нарушениях качества электроэнергии и политики уведомлений'))
				]),
				E('div', { 'style': 'display:flex;align-items:center;gap:0.75rem;' }, [
					E('label', { 'style': 'display:flex;align-items:center;gap:0.35rem;font-size:0.82rem;color:var(--text-color-medium, #64748b);cursor:pointer;' }, [
						hideCheckbox,
						_('Скрыть неподдерживаемые пункты')
					]),
					restoreBtn,
					saveBtn
				])
			]),

			// Subsection 1: Status Rules
			E('div', { 'style': 'font-size:0.88rem;font-weight:700;color:var(--text-color-high, #334155);margin:1.25rem 0 0.75rem 0;' }, _('Предупреждения по состоянию (правила на основе изменения статуса)')),
			E('div', { 'class': 'pq-rules-grid' }, [
				// Rule 1: UPS 过载
				this.renderStatusRuleCard('status_overload_sev', _('Перегрузка ИБП'), true, r.status_overload_sev),
				// Rule 2: UPS 进入旁路模式
				this.renderStatusRuleCard('status_bypass_sev', _('ИБП перешёл в режим байпаса'), true, r.status_bypass_sev),
				// Rule 3: 电池需要更换 (不支持)
				this.renderStatusRuleCard('status_replace_batt_sev', _('Требуется замена батареи'), false, r.status_replace_batt_sev),
				// Rule 4: UPS 自检失败 (不支持)
				this.renderStatusRuleCard('status_selftest_fail_sev', _('Ошибка самодиагностики ИБП'), false, r.status_selftest_fail_sev)
			]),

			// Subsection 2: Numeric Rules
			E('div', { 'style': 'font-size:0.88rem;font-weight:700;color:var(--text-color-high, #334155);margin:1.5rem 0 0.75rem 0;' }, _('Предупреждения по значениям (правила на основе пороговых значений)')),
			E('div', { 'class': 'pq-rules-grid' }, [
				// 1. 输入电压过低
				this.renderNumericRuleCard('in_volt_low', _('Низкое входное напряжение'), 'V', true, r.in_volt_low_trig, r.in_volt_low_rec, r.in_volt_low_sev),
				// 2. 输入电压过高
				this.renderNumericRuleCard('in_volt_high', _('Высокое входное напряжение'), 'V', true, r.in_volt_high_trig, r.in_volt_high_rec, r.in_volt_high_sev),
				// 3. 输出电压过低
				this.renderNumericRuleCard('out_volt_low', _('Низкое выходное напряжение'), 'V', true, r.out_volt_low_trig, r.out_volt_low_rec, r.out_volt_low_sev),
				// 4. 输出电压过高
				this.renderNumericRuleCard('out_volt_high', _('Высокое выходное напряжение'), 'V', true, r.out_volt_high_trig, r.out_volt_high_rec, r.out_volt_high_sev),
				// 5. 输入频率过低
				this.renderNumericRuleCard('in_freq_low', _('Низкая входная частота'), 'Hz', true, r.in_freq_low_trig, r.in_freq_low_rec, r.in_freq_low_sev),
				// 6. 输入频率过高
				this.renderNumericRuleCard('in_freq_high', _('Высокая входная частота'), 'Hz', true, r.in_freq_high_trig, r.in_freq_high_rec, r.in_freq_high_sev),
				// 7. UPS 温度过高 (不支持)
				this.renderNumericRuleCard('temp_high', _('Высокая температура ИБП'), '°C', false, r.temp_high_trig, r.temp_high_rec, r.temp_high_sev),
				// 8. UPS 负载较高
				this.renderNumericRuleCard('load_high', _('Высокая загрузка ИБП'), '%', true, r.load_high_trig, r.load_high_rec, r.load_high_sev),
				// 9. UPS 严重过载
				this.renderNumericRuleCard('load_crit', _('Критическая перегрузка ИБП'), '%', true, r.load_crit_trig, r.load_crit_rec, r.load_crit_sev)
			])
		]);
	},

	renderStatusRuleCard: function(key, title, supported, curSev) {
		var isHidden = !supported && this.rulesData.hide_unsupported === '1';
		var cardClass = 'pq-rule-card' + (!supported ? ' is-unsupported' : '') + (isHidden ? ' unsupported-hidden' : '');

		var badge = supported ?
			E('span', { 'class': 'badge-pill badge-pill-green' }, _('Поддерживается')) :
			E('span', { 'class': 'text-unsupported' }, _('Не поддерживается'));

		var sevSelect = E('select', {
			'id': 'rule-input-' + key,
			'class': 'cbi-input-select'
		}, [
			E('option', { 'value': 'warning', 'selected': curSev === 'warning' }, _('Предупреждение')),
			E('option', { 'value': 'critical', 'selected': curSev === 'critical' }, _('Критично'))
		]);

		var noteNode = !supported ?
			E('div', { 'class': 'pq-rule-unsupported-note' }, [
				E('span', { 'style': 'color:#3b82f6;font-size:0.85rem;' }, 'ℹ️'),
				_('Текущий ИБП не предоставляет соответствующее поле данных')
			]) : '';

		return E('div', { 'class': cardClass }, [
			E('div', { 'class': 'pq-rule-title-row' }, [
				E('span', { 'class': 'pq-rule-title' }, title),
				badge
			]),
			E('div', { 'class': 'pq-rule-fields' }, [
				E('div', { 'class': 'pq-input-group' }, [
					E('label', {}, _('Степень серьёзности')),
					sevSelect
				])
			]),
			noteNode
		]);
	},

	renderNumericRuleCard: function(prefix, title, unit, supported, trigVal, recVal, sevVal) {
		var isHidden = !supported && this.rulesData.hide_unsupported === '1';
		var cardClass = 'pq-rule-card' + (!supported ? ' is-unsupported' : '') + (isHidden ? ' unsupported-hidden' : '');

		var badge = supported ?
			E('span', { 'class': 'badge-pill badge-pill-green' }, _('Поддерживается')) :
			E('span', { 'class': 'text-unsupported' }, _('Не поддерживается'));

		var trigInput = E('input', {
			'type': 'number',
			'id': 'rule-input-' + prefix + '_trig',
			'value': trigVal
		});

		var recInput = E('input', {
			'type': 'number',
			'id': 'rule-input-' + prefix + '_rec',
			'value': recVal
		});

		var sevSelect = E('select', {
			'id': 'rule-input-' + prefix + '_sev',
			'class': 'cbi-input-select'
		}, [
			E('option', { 'value': 'warning', 'selected': sevVal === 'warning' }, _('Предупреждение')),
			E('option', { 'value': 'critical', 'selected': sevVal === 'critical' }, _('Критично'))
		]);

		var noteNode = !supported ?
			E('div', { 'class': 'pq-rule-unsupported-note' }, [
				E('span', { 'style': 'color:#3b82f6;font-size:0.85rem;' }, 'ℹ️'),
				_('Текущий ИБП не предоставляет соответствующее поле данных')
			]) : '';

		return E('div', { 'class': cardClass }, [
			E('div', { 'class': 'pq-rule-title-row' }, [
				E('span', { 'class': 'pq-rule-title' }, title),
				badge
			]),
			E('div', { 'class': 'pq-rule-fields' }, [
				E('div', { 'class': 'pq-rule-inputs-row' }, [
					E('div', { 'class': 'pq-input-group' }, [
						E('label', {}, _('Порог срабатывания (') + unit + ')'),
						trigInput
					]),
					E('div', { 'class': 'pq-input-group' }, [
						E('label', {}, _('Порог восстановления (') + unit + ')'),
						recInput
					])
				]),
				E('div', { 'class': 'pq-input-group' }, [
					E('label', {}, _('Степень серьёзности')),
					sevSelect
				])
			]),
			noteNode
		]);
	},

	renderEventsCard: function() {
		var self = this;

		var tabAll = E('button', {
			'class': 'pq-tab-btn' + (this.activeFilter === 'all' ? ' active' : ''),
			'click': function() { self.switchTab('all'); }
		}, _('Все'));

		var tabOngoing = E('button', {
			'class': 'pq-tab-btn' + (this.activeFilter === 'ongoing' ? ' active' : ''),
			'click': function() { self.switchTab('ongoing'); }
		}, _('Активные'));

		var tabRecovered = E('button', {
			'class': 'pq-tab-btn' + (this.activeFilter === 'recovered' ? ' active' : ''),
			'click': function() { self.switchTab('recovered'); }
		}, _('Восстановленные'));

		var refreshEventsBtn = E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'style': 'border-radius:6px;padding:0.35rem 0.75rem;font-size:0.82rem;',
			'click': function() { self.refreshEvents(); }
		}, ['🔄 ', _('Обновить')]);

		var clearBtn = E('button', {
			'class': 'btn cbi-button cbi-button-neutral',
			'style': 'border-radius:6px;padding:0.35rem 0.75rem;font-size:0.82rem;',
			'click': function() {
				if (!confirm(_('Удалить все восстановленные события из истории?'))) return;
				callClearQualityEvents().then(function() {
					self.eventsList = [];
					self.updateEventsList();
					ui.addNotification(null, E('p', {}, _('Восстановленные события удалены.')), 'info');
				});
			}
		}, ['🗑️ ', _('Удалить восстановленные')]);

		var card = E('div', { 'class': 'pq-card', 'id': 'pq-events-card' }, [
			E('div', { 'style': 'display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;margin-bottom:1rem;' }, [
				E('div', {}, [
					E('h3', { 'class': 'pq-section-heading' }, ['⚠️ ', _('События отклонений')]),
					E('p', { 'class': 'pq-section-desc', 'style': 'margin-bottom:0;' }, _('Просмотр текущих и уже восстановленных отклонений качества электроэнергии.'))
				]),
				E('div', { 'style': 'display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;' }, [
					E('div', { 'style': 'display:flex;background:var(--background-color-low, #f1f5f9);border-radius:8px;padding:3px;gap:2px;' }, [
						tabAll, tabOngoing, tabRecovered
					]),
					refreshEventsBtn,
					clearBtn
				])
			]),
			E('div', { 'id': 'pq-events-list-container' }, this.renderEventRows()),
			E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;font-size:0.82rem;color:var(--text-color-medium, #64748b);margin-top:1.25rem;border-top:1px solid #f1f5f9;padding-top:0.75rem;' }, [
				E('span', { 'id': 'pq-events-count-label' }, _('Всего ') + this.eventsList.length + _(' записей · стр. 1/1')),
				E('div', { 'style': 'display:flex;align-items:center;gap:0.5rem;' }, [
					E('span', {}, _('20 записей на странице')),
					E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'disabled': true, 'style': 'padding:2px 8px;font-size:0.8rem;' }, _('Назад')),
					E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'disabled': true, 'style': 'padding:2px 8px;font-size:0.8rem;' }, _('Вперёд'))
				])
			])
		]);

		return card;
	},

	renderEventRows: function() {
		var self = this;
		var filtered = this.eventsList.filter(function(item) {
			if (self.activeFilter === 'ongoing') return item.status === 'ongoing';
			if (self.activeFilter === 'recovered') return item.status === 'recovered';
			return true;
		});

		if (filtered.length === 0) {
			return [
				E('div', { 'style': 'text-align:center;padding:2.5rem 0;color:var(--text-color-medium, #94a3b8);font-size:0.9rem;' }, _('Записей об отклонениях качества электроэнергии пока нет'))
			];
		}

		var rows = [];
		filtered.forEach(function(item) {
			var isRecovered = item.status === 'recovered';
			var circleNode = E('div', { 'class': 'pq-circle-icon ' + (isRecovered ? 'recovered' : 'ongoing') }, [
				E('div', { 'class': 'pq-dot' })
			]);

			var sevBadge = item.severity === 'critical' ?
				E('span', { 'class': 'badge-pill badge-pill-red' }, _('Критично')) :
				E('span', { 'class': 'badge-pill badge-pill-gray' }, _('Предупреждение'));

			var statusPill = isRecovered ?
				E('span', { 'class': 'badge-pill badge-pill-green' }, _('Восстановленные')) :
				E('span', { 'class': 'badge-pill badge-pill-red' }, _('Активные'));

			var detailBtn = E('button', {
				'class': 'btn cbi-button cbi-button-neutral',
				'style': 'padding:0.3rem 0.85rem;font-size:0.82rem;border-radius:6px;',
				'click': function() { self.showEventModal(item); }
			}, _('Подробнее'));

			var row = E('div', { 'class': 'pq-event-item' }, [
				E('div', { 'class': 'pq-event-left' }, [
					circleNode,
					E('div', {}, [
						E('div', { 'class': 'pq-event-main-line' }, [
							E('span', { 'class': 'pq-event-name' }, item.title || _('Колебания показателей электроэнергии')),
							sevBadge,
							E('span', { 'class': 'pq-event-val' }, item.value || '--'),
							statusPill
						]),
						E('div', { 'class': 'pq-event-subline' }, (item.time || '') + ' · ' + (item.id || ''))
					])
				]),
				E('div', {}, [detailBtn])
			]);

			rows.push(row);
		});

		return rows;
	},

	switchTab: function(tabName) {
		this.activeFilter = tabName;
		var card = document.getElementById('pq-events-card');
		if (card) {
			var btns = card.querySelectorAll('.pq-tab-btn');
			btns.forEach(function(b) { b.classList.remove('active'); });
			if (tabName === 'all' && btns[0]) btns[0].classList.add('active');
			if (tabName === 'ongoing' && btns[1]) btns[1].classList.add('active');
			if (tabName === 'recovered' && btns[2]) btns[2].classList.add('active');
		}
		this.updateEventsList();
	},

	updateEventsList: function() {
		var container = document.getElementById('pq-events-list-container');
		if (container) {
			dom.content(container, this.renderEventRows());
		}
		var countLabel = document.getElementById('pq-events-count-label');
		if (countLabel) {
			countLabel.innerText = _('Всего ') + this.eventsList.length + _(' записей · стр. 1/1');
		}
	},

	showEventModal: function(item) {
		ui.showModal(_('Подробности события отклонения качества электроэнергии'), [
			E('table', { 'class': 'table', 'style': 'margin-top:0.5rem;' }, [
				E('tr', {}, [
					E('td', { 'style': 'color:var(--text-color-high, #0f172a);font-weight:600;width:35%;'  }, _('Название события / ID')),
					E('td', { 'style': 'color:var(--text-color-high, #0f172a);' }, (item.title || '') + ' (' + (item.id || '') + ')')
				]),
				E('tr', {}, [
					E('td', { 'style': 'color:var(--text-color-high, #0f172a);font-weight:600;'  }, _('Уровень предупреждения')),
					E('td', { 'style': 'color:var(--text-color-high, #0f172a);' }, item.severity === 'critical' ? _('Критическое предупреждение') : _('Информационное предупреждение'))
				]),
				E('tr', {}, [
					E('td', { 'style': 'color:var(--text-color-high, #0f172a);font-weight:600;'  }, _('Текущее состояние')),
					E('td', { 'style': 'color:var(--text-color-high, #0f172a);' }, item.status === 'recovered' ? _('🟢 Восстановлено') : _('🔴 Отклонение продолжается'))
				]),
				E('tr', {}, [
					E('td', { 'style': 'color:var(--text-color-high, #0f172a);font-weight:600;'  }, _('Значение при срабатывании')),
					E('td', { 'style': 'color:var(--text-color-high, #0f172a);font-family:monospace;font-weight:bold;'  }, item.value || '--')
				]),
				E('tr', {}, [
					E('td', { 'style': 'color:var(--text-color-high, #0f172a);font-weight:600;'  }, _('Время срабатывания')),
					E('td', { 'style': 'color:var(--text-color-high, #0f172a);' }, item.time || '--')
				]),
				E('tr', {}, [
					E('td', { 'style': 'color:var(--text-color-high, #0f172a);font-weight:600;'  }, _('Длительность отклонения')),
					E('td', { 'style': 'color:var(--text-color-high, #0f172a);' }, item.duration || _('Кратковременное, устранено'))
				]),
				E('tr', {}, [
					E('td', { 'style': 'color:var(--text-color-high, #0f172a);font-weight:600;'  }, _('Пояснение к определению')),
					E('td', { 'style': 'color:var(--text-color-high, #0f172a);' }, item.detail || _('Показатели сети вышли за безопасные пределы. Событие автоматически записано в журнал анализа качества электроэнергии.'))
				])
			]),
			E('div', { 'class': 'right', 'style': 'margin-top:1.5rem;' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-action',
					'click': ui.hideModal
				}, _('Закрыть'))
			])
		]);
	},

	refreshEvents: function() {
		var self = this;
		return callGetQualityEvents().then(function(res) {
			if (res && res.events) {
				self.eventsList = res.events;
				self.updateEventsList();
			}
		});
	},

	refreshAll: function() {
		var self = this;
		return Promise.all([
			callGetStatus().catch(function() { return {}; }),
			callGetQualityEvents().catch(function() { return { events: [] }; })
		]).then(function(res) {
			self.statusData = res[0] || {};
			if (res[1] && res[1].events) {
				self.eventsList = res[1].events;
			}
			// Refresh UI elements
			var grid = document.getElementById('pq-metrics-grid');
			if (grid && grid.parentNode) {
				var newCard = self.renderCurrentMetricsCard();
				grid.parentNode.replaceWith(newCard);
			}
			self.updateEventsList();
			ui.addNotification(null, E('p', {}, _('Данные о качестве электроэнергии обновлены')), 'info');
		});
	}
});
