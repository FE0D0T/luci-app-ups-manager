'use strict';
'require view';
'require rpc';
'require ui';
'require dom';

var callGetEnergy = rpc.declare({
	object: 'luci.ups-manager',
	method: 'get_energy',
	expect: { '': {} }
});

var callGetStatus = rpc.declare({
	object: 'luci.ups-manager',
	method: 'get_status',
	expect: { '': {} }
});

function fmtEnergy(kwh, wh) {
	var k = Number(kwh) || 0;
	if (k < 0.01) return (Number(wh) || 0).toFixed(2) + ' Wh';
	return k.toFixed(3) + ' kWh';
}

return view.extend({
	load: function() {
		return Promise.all([
			callGetEnergy(),
			callGetStatus()
		]);
	},

	render: function(data) {
		var energy = data[0] || {};
		var status = data[1] || {};

		var container = E('div', { 'class': 'cbi-map' }, [
			E('h2', { 'class': 'cbi-map-title' }, _('Статистика потребления электроэнергии и отчёт об энергопотреблении')),
			E('div', { 'class': 'cbi-map-descr' }, _('Мониторинг мощности в реальном времени, суточное и месячное потребление. Поддерживаются метки измеренной и расчётной мощности.'))
		]);

		// Metric cards
		var cards = E('div', { 'class': 'ups-manager-grid', 'style': 'display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:1rem;margin-bottom:1.5rem;' }, [
			// Today kWh
			E('div', { 'class': 'cbi-section', 'style': 'background:var(--background-color-low, #ffffff);border:1px solid #e2e8f0;border-radius:0.75rem;padding:1.25rem;' }, [
				E('div', { 'style': 'color:var(--text-color-medium, #64748b);font-size:0.875rem;' }, _('Потребление за сегодня')),
				E('div', { 'style': 'font-size:1.8rem;font-weight:700;color:var(--text-color-high, #0f172a);margin:0.5rem 0;' },
					fmtEnergy(energy.today_kwh, energy.today_wh)
				),
				E('div', { 'style': 'font-size:0.8rem;color:var(--text-color-medium, #94a3b8);' }, _('Подсчёт ведётся с 00:00 текущего дня'))
			]),

			// Month kWh
			E('div', { 'class': 'cbi-section', 'style': 'background:var(--background-color-low, #ffffff);border:1px solid #e2e8f0;border-radius:0.75rem;padding:1.25rem;' }, [
				E('div', { 'style': 'color:var(--text-color-medium, #64748b);font-size:0.875rem;' }, _('Потребление за месяц')),
				E('div', { 'style': 'font-size:1.8rem;font-weight:700;color:var(--text-color-high, #0f172a);margin:0.5rem 0;' },
					fmtEnergy(energy.month_kwh, energy.month_wh)
				),
				E('div', { 'style': 'font-size:0.8rem;color:var(--text-color-medium, #94a3b8);' }, _('Суммарное значение за календарный месяц'))
			]),

			// Current Power
			E('div', { 'class': 'cbi-section', 'style': 'background:var(--background-color-low, #ffffff);border:1px solid #e2e8f0;border-radius:0.75rem;padding:1.25rem;' }, [
				E('div', { 'style': 'color:var(--text-color-medium, #64748b);font-size:0.875rem;' }, _('Текущая выходная мощность')),
				E('div', { 'style': 'font-size:1.8rem;font-weight:700;color:#2563eb;margin:0.5rem 0;' }, [
					(status.power !== null && status.power !== undefined) ? (status.power + ' W') : _('неизвестно'),
					status.power_is_estimated ?
						E('span', { 'style': 'font-size:0.75rem;background:#fef3c7;color:#b45309;padding:2px 6px;border-radius:4px;margin-left:6px;' }, _('расчёт')) :
						E('span', { 'style': 'font-size:0.75rem;background:rgba(16,185,129,0.22);color:#15803d;padding:2px 6px;border-radius:4px;margin-left:6px;' }, _('измерено'))
				]),
				E('div', { 'style': 'font-size:0.8rem;color:var(--text-color-medium, #94a3b8);' }, _('Пик: ') + (energy.peak_power || status.power || 0) + ' W')
			]),

			// Average Power
			E('div', { 'class': 'cbi-section', 'style': 'background:var(--background-color-low, #ffffff);border:1px solid #e2e8f0;border-radius:0.75rem;padding:1.25rem;' }, [
				E('div', { 'style': 'color:var(--text-color-medium, #64748b);font-size:0.875rem;' }, _('Средняя мощность за 24 часа')),
				E('div', { 'style': 'font-size:1.8rem;font-weight:700;color:var(--text-color-high, #0f172a);margin:0.5rem 0;' },
					(energy.avg_power || status.power || 0) + ' W'
				),
				E('div', { 'style': 'font-size:0.8rem;color:var(--text-color-medium, #94a3b8);' }, _('Рассчитано по средним значениям недавних замеров мощности'))
			])
		]);

		// Disclaimer & Calculation Principles (Strict requirement of Section VII)
		var noteSection = E('div', { 'class': 'cbi-section', 'style': 'background:var(--background-color-low, #f8fafc);border:1px solid #e2e8f0;border-radius:0.75rem;padding:1rem;margin-bottom:1.5rem;' }, [
			E('h4', { 'style': 'margin-top:0;color:var(--text-color-high, #334155);' }, 'ℹ ' + _('Пояснение алгоритма расчёта потребления')),
			E('ul', { 'style': 'margin:0;padding-left:1.25rem;color:var(--text-color-high, #475569);font-size:0.85rem;line-height:1.6;' }, [
				E('li', {}, _('Если устройство поддерживает поле ups.realpower, система напрямую считывает измеренную активную мощность.')),
				E('li', {}, _('Если ups.realpower не поддерживается, мощность рассчитывается как номинальная активная мощность (Вт) × (загрузка ups.load ÷ 100). В этом случае в интерфейсе указано «расчёт», типичная погрешность составляет 5–15% из-за колебаний коэффициента мощности и нелинейной нагрузки.')),
				E('li', {}, _('Потребление на выходе ИБП не равно общему потреблению из сети: вход также включает собственное потребление инвертора, потери на зарядку и КПД выпрямителя (обычно 85–95%).'))
			])
		]);

		dom.append(container, [cards, noteSection]);
		return container;
	}
});
